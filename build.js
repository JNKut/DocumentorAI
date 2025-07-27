const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting build process...');

// Build frontend
console.log('Building frontend...');
execSync('npm run build:frontend', { stdio: 'inherit' });

// Build backend
console.log('Building backend...');
execSync('npm run build:backend', { stdio: 'inherit' });

// Ensure dist directory structure
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

console.log('Build completed successfully!');