import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
    postId: { type: String, required: true, unique: true },
    postUrl: { type: String },

    ReportedSpam: {
        type: [String],
        default: [],
    },

    ReportedNotUseful: {
        type: [String],
        default: [],
    },

    createdAt: { type: Date, default: Date.now },
});

export const Report = mongoose.model("Report", postSchema);
