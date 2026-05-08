const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const listRoutes = require('./routes/listRoutes');
const publicRoutes = require('./routes/publicRoutes');
const store = require('./models/todoStore');
const authController = require('./controllers/authController');
const requireAuth = require('./middleware/requireAuth');

dotenv.config();

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, authController.me);

app.use('/api/auth', authRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/public', publicRoutes);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Server error';
  res.status(statusCode).json({ error: message });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function start() {
  await store.init();
}

module.exports = {
  app,
  start
};
