#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getAppDataDir } from '@mastra/code-sdk/utils/project';

const SETTINGS_PATH = process.env.MASTRACODE_SETTINGS_PATH || join(getAppDataDir(), 'settings.json');
const PROVIDER_NAME = 'Render Smoke';
const PROVIDER_URL = process.env.RENDER_SMOKE_URL || 'http://localhost:8787/v1';
const PROVIDER_API_KEY = process.env.RENDER_SMOKE_API_KEY || 'test';
const MODEL_ID = 'render-smoke';
const PACK_MODEL_ID = `${MODEL_ID}/${MODEL_ID}`;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function readSettings() {
  if (!existsSync(SETTINGS_PATH)) return {};
  return JSON.parse(await readFile(SETTINGS_PATH, 'utf8'));
}

async function backupSettingsIfPresent() {
  if (!existsSync(SETTINGS_PATH)) return null;
  const backupPath = `${SETTINGS_PATH}.backup-render-smoke-${timestamp()}`;
  await copyFile(SETTINGS_PATH, backupPath);
  return backupPath;
}

function addRenderSmokeProvider(settings) {
  settings.customProviders ??= [];
  const existing = settings.customProviders.find(provider => provider?.name === PROVIDER_NAME);
  if (existing) {
    let changed = false;
    if (existing.url !== PROVIDER_URL) {
      existing.url = PROVIDER_URL;
      changed = true;
    }
    if (existing.apiKey !== PROVIDER_API_KEY) {
      existing.apiKey = PROVIDER_API_KEY;
      changed = true;
    }
    if (!Array.isArray(existing.models)) {
      existing.models = [MODEL_ID];
      changed = true;
    } else if (!existing.models.includes(MODEL_ID)) {
      existing.models.push(MODEL_ID);
      changed = true;
    }
    return changed;
  }

  settings.customProviders.push({
    name: PROVIDER_NAME,
    url: PROVIDER_URL,
    apiKey: PROVIDER_API_KEY,
    models: [MODEL_ID],
  });
  return true;
}

function addRenderSmokePack(settings) {
  settings.customModelPacks ??= [];
  const existing = settings.customModelPacks.find(pack => pack?.name === PROVIDER_NAME);
  if (existing) {
    const nextModels = { build: PACK_MODEL_ID, plan: PACK_MODEL_ID, fast: PACK_MODEL_ID };
    if (JSON.stringify(existing.models) === JSON.stringify(nextModels)) return false;
    existing.models = nextModels;
    return true;
  }

  settings.customModelPacks.push({
    name: PROVIDER_NAME,
    models: {
      build: PACK_MODEL_ID,
      plan: PACK_MODEL_ID,
      fast: PACK_MODEL_ID,
    },
    createdAt: new Date().toISOString(),
  });
  return true;
}

const before = await readSettings();
const settings = structuredClone(before);
const providerChanged = addRenderSmokeProvider(settings);
const packChanged = addRenderSmokePack(settings);
const changed = providerChanged || packChanged;

if (!changed) {
  console.log(`Render Smoke settings already installed at ${SETTINGS_PATH}`);
  console.log('No changes made.');
  process.exit(0);
}

await mkdir(dirname(SETTINGS_PATH), { recursive: true });
const backupPath = await backupSettingsIfPresent();
await writeFile(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);

console.log(`Installed Render Smoke settings at ${SETTINGS_PATH}`);
if (backupPath) console.log(`Backup written to ${backupPath}`);
console.log('Preserved existing activeModelPackId and modeDefaults.');
console.log(`Provider: ${PROVIDER_NAME} -> ${PROVIDER_URL}`);
console.log(`Model pack: custom:${PROVIDER_NAME} (${PACK_MODEL_ID})`);
