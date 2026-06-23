import * as path from 'path';
import { setupAI } from './ai-setup';

const ownRoot = path.resolve(__dirname, '..');
const projectRoot = process.env.INIT_CWD;

// Skip when running npm install inside the package itself (development)
if (!projectRoot || path.resolve(projectRoot) === ownRoot) {
  process.exit(0);
}

try {
  setupAI(projectRoot);
} catch {
  // Never break the consumer's install
  process.exit(0);
}
