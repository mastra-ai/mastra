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

    expect(instructions).toContain('submit-workflow-draft exactly once');
    expect(instructions).toContain('Do not submit alternative definitions in parallel');
    expect(instructions).toContain('Stop calling tools after a successful submission');
    expect(instructions).not.toContain('checkpoint-workflow-draft');
    expect(instructions).not.toContain('finalize-workflow-draft');
    expect(instructions).toContain('explicit Studio Save action');
    expect(instructions).toContain('# The composition rule — schemas MUST match');
    expect(instructions).toContain('# Mappings — how to reshape data between steps');
    expect(instructions).toContain('# Nested workflows — compose one workflow inside another');
    expect(instructions).not.toContain('set-workflow-identity');
    expect(instructions).not.toContain('set-workflow-schemas');
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
