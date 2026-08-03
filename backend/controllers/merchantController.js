const db = require("../config/db");

const getMerchants = (req, res) => {

    db.query(
        "SELECT id, merchant_name, upi_id, created_at FROM merchants ORDER BY merchant_name ASC",
        (err, result) => {

            if (err) {
                return res.status(500).json(err);
            }

            res.json(result);

        }
    );

};

module.exports = {
    getMerchants
};