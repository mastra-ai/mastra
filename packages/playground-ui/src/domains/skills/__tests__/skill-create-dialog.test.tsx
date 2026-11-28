// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkillCreateDialog } from '../skill-create-dialog';

afterEach(cleanup);

class UnreadableFile extends File {
  override text() {
    return Promise.reject(new Error('unreadable'));
  }
}

class SlowFile extends File {
  finish = () => {};
  override text() {
    return new Promise<string>(resolve => {
      this.finish = () => void super.text().then(resolve);
    });
  }
}

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

  it('says so when the file can’t be opened', async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('SKILL.md file'), {
      target: { files: [new UnreadableFile([], 'SKILL.md')] },
    });

    expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t open SKILL.md');
  });

  it('ignores a read that finishes after switching to Write', async () => {
    render(<Harness />);
    const slow = new SlowFile(['---\nname: from-file\ndescription: x\n---\nBody'], 'SKILL.md');
    fireEvent.change(screen.getByLabelText('SKILL.md file'), { target: { files: [slow] } });
    fireEvent.click(screen.getByRole('radio', { name: 'Write' }));
    fireEvent.change(screen.getByPlaceholderText('Skill name'), { target: { value: 'typed' } });
    slow.finish();

    await waitFor(() => expect(screen.getByDisplayValue('typed')).toBeTruthy());
    expect(screen.queryByDisplayValue('from-file')).toBeNull();
  });

  it('goes straight to the form when editing', () => {
    render(<Harness editing />);

    expect(screen.queryByRole('radiogroup', { name: 'Start from' })).toBeNull();
    expect(screen.queryByLabelText('SKILL.md file')).toBeNull();
  });
});
