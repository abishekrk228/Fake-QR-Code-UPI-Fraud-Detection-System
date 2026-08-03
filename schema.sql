CREATE DATABASE qr_fraud_detection;

USE qr_fraud_detection;

CREATE TABLE merchants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_name VARCHAR(255),
    upi_id VARCHAR(255),
    sha512_hash VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scan_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_name VARCHAR(255),
    upi_id VARCHAR(255),
    merchant_status VARCHAR(50),
    hash_status VARCHAR(50),
    trust_score INT,
    final_status VARCHAR(50),
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);