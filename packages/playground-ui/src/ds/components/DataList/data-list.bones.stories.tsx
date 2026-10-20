import type { Meta, StoryObj } from '@storybook/react-vite';
import { DataList } from './data-list';
import { BoneSkeleton } from '@/ds/components/Bones';
import { Status } from '@/ds/components/StatusIndicators';

/**
 * Capture fixture for the `data-list` bone (`pnpm bones:capture`). With `loading` on, the story shows
 * the committed bones; during capture boneyard renders the list below and measures it.
 */
const meta: Meta<{ loading: boolean }> = {
  title: 'Bones/DataList',
  parameters: { layout: 'padded' },
  args: { loading: true },
};

export default meta;

const COLUMNS = 'auto minmax(0,1fr) auto auto auto';

const RUNS = [
  { id: 'run_8f3a91b2c4d6e8f0', input: 'What is the weather in Tokyo?', failed: false },
  { id: 'run_2e7c89d1a3b5f7e9', input: 'Summarize the latest sales report', failed: false },
  { id: 'run_5a1b4c7d9e2f3a6b', input: 'Translate hello to Japanese', failed: true },
  { id: 'run_9d4e7f2a5c8b1d3e', input: 'Generate a recipe for banana bread', failed: false },
  { id: 'run_1c3e5a7b9d2f4a6c', input: 'Draft a reply to the support ticket', failed: false },
];

const createdAt = '2026-05-21T09:14:22.123Z';

export const Default: StoryObj<{ loading: boolean }> = {
  render: ({ loading }) => (
    <BoneSkeleton name="data-list" loading={loading}>
      <DataList columns={COLUMNS}>
        <DataList.Top>
          <DataList.TopCell>ID</DataList.TopCell>
          <DataList.TopCell>Input</DataList.TopCell>
          <DataList.TopCell>Status</DataList.TopCell>
          <DataList.TopCell>Date</DataList.TopCell>
          <DataList.TopCell>Time</DataList.TopCell>
        </DataList.Top>
        {RUNS.map(run => (
          <DataList.RowStatic key={run.id}>
            <DataList.IdCell id={run.id} />
            <DataList.TextCell>{run.input}</DataList.TextCell>
            <DataList.Cell>
              <Status
                presentation={
                  run.failed
                    ? { label: 'Failed', tone: 'error', description: 'The run failed.' }
                    : { label: 'Success', tone: 'success', description: 'The run completed successfully.' }
                }
              />
            </DataList.Cell>
            <DataList.DateCell timestamp={createdAt} />
            <DataList.TimeCell timestamp={createdAt} />
          </DataList.RowStatic>
        ))}
      </DataList>
    </BoneSkeleton>
  ),
};
