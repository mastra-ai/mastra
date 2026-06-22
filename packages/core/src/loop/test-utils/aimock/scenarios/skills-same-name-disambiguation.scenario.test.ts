import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalFilesystem } from '../../../../workspace/filesystem';
import { Workspace } from '../../../../workspace/workspace';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: same-named skills tie-breaking and path-based disambiguation.
 *
 * When multiple skill directories contain a skill with the same name:
 * - All are discovered and listed in the system prompt
 * - Local skills take precedence over external
 * - Path escape hatch: can use full path to disambiguate
 *
 * This scenario uses real SKILL.md files on disk to test the tie-breaking rules.
 */

const LOCAL_SKILL_MD = `---
name: brand-guidelines
description: Local brand guidelines
---

# Local Brand Guidelines

Use our company blue: #0066CC
`;

const EXTERNAL_SKILL_MD = `---
name: brand-guidelines
description: External package brand guidelines
---

# External Brand Guidelines

Use generic blue: #0000FF
`;

describe('AIMock scenario: skills same-name disambiguation', () => {
  const getMock = useLoopScenarioAimock();
  let tempDir: string;
  let workspace: Workspace;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aimock-skills-same-name-'));
    
    // Create two skills with the same name in different directories
    const localSkillDir = path.join(tempDir, 'skills', 'brand-guidelines');
    await fs.mkdir(localSkillDir, { recursive: true });
    await fs.writeFile(path.join(localSkillDir, 'SKILL.md'), LOCAL_SKILL_MD);
    
    const externalSkillDir = path.join(tempDir, 'node_modules', '@myorg', 'skills', 'brand-guidelines');
    await fs.mkdir(externalSkillDir, { recursive: true });
    await fs.writeFile(path.join(externalSkillDir, 'SKILL.md'), EXTERNAL_SKILL_MD);
    
    // Create a real workspace with both skill directories
    workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath: tempDir }),
      skills: ['skills', 'node_modules/@myorg/skills'],
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('lists all same-named skills in system prompt with paths', async () => {
    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'What brand guidelines are available?',
      workspace,
      stopWhen: stepCountIs(2),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false }, {
          content: 'There are two brand-guidelines skills available.',
        });
      },
    });

    expect(requests.length).toBeGreaterThanOrEqual(1);
    
    // The system prompt should list both skills with their paths. Normalize
    // path separators so the assertions hold on Windows (backslashes) too.
    const messages = requests[0]?.body?.messages ?? [];
    const allContent = messages
      .map((m: any) => JSON.stringify(m.content))
      .join('\n')
      .replace(/\\\\/g, '/') // JSON-escaped backslashes (\\) → /
      .replace(/\\/g, '/'); // any remaining backslashes → /

    // Both skills should appear
    expect(allContent).toContain('brand-guidelines');

    // Paths should appear to disambiguate
    expect(allContent).toContain('skills/brand-guidelines');
    expect(allContent).toContain('node_modules/@myorg/skills/brand-guidelines');
  });

  it('local skill takes precedence when activated by name', async () => {
    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Load the brand-guidelines skill.',
      workspace,
      stopWhen: stepCountIs(4),
      fixtures: llm => {
        // Turn 1: Model calls the skill tool by name
        llm.on({ endpoint: 'chat', hasToolResult: false }, {
          toolCalls: [{
            id: 'call_skill_1',
            name: 'skill',
            arguments: { name: 'brand-guidelines' },
          }],
        });

        // Turn 2: Model receives the local skill (precedence) and responds
        llm.on({ endpoint: 'chat', hasToolResult: true }, {
          content: 'Loaded the local brand guidelines with company blue #0066CC.',
        });
      },
    });

    expect(requests.length).toBe(2);
    
    // The skill tool was executed
    const toolResults = await output.toolResults;
    expect(toolResults.length).toBeGreaterThanOrEqual(1);
    expect(toolResults[0]!.payload.toolName).toBe('skill');
    
    // The tool result should contain the LOCAL skill (precedence)
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const serializedTurn2 = JSON.stringify(turn2Messages);
    expect(serializedTurn2).toContain('#0066CC'); // Local blue
    expect(serializedTurn2).not.toContain('#0000FF'); // Not external blue
    
    // Final output references local guidelines
    const text = await output.text;
    expect(text).toContain('#0066CC');
  });

  it('path-based activation bypasses tie-breaking', async () => {
    const { output, requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Load the external brand guidelines.',
      workspace,
      stopWhen: stepCountIs(4),
      fixtures: llm => {
        // Turn 1: Model calls the skill tool with full path
        llm.on({ endpoint: 'chat', hasToolResult: false }, {
          toolCalls: [{
            id: 'call_skill_2',
            name: 'skill',
            arguments: { name: 'node_modules/@myorg/skills/brand-guidelines' },
          }],
        });

        // Turn 2: Model receives the external skill and responds
        llm.on({ endpoint: 'chat', hasToolResult: true }, {
          content: 'Loaded the external brand guidelines with generic blue #0000FF.',
        });
      },
    });

    expect(requests.length).toBe(2);
    
    // The skill tool was executed
    const toolResults = await output.toolResults;
    expect(toolResults.length).toBeGreaterThanOrEqual(1);
    
    // The tool result should contain the EXTERNAL skill (path escape)
    const turn2Messages = requests[1]?.body?.messages ?? [];
    const serializedTurn2 = JSON.stringify(turn2Messages);
    expect(serializedTurn2).toContain('#0000FF'); // External blue
    expect(serializedTurn2).not.toContain('#0066CC'); // Not local blue
    
    // Final output references external guidelines
    const text = await output.text;
    expect(text).toContain('#0000FF');
  });
});
