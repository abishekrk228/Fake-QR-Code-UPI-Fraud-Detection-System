require("dotenv").config();

const mysql = require("mysql2");
const sha512 = require("./utils/sha512");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const MERCHANTS = [
  { upiId: "abctea@okaxis", name: "ABC Tea Shop" },
  { upiId: "xyz@okaxis", name: "XYZ Store" },
  { upiId: "coffee@okaxis", name: "Coffee House" },
  { upiId: "fake@okaxis", name: "Fake QR" },
];

db.connect((err) => {
  if (err) {
    console.error("Connection failed:", err.message);
    process.exit(1);
  }

  const ensureTable = `CREATE TABLE IF NOT EXISTS merchants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    upi_id VARCHAR(255) NOT NULL UNIQUE,
    merchant_name VARCHAR(255) NOT NULL,
    sha512_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;

  db.query(ensureTable, (tableErr) => {
    if (tableErr) {
      console.error("Table setup failed:", tableErr.message);
      process.exit(1);
    }

    const values = MERCHANTS.map((m) => [
      m.upiId,
      m.name,
      m.upiId === "fake@okaxis" ? sha512(`tampered:${m.upiId}`) : sha512(m.upiId),
    ]);

    db.query(
      `INSERT INTO merchants (upi_id, merchant_name, sha512_hash)
       VALUES ?
       ON DUPLICATE KEY UPDATE
         merchant_name = VALUES(merchant_name),
         sha512_hash = VALUES(sha512_hash)`,
      [values],
      (insertErr, result) => {
        if (insertErr) {
          console.error("Insert failed:", insertErr.message);
          process.exit(1);
        }

        console.log(`Seeded ${MERCHANTS.length} merchants`);
        console.log(
          MERCHANTS.map((m) => `${m.upiId} -> ${m.name} (${m.upiId === "fake@okaxis" ? "tampered hash" : "valid hash"})`).join("\n")
        );
        db.end();
      }
    );
  });
});
