import type { PullRequestStatus, WorkItem } from '@internal/factory-contract';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { BoardNavigation } from '..';

/** The repository a card's session works in. */
export interface CardPanelRepository {
  slug: string;
  provider?: 'github' | 'gitlab';
  projectRepositoryId?: string;
}

/** The card source's own description, fetched from its provider. */
export interface CardSourceDescriptionQuery {
  data?: { description?: string | null };
  isLoading: boolean;
  isError: boolean;
}

export interface CardWorkspaceSlots {
  repository?: { slug: string; provider: 'github' | 'gitlab' };
  changeRequest?: { badge: ReactNode; status: PullRequestStatus | undefined };
}

/** Renders the session's workspace section; absent when the card has no session yet. */
export type CardWorkspaceSlot = (slots?: CardWorkspaceSlots) => ReactNode;

/** What the card panel needs from the app it runs in. */
export interface CardPanelHost {
  LinkComponent: BoardNavigation['LinkComponent'];
  /** Where a related card opens: its session when it has one the viewer can open, its board otherwise. */
  relatedCardHref(item: WorkItem, session: { sessionId: string; threadId: string } | undefined): string;
  /** The sessions out of `sessionIds` the viewer can still open. */
  useLiveSessions(sessionIds: readonly string[]): readonly string[];
  /** The source's description; undefined for sources with none to fetch. */
  useSourceDescription(
    item: WorkItem,
    repository: CardPanelRepository | undefined,
  ): CardSourceDescriptionQuery | undefined;
  /** Shown in place of the workspace section while the panel loads. */
  workspaceSkeleton?: ReactNode;
}

export const CardPanelHostContext = createContext<CardPanelHost | undefined>(undefined);

export function useCardPanelHost(): CardPanelHost {
  const host = useContext(CardPanelHostContext);
  if (!host) throw new Error('useCardPanelHost must be used inside CardPanelHostContext');
  return host;
}
