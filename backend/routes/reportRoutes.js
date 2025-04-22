import express from "express";
import { User } from "../models/User.js";
import { Report } from "../models/Report.js";

const router = express.Router();

/**
 * Report a Post
 */
router.post("/report", async (req, res) => {
  try {
    const { uuid, postUrl, reason, screenshot } = req.body;

    const user = await User.findOne({ uuid });
    if (!user) return res.status(404).json({ error: "User not found" });

    const report = new Report({
      userId: user._id,
      postUrl,
      reason,
      screenshot,
    });

    user.logs.push({ action: `Reported Post: ${postUrl}`, timestamp: new Date() });

    await report.save();
    await user.save();

    res.json({ message: "Report Submitted", report });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
