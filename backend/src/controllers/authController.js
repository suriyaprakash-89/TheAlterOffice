const store = require('../models/todoStore');

async function signup(req, res, next) {
  try {
    const result = await store.signup(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const result = await store.login(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    const result = await store.logout(req.authToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

function me(req, res) {
  res.json(store.me(req.auth.user.id));
}

module.exports = {
  signup,
  login,
  logout,
  me
};
