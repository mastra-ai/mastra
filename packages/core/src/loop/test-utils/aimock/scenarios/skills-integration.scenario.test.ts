import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, beforeEach, afterEach } from 'vitest';
import { LocalFilesystem } from '../../../../workspace/filesystem';
import { Workspace } from '../../../../workspace/workspace';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: SkillsProcessor integration with agent loop.
 *
 * When a workspace has skills configured (real SKILL.md files on disk),
 * the Agent auto-creates a SkillsProcessor that:
 * 1. Discovers skills from the filesystem
 * 2. Injects skill metadata into the system prompt
 * 3. Auto-injects `skill`, `skill_search`, `skill_read` tools
 *
 * We test the full flow through the real Workspace + LocalFilesystem + SkillsProcessor
 * pipeline, asserting that skill metadata lands in the model request and the skill tool
 * round-trips instructions correctly.
 */

const SKILL_MD = `---
name: code-review
description: Reviews code for quality, style, and potential issues
---

# Code Review

You are a code reviewer. When reviewing code:

1. Check for bugs and edge cases
2. Verify the code follows the style guide
3. Suggest improvements for readability
`;

describeForAllEngines('AIMock scenario: skills integration', engine => {
  const getMock = useLoopScenarioAimock();
  let tempDir: string;
  let workspace: Workspace;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aimock-skills-scenario-'));

    // Create a real skill on disk
    const skillDir = path.join(tempDir, 'skills', 'code-review');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), SKILL_MD);

    // Create a real workspace with LocalFilesystem and skills config
    workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      skills: ['skills'],
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('injects skill metadata into system prompt when workspace has skills', async () => {
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What skills do you have?',
      workspace,
      stopWhen: stepCountIs(2),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            content: 'I have access to the code-review skill for quality checks.',
          },
        );
      },
    });

    expect(requests.length).toBeGreaterThanOrEqual(1);

    // The SkillsProcessor injects <available_skills> XML into a system message
    const messages = requests[0]?.body?.messages ?? [];
    const allContent = messages.map((m: any) => JSON.stringify(m.content)).join('\n');
    expect(allContent).toContain('code-review');
    expect(allContent).toContain('<available_skills>');
    expect(allContent).toContain('Reviews code for quality');
  });

  it('model can call skill tool to load skill instructions mid-loop', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Load the code-review skill and tell me what it does.',
      workspace,
      stopWhen: stepCountIs(4),
      fixtures: llm => {
        // Turn 1: Model calls the skill tool
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call_skill_1',
                name: 'skill',
                arguments: { name: 'code-review' },
              },
            ],
          },
        );

        // Turn 2: Model receives skill instructions and responds
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          {
            content: 'The code-review skill reviews code for bugs, style, and readability.',
          },
        );
      },
    });

    // Verify two turns occurred
    expect(requests.length).toBe(2);

    // The skill tool was actually executed (toolResults from output)
    const toolResults = await output.toolResults;
    expect(toolResults.length).toBeGreaterThanOrEqual(1);
    expect(toolResults[0]!.payload.toolName).toBe('skill');

    // Cross-turn plumbing: turn-2 request carries the skill instructions
    // as a tool result so the model can produce its answer
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const serializedTurn2 = JSON.stringify(turn2Messages);
    expect(serializedTurn2).toContain('Code Review');
    expect(serializedTurn2).toContain('bugs and edge cases');

    // The tool-result message references the original tool call id
    const toolMessage = turn2Messages.find((m: any) => m.role === 'tool') as { tool_call_id?: string } | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_skill_1');

    // Final output references the skill
    const text = await output.text;
    expect(text).toContain('code-review');
  });

  it('handles missing skill gracefully', async () => {
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Load the non-existent-skill.',
      workspace,
      stopWhen: stepCountIs(4),
      fixtures: llm => {
        // Model calls a non-existent skill
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'call_skill_2',
                name: 'skill',
                arguments: { name: 'non-existent-skill' },
              },
            ],
          },
        );

        // Model receives error and responds
        llm.on(
          { endpoint: 'chat', hasToolResult: true },
          {
            content: 'That skill is not available.',
          },
        );
      },
    });

    // Verify the loop handled the missing skill gracefully
    expect(requests.length).toBe(2);

    // The tool result should indicate skill not found
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const serializedTurn2 = JSON.stringify(turn2Messages);
    expect(serializedTurn2).toMatch(/not found|Available skills/i);

    const text = await output.text;
    expect(text).toMatch(/not available/i);
  });
});
