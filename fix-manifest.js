const fs = require('fs');

const manifestPath = './web-build/manifest.json';

if (fs.existsSync(manifestPath)) {
  let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  manifest.start_url = '/Oberraut/';

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ Manifest start_url wurde korrigiert.');
} else {
  console.error('❌ Manifest-Datei nicht gefunden.');
}
