import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { ensureFile, readJSON, writeJSON } from 'fs-extra/esm';

const args = ['-y', '@mastra/mcp-docs-server@latest'];
const mcpConfig = {
  mcpServers: {
    mastra:
      process.platform === `win32`
        ? {
            command: 'cmd',
            args: ['/c', 'npx', ...args],
          }
        : {
            command: 'npx',
            args,
          },
  },
};

function makeConfig(original: { mcpServers?: Record<string, unknown> }) {
  return {
    ...original,
    mcpServers: {
      ...(original?.mcpServers || {}),
      ...mcpConfig.mcpServers,
    },
  };
}

async function writeMergedConfig(configPath: string) {
  const configExists = existsSync(configPath);
  const config = makeConfig(configExists ? await readJSON(configPath) : {});
  await ensureFile(configPath);
  await writeJSON(configPath, config, {
    spaces: 2,
  });
}

export const windsurfGlobalMCPDirectory = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');

export async function installMastraDocsMCPServer({
  editor,
  directory,
}: {
  editor: undefined | 'cursor' | 'windsurf';
  directory: string;
}) {
  if (editor === `cursor`) await writeMergedConfig(path.join(directory, '.cursor', 'mcp.json'));
  if (editor === `windsurf`) await writeMergedConfig(windsurfGlobalMCPDirectory);
}
