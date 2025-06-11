import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { ensureFile, readJSON, writeJSON } from 'fs-extra/esm';

const args = ['-y', '@mastra/mcp-docs-server'];
const createMcpConfig = (editor: Editor) => {
  if (editor === 'vscode') {
    return {
      servers: {
        mastra:
          process.platform === `win32`
            ? {
                command: 'cmd',
                args: ['/c', 'npx', ...args],
                type: 'stdio',
              }
            : {
                command: 'npx',
                args,
                type: 'stdio',
              },
      },
    };
  }
  return {
    mcpServers: {
      mastra: {
        command: 'npx',
        args,
      },
    },
  };
};

function makeConfig(
  original: { mcpServers?: Record<string, unknown>; servers?: Record<string, unknown> },
  editor: Editor,
) {
  if (editor === 'vscode') {
    return {
      ...original,
      servers: {
        ...(original?.servers || {}),
        ...createMcpConfig(editor).servers,
      },
    };
  }
  return {
    ...original,
    mcpServers: {
      ...(original?.mcpServers || {}),
      ...createMcpConfig(editor).mcpServers,
    },
  };
}

async function writeMergedConfig(configPath: string, editor: Editor) {
  const configExists = existsSync(configPath);
  const config = makeConfig(configExists ? await readJSON(configPath) : {}, editor);
  await ensureFile(configPath);
  await writeJSON(configPath, config, {
    spaces: 2,
  });
}

export const windsurfGlobalMCPConfigPath = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
export const cursorGlobalMCPConfigPath = path.join(os.homedir(), '.cursor', 'mcp.json');
export const vscodeMCPConfigPath = path.join(process.cwd(), '.vscode', 'mcp.json');
export const vscodeGlobalMCPConfigPath = path.join(
  os.homedir(),
  process.platform === 'win32'
    ? path.join('AppData', 'Roaming', 'Code', 'User', 'settings.json')
    : process.platform === 'darwin'
      ? path.join('Library', 'Application Support', 'Code', 'User', 'settings.json')
      : path.join('.config', 'Code', 'User', 'settings.json'),
);

export type Editor = 'cursor' | 'cursor-global' | 'windsurf' | 'vscode';

export async function installMastraDocsMCPServer({ editor, directory }: { editor?: Editor; directory: string }) {
  if (editor === `cursor`) {
    await writeMergedConfig(path.join(directory, '.cursor', 'mcp.json'), 'cursor');
  }
  if (editor === `vscode`) {
    await writeMergedConfig(path.join(directory, '.vscode', 'mcp.json'), 'vscode');
  }
  if (editor === `cursor-global`) {
    const alreadyInstalled = await globalMCPIsAlreadyInstalled(editor);
    if (alreadyInstalled) {
      return;
    }
    await writeMergedConfig(cursorGlobalMCPConfigPath, 'cursor-global');
  }

  if (editor === `windsurf`) {
    const alreadyInstalled = await globalMCPIsAlreadyInstalled(editor);
    if (alreadyInstalled) {
      return;
    }
    await writeMergedConfig(windsurfGlobalMCPConfigPath, editor);
  }
}

export async function globalMCPIsAlreadyInstalled(editor: Editor) {
  let configPath: string = ``;

  if (editor === 'windsurf') {
    configPath = windsurfGlobalMCPConfigPath;
  } else if (editor === 'cursor-global') {
    configPath = cursorGlobalMCPConfigPath;
  } else if (editor === 'vscode') {
    configPath = vscodeGlobalMCPConfigPath;
  }

  if (!configPath || !existsSync(configPath)) {
    return false;
  }

  try {
    const configContents = await readJSON(configPath);

    if (!configContents) return false;

    if (editor === 'vscode') {
      if (!configContents.servers) return false;
      const hasMastraMCP = Object.values(configContents.servers).some((server?: any) =>
        server?.args?.find((arg?: string) => arg?.includes(`@mastra/mcp-docs-server`)),
      );
      return hasMastraMCP;
    }

    if (!configContents?.mcpServers) return false;
    const hasMastraMCP = Object.values(configContents.mcpServers).some((server?: any) =>
      server?.args?.find((arg?: string) => arg?.includes(`@mastra/mcp-docs-server`)),
    );

    return hasMastraMCP;
  } catch {
    return false;
  }
}
