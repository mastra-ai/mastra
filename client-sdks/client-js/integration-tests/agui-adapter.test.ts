import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import type { BaseEvent } from '@ag-ui/client';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AGUIAdapter } from '../src/adapters/agui';

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

describe('AGUIAdapter Integration Tests', () => {
  let mastraServer: ReturnType<typeof spawn>;
  let port: number;

  beforeAll(async () => {
    port = await getAvailablePort();

    // Run mastra dev from the integration tests directory using the built CLI
    const cliPath = path.resolve(import.meta.dirname, '..', '..', '..', 'packages', 'cli', 'dist', 'index.js');
    mastraServer = spawn('node', [cliPath, 'dev', '--port', port.toString()], {
      cwd: path.resolve(import.meta.dirname),
      stdio: 'pipe',
      detached: true, // Run in a new process group so we can kill it and children
    });

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      let output = '';
      mastraServer.stdout?.on('data', data => {
        output += data.toString();
        console.log(output);
        if (output.includes('http://localhost:')) {
          resolve();
        }
      });
      mastraServer.stderr?.on('data', data => {
        console.error('Mastra server error:', data.toString());
      });

      setTimeout(() => reject(new Error('Mastra server failed to start')), 10000);
    });
  });

  afterAll(() => {
    // Kill the server and its process group
    if (mastraServer?.pid) {
      try {
        process.kill(-mastraServer.pid, 'SIGTERM');
      } catch (e) {
        console.error('Failed to kill Mastra server:', e);
      }
    }
  });

  it('should correctly pass parameters to agent stream method with real server', async () => {
    // Create a client agent that communicates with the real server
    const { Agent: ClientAgent } = await import('../src/resources/agent');
    const clientAgent = new ClientAgent(
      {
        baseUrl: `http://localhost:${port}`,
        apiKey: 'test-key',
      },
      'test',
    );

    const adapter = new AGUIAdapter({
      agent: clientAgent,
      agentId: 'test',
      resourceId: 'testAgent',
    });

    const input = {
      threadId: 'test-thread-id',
      runId: 'test-run-id',
      messages: [
        {
          id: '1',
          role: 'user' as const,
          content: 'Hello',
        },
      ],
      tools: [],
      context: [],
    };

    const observable = adapter['run'](input);
    const events: BaseEvent[] = [];

    await new Promise<void>((resolve, reject) => {
      observable.subscribe({
        next: (event: BaseEvent) => events.push(event),
        complete: () => resolve(),
        error: (error: any) => reject(error),
      });
    });

    // Verify we received the expected events
    expect(events).toHaveLength(7); // RUN_STARTED, TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT (x3), TEXT_MESSAGE_END, RUN_FINISHED
    expect(events[0].type).toBe('RUN_STARTED');
    expect(events[1].type).toBe('TEXT_MESSAGE_START');
    expect(events[2].type).toBe('TEXT_MESSAGE_CONTENT');
    expect(events[3].type).toBe('TEXT_MESSAGE_CONTENT');
    expect(events[4].type).toBe('TEXT_MESSAGE_CONTENT');
    expect(events[5].type).toBe('TEXT_MESSAGE_END');
    expect(events[6].type).toBe('RUN_FINISHED');

    // Verify the content was streamed correctly
    const contentEvents = events.filter(e => e.type === 'TEXT_MESSAGE_CONTENT') as any[];
    expect(contentEvents[0].delta).toBe('Hello');
    expect(contentEvents[1].delta).toBe(' from');
    expect(contentEvents[2].delta).toBe(' agent');
  });
});
