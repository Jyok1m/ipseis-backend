var express = require("express");
var router = express.Router();
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const db = require("../db/db");
const authMiddleware = require("../middleware/authMiddleware");

const { NODEMAILER_EMAIL, NODEMAILER_PASSWORD, JWT_SECRET, FRONTEND_URL } = process.env;

// POST /auth/register
router.post("/register", async function (req, res) {
	const { firstName, lastName, email, password, confirmPassword, phone, company, position, address, activationCode } = req.body;

	// Validation des champs requis
	const requiredFields = { firstName, lastName, email, password, confirmPassword, phone, company, position, address, activationCode };
	for (const [field, value] of Object.entries(requiredFields)) {
		if (!value || (typeof value === "string" && value.trim() === "")) {
			return res.status(400).json({ error: "Veuillez remplir tous les champs." });
		}
	}

	if (password !== confirmPassword) {
		return res.status(400).json({ error: "Les mots de passe ne correspondent pas." });
	}

	if (password.length < 8) {
		return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
	}

	try {
		const formattedEmail = email.toLowerCase().trim();

		// Vérifier le code d'activation
		const code = await db.activationCodes.findOne({ code: activationCode });

		if (!code) {
			return res.status(400).json({ error: "Code d'activation invalide." });
		}

		if (code.isUsed) {
			return res.status(400).json({ error: "Ce code d'activation a déjà été utilisé." });
		}

		if (new Date() > code.expiresAt) {
			return res.status(400).json({ error: "Ce code d'activation a expiré." });
		}

		if (code.targetEmail.toLowerCase() !== formattedEmail) {
			return res.status(400).json({ error: "Ce code d'activation n'est pas associé à cette adresse email." });
		}

		// Vérifier que l'email n'est pas déjà utilisé
		const existingUser = await db.users.findOne({ email: formattedEmail });
		if (existingUser) {
			return res.status(400).json({ error: "Un compte existe déjà avec cette adresse email." });
		}

		// Hash du mot de passe
		const hashedPassword = await bcrypt.hash(password, 10);

		// Formater les champs : Prénom → Title Case, Nom → MAJUSCULES
		const formatFirstName = (name) =>
			name.trim().replace(/[a-zA-ZÀ-ÿ]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
		const formatLastName = (name) => name.trim().toUpperCase();

		// Créer l'utilisateur
		const user = new db.users({
			firstName: formatFirstName(firstName),
			lastName: formatLastName(lastName),
			email: formattedEmail,
			password: hashedPassword,
			phone: phone.trim(),
			company: company.trim(),
			position: position.trim(),
			address: address.trim(),
			role: code.role,
			activationCodeUsed: activationCode,
		});
		await user.save();

		// Marquer le code comme utilisé
		code.isUsed = true;
		code.usedBy = user._id;
		code.usedAt = new Date();
		await code.save();

		res.json({ message: "Inscription réussie. Vous pouvez maintenant vous connecter." });
	} catch (error) {
		console.error("Erreur lors de l'inscription:", error);
		res.status(500).json({ error: "Erreur lors de l'inscription. Veuillez réessayer." });
	}
});

// POST /auth/login
router.post("/login", async function (req, res) {
	const { email, password } = req.body;

	if (!email || !password) {
		return res.status(400).json({ error: "Veuillez remplir tous les champs." });
	}

	try {
		const formattedEmail = email.toLowerCase().trim();
		const user = await db.users.findOne({ email: formattedEmail });

		if (!user) {
			return res.status(401).json({ error: "Email ou mot de passe incorrect." });
		}

		if (!user.isActive) {
			return res.status(401).json({ error: "Votre compte a été désactivé." });
		}

		const isPasswordValid = await bcrypt.compare(password, user.password);
		if (!isPasswordValid) {
			return res.status(401).json({ error: "Email ou mot de passe incorrect." });
		}

		const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

		res.cookie("token", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
		});

		res.json({
			message: "Connexion réussie.",
			token,
			user: {
				_id: user._id,
				firstName: user.firstName,
				lastName: user.lastName,
				email: user.email,
				role: user.role,
				phone: user.phone,
				company: user.company,
				position: user.position,
				address: user.address,
				isActive: user.isActive,
			},
		});
	} catch (error) {
		console.error("Erreur lors de la connexion:", error);
		res.status(500).json({ error: "Erreur lors de la connexion. Veuillez réessayer." });
	}
});

// POST /auth/logout
router.post("/logout", function (req, res) {
	res.clearCookie("token", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
	});
	res.json({ message: "Déconnexion réussie." });
});

// GET /auth/me
router.get("/me", authMiddleware, async function (req, res) {
	try {
		const user = await db.users.findById(req.user.userId).select("-password");
		if (!user) {
			return res.status(404).json({ error: "Utilisateur non trouvé." });
		}
		res.json({ user });
	} catch (error) {
		console.error("Erreur lors de la récupération du profil:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// PUT /auth/profile - Modifier son propre profil
router.put("/profile", authMiddleware, async function (req, res) {
	const { firstName, lastName, phone, company, position, address } = req.body;

	try {
		const user = await db.users.findById(req.user.userId);
		if (!user) {
			return res.status(404).json({ error: "Utilisateur non trouvé." });
		}

		if (firstName) user.firstName = firstName.trim();
		if (lastName) user.lastName = lastName.trim();
		if (phone) user.phone = phone.trim();
		if (company) user.company = company.trim();
		if (position) user.position = position.trim();
		if (address) user.address = address.trim();

		await user.save();

		res.json({
			message: "Profil mis à jour.",
			user: {
				_id: user._id,
				firstName: user.firstName,
				lastName: user.lastName,
				email: user.email,
				role: user.role,
				phone: user.phone,
				company: user.company,
				position: user.position,
				address: user.address,
				isActive: user.isActive,
			},
		});
	} catch (error) {
		console.error("Erreur lors de la mise à jour du profil:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// PUT /auth/change-password - Changer son mot de passe
router.put("/change-password", authMiddleware, async function (req, res) {
	const { currentPassword, newPassword, confirmNewPassword } = req.body;

	if (!currentPassword || !newPassword || !confirmNewPassword) {
		return res.status(400).json({ error: "Veuillez remplir tous les champs." });
	}

	if (newPassword !== confirmNewPassword) {
		return res.status(400).json({ error: "Les nouveaux mots de passe ne correspondent pas." });
	}

	if (newPassword.length < 8) {
		return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
	}

	try {
		const user = await db.users.findById(req.user.userId);
		if (!user) {
			return res.status(404).json({ error: "Utilisateur non trouvé." });
		}

		const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
		if (!isPasswordValid) {
			return res.status(400).json({ error: "Le mot de passe actuel est incorrect." });
		}

		user.password = await bcrypt.hash(newPassword, 10);
		await user.save();

		res.json({ message: "Mot de passe modifié avec succès." });
	} catch (error) {
		console.error("Erreur lors du changement de mot de passe:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// POST /auth/forgot-password
router.post("/forgot-password", async function (req, res) {
	const { email } = req.body;

	if (!email) {
		return res.status(400).json({ error: "Veuillez fournir votre adresse email." });
	}

	try {
		const formattedEmail = email.toLowerCase().trim();
		const user = await db.users.findOne({ email: formattedEmail });

		// Réponse identique que l'utilisateur existe ou non (anti-enumération)
		const successMessage = "Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation.";

		if (!user) {
			return res.json({ message: successMessage });
		}

		// Supprimer les anciens tokens pour cet utilisateur
		await db.passwordResetTokens.deleteMany({ userId: user._id });

		// Générer un token
		const token = crypto.randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

		await new db.passwordResetTokens({
			userId: user._id,
			token,
			expiresAt,
		}).save();

		// Envoyer l'email
		const resetLink = `${FRONTEND_URL}/espace-personnel/reinitialiser-mot-de-passe/${token}`;

		const transporter = nodemailer.createTransport({
			service: "Gmail",
			host: "smtp.gmail.com",
			port: 465,
			secure: true,
			auth: { user: NODEMAILER_EMAIL, pass: NODEMAILER_PASSWORD },
		});

		const mailOptions = {
			from: NODEMAILER_EMAIL,
			to: formattedEmail,
			subject: "Réinitialisation de votre mot de passe - IPSEIS",
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
								background-color: #f8f9fa;
								border-left: 4px solid #FF4E00;
								padding: 15px;
								margin: 20px 0;
								border-radius: 4px;
								font-size: 14px;
								color: #6c757d;
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
								<h1>Réinitialisation du mot de passe</h1>
								<p>Espace Personnel IPSEIS</p>
							</div>
							<div class="content">
								<p>Bonjour <strong>${user.firstName}</strong>,</p>
								<p>Vous avez demandé la réinitialisation de votre mot de passe pour votre Espace Personnel IPSEIS.</p>
								<p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
								<div style="text-align: center; margin: 30px 0;">
									<a href="${resetLink}" class="cta-button">Réinitialiser mon mot de passe</a>
								</div>
								<div class="warning">
									<strong>Ce lien est valable 1 heure.</strong> Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe restera inchangé.
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
		res.json({ message: successMessage });
	} catch (error) {
		console.error("Erreur lors de la demande de réinitialisation:", error);
		res.status(500).json({ error: "Erreur serveur. Veuillez réessayer." });
	}
});

// POST /auth/reset-password
router.post("/reset-password", async function (req, res) {
	const { token, password, confirmPassword } = req.body;

	if (!token || !password || !confirmPassword) {
		return res.status(400).json({ error: "Veuillez remplir tous les champs." });
	}

	if (password !== confirmPassword) {
		return res.status(400).json({ error: "Les mots de passe ne correspondent pas." });
	}

	if (password.length < 8) {
		return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
	}

	try {
		const resetToken = await db.passwordResetTokens.findOne({ token });

		if (!resetToken) {
			return res.status(400).json({ error: "Lien de réinitialisation invalide ou expiré." });
		}

		if (new Date() > resetToken.expiresAt) {
			await db.passwordResetTokens.deleteOne({ _id: resetToken._id });
			return res.status(400).json({ error: "Lien de réinitialisation expiré. Veuillez refaire une demande." });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		await db.users.findByIdAndUpdate(resetToken.userId, { password: hashedPassword });
		await db.passwordResetTokens.deleteOne({ _id: resetToken._id });

		res.json({ message: "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter." });
	} catch (error) {
		console.error("Erreur lors de la réinitialisation:", error);
		res.status(500).json({ error: "Erreur serveur. Veuillez réessayer." });
	}
});

module.exports = router;
