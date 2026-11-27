import { createContext, useContext } from 'react';
import type { AnchorHTMLAttributes, ElementType, ReactNode } from 'react';

/** A thread a card's session runs in; the host decides where it lives. */
export interface BoardSessionLocation {
  sessionId: string;
  threadId: string;
}

/**
 * Where the board's links go and how it reads and writes its view in the URL.
 * The board never touches a router: each host app (Factory, Platform) supplies this.
 */
export interface BoardNavigation {
  LinkComponent: ElementType<AnchorHTMLAttributes<HTMLAnchorElement>>;
  navigate: (href: string) => void;
  /** The card's page, or its session's thread when the card is working in one. */
  cardHref: (cardId: string, session: BoardSessionLocation | undefined) => string;
  sessionHref: (session: BoardSessionLocation) => string;
  /** Another board, opened on the view the person last used there. */
  boardHref: (boardId: string) => string;
  /** A card shown open on its board. */
  boardCardHref: (boardId: string, cardId: string) => string;
  /** A board's configuration, at a phase when one is named. */
  boardConfigHref: (boardId: string, phaseId?: string) => string;
  /** A board's configuration, opened on a new intake rule. */
  newIntakeRuleHref: (boardId: string) => string;
  /** Settings where an issue source is connected. */
  intakeSettingsHref: () => string;
  /** The board view (search, filters, sort, layout) as URL search params. */
  searchParams: URLSearchParams;
  /** Replaces the board view's search params without adding a history entry. */
  replaceSearchParams: (params: URLSearchParams) => void;
}

const BoardNavigationContext = createContext<BoardNavigation | null>(null);

export function BoardNavigationProvider({ value, children }: { value: BoardNavigation; children: ReactNode }) {
  return <BoardNavigationContext.Provider value={value}>{children}</BoardNavigationContext.Provider>;
}

export function useBoardNavigation(): BoardNavigation {
  const navigation = useContext(BoardNavigationContext);
  if (!navigation) throw new Error('useBoardNavigation must be used inside a BoardNavigationProvider');
  return navigation;
}
