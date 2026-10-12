const fs = require('fs');
let code = fs.readFileSync('src/app/App.tsx', 'utf8');

// Replace the API_BASE check with a more robust one
code = code.replace(
  /const API_BASE = .*?;/,
  'import { Capacitor } from "@capacitor/core";\nconst API_BASE = Capacitor.isNativePlatform() ? "http://192.168.29.195:5000/api" : "/api";'
);

fs.writeFileSync('src/app/App.tsx', code);
