const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Access Denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1]; // Format: Bearer <token>
  if (!token) {
    return res.status(401).json({ message: 'Access Denied. No token provided.' });
  }

  try {
    const defaultSecret = 'fallback_secret_key_for_development'; // In production, require process.env.JWT_SECRET
    const secret = process.env.JWT_SECRET || defaultSecret;
    const verified = jwt.verify(token, secret);
    req.user = verified; // { id: <userId>, username: <username> }
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid Token' });
  }
}

// Middleware to optionally verify JWT token (if present)
function optionalVerifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return next();
  }

  try {
    const defaultSecret = 'fallback_secret_key_for_development';
    const secret = process.env.JWT_SECRET || defaultSecret;
    const verified = jwt.verify(token, secret);
    req.user = verified;
  } catch (err) {
    // Ignore invalid tokens for optional routes
  }
  next();
}

module.exports = { verifyToken, optionalVerifyToken };
