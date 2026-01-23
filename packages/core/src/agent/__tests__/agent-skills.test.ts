import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { Agent } from '../agent';
import { RequestContext } from '../../request-context';

describe('Agent with Skills', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `mastra-agent-skills-test-${randomUUID()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should load skills and inject instructions', async () => {
    // Create a skill
    const skillName = 'test-skill';
    const skillDir = join(testDir, skillName);
    mkdirSync(skillDir, { recursive: true });

    const skillContent = `---
name: test-skill
description: A test skill
---
# Skill Instructions
Do something specific.
`;
    writeFileSync(join(skillDir, 'SKILL.md'), skillContent);

    // Create agent with skill
    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'Base instructions.',
      model: {
        provider: 'OPENAI',
        name: 'gpt-4',
        toolChoice: 'auto',
      },
      skills: [skillDir],
    });

    // Check if skill is loaded
    const skills = await agent.listSkills();
    expect(skills.length).toBe(1);
    expect(skills[0]!.id).toBe('test-skill');

    // Check combined instructions
    const instructions = await agent.getCombinedInstructions();
    expect(instructions).toContain('Base instructions.');
    expect(instructions).toContain('# Active Skills');
    expect(instructions).toContain('Skill: test-skill');
    expect(instructions).toContain('Do something specific.');
  });

  it('should support dynamic skills', async () => {
    // Create two skills
    const skill1Dir = join(testDir, 'skill-1');
    const skill2Dir = join(testDir, 'skill-2');
    mkdirSync(skill1Dir, { recursive: true });
    mkdirSync(skill2Dir, { recursive: true });

    writeFileSync(
      join(skill1Dir, 'SKILL.md'),
      `---
name: skill-1
description: Skill 1
---
# Instructions 1
`,
    );

    writeFileSync(
      join(skill2Dir, 'SKILL.md'),
      `---
name: skill-2
description: Skill 2
---
# Instructions 2
`,
    );

    // Create agent with dynamic skills
    const agent = new Agent({
      id: 'dynamic-agent',
      name: 'Dynamic Agent',
      instructions: 'Base.',
      model: {
        provider: 'OPENAI',
        name: 'gpt-4',
        toolChoice: 'auto',
      },
      skills: async ({ requestContext }) => {
        const role = requestContext?.get('role');
        return role === 'admin' ? [skill1Dir, skill2Dir] : [skill1Dir];
      },
    });

    // Test with user role
    const userContext = new RequestContext();
    userContext.set('role', 'user');

    const userSkills = await agent.listSkills({ requestContext: userContext });
    expect(userSkills.length).toBe(1);
    expect(userSkills[0]!.id).toBe('skill-1');

    const userInstructions = await agent.getCombinedInstructions({ requestContext: userContext });
    expect(userInstructions).toContain('Instructions 1');
    expect(userInstructions).not.toContain('Instructions 2');

    // Test with admin role
    const adminContext = new RequestContext();
    adminContext.set('role', 'admin');

    // The manager caches skills, but load() merges them.

    const adminSkills = await agent.listSkills({ requestContext: adminContext });
    expect(adminSkills.length).toBe(2);

    const adminInstructions = await agent.getCombinedInstructions({ requestContext: adminContext });
    expect(adminInstructions).toContain('Instructions 1');
    expect(adminInstructions).toContain('Instructions 2');
  });

  it('should work without skills', async () => {
    const agent = new Agent({
      id: 'no-skill-agent',
      name: 'No Skill Agent',
      instructions: 'Base instructions.',
      model: {
        provider: 'OPENAI',
        name: 'gpt-4',
        toolChoice: 'auto',
      },
    });

    const skills = await agent.listSkills();
    expect(skills.length).toBe(0);

    const instructions = await agent.getCombinedInstructions();
    expect(instructions).toBe('Base instructions.');
    expect(instructions).not.toContain('# Active Skills');
  });
});
