require("dotenv").config();

var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");

var indexRouter = require("./routes/index");
var messagesRouter = require("./routes/messages");
var themesRouter = require("./routes/themes");
var trainingsRouter = require("./routes/trainings");

var app = express();
var cors = require("cors");

const corsOptions = {
	origin: [
		"https://www.ipseis.fr",
		"http://localhost:" + (process.env.PORT || 3098),
		"http://localhost:4001",
	],
	credentials: true,
	optionsSuccessStatus: 200,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
	const { mongoose } = require("./db/connection");
	const dbState = mongoose.connection.readyState;
	const states = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

	res.json({
		status: dbState === 1 ? "healthy" : "unhealthy",
		database: states[dbState],
		timestamp: new Date().toISOString(),
	});
});

app.use("/", indexRouter);
app.use("/messages", messagesRouter);
app.use("/themes", themesRouter);
app.use("/trainings", trainingsRouter);

module.exports = app;
