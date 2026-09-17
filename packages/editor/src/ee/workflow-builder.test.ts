import { describe, expect, it } from 'vitest';
import { EditorWorkflowBuilder } from './workflow-builder';

describe('EditorWorkflowBuilder', () => {
  it('is enabled by default and exposes a hidden workflow-specific agent', () => {
    const builder = new EditorWorkflowBuilder();

    expect(builder.enabled).toBe(true);
    expect(builder.getAgent().id).toBe('workflow-builder-agent');
  });

  it('instructs the hidden agent to submit one complete draft and leave persistence to explicit Save', async () => {
    const builder = new EditorWorkflowBuilder();

    const instructions = await builder.getAgent().getInstructions();

    expect(instructions).toContain('# Studio execution and response protocol');
    expect(instructions).toContain(
      'Do not submit incremental fragments, speculative alternatives, or parallel attempts',
    );
    expect(instructions).toContain('Stop calling tools after success');
    expect(instructions).toContain('If the result is `already-ready`');
    expect(instructions).toContain('If the result is `superseded`');
    expect(instructions).toContain('# Shared summary rules');
    expect(instructions).toContain('# Studio authoring policy');
    expect(instructions).not.toContain('# Mastra Code authoring policy');
    expect(instructions).not.toContain('checkpoint-workflow-draft');
    expect(instructions).not.toContain('finalize-workflow-draft');
    expect(instructions).toContain('explicit Studio Save action');
    expect(instructions).toContain('# Composition procedure');
    expect(instructions).toContain('# The composition rule — schemas MUST match');
    expect(instructions).toContain('# Mappings — how to reshape data between steps');
    expect(instructions).toContain('# Nested workflows — compose one workflow inside another');
    expect(instructions).toContain("# Anti-patterns — don't do these");
    expect(instructions).toContain('# Worked example: foreach — run an agent on each item of a list');
    expect(instructions).not.toContain('set-workflow-identity');
    expect(instructions).not.toContain('set-workflow-schemas');
  });

  it('uses the configured model for the hidden agent and falls back to the default model', async () => {
    const configured = new EditorWorkflowBuilder({ model: 'anthropic/claude-opus-4-7' });
    const fallback = new EditorWorkflowBuilder();

    expect((await configured.getAgent().getModel()).modelId).toBe('claude-opus-4-7');
    expect((await fallback.getAgent().getModel()).modelId).toBe('gpt-5.5');
  });

  it('recalls a long authoring conversation by default and honours a configured window', async () => {
    const fallback = new EditorWorkflowBuilder();
    const configured = new EditorWorkflowBuilder({ lastMessages: 25 });

    // The memory default of 10 is far too small for tool-heavy authoring turns:
    // it evicts the user's original request mid-build.
    expect((await fallback.getAgent().getMemory())?.getMergedThreadConfig({}).lastMessages).toBe(100);
    expect((await configured.getAgent().getMemory())?.getMergedThreadConfig({}).lastMessages).toBe(25);
  });

  it('preserves the configured model policy', () => {
    const modelPolicy = {
      active: true,
      pickerVisible: false,
      default: { provider: 'openai', modelId: 'gpt-4o-mini' },
    } as const;
    const builder = new EditorWorkflowBuilder({ modelPolicy });

    expect(builder.getModelPolicy()).toEqual(modelPolicy);
  });
});
