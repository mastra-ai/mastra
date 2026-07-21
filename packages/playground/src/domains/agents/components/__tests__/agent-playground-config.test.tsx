import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentEditFormProvider } from '../../context/agent-edit-form-context';
import type { AgentFormValues } from '../agent-edit-page/utils/form-validation';
import { AgentPlaygroundConfig } from '../agent-playground/agent-playground-config';

vi.mock('../agent-cms-pages/instruction-blocks-page', () => ({
  InstructionBlocksPage: () => <div>Instruction blocks editor</div>,
}));

vi.mock('../agent-cms-pages/tools-page', () => ({
  ToolsPage: () => <div>Tools editor</div>,
}));

function AgentPlaygroundConfigHarness() {
  const form = useForm<AgentFormValues>({
    defaultValues: {
      name: 'Chef Agent',
      instructions: '',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
      instructionBlocks: [{ id: 'block-1', type: 'prompt_block', content: 'Cook with care.' }],
      tools: {
        lookupRecipe: { description: 'Find a recipe.' },
        scaleRecipe: { description: 'Scale ingredient quantities.' },
      },
      variables: {
        type: 'object',
        properties: {
          servings: { type: 'number' },
        },
        required: [],
      },
    },
  });

  return (
    <AgentEditFormProvider form={form} mode="edit" isSubmitting={false} handlePublish={async () => {}}>
      <AgentPlaygroundConfig agentId="chef-agent" />
    </AgentEditFormProvider>
  );
}

afterEach(() => {
  cleanup();
});

describe('AgentPlaygroundConfig', () => {
  describe('when editing agent configuration', () => {
    it('renders variables, system prompt, and tools as tabs with the tool count badge', () => {
      render(<AgentPlaygroundConfigHarness />);

      expect(screen.getAllByRole('tab')).toHaveLength(3);
      expect(screen.getByRole('tab', { name: 'Variables' })).not.toBeNull();
      expect(screen.getByRole('tab', { name: 'System Prompt' })).not.toBeNull();
      expect(screen.getByRole('tab', { name: 'Tools 2' })).not.toBeNull();
    });

    it('keeps the system prompt in edit mode without a preview toggle', () => {
      render(<AgentPlaygroundConfigHarness />);

      fireEvent.click(screen.getByRole('tab', { name: 'System Prompt' }));

      expect(screen.getByText('Instruction blocks editor')).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    });

    it('shows variable syntax help as a tooltip from the underlined text', async () => {
      render(<AgentPlaygroundConfigHarness />);

      fireEvent.click(screen.getByRole('tab', { name: 'System Prompt' }));

      const variableHelpTrigger = screen.getByRole('button', { name: 'use variables' });
      fireEvent.focus(variableHelpTrigger);

      expect((await screen.findByRole('tooltip')).textContent).toBe(
        'Use {{variableName}} syntax to insert dynamic values into your instruction blocks.',
      );
    });
  });
});
