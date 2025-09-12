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
												body { font-family: Arial, sans-serif; margin: 40px; background-color: #f9f9f9; color: #333; } h1 { font-size: 24px; margin-bottom: 20px; color:
												#2c3e50; border-bottom: 2px solid black; } h2 { font-size: 20px; margin-top: 30px; margin-bottom: 10px; color: #34495e; } ul { list-style-type:
												none; padding-left: 0; } li { padding: 8px 0; } p { background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 100px; }
										</style>
								</head>
								<body>
									<h1>Nouveau message de la part de ${formattedFirstName} ${formattedLastName}</h1>
									<h2>Informations</h2>
									<ul>
                      <li><strong>Date d'envoi : </strong>${sendDate}</li>
											<li><strong>Nom : </strong>${formattedLastName}</li>
											<li><strong>Prénom : </strong>${formattedFirstName}</li>
											<li><strong>Email : </strong>${formattedEmail}</li>
									</ul>
									<h2>Message</h2>
									<p>${message}</p>
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
							body { 
								font-family: Arial, sans-serif; 
								margin: 40px; 
								background-color: #f9f9f9; 
								color: #333; 
								line-height: 1.6;
							} 
							h1 { 
								font-size: 24px; 
								margin-bottom: 20px; 
								color: #2c3e50; 
								border-bottom: 2px solid #3498db; 
								padding-bottom: 10px;
							} 
							p { 
								background-color: #fff; 
								padding: 20px; 
								border: 1px solid #ddd; 
								border-radius: 5px; 
								margin-bottom: 20px; 
							}
							.signature {
								margin-top: 30px;
								font-style: italic;
								color: #7f8c8d;
							}
						</style>
					</head>
					<body>
						<h1>Bonjour ${formattedFirstName} ${formattedLastName},</h1>
						<p>
							Nous vous remercions de votre intérêt pour nos formations IPSEIS.
						</p>
						<p>
							Vous trouverez en pièce jointe notre catalogue de formations 2025 qui présente l'ensemble de nos programmes de formation dans le secteur de la santé.
						</p>
						<p>
							N'hésitez pas à nous contacter si vous avez des questions ou si vous souhaitez obtenir plus d'informations sur nos formations.
						</p>
						<div class="signature">
							<p>
								<strong>Coordonnées de contact :</strong><br>
								<strong>IPSEIS</strong> — Organisme de formation<br>
								Représentation : Hélène PAILLOT DE MONTABERT<br>
								Siège social : 21 Rue de la Nation, 35400 Saint-Malo<br>
								Email : <a href="mailto:helenedm@ipseis.fr" style="color: #3498db;">helenedm@ipseis.fr</a><br>
								<br>
								Cordialement,<br>
								L'équipe IPSEIS
							</p>
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

		// Envoyer l'email
		await transporter.sendMail(mailOptions);

		res.json({
			message: "Le catalogue a été envoyé avec succès à votre adresse email. Merci de votre intérêt pour nos formations !",
		});
	} catch (error) {
		console.log(error);
		res.status(500).json({ error: "Erreur lors de l'envoi du catalogue. Merci de réessayer plus tard." });
	}
});

module.exports = router;
