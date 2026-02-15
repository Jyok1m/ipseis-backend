const mongoose = require("mongoose");

const trainingSchema = new mongoose.Schema({
	title: { type: String, required: true },
	pedagogical_objectives: [{ type: String, required: true }],
	program: [{ type: String, required: true }],
	pedagogical_methods: [{ type: String, required: true }],
	audience: { type: String, required: true },
	prerequisites: { type: String, required: true },
	evaluation_methods: [{ type: String, required: true }],
	trainer: { type: String, required: true },
	number_of_trainees: { type: String, required: true },
	duration: { type: String, required: true },
	quote: { type: String, required: true },
	isVisible: { type: Boolean, default: true },
});

module.exports = mongoose.models.trainings || mongoose.model("trainings", trainingSchema);
