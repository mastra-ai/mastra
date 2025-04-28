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

export const windsurfGlobalMCPConfigPath = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
export const cursorGlobalMCPConfigPath = path.join(os.homedir(), '.cursor', 'mcp.json');

export async function installMastraDocsMCPServer({
  editor,
  directory,
}: {
  editor: undefined | 'cursor' | 'cursor-global' | 'windsurf';
  directory: string;
}) {
  if (editor === `cursor`) {
    await writeMergedConfig(path.join(directory, '.cursor', 'mcp.json'));
  }
  if (editor === `cursor-global`) {
    const alreadyInstalled = await globalMCPIsAlreadyInstalled(editor);
    if (alreadyInstalled) {
      return;
    }
    await writeMergedConfig(cursorGlobalMCPConfigPath);
  }

  if (editor === `windsurf`) {
    const alreadyInstalled = await globalMCPIsAlreadyInstalled(editor);
    if (alreadyInstalled) {
      return;
    }
    await writeMergedConfig(windsurfGlobalMCPConfigPath);
  }
}

export async function globalMCPIsAlreadyInstalled(editor: undefined | 'cursor' | 'cursor-global' | 'windsurf') {
  let configPath: string = ``;

  if (editor === 'windsurf') {
    configPath = windsurfGlobalMCPConfigPath;
  } else if (editor === 'cursor-global') {
    configPath = cursorGlobalMCPConfigPath;
  }

  if (!configPath || !existsSync(configPath)) {
    return false;
  }

  try {
    const configContents = await readJSON(configPath);
    if (!configContents?.mcpServers) return false;

    const hasMastraMCP = Object.values(configContents.mcpServers).some((server?: any) =>
      server?.args?.find((arg?: string) => arg?.includes(`@mastra/mcp-docs-server`)),
    );

    return hasMastraMCP;
  } catch (e) {
    console.error(e);
    return false;
  }
}
