import fs from 'fs/promises';
import path from 'path';
import semver from 'semver';
import { logger } from '../../../utils/logger.js';
import type { LintRule } from './types.js';
const MIN_NODE_VERSION = '20.9.0';

export const nodeVersionRule: LintRule = {
  name: 'node-version',
  description: 'Ensures Node.js version requirement is set to >=20.9.0 in package.json',
  async run(context) {
    const packageJsonPath = path.join(context.rootDir, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    if (!packageJson.engines?.node) {
      return false;
    }

    const nodeVersion = packageJson.engines.node;
    // Handle both exact versions and version ranges
    const version = nodeVersion.replace(/[^0-9.]/g, '');

    try {
      const result = semver.gte(version, MIN_NODE_VERSION);
      if (!result) {
        logger.error(`Node.js version ${version} is less than the minimum required version ${MIN_NODE_VERSION}`);
      }
      return result;
    } catch (error) {
      logger.error(`Error comparing Node.js versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  },
};
