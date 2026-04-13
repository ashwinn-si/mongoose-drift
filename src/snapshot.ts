import * as fs from 'fs';
import * as path from 'path';
import { SchemaSnapshot, SchemaSnapshotSchema } from './types';
import { extractSchemas } from './extractor';

const DRIFT_DIR = '.mongoose-drift';

function ensureDriftDir(project: string): string {
  const driftPath = path.resolve(process.cwd(), DRIFT_DIR, project);
  if (!fs.existsSync(driftPath)) {
    fs.mkdirSync(driftPath, { recursive: true });
    console.log(`✔ Created ${DRIFT_DIR}/${project}/ directory`);
  }
  return driftPath;
}

export async function saveSnapshot(options: {
  version: string;
  modelsPath?: string;
  project: string;
}): Promise<SchemaSnapshot> {
  const { version, project } = options;
  let modelsPath = options.modelsPath;

  if (!modelsPath) {
    modelsPath = loadConfig(project).modelsPath;
  }

  const collections = await extractSchemas(modelsPath!);
  const snapshot: SchemaSnapshot = {
    version,
    createdAt: new Date().toISOString(),
    modelsPath,
    collections,
  };

  const driftDir = ensureDriftDir(project);
  const filePath = path.join(driftDir, `${version}.json`);

  if (fs.existsSync(filePath)) {
    throw new Error(
      `Snapshot ${version} already exists. Use a different version or delete the existing snapshot.`
    );
  }

  SchemaSnapshotSchema.parse(snapshot);

  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  console.log(`✔ Snapshot saved: .mongoose-drift/${project}/${version}.json`);

  return snapshot;
}

export async function loadSnapshot(
  version: string,
  project: string,
  modelsPath?: string
): Promise<SchemaSnapshot> {
  if (version === 'HEAD') {
    if (!modelsPath) {
      modelsPath = loadConfig(project).modelsPath;
    }
    const collections = await extractSchemas(modelsPath);
    return {
      version: 'HEAD',
      createdAt: new Date().toISOString(),
      modelsPath,
      collections,
    };
  }

  const driftDir = path.resolve(process.cwd(), DRIFT_DIR, project);
  const filePath = path.join(driftDir, `${version}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Snapshot not found: ${version}. Run 'mongoose-drift log -p ${project}' to see all snapshots.`);
  }

  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  try {
     return SchemaSnapshotSchema.parse(rawData);
  } catch (err: any) {
     throw new Error(`Snapshot ${version} is corrupted: ${err.message}`);
  }
}

export function listSnapshots(project: string): string[] {
  const driftDir = path.resolve(process.cwd(), DRIFT_DIR, project);

  if (!fs.existsSync(driftDir)) {
    return [];
  }

  return fs
    .readdirSync(driftDir)
    .filter(f => f.endsWith('.json') && f !== 'config.json')
    .map(f => f.replace('.json', ''))
    .sort();
}

function loadConfig(project: string): { modelsPath: string } {
  const configPath = path.resolve(process.cwd(), DRIFT_DIR, project, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found. Run 'mongoose-drift init --models <path> -p ${project}' first.`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export function saveConfig(modelsPath: string, project: string): void {
  const driftDir = ensureDriftDir(project);
  const configPath = path.join(driftDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ modelsPath }, null, 2));
  console.log(`✔ Config saved: .mongoose-drift/${project}/config.json`);
}
