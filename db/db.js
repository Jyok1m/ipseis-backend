const db = {
	messages: require("./models/Message"),
	prospects: require("./models/Prospect"),
	interactions: require("./models/Interaction"),
	themes: require("./models/Theme"),
	trainings: require("./models/Training"),
	users: require("./models/User"),
	activationCodes: require("./models/ActivationCode"),
	passwordResetTokens: require("./models/PasswordResetToken"),
	checklists: require("./models/Checklist"),
	contracts: require("./models/Contract"),
	resources: require("./models/Resource"),
	internalMessages: require("./models/InternalMessage"),
};

module.exports = db;
