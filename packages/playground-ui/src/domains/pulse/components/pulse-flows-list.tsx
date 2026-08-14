import type { ListPulseFlowsParams } from '@mastra/client-js';
import { CircleSlash2, Radio } from 'lucide-react';
import { PulseStatusBadge } from './shared';
import { formatCost } from '@/domains/metrics/components/metrics-utils';
import { isPulseUnavailableError, usePulseFlows } from '@/domains/pulse/hooks/use-pulse-flows';
import { formatClockTime, formatFlowDuration, toDate } from '@/domains/pulse/utils/format';
import { DataList, DataListSkeleton } from '@/ds/components/DataList';
import { EmptyState } from '@/ds/components/EmptyState';

const COLUMNS = 'max-content minmax(10rem, 1fr) max-content max-content max-content max-content max-content';

export type PulseFlowsListProps = {
  /** Server-side filters/pagination forwarded to `GET /api/pulse/flows`. */
  params?: ListPulseFlowsParams;
  /** Currently selected flow — its row gets the highlighted background. */
  selectedFlowId?: string | null;
  onSelectFlow: (flowId: string) => void;
};

/**
 * Business list of derived pulse flows. Fetches through `usePulseFlows` (which
 * live-tails while any flow is running) and renders with DataList primitives.
 */
export function PulseFlowsList({ params, selectedFlowId, onSelectFlow }: PulseFlowsListProps) {
  const { data, isLoading, isError, error } = usePulseFlows(params);

  if (isLoading) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  if (isError) {
    if (isPulseUnavailableError(error)) {
      return (
        <EmptyState
          iconSlot={<CircleSlash2 className="text-neutral3 size-8" />}
          titleSlot="Pulse is not available"
          descriptionSlot="The server has no pulse store configured, so derived flows cannot be served. Pulse is experimental and off by default."
        />
      );
    }
    return (
      <EmptyState
        iconSlot={<CircleSlash2 className="text-neutral3 size-8" />}
        titleSlot="Could not load flows"
        descriptionSlot={error instanceof Error ? error.message : 'An unexpected error occurred.'}
      />
    );
  }

  const flows = data?.flows ?? [];

  if (flows.length === 0) {
    return (
      <EmptyState
        iconSlot={<Radio className="text-neutral3 size-8" />}
        titleSlot="No flows yet"
        descriptionSlot="Flows appear here as soon as pulse rows are captured for an agent or workflow run."
      />
    );
  }

  return (
    <DataList columns={COLUMNS} variant="striped" fit="container">
      <DataList.Top>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Flow</DataList.TopCell>
        <DataList.TopCell>Entity</DataList.TopCell>
        <DataList.TopCell>Started</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Duration</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Pulses</DataList.TopCell>
        <DataList.TopCell className="justify-end text-right">Cost</DataList.TopCell>
      </DataList.Top>
      {flows.map(flow => (
        <DataList.RowButton
          key={flow.flowId}
          featured={flow.flowId === selectedFlowId}
          onClick={() => onSelectFlow(flow.flowId)}
        >
          <DataList.Cell>
            <PulseStatusBadge status={flow.status} />
          </DataList.Cell>
          <DataList.MonoCell>{flow.flowId}</DataList.MonoCell>
          <DataList.TextCell>{flow.entityName ?? ''}</DataList.TextCell>
          <DataList.Cell>
            <span title={toDate(flow.startedAt).toISOString()}>{formatClockTime(flow.startedAt)}</span>
          </DataList.Cell>
          {/* durationMs is null while running/stale — rendered as an em dash. */}
          <DataList.NumberCell>{formatFlowDuration(flow.durationMs)}</DataList.NumberCell>
          <DataList.NumberCell>{flow.pulseCount}</DataList.NumberCell>
          {/* Cost is only known when metric pulses carried estimated_cost_usd. */}
          <DataList.NumberCell>{flow.costUsd !== undefined ? formatCost(flow.costUsd) : ''}</DataList.NumberCell>
        </DataList.RowButton>
      ))}
    </DataList>
  );
}
