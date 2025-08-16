import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import { GHL } from "./ghl";
import { Storage } from "./storage";
import { json } from "body-parser";

// Routes
import testCreateContactRoute from "./route/test-create-contact";
import listContactsRoute from "./route/list-contacts";
import updateContactRoute from "./route/update-contact";
import deleteContactRoute from "./route/delete-contact";

dotenv.config();

const app: Express = express();
const ghl = new GHL();
const port = process.env.PORT || 3000;
const path = __dirname + "/ui/dist/";

// Body parser
app.use(json({ type: "application/json" }));

// Static folder
app.use(express.static(path));

// Mount routes
app.use("/test-create-contact", testCreateContactRoute);
app.use("/list-contacts", listContactsRoute);
app.use("/update-contact", updateContactRoute);
app.use("/delete-contact", deleteContactRoute);

/* -------------------- Authorization handler -------------------- */
app.get("/authorize-handler", async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code received");

  try {
    await ghl.authorizationHandler(code as string);

    const installations = Storage.getAll();
    console.log("=== All installations ===", installations);

    res.redirect("https://app.gohighlevel.com/");
  } catch (error) {
    console.error("Authorization error:", error);
    res.status(500).send("Authorization failed");
  }
});

/* -------------------- Example API Call with Location -------------------- */
app.get("/example-api-call-location", async (req, res) => {
  const { companyId, locationId } = req.query as { companyId: string; locationId: string };

  if (!companyId || !locationId) return res.status(400).send("Missing companyId or locationId");

  try {
    if (!ghl.checkInstallationExists(companyId)) {
      return res.status(400).send("Company token not found. Authorize app first.");
    }

    let token = Storage.getTokenForLocation(locationId);
    if (!token) {
      await ghl.getLocationTokenFromCompanyToken(companyId, locationId);
      token = Storage.getTokenForLocation(locationId);
    }

    if (!token) return res.status(400).send("Failed to get access token for location");

    const request = await ghl.requests(companyId).get(`/contacts/?locationId=${locationId}`, {
      headers: { Version: "2021-07-28" },
    });

    console.log("Location API response:", request.data);
    res.json(request.data);
  } catch (error) {
    console.error("/example-api-call-location error:", error);
    res.status(400).send(error);
  }
});

/* -------------------- Root -------------------- */
app.get("/", (req, res) => res.sendFile(path + "index.html"));

/* -------------------- Start server -------------------- */
app.listen(port, () => console.log(`GHL app listening on port ${port}`));
