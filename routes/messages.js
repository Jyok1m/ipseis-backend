var express = require("express");
var router = express.Router();

const db = require("../db/db");
const nodemailer = require("nodemailer");
const moment = require("moment");
const { NODEMAILER_EMAIL, NODEMAILER_EMAIL_TO, NODEMAILER_PASSWORD } = process.env;

router.post("/new", async function (req, res) {
	const { firstName, lastName, email, budget, message } = req.body;

	["firstName", "lastName", "email", "budget", "message"].forEach((field) => {
		if (!req.body[field] || req.body[field].trim() === "") {
			return res.status(400).json({ error: "Veuillez remplir tous les champs." });
		}
	});

	const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
	const formattedLastName = lastName.toUpperCase();
	const formattedEmail = email.toLowerCase();

	try {
		const newMessage = await new db.messages({ firstName, lastName, email, budget, message });
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
											<li><strong>Budget : </strong>${budget}</li>
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

module.exports = router;
