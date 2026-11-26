// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BoardCard } from './board-card';
import type { DragPayload } from './board-drag';

afterEach(cleanup);

const payload: DragPayload = { kind: 'work-item', id: 'login', fromStage: 'triage', ownerKind: 'free' };

describe('BoardCard', () => {
  it('can be picked up and moved to another stage', () => {
    render(
      <BoardCard title="Fix login" href="/cards/login" dragPayload={payload}>
        Fix login
      </BoardCard>,
    );

    expect(screen.getByRole('article', { name: 'Fix login' }).getAttribute('draggable')).toBe('true');
  });

  it('can’t be picked up while the signed-in user’s own move of it is in flight', () => {
    render(
      <BoardCard title="Fix login" href="/cards/login" dragPayload={payload} locked>
        Fix login
      </BoardCard>,
    );

    expect(screen.getByRole('article', { name: 'Fix login' }).getAttribute('draggable')).toBe('false');
  });
});
