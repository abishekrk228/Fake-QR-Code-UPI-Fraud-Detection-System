const express = require("express");

const router = express.Router();

const { scanQR } = require("../controllers/scanController");

router.post("/", scanQR);

module.exports = router;