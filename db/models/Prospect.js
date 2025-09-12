const mongoose = require("mongoose");

const prospectSchema = new mongoose.Schema(
	{
		firstName: { type: String, required: true },
		lastName: { type: String, required: true },
		email: { type: String, required: true },
	},
	{ timestamps: true }
);

module.exports = mongoose.models.prospects || mongoose.model("prospects", prospectSchema);
