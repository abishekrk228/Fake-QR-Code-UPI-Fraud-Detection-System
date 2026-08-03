const db = require("../config/db");

const getHistory = (req, res) => {

    const sql = `
        SELECT
            id,
            merchant_name,
            upi_id,
            merchant_status,
            hash_status,
            trust_score,
            final_status,
            scanned_at
        FROM scan_logs
        ORDER BY scanned_at DESC
    `;

    db.query(sql, (err, result) => {

        if (err) {
            return res.status(500).json(err);
        }

        res.json(result);

    });

};

module.exports = {
    getHistory
};