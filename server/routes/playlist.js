const express = require('express');
const { getPlaylist, getAllPlaylists } = require('../controllers/playlistController');

const router = express.Router();

router.get('/all', getAllPlaylists);
router.get('/:type', getPlaylist);

module.exports = router;
