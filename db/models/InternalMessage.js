const mongoose = require("mongoose");

const internalMessageSchema = new mongoose.Schema(
	{
		senderUser: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
		recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
		subject: { type: String, required: true },
		content: { type: String, required: true },
		isRead: { type: Boolean, default: false },
		parentMessage: { type: mongoose.Schema.Types.ObjectId, ref: "internalMessages", default: null },
		conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "internalMessages", default: null },
	},
	{ timestamps: true }
);

internalMessageSchema.index({ recipientUser: 1, createdAt: -1 });
internalMessageSchema.index({ senderUser: 1 });
internalMessageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.models.internalMessages || mongoose.model("internalMessages", internalMessageSchema);
