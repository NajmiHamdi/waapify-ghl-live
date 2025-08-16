import express from "express";
import { GHL } from "../ghl";
import { Storage } from "../storage";

const router = express.Router();

router.post("/", async (req, res) => {
  const { companyId, locationId, firstName, lastName, email, phone } = req.body;

  if (!companyId || !locationId) {
    return res.status(400).json({ error: "companyId & locationId required" });
  }

  try {
    const ghl = new GHL();

    if (!ghl.checkInstallationExists(companyId)) {
      return res.status(400).json({ error: "Installation not found, OAuth required" });
    }

    let token = Storage.getTokenForLocation(locationId);
    if (!token) {
      await ghl.getLocationTokenFromCompanyToken(companyId, locationId);
      token = Storage.getTokenForLocation(locationId);
      if (!token) return res.status(500).json({ error: "Failed to get location token" });
    }

    const api = ghl.requests(locationId);
    const response = await api.post(
      "/contacts",
      { firstName, lastName, email, phone, locationId },
      { headers: { Version: "2021-07-28" } }
    );

    res.json({ message: "Contact created successfully", data: response.data });
  } catch (err: any) {
    console.error("Create contact error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

export default router;
