const express = require('express');
const router = express.Router();
const { getCaseStatus } = require('../controllers/highCourt.controller');

router.get('/status/:cino', getCaseStatus);

module.exports = router;
