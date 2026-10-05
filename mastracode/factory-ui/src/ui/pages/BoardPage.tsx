import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { useParams } from 'react-router';
import type { InstalledBoardInfo } from '../../api/types';
import { useBoardCatalog } from '../../hooks/useBoardCatalog';
import { ConnectRepositoryEmptyState } from '../domains/factory/components/ConnectRepositoryEmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import type { BoardKind } from '../domains/factory/boardStages';
import type { FactoryProject } from '../domains/workspaces/services/github';
import { BoardContent } from './board/BoardContent';

/**
 * Factory › Board: an org-wide kanban over the repository's work items. The
 * Intake column merges persisted `intake` cards with live GitHub/Linear
 * candidates (issues and PRs that have no record yet — records are
 * materialized only when someone acts on them). Everything enters through
 * Intake and moves through the system from there. Cards move between columns
 * by drag-and-drop or the card menu; moves only file/move cards, never start
 * agent runs.
 */
export function WorkBoardPage() {
  return <BoardLayout kind="work" />;
}

export function ReviewBoardPage() {
  return <BoardLayout kind="review" />;
}

export function CustomBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  return <BoardLayout kind={boardId ?? ''} />;
}

function BoardLayout({ kind }: { kind: string }) {
  const factory = useActiveFactory();
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout variant="fit" {...slots}>
      <Board factory={factory} kind={kind} />
    </PageLayout>
  );
}

function Board({ factory, kind }: { factory: FactoryProject; kind: BoardKind }) {
  const catalog = useBoardCatalog(factory.id);
  if (catalog.isPending) {
    return (
      <p role="status" className="p-4">
        Loading boards…
      </p>
    );
  }
  if (catalog.isError) {
    return <EmptyState variant="fill" titleSlot={<span role="alert">Unable to load boards.</span>} />;
  }
  const definition = catalog.data.find(board => board.id === kind);
  if (!definition) {
    return (
      <EmptyState
        variant="fill"
        titleSlot={<span role="alert">Board unavailable: this board is not installed.</span>}
      />
    );
  }
  return <InstalledBoard factory={factory} definition={definition} />;
}

function InstalledBoard({ factory, definition }: { factory: FactoryProject; definition: InstalledBoardInfo }) {
  const kind = definition.id;
  const repository = factory.repositories[0];
  if (!repository) return <ConnectRepositoryEmptyState factoryId={factory.id} review={kind === 'review'} />;
  return <BoardContent factory={factory} repository={repository} kind={kind} definition={definition} />;
}
