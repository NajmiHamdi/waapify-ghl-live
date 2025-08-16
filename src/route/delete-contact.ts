
import express from "express";
import { GHL } from "../ghl";
import { Storage } from "../storage";

const router = express.Router();

router.delete("/", async (req, res) => {
  const { companyId, contactId } = req.body;

  if (!companyId || !contactId) {
    return res.status(400).json({ error: "companyId & contactId required" });
  }

  try {
    const ghl = new GHL();

    if (!ghl.checkInstallationExists(companyId)) {
      return res.status(400).json({ error: "Installation not found, OAuth required" });
    }

    const api = ghl.requests(companyId);
    await api.delete(`/contacts/${contactId}`, {
      headers: { Version: "2021-07-28" },
    });

    res.json({ message: "Contact deleted successfully" });
  } catch (err: any) {
    console.error("Delete contact error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

export default router;
