import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { ensureToolProperties } from '../../utils';
import { createTool } from '../tool';

/**
 * Test for GitHub Issue #11244
 * https://github.com/mastra-ai/mastra/issues/11244
 *
 * When a user passes a function that returns a tool (instead of the tool itself),
 * the agent silently fails - the LLM makes a tool call but the tool never executes.
 * This should throw a descriptive error instead.
 */
describe('Malformed tool validation - Issue #11244', () => {
  it('should throw an error when a function is passed as a tool instead of a tool object', async () => {
    // This is the malformed pattern from the issue:
    // The user defined a function that returns a tool, but passed the function itself
    const scanFolderFactory = (rootFolder: string) =>
      createTool({
        id: 'scan-folder',
        description: 'Scans the content of a folder',
        inputSchema: z.object({
          path: z.string().optional(),
        }),
        execute: async () => {
          return `Scanned ${rootFolder}`;
        },
      });

    // User mistakenly passes the factory function instead of calling it
    const malformedTools = {
      scanFolder: scanFolderFactory, // BUG: Should be scanFolderFactory('/some/path')
    };

    // This should reject with an error, not silently accept a function
    await expect(ensureToolProperties(malformedTools as any)).rejects.toThrow(/not a valid tool format/i);
  });

  it('should provide a helpful error message that mentions the tool key', async () => {
    const badToolFactory = () =>
      createTool({
        id: 'bad-tool',
        description: 'A tool factory',
        execute: async () => ({}),
      });

    const malformedTools = {
      myBadTool: badToolFactory,
    };

    await expect(ensureToolProperties(malformedTools as any)).rejects.toThrow(/myBadTool/);
  });

  it('preserves deterministic Vercel tool IDs', async () => {
    const tools = await ensureToolProperties({
      search: {
        description: 'A deterministic description',
        parameters: z.object({ query: z.string() }),
        execute: async () => ({}),
      },
    } as any);

    expect((tools.search as any).id).toBe('tool-3579526b');
  });
});
