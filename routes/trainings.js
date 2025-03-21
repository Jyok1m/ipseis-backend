var express = require("express");
var router = express.Router();
var db = require("../db/db");

router.get("/by-id/:trainingId", async function (req, res) {
	const { trainingId } = req.params;

	if (!trainingId) {
		return res.status(400).json({ error: "Identifiant de formation manquant." });
	} else if (trainingId.length !== 24) {
		return res.status(400).json({ error: "Identifiant de formation invalide." });
	}

	try {
		const training = await db.trainings.findById(trainingId).lean();
		const theme = await db.themes.findOne({ trainings: trainingId }).select("_id title").lean();

		if (!training) {
			return res.status(404).json({ error: "Formation introuvable." });
		}

		res.json({ ...training, themeId: theme._id, theme: theme.title });
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Erreur interne. Merci de réessayer plus tard." });
	}
});

router.get("/by-theme/:themeId", async function (req, res) {
	const { themeId } = req.params;

	if (!themeId) {
		return res.status(400).json({ error: "Identifiant de theme manquant." });
	} else if (themeId.length !== 24) {
		return res.status(400).json({ error: "Identifiant de theme invalide." });
	}

	try {
		const theme = await db.themes.findById(themeId).populate("trainings").select("trainings").lean();

		if (!theme) {
			return res.status(404).json({ error: "Theme introuvable." });
		}

		const { trainings } = theme;

		const trainingList = trainings.map((training) => {
			const { _id, title, description } = training;
			return { _id, title, description };
		});

		res.json(trainingList);
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Erreur interne. Merci de réessayer plus tard." });
	}
});

module.exports = router;
