# Fake QR Code & UPI Fraud Detection System

A full-stack web application that detects fake or tampered UPI QR codes by verifying merchants, checking SHA-512 integrity, calculating a trust score, and logging scan history.

## Tech Stack

- React + TypeScript
- Node.js + Express
- MySQL
- SHA-512

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/abishekrk228/Fake-QR-Code-UPI-Fraud-Detection-System.git
```

### 2. Install dependencies

Frontend:

```bash
npm install
```

Backend:

```bash
cd backend
npm install
```

### 3. Create a `.env` file inside the `backend` folder

Use the following template:

```env
PORT=5000

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=qr_fraud_detection

CLIENT_ORIGIN=http://localhost:5173
```

### 4. Create the MySQL database

```sql
CREATE DATABASE qr_fraud_detection;
```

Import the database schema (or run the seed script if included).

cd backend
node seed.js

### 5. Start the backend

```bash
cd backend
node server.js
```

### 6. Start the frontend

```bash
npm run dev
```

The application will be available at:

```
http://localhost:5173
```