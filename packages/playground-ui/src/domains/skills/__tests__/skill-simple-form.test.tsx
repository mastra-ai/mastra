// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SkillSimpleForm } from '../skill-simple-form';

const skill = {
  name: 'release-notes',
  description: 'Draft release notes from merged PRs',
  instructions: '# Release notes\n\nGroup merged PRs by package.',
};

function EditableForm({ readOnly }: { readOnly?: boolean }) {
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description);
  const [instructions, setInstructions] = useState(skill.instructions);
  return (
    <>
      <SkillSimpleForm
        name={name}
        onNameChange={setName}
        description={description}
        onDescriptionChange={setDescription}
        instructions={instructions}
        onInstructionsChange={setInstructions}
        readOnly={readOnly}
      />
      <output data-testid="current-name">{name}</output>
    </>
  );
}

describe('SkillSimpleForm', () => {
  afterEach(cleanup);

  describe('when the skill is editable', () => {
    it('shows the SKILL.md instructions as source in the markdown editor', () => {
      const { container } = render(<EditableForm />);

      const editor = container.querySelector('[data-testid="skill-instructions-input"] .cm-content');
      expect(editor?.textContent).toContain('# Release notes');
      expect(editor?.getAttribute('contenteditable')).toBe('true');
    });

    it('reports name edits back to the owner', () => {
      render(<EditableForm />);

      fireEvent.change(screen.getByDisplayValue(skill.name), { target: { value: 'changelog' } });

      expect(screen.getByTestId('current-name').textContent).toBe('changelog');
    });
  });

  describe('when the skill is read-only', () => {
    it('renders the instructions as formatted markdown and locks the fields', () => {
      const { container } = render(<EditableForm readOnly />);

      expect(screen.getByRole('heading', { name: 'Release notes' }).tagName).toBe('H1');
      expect(container.querySelector('.cm-content')).toBeNull();
      expect((screen.getByDisplayValue(skill.name) as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByDisplayValue(skill.description) as HTMLInputElement).disabled).toBe(true);
    });
  });
});
