import type { Meta, StoryObj } from '@storybook/react-vite';
import { DEFAULT_TRACE_COLUMN_PREFERENCES, buildTraceListColumns } from '../trace-list-columns';
import { TraceColumnsMenu } from './trace-columns-menu';
import { ActionRow } from '@/ds/components/ActionRow';
import { BoneSkeleton } from '@/ds/components/Bones';
import { Checkbox } from '@/ds/components/Checkbox';
import { DataList, TracesDataList } from '@/ds/components/DataList';
import { Field, FieldLabel } from '@/ds/components/Field';
import { DEFAULT_FILTER_OPERATORS, FilterBar } from '@/ds/components/FilterBar';

/**
 * Capture fixture for the Studio traces page bone (`traces-page`): the toolbar and list the page
 * renders once traces load, with the default columns. Rows are `RowStatic` rather than the real
 * `RowButton`, because boneyard captures a <button> as one solid bone and we want a bone per cell.
 * Keep it in step with `packages/playground/src/pages/traces/index.tsx` and `TracesListView`,
 * then run `pnpm bones:capture`.
 */
const meta: Meta<{ loading: boolean }> = {
  title: 'Bones/Traces page',
  parameters: { layout: 'fullscreen' },
  args: { loading: true },
};

export default meta;

const NAMES = ['Weather Agent', 'Support Triage', 'Research Assistant', 'Order workflow', 'Sales Analyst'];
const INPUTS = [
  'What is the weather in Tokyo?',
  'My order arrived damaged, can I get a refund?',
  'Find recent papers on retrieval evaluation',
  'Process order 4821',
  'Summarize last week’s pipeline',
];

const COLUMNS = buildTraceListColumns(DEFAULT_TRACE_COLUMN_PREFERENCES);

const TRACES = Array.from({ length: 12 }, (_, index) => {
  const startedAt = new Date(Date.UTC(2026, 4, 21, 9, 14 - index, 22));
  return {
    traceId: `trace_${index.toString(16).padStart(4, '0')}8f3a91b2c4d6e8f0`,
    name: NAMES[index % NAMES.length] ?? 'Agent',
    entityType: index % NAMES.length === 3 ? 'workflow_run' : 'agent',
    status: index % 5 === 2 ? 'error' : 'success',
    input: INPUTS[index % INPUTS.length] ?? '',
    output: index % 5 === 2 ? undefined : 'Done.',
    startedAt,
    durationMs: 1200 + index * 310,
    costUsd: 0.0012 * (index + 1),
  };
});

const noop = () => {};

export const Default: StoryObj<{ loading: boolean }> = {
  render: ({ loading }) => (
    <BoneSkeleton name="traces-page" loading={loading}>
      <ActionRow>
        <ActionRow.Start>
          <FilterBar
            fields={[]}
            operators={DEFAULT_FILTER_OPERATORS}
            value={[]}
            onValueChange={noop}
            aria-label="Trace filters"
            className="min-w-64 flex-1"
          >
            <FilterBar.Input placeholder="Filter traces…" />
          </FilterBar>
        </ActionRow.Start>
        <ActionRow.End>
          <TraceColumnsMenu
            preferences={DEFAULT_TRACE_COLUMN_PREFERENCES}
            onToggleColumn={noop}
            onAddCustomColumn={noop}
            onRemoveCustomColumn={noop}
            onAddMetadataColumn={noop}
            onRemoveMetadataColumn={noop}
            onReset={noop}
          />
          <Field orientation="horizontal">
            <Checkbox checked={false} />
            <FieldLabel>Auto refresh</FieldLabel>
          </Field>
        </ActionRow.End>
      </ActionRow>
      <TracesDataList columns={COLUMNS} fit="container" className="min-w-0">
        <TracesDataList.Top>
          <TracesDataList.TopCell>Start</TracesDataList.TopCell>
          <TracesDataList.TopCell>Primitive type</TracesDataList.TopCell>
          <TracesDataList.TopCell>Primitive name</TracesDataList.TopCell>
          <TracesDataList.TopCell>Input</TracesDataList.TopCell>
          <TracesDataList.TopCell>Output</TracesDataList.TopCell>
          <TracesDataList.TopCell>Status</TracesDataList.TopCell>
          <TracesDataList.TopCell className="justify-end text-right">Duration</TracesDataList.TopCell>
          <TracesDataList.TopCell className="justify-end text-right">Est. cost</TracesDataList.TopCell>
        </TracesDataList.Top>
        {TRACES.map(trace => (
          <DataList.RowStatic key={trace.traceId}>
            <TracesDataList.CreatedCell timestamp={trace.startedAt} preset="day-time-seconds" />
            <TracesDataList.TypeCell entityType={trace.entityType} />
            <TracesDataList.NameCell name={trace.name} />
            <TracesDataList.InputCell input={trace.input} />
            <TracesDataList.OutputCell output={trace.output} status={trace.status} />
            <TracesDataList.StatusCell status={trace.status} />
            <DataList.NumberCell font="mono">{(trace.durationMs / 1000).toFixed(2)}s</DataList.NumberCell>
            <DataList.NumberCell>${trace.costUsd.toFixed(4)}</DataList.NumberCell>
          </DataList.RowStatic>
        ))}
      </TracesDataList>
    </BoneSkeleton>
  ),
};
