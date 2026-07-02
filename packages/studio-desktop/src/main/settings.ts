import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeEnvironmentVariables } from '../shared/environment-variables';
import type { DesktopSettings } from '../shared/types';
import { DEFAULT_SETTINGS } from './defaults';
import { normalizeServerUrl } from './url';

function cleanOptionalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function cleanRequired(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function cleanUrl(value: unknown, fallback: string): string {
  const source = cleanRequired(value, fallback);
  try {
    return normalizeServerUrl(source);
  } catch {
    return fallback;
  }
}

export function normalizeSettings(value: unknown): DesktopSettings {
  const source = typeof value === 'object' && value !== null ? (value as Partial<DesktopSettings>) : {};
  const externalServerUrl = cleanOptionalUrl(source.externalServerUrl);
  return {
    version: 3,
    serverMode: source.serverMode === 'external' ? 'external' : 'managed',
    externalServerUrl,
    devServerUrl: cleanUrl(source.devServerUrl ?? externalServerUrl, DEFAULT_SETTINGS.devServerUrl),
    platformBaseUrl: cleanUrl(source.platformBaseUrl, DEFAULT_SETTINGS.platformBaseUrl),
    platformOrganizationId: cleanOptionalUrl(source.platformOrganizationId),
    modelUrl: cleanUrl(source.modelUrl, DEFAULT_SETTINGS.modelUrl),
    modelId: cleanRequired(source.modelId, DEFAULT_SETTINGS.modelId),
    modelApiKey: cleanRequired(source.modelApiKey, DEFAULT_SETTINGS.modelApiKey),
    environmentVariables: normalizeEnvironmentVariables(source.environmentVariables),
  };
}

export async function readSettings(settingsPath: string): Promise<DesktopSettings> {
  try {
    const raw = await readFile(settingsPath, 'utf8');
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...DEFAULT_SETTINGS };
    }
    throw error;
  }
}

export async function writeSettings(settingsPath: string, settings: DesktopSettings): Promise<DesktopSettings> {
  const normalized = normalizeSettings(settings);
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

export async function updateSettings(
  settingsPath: string,
  updates: Partial<DesktopSettings>,
): Promise<DesktopSettings> {
  const current = await readSettings(settingsPath);
  return writeSettings(settingsPath, normalizeSettings({ ...current, ...updates }));
}
