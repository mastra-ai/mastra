/**
 * Regenerate the bundled pricing snapshot (`src/metrics/pricing-data.jsonl`) from models.dev.
 * The "Regenerate Providers & Docs" workflow runs this every 6 hours, next to the model router's
 * provider registry. At runtime the package also refreshes from models.dev (see `pricing-registry.ts`);
 * this snapshot is the starting point and the offline fallback.
 */
import fs from 'node:fs';
import path from 'node:path';
import { MIN_MODELS_DEV_PRICING_ROWS, MODELS_DEV_API_URL, modelsDevToPricingRows } from '../src/metrics/models-dev';

const OUTPUT_FILE = path.join(import.meta.dirname, '..', 'src', 'metrics', 'pricing-data.jsonl');

const response = await fetch(MODELS_DEV_API_URL);
if (!response.ok) {
  throw new Error(`models.dev responded with ${response.status}`);
}

const rows = modelsDevToPricingRows(await response.json());
if (rows.length < MIN_MODELS_DEV_PRICING_ROWS) {
  throw new Error(`models.dev returned ${rows.length} pricing rows, expected at least ${MIN_MODELS_DEV_PRICING_ROWS}`);
}

fs.writeFileSync(OUTPUT_FILE, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
console.info(`✓ Wrote ${rows.length} pricing rows to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
