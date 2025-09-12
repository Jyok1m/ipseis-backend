const mongoose = require("mongoose");

// Configuration de connexion MongoDB optimisée pour Vercel
const connectOptions = {
	connectTimeoutMS: 30000, // Augmentation à 30 secondes
	serverSelectionTimeoutMS: 30000, // Timeout pour la sélection du serveur
	socketTimeoutMS: 45000, // Timeout pour les opérations socket
	bufferCommands: false, // Désactive le buffer des commandes en cas de déconnexion
	bufferMaxEntries: 0, // Pas de buffer des entrées
	maxPoolSize: 10, // Limite le nombre de connexions simultanées
	minPoolSize: 1, // Garde au moins une connexion ouverte
};

mongoose
	.connect(process.env.MONGODB_URI, connectOptions)
	.then(() => {
		console.log("✅ Connected to MongoDB successfully");
		console.log("Database:", mongoose.connection.name);
	})
	.catch((err) => {
		console.error("❌ MongoDB connection error:", err);
		console.error("MongoDB URI (censored):", process.env.MONGODB_URI?.replace(/\/\/.*@/, "//***:***@"));
	});

// Gestion des événements de connexion
mongoose.connection.on("connected", () => {
	console.log("🔗 Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
	console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
	console.log("🔌 Mongoose disconnected from MongoDB");
});

// Fermeture propre lors de l'arrêt de l'application
process.on("SIGINT", async () => {
	try {
		await mongoose.connection.close();
		console.log("MongoDB connection closed through app termination");
		process.exit(0);
	} catch (error) {
		console.error("Error during MongoDB disconnection:", error);
		process.exit(1);
	}
});

module.exports = mongoose;
