// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BoardEmptyStateActions } from './board-empty-state-actions';
import type { BoardNavigation } from './board-navigation';
import { BoardNavigationProvider } from './board-navigation-provider';
import { ConfigureBoardButton } from './configure-board-button';

afterEach(cleanup);

const navigation: BoardNavigation = {
  LinkComponent: 'a',
  navigate: () => {},
  cardHref: cardId => `/cards/${cardId}`,
  sessionHref: session => `/threads/${session.threadId}`,
  boardHref: boardId => `/boards/${boardId}`,
  boardCardHref: (boardId, cardId) => `/boards/${boardId}?item=${cardId}`,
  boardConfigHref: (boardId, phaseId) => `/boards/${boardId}/config${phaseId ? `/${phaseId}` : ''}`,
  newIntakeRuleHref: boardId => `/boards/${boardId}/config?rule=new`,
  intakeSettingsHref: () => '/settings/intake',
  searchParams: new URLSearchParams(),
  replaceSearchParams: () => {},
};

describe('board navigation', () => {
  describe('when the host supplies its links', () => {
    it('sends the empty board to the host’s intake settings or new intake rule', () => {
      const { rerender } = render(
        <BoardNavigationProvider value={navigation}>
          <BoardEmptyStateActions boardId="work" intakeSetup="source" />
        </BoardNavigationProvider>,
      );
      expect(screen.getByRole('link', { name: 'Connect issue source' }).getAttribute('href')).toBe('/settings/intake');

      rerender(
        <BoardNavigationProvider value={navigation}>
          <BoardEmptyStateActions boardId="work" intakeSetup="route" />
        </BoardNavigationProvider>,
      );
      expect(screen.getByRole('link', { name: 'Add intake rule' }).getAttribute('href')).toBe(
        '/boards/work/config?rule=new',
      );
    });

    it('opens the board’s configuration through the host', () => {
      render(
        <BoardNavigationProvider value={navigation}>
          <ConfigureBoardButton boardId="work" />
        </BoardNavigationProvider>,
      );
      expect(screen.getByRole('link', { name: 'Configure board' }).getAttribute('href')).toBe('/boards/work/config');
    });
  });

  describe('when no host supplies links', () => {
    it('says so instead of rendering dead links', () => {
      expect(() => render(<ConfigureBoardButton boardId="work" />)).toThrow(/BoardNavigationProvider/);
    });
  });
});
