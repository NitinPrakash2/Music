const express = require('express');
const { saveSearchHistory, getSearchHistory, deleteSearchHistory, clearAllSearchHistory } = require('../controllers/searchHistoryController');

const router = express.Router();

router.post('/', saveSearchHistory);
router.get('/', getSearchHistory);
router.delete('/:query', deleteSearchHistory);
router.delete('/', clearAllSearchHistory);

module.exports = router;
