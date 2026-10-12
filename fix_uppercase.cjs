const fs = require('fs');
let code = fs.readFileSync('src/app/App.tsx', 'utf8');

// Replace {status.toUpperCase()} with {(status || 'Unknown').toUpperCase()}
code = code.replace(/\{status\.toUpperCase\(\)\}/g, "{(status || 'Unknown').toUpperCase()}");

fs.writeFileSync('src/app/App.tsx', code);
