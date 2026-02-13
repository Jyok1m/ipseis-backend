const mongoose = require("mongoose");

const connectToMongoDB = async () => {
	try {
		mongoose.set("strictQuery", false);
		await mongoose.connect(process.env.MONGODB_URI);
		console.log("Connected to MongoDB successfully");
	} catch (error) {
		console.error("MongoDB connection error:", error);
		process.exit(1);
	}
};

mongoose.connection.on("error", (err) => {
	console.error("Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
	console.log("Mongoose disconnected from MongoDB");
});

process.on("SIGINT", async () => {
	try {
		await mongoose.connection.close();
		process.exit(0);
	} catch (error) {
		console.error("Error during MongoDB disconnection:", error);
		process.exit(1);
	}
});

module.exports = { mongoose, connectToMongoDB };
