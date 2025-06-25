#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Path to the gemini-live-client.ts file
const geminiClientPath = path.join(process.cwd(), 'packages', 'gemini-live-client', 'src', 'gemini-live-client.ts');

// Read the file
console.log(`Reading file: ${geminiClientPath}`);
const content = fs.readFileSync(geminiClientPath, 'utf8');

// Fix the WebSocket URL to use the correct format
const updatedContent = content.replace(
    'private static readonly DEFAULT_GEMINI_BIDI_SERVER = \'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent\';',
    'private static readonly DEFAULT_GEMINI_BIDI_SERVER = \'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent\';'
);

// Fix the model name handling
const updatedContent2 = updatedContent.replace(
    'this.options.setup.model = this.options.setup.model || this.options.primaryModel;',
    'this.options.setup.model = (this.options.setup.model || this.options.primaryModel || "").replace("models/", "");'
);

// Write the updated content back to the file
fs.writeFileSync(geminiClientPath, updatedContent2);
console.log(`✅ Updated Gemini client to handle model names correctly`);

// Now rebuild the package
console.log(`Rebuilding gemini-live-client package...`);
const packageJsonPath = path.join(process.cwd(), 'packages', 'gemini-live-client', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

console.log(`Package version: ${packageJson.version}`);
console.log(`✅ Fix complete. Restart the server to apply changes.`);