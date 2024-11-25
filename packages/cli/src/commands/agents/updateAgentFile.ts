import path from 'path';
import prettier from 'prettier';

import fs from 'fs/promises';

export async function updateAgentIndexFile(newAgentName: string) {
  const indexPath = path.join(process.cwd(), 'src', 'mastra', 'index.ts');

  try {
    const content = await fs.readFile(indexPath, 'utf-8');

    const importMatch = content.match(/import\s*{([^}]+)}\s*from\s*'\.\/agents\/agent'/);
    const existingAgents = importMatch
      ? importMatch[1]
          .split(',')
          .map(a => a.trim())
          .filter(a => a)
      : [];

    if (!existingAgents.includes(newAgentName)) {
      existingAgents.push(newAgentName);
    }

    const newImport = `import { ${existingAgents.join(', ')} } from './agents/agent';`;

    let updatedContent = importMatch
      ? content.replace(/import\s*{[^}]+}\s*from\s*'\.\/agents\/agent';/, newImport)
      : newImport + '\n' + content;

    const agentsMatch = updatedContent.match(/agents:\s*\[(.*?)\]/);

    if (agentsMatch) {
      const currentAgents = agentsMatch[1]
        .split(',')
        .map(a => a.trim())
        .filter(a => a);
      if (!currentAgents.includes(newAgentName)) {
        currentAgents.push(newAgentName);
        const newAgentsArray = `agents: [${currentAgents.join(', ')}]`;
        const updatedWithAgent = updatedContent.replace(/agents:\s*\[[^\]]+\]/, newAgentsArray);
        updatedContent = updatedWithAgent;
      }
    }

    const formattedContent = await prettier.format(updatedContent, {
      parser: 'typescript',
      singleQuote: true,
    });

    await fs.writeFile(indexPath, formattedContent);

    return formattedContent;
  } catch (err) {
    console.error('Error updating index file:', err);
    throw err;
  }
}
