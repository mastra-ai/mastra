// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ModelPackHeader } from './model-pack-header';
import type { ModelPack } from './model-packs';

const build: ModelPack = { id: 'build', name: 'Build', models: [] };

/** Like a React Query mutation: the save resolves a tick before the host stops reporting it as pending. */
function PendingHost() {
  const [pack, setPack] = useState(build);
  const [saving, setSaving] = useState(false);
  const onSave = async (next: ModelPack) => {
    setSaving(true);
    await Promise.resolve();
    setPack(next);
    setTimeout(() => setSaving(false), 0);
    return true;
  };
  return (
    <ModelPackHeader
      pack={pack}
      packSet={{ modelPacks: [pack], defaultModelPackId: pack.id }}
      isDefault
      canDelete
      disabled={saving}
      onSave={onSave}
      onMakeDefault={() => {}}
      onDelete={() => {}}
    />
  );
}

describe('ModelPackHeader', () => {
  it('given the host still reports the save as pending when it resolves, returns focus to the pack menu after a rename', async () => {
    const user = userEvent.setup();
    render(<PendingHost />);

    await user.click(screen.getByRole('button', { name: 'Build actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    const name = await screen.findByRole('textbox', { name: 'Pack name' });
    await user.clear(name);
    await user.type(name, 'Deep{Enter}');

    const trigger = await screen.findByRole('button', { name: 'Deep actions' });
    await expect.poll(() => trigger.matches(':enabled')).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
});
