const db = {
	messages: require("./models/Message"),
	prospects: require("./models/Prospect"),
	interactions: require("./models/Interaction"),
	themes: require("./models/Theme"),
	trainings: require("./models/Training"),
};

module.exports = db;
