import * as path from 'path';
import fsExtra from 'fs-extra/esm';
import * as fs from 'fs/promises';


export async function listAgents({ dir }: { dir?: string }): Promise<string[]> {
  const dirPath = dir || path.join(process.cwd(), 'src/mastra');
  try {
    await fsExtra.ensureFile(`${dirPath}/agents/index.ts`);
    const agentFilePath = path.join(dirPath, 'agents', 'index.ts');

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
