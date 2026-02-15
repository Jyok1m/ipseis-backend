const roleMiddleware = (...allowedRoles) => {
	return (req, res, next) => {
		if (!req.user || !allowedRoles.includes(req.user.role)) {
			return res.status(403).json({ error: "Accès non autorisé." });
		}
		next();
	};
};

module.exports = roleMiddleware;
