const express = require('express');
const { recommendationsController } = require('../controllers/recommendationsController');

const router = express.Router();

router.post('/', recommendationsController);

module.exports = router;
