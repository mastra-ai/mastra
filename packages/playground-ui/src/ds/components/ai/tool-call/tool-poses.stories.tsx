import type { Meta, StoryObj } from '@storybook/react-vite';

import { AgentIndicator, agentIndicatorStates } from '../../AgentIndicator';
import { Txt } from '../../Txt';
import { ActivityItem } from '../activity';
import { toolPhrases } from './tool-phrases';
import { presentTool, presentedToolNames } from './tool-presentation';

const SAMPLE_ARGS = {
  path: 'src/agent.ts',
  command: 'pnpm test',
  pattern: 'useChat',
  query: 'oauth flow',
  pid: 4242,
  name: 'review',
};

const calls = [...presentedToolNames, 'fetch_pull_request'].map(toolName => ({
  toolName,
  ...presentTool(toolName, SAMPLE_ARGS),
}));

function ToolPoses() {
  return (
    <div className="grid max-w-4xl gap-8 p-6">
      {agentIndicatorStates
        .filter(pose => calls.some(call => call.pose === pose))
        .map(pose => (
          <section key={pose} aria-label={pose} className="grid gap-2">
            <div className="flex items-center gap-3">
              <AgentIndicator state={pose} className="size-8" />
              <Txt variant="caption" font="mono" tone="muted">
                {pose}
              </Txt>
            </div>
            <div className="grid grid-cols-[1fr_1fr_10rem] items-center gap-x-4 pl-11">
              {calls
                .filter(call => call.pose === pose)
                .map(({ toolName, icon: Icon, label, detail }) => (
                  <div key={toolName} className="contents">
                    <ActivityItem
                      status="running"
                      icon={<Icon />}
                      label={toolPhrases(label).live}
                      detail={detail}
                      aria-label={`${toolName} running`}
                    />
                    <ActivityItem icon={<Icon />} label={label} detail={detail} aria-label={`${toolName} done`} />
                    <Txt variant="caption" font="mono" tone="faint" className="truncate">
                      {toolName}
                    </Txt>
                  </div>
                ))}
            </div>
          </section>
        ))}
    </div>
  );
}

const meta = {
  title: 'AI/Activity/Tool Poses',
  component: ToolPoses,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Every tool `presentTool` knows, grouped by the pose the agent indicator takes while it runs: the live row, the settled row, then the raw tool name. A tool it does not know, like `fetch_pull_request`, falls back to the nut.',
      },
    },
  },
} satisfies Meta<typeof ToolPoses>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryTool: Story = {};
