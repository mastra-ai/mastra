/**
 * End-to-end test: Agent + E2B sandbox exploring the real Mastra repo.
 *
 * Requires: ANTHROPIC_API_KEY and E2B_API_KEY environment variables.
 *
 * Run with:
 *   E2B_API_KEY=... npx vitest run src/__tests__/mastracode-e2e.test.ts
 */

import { anthropic } from '@ai-sdk/anthropic';
import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness';
import type { HarnessEvent, HarnessMode } from '@mastra/core/harness';
import { Workspace } from '@mastra/core/workspace';
import { E2BSandbox } from '@mastra/e2b';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const stateSchema = z.object({
  yolo: z.boolean().default(true),
});

const hasKeys = process.env.ANTHROPIC_API_KEY && process.env.E2B_API_KEY;

describe.skipIf(!hasKeys)('MastraCode E2E', () => {
  // =========================================================================
  // Test 1: Sanity check — raw sandbox works
  // =========================================================================
  it('raw sandbox: echo command works after healthcheck', async () => {
    console.log('\n--- raw sandbox test ---');
    const sandbox = new E2BSandbox({
      id: `raw-${Date.now()}`,
      timeout: 120_000,
    });
    try {
      await sandbox._start();
      console.log(`sandbox status: ${sandbox.status}`);

      // Poll until echo works
      for (let i = 0; i < 15; i++) {
        try {
          const r = await sandbox.executeCommand('echo ok');
          if (r?.exitCode === 0) {
            console.log(`echo ok after ${i + 1} attempts`);
            break;
          }
        } catch (e: any) {
          console.log(`attempt ${i + 1} failed: ${e.message?.slice(0, 80)}`);
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      const result = await sandbox.executeCommand('echo hello');
      console.log(`result: exitCode=${result.exitCode} stdout="${result.stdout.trim()}"`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello');
    } finally {
      await sandbox._destroy().catch(() => {});
    }
  }, 120_000);

  // =========================================================================
  // Test 2: Harness + E2B + Agent — minimal
  // =========================================================================
  it('harness + agent: simple echo via execute_command', async () => {
    console.log('\n--- harness + agent test ---');
    const t0 = Date.now();
    const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

    // 1. Sandbox — bare, no repo
    const sandbox = new E2BSandbox({
      id: `harness-${Date.now()}`,
      timeout: 120_000,
    });
    const workspace = new Workspace({ sandbox });

    // 2. Agent — minimal instructions
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: `You have one tool: execute_command. Use it to run shell commands.
When asked a question, use execute_command to answer it. Be concise (1-2 sentences).`,
      model: anthropic('claude-sonnet-4-20250514'),
    });

    // 3. Harness
    const modes: HarnessMode[] = [
      { id: 'build', name: 'Build', default: true, agent },
    ];
    const harness = new Harness({ id: 'e2e-test', modes, workspace, stateSchema, initialState: { yolo: true } });

    // 4. Event logging
    const events: HarnessEvent[] = [];
    let fullText = '';
    harness.subscribe((event: HarnessEvent) => {
      events.push(event);
      switch (event.type) {
        case 'agent_start':
          console.log(`[${elapsed()}] agent_start`);
          break;
        case 'agent_end':
          console.log(`[${elapsed()}] agent_end (${event.reason})`);
          break;
        case 'tool_start':
          console.log(`[${elapsed()}] tool_start: ${event.toolName}(${JSON.stringify(event.args).slice(0, 100)})`);
          break;
        case 'tool_end':
          console.log(`[${elapsed()}] tool_end: ${event.toolCallId} ${event.isError ? 'ERROR' : 'ok'}`);
          break;
        case 'error':
          console.log(`[${elapsed()}] ERROR: ${event.error?.message || event.error}`);
          break;
        case 'message_update': {
          const textParts = event.message.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text);
          fullText = textParts.join('');
          break;
        }
        case 'workspace_status_changed':
          console.log(`[${elapsed()}] workspace: ${event.status}`);
          break;
        case 'workspace_ready':
          console.log(`[${elapsed()}] workspace_ready`);
          break;
      }
    });

    try {
      // 5. Init — starts sandbox
      console.log(`[${elapsed()}] Initializing harness...`);
      await harness.init();
      console.log(`[${elapsed()}] Harness initialized`);

      // 6. Wait for sandbox to be healthy
      console.log(`[${elapsed()}] Waiting for sandbox healthcheck...`);
      for (let i = 0; i < 15; i++) {
        try {
          const r = await sandbox.executeCommand('echo ready');
          if (r?.exitCode === 0) {
            console.log(`[${elapsed()}] Sandbox healthy after ${i + 1} attempts`);
            break;
          }
        } catch {
          console.log(`[${elapsed()}] Healthcheck attempt ${i + 1} failed`);
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      // 7. Send a simple message
      console.log(`[${elapsed()}] Sending message...`);
      await harness.sendMessage({
        content: 'What Linux distro is this? Run: cat /etc/os-release | head -5',
      });
      console.log(`[${elapsed()}] Agent finished`);

      // 8. Results
      console.log('\n--- AGENT RESPONSE ---');
      console.log(fullText);
      console.log('--- END ---\n');

      expect(fullText.length).toBeGreaterThan(10);
      expect(events.some(e => e.type === 'agent_start')).toBe(true);
      expect(events.some(e => e.type === 'agent_end')).toBe(true);
    } finally {
      console.log(`[${elapsed()}] Cleaning up...`);
      await sandbox._destroy().catch(() => {});
      console.log(`[${elapsed()}] Done`);
    }
  }, 300_000);

  // =========================================================================
  // Test 3: Full test — clone repo + explore
  // =========================================================================
  it('harness + agent: clone mastra repo and explore', async () => {
    console.log('\n--- full clone test ---');
    const t0 = Date.now();
    const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

    const sandbox = new E2BSandbox({
      id: `e2e-full-${Date.now()}`,
      template: base =>
        base
          .aptInstall(['git'])
          .gitClone('https://github.com/mastra-ai/mastra.git', '/home/user/mastra', {
            branch: 'main',
            depth: 1,
          })
          .setWorkdir('/home/user/mastra'),
      timeout: 600_000,
    });
    const workspace = new Workspace({ sandbox });

    const agent = new Agent({
      id: 'explore-agent',
      name: 'explore-agent',
      instructions: `You are a code explorer inside an E2B cloud sandbox.
The Mastra repository is cloned at /home/user/mastra.

You have one tool: execute_command. Use it to run shell commands like:
- ls /home/user/mastra
- head -80 /home/user/mastra/README.md
- cat /home/user/mastra/package.json

Be concise — answer in 3-5 sentences max. Do NOT install anything or run builds.`,
      model: anthropic('claude-sonnet-4-20250514'),
    });

    const modes: HarnessMode[] = [
      { id: 'explore', name: 'Explore', default: true, agent },
    ];
    const harness = new Harness({ id: 'e2e-explore', modes, workspace, stateSchema, initialState: { yolo: true } });

    const events: HarnessEvent[] = [];
    let fullText = '';
    harness.subscribe((event: HarnessEvent) => {
      events.push(event);
      switch (event.type) {
        case 'agent_start':
          console.log(`[${elapsed()}] agent_start`);
          break;
        case 'agent_end':
          console.log(`[${elapsed()}] agent_end (${event.reason})`);
          break;
        case 'tool_start':
          console.log(`[${elapsed()}] tool_start: ${event.toolName}(${JSON.stringify(event.args).slice(0, 100)})`);
          break;
        case 'tool_end':
          console.log(`[${elapsed()}] tool_end: ${event.toolCallId} ${event.isError ? 'ERROR' : 'ok'}`);
          break;
        case 'error':
          console.log(`[${elapsed()}] ERROR: ${event.error?.message || event.error}`);
          break;
        case 'message_update': {
          const textParts = event.message.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text);
          fullText = textParts.join('');
          break;
        }
      }
    });

    try {
      console.log(`[${elapsed()}] Initializing harness (template build + sandbox start)...`);
      await harness.init();
      console.log(`[${elapsed()}] Harness initialized`);

      // Wait for healthcheck
      console.log(`[${elapsed()}] Waiting for sandbox healthcheck...`);
      for (let i = 0; i < 30; i++) {
        try {
          const r = await sandbox.executeCommand('echo ready');
          if (r?.exitCode === 0) {
            console.log(`[${elapsed()}] Sandbox healthy`);
            break;
          }
        } catch {
          if (i % 5 === 0) console.log(`[${elapsed()}] Still waiting... (attempt ${i + 1})`);
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      // Verify repo is actually there
      const lsResult = await sandbox.executeCommand('ls /home/user/mastra/package.json');
      console.log(`[${elapsed()}] Repo check: ${lsResult.stdout.trim()}`);

      console.log(`[${elapsed()}] Sending message to agent...`);
      await harness.sendMessage({
        content:
          'Quickly explore this codebase. Run: ls /home/user/mastra, then head -80 /home/user/mastra/README.md, then cat /home/user/mastra/package.json. Tell me what Mastra is in 3-5 sentences.',
      });
      console.log(`[${elapsed()}] Agent finished`);

      console.log('\n========================================');
      console.log('AGENT RESPONSE:');
      console.log('========================================');
      console.log(fullText);
      console.log('========================================\n');

      expect(fullText.length).toBeGreaterThan(50);
      expect(fullText.toLowerCase()).toContain('mastra');
      expect(events.some(e => e.type === 'agent_start')).toBe(true);
      expect(events.some(e => e.type === 'agent_end')).toBe(true);
    } finally {
      console.log(`[${elapsed()}] Cleaning up...`);
      await sandbox._destroy().catch(() => {});
      console.log(`[${elapsed()}] Done`);
    }
  }, 600_000);
});
