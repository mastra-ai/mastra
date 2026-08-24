import { describe, expect, it } from 'vitest';
import { AgentBuilderEditFormSchema, AgentBuilderModelSchema } from '../schemas';

describe('AgentBuilderEditFormSchema', () => {
  it('accepts name and instructions without tools', () => {
    const result = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
    });
    expect(result.success).toBe(true);
  });

  it('accepts tools as a record', () => {
    const result = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
      tools: { 'web-search': true },
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

  it('accepts an optional description', () => {
    const withDescription = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      description: 'Helps with research tasks',
      instructions: 'Do things',
    });
    expect(withDescription.success).toBe(true);

    const without = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
    });
    expect(without.success).toBe(true);
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

  describe('when a visibility is supplied', () => {
    it('accepts private', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        name: 'My agent',
        instructions: 'Do things',
        visibility: 'private',
      });
      expect(result.success).toBe(true);
    });

    it('accepts public', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        name: 'My agent',
        instructions: 'Do things',
        visibility: 'public',
      });
      expect(result.success).toBe(true);
    });

    it('rejects any other visibility', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        name: 'My agent',
        instructions: 'Do things',
        visibility: 'unlisted',
      });
      expect(result.success).toBe(false);
    });

    it('leaves visibility unset when it is omitted', () => {
      const result = AgentBuilderEditFormSchema.parse({ name: 'My agent', instructions: 'Do things' });
      expect(result.visibility).toBeUndefined();
      expect(result.browserEnabled).toBeUndefined();
    });
  });

  describe('when the form pins the same connection twice on one toolkit', () => {
    it('reports the duplicate under the toolProviders path', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        name: 'My agent',
        instructions: 'Do things',
        toolProviders: {
          composio: {
            tools: {},
            connections: {
              github: [
                { kind: 'author', toolkit: 'github', connectionId: 'conn-1' },
                { kind: 'author', toolkit: 'github', connectionId: 'conn-1' },
              ],
            },
          },
        },
      });

      expect(result.success).toBe(false);
      const issue = result.error?.issues[0];
      expect(issue?.message).toBe('Connection "conn-1" is already pinned to github');
      expect(issue?.path).toEqual(['toolProviders', 'composio', 'connections', 'github', 1, 'connectionId']);
    });
  });

  describe('when a selected tool has no connection on its toolkit', () => {
    it('reports the orphaned tool under the toolProviders path', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        name: 'My agent',
        instructions: 'Do things',
        toolProviders: {
          composio: {
            tools: { 'github-star': { toolkit: 'github' } },
            connections: {},
          },
        },
      });

      expect(result.success).toBe(false);
      const issue = result.error?.issues[0];
      expect(issue?.message).toBe('Tool "github-star" requires at least one connection for github');
      expect(issue?.path).toEqual(['toolProviders', 'composio', 'tools', 'github-star']);
    });
  });
});

describe('AgentBuilderModelSchema', () => {
  describe('when both provider and name are given', () => {
    it('accepts the model', () => {
      const result = AgentBuilderModelSchema.safeParse({ provider: 'openai', name: 'gpt-4o' });
      expect(result.success).toBe(true);
    });
  });

  describe('when a field is missing', () => {
    it('rejects a model without a provider', () => {
      expect(AgentBuilderModelSchema.safeParse({ name: 'gpt-4o' }).success).toBe(false);
    });

    it('rejects a model without a name', () => {
      expect(AgentBuilderModelSchema.safeParse({ provider: 'openai' }).success).toBe(false);
    });
  });

  describe('when a field is an empty string', () => {
    it('rejects an empty provider', () => {
      expect(AgentBuilderModelSchema.safeParse({ provider: '', name: 'gpt-4o' }).success).toBe(false);
    });

    it('rejects an empty name', () => {
      expect(AgentBuilderModelSchema.safeParse({ provider: 'openai', name: '' }).success).toBe(false);
    });
  });
});
