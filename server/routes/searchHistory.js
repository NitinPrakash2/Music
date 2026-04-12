const express = require('express');
const auth = require('../middleware/auth');
const { saveSearchHistory, getSearchHistory, deleteSearchHistory, clearAllSearchHistory } = require('../controllers/searchHistoryController');

const router = express.Router();

router.use(auth);
router.post('/', saveSearchHistory);
router.get('/', getSearchHistory);
router.delete('/:query', deleteSearchHistory);
router.delete('/', clearAllSearchHistory);

module.exports = router;
