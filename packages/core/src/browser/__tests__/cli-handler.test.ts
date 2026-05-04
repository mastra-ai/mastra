import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { MastraBrowser } from '../browser';
import { BrowserCliHandler } from '../cli-handler';

describe('BrowserCliHandler', () => {
  let handler: BrowserCliHandler;

  beforeEach(() => {
    handler = new BrowserCliHandler();
  });

  describe('getBrowserCliConfig', () => {
    it('detects agent-browser commands', () => {
      const result = handler.getBrowserCliConfig('agent-browser open https://google.com');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('agent-browser');
      expect(result!.config.flag).toBe('--cdp');
    });

    it('detects browser-use commands with various aliases', () => {
      const aliases = ['browser-use', 'browseruse', 'browser', 'bu'];
      for (const alias of aliases) {
        const result = handler.getBrowserCliConfig(`${alias} open google.com`);
        expect(result).not.toBeNull();
        expect(result!.name).toBe('browser-use');
        expect(result!.config.flag).toBe('--cdp-url');
      }
    });

    it('detects browse commands', () => {
      const result = handler.getBrowserCliConfig('browse navigate https://example.com');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('browse');
      expect(result!.config.flag).toBe('--ws');
    });

    it('returns null for non-browser commands', () => {
      expect(handler.getBrowserCliConfig('ls -la')).toBeNull();
      expect(handler.getBrowserCliConfig('npm install')).toBeNull();
      expect(handler.getBrowserCliConfig('echo hello')).toBeNull();
    });

    it('does not match when CLI name is in the middle of another word', () => {
      // "mybrowser" should not match "browser" pattern
      expect(handler.getBrowserCliConfig('mybrowser test')).toBeNull();
      // "notbrowse" should not match "browse" pattern
      expect(handler.getBrowserCliConfig('notbrowse test')).toBeNull();
    });

    it('matches hyphenated extensions due to word boundary behavior', () => {
      // `\b` treats hyphens as word boundaries, so "browser-use-extra" matches "browser-use"
      // This is expected behavior - the command still starts with a valid CLI name
      const result = handler.getBrowserCliConfig('browser-use-extra test');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('browser-use');
    });
  });

  describe('hasExternalCdpFlag', () => {
    describe('agent-browser', () => {
      it('detects connect subcommand with wss URL', () => {
        const parts = ['agent-browser connect wss://cdp.example.com/devtools'];
        expect(handler.hasExternalCdpFlag(parts)).toBe(true);
      });

      it('detects connect subcommand with ws URL', () => {
        const parts = ['agent-browser connect ws://localhost:9222'];
        expect(handler.hasExternalCdpFlag(parts)).toBe(true);
      });

      it('detects --cdp flag with full wss URL', () => {
        const parts = ['agent-browser --cdp wss://cdp.example.com open https://google.com'];
        expect(handler.hasExternalCdpFlag(parts)).toBe(true);
      });

      it('detects --cdp flag with port number as external', () => {
        // Port-only --cdp connects to existing Chrome on that port
        const parts = ['agent-browser --cdp 9222 open https://google.com'];
        expect(handler.hasExternalCdpFlag(parts)).toBe(true);
      });

      it('does not detect connect without URL', () => {
        const parts = ['agent-browser connect'];
        expect(handler.hasExternalCdpFlag(parts)).toBe(false);
      });
    });

    describe('browser-use', () => {
      it('detects --cdp-url flag', () => {
        const parts = ['browser --cdp-url wss://cdp.example.com open google.com'];
        expect(handler.hasExternalCdpFlag(parts)).toBe(true);
      });

      it('detects --cdp-url with quoted URL', () => {
        const parts = ['browser --cdp-url "wss://cdp.example.com" open google.com'];
        expect(handler.hasExternalCdpFlag(parts)).toBe(true);
      });
    });

    describe('browse', () => {
      it('detects --ws flag', () => {
        const parts = ['browse --ws wss://cdp.example.com navigate https://example.com'];
        expect(handler.hasExternalCdpFlag(parts)).toBe(true);
      });
    });

    it('detects external CDP in chained commands', () => {
      const parts = ['echo hello', 'agent-browser connect wss://cdp.example.com', 'ls'];
      expect(handler.hasExternalCdpFlag(parts)).toBe(true);
    });

    it('returns false when no external CDP detected', () => {
      const parts = ['agent-browser open https://google.com', 'echo done'];
      expect(handler.hasExternalCdpFlag(parts)).toBe(false);
    });
  });

  describe('extractExternalCdpUrl', () => {
    it('extracts URL from agent-browser connect command', () => {
      const parts = ['agent-browser connect wss://cdp.example.com/devtools/browser/123'];
      expect(handler.extractExternalCdpUrl(parts)).toBe('wss://cdp.example.com/devtools/browser/123');
    });

    it('extracts URL from agent-browser --cdp flag', () => {
      const parts = ['agent-browser --cdp wss://cdp.example.com open https://google.com'];
      expect(handler.extractExternalCdpUrl(parts)).toBe('wss://cdp.example.com');
    });

    it('extracts URL from browser-use --cdp-url flag', () => {
      const parts = ['browser --cdp-url wss://cdp.example.com/ws open google.com'];
      expect(handler.extractExternalCdpUrl(parts)).toBe('wss://cdp.example.com/ws');
    });

    it('extracts URL from quoted strings', () => {
      const parts = ['agent-browser connect "wss://cdp.example.com/devtools"'];
      expect(handler.extractExternalCdpUrl(parts)).toBe('wss://cdp.example.com/devtools');
    });

    it('extracts URL from single-quoted strings', () => {
      const parts = ["agent-browser connect 'wss://cdp.example.com/devtools'"];
      expect(handler.extractExternalCdpUrl(parts)).toBe('wss://cdp.example.com/devtools');
    });

    it('returns first CDP URL found in chained commands', () => {
      const parts = [
        'agent-browser connect wss://first.example.com',
        'browse --ws wss://second.example.com navigate https://test.com',
      ];
      expect(handler.extractExternalCdpUrl(parts)).toBe('wss://first.example.com');
    });

    it('returns null when no external CDP URL present', () => {
      const parts = ['agent-browser open https://google.com'];
      expect(handler.extractExternalCdpUrl(parts)).toBeNull();
    });
  });

  describe('injectCdpUrl', () => {
    const cdpUrl = 'ws://localhost:9222/devtools/browser/abc123';
    const threadId = 'thread-001';

    describe('agent-browser', () => {
      it('injects CDP URL and session flag', () => {
        const result = handler.injectCdpUrl('agent-browser open https://google.com', cdpUrl, threadId);
        expect(result).toContain('--cdp');
        expect(result).toContain('--session');
        expect(result).toMatch(/agent-browser --cdp .+ --session .+ open/);
      });

      it('does not inject if CDP flag already present', () => {
        const original = 'agent-browser --cdp wss://other.com open https://google.com';
        const result = handler.injectCdpUrl(original, cdpUrl, threadId);
        expect(result).toBe(original);
      });

      it('does not inject session flag if already present', () => {
        const original = 'agent-browser --session existing-session open https://google.com';
        const result = handler.injectCdpUrl(original, cdpUrl, threadId);
        expect(result).toContain('--cdp');
        expect(result).not.toMatch(/--session.*--session/); // Only one --session
      });
    });

    describe('browser-use', () => {
      it('injects CDP URL and session flag', () => {
        const result = handler.injectCdpUrl('browser open google.com', cdpUrl, threadId);
        expect(result).toContain('--cdp-url');
        expect(result).toContain('--session');
      });

      it('works with all aliases', () => {
        for (const alias of ['browser-use', 'browseruse', 'browser', 'bu']) {
          const result = handler.injectCdpUrl(`${alias} open google.com`, cdpUrl, threadId);
          expect(result).toContain('--cdp-url');
        }
      });
    });

    describe('browse', () => {
      it('injects CDP URL without session flag (browse has no session flag)', () => {
        const result = handler.injectCdpUrl('browse navigate https://example.com', cdpUrl, threadId);
        expect(result).toContain('--ws');
        expect(result).not.toContain('--session');
      });
    });

    describe('chained commands', () => {
      it('injects into multiple browser CLI commands', () => {
        const command = 'agent-browser open https://google.com && agent-browser snapshot';
        const result = handler.injectCdpUrl(command, cdpUrl, threadId);

        // Both commands should have injection
        const parts = result.split('&&');
        expect(parts[0]).toContain('--cdp');
        expect(parts[1]).toContain('--cdp');
      });

      it('only injects into browser CLI parts', () => {
        const command = 'echo "Starting" && agent-browser open https://google.com && echo "Done"';
        const result = handler.injectCdpUrl(command, cdpUrl, threadId);

        expect(result).toContain('echo "Starting"');
        expect(result).toContain('--cdp');
        expect(result).toContain('echo "Done"');
      });

      it('handles || and ; operators', () => {
        const command = 'agent-browser open https://google.com || browse navigate https://example.com';
        const result = handler.injectCdpUrl(command, cdpUrl, threadId);

        expect(result).toContain('--cdp');
        expect(result).toContain('--ws');
        expect(result).toContain('||');
      });
    });

    it('escapes special characters in URLs', () => {
      const specialUrl = "ws://localhost:9222/devtools?foo=bar&baz='test'";
      const result = handler.injectCdpUrl('agent-browser open https://google.com', specialUrl, threadId);

      // Should be shell-escaped - verify the full escaped URL is present
      // Single quotes in URL get escaped as '\'' (end quote, escaped quote, start quote)
      expect(result).toContain("'ws://localhost:9222/devtools?foo=bar&baz='\\''test'\\'''");
    });

    it('escapes special characters in thread IDs', () => {
      const specialThreadId = 'thread;rm -rf /';
      const result = handler.injectCdpUrl('agent-browser open https://google.com', cdpUrl, specialThreadId);

      // Should be shell-escaped to prevent command injection
      expect(result).toContain("'thread;rm -rf /'");
    });
  });

  describe('warmup state management', () => {
    const browserId = 'browser-123';
    const cliName = 'agent-browser';
    const threadId = 'thread-001';

    it('tracks warmup state correctly', () => {
      expect(handler.isWarmedUp(browserId, cliName, threadId)).toBe(false);

      handler.markWarmedUp(browserId, cliName, threadId);

      expect(handler.isWarmedUp(browserId, cliName, threadId)).toBe(true);
    });

    it('isolates warmup state by browser ID', () => {
      handler.markWarmedUp('browser-1', cliName, threadId);

      expect(handler.isWarmedUp('browser-1', cliName, threadId)).toBe(true);
      expect(handler.isWarmedUp('browser-2', cliName, threadId)).toBe(false);
    });

    it('isolates warmup state by CLI name', () => {
      handler.markWarmedUp(browserId, 'agent-browser', threadId);

      expect(handler.isWarmedUp(browserId, 'agent-browser', threadId)).toBe(true);
      expect(handler.isWarmedUp(browserId, 'browser-use', threadId)).toBe(false);
    });

    it('isolates warmup state by thread ID', () => {
      handler.markWarmedUp(browserId, cliName, 'thread-1');

      expect(handler.isWarmedUp(browserId, cliName, 'thread-1')).toBe(true);
      expect(handler.isWarmedUp(browserId, cliName, 'thread-2')).toBe(false);
    });

    it('registers cleanup callback and clears state on browser close', () => {
      const cleanupCallback = vi.fn();
      let onBrowserClosedCallback: (() => void) | undefined;

      const mockBrowser = {
        onBrowserClosed: vi.fn((callback: () => void, _threadId: string) => {
          onBrowserClosedCallback = callback;
          return cleanupCallback;
        }),
      } as unknown as MastraBrowser;

      handler.markWarmedUp(browserId, cliName, threadId);
      handler.registerWarmupCleanup(browserId, cliName, threadId, mockBrowser);

      expect(handler.isWarmedUp(browserId, cliName, threadId)).toBe(true);

      // Simulate browser close
      onBrowserClosedCallback?.();

      expect(handler.isWarmedUp(browserId, cliName, threadId)).toBe(false);
    });

    it('does not register duplicate cleanup callbacks', () => {
      const mockBrowser = {
        onBrowserClosed: vi.fn(() => () => {}),
      } as unknown as MastraBrowser;

      handler.registerWarmupCleanup(browserId, cliName, threadId, mockBrowser);
      handler.registerWarmupCleanup(browserId, cliName, threadId, mockBrowser);

      expect(mockBrowser.onBrowserClosed).toHaveBeenCalledTimes(1);
    });
  });

  describe('getWarmupCommands', () => {
    const browserId = 'browser-123';
    const cdpUrl = 'ws://localhost:9222/devtools/browser/abc123';
    const threadId = 'thread-001';

    it('returns warmup command for agent-browser', () => {
      const clis = [{ name: 'agent-browser', config: handler.getBrowserCliConfig('agent-browser open')!.config }];
      const warmups = handler.getWarmupCommands(browserId, clis, cdpUrl, threadId);

      expect(warmups).toHaveLength(1);
      expect(warmups[0].cliName).toBe('agent-browser');
      expect(warmups[0].command).toContain('agent-browser');
      expect(warmups[0].command).toContain('connect');
      expect(warmups[0].command).toContain(threadId);
    });

    it('returns empty array for browser-use (no warmup needed)', () => {
      const clis = [{ name: 'browser-use', config: handler.getBrowserCliConfig('browser open')!.config }];
      const warmups = handler.getWarmupCommands(browserId, clis, cdpUrl, threadId);

      expect(warmups).toHaveLength(0);
    });

    it('returns empty array for browse (no warmup needed)', () => {
      const clis = [{ name: 'browse', config: handler.getBrowserCliConfig('browse navigate')!.config }];
      const warmups = handler.getWarmupCommands(browserId, clis, cdpUrl, threadId);

      expect(warmups).toHaveLength(0);
    });

    it('deduplicates warmup commands for same CLI appearing multiple times', () => {
      const clis = [
        { name: 'agent-browser', config: handler.getBrowserCliConfig('agent-browser open')!.config },
        { name: 'agent-browser', config: handler.getBrowserCliConfig('agent-browser snapshot')!.config },
      ];
      const warmups = handler.getWarmupCommands(browserId, clis, cdpUrl, threadId);

      expect(warmups).toHaveLength(1);
    });

    it('skips already warmed up CLIs', () => {
      handler.markWarmedUp(browserId, 'agent-browser', threadId);

      const clis = [{ name: 'agent-browser', config: handler.getBrowserCliConfig('agent-browser open')!.config }];
      const warmups = handler.getWarmupCommands(browserId, clis, cdpUrl, threadId);

      expect(warmups).toHaveLength(0);
    });
  });

  describe('analyzeCommand', () => {
    it('detects single browser CLI', () => {
      const result = handler.analyzeCommand('agent-browser open https://google.com');

      expect(result.browserClis).toHaveLength(1);
      expect(result.browserClis[0].name).toBe('agent-browser');
      expect(result.usingExternalCdp).toBe(false);
      expect(result.externalCdpUrl).toBeNull();
    });

    it('detects multiple browser CLIs in chained command', () => {
      const result = handler.analyzeCommand(
        'agent-browser open https://google.com && browse navigate https://example.com',
      );

      expect(result.browserClis).toHaveLength(2);
      expect(result.browserClis.map(c => c.name)).toEqual(['agent-browser', 'browse']);
    });

    it('detects external CDP with URL extraction', () => {
      const result = handler.analyzeCommand('agent-browser connect wss://cdp.example.com/devtools');

      expect(result.usingExternalCdp).toBe(true);
      expect(result.externalCdpUrl).toBe('wss://cdp.example.com/devtools');
    });

    it('returns empty arrays for non-browser commands', () => {
      const result = handler.analyzeCommand('npm install && ls -la');

      expect(result.browserClis).toHaveLength(0);
      expect(result.parts).toHaveLength(2);
      expect(result.usingExternalCdp).toBe(false);
    });

    it('handles mixed browser and non-browser commands', () => {
      const result = handler.analyzeCommand('echo "Starting" && agent-browser open https://google.com && echo "Done"');

      expect(result.browserClis).toHaveLength(1);
      expect(result.parts).toHaveLength(3);
    });
  });
});
