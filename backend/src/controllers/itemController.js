const store = require('../models/todoStore');

async function update(req, res, next) {
  try {
    const result = await store.updateItem(req.auth.user.id, req.params.itemId, req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    const result = await store.deleteItem(req.auth.user.id, req.params.itemId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function move(req, res, next) {
  try {
    const result = await store.moveItem(req.auth.user.id, req.params.itemId, req.body?.direction);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  update,
  remove,
  move
};
