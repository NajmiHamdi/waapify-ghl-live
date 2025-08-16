import express from "express";
import { GHL } from "../ghl";
import { Storage } from "../storage";

const router = express.Router();

// GET /list-contacts?companyId=...&locationId=...
router.get("/", async (req, res) => {
  const { companyId, locationId } = req.query as { companyId: string; locationId: string };

  if (!companyId || !locationId) {
    return res.status(400).json({ error: "companyId & locationId required" });
  }

  try {
    const ghl = new GHL();

    // Pastikan company token ada
    if (!ghl.checkInstallationExists(companyId)) {
      return res.status(400).json({ error: "Installation not found, OAuth required" });
    }

    // Panggil API pakai company token
    const api = ghl.requests(companyId);
    const response = await api.get(`/contacts/?locationId=${locationId}`, {
      headers: { Version: "2021-07-28" },
    });

    // Return JSON sahaja
    res.json({
      message: "Contacts fetched successfully",
      contacts: response.data.contacts || [],
    });
  } catch (err: any) {
    console.error("List contacts error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

export default router;
