const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
	{
		firstName: { type: String, required: true },
		lastName: { type: String, required: true },
		email: { type: String, required: true },
		message: { type: String, required: true },
		interestedFormations: { type: [String], default: [] },
	},
	{ timestamps: true }
);

module.exports = mongoose.models.messages || mongoose.model("messages", messageSchema);
