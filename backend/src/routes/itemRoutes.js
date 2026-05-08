const express = require('express');
const itemController = require('../controllers/itemController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);
router.patch('/:itemId', itemController.update);
router.delete('/:itemId', itemController.remove);
router.post('/:itemId/move', itemController.move);

module.exports = router;
