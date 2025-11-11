import { writeFileSync } from 'fs';
import { join } from 'path';

// Create package.json in build folder with type: module
const buildPackageJson = {
  type: 'module'
};

const buildPath = join(process.cwd(), 'build', 'package.json');

try {
  writeFileSync(buildPath, JSON.stringify(buildPackageJson, null, 2));
  console.log('[SUCCESS] Created build/package.json with type: module');
} catch (error) {
  console.error('[ERROR] Failed to create build/package.json:', error);
  process.exit(1);
}
