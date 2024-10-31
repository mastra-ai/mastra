import { execSync } from 'child_process';
import { execa } from 'execa';
import path from 'path';

import fs from 'fs/promises';

const capitalizeFirstLetter = word => {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
};

// Helper function to install and require a package from a local path
async function importFile({ integrationPath }) {
  try {
    await execa('npx', ['tsc', 'index.ts'], { cwd: integrationPath });
  } catch (err) {}
  try {
    // const integrationFilePath = path.join(integrationPath, 'index.js');

    const file = require(integrationPath);

    return file;
  } catch (err) {
    console.error('Erroring installing file');
  }
}
const EXCLUDE_DIRS = ['integrations.json'];

async function generateUserDefinedIntegrations() {
  const integrations = [];
  const cwd = process.cwd();
  const packagesDir = process.env.INTEGRATION_PATH || path.resolve(cwd, 'integrations');

  // Output file for the JSON data
  const outputFilePath = path.resolve(packagesDir, 'integrations.json');

  for (const dirName of await fs.readdir(packagesDir)) {
    if (!EXCLUDE_DIRS.includes(dirName)) {
      const integrationName = dirName;
      const integrationPath = path.join(packagesDir, integrationName);

      try {
        const file = await importFile({ integrationPath });
        if (file) {
          const IntegrationClass = file[`${capitalizeFirstLetter(integrationName)}Integration`];
          const integrationInstance = new IntegrationClass({
            config: {},
          });
          const authConnectionOptions = integrationInstance?.config?.authConnectionOptions;
          integrations.push({
            name: capitalizeFirstLetter(integrationName),
            packageName: integrationName.toLowerCase(),
            logoUrl: integrationInstance?.logoUrl,
            authType: integrationInstance?.getAuthenticator().config.AUTH_TYPE,
            availableScopes: integrationInstance?.availableScopes || [],
            config: {
              apiKey: authConnectionOptions ? zodToJsonSchema(authConnectionOptions) : undefined,
            },
            isUserDefined: true,
          });
        } else {
          throw 'Could not import file';
        }
        execSync(`rm -rf ${path.resolve(integrationPath, 'index.js')}`, { stdio: 'inherit' });
      } catch (err) {
        console.error(`Failed to process file: ${integrationName}`, err);
      }
    }
  }

  try {
    await fs.writeFile(outputFilePath, JSON.stringify(integrations, null, 3));
  } catch (err) {
    console.error('Error writing output file:', err);
  }
}

generateUserDefinedIntegrations();
