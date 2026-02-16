const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		description: { type: String, default: "" },
		pdfUrl: { type: String, required: true },
		originalFileName: { type: String, default: "" },
		linkedTraining: { type: mongoose.Schema.Types.ObjectId, ref: "trainings", required: true },
		targetRoles: [{ type: String, enum: ["apprenant", "professionnel"] }],
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
	},
	{ timestamps: true }
);

module.exports = mongoose.models.resources || mongoose.model("resources", resourceSchema);
