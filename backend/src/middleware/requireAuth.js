const store = require('../models/todoStore');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  const auth = store.authenticateToken(token);
  if (!auth) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  req.auth = auth;
  req.authToken = token;
  next();
}

module.exports = requireAuth;
