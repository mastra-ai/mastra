import { useBoardQuery } from '@mastra/react/hooks/factory';
import {
  BoardHeaderSkeleton,
  CanvasFrame,
  PhaseFlowSkeleton,
  BoardCanvas,
  BoardSettingsTabs,
  BoardDraftProvider,
} from '@mastra/playground-ui/domains/factory';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { FactoryRequestError } from '@mastra/client-js';
import { RouterBoardSettingsHost } from './board/RouterBoardSettingsHost';
import { useBoardConfigRoute } from '../domains/boardConfig/hooks/useBoardConfigRoute';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import { LoadErrorState } from '../ui/LoadErrorState';

/** Factory › board › Board settings: the board's canvas, with a phase, rule or test open in its side panel. */
export function BoardConfigPage() {
  return (
    <BoardDraftProvider>
      <PageLayout variant="page" body="fixed">
        <BoardConfigBody />
      </PageLayout>
    </BoardDraftProvider>
  );
}

/** The board's canvas once it loads; until then, or when it can't, what happened in its place. */
function BoardConfigBody() {
  const factory = useActiveFactory();
  const route = useBoardConfigRoute();
  const boardId = route?.boardId ?? '';
  const query = useBoardQuery(factory.id, boardId);

  return (
    <RouterBoardSettingsHost factoryId={factory.id} repositories={factory.repositories}>
      <BoardConfigState factoryId={factory.id} boardId={boardId} phaseKey={route?.phaseKey} query={query} />
    </RouterBoardSettingsHost>
  );
}

function BoardConfigState({
  factoryId,
  boardId,
  phaseKey,
  query,
}: {
  factoryId: string;
  boardId: string;
  phaseKey: string | undefined;
  query: ReturnType<typeof useBoardQuery>;
}) {
  if (query.isPending) {
    return (
      <CanvasFrame
        label="Board settings"
        tabs={<BoardSettingsTabs boardId={boardId} active="settings" />}
        header={<BoardHeaderSkeleton />}
      >
        <PhaseFlowSkeleton />
      </CanvasFrame>
    );
  }
  if (query.isError && query.error instanceof FactoryRequestError && query.error.code === 'board_not_found') {
    return (
      <StatusFrame boardId={boardId}>
        <EmptyState
          variant="fill"
          titleSlot={<span role="alert">Board unavailable: this board is not installed.</span>}
        />
      </StatusFrame>
    );
  }
  if (query.isError) {
    return (
      <StatusFrame boardId={boardId}>
        <LoadErrorState
          title="Couldn’t load this board"
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </StatusFrame>
    );
  }
  return (
    <BoardCanvas
      // A save or a reload answers with the next revision: the canvas starts over from it.
      key={`${boardId}:${query.data.board.revision ?? 'code'}`}
      factoryId={factoryId}
      boardId={boardId}
      phaseKey={phaseKey}
      response={query.data}
      onReload={() => void query.refetch()}
    />
  );
}

/** When the board can't show, the canvas keeps its tabs and controls in place, so switching views never drops them. */
function StatusFrame({ boardId, children }: { boardId: string; children: ReactNode }) {
  return (
    <CanvasFrame
      label="Board settings"
      tabs={<BoardSettingsTabs boardId={boardId} active="settings" />}
      status={children}
    />
  );
}
