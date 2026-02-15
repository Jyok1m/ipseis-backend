const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
	{
		firstName: { type: String, required: true, trim: true },
		lastName: { type: String, required: true, trim: true },
		email: { type: String, required: true, unique: true, lowercase: true },
		password: { type: String, required: true },
		phone: { type: String, required: true },
		company: { type: String, required: true },
		position: { type: String, required: true },
		address: { type: String, required: true },
		role: {
			type: String,
			required: true,
			enum: ["administrateur", "apprenant", "professionnel"],
		},
		isActive: { type: Boolean, default: true },
		activationCodeUsed: { type: String },
	},
	{ timestamps: true }
);

module.exports = mongoose.models.users || mongoose.model("users", userSchema);
