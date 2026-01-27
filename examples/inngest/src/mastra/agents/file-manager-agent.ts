/**
 * File Manager Agent - Tool Approval Example
 *
 * This demonstrates a durable agent with tool approval. Dangerous operations
 * like file deletion require human approval before execution. The agent
 * suspends, waits for approval, then resumes execution.
 *
 * Flow:
 * 1. User asks to delete files
 * 2. Agent calls delete-file tool
 * 3. Workflow suspends, onSuspended callback fires
 * 4. Human reviews and approves/rejects
 * 5. Resume with approval -> tool executes
 *    Resume with rejection -> agent gets rejection message
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createInngestAgent } from '@mastra/inngest';
import { z } from 'zod';

import { inngest } from '../workflows/inngest-workflow';

// Simulated file system for demo
const fileSystem: Record<string, { content: string; size: number }> = {
  'report.pdf': { content: 'Annual report 2024...', size: 1024000 },
  'data.csv': { content: 'id,name,value\n1,foo,100\n2,bar,200', size: 2048 },
  'config.json': { content: '{"debug": true}', size: 256 },
  'backup.zip': { content: '[binary data]', size: 50000000 },
};

// List files tool - safe, no approval needed
const listFilesTool = createTool({
  id: 'list-files',
  description: 'List all files in the system',
  inputSchema: z.object({}),
  outputSchema: z.object({
    files: z.array(
      z.object({
        name: z.string(),
        size: z.number(),
      }),
    ),
  }),
  execute: async () => {
    console.log('[list-files] Listing files...');
    return {
      files: Object.entries(fileSystem).map(([name, { size }]) => ({
        name,
        size,
      })),
    };
  },
});

// Read file tool - safe, no approval needed
const readFileTool = createTool({
  id: 'read-file',
  description: 'Read the contents of a file',
  inputSchema: z.object({
    filename: z.string().describe('The name of the file to read'),
  }),
  outputSchema: z.object({
    content: z.string(),
    size: z.number(),
  }),
  execute: async inputData => {
    const { filename } = inputData;
    console.log(`[read-file] Reading: ${filename}`);

    const file = fileSystem[filename];
    if (!file) {
      throw new Error(`File not found: ${filename}`);
    }

    return {
      content: file.content,
      size: file.size,
    };
  },
});

// Delete file tool - DANGEROUS, requires approval
const deleteFileTool = createTool({
  id: 'delete-file',
  description: 'Delete a file from the system. This is a destructive operation that requires approval.',
  inputSchema: z.object({
    filename: z.string().describe('The name of the file to delete'),
    reason: z.string().describe('The reason for deleting this file'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async inputData => {
    const { filename, reason } = inputData;
    console.log(`[delete-file] Deleting: ${filename} (reason: ${reason})`);

    if (!fileSystem[filename]) {
      return {
        success: false,
        message: `File not found: ${filename}`,
      };
    }

    // Actually delete the file
    delete fileSystem[filename];

    return {
      success: true,
      message: `Successfully deleted ${filename}`,
    };
  },
});

// Create the base agent
const fileManagerAgentBase = new Agent({
  id: 'file-manager-agent',
  name: 'File Manager Agent',
  model: 'openai/gpt-4o',
  instructions: `You are a file management assistant that helps users organize and manage their files.

You have access to the following tools:
- list-files: List all files in the system
- read-file: Read the contents of a file
- delete-file: Delete a file (requires approval)

When asked to delete files:
1. First list the files to confirm what exists
2. Confirm the file exists before attempting deletion
3. Always provide a clear reason when deleting

Be helpful and explain what you're doing at each step.`,
  tools: {
    listFiles: listFilesTool,
    readFile: readFileTool,
    deleteFile: deleteFileTool,
  },
});

// Wrap with durable execution via Inngest
export const fileManagerAgent = createInngestAgent({
  agent: fileManagerAgentBase,
  inngest,
});
