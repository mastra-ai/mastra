import { describe, it, expect } from 'vitest';
import { builderAgent } from './agent-builder-agent';

const getInstructions = async (): Promise<string> => {
  const value = await builderAgent.getInstructions();
  if (typeof value !== 'string') {
    throw new Error('builderAgent.getInstructions() is expected to return a string for these prompt-contract tests');
  }
  return value;
};

describe('builderAgent system prompt — identity-first ordering contract', () => {
  it('declares identity-first ordering as a non-negotiable', async () => {
    const instructions = await getInstructions();

    // The non-negotiable block must say the first tool calls are set-agent-name then set-agent-description.
    expect(instructions).toMatch(/first tool calls/i);
    expect(instructions).toContain('`set-agent-name`');
    expect(instructions).toContain('`set-agent-description`');
    expect(instructions).toMatch(/before any other tool call/i);
  });

  it('forbids skill_search / skill before identity is set', async () => {
    const instructions = await getInstructions();

    // The prompt must explicitly prohibit running skill_search / skill before identity tools.
    expect(instructions).toMatch(/Do not call .*skill_search.*skill.*before/is);
  });

  it('does not list set-agent-name or set-agent-description in Step G capability tools', async () => {
    const instructions = await getInstructions();

    const stepGStart = instructions.indexOf('## Step G');
    expect(stepGStart).toBeGreaterThanOrEqual(0);
    const nextHeading = instructions.indexOf('## Step', stepGStart + 1);
    const stepGBody =
      nextHeading >= 0 ? instructions.slice(stepGStart, nextHeading) : instructions.slice(stepGStart);

    // The numbered "call this tool" actions inside Step G must not enumerate the identity tools.
    const numberedActions = stepGBody.split('\n').filter(line => /^\d+\.\s+`set-agent-/.test(line));
    expect(numberedActions.length).toBeGreaterThan(0);
    for (const action of numberedActions) {
      expect(action).not.toContain('`set-agent-name`');
      expect(action).not.toContain('`set-agent-description`');
    }
  });

  it('keeps Step B before Step C and Step D in the authoring loop', async () => {
    const instructions = await getInstructions();

    const stepB = instructions.indexOf('## Step B');
    const stepC = instructions.indexOf('## Step C');
    const stepD = instructions.indexOf('## Step D');

    expect(stepB).toBeGreaterThanOrEqual(0);
    expect(stepC).toBeGreaterThan(stepB);
    expect(stepD).toBeGreaterThan(stepC);
  });

  it('Step D has a precondition that identity tools have already been called', async () => {
    const instructions = await getInstructions();

    const stepDStart = instructions.indexOf('## Step D');
    expect(stepDStart).toBeGreaterThanOrEqual(0);
    const nextHeading = instructions.indexOf('## Step', stepDStart + 1);
    const stepDBody =
      nextHeading >= 0 ? instructions.slice(stepDStart, nextHeading) : instructions.slice(stepDStart);

    expect(stepDBody).toMatch(/Precondition/i);
    expect(stepDBody).toContain('`set-agent-name`');
    expect(stepDBody).toContain('`set-agent-description`');
  });
});
