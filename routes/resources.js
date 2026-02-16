var express = require("express");
var router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const db = require("../db/db");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// Multer config
const uploadsDir = path.join(__dirname, "../public/uploads/resources");
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadsDir);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		cb(null, uniqueSuffix + path.extname(file.originalname));
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
	fileFilter: function (req, file, cb) {
		if (file.mimetype === "application/pdf") {
			cb(null, true);
		} else {
			cb(new Error("Seuls les fichiers PDF sont acceptés."));
		}
	},
});

// All routes require auth
router.use(authMiddleware);

// ========================
// ADMIN ROUTES
// ========================

// POST /resources/admin - Create a resource
router.post("/admin", roleMiddleware("administrateur"), upload.single("pdf"), async function (req, res) {
	const { title, description, linkedTraining, targetRoles } = req.body;

	if (!title || !linkedTraining) {
		return res.status(400).json({ error: "Le titre et la formation liée sont obligatoires." });
	}
	if (!req.file) {
		return res.status(400).json({ error: "Le fichier PDF est obligatoire." });
	}

	try {
		const training = await db.trainings.findById(linkedTraining);
		if (!training) {
			return res.status(404).json({ error: "Formation introuvable." });
		}

		let parsedRoles = targetRoles;
		if (typeof targetRoles === "string") {
			try {
				parsedRoles = JSON.parse(targetRoles);
			} catch {
				parsedRoles = [targetRoles];
			}
		}

		const resource = new db.resources({
			title: title.trim(),
			description: description || "",
			pdfUrl: `/uploads/resources/${req.file.filename}`,
			originalFileName: req.file.originalname,
			linkedTraining,
			targetRoles: parsedRoles || [],
			createdBy: req.user.userId,
		});
		await resource.save();

		const populated = await db.resources
			.findById(resource._id)
			.populate("linkedTraining", "title")
			.populate("createdBy", "firstName lastName");

		res.json({ message: "Ressource créée avec succès.", resource: populated });
	} catch (error) {
		console.error("Erreur lors de la création de la ressource:", error);
		res.status(500).json({ error: "Erreur lors de la création de la ressource." });
	}
});

// GET /resources/admin - List all resources
router.get("/admin", roleMiddleware("administrateur"), async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;
	const trainingFilter = req.query.trainingId;

	try {
		const query = {};
		if (trainingFilter) {
			query.linkedTraining = trainingFilter;
		}

		const [resources, total] = await Promise.all([
			db.resources
				.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate("linkedTraining", "title")
				.populate("createdBy", "firstName lastName"),
			db.resources.countDocuments(query),
		]);

		res.json({
			resources,
			pagination: { page, limit, total, pages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("Erreur lors de la récupération des ressources:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// PUT /resources/admin/:id - Update a resource
router.put("/admin/:id", roleMiddleware("administrateur"), upload.single("pdf"), async function (req, res) {
	const { title, description, linkedTraining, targetRoles } = req.body;

	try {
		const resource = await db.resources.findById(req.params.id);
		if (!resource) {
			return res.status(404).json({ error: "Ressource introuvable." });
		}

		if (title) resource.title = title.trim();
		if (description !== undefined) resource.description = description;
		if (linkedTraining) {
			const training = await db.trainings.findById(linkedTraining);
			if (!training) {
				return res.status(404).json({ error: "Formation introuvable." });
			}
			resource.linkedTraining = linkedTraining;
		}
		if (targetRoles !== undefined) {
			let parsedRoles = targetRoles;
			if (typeof targetRoles === "string") {
				try {
					parsedRoles = JSON.parse(targetRoles);
				} catch {
					parsedRoles = [targetRoles];
				}
			}
			resource.targetRoles = parsedRoles || [];
		}
		if (req.file) {
			// Delete old PDF
			if (resource.pdfUrl) {
				const oldPath = path.join(__dirname, "../public", resource.pdfUrl);
				if (fs.existsSync(oldPath)) {
					fs.unlinkSync(oldPath);
				}
			}
			resource.pdfUrl = `/uploads/resources/${req.file.filename}`;
			resource.originalFileName = req.file.originalname;
		}

		await resource.save();

		const populated = await db.resources
			.findById(resource._id)
			.populate("linkedTraining", "title")
			.populate("createdBy", "firstName lastName");

		res.json({ message: "Ressource modifiée avec succès.", resource: populated });
	} catch (error) {
		console.error("Erreur lors de la modification de la ressource:", error);
		res.status(500).json({ error: "Erreur lors de la modification de la ressource." });
	}
});

// DELETE /resources/admin/:id - Delete a resource
router.delete("/admin/:id", roleMiddleware("administrateur"), async function (req, res) {
	try {
		const resource = await db.resources.findById(req.params.id);
		if (!resource) {
			return res.status(404).json({ error: "Ressource introuvable." });
		}

		// Delete PDF file
		if (resource.pdfUrl) {
			const filePath = path.join(__dirname, "../public", resource.pdfUrl);
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		}

		await db.resources.findByIdAndDelete(req.params.id);
		res.json({ message: "Ressource supprimée." });
	} catch (error) {
		console.error("Erreur lors de la suppression de la ressource:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ========================
// USER ROUTES
// ========================

// GET /resources/my - My resources (based on signed contracts)
router.get("/my", async function (req, res) {
	try {
		// Find all signed contracts for this user
		const signedContracts = await db.contracts.find({
			recipientUser: req.user.userId,
			status: "signed",
			linkedTraining: { $ne: null },
		});

		const trainingIds = [...new Set(signedContracts.map((c) => c.linkedTraining.toString()))];

		if (trainingIds.length === 0) {
			return res.json({ resources: [] });
		}

		// Find resources for those trainings, matching user's role
		const userRole = req.user.role;
		const resources = await db.resources
			.find({
				linkedTraining: { $in: trainingIds },
				targetRoles: userRole,
			})
			.sort({ createdAt: -1 })
			.populate("linkedTraining", "title");

		res.json({ resources });
	} catch (error) {
		console.error("Erreur lors de la récupération des ressources:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// GET /resources/download/:id - Download PDF
router.get("/download/:id", async function (req, res) {
	try {
		const resource = await db.resources.findById(req.params.id);
		if (!resource) {
			return res.status(404).json({ error: "Ressource introuvable." });
		}

		// Admin can always download
		const isAdmin = req.user.role === "administrateur";
		if (!isAdmin) {
			// Check user has a signed contract on the linked training
			const hasAccess = await db.contracts.findOne({
				recipientUser: req.user.userId,
				status: "signed",
				linkedTraining: resource.linkedTraining,
			});
			if (!hasAccess) {
				return res.status(403).json({ error: "Accès non autorisé." });
			}
			// Check role is in targetRoles
			if (!resource.targetRoles.includes(req.user.role)) {
				return res.status(403).json({ error: "Accès non autorisé." });
			}
		}

		if (!resource.pdfUrl) {
			return res.status(404).json({ error: "Aucun PDF associé à cette ressource." });
		}

		const filePath = path.join(__dirname, "../public", resource.pdfUrl);
		if (!fs.existsSync(filePath)) {
			return res.status(404).json({ error: "Fichier PDF introuvable." });
		}

		const downloadName = resource.originalFileName || `${resource.title}.pdf`;
		res.download(filePath, downloadName);
	} catch (error) {
		console.error("Erreur lors du téléchargement de la ressource:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

module.exports = router;
