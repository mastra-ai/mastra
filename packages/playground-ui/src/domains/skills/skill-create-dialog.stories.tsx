import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SkillCreateDialog } from './skill-create-dialog';

function Harness({ editing = false }: { editing?: boolean }) {
  const [name, setName] = useState(editing ? 'deal-summaries' : '');
  const [description, setDescription] = useState(editing ? 'Use when someone asks about a deal' : '');
  const [instructions, setInstructions] = useState(editing ? 'Answer as a short table.' : '');
  return (
    <SkillCreateDialog
      editing={editing}
      pending={false}
      onClose={() => undefined}
      onCreate={() => undefined}
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

const meta = {
  title: 'Domains/Skills/Create skill',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Creating a skill starts on Upload: pick or drop a SKILL.md, or the folder that holds it, and its name, description and instructions fill the form. A file missing any of them gets a plain message saying what to add. Write goes straight to the form; editing a skill skips the choice.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Upload: Story = { render: () => <Harness /> };
export const Editing: Story = { render: () => <Harness editing /> };
