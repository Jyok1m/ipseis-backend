const mongoose = require("mongoose");

// Configuration de connexion MongoDB optimisée pour Vercel
const connectOptions = {
	connectTimeoutMS: 30000,
	serverSelectionTimeoutMS: 30000,
	socketTimeoutMS: 45000,
	bufferCommands: false,
	bufferMaxEntries: 0,
	maxPoolSize: 10,
	minPoolSize: 1,
};

// Variable pour suivre l'état de la connexion
let isConnected = false;

// Fonction pour se connecter à MongoDB
const connectToMongoDB = async () => {
	if (isConnected && mongoose.connection.readyState === 1) {
		console.log("📡 Using existing MongoDB connection");
		return mongoose;
	}

	try {
		console.log("🔄 Connecting to MongoDB...");
		await mongoose.connect(process.env.MONGODB_URI, connectOptions);
		isConnected = true;
		console.log("✅ Connected to MongoDB successfully");
		console.log("Database:", mongoose.connection.name);
		return mongoose;
	} catch (error) {
		console.error("❌ MongoDB connection error:", error);
		console.error("MongoDB URI (censored):", process.env.MONGODB_URI?.replace(/\/\/.*@/, "//***:***@"));
		isConnected = false;
		throw error;
	}
};

// Gestion des événements de connexion
mongoose.connection.on("connected", () => {
	console.log("🔗 Mongoose connected to MongoDB");
	isConnected = true;
});

mongoose.connection.on("error", (err) => {
	console.error("❌ Mongoose connection error:", err);
	isConnected = false;
});

mongoose.connection.on("disconnected", () => {
	console.log("🔌 Mongoose disconnected from MongoDB");
	isConnected = false;
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

// Exporter la fonction de connexion et mongoose
module.exports = {
	mongoose,
	connectToMongoDB,
	isConnected: () => isConnected && mongoose.connection.readyState === 1,
};
