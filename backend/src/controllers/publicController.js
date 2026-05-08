const store = require('../models/todoStore');

function show(req, res, next) {
  try {
    res.json(store.getPublicList(req.params.shareToken));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  show
};
