const mongoose = require("mongoose");

const archivedConversationSchema = new mongoose.Schema(
	{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "InternalMessage", required: true },
	},
	{ timestamps: true }
);

archivedConversationSchema.index({ userId: 1, conversationId: 1 }, { unique: true });

module.exports = mongoose.model("ArchivedConversation", archivedConversationSchema);
