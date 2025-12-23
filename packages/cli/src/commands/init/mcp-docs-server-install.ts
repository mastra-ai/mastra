import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureFile, readJSON, writeJSON } from 'fs-extra/esm';

const createArgs = (versionTag?: string) => {
  const packageName = versionTag ? `@mastra/mcp-docs-server@${versionTag}` : '@mastra/mcp-docs-server';
  return ['-y', packageName];
};

const createMcpConfig = (editor: Editor, versionTag?: string) => {
  const args = createArgs(versionTag);
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
}

function makeConfig(
  original: { mcpServers?: Record<string, unknown>; servers?: Record<string, unknown> },
  editor: Editor,
  versionTag?: string,
) {
  if (editor === 'vscode') {
    return {
      ...original,
      servers: {
        ...(original?.servers || {}),
        ...createMcpConfig(editor, versionTag).servers,
      },
    };
  }
  return {
    ...original,
    mcpServers: {
      ...(original?.mcpServers || {}),
      ...createMcpConfig(editor, versionTag).mcpServers,
    },
  };
}

async function writeMergedConfig(configPath: string, editor: Editor, versionTag?: string) {
  const configExists = existsSync(configPath);
  const config = makeConfig(configExists ? await readJSON(configPath) : {}, editor, versionTag);
  await ensureFile(configPath);
  await writeJSON(configPath, config, {
    spaces: 2,
  });
}

export const windsurfGlobalMCPConfigPath = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
export const antigravityGlobalMCPConfigPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
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

export const EDITOR = ['cursor', 'cursor-global', 'windsurf', 'vscode', 'antigravity'] as const;
export type Editor = (typeof EDITOR)[number];

export const MCP_SERVER = ['cursor', 'cursor-global', 'windsurf', 'antigravity'] as const;
export type MCPServer = (typeof MCP_SERVER)[number];

/**
 * Type-guard to check if a string is a valid MCPServer
 */
export function isValidMCPServer(value: string): value is MCPServer {
  return MCP_SERVER.includes(value as MCPServer);
}

/**
 * Type-guard to check if a string is a valid Editor
 */
export function isValidEditor(value: string): value is Editor {
  return EDITOR.includes(value as Editor);
}

export async function installMastraDocsMCPServer({
  editor,
  directory,
  versionTag,
}: {
  editor?: Editor;
  directory: string;
  versionTag?: string;
}) {
  if (editor === `cursor`) {
    await writeMergedConfig(path.join(directory, '.cursor', 'mcp.json'), 'cursor', versionTag);
  }
  if (editor === `vscode`) {
    await writeMergedConfig(path.join(directory, '.vscode', 'mcp.json'), 'vscode', versionTag);
  }
  if (editor === `cursor-global`) {
    const alreadyInstalled = await globalMCPIsAlreadyInstalled(editor, versionTag);
    if (alreadyInstalled) {
      return;
    }
    await writeMergedConfig(cursorGlobalMCPConfigPath, 'cursor-global', versionTag);
  }

  if (editor === `windsurf`) {
    const alreadyInstalled = await globalMCPIsAlreadyInstalled(editor, versionTag);
    if (alreadyInstalled) {
      return;
    }
    await writeMergedConfig(windsurfGlobalMCPConfigPath, editor, versionTag);
  }

  if (editor === `antigravity`) {
    const alreadyInstalled = await globalMCPIsAlreadyInstalled(editor, versionTag);
    if (alreadyInstalled) {
      return;
    }
    await writeMergedConfig(antigravityGlobalMCPConfigPath, editor, versionTag);
  }
}

export async function globalMCPIsAlreadyInstalled(editor: Editor, versionTag?: string) {
  let configPath: string = ``;

  if (editor === 'windsurf') {
    configPath = windsurfGlobalMCPConfigPath;
  } else if (editor === 'antigravity') {
    configPath = antigravityGlobalMCPConfigPath;
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

    // Construct the expected package string based on versionTag
    const expectedPackage = versionTag ? `@mastra/mcp-docs-server@${versionTag}` : '@mastra/mcp-docs-server';

    if (editor === 'vscode') {
      if (!configContents.servers) return false;
      const hasMastraMCP = Object.values(configContents.servers).some((server?: any) =>
        server?.args?.find((arg?: string) => arg === expectedPackage),
      );
      return hasMastraMCP;
    }

    if (!configContents?.mcpServers) return false;
    const hasMastraMCP = Object.values(configContents.mcpServers).some((server?: any) =>
      server?.args?.find((arg?: string) => arg === expectedPackage),
    );

    return hasMastraMCP;
  } catch {
    return false;
  }
}
