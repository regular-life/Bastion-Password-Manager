import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Copy libsodium-wrappers to extension directory
const sodiumSource = path.join(__dirname, '../node_modules/libsodium-wrappers/dist/browsers/libsodium-wrappers.js');
const sodiumDest = path.join(__dirname, 'libsodium-wrappers.js');

try {
  if (fs.existsSync(sodiumSource)) {
    fs.copyFileSync(sodiumSource, sodiumDest);
    console.log('Copied libsodium-wrappers.js');
  }
} catch (err) {
  console.error('Failed to copy libsodium:', err);
}

// Create placeholder icons
function createPlaceholderIcon(size, filename) {
  // Create a simple SVG icon
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#4CAF50"/>
  <text x="50%" y="50%" font-family="Arial" font-size="${size * 0.5}" fill="white" text-anchor="middle" dominant-baseline="middle">SV</text>
</svg>`;

  fs.writeFileSync(path.join(__dirname, filename), svg);
  console.log(`Created ${filename}`);
}

createPlaceholderIcon(16, 'icon16.png');
createPlaceholderIcon(48, 'icon48.png');
createPlaceholderIcon(128, 'icon128.png');

console.log('Extension build complete!');
