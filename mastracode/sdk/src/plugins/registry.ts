import fs from 'node:fs';
import path from 'node:path';

import type {
  InstalledPiPackageMetadata,
  InstalledPluginRecord,
  PiPackageResourceManifest,
  PiPackageResolution,
  PluginRegistry,
  ScopedInstalledPluginRecord,
} from './types.js';

export const EMPTY_PLUGIN_REGISTRY: PluginRegistry = { plugins: {}, disabledPlugins: [] };

export function loadPluginRegistry(registryPath: string): PluginRegistry {
  try {
    if (!fs.existsSync(registryPath)) return { plugins: {}, disabledPlugins: [] };
    const raw = JSON.parse(fs.readFileSync(registryPath, 'utf-8')) as unknown;
    return validatePluginRegistry(raw);
  } catch {
    return { plugins: {}, disabledPlugins: [] };
  }
}

export function savePluginRegistry(registryPath: string, registry: PluginRegistry): void {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  const temporaryPath = `${registryPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(validatePluginRegistry(registry), null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporaryPath, registryPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function mergePluginRegistries(
  globalRegistry: PluginRegistry,
  projectRegistry: PluginRegistry,
): ScopedInstalledPluginRecord[] {
  const merged = new Map<string, ScopedInstalledPluginRecord>();
  const disabledPlugins = new Set([
    ...(globalRegistry.disabledPlugins ?? []),
    ...(projectRegistry.disabledPlugins ?? []),
  ]);

  for (const [id, record] of Object.entries(globalRegistry.plugins)) {
    merged.set(id, { id, scope: 'global', ...record });
  }

  for (const [id, record] of Object.entries(projectRegistry.plugins)) {
    merged.set(id, { id, scope: 'project', ...record });
  }

  return [...merged.values()]
    .map(record => (disabledPlugins.has(record.id) ? { ...record, blocked: true } : record))
    .sort((a, b) => {
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
    disabledPlugins: registry.disabledPlugins ?? [],
  };
}

export function removePluginRecord(registry: PluginRegistry, pluginId: string): PluginRegistry {
  const plugins = { ...registry.plugins };
  delete plugins[pluginId];
  return { plugins, disabledPlugins: registry.disabledPlugins ?? [] };
}

function validatePluginRegistry(raw: unknown): PluginRegistry {
  if (!raw || typeof raw !== 'object') return { plugins: {}, disabledPlugins: [] };
  const plugins = (raw as { plugins?: unknown }).plugins;
  if (!plugins || typeof plugins !== 'object' || Array.isArray(plugins)) return { plugins: {}, disabledPlugins: [] };

  const disabledPlugins = (raw as { disabledPlugins?: unknown }).disabledPlugins;
  const validated: PluginRegistry = {
    plugins: {},
    disabledPlugins: Array.isArray(disabledPlugins)
      ? [...new Set(disabledPlugins.filter((pluginId): pluginId is string => typeof pluginId === 'string'))].sort()
      : [],
  };
  for (const [id, value] of Object.entries(plugins)) {
    if (typeof id !== 'string' || id.trim().length === 0) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (typeof record.enabled !== 'boolean') continue;
    if (record.source !== 'local' && record.source !== 'github' && record.source !== 'pi-package') continue;
    if (typeof record.specifier !== 'string') continue;
    if (typeof record.path !== 'string') continue;
    if (typeof record.entry !== 'string') continue;
    const piPackage = record.source === 'pi-package' ? validatePiPackageMetadata(record.piPackage) : undefined;
    if (record.source === 'pi-package' && (record.compatibility !== 'pi' || !piPackage)) continue;

    validated.plugins[id] = {
      enabled: record.enabled,
      source: record.source,
      ...(record.compatibility === 'pi' ? { compatibility: record.compatibility } : {}),
      specifier: record.specifier,
      path: record.path,
      entry: record.entry,
      ...(Array.isArray(record.entries)
        ? { entries: [...new Set(record.entries.filter((entry): entry is string => typeof entry === 'string'))].sort() }
        : {}),
      ...(typeof record.ref === 'string' ? { ref: record.ref } : {}),
      ...(typeof record.version === 'string' ? { version: record.version } : {}),
      ...(record.config && typeof record.config === 'object' && !Array.isArray(record.config)
        ? { config: validatePluginConfigValues(record.config) }
        : {}),
      ...(piPackage ? { piPackage } : {}),
    };
  }

  return validated;
}

function validatePiPackageMetadata(raw: unknown): InstalledPiPackageMetadata | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const resolution = validatePiPackageResolution(record.resolution);
  const resources = validatePiPackageResources(record.resources);
  const compatibilityReport = validatePiCompatibilityReport(record.compatibilityReport);
  const trust = record.trust;
  if (
    !resolution ||
    !resources ||
    !compatibilityReport ||
    typeof record.targetApiVersion !== 'string' ||
    !trust ||
    typeof trust !== 'object' ||
    Array.isArray(trust)
  ) {
    return undefined;
  }
  const trustRecord = trust as Record<string, unknown>;
  const pendingCleanup = validatePendingPiPackageCleanup(record.pendingCleanup);
  if (record.pendingCleanup !== undefined && !pendingCleanup) return undefined;
  if (
    trustRecord.codeExecution !== 'trusted' ||
    (trustRecord.project !== 'trusted' && trustRecord.project !== 'not-required') ||
    (trustRecord.installScripts !== 'allow' && trustRecord.installScripts !== 'deny')
  ) {
    return undefined;
  }
  return {
    resolution,
    resources,
    targetApiVersion: record.targetApiVersion,
    ...(typeof record.observedApiVersion === 'string' ? { observedApiVersion: record.observedApiVersion } : {}),
    compatibilityReport,
    trust: {
      codeExecution: 'trusted',
      project: trustRecord.project,
      installScripts: trustRecord.installScripts,
    },
    ...(pendingCleanup ? { pendingCleanup } : {}),
  };
}

function validatePendingPiPackageCleanup(raw: unknown): { paths: string[]; error: string } | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (
    !Array.isArray(record.paths) ||
    record.paths.length === 0 ||
    record.paths.some(entry => typeof entry !== 'string' || !isSafeOwnedRegistryPath(entry)) ||
    typeof record.error !== 'string' ||
    record.error.length === 0
  ) {
    return undefined;
  }
  return { paths: [...new Set(record.paths as string[])].sort(), error: record.error };
}

function validatePiPackageResolution(raw: unknown): PiPackageResolution | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (
    (record.sourceType !== 'npm' && record.sourceType !== 'git' && record.sourceType !== 'local') ||
    typeof record.resolvedSpecifier !== 'string' ||
    typeof record.sourceRoot !== 'string' ||
    !isSafeOwnedRegistryPath(record.sourceRoot) ||
    typeof record.packageRoot !== 'string' ||
    !isSafeOwnedRegistryPath(record.packageRoot) ||
    typeof record.integrity !== 'string' ||
    !record.integrity.startsWith('sha512-') ||
    typeof record.contentIntegrity !== 'string' ||
    !record.contentIntegrity.startsWith('sha512-') ||
    typeof record.materializedIntegrity !== 'string' ||
    !record.materializedIntegrity.startsWith('sha512-')
  ) {
    return undefined;
  }
  return {
    sourceType: record.sourceType,
    resolvedSpecifier: record.resolvedSpecifier,
    sourceRoot: record.sourceRoot,
    packageRoot: record.packageRoot,
    integrity: record.integrity,
    contentIntegrity: record.contentIntegrity,
    materializedIntegrity: record.materializedIntegrity,
    ...(typeof record.version === 'string' ? { version: record.version } : {}),
    ...(typeof record.commit === 'string' ? { commit: record.commit } : {}),
  };
}

function validatePiPackageResources(raw: unknown): PiPackageResourceManifest | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const result = {} as PiPackageResourceManifest;
  for (const resourceType of ['extensions', 'skills', 'prompts', 'themes'] as const) {
    const entries = record[resourceType];
    if (!Array.isArray(entries) || entries.some(entry => typeof entry !== 'string')) return undefined;
    result[resourceType] = [...new Set(entries as string[])].sort();
  }
  return result;
}

function validatePiCompatibilityReport(raw: unknown): InstalledPiPackageMetadata['compatibilityReport'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  if (
    typeof record.targetApiVersion !== 'string' ||
    (record.status !== 'pi-compatible' && record.status !== 'pi-partial' && record.status !== 'pi-incompatible') ||
    !Array.isArray(record.capabilities) ||
    !Array.isArray(record.diagnostics)
  ) {
    return undefined;
  }
  const capabilities = record.capabilities.flatMap(capability => {
    if (!capability || typeof capability !== 'object' || Array.isArray(capability)) return [];
    const value = capability as Record<string, unknown>;
    if (
      typeof value.name !== 'string' ||
      (value.support !== 'direct' &&
        value.support !== 'adapted' &&
        value.support !== 'version-gated' &&
        value.support !== 'unsupported') ||
      !Array.isArray(value.evidence) ||
      !Array.isArray(value.diagnostics)
    ) {
      return [];
    }
    const evidence = value.evidence.flatMap(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const evidenceRecord = item as Record<string, unknown>;
      if (typeof evidenceRecord.source !== 'string') return [];
      return [
        {
          source: evidenceRecord.source,
          ...(typeof evidenceRecord.detail === 'string' ? { detail: evidenceRecord.detail } : {}),
        },
      ];
    });
    return [
      {
        name: value.name,
        support: value.support as InstalledPiPackageMetadata['compatibilityReport']['capabilities'][number]['support'],
        evidence,
        diagnostics: validatePiDiagnostics(value.diagnostics),
      },
    ];
  });
  return {
    targetApiVersion: record.targetApiVersion as InstalledPiPackageMetadata['compatibilityReport']['targetApiVersion'],
    status: record.status,
    capabilities,
    diagnostics: validatePiDiagnostics(record.diagnostics),
  };
}

function validatePiDiagnostics(raw: unknown[]): InstalledPiPackageMetadata['compatibilityReport']['diagnostics'] {
  return raw.flatMap(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (
      (record.severity !== 'info' && record.severity !== 'warning' && record.severity !== 'error') ||
      typeof record.message !== 'string'
    ) {
      return [];
    }
    return [
      {
        severity: record.severity,
        message: record.message,
        ...(typeof record.capability === 'string' ? { capability: record.capability } : {}),
        ...(typeof record.extensionId === 'string' ? { extensionId: record.extensionId } : {}),
      },
    ];
  });
}

function isSafeOwnedRegistryPath(storedPath: string): boolean {
  const normalized = path.normalize(storedPath);
  return !path.isAbsolute(storedPath) && normalized !== '..' && !normalized.startsWith(`..${path.sep}`);
}

function validatePluginConfigValues(raw: object): Record<string, string | boolean> {
  const values: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || key.trim().length === 0) continue;
    if (typeof value === 'string' || typeof value === 'boolean') values[key] = value;
  }
  return values;
}
