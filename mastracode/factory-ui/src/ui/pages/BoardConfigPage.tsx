import { BoardHeaderSkeleton, CanvasFrame, PhaseFlowSkeleton } from '@mastra/playground-ui/domains/factory';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import type { ReactNode } from 'react';

import { BoardRequestError, useBoardQuery } from '../../hooks/useBoardEditor';
import { BoardCanvas } from '../domains/boardCanvas/components/BoardCanvas';
import { BoardSettingsTabs } from '../domains/boardCanvas/components/BoardSettingsTabs';
import { BoardDraftProvider } from '../domains/boardConfig/BoardDraftProvider';
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

  if (query.isPending) {
    return (
      <CanvasFrame
        label="Board settings"
        tabs={<BoardSettingsTabs factoryId={factory.id} boardId={boardId} active="settings" />}
        header={<BoardHeaderSkeleton />}
      >
        <PhaseFlowSkeleton />
      </CanvasFrame>
    );
  }
  if (query.isError && query.error instanceof BoardRequestError && query.error.code === 'board_not_found') {
    return (
      <StatusFrame factoryId={factory.id} boardId={boardId}>
        <EmptyState
          variant="fill"
          titleSlot={<span role="alert">Board unavailable: this board is not installed.</span>}
        />
      </StatusFrame>
    );
  }
  if (query.isError) {
    return (
      <StatusFrame factoryId={factory.id} boardId={boardId}>
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
      factoryId={factory.id}
      boardId={boardId}
      phaseKey={route?.phaseKey}
      response={query.data}
      onReload={() => void query.refetch()}
    />
  );
}

/** When the board can't show, the canvas keeps its tabs and controls in place, so switching views never drops them. */
function StatusFrame({ factoryId, boardId, children }: { factoryId: string; boardId: string; children: ReactNode }) {
  return (
    <CanvasFrame
      label="Board settings"
      tabs={<BoardSettingsTabs factoryId={factoryId} boardId={boardId} active="settings" />}
      status={children}
    />
  );
}
