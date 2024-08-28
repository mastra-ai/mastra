const { execSync } = require('child_process');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');

// Define directories to exclude
const EXCLUDE_DIRS = ['cli', 'core', 'admin'];

// Path to the packages directory
const packagesDir = path.resolve(__dirname, '../../../packages');
const tempNodeModulesPath = path.resolve(__dirname, '../temp_node_modules');

// Output file for the JSON data
const outputFilePath = path.resolve(__dirname, '../src/domains/integrations/generated/integrations.json');

// Helper function to install and require a package from a local path
const requireLocalPackage = packagePath => {
  try {
    const packageName = path.basename(packagePath);
    console.log(`Installing ${packageName}.....`);
    execSync(`npm install ${packagePath} --prefix ${tempNodeModulesPath}`, { stdio: 'inherit' });
    console.log(`✅ - Successfully installed ${packageName}`);
    const packageModule = require(path.join(tempNodeModulesPath, 'node_modules', '@arkw', path.basename(packagePath)));
    return packageModule;
  } catch (err) {
    console.log('❌ Erroring installing and/or importing', path.basename(packagePath));
  }
};

const capitalizeFirstLetter = word => {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
};

// Main function to process the packages directory
const generateIntegrationsData = () => {
  const integrations = [];

  fs.readdirSync(packagesDir).forEach(dirName => {
    if (!EXCLUDE_DIRS.includes(dirName)) {
      const integrationName = dirName;
      const packagePath = path.join(packagesDir, integrationName);

      try {
        const IntegrationClass =
          requireLocalPackage(packagePath)[`${capitalizeFirstLetter(integrationName)}Integration`];
        const integrationInstance = new IntegrationClass({
          config: {},
        });
        integrations.push({
          name: capitalizeFirstLetter(integrationName),
          packageName: `@arkw/${integrationName}`,
          logoUrl: integrationInstance?.logoUrl,
        });
      } catch (error) {
        console.error(`Failed to process package: ${integrationName}`, error);
      }
    }
  });

  try {
    console.log(`Trying to remove installed temporary node module: ${tempNodeModulesPath}`);
    execSync(`rm -rf ${tempNodeModulesPath}`, { stdio: 'inherit' });
    console.log(`✅ Successfully removed temporary node module folder`);
  } catch (err) {
    console.log('❌ Error removing temp node modules folder', error);
  }

  try {
    console.log(`Writing to ${outputFilePath}...`);
    fse.outputFile(outputFilePath, JSON.stringify(integrations, null, 3));
  } finally {
    console.log(`✅ Integrations data written to ${outputFilePath}`);
  }
};

generateIntegrationsData();
