import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MastraModelGateway } from '../src/llm/model/gateways/index.js';
import { ModelsDevGateway } from '../src/llm/model/gateways/models-dev.js';
import { NetlifyGateway } from '../src/llm/model/gateways/netlify.js';
import { fetchProvidersFromGateways, writeRegistryFiles } from '../src/llm/model/registry-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateProviderRegistry(gateways: MastraModelGateway[]) {
  // Fetch providers from all gateways
  const { providers, models, attachmentCapabilities, temperatureCapabilities, failedGateways } =
    await fetchProvidersFromGateways(gateways);

  if (failedGateways.length > 0) {
    console.warn(
      `\nFailed to fetch from gateways: ${failedGateways.join(', ')}. Skipping generation to avoid writing partial provider data.`,
    );
    return;
  }

  // Write registry files to src/ (for version control)
  const srcDir = path.join(__dirname, '..', 'src', 'llm', 'model');
  const srcJsonPath = path.join(srcDir, 'provider-registry.json');
  const srcTypesPath = path.join(srcDir, 'provider-types.generated.d.ts');
  await writeRegistryFiles(
    srcJsonPath,
    srcTypesPath,
    providers,
    models,
    attachmentCapabilities,
    temperatureCapabilities,
  );

  // Write registry files to dist/ (for build output)
  const distJsonPath = path.join(__dirname, '..', 'dist', 'provider-registry.json');
  const distTypesPath = path.join(__dirname, '..', 'dist', 'llm', 'model', 'provider-types.generated.d.ts');
  await writeRegistryFiles(
    distJsonPath,
    distTypesPath,
    providers,
    models,
    attachmentCapabilities,
    temperatureCapabilities,
  );

  // Log summary
  console.info(`\nRegistered providers:`);
  for (const [providerId, config] of Object.entries(providers)) {
    console.info(`  - ${providerId}: ${config.name} (${config.models.length} models)`);
  }
  const capProviderCount = Object.keys(attachmentCapabilities).length;
  const capModelCount = Object.values(attachmentCapabilities).reduce((sum, models) => sum + models.length, 0);
  console.info(`\nAttachment-capable: ${capModelCount} models across ${capProviderCount} providers`);
  const tempProviderCount = Object.keys(temperatureCapabilities).length;
  const tempModelCount = Object.values(temperatureCapabilities).reduce((sum, models) => sum + models.length, 0);
  console.info(`Temperature-capable: ${tempModelCount} models across ${tempProviderCount} providers`);
}

// Main execution
async function main() {
  const gateways: MastraModelGateway[] = [new ModelsDevGateway(), new NetlifyGateway()];

  await generateProviderRegistry(gateways);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Failed to generate provider registry:', error);
    process.exit(1);
  });
}
