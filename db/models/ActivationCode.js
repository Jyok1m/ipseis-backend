const mongoose = require("mongoose");

const activationCodeSchema = new mongoose.Schema(
	{
		code: { type: String, required: true, unique: true },
		role: {
			type: String,
			required: true,
			enum: ["apprenant", "professionnel"],
		},
		targetEmail: { type: String, required: true },
		isUsed: { type: Boolean, default: false },
		usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
		usedAt: { type: Date, default: null },
		expiresAt: { type: Date, required: true },
		cancelled: { type: Boolean, default: false },
		cancelledAt: { type: Date, default: null },
		archived: { type: Boolean, default: false },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
	},
	{ timestamps: true }
);

activationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.activationcodes || mongoose.model("activationcodes", activationCodeSchema);
