import express from "express";
import crypto from "crypto";
import { User } from "../models/User.js";
import { Report } from "../models/Report.js";

const router = express.Router();

// Register or Retrieve User
router.post("/register", async (req, res) => {
  try {
    const { userAgent, ip } = req.body;

    let user = await User.findOne({ userAgent, ip });

    if (!user) {
      const newUUID = crypto.randomUUID();
      user = new User({
        uuid: newUUID,
        userAgent,
        ip,
        logs: [{ action: "User Registered", timestamp: new Date() }],
      });
      await user.save();
    } else {
      user.logs.push({ action: "User Login", timestamp: new Date() });
      await user.save();
    }

    res.json({ uuid: user.uuid });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get Blocked Posts
router.get("/blocked-posts/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const { reportType } = req.query;

    if (!["spam", "notUseful", "all"].includes(reportType)) {
      return res.status(400).json({ error: "Invalid or missing reportType" });
    }

    const user = await User.findOne({ uuid });
    if (!user) return res.status(404).json({ error: "User not found" });

    let blockedUsers = [];
    if (reportType === "spam") {
      blockedUsers = user.suspiciousPosts;
    } else if (reportType === "notUseful") {
      blockedUsers = user.NotImportantPosts;
    } else {
      blockedUsers = [...user.suspiciousPosts, ...user.NotImportantPosts];
    }

    return res.json({ blockedUsers });
  } catch (error) {
    console.error("Error in GET /blocked-users:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Blocked Users
router.get("/blocked-users/:uuid", async (req, res) => {
  try {
    const { uuid } = req.params;
    const { blockType } = req.query;

    if (!["suspicious", "spam", "all"].includes(blockType)) {
      return res.status(400).json({ error: "Invalid or missing blockType" });
    }

    const user = await User.findOne({ uuid });
    if (!user) return res.status(404).json({ error: "User not found" });

    let blockedUsers = [];
    if (blockType === "suspicious") {
      blockedUsers = user.suspiciousUsers;
    } else if (blockType === "spam") {
      blockedUsers = user.spamUsers;
    } else {
      blockedUsers = [...user.suspiciousUsers, ...user.spamUsers];
    }

    return res.json({ blockedUsers });
  } catch (error) {
    console.error("Error in GET /blocked-users:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Block a Post
router.post("/block-post", async (req, res) => {
  try {
    const { uuid, postId, reportType, userName, postUrl } = req.body;

    if (!postId || !userName || !postUrl) {
      return res.status(400).json({ error: "Missing postId, userName, or postUrl" });
    }

    if (!["spam", "notUseful"].includes(reportType)) {
      return res.status(400).json({ error: "Invalid report type" });
    }

    const user = await User.findOne({ uuid });
    if (!user) return res.status(404).json({ error: "User not found" });

    let report = await Report.findOne({ postId });

    if (!report) {
      report = new Report({
        postId,
        ReportedSpam: reportType === "spam" ? [uuid] : [],
        ReportedNotUseful: reportType === "notUseful" ? [uuid] : [],
      });
    } else {
      const alreadyReported = reportType === "spam"
        ? report.ReportedSpam.includes(uuid)
        : report.ReportedNotUseful.includes(uuid);

      if (alreadyReported) {
        return res.status(409).json({ error: "Post already reported by you" });
      }

      if (reportType === "spam") {
        report.ReportedSpam.push(uuid);
      } else {
        report.ReportedNotUseful.push(uuid);
      }
    }

    await report.save();

    const postData = { postId, userName, Posturl: postUrl };
    const reportRefId = report._id;

    if (reportType === "spam") {
      const alreadyExists = user.suspiciousPosts.some(p => p.postId === postId);
      if (!alreadyExists) {
        user.suspiciousPosts.push(postData);
      }
    } else {
      const alreadyExists = user.NotImportantPosts.some(p => p.postId === postId);
      if (!alreadyExists) {
        user.NotImportantPosts.push(postData);
      }
    }

    user.logs.push({
      action: `Reported Post: ${postId} as ${reportType}`,
      timestamp: new Date(),
    });

    await user.save();

    return res.status(201).json({
      message: `Post reported as ${reportType} successfully`,
      reportId: reportRefId,
    });
  } catch (error) {
    console.error("Error in block-post:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

// Unblock a Post
router.delete("/block-post/:uuid/:postId", async (req, res) => {
  try {
    const { uuid, postId } = req.params;
    const { reportType } = req.query;

    if (!["spam", "notUseful"].includes(reportType)) {
      return res.status(400).json({ error: "Invalid or missing report type" });
    }

    const user = await User.findOne({ uuid });
    if (!user) return res.status(404).json({ error: "User not found" });

    let removed = false;
    if (reportType === "spam") {
      const initialLength = user.suspiciousPosts.length;
      user.suspiciousPosts = user.suspiciousPosts.filter(p => p.postId !== postId);
      removed = user.suspiciousPosts.length < initialLength;
    } else {
      const initialLength = user.NotImportantPosts.length;
      user.NotImportantPosts = user.NotImportantPosts.filter(p => p.postId !== postId);
      removed = user.NotImportantPosts.length < initialLength;
    }

    if (!removed) {
      return res.status(404).json({ error: "Reported post not found for this reportType" });
    }

    user.logs.push({
      action: `Removed reported post: ${postId} from ${reportType}`,
      timestamp: new Date(),
    });

    await user.save();

    return res.json({ message: `Post removed from ${reportType} reports`, postId });
  } catch (error) {
    console.error("Error in DELETE /block-post:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

// Check if Post is Blocked
router.post("/is-post-blocked", async (req, res) => {
  try {
    const { uuid, postId } = req.body;

    if (!uuid || !postId) {
      return res.status(400).json({ error: "Missing uuid or postId" });
    }

    const user = await User.findOne({ uuid });
    if (!user) return res.status(404).json({ error: "User not found" });

    const blockedPosts = user.blockedPosts || [];

    const isBlocked = blockedPosts.some(
      (blocked) => blocked.toString() === postId.toString()
    );

    res.json({ isBlocked });
  } catch (error) {
    console.error("Error checking if post is blocked:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Block a User
router.post("/block-user", async (req, res) => {
  try {
    const { uuid, targetUserName, blockType } = req.body;

    if (!uuid || !targetUserName || !blockType) {
      return res.status(400).json({ error: "Missing uuid, targetUserName, or blockType" });
    }

    if (!["suspicious", "spam"].includes(blockType)) {
      return res.status(400).json({ error: "Invalid block type" });
    }

    const user = await User.findOne({ uuid });
    if (!user) return res.status(404).json({ error: "User not found" });

    const list = blockType === "suspicious" ? user.suspiciousUsers : user.spamUsers;
    const alreadyExists = list.some(u => u.userName === targetUserName);

    if (alreadyExists) {
      return res.status(409).json({ error: "User already added" });
    }

    list.push({ userName: targetUserName });

    user.logs.push({
      action: `Added ${targetUserName} to ${blockType}Users`,
      timestamp: new Date(),
    });

    await user.save();

    return res.status(201).json({ message: `User added to ${blockType}Users successfully` });
  } catch (error) {
    console.error("Error in POST /block-user:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

// Unblock a User
router.delete("/block-user/:uuid/:targetUserName", async (req, res) => {
  try {
    const { uuid, targetUserName } = req.params;
    const { blockType } = req.query;

    if (!["suspicious", "spam"].includes(blockType)) {
      return res.status(400).json({ error: "Invalid or missing block type" });
    }

    const user = await User.findOne({ uuid });
    if (!user) return res.status(404).json({ error: "User not found" });

    let initialLength;
    if (blockType === "suspicious") {
      initialLength = user.suspiciousUsers.length;
      user.suspiciousUsers = user.suspiciousUsers.filter(u => u.userName !== targetUserName);
    } else {
      initialLength = user.spamUsers.length;
      user.spamUsers = user.spamUsers.filter(u => u.userName !== targetUserName);
    }

    const removed = blockType === "suspicious"
      ? user.suspiciousUsers.length < initialLength
      : user.spamUsers.length < initialLength;

    if (!removed) {
      return res.status(404).json({ error: "User not found in the block list" });
    }

    user.logs.push({
      action: `Removed ${targetUserName} from ${blockType}Users`,
      timestamp: new Date(),
    });

    await user.save();

    return res.json({ message: `User removed from ${blockType}Users`, targetUserName });
  } catch (error) {
    console.error("Error in DELETE /block-user:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
