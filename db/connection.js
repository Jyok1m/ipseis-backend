const mongoose = require("mongoose");

mongoose
	.connect(process.env.MONGODB_URI, { timeoutMS: 2000 })
	.then(() => console.log("Connected to MongoDB"))
	.catch((err) => console.error("Could not connect to MongoDB", err));

module.exports = mongoose;
