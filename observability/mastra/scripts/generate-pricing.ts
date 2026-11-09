/**
 * Regenerate the bundled pricing snapshot (`src/metrics/pricing-data.json`) from models.dev. It keeps
 * each model's `cost` in the models.dev shape. The "Regenerate Providers & Docs" workflow runs this
 * every 6 hours, next to the model router's provider registry. The snapshot is what cost estimates use
 * unless the runtime refresh is on (see `pricing-registry.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  MIN_PRICED_MODELS,
  MODELS_DEV_API_URL,
  modelsDevToPricingModels,
  pickModelsDevCosts,
} from '../src/metrics/models-dev';

const OUTPUT_FILE = path.join(import.meta.dirname, '..', 'src', 'metrics', 'pricing-data.json');

const response = await fetch(MODELS_DEV_API_URL);
if (!response.ok) {
  throw new Error(`models.dev responded with ${response.status}`);
}

const costs = pickModelsDevCosts(await response.json());
const prices = modelsDevToPricingModels(costs).size;
if (prices < MIN_PRICED_MODELS) {
  throw new Error(`models.dev returned ${prices} prices, expected at least ${MIN_PRICED_MODELS}`);
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(costs, null, 2) + '\n');
console.info(`✓ Wrote ${prices} prices to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
