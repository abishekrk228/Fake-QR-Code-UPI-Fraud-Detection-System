const fs = require('fs');
let code = fs.readFileSync('src/app/App.tsx', 'utf8');

const dynamicApi = 'const API_BASE = (window as any).Capacitor?.isNative ? "http://192.168.29.195:5000/api" : "/api";';

code = code.replace(/(import .*;\n)+/, (match) => match + '\n' + dynamicApi + '\n\n');

code = code.replace(/\"\/api\/scan\"/g, '\`${API_BASE}/scan\`');
code = code.replace(/\"\/api\/history\"/g, '\`${API_BASE}/history\`');
code = code.replace(/\"\/api\/merchants\"/g, '\`${API_BASE}/merchants\`');
code = code.replace(/\"\/api\/dashboard\"/g, '\`${API_BASE}/dashboard\`');

fs.writeFileSync('src/app/App.tsx', code);
