const mongoose = require("mongoose");

const checklistSchema = new mongoose.Schema(
	{
		title: { type: String, required: true },
		description: { type: String, default: "" },
		items: [
			{
				text: { type: String, required: true },
				isChecked: { type: Boolean, default: false },
				notes: { type: String, default: "" },
			},
		],
		linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
		linkedProspectId: { type: mongoose.Schema.Types.ObjectId, ref: "prospects", default: null },
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
	},
	{ timestamps: true }
);

module.exports = mongoose.models.checklists || mongoose.model("checklists", checklistSchema);
