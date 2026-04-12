const { Router } = require('express');
const auth = require('../middleware/auth');
const { getLiked, getLikedSongs, toggleLike } = require('../controllers/likedController');
const router = Router();
router.use(auth);
router.get('/', getLiked);
router.get('/songs', getLikedSongs);
router.post('/toggle', toggleLike);
module.exports = router;
