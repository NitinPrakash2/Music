const { Router } = require('express');
const { streamController, downloadController } = require('../controllers/streamController');

const router = Router();

router.get('/', streamController);
router.get('/download', downloadController);

module.exports = router;
