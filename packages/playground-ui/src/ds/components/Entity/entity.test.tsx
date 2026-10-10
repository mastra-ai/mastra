// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Entity, EntityContent, EntityName } from './Entity';

afterEach(cleanup);

describe('Entity', () => {
  describe('when a card opens a detail view', () => {
    it('opens from the keyboard', () => {
      const openDetails = vi.fn();
      render(
        <Entity onClick={openDetails}>
          <EntityName>Support agent</EntityName>
        </Entity>,
      );

      fireEvent.keyDown(screen.getByRole('button', { name: 'Support agent' }), { key: 'Enter' });

      expect(openDetails).toHaveBeenCalledOnce();
    });

    it('lets a nested action receive its own keyboard event', () => {
      const openDetails = vi.fn();
      render(
        <Entity onClick={openDetails}>
          <EntityContent>
            <EntityName>Support agent</EntityName>
          </EntityContent>
          <button type="button">Remove</button>
        </Entity>,
      );

      fireEvent.keyDown(screen.getByRole('button', { name: 'Remove' }), { key: 'Enter' });

      expect(openDetails).not.toHaveBeenCalled();
    });
  });
});
