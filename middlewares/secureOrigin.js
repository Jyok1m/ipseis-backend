const { USER_AGENT_ENV } = process.env;

const secureOrigin = (req, res, next) => {
	const allowedOrigins = ["http://localhost:4001", "https://ipseis-git-test-joachim-jasmins-projects.vercel.app", "https://www.ipseis.fr"];
	if (USER_AGENT_ENV === "dev" || req.url === "/" || req.url.startsWith("/stylesheets")) {
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
	const isOriginBlocked = !allowedOrigins.includes(origin);

	if (isUserAgentBlocked && isOriginBlocked) {
		return res.status(403).send("Accès refusé");
	}
};

module.exports = secureOrigin;
