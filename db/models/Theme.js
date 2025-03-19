const mongoose = require("mongoose");

	const themeSchema = new mongoose.Schema({
		title: { type: String, required: true },
		type: { type: String, required: true },
		trainings: [{ type: mongoose.Schema.Types.ObjectId, ref: "trainings" }],
	});

module.exports = mongoose.models.themes || mongoose.model("themes", themeSchema);
