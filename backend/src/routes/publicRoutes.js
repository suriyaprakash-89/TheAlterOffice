const express = require('express');
const publicController = require('../controllers/publicController');

const router = express.Router();

router.get('/lists/:shareToken', publicController.show);

module.exports = router;
