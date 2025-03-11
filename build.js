const fs = require('fs');
const path = require('path');

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Files to copy
const files = [
  { src: 'src/content.js', dest: 'dist/content.js' },
  { src: 'src/popup.js', dest: 'dist/popup.js' },
  { src: 'src/background.js', dest: 'dist/background.js' },
  { src: 'src/content.css', dest: 'dist/content.css' },
  { src: 'popup.html', dest: 'dist/popup.html' },
  { src: 'manifest.json', dest: 'dist/manifest.json' },
  { src: 'icon.png', dest: 'dist/icon.png' }
];

// Copy each file
files.forEach(file => {
  try {
    fs.copyFileSync(file.src, file.dest);
    console.log(`Copied ${file.src} to ${file.dest}`);
  } catch (error) {
    console.error(`Error copying ${file.src}:`, error);
  }
}); 