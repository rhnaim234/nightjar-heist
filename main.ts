// Nightjar: Midnight Architectural Heist — make.fun program/v1 hand-in entrypoint (Node 22).
// Copies static game files and screenshots to MAKEFUN_OUTPUT_DIR (or /output), enforces
// world-readable permissions, and generates deterministic /output/dossier.json.

import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

function ensureReadableTree(dirPath: string): void {
  if (!existsSync(dirPath)) return;
  chmodSync(dirPath, 0o755);
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      ensureReadableTree(fullPath);
    } else {
      chmodSync(fullPath, 0o644);
    }
  }
}

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
chmodSync(outDir, 0o755);

const gameDest = join(outDir, 'game');
cpSync(join(here, 'game'), gameDest, { recursive: true });
ensureReadableTree(gameDest);

const shotsDest = join(outDir, 'screenshots');
mkdirSync(shotsDest, { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), shotsDest, { recursive: true });
}
ensureReadableTree(shotsDest);

const dossierPath = join(outDir, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
chmodSync(dossierPath, 0o644);
