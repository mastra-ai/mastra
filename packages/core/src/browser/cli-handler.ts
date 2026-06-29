import { shellQuote, splitShellCommand, reassembleShellCommand } from '../workspace/sandbox/utils';
import type { MastraBrowser } from './browser';

/**
 * Configuration for a browser CLI provider.
 */
export interface BrowserCliConfig {
  /** Regex pattern to match the CLI command */
  pattern: RegExp;
  /** Flag used to pass CDP URL to the CLI */
  flag: string;
  /** Flag to pass threadId as session name for isolation */
  sessionFlag?: string;
  /** Command to run before other commands to establish CDP connection */
  warmupCommand?: (cdpUrl: string, threadId: string) => string;
  /** Pattern to detect agent-provided external CDP */
  externalCdpPattern?: RegExp;
  /** Pattern to extract the CDP URL from command (with capture group) */
  externalCdpExtractor?: RegExp;
}

/**
 * CLI provider patterns for CDP URL injection.
 * Maps CLI command prefixes to their CDP URL flag.
 * All CLIs accept either port number or full WebSocket URL.
 * We use full URL for consistency.
 *
 * warmupCommand: Some CLIs (like agent-browser) need a "connect" command
 * to be run first to establish their daemon's CDP connection before other
 * commands will work properly.
 */
const CLI_CDP_PATTERNS: Record<string, BrowserCliConfig> = {
  'agent-browser': {
    pattern: /^agent-browser\b/,
    flag: '--cdp',
    sessionFlag: '--session',
    // agent-browser daemon needs explicit connect command to establish CDP connection
    // Must include session flag to isolate threads
    warmupCommand: (cdpUrl: string, threadId: string) =>
      `agent-browser --session ${shellQuote(threadId)} connect ${shellQuote(cdpUrl)}`,
    // agent-browser external CDP detection:
    // - "connect <url>" subcommand for external CDP
    // - "--cdp <url>" with full wss:// URL (not just port) also indicates external CDP
    // External CDP: "connect <url>", "--cdp <url>", or "--cdp <port>"
    externalCdpPattern: /(?:\bconnect\s+["']?wss?:\/\/|--cdp\s+["']?\S)/,
    // Extract URL from: connect "wss://..." or --cdp "wss://..." (ports don't have extractable URLs)
    externalCdpExtractor: /(?:\bconnect|--cdp)\s+["']?(wss?:\/\/[^\s"']+)["']?/,
  },
  'browser-use': {
    // browser-use CLI installs as multiple aliases: browser, browseruse, bu
    // The skill docs say "browser-use" but the primary binary is "browser"
    // Order matters: longer matches first to avoid "browser" matching before "browser-use"
    pattern: /^(?:browser-use|browseruse|browser|bu)\b/,
    flag: '--cdp-url',
    sessionFlag: '--session',
    // browser-use uses --cdp-url for external CDP
    externalCdpPattern: /--cdp-url\s+["']?\S+/,
    // Extract URL from: --cdp-url "wss://..." or --cdp-url 'wss://...' or --cdp-url wss://...
    externalCdpExtractor: /--cdp-url\s+["']?(wss?:\/\/[^\s"']+)["']?/,
  },
  browse: {
    pattern: /^browse\b/,
    flag: '--ws',
    // browse uses --ws for external CDP
    externalCdpPattern: /--ws\s+["']?\S+/,
    // Extract URL from: --ws "wss://..." or --ws 'wss://...' or --ws wss://...
    externalCdpExtractor: /--ws\s+["']?(wss?:\/\/[^\s"']+)["']?/,
  },
};

/**
 * Result of processing a command for browser CLI handling.
 */
export interface BrowserCliProcessResult {
  /** The (potentially modified) command to execute */
  command: string;
  /** Warmup commands that need to be run before the main command */
  warmupCommands: string[];
  /** Whether external CDP was detected (agent managing their own browser) */
  usingExternalCdp: boolean;
  /** External CDP URL if detected */
  externalCdpUrl?: string;
}

/**
 * Handles browser CLI detection, CDP injection, and warmup for execute_command.
 * Centralizes all browser CLI-specific logic that was previously in execute-command.ts.
 */
export class BrowserCliHandler {
  /**
   * Track which CLI providers have been warmed up per browser instance and thread.
   * Key format: `${browserId}:${cliName}:${threadId}`
   * Browser ID scopes warmup state so different agents/workspaces don't share state.
   * @internal Exposed for testing
   */
  warmedUpClis = new Set<string>();

  /**
   * Track cleanup callbacks for warmed up CLIs to avoid duplicate registrations.
   * Key format: `${browserId}:${cliName}:${threadId}`
   * @internal Exposed for testing
   */
  warmupCleanups = new Map<string, () => void>();

  /**
   * Build a warmup key scoped to browser instance.
   */
  private makeWarmupKey(browserId: string, cliName: string, threadId: string): string {
    return `${browserId}:${cliName}:${threadId}`;
  }

  /**
   * Check if a command is a browser CLI command and return its config.
   */
  getBrowserCliConfig(command: string): { name: string; config: BrowserCliConfig } | null {
    for (const [name, config] of Object.entries(CLI_CDP_PATTERNS)) {
      if (config.pattern.test(command)) {
        return { name, config };
      }
    }
    return null;
  }

  /**
   * Check if any browser CLI command already has a CDP flag specified.
   * If so, the agent is managing their own CDP connection and we should skip injection.
   */
  hasExternalCdpFlag(parts: string[]): boolean {
    for (const part of parts) {
      const match = this.getBrowserCliConfig(part.trim());
      if (match) {
        // Use provider-specific pattern if available, otherwise fall back to flag pattern
        if (match.config.externalCdpPattern) {
          if (match.config.externalCdpPattern.test(part)) {
            return true;
          }
        } else {
          const flagPattern = new RegExp(`${match.config.flag}\\s+\\S+`);
          if (flagPattern.test(part)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Extract external CDP URL from command parts.
   * Returns the first CDP URL found, or null if none.
   */
  extractExternalCdpUrl(parts: string[]): string | null {
    for (const part of parts) {
      const match = this.getBrowserCliConfig(part.trim());
      if (match?.config.externalCdpExtractor) {
        const urlMatch = part.match(match.config.externalCdpExtractor);
        if (urlMatch?.[1]) {
          return urlMatch[1];
        }
      }
    }
    return null;
  }

  /**
   * Inject CDP URL and session flag into a single browser CLI command.
   * Returns the modified command or the original if no injection needed.
   */
  private injectCdpUrlIntoSingleCommand(
    command: string,
    cdpUrl: string,
    config: BrowserCliConfig,
    threadId?: string,
  ): string {
    // Check if CDP flag is already present
    const flagPattern = new RegExp(`${config.flag}\\s+\\S+`);
    if (flagPattern.test(command)) {
      return command; // Already has CDP URL, don't override
    }

    // Build injection: CDP URL + session flag (for thread isolation)
    // Use shell escaping to prevent command injection from crafted values
    let injection = `${config.flag} ${shellQuote(cdpUrl)}`;
    if (config.sessionFlag && threadId) {
      // Check if session flag already present
      const sessionPattern = new RegExp(`${config.sessionFlag}\\s+\\S+`);
      if (!sessionPattern.test(command)) {
        injection += ` ${config.sessionFlag} ${shellQuote(threadId)}`;
      }
    }

    // Inject flags after the CLI command name
    return command.replace(config.pattern, `$& ${injection}`);
  }

  /**
   * Inject CDP URL and session flag into all browser CLI commands in a potentially
   * chained command string (commands joined by &&, ||, or ;).
   */
  injectCdpUrl(command: string, cdpUrl: string, threadId?: string): string {
    const { parts, operators } = splitShellCommand(command);

    const modifiedParts = parts.map((part: string) => {
      const trimmed = part.trim();
      const cliMatch = this.getBrowserCliConfig(trimmed);
      if (cliMatch) {
        return this.injectCdpUrlIntoSingleCommand(trimmed, cdpUrl, cliMatch.config, threadId);
      }
      return part; // Keep original (preserves whitespace)
    });

    return reassembleShellCommand(modifiedParts, operators);
  }

  /**
   * Check if a warmup has been completed for a browser/CLI/thread combination.
   */
  isWarmedUp(browserId: string, cliName: string, threadId: string): boolean {
    return this.warmedUpClis.has(this.makeWarmupKey(browserId, cliName, threadId));
  }

  /**
   * Mark a browser/CLI/thread combination as warmed up.
   */
  markWarmedUp(browserId: string, cliName: string, threadId: string): void {
    this.warmedUpClis.add(this.makeWarmupKey(browserId, cliName, threadId));
  }

  /**
   * Register a cleanup callback for when a browser closes.
   * The cleanup will remove the warmup state for the given browser/CLI/thread.
   */
  registerWarmupCleanup(browserId: string, cliName: string, threadId: string, browser: MastraBrowser): void {
    const warmupKey = this.makeWarmupKey(browserId, cliName, threadId);
    if (!this.warmupCleanups.has(warmupKey)) {
      const cleanup = browser.onBrowserClosed(() => {
        this.warmedUpClis.delete(warmupKey);
        this.warmupCleanups.delete(warmupKey);
      }, threadId);
      this.warmupCleanups.set(warmupKey, cleanup);
    }
  }

  /**
   * Get warmup commands that need to be run for the detected browser CLIs.
   */
  getWarmupCommands(
    browserId: string,
    browserClis: Array<{ name: string; config: BrowserCliConfig }>,
    cdpUrl: string,
    threadId: string,
  ): Array<{ cliName: string; command: string }> {
    const warmups: Array<{ cliName: string; command: string }> = [];
    const seen = new Set<string>();

    for (const { name: cliName, config: cliConfig } of browserClis) {
      // Deduplicate: if same CLI appears multiple times in chained command, only warmup once
      if (seen.has(cliName)) continue;
      seen.add(cliName);

      if (cliConfig.warmupCommand && !this.isWarmedUp(browserId, cliName, threadId)) {
        warmups.push({
          cliName,
          command: cliConfig.warmupCommand(cdpUrl, threadId),
        });
      }
    }

    return warmups;
  }

  /**
   * Process a command for browser CLI handling.
   * Detects browser CLIs, checks for external CDP, and prepares injection.
   *
   * This is the main entry point - call this from execute-command.ts.
   */
  analyzeCommand(command: string): {
    /** Detected browser CLIs in the command */
    browserClis: Array<{ name: string; config: BrowserCliConfig }>;
    /** Command parts split by shell operators */
    parts: string[];
    /** Whether external CDP was detected */
    usingExternalCdp: boolean;
    /** External CDP URL if detected */
    externalCdpUrl: string | null;
  } {
    const { parts } = splitShellCommand(command);

    const browserClis = parts
      .map((part: string) => this.getBrowserCliConfig(part.trim()))
      .filter((match): match is NonNullable<typeof match> => match !== null);

    const usingExternalCdp = this.hasExternalCdpFlag(parts);
    const externalCdpUrl = usingExternalCdp ? this.extractExternalCdpUrl(parts) : null;

    return {
      browserClis,
      parts,
      usingExternalCdp,
      externalCdpUrl,
    };
  }
}

/**
 * Singleton instance for use across the application.
 * This preserves warmup state across command executions.
 */
export const browserCliHandler = new BrowserCliHandler();
