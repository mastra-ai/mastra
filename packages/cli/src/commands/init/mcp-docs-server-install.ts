import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import * as p from '@clack/prompts';
import { ensureFile, readJSON, writeJSON } from 'fs-extra/esm';

export function installMastraDocsMCPServer({
  editor,
  directory,
}: {
  editor: undefined | 'cursor' | 'windsurf';
  directory: string;
}) {
  if (!editor) return;
  if (editor === `cursor`) return installCursorMCP(directory);
  if (editor === `windsurf`) return installWindsurfMCP();
}

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

export async function installCursorMCP(directory: string) {
  const configPath = path.join(directory, '.cursor', 'mcp.json');
  await writeMergedConfig(configPath);
}
export async function installWindsurfMCP() {
  const configPath = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');

  const confirm = await p.select({
    message: `Windsurf only supports a global MCP config (at ${configPath}) is it ok to add/update that global config?\nThis means the Mastra docs MCP server will be available in all your Windsurf projects.`,
    options: [
      { value: 'skip', label: 'No, skip for now' },
      { value: 'yes', label: 'Yes, I understand' },
    ],
  });
  if (confirm !== `yes`) {
    return undefined;
  }

  await writeMergedConfig(configPath);
}
