#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getAppDataDir } from '@mastra/code-sdk/utils/project';

const SETTINGS_PATH = process.env.MASTRACODE_SETTINGS_PATH || join(getAppDataDir(), 'settings.json');
const PROVIDER_NAME = 'Render Smoke';
const ACTIVE_PACK_ID = `custom:${PROVIDER_NAME}`;
const MODEL_ID = 'render-smoke';
const PACK_MODEL_ID = `${MODEL_ID}/${MODEL_ID}`;
const FORCE = process.env.RENDER_SMOKE_UNINSTALL_FORCE === '1';

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function readSettings() {
  if (!existsSync(SETTINGS_PATH)) return null;
  return JSON.parse(await readFile(SETTINGS_PATH, 'utf8'));
}

async function backupSettings() {
  const backupPath = `${SETTINGS_PATH}.backup-render-smoke-uninstall-${timestamp()}`;
  await copyFile(SETTINGS_PATH, backupPath);
  return backupPath;
}

function getRenderSmokeRefs(settings) {
  const refs = [];
  if (settings.models?.activeModelPackId === ACTIVE_PACK_ID) refs.push('models.activeModelPackId');
  for (const key of ['build', 'plan', 'fast']) {
    if (settings.models?.modeDefaults?.[key] === PACK_MODEL_ID) refs.push(`models.modeDefaults.${key}`);
  }
  return refs;
}

function removeRenderSmoke(settings) {
  let changed = false;

  if (Array.isArray(settings.customProviders)) {
    const nextProviders = settings.customProviders.filter(provider => provider?.name !== PROVIDER_NAME);
    changed = changed || nextProviders.length !== settings.customProviders.length;
    settings.customProviders = nextProviders;
  }

  if (Array.isArray(settings.customModelPacks)) {
    const nextPacks = settings.customModelPacks.filter(pack => pack?.name !== PROVIDER_NAME);
    changed = changed || nextPacks.length !== settings.customModelPacks.length;
    settings.customModelPacks = nextPacks;
  }

  return changed;
}

function clearForcedRefs(settings) {
  let changed = false;
  if (settings.models?.activeModelPackId === ACTIVE_PACK_ID) {
    delete settings.models.activeModelPackId;
    changed = true;
  }
  for (const key of ['build', 'plan', 'fast']) {
    if (settings.models?.modeDefaults?.[key] === PACK_MODEL_ID) {
      delete settings.models.modeDefaults[key];
      changed = true;
    }
  }
  return changed;
}

const settings = await readSettings();
if (!settings) {
  console.log(`No Mastra Code settings found at ${SETTINGS_PATH}`);
  console.log('No changes made.');
  process.exit(0);
}

const refs = getRenderSmokeRefs(settings);
if (refs.length > 0 && !FORCE) {
  console.error('Render Smoke is still selected in settings:');
  for (const ref of refs) console.error(`- ${ref}`);
  console.error('Switch to another model pack first, then rerun uninstall.');
  console.error('Or run with RENDER_SMOKE_UNINSTALL_FORCE=1 to remove it and clear those references.');
  process.exit(1);
}

const removed = removeRenderSmoke(settings);
const clearedRefs = FORCE && clearForcedRefs(settings);
const changed = removed || clearedRefs;
if (!changed) {
  console.log(`Render Smoke settings are not installed at ${SETTINGS_PATH}`);
  console.log('No changes made.');
  process.exit(0);
}

const backupPath = await backupSettings();
await writeFile(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);

console.log(`Uninstalled Render Smoke settings from ${SETTINGS_PATH}`);
console.log(`Backup written to ${backupPath}`);
if (FORCE && refs.length > 0) console.log(`Cleared references: ${refs.join(', ')}`);
