const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

(async () => {
  const src = path.join(__dirname, '..', 'assets', 'images', 'logo.png');
  const outDir = path.join(__dirname, '..', 'assets', 'icons');
  const outFile = path.join(outDir, 'icon.ico');

  if (!fs.existsSync(src)) {
    console.error(`Source PNG not found: ${src}`);
    process.exit(1);
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    const buffer = await pngToIco(src);
    fs.writeFileSync(outFile, buffer);
    console.log(`Generated icon: ${outFile}`);
  } catch (err) {
    console.error('Failed to generate .ico from PNG:', err);
    process.exit(1);
  }
})();