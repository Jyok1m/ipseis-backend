const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
	{
		firstName: { type: String, required: true },
		lastName: { type: String, required: true },
		email: { type: String, required: true },
		message: { type: String, required: true },
		interestedFormations: { type: [String], default: [] },
		isRead: { type: Boolean, default: false },
		replies: [
			{
				content: { type: String, required: true },
				sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
				sentAt: { type: Date, default: Date.now },
			},
		],
	},
	{ timestamps: true }
);

messageSchema.index({ isRead: 1, createdAt: -1 });

module.exports = mongoose.models.messages || mongoose.model("messages", messageSchema);
