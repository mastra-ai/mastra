import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { toolIconExamples } from './tool-icon-examples';
import type { ToolIconExample } from './tool-icon-examples';
import { toolPhrases } from './tool-phrases';
import { presentTool } from './tool-presentation';
import { AgentIndicator } from '@/ds/components/AgentIndicator';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

function ToolIconFamilies() {
  const [selectedCall, setSelectedCall] = useState<ToolIconExample>(toolIconExamples.Knowledge[2]);
  const { toolName, args } = selectedCall;
  const { pose, label, detail } = presentTool(toolName, args);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 p-4">
      <div className="flex items-center gap-2" aria-live="polite">
        <AgentIndicator state={pose} className="size-4 shrink-0" />
        <Txt>{toolPhrases(label).live}</Txt>
        <Txt tone="muted" className="truncate">
          {detail}
        </Txt>
      </div>
      <div className="flex items-center gap-4">
        <AgentIndicator state={pose} className="size-16 shrink-0" />
        <Txt variant="caption" tone="muted">
          {toolName}
        </Txt>
      </div>
      {Object.entries(toolIconExamples).map(([group, calls]) => (
        <div key={group} className="flex flex-col gap-2">
          <Txt>{group}</Txt>
          <div className="flex flex-wrap gap-2">
            {calls.map(call => {
              const { icon: Icon, label } = presentTool(call.toolName, call.args);
              return (
                <Button
                  key={`${call.toolName}-${label}`}
                  icon={<Icon />}
                  aria-pressed={selectedCall === call}
                  onClick={() => setSelectedCall(call)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'AI/Activity/Tool Icon Families',
  component: ToolIconFamilies,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ToolIconFamilies>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToolFamilies: Story = {};
