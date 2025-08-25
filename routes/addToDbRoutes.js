const express = require("express");
const router = express.Router();
const {addCaseAndMobile} = require("../controller/caseMobile")

//@method POST
//desc - it adds mobile number and all the cases to it 
//path - api/frontendData/addCase
router.post("/addCase", addCaseAndMobile); 



module.exports = router;