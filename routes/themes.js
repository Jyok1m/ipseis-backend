require("../db/connection");

var express = require("express");
var router = express.Router();
var db = require("../db/db");

router.get("/list", async function (req, res) {
	try {
		const themes = await db.themes.find().lean().select("-trainings");
		res.json(themes);
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Erreur interne. Merci de réessayer plus tard." });
	}
});

module.exports = router;
