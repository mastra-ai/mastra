import fs from 'node:fs';
import path from 'node:path';

import type { InstalledPluginRecord, PluginRegistry, ScopedInstalledPluginRecord } from './types.js';

export const EMPTY_PLUGIN_REGISTRY: PluginRegistry = { plugins: {} };

export function loadPluginRegistry(registryPath: string): PluginRegistry {
  try {
    if (!fs.existsSync(registryPath)) return { plugins: {} };
    const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as unknown;
    return validatePluginRegistry(raw);
  } catch {
    return { plugins: {} };
  }
}

export function savePluginRegistry(registryPath: string, registry: PluginRegistry): void {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify(validatePluginRegistry(registry), null, 2)}\n`);
}

export function mergePluginRegistries(
  globalRegistry: PluginRegistry,
  projectRegistry: PluginRegistry,
): ScopedInstalledPluginRecord[] {
  const merged = new Map<string, ScopedInstalledPluginRecord>();

  for (const [id, record] of Object.entries(globalRegistry.plugins)) {
    merged.set(id, { id, scope: 'global', ...record });
  }

  for (const [id, record] of Object.entries(projectRegistry.plugins)) {
    merged.set(id, { id, scope: 'project', ...record });
  }

  return [...merged.values()].sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === 'project' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

export function setPluginRecord(
  registry: PluginRegistry,
  pluginId: string,
  record: InstalledPluginRecord,
): PluginRegistry {
  return {
    plugins: {
      ...registry.plugins,
      [pluginId]: record,
    },
  };
}

export function removePluginRecord(registry: PluginRegistry, pluginId: string): PluginRegistry {
  const plugins = { ...registry.plugins };
  delete plugins[pluginId];
  return { plugins };
}

function validatePluginRegistry(raw: unknown): PluginRegistry {
  if (!raw || typeof raw !== 'object') return { plugins: {} };
  const plugins = (raw as { plugins?: unknown }).plugins;
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) return { plugins: {} };

  const validated: PluginRegistry = { plugins: {} };
  for (const [id, value] of Object.entries(plugins)) {
    if (typeof id !== 'string' || id.trim().length === 0) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (typeof record.enabled !== 'boolean') continue;
    if (record.source !== 'local' && record.source !== 'github') continue;
    if (typeof record.specifier !== 'string') continue;
    if (typeof record.path !== 'string') continue;
    if (typeof record.entry !== 'string') continue;

    validated.plugins[id] = {
      enabled: record.enabled,
      source: record.source,
      specifier: record.specifier,
      path: record.path,
      entry: record.entry,
      ...(typeof record.ref === 'string' ? { ref: record.ref } : {}),
      ...(typeof record.version === 'string' ? { version: record.version } : {}),
    };
  }

  return validated;
}
