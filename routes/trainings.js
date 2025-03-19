var express = require("express");
var router = express.Router();
var db = require("../db/db");

/**
 * Retrieves a training document from the database by its ID.
 *
 * @constant
 * @type {Object}
 * @property {string} trainingId - The unique identifier of the training to retrieve.
 * @returns {Promise<Object|null>} A promise that resolves to the training document if found, or null if not found.
 */

router.get("/:trainingId", async function (req, res, next) {
	const { trainingId } = req.params;

	if (!trainingId) {
		return res.status(400).json({ error: "Identifiant de formation manquant." });
	} else if (trainingId.length !== 24) {
		return res.status(400).json({ error: "Identifiant de formation invalide." });
	}

	try {
		const training = await db.trainings.findById(trainingId);
		res.json(training);
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Erreur interne. Merci de réessayer plus tard." });
	}
});

module.exports = router;
