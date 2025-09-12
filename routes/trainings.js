const { connectToMongoDB, mongoose } = require("../db/connection");

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
		console.log(`📚 Fetching training with ID: ${trainingId}`);

		// S'assurer que MongoDB est connecté
		await connectToMongoDB();

		const training = await db.trainings.findById(trainingId).lean().maxTimeMS(20000);
		const theme = await db.themes.findOne({ trainings: trainingId }).select("_id title").lean().maxTimeMS(20000);

		if (!training) {
			return res.status(404).json({ error: "Formation introuvable." });
		}

		console.log(`✅ Training found: ${training.title}`);
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
		console.log(`🎯 Fetching trainings for theme ID: ${themeId}`);

		// S'assurer que MongoDB est connecté
		await connectToMongoDB();

		const theme = await db.themes.findById(themeId).populate("trainings").select("trainings").lean().maxTimeMS(20000);

		if (!theme) {
			return res.status(404).json({ error: "Theme introuvable." });
		}

		const { trainings } = theme;

		const trainingList = trainings.map((training) => {
			const { _id, title, description } = training;
			return { _id, title, description };
		});

		console.log(`✅ Found ${trainingList.length} trainings for theme`);
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
