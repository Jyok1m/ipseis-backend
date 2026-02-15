const mongoose = require("mongoose");

const passwordResetTokenSchema = new mongoose.Schema(
	{
		userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
		token: { type: String, required: true, unique: true },
		expiresAt: { type: Date, required: true },
	},
	{ timestamps: true }
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.passwordresettokens || mongoose.model("passwordresettokens", passwordResetTokenSchema);
