var express = require("express");
var router = express.Router();
var db = require("../db/db");

router.get("/all", async function (req, res) {
	try {
		const themes = await db.themes.find().populate("trainings").select("_id title trainings").lean().maxTimeMS(20000);

		const formattedThemes = [];
		for (const theme of themes) {
			const formattedTrainings = theme.trainings
				.filter((training) => training.isVisible !== false)
				.map((training) => {
					const { _id, title } = training;
					return { _id, title };
				});
			formattedThemes.push({ _id: theme._id, title: theme.title, trainings: formattedTrainings });
		}

		res.json({ themes: formattedThemes });
	} catch (error) {
		console.error("❌ Error fetching training:", error);

		if (error.name === "MongooseError" && error.message.includes("buffering timed out")) {
			return res.status(503).json({
				error: "Connexion à la base de données interrompue. Veuillez réessayer.",
				code: "DB_TIMEOUT",
			});
		}

		if (error.name === "MongoTimeoutError") {
			return res.status(503).json({
				error: "Délai d'attente de la base de données dépassé. Veuillez réessayer.",
				code: "DB_TIMEOUT",
			});
		}

		res.status(500).json({
			error: "Erreur interne. Merci de réessayer plus tard.",
			code: "INTERNAL_ERROR",
		});
	}
});

router.get("/by-id/:trainingId", async function (req, res) {
	const { trainingId } = req.params;

	if (!trainingId) {
		return res.status(400).json({ error: "Identifiant de formation manquant." });
	} else if (trainingId.length !== 24) {
		return res.status(400).json({ error: "Identifiant de formation invalide." });
	}

	try {
		//console.log(`📚 Fetching training with ID: ${trainingId}`);

		const training = await db.trainings.findById(trainingId).lean().maxTimeMS(20000);
		const theme = await db.themes.findOne({ trainings: trainingId }).select("_id title").lean().maxTimeMS(20000);

		if (!training || training.isVisible === false) {
			return res.status(404).json({ error: "Formation introuvable." });
		}

		//console.log(`✅ Training found: ${training.title}`);
		res.json({ ...training, themeId: theme._id, theme: theme.title });
	} catch (error) {
		console.error("❌ Error fetching training:", error);

		if (error.name === "MongooseError" && error.message.includes("buffering timed out")) {
			return res.status(503).json({
				error: "Connexion à la base de données interrompue. Veuillez réessayer.",
				code: "DB_TIMEOUT",
			});
		}

		if (error.name === "MongoTimeoutError") {
			return res.status(503).json({
				error: "Délai d'attente de la base de données dépassé. Veuillez réessayer.",
				code: "DB_TIMEOUT",
			});
		}

		res.status(500).json({
			error: "Erreur interne. Merci de réessayer plus tard.",
			code: "INTERNAL_ERROR",
		});
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
		//console.log(`🎯 Fetching trainings for theme ID: ${themeId}`);

		const theme = await db.themes.findById(themeId).populate("trainings").select("trainings").lean().maxTimeMS(20000);

		if (!theme) {
			return res.status(404).json({ error: "Theme introuvable." });
		}

		const { trainings } = theme;

		const trainingList = trainings
			.filter((training) => training.isVisible !== false)
			.map((training) => {
				const { _id, title, description } = training;
				return { _id, title, description };
			});

		//console.log(`✅ Found ${trainingList.length} trainings for theme`);
		res.json(trainingList);
	} catch (error) {
		console.error("❌ Error fetching trainings by theme:", error);

		if (error.name === "MongooseError" && error.message.includes("buffering timed out")) {
			return res.status(503).json({
				error: "Connexion à la base de données interrompue. Veuillez réessayer.",
				code: "DB_TIMEOUT",
			});
		}

		if (error.name === "MongoTimeoutError") {
			return res.status(503).json({
				error: "Délai d'attente de la base de données dépassé. Veuillez réessayer.",
				code: "DB_TIMEOUT",
			});
		}

		res.status(500).json({
			error: "Erreur interne. Merci de réessayer plus tard.",
			code: "INTERNAL_ERROR",
		});
	}
});

module.exports = router;
