import { readdirSync, readFileSync } from 'fs';
import path from 'path';

export function getProjectDir({ dir }: { dir: string }) {
  const MASTRA_APP_DIR = process.env.MASTRA_APP_DIR || process.cwd();
  return path.join(MASTRA_APP_DIR, dir);
}

export function listAgentsJson({ agentDir }: { agentDir: string }) {
  try {
    const agentDirPath = getProjectDir({ dir: agentDir });
    const agents = readdirSync(agentDirPath);
    return agents;
  } catch (e) {
    console.error('No agent directory found:', agentDir);
    return;
  }
}

export function getAgentFile(agentFilePath: string) {
  try {
    const fileP = agentFilePath;
    const fileB = readFileSync(fileP, 'utf8');
    const json = JSON.parse(fileB);
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
  const agentDirPath = getProjectDir({ dir: agentDir });
  const agentBlueprintPath = path.join(agentDirPath, `${agentId}.json`);
  return getAgentFile(agentBlueprintPath);
}

export function getPineconeConfig({ dir }: { dir: string }) {
  const agentDirPath = getProjectDir({ dir });
  const agentBlueprintPath = path.join(agentDirPath, `pinecone.json`);
  return getAgentFile(agentBlueprintPath);
}

export const retryFn = async <T>(
  operation: () => Promise<T>,
  {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    jitter = true,
  } = {}
) => {
  let delay = initialDelay;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error; // Rethrow the error on the last attempt
      }
      console.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      // Calculate next delay with exponential backoff
      delay = Math.min(delay * factor, maxDelay);
      // Add jitter if enabled
      if (jitter) {
        const jitterFactor = 0.5 + Math.random();
        delay = Math.floor(delay * jitterFactor);
      }
    }
  }
};
