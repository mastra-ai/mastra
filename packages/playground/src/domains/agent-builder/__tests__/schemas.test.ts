import { describe, expect, it } from 'vitest';
import { AgentBuilderEditFormSchema } from '../schemas';

describe('AgentBuilderEditFormSchema', () => {
  it('accepts name and instructions without tools or skills', () => {
    const result = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
    });
    expect(result.success).toBe(true);
  });

  it('accepts tools as a record and skills as a string array', () => {
    const result = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
      tools: { 'web-search': true },
      skills: ['summarize'],
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = AgentBuilderEditFormSchema.safeParse({
      instructions: 'Do things',
    });
    expect(result.success).toBe(false);
  });

  it('requires instructions', () => {
    const result = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional workspaceId', () => {
    const withId = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
      workspaceId: 'workspace-123',
    });
    expect(withId.success).toBe(true);

    const without = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
    });
    expect(without.success).toBe(true);
  });
});
