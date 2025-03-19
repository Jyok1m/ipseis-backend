const { USER_AGENT_ENV, FRONTEND_URL } = process.env;

const secureOrigin = (req, res, next) => {
	if (USER_AGENT_ENV !== "dev") {
		return next();
	}

	const userAgent = req.headers["user-agent"];
	const blockedUserAgents = [
		"Postman",
		"Thunder Client",
		"curl",
		"Wget",
		"Googlebot",
		"bingbot",
		"Yahoo! Slurp",
		"DuckDuckBot",
		"Slackbot",
		"Discordbot",
		"Mozilla",
		"Chrome",
		"Safari",
		"Opera",
	];

	const isUserAgentBlocked = blockedUserAgents.some((agent) => new RegExp(agent, "i").test(userAgent));

	const origin = req.headers["origin"];
	const isOriginBlocked = origin !== FRONTEND_URL;

	if (isUserAgentBlocked && isOriginBlocked) {
		return res.status(403).send("Accès refusé");
	}
};

module.exports = secureOrigin;
