var express = require("express");
var router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");

const db = require("../db/db");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { NODEMAILER_EMAIL, NODEMAILER_PASSWORD, FRONTEND_URL } = process.env;

// Multer config
const uploadsDir = path.join(__dirname, "../public/uploads/contracts");
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

// POST /contracts/admin - Create a contract
router.post("/admin", roleMiddleware("administrateur"), upload.single("pdf"), async function (req, res) {
	const { title, description, linkedTraining, recipientUser, startDate, endDate, amount } = req.body;

	if (!title || !recipientUser) {
		return res.status(400).json({ error: "Le titre et le destinataire sont obligatoires." });
	}

	try {
		const recipient = await db.users.findById(recipientUser);
		if (!recipient) {
			return res.status(404).json({ error: "Utilisateur destinataire introuvable." });
		}

		const contract = new db.contracts({
			title: title.trim(),
			description: description || "",
			linkedTraining: linkedTraining || null,
			recipientUser,
			startDate: startDate || null,
			endDate: endDate || null,
			amount: amount ? parseFloat(amount) : 0,
			pdfUrl: req.file ? `/uploads/contracts/${req.file.filename}` : "",
			createdBy: req.user.userId,
		});
		await contract.save();

		const populated = await db.contracts
			.findById(contract._id)
			.populate("recipientUser", "firstName lastName email")
			.populate("linkedTraining", "title")
			.populate("createdBy", "firstName lastName");

		res.json({ message: "Contrat créé avec succès.", contract: populated });
	} catch (error) {
		console.error("Erreur lors de la création du contrat:", error);
		res.status(500).json({ error: "Erreur lors de la création du contrat." });
	}
});

// GET /contracts/admin - List all contracts
router.get("/admin", roleMiddleware("administrateur"), async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;
	const statusFilter = req.query.status;

	try {
		const query = {};
		if (statusFilter && ["draft", "sent", "signed", "cancelled", "rejected"].includes(statusFilter)) {
			query.status = statusFilter;
		}

		const [contracts, total] = await Promise.all([
			db.contracts
				.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate("recipientUser", "firstName lastName email")
				.populate("linkedTraining", "title")
				.populate("createdBy", "firstName lastName"),
			db.contracts.countDocuments(query),
		]);

		res.json({
			contracts,
			pagination: { page, limit, total, pages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("Erreur lors de la récupération des contrats:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// GET /contracts/admin/:id - Contract detail
router.get("/admin/:id", roleMiddleware("administrateur"), async function (req, res) {
	try {
		const contract = await db.contracts
			.findById(req.params.id)
			.populate("recipientUser", "firstName lastName email")
			.populate("linkedTraining", "title")
			.populate("createdBy", "firstName lastName");

		if (!contract) {
			return res.status(404).json({ error: "Contrat introuvable." });
		}

		res.json({ contract });
	} catch (error) {
		console.error("Erreur lors de la récupération du contrat:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// PUT /contracts/admin/:id - Update (draft only)
router.put("/admin/:id", roleMiddleware("administrateur"), upload.single("pdf"), async function (req, res) {
	const { title, description, linkedTraining, recipientUser, startDate, endDate, amount } = req.body;

	try {
		const contract = await db.contracts.findById(req.params.id);
		if (!contract) {
			return res.status(404).json({ error: "Contrat introuvable." });
		}
		if (contract.status !== "draft") {
			return res.status(400).json({ error: "Seuls les contrats en brouillon peuvent être modifiés." });
		}

		if (title) contract.title = title.trim();
		if (description !== undefined) contract.description = description;
		if (linkedTraining !== undefined) contract.linkedTraining = linkedTraining || null;
		if (recipientUser) contract.recipientUser = recipientUser;
		if (startDate !== undefined) contract.startDate = startDate || null;
		if (endDate !== undefined) contract.endDate = endDate || null;
		if (amount !== undefined) contract.amount = parseFloat(amount) || 0;
		if (req.file) contract.pdfUrl = `/uploads/contracts/${req.file.filename}`;

		await contract.save();

		const populated = await db.contracts
			.findById(contract._id)
			.populate("recipientUser", "firstName lastName email")
			.populate("linkedTraining", "title")
			.populate("createdBy", "firstName lastName");

		res.json({ message: "Contrat modifié avec succès.", contract: populated });
	} catch (error) {
		console.error("Erreur lors de la modification du contrat:", error);
		res.status(500).json({ error: "Erreur lors de la modification du contrat." });
	}
});

// PATCH /contracts/admin/:id/send - Send (draft → sent)
router.patch("/admin/:id/send", roleMiddleware("administrateur"), async function (req, res) {
	try {
		const contract = await db.contracts.findById(req.params.id).populate("recipientUser", "firstName lastName email");
		if (!contract) {
			return res.status(404).json({ error: "Contrat introuvable." });
		}
		if (contract.status !== "draft") {
			return res.status(400).json({ error: "Seuls les contrats en brouillon peuvent être envoyés." });
		}

		contract.status = "sent";
		await contract.save();

		// Send notification email
		try {
			const transporter = nodemailer.createTransport({
				service: "Gmail",
				host: "smtp.gmail.com",
				port: 465,
				secure: true,
				auth: { user: NODEMAILER_EMAIL, pass: NODEMAILER_PASSWORD },
			});

			const contractLink = `${FRONTEND_URL}/espace-personnel`;

			const mailOptions = {
				from: NODEMAILER_EMAIL,
				to: contract.recipientUser.email,
				subject: `Nouveau contrat à signer - ${contract.title}`,
				html: `
					<html lang="fr">
						<head>
							<meta charset="UTF-8" />
							<style>
								* { margin: 0; padding: 0; box-sizing: border-box; }
								body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; color: #2c3e50; line-height: 1.6; padding: 20px; }
								.container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid #e9ecef; }
								.header { background-color: #263C27; color: #ffffff; padding: 30px; text-align: center; }
								.header h1 { font-size: 24px; font-weight: bold; }
								.content { padding: 30px; }
								.content p { font-size: 16px; line-height: 1.6; color: #495057; margin-bottom: 15px; }
								.cta-button { display: inline-block; background-color: #FF4E00; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
								.footer { background-color: #f8f9fa; color: #495057; padding: 20px; text-align: center; font-size: 14px; border-top: 1px solid #e9ecef; }
								a { color: #FF4E00; text-decoration: none; }
							</style>
						</head>
						<body>
							<div class="container">
								<div class="header">
									<h1>Nouveau contrat</h1>
								</div>
								<div class="content">
									<p>Bonjour ${contract.recipientUser.firstName},</p>
									<p>Un nouveau contrat <strong>"${contract.title}"</strong> est disponible dans votre Espace Personnel IPSEIS.</p>
									<p>Connectez-vous pour le consulter et le signer :</p>
									<div style="text-align: center; margin: 30px 0;">
										<a href="${contractLink}" class="cta-button">Voir mon contrat</a>
									</div>
								</div>
								<div class="footer">
									<strong>IPSEIS</strong> — Organisme de formation<br>
									21 Rue de la Nation, 35400 Saint-Malo<br>
									<a href="mailto:helenedm@ipseis.fr">helenedm@ipseis.fr</a>
								</div>
							</div>
						</body>
					</html>
				`,
			};

			await transporter.sendMail(mailOptions);
		} catch (emailError) {
			console.error("Erreur lors de l'envoi de l'email de notification:", emailError);
		}

		const populated = await db.contracts
			.findById(contract._id)
			.populate("recipientUser", "firstName lastName email")
			.populate("linkedTraining", "title")
			.populate("createdBy", "firstName lastName");

		res.json({ message: "Contrat envoyé avec succès.", contract: populated });
	} catch (error) {
		console.error("Erreur lors de l'envoi du contrat:", error);
		res.status(500).json({ error: "Erreur lors de l'envoi du contrat." });
	}
});

// PATCH /contracts/admin/:id/cancel - Cancel
router.patch("/admin/:id/cancel", roleMiddleware("administrateur"), async function (req, res) {
	try {
		const contract = await db.contracts.findById(req.params.id);
		if (!contract) {
			return res.status(404).json({ error: "Contrat introuvable." });
		}
		if (contract.status === "cancelled") {
			return res.status(400).json({ error: "Ce contrat est déjà annulé." });
		}

		contract.status = "cancelled";
		contract.cancelledAt = new Date();
		await contract.save();

		const populated = await db.contracts
			.findById(contract._id)
			.populate("recipientUser", "firstName lastName email")
			.populate("linkedTraining", "title")
			.populate("createdBy", "firstName lastName");

		res.json({ message: "Contrat annulé.", contract: populated });
	} catch (error) {
		console.error("Erreur lors de l'annulation du contrat:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// DELETE /contracts/admin/:id - Delete (draft only)
router.delete("/admin/:id", roleMiddleware("administrateur"), async function (req, res) {
	try {
		const contract = await db.contracts.findById(req.params.id);
		if (!contract) {
			return res.status(404).json({ error: "Contrat introuvable." });
		}
		if (contract.status !== "draft") {
			return res.status(400).json({ error: "Seuls les contrats en brouillon peuvent être supprimés." });
		}

		// Delete PDF file if exists
		if (contract.pdfUrl) {
			const filePath = path.join(__dirname, "../public", contract.pdfUrl);
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		}

		await db.contracts.findByIdAndDelete(req.params.id);
		res.json({ message: "Contrat supprimé." });
	} catch (error) {
		console.error("Erreur lors de la suppression du contrat:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ========================
// USER ROUTES
// ========================

// GET /contracts/my - My contracts
router.get("/my", async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;

	try {
		const query = { recipientUser: req.user.userId, status: { $ne: "draft" } };

		const [contracts, total] = await Promise.all([
			db.contracts
				.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate("linkedTraining", "title")
				.populate("createdBy", "firstName lastName"),
			db.contracts.countDocuments(query),
		]);

		res.json({
			contracts,
			pagination: { page, limit, total, pages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("Erreur lors de la récupération des contrats:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// GET /contracts/my/:id - Detail of one of my contracts
router.get("/my/:id", async function (req, res) {
	try {
		const contract = await db.contracts
			.findOne({ _id: req.params.id, recipientUser: req.user.userId, status: { $ne: "draft" } })
			.populate("linkedTraining", "title")
			.populate("createdBy", "firstName lastName");

		if (!contract) {
			return res.status(404).json({ error: "Contrat introuvable." });
		}

		res.json({ contract });
	} catch (error) {
		console.error("Erreur lors de la récupération du contrat:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// PATCH /contracts/my/:id/sign - Sign (sent → signed)
router.patch("/my/:id/sign", async function (req, res) {
	try {
		const contract = await db.contracts.findOne({ _id: req.params.id, recipientUser: req.user.userId });
		if (!contract) {
			return res.status(404).json({ error: "Contrat introuvable." });
		}
		if (contract.status !== "sent") {
			return res.status(400).json({ error: "Ce contrat ne peut pas être signé dans son état actuel." });
		}

		contract.status = "signed";
		contract.signedAt = new Date();
		contract.signedIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
		contract.signedUserAgent = req.headers["user-agent"] || "";
		await contract.save();

		const populated = await db.contracts
			.findById(contract._id)
			.populate("linkedTraining", "title")
			.populate("createdBy", "firstName lastName");

		res.json({ message: "Contrat signé avec succès.", contract: populated });
	} catch (error) {
		console.error("Erreur lors de la signature du contrat:", error);
		res.status(500).json({ error: "Erreur lors de la signature du contrat." });
	}
});

// PATCH /contracts/my/:id/reject - Reject (sent → rejected)
router.patch("/my/:id/reject", async function (req, res) {
	try {
		const contract = await db.contracts.findOne({ _id: req.params.id, recipientUser: req.user.userId });
		if (!contract) {
			return res.status(404).json({ error: "Contrat introuvable." });
		}
		if (contract.status !== "sent") {
			return res.status(400).json({ error: "Ce contrat ne peut pas être rejeté dans son état actuel." });
		}

		contract.status = "rejected";
		contract.rejectedAt = new Date();
		await contract.save();

		const populated = await db.contracts
			.findById(contract._id)
			.populate("linkedTraining", "title")
			.populate("createdBy", "firstName lastName");

		res.json({ message: "Contrat rejeté.", contract: populated });
	} catch (error) {
		console.error("Erreur lors du rejet du contrat:", error);
		res.status(500).json({ error: "Erreur lors du rejet du contrat." });
	}
});

// ========================
// COMMON ROUTES
// ========================

// GET /contracts/download/:id - Download PDF
router.get("/download/:id", async function (req, res) {
	try {
		const contract = await db.contracts.findById(req.params.id);
		if (!contract) {
			return res.status(404).json({ error: "Contrat introuvable." });
		}

		// Check access: admin or recipient
		const isAdmin = req.user.role === "administrateur";
		const isRecipient = contract.recipientUser.toString() === req.user.userId;
		if (!isAdmin && !isRecipient) {
			return res.status(403).json({ error: "Accès non autorisé." });
		}

		if (!contract.pdfUrl) {
			return res.status(404).json({ error: "Aucun PDF associé à ce contrat." });
		}

		const filePath = path.join(__dirname, "../public", contract.pdfUrl);
		if (!fs.existsSync(filePath)) {
			return res.status(404).json({ error: "Fichier PDF introuvable." });
		}

		res.download(filePath, `${contract.title}.pdf`);
	} catch (error) {
		console.error("Erreur lors du téléchargement du contrat:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

module.exports = router;
