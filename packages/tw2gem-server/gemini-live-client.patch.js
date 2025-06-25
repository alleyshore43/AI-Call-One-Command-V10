// This is a patch for the GeminiLiveClient class to fix the isReady property
// We'll use this to modify the compiled JavaScript file

const fs = require('fs');
const path = require('path');

// Path to the compiled JavaScript file
const filePath = path.join(__dirname, 'node_modules', '@tw2gem', 'gemini-live-client', 'dist', 'gemini-live-client.js');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Add initialization for isReady property
content = content.replace(
  'this.socket;',
  'this.socket;\n        this.isReady = false;'
);

// Write the file back
fs.writeFileSync(filePath, content);

console.log('Patched GeminiLiveClient class successfully');