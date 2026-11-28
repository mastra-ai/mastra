// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillCreateDialog } from '../skill-create-dialog';

afterEach(cleanup);

function Harness({ editing = false }: { editing?: boolean }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  return (
    <SkillCreateDialog
      editing={editing}
      pending={false}
      onClose={vi.fn()}
      onCreate={vi.fn()}
      fields={{
        name,
        onNameChange: setName,
        description,
        onDescriptionChange: setDescription,
        instructions,
        onInstructionsChange: setInstructions,
      }}
    />
  );
}

const upload = (text: string) =>
  fireEvent.change(screen.getByLabelText('SKILL.md file'), {
    target: { files: [new File([text], 'SKILL.md', { type: 'text/markdown' })] },
  });

describe('SkillCreateDialog', () => {
  it('fills the form from an uploaded SKILL.md and switches to it', async () => {
    render(<Harness />);
    upload('---\nname: deal-summaries\ndescription: Deal questions\n---\nAnswer as a table.');

    await waitFor(() => expect(screen.getByDisplayValue('deal-summaries')).toBeTruthy());
    expect(screen.getByDisplayValue('Deal questions')).toBeTruthy();
  });

  it('says what is wrong with a file it cannot use', async () => {
    render(<Harness />);
    upload('---\nname: deal-summaries\n---\nAnswer as a table.');

    expect((await screen.findByRole('alert')).textContent).toContain('SKILL.md has no description');
    expect(screen.getByLabelText('SKILL.md file')).toBeTruthy();
  });

  it('reads the same file again after it was fixed', async () => {
    render(<Harness />);
    upload('---\nname: deal-summaries\n---\nAnswer as a table.');
    await screen.findByRole('alert');
    upload('---\nname: deal-summaries\ndescription: Deal questions\n---\nAnswer as a table.');

    await waitFor(() => expect(screen.getByDisplayValue('Deal questions')).toBeTruthy());
  });

  it('goes straight to the form when editing', () => {
    render(<Harness editing />);

    expect(screen.queryByRole('radiogroup', { name: 'Start from' })).toBeNull();
    expect(screen.queryByLabelText('SKILL.md file')).toBeNull();
  });
});
