const { Router } = require('express');
const auth = require('../middleware/auth');
const { getLiked, toggleLike } = require('../controllers/likedController');
const router = Router();
router.use(auth);
router.get('/', getLiked);
router.post('/toggle', toggleLike);
module.exports = router;
