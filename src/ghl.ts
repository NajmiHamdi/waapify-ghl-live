import qs from "qs";
import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { createDecipheriv, createHash } from "node:crypto";
import { Storage } from "./storage";

export enum TokenType {
  Bearer = "Bearer",
}

export class GHL {
  constructor() {}

  /** Handle OAuth authorization code */
  async authorizationHandler(code: string) {
    if (!code) {
      console.warn("Please provide code when making call to authorization Handler");
      return;
    }
    await this.generateAccessTokenRefreshTokenPair(code);
  }

  /** Decrypt SSO Data */
  decryptSSOData(key: string) {
    try {
      const blockSize = 16;
      const keySize = 32;
      const ivSize = 16;
      const saltSize = 8;

      const rawEncryptedData = Buffer.from(key, "base64");
      const salt = rawEncryptedData.subarray(saltSize, blockSize);
      const cipherText = rawEncryptedData.subarray(blockSize);

      let result = Buffer.alloc(0, 0);
      while (result.length < keySize + ivSize) {
        const hasher = createHash("md5");
        result = Buffer.concat([
          result,
          hasher.update(
            Buffer.concat([
              result.subarray(-ivSize),
              Buffer.from(process.env.GHL_APP_SSO_KEY as string, "utf-8"),
              salt,
            ])
          ).digest(),
        ]);
      }

      const decipher = createDecipheriv(
        "aes-256-cbc",
        result.subarray(0, keySize),
        result.subarray(keySize, keySize + ivSize)
      );

      const decrypted = decipher.update(cipherText);
      const finalDecrypted = Buffer.concat([decrypted, decipher.final()]);
      return JSON.parse(finalDecrypted.toString());
    } catch (error) {
      console.error("Error decrypting SSO data:", error);
      throw error;
    }
  }

  /** Create Axios instance with token intercept */
  requests(resourceId: string) {
    const baseUrl = process.env.GHL_API_DOMAIN;

    const installation = Storage.find(resourceId);
    if (!installation) throw new Error("Installation not found for the following resource");

    const axiosInstance = axios.create({
      baseURL: baseUrl,
    });

    axiosInstance.interceptors.request.use(async (requestConfig: InternalAxiosRequestConfig) => {
      requestConfig.headers["Authorization"] = `${TokenType.Bearer} ${installation.access_token}`;
      return requestConfig;
    });

    axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          await this.refreshAccessToken(resourceId);
          originalRequest.headers.Authorization = `Bearer ${Storage.find(resourceId)?.access_token}`;
          return axios(originalRequest);
        }

        return Promise.reject(error);
      }
    );

    return axiosInstance;
  }

  /** Check if installation exists */
  checkInstallationExists(resourceId: string) {
    return !!Storage.find(resourceId);
  }

  /** Get location token from company token */
  async getLocationTokenFromCompanyToken(companyId: string, locationId: string) {
    const res = await this.requests(companyId).post(
      "/oauth/locationToken",
      { companyId, locationId },
      { headers: { Version: "2021-07-28" } }
    );
    Storage.save({
      companyId,
      locationId,
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      expires_in: res.data.expires_in,
    });
  }

  /** Refresh access token */
  private async refreshAccessToken(resourceId: string) {
    const installation = Storage.find(resourceId);
    if (!installation) throw new Error("No installation found to refresh token");

    try {
      const resp = await axios.post(
        `${process.env.GHL_API_DOMAIN}/oauth/token`,
        qs.stringify({
          client_id: process.env.GHL_APP_CLIENT_ID,
          client_secret: process.env.GHL_APP_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: installation.refresh_token,
        }),
        { headers: { "content-type": "application/x-www-form-urlencoded" } }
      );

      Storage.save({
        companyId: installation.companyId,
        locationId: installation.locationId,
        access_token: resp.data.access_token,
        refresh_token: resp.data.refresh_token,
        expires_in: resp.data.expires_in,
      });
    } catch (error: any) {
      console.error(error?.response?.data);
    }
  }

  /** Generate access & refresh token pair */
  private async generateAccessTokenRefreshTokenPair(code: string) {
    try {
      const resp = await axios.post(
        `${process.env.GHL_API_DOMAIN}/oauth/token`,
        qs.stringify({
          client_id: process.env.GHL_APP_CLIENT_ID,
          client_secret: process.env.GHL_APP_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
        }),
        { headers: { "content-type": "application/x-www-form-urlencoded" } }
      );

      Storage.save({
        companyId: resp.data.companyId,
        locationId: resp.data.locationId,
        access_token: resp.data.access_token,
        refresh_token: resp.data.refresh_token,
        expires_in: resp.data.expires_in,
      });
    } catch (error: any) {
      console.error(error?.response?.data);
    }
  }
}
