// Create a simple canvas icon programmatically
const canvas = document.createElement('canvas');
canvas.width = 128;
canvas.height = 128;
const ctx = canvas.getContext('2d');

// Draw a simple "KA" icon
ctx.fillStyle = '#1865f2';  // Khan Academy blue
ctx.fillRect(0, 0, 128, 128);
ctx.font = 'bold 64px Arial';
ctx.fillStyle = 'white';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('KA', 64, 64);

// Convert to base64 and download
const base64 = canvas.toDataURL('image/png');
console.log(base64);  // Use this to create icon files 