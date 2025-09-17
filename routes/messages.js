const { connectToMongoDB } = require("../db/connection");

var express = require("express");
var router = express.Router();

const db = require("../db/db");
const nodemailer = require("nodemailer");
const moment = require("moment");
const { NODEMAILER_EMAIL, NODEMAILER_EMAIL_TO, NODEMAILER_PASSWORD } = process.env;

// Fonction pour récupérer la vraie adresse IP du client
const getClientIP = (req) => {
	return (
		req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
		req.headers["x-real-ip"] ||
		req.headers["x-client-ip"] ||
		req.connection?.remoteAddress ||
		req.socket?.remoteAddress ||
		req.ip ||
		"IP non disponible"
	);
};

router.post("/new", async function (req, res) {
	const { firstName, lastName, email, message, interestedFormations = [] } = req.body;

	["firstName", "lastName", "email", "message"].forEach((field) => {
		if (!req.body[field] || req.body[field].trim() === "") {
			return res.status(400).json({ error: "Veuillez remplir tous les champs." });
		}
	});

	try {
		console.log(`📧 Processing new contact message from ${firstName} ${lastName}`);

		// S'assurer que MongoDB est connecté
		await connectToMongoDB();

		const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
		const formattedLastName = lastName.toUpperCase();
		const formattedEmail = email.toLowerCase();

		// Sauvegarder le message
		const newMessage = await new db.messages({
			firstName: formattedFirstName,
			lastName: formattedLastName,
			email: formattedEmail,
			message,
			interestedFormations: interestedFormations || [],
		});
		await newMessage.save();

		// Gérer le prospect
		let prospect = await db.prospects.findOne({ email: formattedEmail });

		if (!prospect) {
			// Nouveau prospect
			prospect = new db.prospects({
				firstName: formattedFirstName,
				lastName: formattedLastName,
				email: formattedEmail,
				source: "contact",
				hasContactMessage: true,
				interactionCount: 1,
				lastInteractionDate: new Date(),
			});
		} else {
			// Prospect existant - mise à jour
			prospect.hasContactMessage = true;
			prospect.interactionCount = (prospect.interactionCount || 0) + 1;
			prospect.lastInteractionDate = new Date();

			// Mettre à jour la source si c'était catalogue seulement
			if (prospect.source === "catalogue") {
				prospect.source = "mixed";
			}
		}
		await prospect.save();

		// Enregistrer l'interaction
		const interaction = new db.interactions({
			prospectId: prospect._id,
			type: "contact_message",
			data: {
				message: message,
				messageId: newMessage._id.toString(),
				firstName: formattedFirstName,
				lastName: formattedLastName,
				interestedFormations: interestedFormations || [],
			},
			userAgent: req.get("User-Agent"),
			ipAddress: getClientIP(req),
		});
		await interaction.save();

		const transporter = nodemailer.createTransport({
			service: "Gmail",
			host: "smtp.gmail.com",
			port: 465,
			secure: true,
			auth: { user: NODEMAILER_EMAIL, pass: NODEMAILER_PASSWORD },
		});

		const sendDate = moment(newMessage.createdAt).format("DD/MM/YYYY à HH:mm");

		const mailOptions = {
			from: NODEMAILER_EMAIL, // source email
			to: NODEMAILER_EMAIL_TO, // destination email
			subject: "Vous avez un reçu nouveau message - Ipseis", // Subject line
			text: message, // plain text body
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
								padding: 25px;
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
							.info-section {
								background-color: #f8f9fa;
								border-left: 4px solid #FF4E00;
								padding: 20px;
								margin: 20px 0;
								border-radius: 4px;
							}
							.info-section h2 {
								color: #2c3e50;
								font-size: 18px;
								margin-bottom: 15px;
								font-weight: bold;
							}
							.info-list {
								list-style: none;
								padding: 0;
							}
							.info-list li {
								padding: 10px 0;
								border-bottom: 1px solid #e9ecef;
								font-size: 16px;
								color: #495057;
							}
							.info-list li:last-child {
								border-bottom: none;
							}
							.info-list strong {
								color: #2c3e50;
								font-weight: 600;
							}
							.message-box {
								background-color: #ffffff;
								border: 2px solid #e9ecef;
								border-radius: 6px;
								padding: 20px;
								margin: 25px 0;
							}
							.message-box h3 {
								color: #2c3e50;
								font-size: 18px;
								margin-bottom: 15px;
								font-weight: bold;
							}
							.message-content {
								color: #495057;
								font-size: 16px;
								line-height: 1.6;
								background-color: #f8f9fa;
								padding: 20px;
								border-radius: 4px;
								border-left: 3px solid #FF4E00;
							}
							.footer {
								background-color: #f8f9fa;
								color: #495057;
								padding: 20px;
								text-align: center;
								font-size: 14px;
								border-top: 1px solid #e9ecef;
							}
							.cta-button {
								display: inline-block;
								background-color: #FF4E00;
								color: white;
								padding: 12px 24px;
								text-decoration: none;
								border-radius: 6px;
								font-weight: bold;
								margin-top: 15px;
							}
							a {
								color: #FF4E00;
								text-decoration: none;
							}
							a:hover {
								text-decoration: underline;
							}
						</style>
					</head>
					<body>
						<div class="container">
							<div class="header">
								<h1>📧 Nouveau message reçu</h1>
								<p>Un prospect vous a contacté via le site web IPSEIS</p>
							</div>
							<div class="content">
								<div class="info-section">
									<h2>👤 Informations du contact</h2>
									<ul class="info-list">
										<li><strong>Date d'envoi :</strong> ${sendDate}</li>
										<li><strong>Nom :</strong> ${formattedLastName}</li>
										<li><strong>Prénom :</strong> ${formattedFirstName}</li>
										<li><strong>Email :</strong> <a href="mailto:${formattedEmail}">${formattedEmail}</a></li>
										${
											interestedFormations && interestedFormations.length > 0
												? `
										<li><strong>Formations d'intérêt :</strong> ${interestedFormations.join(", ")}</li>
										`
												: ""
										}
									</ul>
								</div>
								<div class="message-box">
									<h3>💬 Message envoyé</h3>
									<div class="message-content">${message}</div>
								</div>
								<div style="text-align: center; margin-top: 30px;">
									<a href="mailto:${formattedEmail}" class="cta-button">Répondre directement</a>
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
		console.log(`✅ Contact message processed successfully for ${formattedEmail}`);
		res.json({ message: "Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais." });
	} catch (error) {
		console.error("❌ Error processing contact message:", error);

		if (error.name === "MongooseError" && error.message.includes("buffering timed out")) {
			return res.status(503).json({
				error: "Problème de connexion temporaire. Veuillez réessayer dans quelques instants.",
				code: "DB_TIMEOUT",
			});
		}

		if (error.name === "MongoTimeoutError") {
			return res.status(503).json({
				error: "Délai d'attente dépassé. Veuillez réessayer.",
				code: "DB_TIMEOUT",
			});
		}

		if (error.code === "ECONNECTION" || error.message.includes("SMTP")) {
			return res.status(502).json({
				error: "Problème d'envoi d'email. Votre message a été enregistré, nous vous recontacterons.",
				code: "EMAIL_ERROR",
			});
		}

		res.status(500).json({
			error: "Erreur lors de l'envoi du message. Merci de réessayer plus tard.",
			code: "INTERNAL_ERROR",
		});
	}
});

router.get("/catalogue", async function (req, res) {
	const { email, firstName, lastName, interestedFormations } = req.query;

	// Validation des paramètres requis
	if (!email || !firstName || !lastName) {
		return res.status(400).json({ error: "Veuillez fournir l'email, le prénom et le nom." });
	}

	// Validation basique de l'email
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		return res.status(400).json({ error: "Veuillez fournir une adresse email valide." });
	}

	try {
		console.log(`📚 Processing catalogue request from ${firstName} ${lastName} (${email})`);

		// S'assurer que MongoDB est connecté
		await connectToMongoDB();

		const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
		const formattedLastName = lastName.toUpperCase();
		const formattedEmail = email.toLowerCase();

		// Parser les formations d'intérêt (vient comme query parameter)
		let parsedInterestedFormations = [];
		if (interestedFormations) {
			try {
				parsedInterestedFormations = Array.isArray(interestedFormations) ? interestedFormations : JSON.parse(interestedFormations);
			} catch (e) {
				// Si ce n'est pas du JSON, traiter comme une chaîne simple
				parsedInterestedFormations = [interestedFormations];
			}
		}

		// Gérer le prospect
		let prospect = await db.prospects.findOne({ email: formattedEmail }).maxTimeMS(20000);
		let isExistingProspect = !!prospect;
		let lastDownloadDate = null;

		if (!prospect) {
			// Nouveau prospect
			prospect = new db.prospects({
				firstName: formattedFirstName,
				lastName: formattedLastName,
				email: formattedEmail,
				source: "catalogue",
				hasCatalogueDownload: true,
				interactionCount: 1,
				lastInteractionDate: new Date(),
			});
		} else {
			// Prospect existant - mise à jour
			prospect.hasCatalogueDownload = true;
			prospect.interactionCount = (prospect.interactionCount || 0) + 1;
			prospect.lastInteractionDate = new Date();

			// Mettre à jour la source si c'était contact seulement
			if (prospect.source === "contact") {
				prospect.source = "mixed";
			}

			const lastDownloadInteraction = await db.interactions.findOne({ prospectId: prospect._id, type: "catalogue_download" }).sort({ createdAt: -1 });
			if (lastDownloadInteraction) {
				lastDownloadDate = lastDownloadInteraction.createdAt;
			}
		}
		await prospect.save();

		// Enregistrer l'interaction
		const interaction = new db.interactions({
			prospectId: prospect._id,
			type: "catalogue_download",
			data: {
				catalogueVersion: "2025",
				firstName: formattedFirstName,
				lastName: formattedLastName,
				interestedFormations: parsedInterestedFormations || [],
			},
			userAgent: req.get("User-Agent"),
			ipAddress: getClientIP(req),
		});
		await interaction.save();

		// Configuration du transporteur email
		const transporter = nodemailer.createTransport({
			service: "Gmail",
			host: "smtp.gmail.com",
			port: 465,
			secure: true,
			auth: { user: NODEMAILER_EMAIL, pass: NODEMAILER_PASSWORD },
		});

		// Options de l'email avec le catalogue en pièce jointe
		const mailOptions = {
			from: NODEMAILER_EMAIL,
			to: formattedEmail,
			subject: "Catalogue de formations IPSEIS",
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
								font-size: 28px;
								font-weight: bold;
								margin-bottom: 10px;
							}
							.header p {
								font-size: 16px;
								opacity: 0.9;
							}
							.content {
								padding: 30px;
								background-color: #ffffff;
							}
							.welcome-message {
								background-color: #f8f9fa;
								border-left: 4px solid #FF4E00;
								padding: 20px;
								margin-bottom: 25px;
								border-radius: 4px;
							}
							.welcome-message h2 {
								color: #2c3e50;
								font-size: 20px;
								margin-bottom: 12px;
								font-weight: bold;
							}
							.welcome-message p {
								color: #495057;
								font-size: 16px;
								margin: 0;
							}
							.content-section {
								background-color: #ffffff;
								padding: 20px 0;
								margin: 20px 0;
							}
							.content-section p {
								font-size: 16px;
								line-height: 1.6;
								color: #495057;
								margin-bottom: 15px;
							}
							.attachment-notice {
								background-color: #e8f5e8;
								border: 2px solid #6F9271;
								padding: 20px;
								border-radius: 6px;
								text-align: center;
								margin: 25px 0;
							}
							.attachment-notice h3 {
								color: #2c3e50;
								font-size: 18px;
								margin-bottom: 8px;
								font-weight: bold;
							}
							.attachment-notice p {
								color: #495057;
								font-size: 14px;
								margin: 0;
							}
							.cta-section {
								text-align: center;
								margin: 30px 0;
								padding: 25px;
								background-color: #f8f9fa;
								border-radius: 6px;
								border: 1px solid #e9ecef;
							}
							.cta-section p {
								color: #2c3e50;
								font-size: 16px;
								margin-bottom: 20px;
								font-weight: bold;
							}
							.cta-button {
								display: inline-block;
								background-color: #FF4E00;
								color: white;
								padding: 12px 24px;
								text-decoration: none;
								border-radius: 6px;
								font-weight: bold;
								font-size: 14px;
								margin: 8px;
							}
							.cta-button.secondary {
								background-color: #6F9271;
							}
							.contact-info {
								background-color: #f8f9fa;
								color: #495057;
								padding: 25px;
								border-radius: 6px;
								margin-top: 25px;
								border: 1px solid #e9ecef;
							}
							.contact-info h3 {
								color: #2c3e50;
								font-size: 18px;
								margin-bottom: 15px;
								font-weight: bold;
								text-align: center;
							}
							.contact-details {
								font-size: 14px;
								line-height: 1.8;
							}
							.contact-details strong {
								color: #2c3e50;
							}
							.signature {
								text-align: center;
								margin-top: 25px;
								font-style: italic;
								color: #6c757d;
								font-size: 16px;
							}
							a {
								color: #FF4E00;
								text-decoration: none;
							}
							a:hover {
								text-decoration: underline;
							}
						</style>
					</head>
					<body>
						<div class="container">
							<div class="header">
								<h1>Votre catalogue IPSEIS 2025</h1>
								<p>Formations professionnelles dans le secteur de la santé</p>
							</div>
							<div class="content">
								<div class="welcome-message">
									<h2>Bonjour ${formattedFirstName} ${formattedLastName} 👋</h2>
									<p>Nous vous remercions sincèrement de votre intérêt pour nos formations IPSEIS.</p>
								</div>
								
								${
									parsedInterestedFormations && parsedInterestedFormations.length > 0
										? `
								<div class="info-section">
									<h2>🎯 Vos formations d'intérêt</h2>
									<p>Nous avons noté que vous êtes particulièrement intéressé(e) par les formations suivantes :</p>
									<ul class="info-list" style="margin-top: 15px;">
										${parsedInterestedFormations.map((formation) => `<li>${formation}</li>`).join("")}
									</ul>
									<p style="margin-top: 15px; font-style: italic; color: #6c757d;">
										N'hésitez pas à nous contacter pour plus d'informations sur ces formations spécifiques.
									</p>
								</div>
								`
										: ""
								}
								
								<div class="attachment-notice">
									<h3>📎 Catalogue en pièce jointe</h3>
									<p>Vous trouverez ci-joint notre catalogue complet 2025 avec plus de 30 formations spécialisées</p>
								</div>
								
								<div class="content-section">
									<p>
										Notre catalogue présente l'ensemble de nos programmes de formation dans le secteur de la santé et du médico-social, 
										conçus pour répondre aux enjeux actuels des professionnels.
									</p>
									<p>
										Chaque formation est développée selon notre pédagogie active et immersive, garantissant une montée en compétences 
										durable et opérationnelle.
									</p>
								</div>
								
								<div class="cta-section">
									<p>Besoin d'accompagnement personnalisé ?</p>
									<a href="mailto:helenedm@ipseis.fr" class="cta-button">Nous contacter</a>
									<a href="mailto:helenedm@ipseis.fr?subject=Demande de devis - Formation&body=Bonjour,%0A%0AJe souhaiterais obtenir un devis pour une formation." class="cta-button secondary">Demander un devis</a>
								</div>
								
								<div class="contact-info">
									<h3>📍 Nos coordonnées</h3>
									<div class="contact-details">
										<strong>IPSEIS</strong> — Organisme de formation certifié Qualiopi<br>
										<strong>Représentation :</strong> Hélène PAILLOT DE MONTABERT<br>
										<strong>Adresse :</strong> 21 Rue de la Nation, 35400 Saint-Malo<br>
										<strong>Email :</strong> <a href="mailto:helenedm@ipseis.fr">helenedm@ipseis.fr</a>
									</div>
								</div>
								
								<div class="signature">
									Cordialement,<br>
									<strong>L'équipe IPSEIS</strong>
								</div>
							</div>
						</div>
					</body>
				</html>
			`,
			attachments: [
				{
					filename: "Ipseis_Catalogue_Formation_Sante_2025.pdf",
					path: "./public/Ipseis_Catalogue Formation Santé 2025.pdf",
				},
			],
		};

		// Envoyer l'email au prospect
		await transporter.sendMail(mailOptions);

		// Envoyer un email de notification à l'équipe IPSEIS
		const notificationMailOptions = {
			from: NODEMAILER_EMAIL,
			to: NODEMAILER_EMAIL_TO,
			subject: "Nouveau téléchargement de catalogue - IPSEIS",
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
								padding: 25px;
								text-align: center;
							}
							.header h1 {
								font-size: 24px;
								font-weight: bold;
								margin-bottom: 8px;
							}
							.content {
								padding: 30px;
								background-color: #ffffff;
							}
							.info-box {
								background-color: #f8f9fa;
								border-left: 4px solid #FF4E00;
								padding: 20px;
								margin: 20px 0;
								border-radius: 4px;
							}
							.info-box strong {
								color: #2c3e50;
								font-size: 16px;
							}
							h2 {
								color: #2c3e50;
								font-size: 18px;
								margin: 25px 0 15px 0;
								font-weight: bold;
							}
							ul {
								list-style: none;
								padding: 0;
								background-color: #f8f9fa;
								border-radius: 4px;
								padding: 20px;
							}
							li {
								padding: 8px 0;
								border-bottom: 1px solid #e9ecef;
								font-size: 16px;
								color: #495057;
							}
							li:last-child {
								border-bottom: none;
							}
							li strong {
								color: #2c3e50;
								font-weight: 600;
							}
							.status-box {
								background-color: #e8f5e8;
								border: 1px solid #6F9271;
								padding: 15px;
								margin: 20px 0;
								border-radius: 4px;
							}
							.status-box strong {
								color: #2c3e50;
							}
							.footer-note {
								margin-top: 25px;
								font-style: italic;
								color: #6c757d;
								font-size: 14px;
								text-align: center;
								background-color: #f8f9fa;
								padding: 15px;
								border-radius: 4px;
							}
							a {
								color: #FF4E00;
								text-decoration: none;
							}
							a:hover {
								text-decoration: underline;
							}
						</style>
					</head>
					<body>
						<div class="container">
							<div class="header">
								<h1>📥 Nouveau téléchargement de catalogue</h1>
							</div>
							<div class="content">
								<div class="info-box">
									<strong>Un nouveau prospect a téléchargé le catalogue de formations IPSEIS.</strong>
								</div>
								
								<h2>👤 Informations du prospect</h2>
								<ul>
									<li><strong>Date de téléchargement :</strong> ${moment().format("DD/MM/YYYY à HH:mm")}</li>
									<li><strong>Nom :</strong> ${formattedLastName}</li>
									<li><strong>Prénom :</strong> ${formattedFirstName}</li>
									<li><strong>Email :</strong> <a href="mailto:${formattedEmail}">${formattedEmail}</a></li>
									${
										parsedInterestedFormations && parsedInterestedFormations.length > 0
											? `
									<li><strong>Formations d'intérêt :</strong> ${parsedInterestedFormations.join(", ")}</li>
									`
											: ""
									}
								</ul>
								
								<div class="status-box">
									${
										isExistingProspect
											? `<strong>📋 Prospect existant :</strong> Cette personne avait déjà téléchargé le catalogue précédemment le ${moment(
													lastDownloadDate
											  ).format("DD/MM/YYYY à HH:mm")}.`
											: "<strong>✨ Nouveau prospect :</strong> Cette personne a été ajoutée à la base de données des prospects."
									}
								</div>
								
								<div class="footer-note">
									💡 Vous pouvez maintenant effectuer un suivi personnalisé avec ce prospect.
								</div>
							</div>
						</div>
					</body>
				</html>
			`,
		};

		await transporter.sendMail(notificationMailOptions);

		console.log(`✅ Catalogue sent successfully to ${formattedEmail}`);
		res.json({
			message: "Le catalogue a été envoyé avec succès à votre adresse email. Merci de votre intérêt pour nos formations !",
		});
	} catch (error) {
		console.error("❌ Error processing catalogue request:", error);

		if (error.name === "MongooseError" && error.message.includes("buffering timed out")) {
			return res.status(503).json({
				error: "Problème de connexion temporaire. Veuillez réessayer dans quelques instants.",
				code: "DB_TIMEOUT",
			});
		}

		if (error.name === "MongoTimeoutError") {
			return res.status(503).json({
				error: "Délai d'attente dépassé. Veuillez réessayer.",
				code: "DB_TIMEOUT",
			});
		}

		if (error.code === "ECONNECTION" || error.message.includes("SMTP")) {
			return res.status(502).json({
				error: "Problème d'envoi d'email. Votre demande a été enregistrée, nous vous enverrons le catalogue manuellement.",
				code: "EMAIL_ERROR",
			});
		}

		res.status(500).json({
			error: "Erreur lors de l'envoi du catalogue. Merci de réessayer plus tard.",
			code: "INTERNAL_ERROR",
		});
	}
});

module.exports = router;
