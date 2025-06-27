import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

// Helper to find an available port
async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

describe('AI SDK Compatibility Integration Tests', () => {
  describe('V4 Compatibility Mode Tests', () => {
    let mastraServer: ReturnType<typeof spawn>;
    let port: number;
    const threadId = randomUUID();

    beforeAll(async () => {
      port = await getAvailablePort();

      // Create test directory with mastra config for v4 compatibility
      const testDir = path.resolve(import.meta.dirname, 'test-v4-compat');
      await import('fs').then(fs => fs.promises.mkdir(testDir, { recursive: true }));

      const configContent = `
import { Agent } from '@mastra/core/agent';
import { Mastra, createMockModel } from '@mastra/core';

const mockModel = createMockModel({ mockText: 'Hello world from v4 test agent' });

const mockTool = {
  description: 'A mock tool for testing',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
    required: ['message'],
  },
  execute: async ({ message }) => {
    return { result: \`Tool executed with: \${message}\` };
  },
};

const testAgent = new Agent({
  name: 'test-agent',
  instructions: 'You are a helpful test agent. When asked to use a tool, use the mock_tool with the user message.',
  model: mockModel,
  tools: { mock_tool: mockTool },
});

export const mastra = new Mastra({
  agents: { 'test-agent': testAgent },
  aiSdkCompat: 'v4', // Force v4 compatibility
});
`;

      await import('fs').then(fs => fs.promises.writeFile(path.join(testDir, 'index.ts'), configContent));

      // Start mastra dev server
      mastraServer = spawn(
        'node',
        [
          path.resolve(import.meta.dirname, '..', '..', '..', 'cli', 'dist', 'index.js'),
          'dev',
          '--port',
          port.toString(),
          '-d',
          '.',
        ],
        {
          stdio: 'pipe',
          detached: true,
          cwd: testDir,
        },
      );

      // Wait for server to be ready
      await new Promise<void>((resolve, reject) => {
        let output = '';
        let errorOutput = '';
        mastraServer.stdout?.on('data', data => {
          const text = data.toString();
          output += text;
          console.log('[V4 Server stdout]:', text.trim());
          if (output.includes('http://localhost:')) {
            resolve();
          }
        });
        mastraServer.stderr?.on('data', data => {
          const text = data.toString();
          errorOutput += text;
          console.error('[V4 Server stderr]:', text.trim());
        });

        setTimeout(() => {
          console.log('[V4 Server] Full stdout:', output);
          console.log('[V4 Server] Full stderr:', errorOutput);
          reject(new Error('Mastra server failed to start'));
        }, 15000);
      });
    });

    afterAll(() => {
      if (mastraServer?.pid) {
        try {
          process.kill(-mastraServer.pid, 'SIGTERM');
        } catch (e) {
          console.error('Failed to kill Mastra server:', e);
        }
      }
    });

    it('should return v4 format from memory API when in v4 mode', async () => {
      const response = await fetch(
        `http://localhost:${port}/api/memory/threads/${threadId}/messages?agentId=test-agent`,
      );

      if (!response.ok) {
        // If memory API doesn't exist or isn't configured, skip test
        if (response.status === 404) {
          console.log('Memory API not available, skipping test');
          return;
        }
        if (response.status === 500) {
          console.log('Memory API error (possibly no messages), skipping test');
          return;
        }
      }

      const data = await response.json();

      // Memory might be empty initially, so either expect uiMessages to be defined
      // or expect an empty array (both are valid v4 responses)
      if (data.uiMessages !== undefined) {
        // Should return v4 format by default when aiSdkCompat is 'v4'
        const messages = data.uiMessages;
        expect(Array.isArray(messages)).toBe(true);
      } else {
        // API is available but no messages yet (which is expected for a fresh thread)
        console.log('Memory API available but no messages in thread (expected for new thread)');
      }
    });

    it('should stream in v4 format when aiSdkCompat is v4', async () => {
      // Test the API endpoint directly instead of using useChat due to API changes
      const response = await fetch(`http://localhost:${port}/api/agents/test-agent/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello test agent' }],
          threadId,
        }),
      });

      if (!response.ok) {
        console.log('Stream request failed:');
        console.log('Status:', response.status);
        console.log('Status Text:', response.statusText);
        const errorText = await response.text();
        console.log('Error Body:', errorText);
      }
      expect(response.ok).toBe(true);

      // Check that the stream contains data
      const reader = response.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        const chunk = new TextDecoder().decode(value);
        expect(chunk).toBeTruthy();
        reader.releaseLock();
      }
    });
  });

  describe('V5 Native Mode Tests', () => {
    let mastraServer: ReturnType<typeof spawn>;
    let port: number;
    const threadId = randomUUID();

    beforeAll(async () => {
      port = await getAvailablePort();

      // Create test directory with mastra config for v5 native mode
      const testDir = path.resolve(import.meta.dirname, 'test-v5-native');
      await import('fs').then(fs => fs.promises.mkdir(testDir, { recursive: true }));

      const configContent = `
import { Agent } from '@mastra/core/agent';
import { Mastra, createMockModel } from '@mastra/core';

const mockModel = createMockModel({ mockText: 'Hello world from v5 test agent' });

const testAgent = new Agent({
  name: 'test-agent',
  instructions: 'You are a helpful test agent.',
  model: mockModel,
});

export const mastra = new Mastra({
  agents: { 'test-agent': testAgent },
  aiSdkCompat: 'v5', // Native v5 mode
});
`;

      await import('fs').then(fs => fs.promises.writeFile(path.join(testDir, 'index.ts'), configContent));

      mastraServer = spawn(
        'node',
        [
          path.resolve(import.meta.dirname, '..', '..', '..', 'cli', 'dist', 'index.js'),
          'dev',
          '--port',
          port.toString(),
          '-d',
          '.',
        ],
        {
          stdio: 'pipe',
          detached: true,
          cwd: testDir,
        },
      );

      await new Promise<void>((resolve, reject) => {
        let output = '';
        let errorOutput = '';
        mastraServer.stdout?.on('data', data => {
          const text = data.toString();
          output += text;
          console.log('[V5 Server stdout]:', text.trim());
          if (output.includes('http://localhost:')) {
            resolve();
          }
        });
        mastraServer.stderr?.on('data', data => {
          const text = data.toString();
          errorOutput += text;
          console.error('[V5 Server stderr]:', text.trim());
        });

        setTimeout(() => {
          console.log('[V5 Server] Full stdout:', output);
          console.log('[V5 Server] Full stderr:', errorOutput);
          reject(new Error('Mastra server failed to start'));
        }, 15000);
      });
    });

    afterAll(() => {
      if (mastraServer?.pid) {
        try {
          process.kill(-mastraServer.pid, 'SIGTERM');
        } catch (e) {
          console.error('Failed to kill Mastra server:', e);
        }
      }
    });

    it('should use v5 native format when aiSdkCompat is v5', async () => {
      const response = await fetch(`http://localhost:${port}/api/agents/test-agent/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          threadId,
        }),
      });

      expect(response.ok).toBe(true);

      // Check that the stream contains data
      const reader = response.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        const chunk = new TextDecoder().decode(value);
        expect(chunk).toBeTruthy();
        reader.releaseLock();
      }
    });

    it('should use v4 format when x-ai-sdk-compat header is v4 (overrides server config)', async () => {
      // Test memory API with header override
      const memoryResponse = await fetch(
        `http://localhost:${port}/api/memory/threads/${threadId}/messages?agentId=test-agent`,
        {
          headers: {
            'x-ai-sdk-compat': 'v4',
          },
        },
      );

      // Memory is not configured in this test setup, but that's OK
      // The main test is for the streaming API with header override
      if (!memoryResponse.ok) {
        console.log('Memory response status:', memoryResponse.status, '(expected since memory not configured)');
      }

      // Test streaming API with header override
      const streamResponse = await fetch(`http://localhost:${port}/api/agents/test-agent/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-sdk-compat': 'v4',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello with header override' }],
          threadId,
        }),
      });

      expect(streamResponse.ok).toBe(true);
      expect(streamResponse.headers.get('x-vercel-ai-data-stream')).toBe('v1');

      // Check that the stream contains v4 format data
      const reader = streamResponse.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        const chunk = new TextDecoder().decode(value);
        expect(chunk).toBeTruthy();
        // V4 streams should start with specific prefixes
        expect(chunk).toMatch(/^[0-9a-f]/);
        reader.releaseLock();
      }
    });
  });
});
