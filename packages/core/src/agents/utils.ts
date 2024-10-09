import { readdirSync, readFileSync } from 'fs';
import path from 'path';

export function getAgentDir({ agentDir }: { agentDir: string }) {
  const ARK_APP_DIR = process.env.ARK_APP_DIR || process.cwd();
  return path.join(ARK_APP_DIR, agentDir);
}

export function listAgentsJson({ agentDir }: { agentDir: string }) {
  const agentDirPath = getAgentDir({ agentDir });
  const agents = readdirSync(agentDirPath);
  return agents;
}

export function getAgentFile(agentFilePath: string) {
  try {
    const json = JSON.parse(readFileSync(agentFilePath, 'utf8'));
    return json;
  } catch (e) {
    console.error('No agent blueprint found:', agentFilePath);
    return;
  }
}

export function getAgentBlueprint({
  agentId,
  agentDir,
}: {
  agentId: string;
  agentDir: string;
}) {
  const agentDirPath = getAgentDir({ agentDir });
  const agentBlueprintPath = path.join(agentDirPath, `${agentId}.json`);
  return getAgentFile(agentBlueprintPath);
}
