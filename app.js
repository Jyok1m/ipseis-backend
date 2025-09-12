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

app.use(cors());
// app.use(secureOrigin);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/messages", messagesRouter);
app.use("/themes", themesRouter);
app.use("/trainings", trainingsRouter); //

module.exports = app;
