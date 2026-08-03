const crypto = require("crypto");

const merchants = [
  {
    name: "ABC Tea Shop",
    upi: "abctea@okaxis"
  },
  {
    name: "XYZ Store",
    upi: "xyz@okaxis"
  },
  {
    name: "Coffee House",
    upi: "coffee@okaxis"
  }
];

merchants.forEach((m) => {

  const hash = crypto
    .createHash("sha512")
    .update(m.upi)
    .digest("hex");

  console.log("------------------------");
  console.log(m.name);
  console.log(m.upi);
  console.log(hash);

});