import type { Meta, StoryObj } from '@storybook/react-vite';
import { SquareArrowRight, SquareDot, SquarePlus } from 'lucide-react';
import { Txt } from '../Txt';
import { CodeDiff } from './code-diff';
import { CodeDiffList } from './code-diff-list';

const meta: Meta<typeof CodeDiff> = {
  title: 'Elements/CodeDiff',
  component: CodeDiff,
  parameters: {
    layout: 'padded',
  },
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
    filename: 'dataset-item.json',
  },
};

export const GitPatch: Story = {
  args: {
    patch: [
      'diff --git a/src/agent.ts b/src/agent.ts',
      'index 2d4a3b1..b8c31d2 100644',
      '--- a/src/agent.ts',
      '+++ b/src/agent.ts',
      '@@ -1,3 +1,4 @@',
      ' export function createAgent() {',
      '-  return { name: "helper" };',
      '+  return { name: "researcher", tools: ["search"] };',
      ' }',
    ].join('\n'),
  },
};

const agentPatch = [
  'diff --git a/src/agent.ts b/src/agent.ts',
  'index 2d4a3b1..b8c31d2 100644',
  '--- a/src/agent.ts',
  '+++ b/src/agent.ts',
  '@@ -1,3 +1,3 @@',
  ' export function createAgent() {',
  '-  return { name: "helper" };',
  '+  return { name: "researcher", tools: ["search"] };',
  ' }',
].join('\n');

const guidePatch = [
  'diff --git a/docs/guide.md b/docs/guide.md',
  'new file mode 100644',
  'index 0000000..3b18e51',
  '--- /dev/null',
  '+++ b/docs/guide.md',
  '@@ -0,0 +1,3 @@',
  '+# Guide',
  '+',
  '+Run the researcher agent with `pnpm dev`.',
].join('\n');

function LineCounts({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <Txt as="span" variant="meta" font="mono" className="flex gap-1 tabular-nums">
      <span className="text-success-indicator">+{additions}</span>
      <span className="text-destructive-foreground">−{deletions}</span>
    </Txt>
  );
}

const modifiedIcon = <SquareDot role="img" aria-label="Modified" className="text-warning-indicator" />;

export const WithFileHeader: Story = {
  args: {
    patch: agentPatch,
    header: { path: 'src/agent.ts', icon: modifiedIcon, meta: <LineCounts additions={1} deletions={1} /> },
  },
};

export const FileList: Story = {
  render: () => (
    <CodeDiffList className="h-[480px] rounded-md border border-border">
      <CodeDiff
        patch={agentPatch}
        header={{ path: 'src/agent.ts', icon: modifiedIcon, meta: <LineCounts additions={1} deletions={1} /> }}
      />
      <CodeDiff
        patch={guidePatch}
        header={{
          path: 'docs/guide.md',
          icon: <SquarePlus role="img" aria-label="Added" className="text-success-indicator" />,
          meta: <LineCounts additions={3} deletions={0} />,
        }}
      />
      <CodeDiff
        header={{
          path: '.agents/skills/react-best-practices/rules/bundle-barrel-imports.md',
          previousPath: '.agents/skills/react/rules/bundle-barrel-imports.md',
          icon: <SquareArrowRight role="img" aria-label="Renamed" className="text-info-indicator" />,
        }}
      />
      <CodeDiff
        header={{
          path: 'pnpm-lock.yaml',
          icon: modifiedIcon,
          meta: (
            <Txt as="span" variant="meta" tone="muted">
              Diff too large to show
            </Txt>
          ),
        }}
      />
    </CodeDiffList>
  ),
};

export const ObservationHistory: Story = {
  args: {
    codeA: 'The user prefers short answers.\nThe project uses TypeScript.\n',
    codeB: 'The user prefers concise answers with examples.\nThe project uses TypeScript.\n',
    filename: 'observations.md',
    layout: 'unified',
  },
};

export const RenameOnly: Story = {
  args: {
    patch: [
      'diff --git a/src/old-agent.ts b/src/new-agent.ts',
      'similarity index 100%',
      'rename from src/old-agent.ts',
      'rename to src/new-agent.ts',
    ].join('\n'),
  },
};

const addedRemovedChangedA = JSON.stringify(
  {
    input: { query: 'What is the capital of France?' },
    groundTruth: { answer: 'Paris' },
    toolMocks: { weather: { temp: 20 } },
    scorerIds: ['exact-match'],
    metadata: { difficulty: 'easy' },
  },
  null,
  2,
);

const addedRemovedChangedB = JSON.stringify(
  {
    input: { query: 'What is the capital of France?' },
    groundTruth: { answer: 'Paris, France' },
    scorerIds: ['exact-match', 'llm-judge'],
    requestContext: { locale: 'fr-FR' },
    metadata: { difficulty: 'easy' },
  },
  null,
  2,
);

/** Removed key (toolMocks), added key (requestContext), changed values. */
export const AddedRemovedChanged: Story = {
  args: {
    codeA: addedRemovedChangedA,
    codeB: addedRemovedChangedB,
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
