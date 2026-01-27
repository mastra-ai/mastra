/**
 * File Manager Agent - A durable agent for file operations
 *
 * This demonstrates a durable agent that performs file operations
 * with tool approval required for write operations.
 */

import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { pubsub } from './research-agent';

// Read file tool (no approval required)
const readFileTool = createTool({
  id: 'read-file',
  description: 'Read the contents of a file',
  inputSchema: z.object({
    path: z.string().describe('The file path to read'),
  }),
  outputSchema: z.object({
    content: z.string(),
    exists: z.boolean(),
  }),
  execute: async inputData => {
    const { path } = inputData;
    console.log(`[read-file] Reading: ${path}`);

    // Simulate file read
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      content: `Contents of ${path}:\n\nThis is simulated file content for demo purposes.`,
      exists: true,
    };
  },
});

// Write file tool (requires approval)
const writeFileTool = createTool({
  id: 'write-file',
  description: 'Write content to a file',
  inputSchema: z.object({
    path: z.string().describe('The file path to write to'),
    content: z.string().describe('The content to write'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    bytesWritten: z.number(),
  }),
  requireApproval: true, // This tool requires user approval
  execute: async inputData => {
    const { path, content } = inputData;
    console.log(`[write-file] Writing to: ${path}`);

    // Simulate file write
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      success: true,
      bytesWritten: content.length,
    };
  },
});

// Create the base agent
const fileManagerAgentBase = new Agent({
  id: 'file-manager-agent-base',
  name: 'File Manager Agent (Base)',
  model: 'openai/gpt-4o',
  instructions: `You are a file management assistant that helps users read and write files.

When asked to read files, use the read-file tool.
When asked to write files, use the write-file tool.

Be careful with write operations - always confirm what you're about to write before doing so.`,
  tools: {
    readFile: readFileTool,
    writeFile: writeFileTool,
  },
});

// Wrap with durable execution via the evented workflow engine
export const fileManagerAgent = createEventedAgent({
  agent: fileManagerAgentBase,
  id: 'file-manager-agent',
  name: 'File Manager Agent',
  pubsub,
});
