var express = require("express");
var router = express.Router();
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const db = require("../db/db");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { NODEMAILER_EMAIL, NODEMAILER_PASSWORD, FRONTEND_URL } = process.env;

// Toutes les routes admin sont protégées
router.use(authMiddleware);
router.use(roleMiddleware("administrateur"));

// Générer un code d'activation aléatoire de 8 caractères
function generateActivationCode() {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sans I, O, 0, 1 pour éviter confusion
	let code = "";
	const bytes = crypto.randomBytes(8);
	for (let i = 0; i < 8; i++) {
		code += chars[bytes[i] % chars.length];
	}
	return code;
}

// POST /admin/activation-codes
router.post("/activation-codes", async function (req, res) {
	const { targetEmail, role } = req.body;

	if (!targetEmail || !role) {
		return res.status(400).json({ error: "Veuillez fournir l'email et le rôle." });
	}

	if (!["apprenant", "professionnel"].includes(role)) {
		return res.status(400).json({ error: "Le rôle doit être 'apprenant' ou 'professionnel'." });
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(targetEmail)) {
		return res.status(400).json({ error: "Veuillez fournir une adresse email valide." });
	}

	try {
		const code = generateActivationCode();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

		const activationCode = new db.activationCodes({
			code,
			role,
			targetEmail: targetEmail.toLowerCase().trim(),
			expiresAt,
			createdBy: req.user.userId,
		});
		await activationCode.save();

		// Envoyer l'email avec le code d'activation
		const transporter = nodemailer.createTransport({
			service: "Gmail",
			host: "smtp.gmail.com",
			port: 465,
			secure: true,
			auth: { user: NODEMAILER_EMAIL, pass: NODEMAILER_PASSWORD },
		});

		const registerLink = `${FRONTEND_URL}/espace-personnel/inscription`;
		const roleLabel = role === "apprenant" ? "Apprenant" : "Professionnel";

		const mailOptions = {
			from: NODEMAILER_EMAIL,
			to: targetEmail.toLowerCase().trim(),
			subject: "Votre code d'activation - Espace Personnel IPSEIS",
			html: `
				<html lang="fr">
					<head>
						<meta charset="UTF-8" />
						<meta http-equiv="X-UA-Compatible" content="IE=edge" />
						<meta name="viewport" content="width=device-width, initial-scale=1.0" />
						<style>
							* { margin: 0; padding: 0; box-sizing: border-box; }
							body {
								font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
								background-color: #f8f9fa;
								color: #2c3e50;
								line-height: 1.6;
								padding: 20px;
							}
							.container {
								max-width: 600px;
								margin: 0 auto;
								background-color: #ffffff;
								border-radius: 8px;
								overflow: hidden;
								box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
								border: 1px solid #e9ecef;
							}
							.header {
								background-color: #263C27;
								color: #ffffff;
								padding: 30px;
								text-align: center;
							}
							.header h1 {
								font-size: 24px;
								font-weight: bold;
								margin-bottom: 8px;
							}
							.header p {
								font-size: 16px;
								opacity: 0.9;
							}
							.content {
								padding: 30px;
								background-color: #ffffff;
							}
							.content p {
								font-size: 16px;
								line-height: 1.6;
								color: #495057;
								margin-bottom: 15px;
							}
							.code-box {
								background-color: #f8f9fa;
								border: 2px dashed #6F9271;
								padding: 25px;
								text-align: center;
								border-radius: 8px;
								margin: 25px 0;
							}
							.code-box .code {
								font-size: 32px;
								font-weight: bold;
								letter-spacing: 4px;
								color: #263C27;
								font-family: 'Courier New', monospace;
							}
							.code-box .label {
								font-size: 14px;
								color: #6c757d;
								margin-bottom: 10px;
							}
							.role-badge {
								display: inline-block;
								background-color: #6F9271;
								color: white;
								padding: 5px 15px;
								border-radius: 20px;
								font-size: 14px;
								font-weight: bold;
								margin-top: 10px;
							}
							.steps {
								background-color: #f8f9fa;
								border-left: 4px solid #FF4E00;
								padding: 20px;
								margin: 20px 0;
								border-radius: 4px;
							}
							.steps h3 {
								color: #2c3e50;
								font-size: 18px;
								margin-bottom: 15px;
								font-weight: bold;
							}
							.steps ol {
								padding-left: 20px;
							}
							.steps li {
								padding: 6px 0;
								font-size: 15px;
								color: #495057;
							}
							.cta-button {
								display: inline-block;
								background-color: #FF4E00;
								color: white;
								padding: 14px 28px;
								text-decoration: none;
								border-radius: 6px;
								font-weight: bold;
								font-size: 16px;
							}
							.warning {
								background-color: #fff3cd;
								border-left: 4px solid #ffc107;
								padding: 15px;
								margin: 20px 0;
								border-radius: 4px;
								font-size: 14px;
								color: #856404;
							}
							.footer {
								background-color: #f8f9fa;
								color: #495057;
								padding: 20px;
								text-align: center;
								font-size: 14px;
								border-top: 1px solid #e9ecef;
							}
							a { color: #FF4E00; text-decoration: none; }
						</style>
					</head>
					<body>
						<div class="container">
							<div class="header">
								<h1>Bienvenue sur l'Espace Personnel IPSEIS</h1>
								<p>Votre code d'activation est prêt</p>
							</div>
							<div class="content">
								<p>Bonjour,</p>
								<p>Vous avez été invité(e) à rejoindre l'Espace Personnel IPSEIS en tant que <strong>${roleLabel}</strong>.</p>

								<div class="code-box">
									<div class="label">Votre code d'activation</div>
									<div class="code">${code}</div>
									<div class="role-badge">Rôle : ${roleLabel}</div>
								</div>

								<div class="steps">
									<h3>Comment s'inscrire ?</h3>
									<ol>
										<li>Cliquez sur le bouton ci-dessous pour accéder à la page d'inscription</li>
										<li>Remplissez le formulaire avec vos informations personnelles</li>
										<li>Saisissez le code d'activation ci-dessus</li>
										<li>Utilisez l'adresse email <strong>${targetEmail.toLowerCase().trim()}</strong> (celle à laquelle cet email a été envoyé)</li>
									</ol>
								</div>

								<div style="text-align: center; margin: 30px 0;">
									<a href="${registerLink}" class="cta-button">S'inscrire maintenant</a>
								</div>

								<div class="warning">
									<strong>Ce code est valable 7 jours</strong> et ne peut être utilisé qu'une seule fois. Il est associé à cette adresse email uniquement.
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

		res.json({
			message: "Code d'activation créé et envoyé par email.",
			activationCode: {
				_id: activationCode._id,
				code: activationCode.code,
				role: activationCode.role,
				targetEmail: activationCode.targetEmail,
				expiresAt: activationCode.expiresAt,
				isUsed: activationCode.isUsed,
				createdAt: activationCode.createdAt,
			},
		});
	} catch (error) {
		console.error("Erreur lors de la création du code d'activation:", error);
		res.status(500).json({ error: "Erreur lors de la création du code d'activation." });
	}
});

// GET /admin/activation-codes
router.get("/activation-codes", async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;
	const showArchived = req.query.archived === "true";

	try {
		const query = showArchived ? {} : { archived: { $ne: true } };

		const [codes, total] = await Promise.all([
			db.activationCodes.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("usedBy", "firstName lastName email").populate("createdBy", "firstName lastName email"),
			db.activationCodes.countDocuments(query),
		]);

		res.json({
			codes,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		console.error("Erreur lors de la récupération des codes:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// PATCH /admin/activation-codes/:id/cancel
router.patch("/activation-codes/:id/cancel", async function (req, res) {
	const { id } = req.params;

	try {
		const code = await db.activationCodes.findById(id);
		if (!code) {
			return res.status(404).json({ error: "Code introuvable." });
		}

		if (code.isUsed) {
			return res.status(400).json({ error: "Ce code a déjà été utilisé et ne peut pas être annulé." });
		}

		if (code.cancelled) {
			return res.status(400).json({ error: "Ce code est déjà annulé." });
		}

		code.cancelled = true;
		code.cancelledAt = new Date();
		await code.save();

		res.json({ message: "Code annulé.", code });
	} catch (error) {
		console.error("Erreur lors de l'annulation du code:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// PATCH /admin/activation-codes/:id/archive
router.patch("/activation-codes/:id/archive", async function (req, res) {
	const { id } = req.params;

	try {
		const code = await db.activationCodes.findByIdAndUpdate(id, { archived: true }, { new: true });
		if (!code) {
			return res.status(404).json({ error: "Code introuvable." });
		}

		res.json({ message: "Code archivé.", code });
	} catch (error) {
		console.error("Erreur lors de l'archivage du code:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// GET /admin/users
router.get("/users", async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;
	const roleFilter = req.query.role;
	const excludeRole = req.query.excludeRole;
	const search = req.query.search;

	try {
		const query = {};
		if (roleFilter && ["administrateur", "apprenant", "professionnel"].includes(roleFilter)) {
			query.role = roleFilter;
		} else if (excludeRole && ["administrateur", "apprenant", "professionnel"].includes(excludeRole)) {
			query.role = { $ne: excludeRole };
		}
		if (search) {
			const regex = new RegExp(search, "i");
			query.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }, { company: regex }, { position: regex }, { phone: regex }];
		}

		const [users, total] = await Promise.all([
			db.users.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit),
			db.users.countDocuments(query),
		]);

		res.json({
			users,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		console.error("Erreur lors de la récupération des utilisateurs:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// PUT /admin/users/:id - Modifier un utilisateur
router.put("/users/:id", async function (req, res) {
	const { id } = req.params;
	const { firstName, lastName, phone, company, position, address, role, isActive } = req.body;

	try {
		const user = await db.users.findById(id);
		if (!user) {
			return res.status(404).json({ error: "Utilisateur introuvable." });
		}

		if (firstName) user.firstName = firstName.trim();
		if (lastName) user.lastName = lastName.trim();
		if (phone) user.phone = phone.trim();
		if (company) user.company = company.trim();
		if (position) user.position = position.trim();
		if (address) user.address = address.trim();
		if (role && ["administrateur", "apprenant", "professionnel"].includes(role)) {
			user.role = role;
		}
		if (typeof isActive === "boolean") user.isActive = isActive;

		await user.save();

		const { password, ...userData } = user.toObject();
		res.json({ message: "Utilisateur mis à jour.", user: userData });
	} catch (error) {
		console.error("Erreur lors de la mise à jour de l'utilisateur:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// DELETE /admin/users/:id - Supprimer un utilisateur
router.delete("/users/:id", async function (req, res) {
	const { id } = req.params;

	try {
		const user = await db.users.findById(id);
		if (!user) {
			return res.status(404).json({ error: "Utilisateur introuvable." });
		}

		// Empêcher la suppression de son propre compte
		if (user._id.toString() === req.user.id) {
			return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
		}

		await db.users.findByIdAndDelete(id);
		res.json({ message: "Utilisateur supprimé." });
	} catch (error) {
		console.error("Erreur lors de la suppression de l'utilisateur:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ========================
// FORMATIONS MANAGEMENT
// ========================

// GET /admin/themes - Liste des thèmes (pour le select du formulaire)
router.get("/themes", async function (req, res) {
	try {
		const themes = await db.themes.find().select("_id title type").sort({ title: 1 });
		res.json({ themes });
	} catch (error) {
		console.error("Erreur lors de la récupération des thèmes:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// GET /admin/trainings - Liste de toutes les formations avec leur thème
router.get("/trainings", async function (req, res) {
	try {
		const [allTrainings, themes] = await Promise.all([
			db.trainings.find().sort({ title: 1 }),
			db.themes.find().sort({ title: 1 }),
		]);

		// Build a map: trainingId -> theme
		const trainingThemeMap = {};
		for (const theme of themes) {
			for (const trainingId of theme.trainings) {
				trainingThemeMap[trainingId.toString()] = theme;
			}
		}

		const trainings = allTrainings.map((training) => {
			const theme = trainingThemeMap[training._id.toString()];
			return {
				...training.toObject(),
				themeId: theme ? theme._id : null,
				themeName: theme ? theme.title : "Sans thème",
			};
		});

		res.json({ trainings });
	} catch (error) {
		console.error("Erreur lors de la récupération des formations:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// POST /admin/trainings - Créer une formation
router.post("/trainings", async function (req, res) {
	const { themeId, title, pedagogical_objectives, program, pedagogical_methods, audience, prerequisites, evaluation_methods, trainer, number_of_trainees, duration, quote } = req.body;

	if (!themeId || !title || !audience || !prerequisites || !trainer || !number_of_trainees || !duration || !quote) {
		return res.status(400).json({ error: "Veuillez remplir tous les champs obligatoires." });
	}

	try {
		const theme = await db.themes.findById(themeId);
		if (!theme) {
			return res.status(404).json({ error: "Thème introuvable." });
		}

		const training = new db.trainings({
			title: title.trim(),
			pedagogical_objectives: pedagogical_objectives || [],
			program: program || [],
			pedagogical_methods: pedagogical_methods || [],
			audience: audience.trim(),
			prerequisites: prerequisites.trim(),
			evaluation_methods: evaluation_methods || [],
			trainer: trainer.trim(),
			number_of_trainees: number_of_trainees.trim(),
			duration: duration.trim(),
			quote: quote.trim(),
		});
		await training.save();

		theme.trainings.push(training._id);
		await theme.save();

		res.json({
			message: "Formation créée avec succès.",
			training: { ...training.toObject(), themeId: theme._id, themeName: theme.title },
		});
	} catch (error) {
		console.error("Erreur lors de la création de la formation:", error);
		res.status(500).json({ error: "Erreur lors de la création de la formation." });
	}
});

// PUT /admin/trainings/:id - Modifier une formation
router.put("/trainings/:id", async function (req, res) {
	const { id } = req.params;
	const { themeId, title, pedagogical_objectives, program, pedagogical_methods, audience, prerequisites, evaluation_methods, trainer, number_of_trainees, duration, quote } = req.body;

	if (!title || !audience || !prerequisites || !trainer || !number_of_trainees || !duration || !quote) {
		return res.status(400).json({ error: "Veuillez remplir tous les champs obligatoires." });
	}

	try {
		const training = await db.trainings.findById(id);
		if (!training) {
			return res.status(404).json({ error: "Formation introuvable." });
		}

		// Mettre à jour les champs
		training.title = title.trim();
		training.pedagogical_objectives = pedagogical_objectives || [];
		training.program = program || [];
		training.pedagogical_methods = pedagogical_methods || [];
		training.audience = audience.trim();
		training.prerequisites = prerequisites.trim();
		training.evaluation_methods = evaluation_methods || [];
		training.trainer = trainer.trim();
		training.number_of_trainees = number_of_trainees.trim();
		training.duration = duration.trim();
		training.quote = quote.trim();
		await training.save();

		// Si le thème a changé, mettre à jour les références
		if (themeId) {
			const currentTheme = await db.themes.findOne({ trainings: id });
			if (!currentTheme || currentTheme._id.toString() !== themeId) {
				// Retirer de l'ancien thème s'il existe
				if (currentTheme) {
					currentTheme.trainings = currentTheme.trainings.filter((t) => t.toString() !== id);
					await currentTheme.save();
				}

				// Ajouter au nouveau thème
				const newTheme = await db.themes.findById(themeId);
				if (newTheme) {
					newTheme.trainings.push(training._id);
					await newTheme.save();
				}
			}
		}

		const theme = await db.themes.findOne({ trainings: id });

		res.json({
			message: "Formation modifiée avec succès.",
			training: { ...training.toObject(), themeId: theme?._id, themeName: theme?.title },
		});
	} catch (error) {
		console.error("Erreur lors de la modification de la formation:", error);
		res.status(500).json({ error: "Erreur lors de la modification de la formation." });
	}
});

// DELETE /admin/trainings/:id - Supprimer une formation
router.delete("/trainings/:id", async function (req, res) {
	const { id } = req.params;

	try {
		const training = await db.trainings.findById(id);
		if (!training) {
			return res.status(404).json({ error: "Formation introuvable." });
		}

		// Retirer de tous les thèmes
		await db.themes.updateMany({ trainings: id }, { $pull: { trainings: id } });

		// Supprimer la formation
		await db.trainings.findByIdAndDelete(id);

		res.json({ message: "Formation supprimée avec succès." });
	} catch (error) {
		console.error("Erreur lors de la suppression de la formation:", error);
		res.status(500).json({ error: "Erreur lors de la suppression de la formation." });
	}
});

// ========================
// DASHBOARD STATS
// ========================

// GET /admin/dashboard/stats
router.get("/dashboard/stats", async function (req, res) {
	try {
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

		const [
			totalProspects,
			prospectsThisMonth,
			totalUsers,
			totalTrainings,
			totalMessages,
			totalCatalogueDownloads,
			sourceBreakdown,
			totalContracts,
			contractStatusAgg,
			recentContracts,
			recentUsers,
			checklistsInProgress,
		] = await Promise.all([
			db.prospects.countDocuments(),
			db.prospects.countDocuments({ createdAt: { $gte: startOfMonth } }),
			db.users.countDocuments(),
			db.trainings.countDocuments(),
			db.interactions.countDocuments({ type: "contact_message" }),
			db.interactions.countDocuments({ type: "catalogue_download" }),
			db.prospects.aggregate([{ $group: { _id: "$source", count: { $sum: 1 } } }]),
			db.contracts.countDocuments(),
			db.contracts.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
			db.contracts.find().populate("recipientUser", "firstName lastName").sort({ createdAt: -1 }).limit(5).lean(),
			db.users.find().select("firstName lastName role createdAt").sort({ createdAt: -1 }).limit(5).lean(),
			db.checklists.countDocuments({ "items.isChecked": false }),
		]);

		// Build contractsByStatus from aggregation
		const contractsByStatus = { draft: 0, sent: 0, signed: 0, cancelled: 0, rejected: 0 };
		for (const entry of contractStatusAgg) {
			if (entry._id in contractsByStatus) {
				contractsByStatus[entry._id] = entry.count;
			}
		}

		res.json({
			totalProspects,
			prospectsThisMonth,
			totalUsers,
			totalTrainings,
			totalMessages,
			totalCatalogueDownloads,
			sourceBreakdown,
			totalContracts,
			contractsByStatus,
			recentContracts: recentContracts.map((c) => ({
				_id: c._id,
				title: c.title,
				recipientName: c.recipientUser ? `${c.recipientUser.firstName} ${c.recipientUser.lastName}` : "—",
				status: c.status,
				createdAt: c.createdAt,
			})),
			recentUsers: recentUsers.map((u) => ({
				_id: u._id,
				firstName: u.firstName,
				lastName: u.lastName,
				role: u.role,
				createdAt: u.createdAt,
			})),
			checklistsInProgress,
		});
	} catch (error) {
		console.error("Erreur lors de la récupération des stats:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ========================
// PROSPECTS
// ========================

// GET /admin/prospects
router.get("/prospects", async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;
	const source = req.query.source;
	const search = req.query.search;

	try {
		const query = {};
		// Par défaut, masquer les prospects convertis
		query.status = { $ne: "converti" };
		if (source && ["contact", "catalogue", "mixed"].includes(source)) {
			query.source = source;
		}
		if (search) {
			const regex = new RegExp(search, "i");
			query.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
		}

		const [prospects, total, existingEmails] = await Promise.all([
			db.prospects.find(query).sort({ lastInteractionDate: -1 }).skip(skip).limit(limit).lean(),
			db.prospects.countDocuments(query),
			db.users.find({}, "email").lean().then((users) => new Set(users.map((u) => u.email.toLowerCase().trim()))),
		]);

		// Fetch latest interactions for each prospect
		const prospectIds = prospects.map((p) => p._id);
		const latestInteractions = await db.interactions
			.find({ prospectId: { $in: prospectIds } })
			.sort({ createdAt: -1 })
			.lean();

		// Group interactions by prospect
		const interactionsByProspect = {};
		for (const interaction of latestInteractions) {
			const pid = interaction.prospectId.toString();
			if (!interactionsByProspect[pid]) {
				interactionsByProspect[pid] = [];
			}
			interactionsByProspect[pid].push(interaction);
		}

		// Auto-convert prospects that have an existing user account
		const prospectsToConvert = prospects.filter(
			(p) => existingEmails.has(p.email.toLowerCase().trim()) && p.status !== "converti"
		);
		if (prospectsToConvert.length > 0) {
			await db.prospects.updateMany(
				{ _id: { $in: prospectsToConvert.map((p) => p._id) } },
				{ $set: { status: "converti" } }
			);
		}

		const prospectsWithInteractions = prospects.map((p) => {
			const hasAccount = existingEmails.has(p.email.toLowerCase().trim());
			return {
				...p,
				status: hasAccount && p.status !== "converti" ? "converti" : p.status,
				hasAccount,
				interactions: interactionsByProspect[p._id.toString()] || [],
			};
		});

		res.json({
			prospects: prospectsWithInteractions,
			pagination: { page, limit, total, pages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("Erreur lors de la récupération des prospects:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// POST /admin/prospects/:id/contact - Envoyer un email personnalisé
router.post("/prospects/:id/contact", async function (req, res) {
	const { id } = req.params;
	const { subject, message } = req.body;

	if (!subject || !message) {
		return res.status(400).json({ error: "Veuillez fournir le sujet et le message." });
	}

	try {
		const prospect = await db.prospects.findById(id);
		if (!prospect) {
			return res.status(404).json({ error: "Prospect introuvable." });
		}

		const transporter = nodemailer.createTransport({
			service: "Gmail",
			host: "smtp.gmail.com",
			port: 465,
			secure: true,
			auth: { user: NODEMAILER_EMAIL, pass: NODEMAILER_PASSWORD },
		});

		const mailOptions = {
			from: NODEMAILER_EMAIL,
			to: prospect.email,
			subject: subject,
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
							.footer { background-color: #f8f9fa; color: #495057; padding: 20px; text-align: center; font-size: 14px; border-top: 1px solid #e9ecef; }
							a { color: #FF4E00; text-decoration: none; }
						</style>
					</head>
					<body>
						<div class="container">
							<div class="header">
								<h1>IPSEIS</h1>
							</div>
							<div class="content">
								<p>Bonjour ${prospect.firstName},</p>
								<p>${message.replace(/\n/g, "<br>")}</p>
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

		// Créer une interaction admin_outreach
		const interaction = new db.interactions({
			prospectId: prospect._id,
			type: "admin_outreach",
			data: { subject, message },
		});
		await interaction.save();

		// Mettre à jour le prospect
		prospect.status = prospect.status === "nouveau" ? "contacte" : prospect.status;
		prospect.lastInteractionDate = new Date();
		prospect.interactionCount = (prospect.interactionCount || 0) + 1;
		await prospect.save();

		res.json({ message: "Email envoyé avec succès." });
	} catch (error) {
		console.error("Erreur lors de l'envoi de l'email:", error);
		res.status(500).json({ error: "Erreur lors de l'envoi de l'email." });
	}
});

// POST /admin/prospects/:id/convert - Créer un code d'activation pour le prospect
router.post("/prospects/:id/convert", async function (req, res) {
	const { id } = req.params;
	const { role } = req.body;

	if (!role || !["apprenant", "professionnel"].includes(role)) {
		return res.status(400).json({ error: "Le rôle doit être 'apprenant' ou 'professionnel'." });
	}

	try {
		const prospect = await db.prospects.findById(id);
		if (!prospect) {
			return res.status(404).json({ error: "Prospect introuvable." });
		}

		// Block conversion if the prospect already has a user account
		const existingUser = await db.users.findOne({ email: prospect.email.toLowerCase().trim() });
		if (existingUser) {
			return res.status(400).json({ error: "Ce prospect a déjà un compte utilisateur." });
		}

		const code = generateActivationCode();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

		const activationCode = new db.activationCodes({
			code,
			role,
			targetEmail: prospect.email.toLowerCase().trim(),
			expiresAt,
			createdBy: req.user.userId,
		});
		await activationCode.save();

		// Envoyer l'email
		const transporter = nodemailer.createTransport({
			service: "Gmail",
			host: "smtp.gmail.com",
			port: 465,
			secure: true,
			auth: { user: NODEMAILER_EMAIL, pass: NODEMAILER_PASSWORD },
		});

		const registerLink = `${FRONTEND_URL}/espace-personnel/inscription`;
		const roleLabel = role === "apprenant" ? "Apprenant" : "Professionnel";

		const mailOptions = {
			from: NODEMAILER_EMAIL,
			to: prospect.email.toLowerCase().trim(),
			subject: "Votre code d'activation - Espace Personnel IPSEIS",
			html: `
				<html lang="fr">
					<head>
						<meta charset="UTF-8" />
						<meta http-equiv="X-UA-Compatible" content="IE=edge" />
						<meta name="viewport" content="width=device-width, initial-scale=1.0" />
						<style>
							* { margin: 0; padding: 0; box-sizing: border-box; }
							body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; color: #2c3e50; line-height: 1.6; padding: 20px; }
							.container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid #e9ecef; }
							.header { background-color: #263C27; color: #ffffff; padding: 30px; text-align: center; }
							.header h1 { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
							.header p { font-size: 16px; opacity: 0.9; }
							.content { padding: 30px; background-color: #ffffff; }
							.content p { font-size: 16px; line-height: 1.6; color: #495057; margin-bottom: 15px; }
							.code-box { background-color: #f8f9fa; border: 2px dashed #6F9271; padding: 25px; text-align: center; border-radius: 8px; margin: 25px 0; }
							.code-box .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #263C27; font-family: 'Courier New', monospace; }
							.code-box .label { font-size: 14px; color: #6c757d; margin-bottom: 10px; }
							.role-badge { display: inline-block; background-color: #6F9271; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-top: 10px; }
							.steps { background-color: #f8f9fa; border-left: 4px solid #FF4E00; padding: 20px; margin: 20px 0; border-radius: 4px; }
							.steps h3 { color: #2c3e50; font-size: 18px; margin-bottom: 15px; font-weight: bold; }
							.steps ol { padding-left: 20px; }
							.steps li { padding: 6px 0; font-size: 15px; color: #495057; }
							.cta-button { display: inline-block; background-color: #FF4E00; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; }
							.warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; font-size: 14px; color: #856404; }
							.footer { background-color: #f8f9fa; color: #495057; padding: 20px; text-align: center; font-size: 14px; border-top: 1px solid #e9ecef; }
							a { color: #FF4E00; text-decoration: none; }
						</style>
					</head>
					<body>
						<div class="container">
							<div class="header">
								<h1>Bienvenue sur l'Espace Personnel IPSEIS</h1>
								<p>Votre code d'activation est prêt</p>
							</div>
							<div class="content">
								<p>Bonjour ${prospect.firstName},</p>
								<p>Vous avez été invité(e) à rejoindre l'Espace Personnel IPSEIS en tant que <strong>${roleLabel}</strong>.</p>
								<div class="code-box">
									<div class="label">Votre code d'activation</div>
									<div class="code">${code}</div>
									<div class="role-badge">Rôle : ${roleLabel}</div>
								</div>
								<div class="steps">
									<h3>Comment s'inscrire ?</h3>
									<ol>
										<li>Cliquez sur le bouton ci-dessous pour accéder à la page d'inscription</li>
										<li>Remplissez le formulaire avec vos informations personnelles</li>
										<li>Saisissez le code d'activation ci-dessus</li>
										<li>Utilisez l'adresse email <strong>${prospect.email.toLowerCase().trim()}</strong></li>
									</ol>
								</div>
								<div style="text-align: center; margin: 30px 0;">
									<a href="${registerLink}" class="cta-button">S'inscrire maintenant</a>
								</div>
								<div class="warning">
									<strong>Ce code est valable 7 jours</strong> et ne peut être utilisé qu'une seule fois. Il est associé à cette adresse email uniquement.
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

		// Mettre à jour le statut du prospect
		prospect.status = "converti";
		prospect.lastInteractionDate = new Date();
		prospect.interactionCount = (prospect.interactionCount || 0) + 1;
		await prospect.save();

		res.json({
			message: "Code d'activation créé et envoyé.",
			activationCode: {
				_id: activationCode._id,
				code: activationCode.code,
				role: activationCode.role,
				targetEmail: activationCode.targetEmail,
				expiresAt: activationCode.expiresAt,
			},
		});
	} catch (error) {
		console.error("Erreur lors de la conversion du prospect:", error);
		res.status(500).json({ error: "Erreur lors de la conversion du prospect." });
	}
});

// PATCH /admin/prospects/:id/status
router.patch("/prospects/:id/status", async function (req, res) {
	const { id } = req.params;
	const { status } = req.body;

	if (!status || !["nouveau", "contacte", "converti", "archive"].includes(status)) {
		return res.status(400).json({ error: "Statut invalide." });
	}

	try {
		const prospect = await db.prospects.findByIdAndUpdate(id, { status }, { new: true });
		if (!prospect) {
			return res.status(404).json({ error: "Prospect introuvable." });
		}
		res.json({ message: "Statut mis à jour.", prospect });
	} catch (error) {
		console.error("Erreur lors de la mise à jour du statut:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ========================
// TRAINING VISIBILITY
// ========================

// PATCH /admin/trainings/:id/visibility
router.patch("/trainings/:id/visibility", async function (req, res) {
	const { id } = req.params;
	const { isVisible } = req.body;

	if (typeof isVisible !== "boolean") {
		return res.status(400).json({ error: "isVisible doit être un booléen." });
	}

	try {
		const training = await db.trainings.findByIdAndUpdate(id, { isVisible }, { new: true });
		if (!training) {
			return res.status(404).json({ error: "Formation introuvable." });
		}
		res.json({ message: `Formation ${isVisible ? "visible" : "masquée"}.`, training });
	} catch (error) {
		console.error("Erreur lors de la mise à jour de la visibilité:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ========================
// CHECKLISTS
// ========================

// GET /admin/checklists
router.get("/checklists", async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = parseInt(req.query.limit) || 20;
	const skip = (page - 1) * limit;

	try {
		const [checklists, total] = await Promise.all([
			db.checklists
				.find()
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate("linkedUserId", "firstName lastName email")
				.populate("linkedProspectId", "firstName lastName email")
				.populate("createdBy", "firstName lastName"),
			db.checklists.countDocuments(),
		]);

		res.json({
			checklists,
			pagination: { page, limit, total, pages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("Erreur lors de la récupération des checklists:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// POST /admin/checklists
router.post("/checklists", async function (req, res) {
	const { title, description, items, linkedUserId, linkedProspectId } = req.body;

	if (!title) {
		return res.status(400).json({ error: "Le titre est obligatoire." });
	}

	try {
		const checklist = new db.checklists({
			title: title.trim(),
			description: description || "",
			items: items || [],
			linkedUserId: linkedUserId || null,
			linkedProspectId: linkedProspectId || null,
			createdBy: req.user.userId,
		});
		await checklist.save();

		const populated = await db.checklists
			.findById(checklist._id)
			.populate("linkedUserId", "firstName lastName email")
			.populate("linkedProspectId", "firstName lastName email")
			.populate("createdBy", "firstName lastName");

		res.json({ message: "Checklist créée.", checklist: populated });
	} catch (error) {
		console.error("Erreur lors de la création de la checklist:", error);
		res.status(500).json({ error: "Erreur lors de la création de la checklist." });
	}
});

// PUT /admin/checklists/:id
router.put("/checklists/:id", async function (req, res) {
	const { id } = req.params;
	const { title, description, items, linkedUserId, linkedProspectId } = req.body;

	if (!title) {
		return res.status(400).json({ error: "Le titre est obligatoire." });
	}

	try {
		const checklist = await db.checklists.findByIdAndUpdate(
			id,
			{
				title: title.trim(),
				description: description || "",
				items: items || [],
				linkedUserId: linkedUserId || null,
				linkedProspectId: linkedProspectId || null,
			},
			{ new: true }
		)
			.populate("linkedUserId", "firstName lastName email")
			.populate("linkedProspectId", "firstName lastName email")
			.populate("createdBy", "firstName lastName");

		if (!checklist) {
			return res.status(404).json({ error: "Checklist introuvable." });
		}

		res.json({ message: "Checklist mise à jour.", checklist });
	} catch (error) {
		console.error("Erreur lors de la mise à jour de la checklist:", error);
		res.status(500).json({ error: "Erreur lors de la mise à jour de la checklist." });
	}
});

// PATCH /admin/checklists/:id/items/:itemId
router.patch("/checklists/:id/items/:itemId", async function (req, res) {
	const { id, itemId } = req.params;
	const { isChecked, notes } = req.body;

	try {
		const checklist = await db.checklists.findById(id);
		if (!checklist) {
			return res.status(404).json({ error: "Checklist introuvable." });
		}

		const item = checklist.items.id(itemId);
		if (!item) {
			return res.status(404).json({ error: "Item introuvable." });
		}

		if (typeof isChecked === "boolean") item.isChecked = isChecked;
		if (typeof notes === "string") item.notes = notes;

		await checklist.save();

		const populated = await db.checklists
			.findById(id)
			.populate("linkedUserId", "firstName lastName email")
			.populate("linkedProspectId", "firstName lastName email")
			.populate("createdBy", "firstName lastName");

		res.json({ message: "Item mis à jour.", checklist: populated });
	} catch (error) {
		console.error("Erreur lors de la mise à jour de l'item:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// DELETE /admin/checklists/:id
router.delete("/checklists/:id", async function (req, res) {
	const { id } = req.params;

	try {
		const checklist = await db.checklists.findByIdAndDelete(id);
		if (!checklist) {
			return res.status(404).json({ error: "Checklist introuvable." });
		}
		res.json({ message: "Checklist supprimée." });
	} catch (error) {
		console.error("Erreur lors de la suppression de la checklist:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

module.exports = router;
