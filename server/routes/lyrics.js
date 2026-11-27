const { Router } = require('express');
const { getLyrics } = require('../controllers/lyricsController');

const router = Router();
router.get('/', getLyrics);

module.exports = router;
