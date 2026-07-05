import { describe, it, expect } from 'vitest';
import {
  SOURCE_CONTROL_AGENTS_DIR,
  getSourceControlEntityFilePath,
  getSourceAgentFilePath,
} from './source-control';

describe('getSourceControlEntityFilePath', () => {
  it('builds a path joining directory and URL-encoded entity id with .json', () => {
    expect(getSourceControlEntityFilePath('agents', 'my-agent')).toBe('agents/my-agent.json');
  });

  it('URL-encodes special characters in the entity id', () => {
    expect(getSourceControlEntityFilePath('agents', 'a/b c')).toBe('agents/a%2Fb%20c.json');
    expect(getSourceControlEntityFilePath('agents', 'agent#1')).toBe('agents/agent%231.json');
  });

  it('handles ids that are already safe', () => {
    expect(getSourceControlEntityFilePath('dir', 'simple-id_123')).toBe('dir/simple-id_123.json');
  });

  it('preserves a nested directory path', () => {
    expect(getSourceControlEntityFilePath('a/b/c', 'x')).toBe('a/b/c/x.json');
  });
});

describe('getSourceAgentFilePath', () => {
  it('uses the SOURCE_CONTROL_AGENTS_DIR constant as the directory', () => {
    expect(SOURCE_CONTROL_AGENTS_DIR).toBe('agents');
    expect(getSourceAgentFilePath('my-agent')).toBe('agents/my-agent.json');
  });

  it('URL-encodes the agent id', () => {
    expect(getSourceAgentFilePath('agent with space')).toBe('agents/agent%20with%20space.json');
  });
});
