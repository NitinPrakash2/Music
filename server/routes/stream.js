const { Router } = require('express');
const { streamController } = require('../controllers/streamController');

const router = Router();

router.get('/', streamController);

module.exports = router;
