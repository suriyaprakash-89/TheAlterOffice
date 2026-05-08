const express = require('express');
const listController = require('../controllers/listController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);
router.get('/', listController.index);
router.post('/', listController.create);
router.get('/:listId', listController.show);
router.patch('/:listId', listController.update);
router.delete('/:listId', listController.remove);
router.post('/:listId/share', listController.share);
router.delete('/:listId/share', listController.unshare);
router.post('/:listId/items', listController.addItem);

module.exports = router;
