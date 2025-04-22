import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  uuid: { type: String, unique: true, required: true },
  userAgent: { type: String, required: true },
  ip: { type: String, required: true },

  // posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Report" }],

  suspiciousPosts: [
    {
      postId: { type: String, required: true },
      userName: { type: String, required: true },
      Posturl: { type: String, required: true }
    },
  ],

  NotImportantPosts: [
    {
      postId: { type: String, required: true },
      userName: { type: String, required: true },
      Posturl: { type: String, required: true }
    },
  ],

  suspiciousUsers: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      userName: String,
    },
  ],

  spamUsers: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      userName: String,
    },
  ],

  logs: [
    {
      action: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],

  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model("User", userSchema);
