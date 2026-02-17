const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const authMiddleware = require("../middleware/authMiddleware");
const db = require("../db/db");

const { NODEMAILER_EMAIL, NODEMAILER_PASSWORD, FRONTEND_URL } = process.env;

router.use(authMiddleware);

// ─── Helper: get unread count for a user ───

async function getUnreadCountForUser(userId) {
	return db.internalMessages.countDocuments({ recipientUser: userId, isRead: false });
}

// ─── Helper: emit unread count via socket ───

function emitUnreadCount(req, userId, count) {
	const io = req.app.get("io");
	if (io) {
		io.to("user:" + userId).emit("unread-count", { count });
	}
}

// ─── Helper: send email notification (fire-and-forget) ───

function sendNewMessageEmailNotification(recipient, senderName, subject) {
	if (!NODEMAILER_EMAIL || !NODEMAILER_PASSWORD) return;

	const transporter = nodemailer.createTransport({
		service: "Gmail",
		host: "smtp.gmail.com",
		port: 465,
		secure: true,
		auth: { user: NODEMAILER_EMAIL, pass: NODEMAILER_PASSWORD },
	});

	const loginUrl = (FRONTEND_URL || "http://localhost:4001") + "/espace-personnel/connexion";

	const mailOptions = {
		from: NODEMAILER_EMAIL,
		to: recipient.email,
		subject: "Nouveau message sur votre Espace IPSEIS",
		html: `
			<html lang="fr">
				<head>
					<meta charset="UTF-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1.0" />
					<style>
						* { margin: 0; padding: 0; box-sizing: border-box; }
						body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; color: #2c3e50; line-height: 1.6; padding: 20px; }
						.container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid #e9ecef; }
						.header { background-color: #263C27; padding: 30px; text-align: center; }
						.header h1 { color: #FFFCE8; font-size: 24px; font-weight: 700; }
						.body-section { padding: 30px; }
						.body-section p { margin-bottom: 16px; font-size: 15px; color: #374151; }
						.cta-btn { display: inline-block; background-color: #FF4E00; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; margin: 10px 0; }
						.footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e9ecef; }
						.footer p { font-size: 12px; color: #9ca3af; }
					</style>
				</head>
				<body>
					<div class="container">
						<div class="header">
							<h1>IPSEIS</h1>
						</div>
						<div class="body-section">
							<p>Bonjour ${recipient.firstName},</p>
							<p>Vous avez reçu un nouveau message de <strong>${senderName}</strong> :</p>
							<p style="background-color:#f3f4f6;padding:12px 16px;border-radius:8px;border-left:3px solid #6F9271;font-style:italic;">
								${subject}
							</p>
							<p>Connectez-vous à votre Espace Personnel pour le consulter et y répondre.</p>
							<div style="text-align:center;margin:24px 0;">
								<a href="${loginUrl}" class="cta-btn">Voir mes messages</a>
							</div>
						</div>
						<div class="footer">
							<p>&copy; ${new Date().getFullYear()} IPSEIS. Tous droits réservés.</p>
						</div>
					</div>
				</body>
			</html>
		`,
	};

	transporter.sendMail(mailOptions).catch((err) => {
		console.error("Erreur envoi email notification message:", err.message);
	});
}

// ─── POST /internal-messages/conversation/:conversationId/archive ───

router.post("/conversation/:conversationId/archive", async function (req, res) {
	try {
		await db.archivedConversations.updateOne(
			{ userId: req.user.userId, conversationId: req.params.conversationId },
			{ userId: req.user.userId, conversationId: req.params.conversationId },
			{ upsert: true }
		);
		res.json({ message: "Conversation archivée." });
	} catch (error) {
		console.error("Erreur archive:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ─── DELETE /internal-messages/conversation/:conversationId/archive ───

router.delete("/conversation/:conversationId/archive", async function (req, res) {
	try {
		await db.archivedConversations.deleteOne({
			userId: req.user.userId,
			conversationId: req.params.conversationId,
		});
		res.json({ message: "Conversation désarchivée." });
	} catch (error) {
		console.error("Erreur désarchivage:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ─── GET /internal-messages/conversations — all conversations (sent + received) ───

router.get("/conversations", async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = 20;
	const skip = (page - 1) * limit;
	const userId = new mongoose.Types.ObjectId(req.user.userId);

	try {
		// Fetch archived conversation IDs for this user
		const archivedDocs = await db.archivedConversations.find({ userId: req.user.userId }).lean();
		const archivedIds = archivedDocs.map((d) => d.conversationId);

		const pipeline = [
			{
				$match: {
					conversationId: { $ne: null, $nin: archivedIds },
					$or: [{ senderUser: userId }, { recipientUser: userId }],
				},
			},
			{ $sort: { createdAt: -1 } },
			{
				$group: {
					_id: "$conversationId",
					lastMessage: { $first: "$$ROOT" },
					threadCount: { $sum: 1 },
					unreadInThread: {
						$sum: {
							$cond: [
								{ $and: [{ $eq: ["$recipientUser", userId] }, { $eq: ["$isRead", false] }] },
								1,
								0,
							],
						},
					},
				},
			},
			{ $sort: { "lastMessage.createdAt": -1 } },
			{
				$facet: {
					data: [{ $skip: skip }, { $limit: limit }],
					totalCount: [{ $count: "count" }],
				},
			},
		];

		const [result] = await db.internalMessages.aggregate(pipeline);
		const conversations = result.data || [];
		const total = result.totalCount[0]?.count || 0;

		const messageIds = conversations.map((c) => c.lastMessage._id);
		const populated = await db.internalMessages
			.find({ _id: { $in: messageIds } })
			.populate("senderUser", "firstName lastName email role")
			.populate("recipientUser", "firstName lastName email role")
			.lean();

		const populatedMap = {};
		for (const m of populated) {
			populatedMap[m._id.toString()] = m;
		}

		const messages = conversations.map((c) => ({
			...populatedMap[c.lastMessage._id.toString()],
			conversationId: c._id,
			threadCount: c.threadCount,
			unreadInThread: c.unreadInThread,
		}));

		res.json({
			messages,
			pagination: { page, limit, total, pages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("Erreur conversations:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ─── GET /internal-messages/inbox — grouped by conversation ───

router.get("/inbox", async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = 20;
	const skip = (page - 1) * limit;
	const userId = new mongoose.Types.ObjectId(req.user.userId);

	try {
		const pipeline = [
			{
				$match: {
					recipientUser: userId,
					conversationId: { $ne: null },
				},
			},
			{
				$sort: { createdAt: -1 },
			},
			{
				$group: {
					_id: "$conversationId",
					lastMessage: { $first: "$$ROOT" },
					threadCount: { $sum: 1 },
					unreadInThread: {
						$sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] },
					},
				},
			},
			{ $sort: { "lastMessage.createdAt": -1 } },
			{
				$facet: {
					data: [{ $skip: skip }, { $limit: limit }],
					totalCount: [{ $count: "count" }],
				},
			},
		];

		const [result] = await db.internalMessages.aggregate(pipeline);
		const conversations = result.data || [];
		const total = result.totalCount[0]?.count || 0;

		// Populate sender info on lastMessage
		const messageIds = conversations.map((c) => c.lastMessage._id);
		const populated = await db.internalMessages
			.find({ _id: { $in: messageIds } })
			.populate("senderUser", "firstName lastName email role")
			.populate("recipientUser", "firstName lastName email role")
			.lean();

		const populatedMap = {};
		for (const m of populated) {
			populatedMap[m._id.toString()] = m;
		}

		const messages = conversations.map((c) => ({
			...populatedMap[c.lastMessage._id.toString()],
			conversationId: c._id,
			threadCount: c.threadCount,
			unreadInThread: c.unreadInThread,
		}));

		res.json({
			messages,
			pagination: { page, limit, total, pages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("Erreur inbox:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ─── GET /internal-messages/sent — grouped by conversation ───

router.get("/sent", async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = 20;
	const skip = (page - 1) * limit;
	const userId = new mongoose.Types.ObjectId(req.user.userId);

	try {
		const pipeline = [
			{
				$match: {
					senderUser: userId,
					conversationId: { $ne: null },
				},
			},
			{
				$sort: { createdAt: -1 },
			},
			{
				$group: {
					_id: "$conversationId",
					lastMessage: { $first: "$$ROOT" },
					threadCount: { $sum: 1 },
				},
			},
			{ $sort: { "lastMessage.createdAt": -1 } },
			{
				$facet: {
					data: [{ $skip: skip }, { $limit: limit }],
					totalCount: [{ $count: "count" }],
				},
			},
		];

		const [result] = await db.internalMessages.aggregate(pipeline);
		const conversations = result.data || [];
		const total = result.totalCount[0]?.count || 0;

		const messageIds = conversations.map((c) => c.lastMessage._id);
		const populated = await db.internalMessages
			.find({ _id: { $in: messageIds } })
			.populate("senderUser", "firstName lastName email role")
			.populate("recipientUser", "firstName lastName email role")
			.lean();

		const populatedMap = {};
		for (const m of populated) {
			populatedMap[m._id.toString()] = m;
		}

		const messages = conversations.map((c) => ({
			...populatedMap[c.lastMessage._id.toString()],
			conversationId: c._id,
			threadCount: c.threadCount,
		}));

		res.json({
			messages,
			pagination: { page, limit, total, pages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("Erreur sent:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ─── GET /internal-messages/unread-count ───

router.get("/unread-count", async function (req, res) {
	try {
		const count = await getUnreadCountForUser(req.user.userId);
		res.json({ count });
	} catch (error) {
		console.error("Erreur unread count:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ─── GET /internal-messages/conversations/archived ───

router.get("/conversations/archived", async function (req, res) {
	const page = parseInt(req.query.page) || 1;
	const limit = 20;
	const skip = (page - 1) * limit;
	const userId = new mongoose.Types.ObjectId(req.user.userId);

	try {
		const archivedDocs = await db.archivedConversations.find({ userId: req.user.userId }).lean();
		const archivedIds = archivedDocs.map((d) => d.conversationId);

		if (archivedIds.length === 0) {
			return res.json({
				messages: [],
				pagination: { page, limit, total: 0, pages: 0 },
			});
		}

		const pipeline = [
			{
				$match: {
					conversationId: { $in: archivedIds },
					$or: [{ senderUser: userId }, { recipientUser: userId }],
				},
			},
			{ $sort: { createdAt: -1 } },
			{
				$group: {
					_id: "$conversationId",
					lastMessage: { $first: "$$ROOT" },
					threadCount: { $sum: 1 },
					unreadInThread: {
						$sum: {
							$cond: [
								{ $and: [{ $eq: ["$recipientUser", userId] }, { $eq: ["$isRead", false] }] },
								1,
								0,
							],
						},
					},
				},
			},
			{ $sort: { "lastMessage.createdAt": -1 } },
			{
				$facet: {
					data: [{ $skip: skip }, { $limit: limit }],
					totalCount: [{ $count: "count" }],
				},
			},
		];

		const [result] = await db.internalMessages.aggregate(pipeline);
		const conversations = result.data || [];
		const total = result.totalCount[0]?.count || 0;

		const messageIds = conversations.map((c) => c.lastMessage._id);
		const populated = await db.internalMessages
			.find({ _id: { $in: messageIds } })
			.populate("senderUser", "firstName lastName email role")
			.populate("recipientUser", "firstName lastName email role")
			.lean();

		const populatedMap = {};
		for (const m of populated) {
			populatedMap[m._id.toString()] = m;
		}

		const messages = conversations.map((c) => ({
			...populatedMap[c.lastMessage._id.toString()],
			conversationId: c._id,
			threadCount: c.threadCount,
			unreadInThread: c.unreadInThread,
		}));

		res.json({
			messages,
			pagination: { page, limit, total, pages: Math.ceil(total / limit) },
		});
	} catch (error) {
		console.error("Erreur archived conversations:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ─── GET /internal-messages/conversation/:conversationId ───
// Placed BEFORE /:id/read to avoid param conflict

router.get("/conversation/:conversationId", async function (req, res) {
	try {
		const { conversationId } = req.params;
		const userId = req.user.userId;

		const messages = await db.internalMessages
			.find({
				conversationId,
				$or: [{ senderUser: userId }, { recipientUser: userId }],
			})
			.sort({ createdAt: 1 })
			.populate("senderUser", "firstName lastName email role")
			.populate("recipientUser", "firstName lastName email role")
			.lean();

		if (messages.length === 0) {
			return res.status(404).json({ error: "Conversation introuvable." });
		}

		// Auto-mark unread messages as read
		const unreadIds = messages
			.filter((m) => m.recipientUser._id.toString() === userId && !m.isRead)
			.map((m) => m._id);

		if (unreadIds.length > 0) {
			await db.internalMessages.updateMany(
				{ _id: { $in: unreadIds } },
				{ $set: { isRead: true } }
			);

			// Emit updated unread count
			const newCount = await getUnreadCountForUser(userId);
			emitUnreadCount(req, userId, newCount);
		}

		res.json({ messages });
	} catch (error) {
		console.error("Erreur conversation:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ─── POST /internal-messages/send ───

router.post("/send", async function (req, res) {
	const { recipientUser, subject, content, parentMessage } = req.body;

	if (!recipientUser || !subject || !content) {
		return res.status(400).json({ error: "Destinataire, sujet et contenu sont requis." });
	}

	try {
		const recipient = await db.users.findById(recipientUser);
		if (!recipient) {
			return res.status(404).json({ error: "Destinataire introuvable." });
		}

		// Determine conversationId
		let conversationId = null;
		if (parentMessage) {
			const parent = await db.internalMessages.findById(parentMessage);
			if (parent && parent.conversationId) {
				conversationId = parent.conversationId;
			}
		}

		const message = new db.internalMessages({
			senderUser: req.user.userId,
			recipientUser,
			subject,
			content,
			parentMessage: parentMessage || null,
			conversationId,
		});
		await message.save();

		// If root message, set conversationId = own _id
		if (!conversationId) {
			message.conversationId = message._id;
			await message.save();
		}

		// Populate for socket emission
		await message.populate("senderUser", "firstName lastName email role");
		await message.populate("recipientUser", "firstName lastName email role");

		// Socket: emit new message + unread count to recipient
		const io = req.app.get("io");
		if (io) {
			io.to("user:" + recipientUser).emit("new-message", message.toObject());
			const count = await getUnreadCountForUser(recipientUser);
			io.to("user:" + recipientUser).emit("unread-count", { count });
		}

		// Email notification (fire-and-forget)
		const sender = await db.users.findById(req.user.userId).lean();
		const senderName = sender ? `${sender.firstName} ${sender.lastName}` : "Un utilisateur";
		sendNewMessageEmailNotification(recipient, senderName, subject);

		res.status(201).json({ message: "Message envoyé.", data: message });
	} catch (error) {
		console.error("Erreur send:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

// ─── PATCH /internal-messages/:id/read ───

router.patch("/:id/read", async function (req, res) {
	try {
		const message = await db.internalMessages.findById(req.params.id);
		if (!message) {
			return res.status(404).json({ error: "Message introuvable." });
		}
		if (message.recipientUser.toString() !== req.user.userId) {
			return res.status(403).json({ error: "Accès refusé." });
		}

		message.isRead = true;
		await message.save();

		// Emit updated unread count via socket
		const count = await getUnreadCountForUser(req.user.userId);
		emitUnreadCount(req, req.user.userId, count);

		res.json({ message: "Message marqué comme lu." });
	} catch (error) {
		console.error("Erreur mark read:", error);
		res.status(500).json({ error: "Erreur serveur." });
	}
});

module.exports = router;
