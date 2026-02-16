/**
 * Migration script: backfill conversationId for existing internal messages.
 *
 * - Messages without a parentMessage (root messages) get conversationId = their own _id.
 * - Messages with a parentMessage inherit the conversationId from the root of their chain.
 *
 * Usage: node scripts/migrateConversationIds.js
 */

require("dotenv").config();
const { connectToMongoDB } = require("../db/connection");
const InternalMessage = require("../db/models/InternalMessage");

async function migrate() {
	await connectToMongoDB();
	console.log("Connected to MongoDB. Starting migration...");

	// Step 1: Set conversationId for root messages (no parentMessage)
	const rootMessages = await InternalMessage.find({
		parentMessage: null,
		conversationId: null,
	});

	console.log(`Found ${rootMessages.length} root messages without conversationId.`);

	for (const msg of rootMessages) {
		msg.conversationId = msg._id;
		await msg.save();
	}
	console.log(`Updated ${rootMessages.length} root messages.`);

	// Step 2: Set conversationId for reply messages by following the parent chain
	const replies = await InternalMessage.find({
		parentMessage: { $ne: null },
		conversationId: null,
	});

	console.log(`Found ${replies.length} reply messages without conversationId.`);

	let updated = 0;
	for (const reply of replies) {
		// Walk up the parent chain to find the root
		let currentId = reply.parentMessage;
		let root = null;

		while (currentId) {
			const parent = await InternalMessage.findById(currentId).lean();
			if (!parent) break;

			if (parent.conversationId) {
				root = parent.conversationId;
				break;
			}

			if (!parent.parentMessage) {
				// This is the root — set its conversationId too
				root = parent._id;
				await InternalMessage.updateOne({ _id: parent._id }, { $set: { conversationId: parent._id } });
				break;
			}

			currentId = parent.parentMessage;
		}

		if (root) {
			reply.conversationId = root;
			await reply.save();
			updated++;
		} else {
			// Orphaned reply — set conversationId to itself
			reply.conversationId = reply._id;
			await reply.save();
			updated++;
		}
	}

	console.log(`Updated ${updated} reply messages.`);
	console.log("Migration complete.");
	process.exit(0);
}

migrate().catch((err) => {
	console.error("Migration error:", err);
	process.exit(1);
});
