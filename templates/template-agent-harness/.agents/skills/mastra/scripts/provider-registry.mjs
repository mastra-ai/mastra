#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findRegistryPath() {
  const rel = join('node_modules', '@mastra', 'core', 'dist', 'provider-registry.json');
  // Walk up from script location to find project root with node_modules
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    try {
      const p = join(dir, rel);
      readFileSync(p, "utf-8");
      return p;
    } catch {
      dir = dirname(dir);
    }
  }
  // Fall back to cwd
  return join(process.cwd(), rel);
}

function loadRegistry() {
  const path = findRegistryPath();
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    console.error(`Error: Could not load provider registry at ${path}`);
    console.error(e.message);
    process.exit(1);
  }
}

/**
 * Extract version numbers from a model name for sorting.
 * Returns an array of numeric segments, e.g. "gpt-5.4" → [5, 4].
 * Handles dot-separated (3.5), hyphen-separated (3-7), and mixed formats.
 * Models without detectable version numbers return null.
 */
function extractVersion(name) {
  // Use named capture to grab version-like sequences along with their context.
  // We capture digits separated by dots/hyphens, plus any trailing letter for filtering.
  const regex = /(\d+(?:[.\-]\d+)*)([a-zA-Z])?/g;
  const candidates = [];
  let match;
  while ((match = regex.exec(name)) !== null) {
    const numStr = match[1];
    const suffix = match[2] || "";
    candidates.push({ numStr, suffix, index: match.index });
  }
  if (candidates.length === 0) return null;

  // Process candidates: filter and clean up non-version parts
  const processed = [];
  for (const c of candidates) {
    let parts = c.numStr.split(/[.\-]/).map(Number);
    // If followed by a size suffix (b/B/k/K/m/M/t/T) — e.g. "8b", "70B", "1t" —
    // strip the last numeric part (param count) but keep earlier parts as the version
    if (/^[bBkKmMtT]$/.test(c.suffix)) {
      parts = parts.slice(0, -1);
      if (parts.length === 0) continue;
    }
    // Strip date-like segments (>= 2020 or YYYYMMDD-style 8-digit numbers)
    parts = parts.filter((p) => p < 2020);
    if (parts.length === 0) continue;
    // Skip very large standalone numbers (parameter counts, IDs)
    if (parts.length === 1 && parts[0] >= 100 && candidates.length > 1) continue;
    // Skip trailing date-like patterns (MM-DD) in the latter half of the name
    if (
      parts.length === 2 &&
      parts[0] >= 1 && parts[0] <= 12 &&
      parts[1] >= 1 && parts[1] <= 31 &&
      c.index > name.length / 2 &&
      candidates.length > 1
    ) continue;
    processed.push(parts);
  }

  if (processed.length === 0) return null;

  // Return the first valid version candidate (versions appear early in model names)
  return processed[0];
}

function compareVersionsDesc(a, b) {
  const va = extractVersion(a);
  const vb = extractVersion(b);

  // Models without versions go to the end
  if (!va && !vb) return a.localeCompare(b);
  if (!va) return 1;
  if (!vb) return -1;

  // Compare version tuples numerically, descending
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i++) {
    const ai = va[i] ?? 0;
    const bi = vb[i] ?? 0;
    if (bi !== ai) return bi - ai;
  }
  // Same version — secondary sort by full name descending
  return b.localeCompare(a);
}

function printUsage() {
  console.log(`Usage: provider-registry.mjs [options]

Options:
  --list               List all available model providers
  --provider <name>    List all models for a provider (sorted newest first)
  --help               Show this help message

Examples:
  node provider-registry.mjs --list
  node provider-registry.mjs --provider openai
  node provider-registry.mjs --provider anthropic`);
}

function listProviders(registry) {
  const entries = Object.entries(registry.providers)
    .map(([key, val]) => ({ key, name: val.name || key }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const maxKey = Math.max(...entries.map((e) => e.key.length));
  const maxName = Math.max(...entries.map((e) => e.name.length));

  console.log(`${"PROVIDER".padEnd(maxKey)}  ${"NAME".padEnd(maxName)}  MODELS`);
  console.log(`${"─".repeat(maxKey)}  ${"─".repeat(maxName)}  ${"─".repeat(6)}`);
  for (const entry of entries) {
    const modelCount = registry.providers[entry.key].models.length;
    console.log(`${entry.key.padEnd(maxKey)}  ${entry.name.padEnd(maxName)}  ${modelCount}`);
  }
  console.log(`\n${entries.length} providers`);
}

function listModels(registry, providerName) {
  const provider = registry.providers[providerName];
  if (!provider) {
    console.error(`Error: Provider "${providerName}" not found.`);
    console.error(`Run with --list to see available providers.`);
    process.exit(1);
  }

  const models = [...provider.models].sort(compareVersionsDesc);

  console.log(`${provider.name || providerName} — ${models.length} models\n`);
  for (const model of models) {
    console.log(`  ${model}`);
  }
}

const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  printUsage();
  process.exit(0);
}

if (args.includes("--list")) {
  listProviders(loadRegistry());
  process.exit(0);
}

const providerIdx = args.indexOf("--provider");
if (providerIdx !== -1) {
  const name = args[providerIdx + 1];
  if (!name) {
    console.error("Error: --provider requires a provider name.");
    process.exit(1);
  }
  listModels(loadRegistry(), name);
  process.exit(0);
}

console.error("Error: Unknown arguments:", args.join(" "));
printUsage();
process.exit(1);
