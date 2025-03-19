const { USER_AGENT_ENV, BACKEND_USERNAME, BACKEND_PASSWORD } = process.env;

const secureOrigin = (req, res, next) => {
	const allowedOrigins = ["http://localhost:4001", "https://ipseis-git-test-joachim-jasmins-projects.vercel.app", "https://www.ipseis.fr"];
	if (USER_AGENT_ENV === "dev" || req.url === "/" || req.url.startsWith("/stylesheets")) {
		return next();
	}

	// Vérification de l'authentification basique
	const authHeader = req.headers["authorization"];

	const base64Credentials = authHeader.split(" ")[1];
	const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
	const [username, password] = credentials.split(":");

	// Remplacez ces valeurs par vos identifiants sécurisés
	if (username === BACKEND_USERNAME && password === BACKEND_PASSWORD) {
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
		if (!authHeader) {
			return res.status(401).send("Authentification requise");
		} else if (username !== BACKEND_USERNAME || password !== BACKEND_PASSWORD) {
			return res.status(403).send("Accès refusé : identifiants invalides");
		}

		return res.status(403).send("Accès refusé");
	}

	next();
};

module.exports = secureOrigin;
