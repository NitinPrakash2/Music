const { Router } = require('express');
const { signup, login, me } = require('../controllers/authController');
const router = Router();
router.post('/signup', signup);
router.post('/login', login);
router.get('/me', me);
module.exports = router;
