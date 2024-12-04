import * as path from 'path';
import color from 'picocolors';

import * as fs from 'fs/promises';

import { logger } from '../../utils/logger.js';
import { getConfig } from '../init/get-config.js';

export async function listAgents(): Promise<string[]> {
  const config = await getConfig(process.cwd());

  if (!config) {
    logger.warn(`
        Config is missing. Please run ${color.green(`init`)} to create a config.json file
        `);
    process.exit();
  }
  try {
    const agentFilePath = path.join(config?.dirPath, 'agents', 'index.ts');

    const fileContent = await fs.readFile(agentFilePath, 'utf-8');

    const agentRegex = /export\s+const\s+(\w+)\s*=\s*new\s+Agent\s*\(\s*{\s*name:\s*["']([^"']+)["']/g;

    const agentNames: string[] = [];
    let match;

    while ((match = agentRegex.exec(fileContent)) !== null) {
      agentNames.push(match[2]!);
    }

    return agentNames;
  } catch (error) {
    console.error('Error reading agent file:', error);
    return [];
  }
}
