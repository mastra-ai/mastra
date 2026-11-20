// @vitest-environment jsdom
import type { StoredSkillResponse } from '@mastra/client-js';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoredSkillsPicker } from '../stored-skills-picker';

const availableSkills: StoredSkillResponse[] = [
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Summarize a conversation',
    status: 'published',
    instructions: 'Summarize.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'translate',
    name: 'Translate',
    status: 'published',
    instructions: 'Translate.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function ControlledPicker() {
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>(['translate']);
  return (
    <StoredSkillsPicker
      availableSkills={availableSkills}
      selectedSkillIds={selectedSkillIds}
      onAttach={id => setSelectedSkillIds(ids => [...ids, id])}
      onRemove={id => setSelectedSkillIds(ids => ids.filter(selected => selected !== id))}
    />
  );
}

describe('StoredSkillsPicker', () => {
  afterEach(cleanup);

  it('attaches an available skill and reflects the host selection', () => {
    render(<ControlledPicker />);
    const checkbox = screen.getByRole('checkbox', { name: /Summarize/ });

    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
  });

  it('removes a selected skill and reflects the host selection', () => {
    render(<ControlledPicker />);
    const checkbox = screen.getByRole('checkbox', { name: 'Translate' });

    expect(checkbox.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
  });

  it('shows loading instead of a misleading empty state', () => {
    render(
      <StoredSkillsPicker availableSkills={[]} selectedSkillIds={[]} isLoading onAttach={vi.fn()} onRemove={vi.fn()} />,
    );

    expect(screen.getByRole('status').textContent).toContain('Loading skills');
    expect(screen.queryByText('No skills available in this project.')).toBeNull();
  });

  it('shows an empty state and delegates creation when offered', () => {
    const onCreate = vi.fn();
    render(
      <StoredSkillsPicker
        availableSkills={[]}
        selectedSkillIds={[]}
        onAttach={vi.fn()}
        onRemove={vi.fn()}
        onCreate={onCreate}
      />,
    );

    expect(screen.getByText('No skills available in this project.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create skill' }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('prevents changes when the host disables editing', () => {
    const onAttach = vi.fn();
    const onRemove = vi.fn();
    render(
      <StoredSkillsPicker
        availableSkills={availableSkills}
        selectedSkillIds={['translate']}
        disabled
        onAttach={onAttach}
        onRemove={onRemove}
      />,
    );

    const attachCheckbox = screen.getByRole('checkbox', { name: /Summarize/ });
    const removeCheckbox = screen.getByRole('checkbox', { name: 'Translate' });
    expect(attachCheckbox.getAttribute('data-disabled')).not.toBeNull();
    expect(removeCheckbox.getAttribute('data-disabled')).not.toBeNull();
    fireEvent.click(attachCheckbox);
    fireEvent.click(removeCheckbox);
    expect(onAttach).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });
});
