require("../db/connection");

var express = require("express");
var router = express.Router();

const db = require("../db/db");
const nodemailer = require("nodemailer");
const moment = require("moment");
const { NODEMAILER_EMAIL, NODEMAILER_EMAIL_TO, NODEMAILER_PASSWORD } = process.env;

router.post("/new", async function (req, res) {
	const { firstName, lastName, email, message } = req.body;

	["firstName", "lastName", "email", "message"].forEach((field) => {
		if (!req.body[field] || req.body[field].trim() === "") {
			return res.status(400).json({ error: "Veuillez remplir tous les champs." });
		}
	});

	try {
		const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
		const formattedLastName = lastName.toUpperCase();
		const formattedEmail = email.toLowerCase();

		const newMessage = await new db.messages({
			firstName: formattedFirstName,
			lastName: formattedLastName,
			email: formattedEmail,
			message,
		});
		await newMessage.save();

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
								background-color: #FFFCE8; 
								color: #263C27; 
								line-height: 1.6;
								padding: 40px 20px;
							}
							.container {
								max-width: 600px;
								margin: 0 auto;
								background-color: #ffffff;
								border-radius: 12px;
								overflow: hidden;
								box-shadow: 0 4px 20px rgba(38, 60, 39, 0.1);
							}
							.header {
								background: linear-gradient(135deg, #263C27 0%, #6F9271 100%);
								color: #FFFCE8;
								padding: 30px;
								text-align: center;
							}
							.header h1 {
								font-size: 28px;
								font-weight: bold;
								margin-bottom: 8px;
							}
							.header p {
								font-size: 16px;
								opacity: 0.9;
							}
							.content {
								padding: 30px;
							}
							.info-section {
								background-color: #FFFCE8;
								border-left: 4px solid #FF4E00;
								padding: 20px;
								margin: 20px 0;
								border-radius: 0 8px 8px 0;
							}
							.info-section h2 {
								color: #263C27;
								font-size: 20px;
								margin-bottom: 15px;
								font-weight: bold;
							}
							.info-list {
								list-style: none;
								padding: 0;
							}
							.info-list li {
								padding: 8px 0;
								border-bottom: 1px solid rgba(38, 60, 39, 0.1);
								font-size: 16px;
							}
							.info-list li:last-child {
								border-bottom: none;
							}
							.info-list strong {
								color: #263C27;
								font-weight: 600;
							}
							.message-box {
								background-color: #f8f9fa;
								border: 2px solid #6F9271;
								border-radius: 8px;
								padding: 25px;
								margin: 25px 0;
							}
							.message-box h3 {
								color: #263C27;
								font-size: 18px;
								margin-bottom: 15px;
								font-weight: bold;
							}
							.message-content {
								color: #263C27;
								font-size: 16px;
								line-height: 1.7;
								background-color: white;
								padding: 20px;
								border-radius: 6px;
								border-left: 3px solid #FF4E00;
							}
							.footer {
								background-color: #263C27;
								color: #FFFCE8;
								padding: 20px;
								text-align: center;
								font-size: 14px;
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
										<li><strong>Email :</strong> <a href="mailto:${formattedEmail}" style="color: #FF4E00; text-decoration: none;">${formattedEmail}</a></li>
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
								<a href="mailto:helenedm@ipseis.fr" style="color: #FFFCE8;">helenedm@ipseis.fr</a>
							</div>
						</div>
					</body>
				</html>
			`,
		};

		await transporter.sendMail(mailOptions);
		res.json({ message: "Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais." });
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Erreur lors de l'envoi du message. Merci de réessayer plus tard." });
	}
});

router.get("/catalogue", async function (req, res) {
	const { email, firstName, lastName } = req.query;

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
		const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
		const formattedLastName = lastName.toUpperCase();
		const formattedEmail = email.toLowerCase();

		// Enregistrer le prospect (ou mettre à jour s'il existe déjà)
		const existingProspect = await db.prospects.findOne({ email: formattedEmail });

		if (!existingProspect) {
			const newProspect = new db.prospects({
				firstName: formattedFirstName,
				lastName: formattedLastName,
				email: formattedEmail,
			});
			await newProspect.save();
		}

		// Configuration du transporteur email
		const transporter = nodemailer.createTransporter({
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
								background-color: #FFFCE8; 
								color: #263C27; 
								line-height: 1.6;
								padding: 40px 20px;
							}
							.container {
								max-width: 600px;
								margin: 0 auto;
								background-color: #ffffff;
								border-radius: 12px;
								overflow: hidden;
								box-shadow: 0 4px 20px rgba(38, 60, 39, 0.1);
							}
							.header {
								background: linear-gradient(135deg, #263C27 0%, #6F9271 100%);
								color: #FFFCE8;
								padding: 40px 30px;
								text-align: center;
							}
							.header h1 {
								font-size: 32px;
								font-weight: bold;
								margin-bottom: 12px;
							}
							.header p {
								font-size: 18px;
								opacity: 0.9;
							}
							.content {
								padding: 40px 30px;
							}
							.welcome-message {
								background: linear-gradient(135deg, #FFFCE8 0%, #f8f9fa 100%);
								border-left: 4px solid #FF4E00;
								padding: 25px;
								margin-bottom: 30px;
								border-radius: 0 8px 8px 0;
							}
							.welcome-message h2 {
								color: #263C27;
								font-size: 24px;
								margin-bottom: 15px;
								font-weight: bold;
							}
							.content-section {
								background-color: #ffffff;
								padding: 25px;
								margin: 20px 0;
								border-radius: 8px;
								border: 1px solid rgba(111, 146, 113, 0.2);
							}
							.content-section p {
								font-size: 16px;
								line-height: 1.7;
								color: #263C27;
								margin-bottom: 15px;
							}
							.attachment-notice {
								background-color: #e8f5e8;
								border: 2px dashed #6F9271;
								padding: 20px;
								border-radius: 8px;
								text-align: center;
								margin: 25px 0;
							}
							.attachment-notice h3 {
								color: #263C27;
								font-size: 18px;
								margin-bottom: 10px;
								font-weight: bold;
							}
							.attachment-notice p {
								color: #6F9271;
								font-size: 14px;
								margin: 0;
							}
							.cta-section {
								text-align: center;
								margin: 30px 0;
								padding: 25px;
								background: linear-gradient(135deg, #FFFCE8 0%, #f0f8f0 100%);
								border-radius: 8px;
							}
							.cta-button {
								display: inline-block;
								background-color: #FF4E00;
								color: white;
								padding: 15px 30px;
								text-decoration: none;
								border-radius: 8px;
								font-weight: bold;
								font-size: 16px;
								margin: 10px;
								transition: background-color 0.3s;
							}
							.cta-button.secondary {
								background-color: #6F9271;
							}
							.contact-info {
								background-color: #263C27;
								color: #FFFCE8;
								padding: 30px;
								border-radius: 8px;
								margin-top: 30px;
							}
							.contact-info h3 {
								color: #FFFCE8;
								font-size: 20px;
								margin-bottom: 20px;
								font-weight: bold;
								text-align: center;
							}
							.contact-details {
								font-size: 14px;
								line-height: 1.8;
							}
							.contact-details strong {
								color: #FF4E00;
							}
							.footer {
								background-color: #263C27;
								color: #FFFCE8;
								padding: 20px;
								text-align: center;
								font-size: 14px;
							}
							.signature {
								text-align: center;
								margin-top: 25px;
								font-style: italic;
								color: #6F9271;
								font-size: 16px;
							}
						</style>
					</head>
					<body>
						<div class="container">
							<div class="header">
								<h1>📚 Votre catalogue IPSEIS 2025</h1>
								<p>Formations professionnelles dans le secteur de la santé</p>
							</div>
							<div class="content">
								<div class="welcome-message">
									<h2>Bonjour ${formattedFirstName} ${formattedLastName} 👋</h2>
									<p>Nous vous remercions sincèrement de votre intérêt pour nos formations IPSEIS.</p>
								</div>
								
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
									<p style="color: #263C27; font-size: 16px; margin-bottom: 20px;">
										<strong>Besoin d'accompagnement personnalisé ?</strong>
									</p>
									<a href="mailto:helenedm@ipseis.fr" class="cta-button">Nous contacter</a>
									<a href="mailto:helenedm@ipseis.fr?subject=Demande de devis - Formation&body=Bonjour,%0A%0AJe souhaiterais obtenir un devis pour une formation." class="cta-button secondary">Demander un devis</a>
								</div>
								
								<div class="contact-info">
									<h3>📍 Nos coordonnées</h3>
									<div class="contact-details">
										<strong>IPSEIS</strong> — Organisme de formation certifié Qualiopi<br>
										<strong>Représentation :</strong> Hélène PAILLOT DE MONTABERT<br>
										<strong>Adresse :</strong> 21 Rue de la Nation, 35400 Saint-Malo<br>
										<strong>Email :</strong> <a href="mailto:helenedm@ipseis.fr" style="color: #FF4E00; text-decoration: none;">helenedm@ipseis.fr</a>
									</div>
								</div>
								
								<div class="signature">
									Cordialement,<br>
									<strong>L'équipe IPSEIS</strong> 🌟
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
							body { font-family: Arial, sans-serif; margin: 40px; background-color: #f9f9f9; color: #333; } 
							h1 { font-size: 24px; margin-bottom: 20px; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; } 
							h2 { font-size: 20px; margin-top: 30px; margin-bottom: 10px; color: #34495e; } 
							ul { list-style-type: none; padding-left: 0; } 
							li { padding: 8px 0; } 
							.info-box { background-color: #e8f6ff; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0; border-radius: 5px; }
						</style>
					</head>
					<body>
						<h1>Nouveau téléchargement de catalogue</h1>
						<div class="info-box">
							<strong>Un nouveau prospect a téléchargé le catalogue de formations IPSEIS.</strong>
						</div>
						<h2>Informations du prospect</h2>
						<ul>
							<li><strong>Date de téléchargement : </strong>${moment().format("DD/MM/YYYY à HH:mm")}</li>
							<li><strong>Nom : </strong>${formattedLastName}</li>
							<li><strong>Prénom : </strong>${formattedFirstName}</li>
							<li><strong>Email : </strong><a href="mailto:${formattedEmail}">${formattedEmail}</a></li>
						</ul>
						<div class="info-box">
							${
								existingProspect
									? "<strong>Prospect existant :</strong> Cette personne avait déjà téléchargé le catalogue précédemment."
									: "<strong>Nouveau prospect :</strong> Cette personne a été ajoutée à la base de données des prospects."
							}
						</div>
						<p style="margin-top: 30px; font-style: italic; color: #7f8c8d;">
							Vous pouvez maintenant effectuer un suivi personnalisé avec ce prospect.
						</p>
					</body>
				</html>
			`,
		};

		await transporter.sendMail(notificationMailOptions);

		res.json({
			message: "Le catalogue a été envoyé avec succès à votre adresse email. Merci de votre intérêt pour nos formations !",
		});
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Erreur lors de l'envoi du catalogue. Merci de réessayer plus tard." });
	}
});

module.exports = router;
