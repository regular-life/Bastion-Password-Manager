const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runCommand(command, cwd = process.cwd()) {
    console.log(`> ${command}`);
    try {
        execSync(command, { stdio: 'inherit', cwd });
    } catch (error) {
        console.error(`Command failed: ${command}`);
        process.exit(1);
    }
}

console.log('🚀 Setting up Bastion Password Manager...');

// 1. Install dependencies
console.log('\n📦 Installing dependencies...');
runCommand('npm install');

// 2. Setup Database
console.log('\n🗄️  Setting up database...');
try {
    // Check if database exists
    try {
        execSync('psql -lqt | cut -d \\| -f 1 | grep -qw bastion');
        console.log('Database "bastion" already exists.');
    } catch (e) {
        console.log('Creating database "bastion"...');
        runCommand('createdb bastion');
    }
} catch (error) {
    console.warn('⚠️  Database setup failed. Make sure PostgreSQL is installed and running.');
    console.warn('You may need to run "createdb bastion" manually.');
}

// 3. Build Extension
console.log('\n🧩 Building browser extension...');
runCommand('npm run build', path.join(__dirname, '../extension'));

console.log('\n✅ Setup complete!');
console.log('\nTo start the application:');
console.log('  npm run dev:backend');
console.log('  npm run dev:frontend');
console.log('  npm run dev:electron');
