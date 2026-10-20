import type { Meta, StoryObj } from '@storybook/react-vite';
import { BoneSkeleton } from '@/ds/components/Bones';
import { Button } from '@/ds/components/Button';
import { DataList } from '@/ds/components/DataList';
import { TextAndIcon } from '@/ds/components/Text';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';

/**
 * Capture fixture for the Studio agents list bone (`agents-list`). Studio has no Storybook, so this
 * mirrors `packages/playground/src/domains/agents/components/agent-list/agents-list.tsx`: keep the
 * column template and cells in step with it, then run `pnpm bones:capture`.
 */
const meta: Meta<{ loading: boolean }> = {
  title: 'Bones/Agents list',
  parameters: { layout: 'fullscreen' },
  args: { loading: true },
};

export default meta;

const COLUMNS = 'minmax(12rem,20rem) minmax(0,1fr) auto auto auto auto';

const AGENTS = [
  { name: 'Weather Agent', purpose: 'Answers questions about current conditions and forecasts.', counts: [1, 0, 2] },
  { name: 'Support Triage', purpose: 'Routes incoming tickets to the right team.', counts: [2, 1, 4] },
  { name: 'Research Assistant', purpose: 'Searches sources and drafts cited summaries.', counts: [0, 2, 3] },
  { name: 'Sales Analyst', purpose: 'Builds weekly pipeline reports from CRM data.', counts: [1, 0, 5] },
  { name: 'Code Reviewer', purpose: 'Reviews pull requests against the style guide.', counts: [0, 0, 1] },
];

function CountButton({ count, icon }: { count: number; icon: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <Button type="button" variant="ghost" size="sm" icon={icon}>
      <span>{count}</span>
    </Button>
  );
}

export const Default: StoryObj<{ loading: boolean }> = {
  render: ({ loading }) => (
    <BoneSkeleton name="agents-list" loading={loading}>
      <DataList columns={COLUMNS} fit="container">
        <DataList.Top>
          <DataList.TopCell>Name</DataList.TopCell>
          <DataList.TopCell>Purpose</DataList.TopCell>
          <DataList.TopCell className="text-center">Provider</DataList.TopCell>
          <DataList.TopCell className="text-center">
            <TextAndIcon className="text-column">
              <WorkflowIcon aria-hidden="true" />
              <span>Workflows</span>
            </TextAndIcon>
          </DataList.TopCell>
          <DataList.TopCell className="text-center">
            <TextAndIcon className="text-column">
              <AgentIcon aria-hidden="true" />
              <span>Agents</span>
            </TextAndIcon>
          </DataList.TopCell>
          <DataList.TopCell className="text-center">
            <TextAndIcon className="text-column">
              <ToolsIcon aria-hidden="true" />
              <span>Tools</span>
            </TextAndIcon>
          </DataList.TopCell>
        </DataList.Top>
        {AGENTS.map(agent => (
          <DataList.RowStatic key={agent.name}>
            <DataList.Cell className="min-w-0 text-left text-muted-foreground">
              <span className="block truncate">{agent.name}</span>
            </DataList.Cell>
            <DataList.Cell className="min-w-0">
              <span className="block truncate">{agent.purpose}</span>
            </DataList.Cell>
            <DataList.Cell className="justify-center">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Model">
                <AgentIcon aria-hidden="true" />
              </Button>
            </DataList.Cell>
            <DataList.Cell className="justify-center">
              <CountButton count={agent.counts[0] ?? 0} icon={<WorkflowIcon aria-hidden="true" />} />
            </DataList.Cell>
            <DataList.Cell className="justify-center">
              <CountButton count={agent.counts[1] ?? 0} icon={<AgentIcon aria-hidden="true" />} />
            </DataList.Cell>
            <DataList.Cell className="justify-center">
              <CountButton count={agent.counts[2] ?? 0} icon={<ToolsIcon aria-hidden="true" />} />
            </DataList.Cell>
          </DataList.RowStatic>
        ))}
      </DataList>
    </BoneSkeleton>
  ),
};
