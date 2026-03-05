/**
 * Generate placeholder PNG icons for the Chrome extension
 * This creates simple colored squares as temporary icons
 */

const fs = require('fs');
const path = require('path');

// Simple 1x1 PNG data (transparent)
// We'll create a minimal valid PNG for each size
const sizes = [16, 32, 48, 128];

// Helper to create a simple colored PNG
function createSimplePNG(size, color = '#7C3AED') {
  // This creates a minimal valid PNG with a solid color
  // For a proper implementation, you'd use a library like 'pngjs' or 'sharp'
  // But for quick placeholder, we'll create a minimal structure
  
  const canvas = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${color}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${size * 0.4}" font-family="Arial, sans-serif" font-weight="bold">M</text>
</svg>`;
  
  return canvas;
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Generating placeholder icons...\n');

sizes.forEach(size => {
  const svgContent = createSimplePNG(size);
  const svgPath = path.join(iconsDir, `icon${size}.svg`);
  fs.writeFileSync(svgPath, svgContent);
  console.log(`✅ Created icon${size}.svg (${size}x${size})`);
});

console.log('\n⚠️  SVG icons created. For Chrome extension, you need PNG files.');
console.log('Options:');
console.log('1. Use an online converter: https://cloudconvert.com/svg-to-png');
console.log('2. Install sharp: npm install sharp --save-dev');
console.log('3. Use the manifest without icons (Chrome will show default icon)');
console.log('\nTo use without icons, update manifest.json to remove icon references.');
