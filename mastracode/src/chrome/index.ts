import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { McpServerConfig } from '../mcp/types.js';

export const CHROME_MCP_SERVER_NAME = 'claude-in-chrome';

/**
 * Find the `claude` CLI binary path.
 * Returns undefined if the binary is not found.
 */
export function findClaudeBinary(): string | undefined {
  try {
    const result = execSync('which claude', { encoding: 'utf-8' }).trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse --chrome / --no-chrome from process.argv.
 * Returns true if --chrome is present, false if --no-chrome is present, undefined otherwise.
 */
export function parseChromeFlag(argv: string[] = process.argv): boolean | undefined {
  for (let i = argv.length - 1; i >= 0; i--) {
    if (argv[i] === '--chrome') return true;
    if (argv[i] === '--no-chrome') return false;
  }
  return undefined;
}

/**
 * Build the MCP server config for the claude-in-chrome extension.
 * Forces tengu_copper_bridge=false via --settings to avoid connection issues.
 */
export function buildChromeMcpConfig(claudeBinary: string): McpServerConfig {
  const settings = JSON.stringify({
    cachedGrowthBookFeatures: {
      tengu_copper_bridge: false,
    },
  });

  return {
    command: claudeBinary,
    args: ['--claude-in-chrome-mcp', '--settings', settings],
    env: {
      CLAUDE_CHROME_PERMISSION_MODE: 'skip_all_permission_checks',
    },
  };
}

/**
 * Run diagnostics to detect common Chrome extension issues.
 * Logs warnings if potential conflicts are found.
 */
export function runChromeDiagnostics(): void {
  // Check for Claude Desktop app native host conflict (macOS only)
  if (process.platform === 'darwin') {
    const nativeHostManifestPath = join(
      homedir(),
      'Library',
      'Application Support',
      'Google',
      'Chrome',
      'NativeMessagingHosts',
      'com.anthropic.claude_desktop.chrome.json',
    );
    if (existsSync(nativeHostManifestPath)) {
      console.info(
        'Chrome: Warning — Claude Desktop native messaging host detected. ' +
          'This may conflict with the Claude CLI Chrome extension. ' +
          'If you experience issues, quit Claude Desktop or remove ' +
          nativeHostManifestPath,
      );
    }
  }

  // Verify native host wrapper exists
  const nativeHostWrapper = join(homedir(), '.claude', 'chrome', 'chrome-native-host');
  if (!existsSync(nativeHostWrapper)) {
    console.info(
      'Chrome: Warning — native host wrapper not found at ' +
        nativeHostWrapper +
        '. Run "claude chrome install" to set up the Chrome extension.',
    );
  }
}
