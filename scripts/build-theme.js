import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file to get theme name
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const themeMatch = envContent.match(/VITE_THEME_NAME="([^"]+)"/);
const themeName = themeMatch ? themeMatch[1] : 'default';

console.log(`[BUILD] Building with theme: ${themeName}`);

const themesDir = path.resolve(__dirname, '../build/client/themes');
const themeSourceDir = path.resolve(__dirname, '../static/themes', themeName);

// Check if themes directory exists
if (fs.existsSync(themesDir)) {
  const allThemes = fs.readdirSync(themesDir);
  
  // Remove all themes except the selected one
  allThemes.forEach(theme => {
    if (theme !== themeName) {
      const themePath = path.join(themesDir, theme);
      console.log(`[REMOVE] Removing unused theme: ${theme}`);
      fs.rmSync(themePath, { recursive: true, force: true });
    }
  });
  
  console.log(`[SUCCESS] Build includes only theme: ${themeName}`);
} else {
  console.log('[WARN] No themes directory found in build output');
}
