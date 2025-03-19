require("dotenv").config();
require("./db/connection");

var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");

var indexRouter = require("./routes/index");
var themesRouter = require("./routes/themes");
var trainingsRouter = require("./routes/trainings");

var app = express();
var cors = require("cors");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/themes", themesRouter);
app.use("/trainings", trainingsRouter);

module.exports = app;
