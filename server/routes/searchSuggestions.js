const express = require('express');
const { getSearchSuggestions } = require('../controllers/searchSuggestionsController');

const router = express.Router();

router.get('/', getSearchSuggestions);

module.exports = router;
