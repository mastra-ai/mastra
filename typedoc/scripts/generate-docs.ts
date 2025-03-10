import { Application } from 'typedoc';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import {
  PackageInfo,
  DEPLOYERS,
  INTEGRATIONS,
  CLIENT_SDKS,
  CORE_PACKAGES,
  SPEECH_PACKAGES,
  STORE_PACKAGES,
  VOICE_PACKAGES,
} from './packages.js';
import { DarkTheme } from '../theme/dark-theme.js';
import { generateLandingPage } from './landing-page.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildDocs(packageInfo: PackageInfo) {
  console.log(`\nProcessing ${packageInfo.name} documentation...`);

  const projectRoot = path.resolve(__dirname, '..', '..');
  const outputPath = path.resolve(__dirname, '..', 'generated', 'packages', packageInfo.name);
  const packagePath = path.join(projectRoot, packageInfo.path);

  await fs.rm(outputPath, { recursive: true, force: true }).catch(() => {});

  const app = await Application.bootstrapWithPlugins({
    name: packageInfo.displayName,
    excludePrivate: true,
    excludeProtected: true,
    excludeInternal: true,
    theme: 'dark',
    entryPoints: [path.join(packagePath, 'src/index.ts')],
    entryPointStrategy: 'resolve',
    tsconfig: path.join(packagePath, 'tsconfig.json'),
    out: outputPath,
  });

  // Register our dark theme
  app.renderer.defineTheme('dark', DarkTheme);

  try {
    const project = await app.convert();
    if (project) {
      await app.generateDocs(project, app.options.getValue('out'));
      console.log(`✓ Generated ${packageInfo.name} documentation`);
      return true;
    } else {
      console.error(`✗ Failed to generate ${packageInfo.name} documentation`);
      return false;
    }
  } catch (error) {
    console.error(`Documentation generation failed for ${packageInfo.name}:`, error);
    return false;
  }
}

async function buildCategoryDocs(packages: PackageInfo[], category: string) {
  console.log(`\nBuilding documentation for ${category}...`);
  const results = await Promise.all(packages.map(pkg => buildDocs(pkg)));
  const successful = results.filter(Boolean).length;
  console.log(`Completed ${category} documentation (${successful}/${packages.length} packages)`);
  return results;
}

// Main execution
(async () => {
  try {
    // Create generated directory if it doesn't exist
    const generatedDir = path.resolve(__dirname, '..', 'generated');
    await fs.mkdir(generatedDir, { recursive: true });

    // Build individual package docs
    await buildCategoryDocs(DEPLOYERS, 'Deployers');
    await buildCategoryDocs(INTEGRATIONS, 'Integrations');
    await buildCategoryDocs(CLIENT_SDKS, 'Client SDKs');
    await buildCategoryDocs(CORE_PACKAGES, 'Core Packages');
    await buildCategoryDocs(STORE_PACKAGES, 'Store Packages');
    await buildCategoryDocs(SPEECH_PACKAGES, 'Speech Packages');
    await buildCategoryDocs(VOICE_PACKAGES, 'Voice Packages');

    // Generate the landing page
    await generateLandingPage();

    console.log('\nAll documentation generated successfully!');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
