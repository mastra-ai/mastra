import fs from 'node:fs';
import path from 'node:path';

export const PLUGIN_MANIFEST_FILE = '.mastracode-plugin.json';

export type PluginManifestEntry = {
  id: string;
  name?: string;
  entry: string;
};

export type PluginManifest = {
  plugins: PluginManifestEntry[];
};

export function loadPluginManifest(rootDir: string): PluginManifest | undefined {
  const manifestPath = path.join(rootDir, PLUGIN_MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Could not parse ${PLUGIN_MANIFEST_FILE}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { plugins?: unknown }).plugins)) {
    throw new Error(`${PLUGIN_MANIFEST_FILE} must contain a plugins array`);
  }

  return {
    plugins: (parsed as { plugins: unknown[] }).plugins.map((entry, index) => validateManifestEntry(entry, index)),
  };
}

export function savePluginManifest(rootDir: string, manifest: PluginManifest): void {
  fs.writeFileSync(path.join(rootDir, PLUGIN_MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
}

export function upsertPluginManifestEntry(rootDir: string, entry: PluginManifestEntry): void {
  const manifest = loadPluginManifest(rootDir) ?? { plugins: [] };
  const validatedEntry = validateManifestEntry(entry, manifest.plugins.length);
  const existingIndex = manifest.plugins.findIndex(plugin => plugin.id === validatedEntry.id);
  if (existingIndex >= 0) {
    manifest.plugins[existingIndex] = validateManifestEntry(validatedEntry, existingIndex);
  } else {
    manifest.plugins.push(validatedEntry);
  }
  savePluginManifest(rootDir, manifest);
}

export function getSingleManifestPlugin(rootDir: string): PluginManifestEntry | undefined {
  const manifest = loadPluginManifest(rootDir);
  if (!manifest) return undefined;
  if (manifest.plugins.length === 0) return undefined;
  if (manifest.plugins.length > 1) {
    throw new Error(
      `${PLUGIN_MANIFEST_FILE} contains multiple plugins. Provide an entry path for one of: ${manifest.plugins
        .map(plugin => `${plugin.id} (${plugin.entry})`)
        .join(', ')}`,
    );
  }
  return manifest.plugins[0];
}

function validateManifestEntry(entry: unknown, index: number): PluginManifestEntry {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`${PLUGIN_MANIFEST_FILE} plugin at index ${index} must be an object`);
  }
  const candidate = entry as { id?: unknown; name?: unknown; entry?: unknown };
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    throw new Error(`${PLUGIN_MANIFEST_FILE} plugin at index ${index} must include an id`);
  }
  if (typeof candidate.entry !== 'string' || candidate.entry.length === 0) {
    throw new Error(`${PLUGIN_MANIFEST_FILE} plugin ${candidate.id} must include an entry`);
  }
  if (candidate.name !== undefined && typeof candidate.name !== 'string') {
    throw new Error(`${PLUGIN_MANIFEST_FILE} plugin ${candidate.id} name must be a string`);
  }
  return {
    id: candidate.id,
    entry: candidate.entry,
    ...(candidate.name ? { name: candidate.name } : {}),
  };
}
