const mongoose = require("mongoose");

const interactionSchema = new mongoose.Schema(
	{
		prospectId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "prospects",
			required: true,
		},
		type: {
			type: String,
			enum: ["contact_message", "catalogue_download"],
			required: true,
		},
		data: {
			// Pour contact_message: { message: "...", messageId: "...", interestedFormations: [...] }
			// Pour catalogue_download: { catalogueVersion: "2025", interestedFormations: [...] }
			type: mongoose.Schema.Types.Mixed,
		},
		userAgent: { type: String },
		ipAddress: { type: String },
		notes: { type: String },
	},
	{ timestamps: true }
);

// Index pour optimiser les requêtes
interactionSchema.index({ prospectId: 1, createdAt: -1 });
interactionSchema.index({ type: 1 });

module.exports = mongoose.models.interactions || mongoose.model("interactions", interactionSchema);
