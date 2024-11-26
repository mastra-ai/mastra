import * as path from 'path';

import * as fs from 'fs/promises';

export async function listAgents(): Promise<string[]> {
  try {
    const agentFilePath = path.join(process.cwd(), 'src', 'mastra', 'agents', 'agent.ts');

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
