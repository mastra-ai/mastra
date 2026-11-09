import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '@/ds/components/Button';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { Toaster } from '@/ds/components/Toaster';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

function CopyToClipboardDemo({ copiedDuration }: { copiedDuration: number }) {
  const [text, setText] = useState('Hello from Playground UI');
  const configured = useCopyToClipboard({ text, copiedDuration });
  const dynamic = useCopyToClipboard({ copiedDuration });
  return (
    <HookDemo>
      <Field>
        <FieldLabel>Text to copy</FieldLabel>
        <Input value={text} onChange={event => setText(event.target.value)} />
      </Field>
      <Button disabled={!text} onClick={configured.handleCopy}>
        {configured.isCopied ? 'Copied configured text' : 'Copy configured text'}
      </Button>
      <Button disabled={!text} onClick={() => dynamic.copyToClipboard(text)}>
        {dynamic.isCopied ? 'Copied per-call text' : 'Copy per-call text'}
      </Button>
      <Field>
        <FieldLabel>Paste here to verify</FieldLabel>
        <Input />
      </Field>
      <Toaster />
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useCopyToClipboard',
  component: CopyToClipboardDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Supports configured text through handleCopy and per-call text through copyToClipboard. Copied feedback follows a successful browser write. Import from `@mastra/playground-ui/hooks/use-copy-to-clipboard`.',
      },
    },
  },
  args: { copiedDuration: 2000 },
} satisfies Meta<typeof CopyToClipboardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
