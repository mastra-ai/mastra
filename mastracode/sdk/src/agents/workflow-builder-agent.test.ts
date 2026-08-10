import { describe, expect, it } from 'vitest';

import { workflowBuilderAgent } from './workflow-builder-agent.js';

describe('workflowBuilderAgent', () => {
  it('combines shared composition guidance with Mastra Code persistence policy', async () => {
    const instructions = await workflowBuilderAgent.getInstructions();

    expect(instructions).toContain('# Composition procedure');
    expect(instructions).toContain('# The composition rule — schemas MUST match');
    expect(instructions).toContain("# Anti-patterns — don't do these");
    expect(instructions).toContain('# Worked example: foreach — run an agent on each item of a list');
    expect(instructions).toContain('# Shared summary rules');
    expect(instructions).toContain('# Mastra Code authoring policy');
    expect(instructions).toContain('# Mastra Code execution and response protocol');
    expect(instructions).toContain('Success means exactly that `save-workflow` returned');
    expect(instructions).toContain('/workflows run <id> {…}');
    // Helper workflows may be saved before the requested one, in dependency
    // order — the single-save rule constrains the requested workflow, not its
    // dependencies.
    expect(instructions).toContain('save each helper FIRST, one complete definition per call, in dependency order');
    expect(instructions).toContain('permanent, user-visible registry entries');
    expect(instructions).not.toContain('# Studio authoring policy');
    expect(instructions).not.toContain('submit-workflow-draft');
  });
});
