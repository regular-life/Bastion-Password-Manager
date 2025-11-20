const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function removeDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        console.log(`Removing ${dirPath}...`);
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
}

const rootDir = path.join(__dirname, '..');

console.log('🧹 Cleaning up...');

// Remove node_modules
removeDir(path.join(rootDir, 'node_modules'));
removeDir(path.join(rootDir, 'backend/node_modules'));
removeDir(path.join(rootDir, 'frontend/node_modules'));
removeDir(path.join(rootDir, 'electron/node_modules'));
removeDir(path.join(rootDir, 'extension/node_modules'));
removeDir(path.join(rootDir, 'shared/node_modules'));

// Remove build artifacts
removeDir(path.join(rootDir, 'frontend/dist'));
removeDir(path.join(rootDir, 'extension/dist'));

console.log('✨ Clean complete!');
