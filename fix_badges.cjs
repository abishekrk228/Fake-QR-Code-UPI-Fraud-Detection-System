const fs = require('fs');
let code = fs.readFileSync('src/app/App.tsx', 'utf8');

// Replace all exact matches of the bug
code = code.replace(/}\[status\];\n  const Icon = config\.icon;/g, '}[status] || { cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertTriangle };\n  const Icon = config.icon;');

fs.writeFileSync('src/app/App.tsx', code);
