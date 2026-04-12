const express = require('express');
const auth = require('../middleware/auth');
const { getSearchSuggestions } = require('../controllers/searchSuggestionsController');

const router = express.Router();

router.use(auth);
router.get('/', getSearchSuggestions);

module.exports = router;
