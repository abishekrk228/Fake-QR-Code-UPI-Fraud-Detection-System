require("dotenv").config();

const express = require("express");
const cors = require("cors");

const db = require("./config/db");
const scanRoutes = require("./routes/scanRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const historyRoutes = require("./routes/historyRoutes");
const merchantRoutes = require("./routes/merchantRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Home Route
app.get("/", (req, res) => {
  res.send("🚀 QR Fraud Detection Backend Running");
});

// Scan API
app.use("/api/scan", scanRoutes);

// Dashboard API
app.use("/api/dashboard", dashboardRoutes);

// History API
app.use("/api/history", historyRoutes);

// Merchants API
app.use("/api/merchants", merchantRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});