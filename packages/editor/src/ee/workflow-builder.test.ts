import { describe, expect, it } from 'vitest';
import { EditorWorkflowBuilder } from './workflow-builder';

describe('EditorWorkflowBuilder', () => {
  it('is enabled by default and exposes a hidden workflow-specific agent', () => {
    const builder = new EditorWorkflowBuilder();

    expect(builder.enabled).toBe(true);
    expect(builder.getAgent().id).toBe('workflow-builder-agent');
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
