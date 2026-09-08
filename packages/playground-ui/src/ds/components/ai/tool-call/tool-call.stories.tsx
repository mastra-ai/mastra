import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, FileText, Terminal, X } from 'lucide-react';
import { useState } from 'react';
import {
  ToolCall,
  ToolCallContent,
  ToolCallDetail,
  ToolCallDisclosure,
  ToolCallHeader,
  ToolCallIcon,
  ToolCallLabel,
  ToolCallSpacer,
  ToolCallTrailing,
  ToolCallTrigger,
} from './tool-call';

const meta: Meta<typeof ToolCall> = {
  title: 'AI/Tool Call',
  component: ToolCall,
  decorators: [
    Story => (
      <div className="w-full max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof ToolCall>;

const Code = ({ children }: { children: string }) => (
  <pre className="text-icon4 bg-surface1 m-0 max-h-60 overflow-auto rounded-md px-3 py-2 font-mono text-xs leading-normal whitespace-pre-wrap">
    {children}
  </pre>
);

export const Completed: Story = {
  render: () => (
    <ToolCall defaultOpen aria-label="Tool: read file">
      <ToolCallTrigger>
        <ToolCallHeader>
          <ToolCallIcon>
            <FileText size={14} strokeWidth={1.75} aria-hidden />
          </ToolCallIcon>
          <ToolCallLabel>Read file</ToolCallLabel>
          <ToolCallDetail>src/agent.ts</ToolCallDetail>
          <ToolCallSpacer />
          <ToolCallTrailing>
            <Check size={13} aria-label="Completed" className="text-positive1" />
          </ToolCallTrailing>
          <ToolCallDisclosure />
        </ToolCallHeader>
      </ToolCallTrigger>
      <ToolCallContent>
        <Code>{`export const agent = new Agent({\n  name: 'Support agent',\n});`}</Code>
      </ToolCallContent>
    </ToolCall>
  ),
};

export const Running: Story = {
  render: () => (
    <ToolCall status="running" aria-label="Tool: execute command">
      <ToolCallTrigger>
        <ToolCallHeader>
          <ToolCallIcon>
            <Terminal size={14} strokeWidth={1.75} aria-hidden />
          </ToolCallIcon>
          <ToolCallLabel>Running command</ToolCallLabel>
          <ToolCallDetail>pnpm test</ToolCallDetail>
          <ToolCallSpacer />
          <ToolCallDisclosure />
        </ToolCallHeader>
      </ToolCallTrigger>
      <ToolCallContent>
        <Code>pnpm test</Code>
      </ToolCallContent>
    </ToolCall>
  ),
};

export const Failed: Story = {
  render: () => (
    <ToolCall status="error" defaultOpen aria-label="Tool: write file">
      <ToolCallTrigger>
        <ToolCallHeader>
          <ToolCallIcon className="text-error/80">
            <FileText size={14} strokeWidth={1.75} aria-hidden />
          </ToolCallIcon>
          <ToolCallLabel>Write file</ToolCallLabel>
          <ToolCallDetail>src/config.ts</ToolCallDetail>
          <ToolCallSpacer />
          <ToolCallTrailing>
            <X size={13} role="img" aria-label="Failed" className="text-error" />
          </ToolCallTrailing>
          <ToolCallDisclosure />
        </ToolCallHeader>
      </ToolCallTrigger>
      <ToolCallContent>
        <Code>Permission denied: src/config.ts</Code>
      </ToolCallContent>
    </ToolCall>
  ),
};

function ControlledExample() {
  const [open, setOpen] = useState(false);

  return (
    <ToolCall open={open} onOpenChange={setOpen} aria-label="Tool: custom result">
      <ToolCallTrigger>
        <ToolCallHeader>
          <ToolCallIcon>◆</ToolCallIcon>
          <ToolCallLabel>Custom result</ToolCallLabel>
          <ToolCallDetail>{open ? 'Expanded' : 'Collapsed'}</ToolCallDetail>
          <ToolCallSpacer rule />
          <ToolCallDisclosure />
        </ToolCallHeader>
      </ToolCallTrigger>
      <ToolCallContent>
        <div className="border-border1 bg-surface1 rounded-md border p-3 text-sm">
          Arbitrary consumer-rendered content
        </div>
      </ToolCallContent>
    </ToolCall>
  );
}

export const Controlled: Story = {
  render: () => <ControlledExample />,
};
