import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeIcon } from 'lucide-react';
import { TooltipProvider } from '../Tooltip';
import { DataCodeSection } from './data-code-section';

const meta: Meta<typeof DataCodeSection> = {
  title: 'Composite/DataCodeSection',
  component: DataCodeSection,
  decorators: [
    Story => (
      <TooltipProvider>
        <div className="w-150">
          <Story />
        </div>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof DataCodeSection>;

const sampleJson = JSON.stringify(
  {
    model: 'gpt-4-turbo',
    temperature: 0.7,
    maxTokens: 4096,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello, how are you?' },
    ],
  },
  null,
  2,
);

export const Default: Story = {
  args: {
    title: 'Input',
    codeStr: sampleJson,
  },
};

export const WithIcon: Story = {
  args: {
    title: 'Request Body',
    icon: <CodeIcon />,
    codeStr: sampleJson,
  },
};

export const Simplified: Story = {
  args: {
    title: 'Plain Text',
    codeStr: sampleJson,
    simplified: true,
  },
};

export const WithMultilineContent: Story = {
  args: {
    title: 'Output',
    codeStr: JSON.stringify(
      {
        response: 'Hello!\\nHow can I help you today?\\nLet me know if you have any questions.',
      },
      null,
      2,
    ),
  },
};

export const LargeContent: Story = {
  args: {
    title: 'Response',
    icon: <CodeIcon />,
    codeStr: JSON.stringify(
      {
        workflow: {
          id: 'wf-123',
          name: 'Data Processing Pipeline',
          steps: Array.from({ length: 20 }, (_, i) => ({
            id: `step-${i + 1}`,
            type: i % 3 === 0 ? 'transform' : i % 3 === 1 ? 'validate' : 'output',
            config: { timeout: 5000, retries: 3 },
          })),
          metadata: {
            created: '2026-01-14',
            version: '1.0.0',
          },
        },
      },
      null,
      2,
    ),
  },
};

export const NullContent: Story = {
  args: {
    title: 'Empty',
    codeStr: 'null',
  },
};

export const CustomDialogTitle: Story = {
  args: {
    title: 'Input',
    dialogTitle: 'Full Request Payload — POST /api/agents/run',
    icon: <CodeIcon />,
    codeStr: sampleJson,
  },
};

// Content with a term that repeats many times so the search match-navigation is easy to try:
// click the magnifier, type "pregunta", then cycle with Enter / Shift+Enter or the ▲/▼ buttons.
export const SearchNavigation: Story = {
  args: {
    title: 'Input',
    icon: <CodeIcon />,
    codeStr: JSON.stringify(
      {
        topic: 'Sumas y restas hasta 9999',
        instructions:
          'Genera exactamente 10 preguntas usando solo los tipos seleccionados. Ordena las preguntas de menor a mayor dificultad. Recuerda que cada pregunta es obligatoria y nunca null.',
        questions: Array.from({ length: 10 }, (_, i) => ({
          id: `question-${i + 1}`,
          type: i % 2 === 0 ? 'opcion_multiple' : 'abierta',
          prompt: `Pregunta ${i + 1}`,
        })),
      },
      null,
      2,
    ),
  },
};
