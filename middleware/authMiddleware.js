const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
	const token = req.cookies.token;

	if (!token) {
		return res.status(401).json({ error: "Authentification requise." });
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = { userId: decoded.userId, email: decoded.email, role: decoded.role };
		next();
	} catch (error) {
		return res.status(401).json({ error: "Session invalide ou expirée." });
	}
};

module.exports = authMiddleware;
