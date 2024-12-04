import path from 'path';
import color from 'picocolors';
import prettier from 'prettier';

import fs from 'fs/promises';

import { logger } from '../../utils/logger.js';
import { getConfig } from '../init/get-config.js';

export async function updateAgentIndexFile(newAgentName: string) {
  const config = await getConfig(process.cwd());

  if (!config) {
    logger.warn(`
        Config is missing. Please run ${color.green(`init`)} to create a config.json file
        `);
    process.exit();
  }
  const indexPath = path.join(config.dirPath, 'index.ts');

  try {
    const content = await fs.readFile(indexPath, 'utf-8');

    const importMatch = content.match(/import\s*{([^}]+)}\s*from\s*'\.\/agents\/index'/);
    const existingAgents = importMatch
      ? importMatch[1]
          ?.split(',')
          .map(a => a.trim())
          .filter(a => a)
      : [];

    if (!existingAgents?.includes(newAgentName)) {
      existingAgents?.push(newAgentName);
    }

    const newImport = `import { ${existingAgents?.join(', ')} } from './agents/index';`;

    let updatedContent = importMatch
      ? content.replace(/import\s*{[^}]+}\s*from\s*'\.\/agents\/index';/, newImport)
      : newImport + '\n' + content;

    const classMatch = updatedContent.match(/new\s+Mastra\s*\(\s*{([^}]*)}\s*\)/s);

    if (!classMatch) return;

    const agentsMatch = classMatch && classMatch[1] ? classMatch[1].match(/agents:\s*\[(.*?)\]/) : '';

    if (agentsMatch) {
      const currentAgents = agentsMatch[1]
        ?.split(',')
        .map(a => a.trim())
        .filter(a => a);
      if (!currentAgents?.includes(newAgentName)) {
        currentAgents?.push(newAgentName);
        const newAgentsArray = `agents: [${currentAgents?.join(', ')}]`;
        updatedContent = updatedContent.replace(/agents:\s*\[[^\]]+\]/, newAgentsArray);
      }
    } else {
      const classConfig = classMatch[1]?.trim();
      const newClassConfig = classConfig ? `${classConfig}, agents: [${newAgentName}]` : `agents: [${newAgentName}]`;
      updatedContent = updatedContent.replace(
        /new\s+Mastra\s*\(\s*{([^}]*)}\s*\)/s,
        `new Mastra({\n  ${newClassConfig}\n})`,
      );
    }

    const formattedContent = await prettier.format(updatedContent, {
      parser: 'typescript',
      singleQuote: true,
    });

    await fs.writeFile(indexPath, formattedContent);

    return formattedContent;
  } catch (err) {
    logger.warn(`Error updating index file: ${err}`);
    throw err;
  }
}
