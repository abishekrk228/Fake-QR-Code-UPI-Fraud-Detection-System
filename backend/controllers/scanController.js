const db = require("../config/db");
const generateHash = require("../utils/sha512");

const scanQR = (req, res) => {

    const { upiId } = req.body;

    if (!upiId) {
        return res.status(400).json({
            success: false,
            message: "UPI ID is required"
        });
    }

    db.query(
        "SELECT * FROM merchants WHERE upi_id=?",
        [upiId],
        (err, result) => {

            if (err) {
                return res.status(500).json(err);
            }

            if (result.length === 0) {
                const unknownMerchantName = "Unknown";
                const unknownUpiId = "fraud@unknown";
                const unknownMerchantStatus = "Unknown";
                const unknownHashStatus = "Mismatched";
                const unknownTrustScore = 20;
                const unknownFinalStatus = "High Risk";

                db.query(
                    `INSERT INTO scan_logs
                    (merchant_name, upi_id, merchant_status, hash_status, trust_score, final_status)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        unknownMerchantName,
                        unknownUpiId,
                        unknownMerchantStatus,
                        unknownHashStatus,
                        unknownTrustScore,
                        unknownFinalStatus
                    ],
                    (insertErr) => {

                        if (insertErr) {
                            return res.status(500).json(insertErr);
                        }

                        return res.json({
                            merchantName: unknownMerchantName,
                            upiId: unknownUpiId,
                            merchantStatus: unknownMerchantStatus,
                            hashStatus: unknownHashStatus,
                            trustScore: unknownTrustScore,
                            finalStatus: unknownFinalStatus
                        });

                    }
                );

                return;

            }

            const merchant = result[0];

            const currentHash = generateHash(upiId);

            let hashStatus = "Mismatched";

            if (currentHash === merchant.sha512_hash) {
                hashStatus = "Matched";
            }

            let trustScore = 0;

            trustScore += 40;

            if (hashStatus === "Matched")
                trustScore += 60;

            let finalStatus = "High Risk";

            if (trustScore >= 90)
                finalStatus = "Safe";
            else if (trustScore >= 60)
                finalStatus = "Warning";

            const status = finalStatus;

            db.query(
                `INSERT INTO scan_logs
                (merchant_name, upi_id, merchant_status, hash_status, trust_score, final_status)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    merchant.merchant_name,
                    merchant.upi_id,
                    "Verified",
                    hashStatus,
                    trustScore,
                    status
                ],
                (insertErr) => {

                    if (insertErr) {
                        return res.status(500).json(insertErr);
                    }

                    res.json({
                        merchantName: merchant.merchant_name,
                        upiId: merchant.upi_id,
                        merchantStatus: "Verified",
                        hashStatus,
                        trustScore,
                        finalStatus: status
                    });

                }
            );

        }
    );

};

module.exports = {
    scanQR
};
