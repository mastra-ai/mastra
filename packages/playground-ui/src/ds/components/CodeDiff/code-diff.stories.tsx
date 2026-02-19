import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeDiff } from './code-diff';

const meta: Meta<typeof CodeDiff> = {
  title: 'Elements/CodeDiff',
  component: CodeDiff,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CodeDiff>;

const sampleA = JSON.stringify(
  {
    input: { query: 'What is the capital of France?' },
    groundTruth: { answer: 'Paris' },
    metadata: { category: 'geography', difficulty: 'easy' },
  },
  null,
  2,
);

const sampleB = JSON.stringify(
  {
    input: { query: 'What is the capital of France?' },
    groundTruth: { answer: 'Paris, France' },
    metadata: { category: 'geography', difficulty: 'medium', source: 'trivia-db' },
  },
  null,
  2,
);

export const Default: Story = {
  args: {
    codeA: sampleA,
    codeB: sampleB,
  },
};

export const Identical: Story = {
  args: {
    codeA: sampleA,
    codeB: sampleA,
  },
};

export const CompletelyDifferent: Story = {
  args: {
    codeA: JSON.stringify({ input: { prompt: 'Hello' }, groundTruth: null }, null, 2),
    codeB: JSON.stringify({ input: { prompt: 'Goodbye' }, groundTruth: { response: 'See you later' } }, null, 2),
  },
};

export const LargeDocument: Story = {
  args: {
    codeA: JSON.stringify(
      {
        input: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Explain quantum computing in simple terms.' },
          ],
          temperature: 0.7,
          maxTokens: 500,
        },
        groundTruth: {
          response:
            'Quantum computing uses quantum bits (qubits) that can exist in multiple states simultaneously, unlike classical bits which are either 0 or 1.',
        },
        metadata: {
          model: 'gpt-4',
          latency: 1200,
          tokens: { prompt: 45, completion: 120 },
        },
      },
      null,
      2,
    ),
    codeB: JSON.stringify(
      {
        input: {
          messages: [
            { role: 'system', content: 'You are a helpful and concise assistant.' },
            { role: 'user', content: 'Explain quantum computing in simple terms.' },
            { role: 'assistant', content: 'Sure! Let me break it down.' },
          ],
          temperature: 0.5,
          maxTokens: 1000,
        },
        groundTruth: {
          response:
            'Quantum computing leverages quantum mechanics principles like superposition and entanglement to process information in fundamentally different ways than classical computers.',
        },
        metadata: {
          model: 'gpt-4-turbo',
          latency: 800,
          tokens: { prompt: 60, completion: 150 },
          version: 2,
        },
      },
      null,
      2,
    ),
  },
};
