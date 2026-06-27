import { describe, expect, it } from 'vitest';
import { createEditorScenarioMastra } from './editor-scenario-utils';

describe('Editor E2E scenario: prompt block preview', () => {
  it('renders stored prompt blocks with variables and rule-based inclusion exactly as Studio preview would show them', async () => {
    // USER STORY: A Studio user previews prompt blocks before saving them into an agent.
    // ARRANGE: Create reusable prompt blocks with a shared base block and role-specific blocks.
    const { editor } = createEditorScenarioMastra();
    await editor.prompt.create({
      id: 'base-preview-block',
      name: 'Base preview block',
      content: 'You are helping {{user.name}}.',
    });
    await editor.prompt.create({
      id: 'admin-preview-block',
      name: 'Admin preview block',
      content: 'Share admin-only operational details.',
      rules: { operator: 'AND', conditions: [{ field: 'user.role', operator: 'equals', value: 'admin' }] },
    });
    await editor.prompt.create({
      id: 'guest-preview-block',
      name: 'Guest preview block',
      content: 'Only share public details.',
      rules: { operator: 'AND', conditions: [{ field: 'user.role', operator: 'equals', value: 'guest' }] },
    });

    // ACT: Preview the same instruction list for two different request contexts.
    const blocks = [
      { type: 'prompt_block_ref' as const, id: 'base-preview-block' },
      { type: 'prompt_block_ref' as const, id: 'admin-preview-block' },
      { type: 'prompt_block_ref' as const, id: 'guest-preview-block' },
    ];
    const adminPreview = await editor.prompt.preview(blocks, { user: { name: 'Ada', role: 'admin' } });
    const guestPreview = await editor.prompt.preview(blocks, { user: { name: 'Grace', role: 'guest' } });

    // ASSERT: Preview output reflects the stored blocks, variables, and rule evaluation.
    expect(adminPreview).toContain('You are helping Ada.');
    expect(adminPreview).toContain('Share admin-only operational details.');
    expect(adminPreview).not.toContain('Only share public details.');
    expect(guestPreview).toContain('You are helping Grace.');
    expect(guestPreview).not.toContain('Share admin-only operational details.');
    expect(guestPreview).toContain('Only share public details.');
  });
});
