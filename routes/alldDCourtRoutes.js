//routes/allDCourtRotes.js

const express = require("express");
const router = express.Router();
const fetchCase = require("../services/aldDCourt");

router.post("/ald/DCourt/CaseDetail", fetchCase);




module.exports=router;