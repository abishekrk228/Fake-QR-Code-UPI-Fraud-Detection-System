const express = require("express");

const router = express.Router();

const {
    getMerchants
} = require("../controllers/merchantController");

router.get("/", getMerchants);

module.exports = router;