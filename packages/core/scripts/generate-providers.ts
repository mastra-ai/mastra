import path from 'path';
import { fileURLToPath } from 'url';
import type { MastraModelGateway } from '../src/llm/model/gateways/index.js';
import { ModelsDevGateway } from '../src/llm/model/gateways/models-dev.js';
import { NetlifyGateway } from '../src/llm/model/gateways/netlify.js';
import { fetchProvidersFromGateways, writeRegistryFiles } from '../src/llm/model/registry-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateProviderRegistry(gateways: MastraModelGateway[]) {
  // Fetch providers from all gateways
  const { providers, models } = await fetchProvidersFromGateways(gateways);

  // Write registry files to src/ (for version control)
  const srcDir = path.join(__dirname, '..', 'src', 'llm', 'model');
  const srcJsonPath = path.join(srcDir, 'provider-registry.json');
  const srcTypesPath = path.join(srcDir, 'provider-types.generated.d.ts');
  await writeRegistryFiles(srcJsonPath, srcTypesPath, providers, models);

  // Write registry files to dist/ (for build output)
  const distJsonPath = path.join(__dirname, '..', 'dist', 'provider-registry.json');
  const distTypesPath = path.join(__dirname, '..', 'dist', 'llm', 'model', 'provider-types.generated.d.ts');
  await writeRegistryFiles(distJsonPath, distTypesPath, providers, models);

  // Log summary
  console.info(`\nRegistered providers:`);
  for (const [providerId, config] of Object.entries(providers)) {
    console.info(`  - ${providerId}: ${config.name} (${config.models.length} models)`);
  }
}

// Main execution
async function main() {
  // Configure which gateways to use
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
