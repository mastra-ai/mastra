/**
 * Test that exporter packages can be imported without errors
 *
 * This catches issues like GitHub #9272 where an exporter's file
 * tries to import from '@mastra/core/observability/exporters' (which doesn't exist)
 * instead of '@mastra/core/observability'.
 */

import { describe, it } from 'vitest';
import fs from 'fs';
import path from 'path';

// Discover all public exporter packages in observability directory
function getObservabilityPackages() {
  const observabilityDir = path.join(__dirname, '..');
  const entries = fs.readdirSync(observabilityDir, { withFileTypes: true });

  const packages = entries
    .filter(
      entry =>
        entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('_'),
    )
    .map(entry => {
      const packageJsonPath = path.join(observabilityDir, entry.name, 'package.json');
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        // Only test public packages (not marked as private)
        if (!packageJson.private) {
          return packageJson.name;
        }
      } catch {
        // Skip directories without package.json
      }
      return null;
    })
    .filter((name): name is string => name !== null);

  return packages;
}

const packages = getObservabilityPackages();

describe('Observability Package Imports', () => {
  it.each(packages)('should import %s without errors', packageName => {
    try {
      require(packageName);
    } catch (error: any) {
      // Allow upstream dependency issues (e.g., @arizeai/openinference-genai missing exports)
      // These are not our code's fault and will be resolved when dependencies are fixed
      if (error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' && error.message.includes('@arizeai/openinference-genai')) {
        return;
      }
      throw error;
    }
  });
});
