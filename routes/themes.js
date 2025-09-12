require("../db/connection");

var express = require("express");
var mongoose = require("mongoose");
var router = express.Router();
var db = require("../db/db");

router.get("/list", async function (req, res) {
	try {
		console.log("📋 Fetching themes list...");

		// Vérifier l'état de la connexion MongoDB
		if (mongoose.connection.readyState !== 1) {
			console.error("❌ MongoDB not connected, state:", mongoose.connection.readyState);
			return res.status(503).json({
				error: "Base de données temporairement indisponible. Veuillez réessayer.",
				code: "DB_UNAVAILABLE",
			});
		}

		const themes = await db.themes.find().lean().select("-trainings").maxTimeMS(20000);
		console.log(`✅ Found ${themes.length} themes`);
		res.json(themes);
	} catch (error) {
		console.error("❌ Error fetching themes:", error);

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
}); //

module.exports = router;
