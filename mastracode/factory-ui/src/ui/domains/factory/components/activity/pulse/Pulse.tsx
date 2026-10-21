import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useApiConfig } from '../../../../../../api/config';
import { boardQueryOptions } from '../../../../../../hooks/useWorkItems';
import { SkeletonRows } from '../../../../../ui/SkeletonRows';
import type { LinkedRepositoryPayload } from '../../../../workspaces/services/github';
import { LaneChart } from './lanes/LaneChart';
import { runBars } from './runs/runBars';
import { LIVE_HOUR, viewportWindow } from './time/timeViewport';
import type { TimeViewport } from './time/timeViewport';
import { useCommitLane } from './commits/useCommitLane';
import { useNow } from './time/useNow';
import { useRunTrail } from './runs/useRunTrail';

/** Roughly one clock step per pixel of a full-width chart, so a running bar grows without visible jumps. */
const NOW_STEPS_PER_WINDOW = 720;
const MIN_NOW_STEP_MS = 1000;

interface PulseProps {
  factoryId: string;
  repositories: LinkedRepositoryPayload[];
}

export function Pulse(props: PulseProps) {
  return (
    <section aria-label="Agents" className="flex flex-col gap-2">
      <PulseBody {...props} />
    </section>
  );
}

function PulseBody({ factoryId, repositories }: PulseProps) {
  const { baseUrl } = useApiConfig();
  const [viewport, setViewport] = useState<TimeViewport>(LIVE_HOUR);
  const nowMs = useNow(viewport.live ? Math.max(MIN_NOW_STEP_MS, viewport.spanMs / NOW_STEPS_PER_WINDOW) : undefined);
  const window = viewportWindow(viewport, nowMs);
  const { trail, failed, retry, loadingEarlier, earlierFailed, retryEarlier } = useRunTrail({
    factoryProjectId: factoryId,
    viewStartMs: window.startMs,
    live: viewport.live,
  });
  const boardQuery = useQuery(boardQueryOptions(baseUrl, factoryId));
  const board = boardQuery.data;
  const commitLane = useCommitLane({ factoryId, repositories, window });
  const runs = useMemo(() => (trail && board ? runBars(trail, board) : undefined), [trail, board]);

  if (failed || boardQuery.isLoadingError) {
    return (
      <Notice variant="destructive">
        <span>Unable to load agent runs.</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            retry();
            void boardQuery.refetch();
          }}
        >
          Try again
        </Button>
      </Notice>
    );
  }

  if (runs === undefined) {
    return <SkeletonRows label="Loading agent runs" rows={5} rowClassName="h-4 w-full" />;
  }

  return (
    <>
      <LaneChart
        runs={runs}
        commitLane={commitLane}
        viewport={viewport}
        setViewport={setViewport}
        window={window}
        nowMs={nowMs}
        factoryProjectId={factoryId}
      />
      {earlierFailed ? (
        <Txt as="p" variant="caption" tone="muted" className="m-0 flex items-center gap-2">
          Earlier runs could not be loaded.
          <Button type="button" variant="link" size="sm" onClick={retryEarlier}>
            Try again
          </Button>
        </Txt>
      ) : null}
      {!earlierFailed && loadingEarlier ? (
        <Txt as="p" variant="caption" tone="muted" className="m-0">
          Loading earlier runs…
        </Txt>
      ) : null}
    </>
  );
}
