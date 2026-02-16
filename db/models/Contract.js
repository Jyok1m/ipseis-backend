const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		description: { type: String, default: "" },
		linkedTraining: { type: mongoose.Schema.Types.ObjectId, ref: "trainings", default: null },
		startDate: { type: Date, default: null },
		endDate: { type: Date, default: null },
		amount: { type: Number, default: 0 },
		status: { type: String, enum: ["draft", "sent", "signed", "cancelled", "rejected"], default: "draft" },
		pdfUrl: { type: String, default: "" },
		recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
		signedAt: { type: Date, default: null },
		signedIP: { type: String, default: "" },
		signedUserAgent: { type: String, default: "" },
		rejectedAt: { type: Date, default: null },
		cancelledAt: { type: Date, default: null },
	},
	{ timestamps: true }
);

module.exports = mongoose.models.contracts || mongoose.model("contracts", contractSchema);
