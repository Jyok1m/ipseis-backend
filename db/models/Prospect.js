const mongoose = require("mongoose");

const prospectSchema = new mongoose.Schema(
	{
		firstName: { type: String, required: true },
		lastName: { type: String, required: true },
		email: { type: String, required: true, unique: true },
		source: {
			type: String,
			enum: ["contact", "catalogue", "mixed"],
			default: "contact",
		},
		lastInteractionDate: { type: Date, default: Date.now },
		interactionCount: { type: Number, default: 0 },
		hasCatalogueDownload: { type: Boolean, default: false },
		hasContactMessage: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

module.exports = mongoose.models.prospects || mongoose.model("prospects", prospectSchema);
