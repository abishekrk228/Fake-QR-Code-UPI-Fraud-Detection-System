const crypto = require("crypto");

function generateHash(data) {
  return crypto
    .createHash("sha512")
    .update(data)
    .digest("hex");
}

module.exports = generateHash;