import { execSync } from 'child_process';
import Module from 'node:module';
import path from 'path';
import { fileURLToPath } from 'url';
import zodToJsonSchema from 'zod-to-json-schema';

import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Define directories to exclude
const EXCLUDE_DIRS = ['cli', 'core', 'admin', 'twitter-v2'];
const require = Module.createRequire(import.meta.url);

// Path to the packages directory
const packagesDir = path.resolve(__dirname, '../../../packages');
const tempNodeModulesPath = path.resolve(__dirname, '../temp_node_modules');

// Output file for the JSON data
const outputFilePath = path.resolve(__dirname, '../src/domains/integrations/generated/integrations.json');

// Helper function to install and require a package from a local path
async function importLocalPackage(packagePath) {
  const packageName = path.basename(packagePath);
  console.log(`Installing ${packageName}`);

  try {
    execSync(`pnpm add ${packagePath} --prefix ${tempNodeModulesPath}`, { stdio: 'inherit' });
    //try dynamic import
    try {
      const modulePath = path.join('@mastra', packageName);
      console.log({ modulePath });
      const packageModule = require(
        path.join(tempNodeModulesPath, 'node_modules', '@mastra', packageName, 'dist', 'index.js'),
      );
      return packageModule;
    } catch (importErr) {
      console.error(importErr);
      console.log(`Dynamic import failed for ${packageName}`);
      return require(path.join(tempNodeModulesPath, 'node_modules', '@mastra', packageName));
    }
  } catch (err) {
    console.error(`❌ Error importing`, packageName, err);
    return null;
  } finally {
  }
}

const capitalizeFirstLetter = word => {
  if (!word) return word;
  return word
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('_');
};

// Main function to process the packages directory
async function generateIntegrationsData() {
  const integrations = [];

  await fs.mkdir(tempNodeModulesPath);
  for (const dirName of await fs.readdir(packagesDir)) {
    if (!EXCLUDE_DIRS.includes(dirName)) {
      const integrationName = dirName;
      const packagePath = path.join(packagesDir, integrationName);

      try {
        const packageModule = await importLocalPackage(packagePath);
        if (packageModule) {
          const IntegrationClass = packageModule[`${capitalizeFirstLetter(integrationName)}Integration`];
          const integrationInstance = new IntegrationClass({
            config: {},
          });
          const authConnectionOptions = integrationInstance?.config?.authConnectionOptions;
          integrations.push({
            name: capitalizeFirstLetter(integrationName),
            packageName: `@mastra/${integrationName.toLowerCase()}`,
            logoUrl: integrationInstance?.logoUrl,
            authType: integrationInstance?.getAuthenticator().config.AUTH_TYPE,
            availableScopes: integrationInstance?.availableScopes || [],
            config: {
              apiKey: authConnectionOptions ? zodToJsonSchema(authConnectionOptions) : undefined,
            },
            categories: integrationInstance?.categories,
            description: integrationInstance?.description,
          });
        } else {
          throw 'Could not install package';
        }
      } catch (err) {
        console.error(`Failed to process package: ${integrationName}`, err);
      }
    }
  }

  try {
    console.log(`Trying to remove installed temporary node module: ${tempNodeModulesPath}`);
    execSync(`rm -rf ${tempNodeModulesPath}`, { stdio: 'inherit' });
    console.log(`✅ Successfully removed temporary node module folder`);
  } catch (err) {
    console.log('❌ Error removing temp node modules folder', err);
  }

  try {
    console.log(`Writing to ${outputFilePath}...`);
    await fs.writeFile(outputFilePath, JSON.stringify(integrations, null, 3));
    console.log(`✅ Integrations data written to ${outputFilePath}`);
  } catch (err) {
    console.error('Error writing output file:', err);
  }
}

generateIntegrationsData();
