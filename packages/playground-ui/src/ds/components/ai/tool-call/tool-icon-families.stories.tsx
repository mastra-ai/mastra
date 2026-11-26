import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { toolPhrases } from './tool-phrases';
import { presentTool } from './tool-presentation';
import { AgentIndicator } from '@/ds/components/AgentIndicator';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

interface ToolIconExample {
  toolName: string;
  args?: Record<string, unknown>;
}

const toolIconExamples = {
  Knowledge: [
    { toolName: 'knowledge_search', args: { query: 'Refund policy' } },
    { toolName: 'knowledge_read', args: { page: 'Refund policy' } },
    { toolName: 'knowledge_page', args: { op: 'write', page: 'Refund policy' } },
    { toolName: 'knowledge_note', args: { op: 'add', page: 'Refund policy' } },
    { toolName: 'knowledge_pin', args: { op: 'pin', page: 'Refund policy' } },
    { toolName: 'knowledge_pin', args: { op: 'unpin', page: 'Refund policy' } },
    { toolName: 'knowledge_page', args: { op: 'merge', page: 'Refunds', into: 'Refund policy' } },
    { toolName: 'knowledge_page', args: { op: 'move', page: 'Refund policy', parent: 'Support' } },
    { toolName: 'knowledge_page', args: { op: 'delete', page: 'Old refund policy' } },
  ],
  Files: [
    { toolName: 'view', args: { path: 'src/refunds.ts' } },
    { toolName: 'write_file', args: { path: 'src/refunds.ts' } },
    { toolName: 'string_replace_lsp', args: { path: 'src/refunds.ts' } },
    { toolName: 'find_files', args: { pattern: 'src/tools/**' } },
    { toolName: 'list_files', args: { path: 'src/tools' } },
    { toolName: 'mkdir', args: { path: 'src/tools' } },
    { toolName: 'lsp_inspect', args: { path: 'src/refunds.ts' } },
    { toolName: 'file_stat', args: { path: 'src/refunds.ts' } },
    { toolName: 'delete_file', args: { path: 'src/old-refunds.ts' } },
  ],
  Terminal: [
    { toolName: 'execute_command', args: { command: 'pnpm dev' } },
    { toolName: 'get_process_output', args: { pid: 42 } },
    { toolName: 'kill_process', args: { pid: 42 } },
  ],
  Browser: [
    { toolName: 'web_search', args: { query: 'Payment API documentation' } },
    { toolName: 'web_fetch', args: { url: 'docs.example.com/refunds' } },
    { toolName: 'browser_click', args: { selector: 'Create refund' } },
    { toolName: 'browser_type', args: { selector: 'Amount' } },
    { toolName: 'browser_screenshot', args: { path: 'refund-form.png' } },
    { toolName: 'execute_typescript', args: { code: 'await tools.checkRefund()' } },
  ],
  Coordination: [
    { toolName: 'subagent', args: { agentType: 'Support specialist' } },
    { toolName: 'workflow-refund', args: {} },
    { toolName: 'ask_user', args: { question: 'Approve the refund?' } },
    { toolName: 'submit_plan', args: { title: 'Update the refund flow' } },
    { toolName: 'request_connection', args: { provider: 'Stripe' } },
    { toolName: 'agent_signal_send', args: { targetId: 'Support specialist' } },
    { toolName: 'schedule_create', args: { promptFile: 'Review refunds every Friday' } },
    { toolName: 'notification_inbox', args: {} },
  ],
  'Source control': [
    { toolName: 'source_control_push_branch', args: { repository: 'support-service' } },
    { toolName: 'source_control_merge_change_request', args: { changeRequestId: '124' } },
    { toolName: 'source_control_review_change_request', args: { changeRequestId: '124' } },
    { toolName: 'source_control_comment_change_request', args: { changeRequestId: '124' } },
    { toolName: 'factory_create_work_item', args: { title: 'Improve refunds' } },
  ],
  Skills: [
    { toolName: 'skill', args: { name: 'Customer support' } },
    { toolName: 'skill_search', args: { query: 'Refunds' } },
    { toolName: 'skill_read', args: { path: 'customer-support/SKILL.md' } },
  ],
} as const satisfies Record<string, readonly ToolIconExample[]>;

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
