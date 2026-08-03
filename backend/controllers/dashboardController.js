const db = require("../config/db");

const getDashboard = (req, res) => {

    db.query(
        "SELECT COUNT(*) AS totalMerchants FROM merchants",
        (err, merchants) => {

            if (err) return res.status(500).json(err);

            db.query(
                "SELECT COUNT(*) AS totalScans FROM scan_logs",
                (err, scans) => {

                    if (err) return res.status(500).json(err);

                    db.query(
                        "SELECT COUNT(*) AS safeScans FROM scan_logs WHERE final_status='Safe'",
                        (err, safe) => {

                            if (err) return res.status(500).json(err);

                            db.query(
                                "SELECT COUNT(*) AS highRisk FROM scan_logs WHERE final_status='High Risk'",
                                (err, risk) => {

                                    if (err) return res.status(500).json(err);

                                    res.json({
                                        totalMerchants: merchants[0].totalMerchants,
                                        totalScans: scans[0].totalScans,
                                        safeScans: safe[0].safeScans,
                                        highRisk: risk[0].highRisk
                                    });

                                }
                            );

                        }
                    );

                }
            );

        }
    );

};

module.exports = { getDashboard };