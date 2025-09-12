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
// var secureOrigin = require("./middlewares/secureOrigin");

// Configuration CORS pour autoriser les domaines spécifiques
const corsOptions = {
	origin: ["https://ipseis-git-test-joachim-jasmins-projects.vercel.app", "https://www.ipseis.fr", "http://localhost:3000", "http://localhost:4001"],
	credentials: true,
	optionsSuccessStatus: 200, // Pour supporter les anciens navigateurs (IE11)
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

// Middleware de debug pour les requêtes CORS
app.use((req, res, next) => {
	console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
	console.log("Origin:", req.headers.origin);
	console.log("User-Agent:", req.headers["user-agent"]);
	next();
});

app.use(cors(corsOptions));
// app.use(secureOrigin);

// Middleware pour gérer les requêtes preflight OPTIONS
app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/messages", messagesRouter);
app.use("/themes", themesRouter);
app.use("/trainings", trainingsRouter); //

module.exports = app;
