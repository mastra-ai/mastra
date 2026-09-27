import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Toaster } from '@/ds/components/Toaster';
import { Txt } from '@/ds/components/Txt';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

function CopyToClipboardDemo({ copiedDuration }: { copiedDuration: number }) {
  const [text, setText] = useState('Hello from Playground UI');
  const configured = useCopyToClipboard({ text, copiedDuration });
  const dynamic = useCopyToClipboard({ copiedDuration });
  return (
    <HookDemo>
      <Txt as="label" htmlFor="clipboard-text">
        Text to copy
      </Txt>
      <Input id="clipboard-text" value={text} onChange={event => setText(event.target.value)} />
      <Button disabled={!text} onClick={configured.handleCopy}>
        {configured.isCopied ? 'Copied configured text' : 'Copy configured text'}
      </Button>
      <Button disabled={!text} onClick={() => dynamic.copyToClipboard(text)}>
        {dynamic.isCopied ? 'Copied per-call text' : 'Copy per-call text'}
      </Button>
      <Txt as="label" htmlFor="clipboard-paste">
        Paste here to verify
      </Txt>
      <Input id="clipboard-paste" />
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
