import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './Avatar';
import { CompositeAvatar } from './composite-avatar';

describe('CompositeAvatar', () => {
  describe('when both images load', () => {
    it('keeps the names of the profile and organization images', () => {
      render(
        <CompositeAvatar title="Justin in Mastra" badge={<Avatar name="Mastra" src="/mastra.svg" size="xs" />}>
          <Avatar name="Justin Levine" src="/justin.png" size="md" />
        </CompositeAvatar>,
      );
      expect(screen.getByRole('img', { name: 'Justin Levine' }).getAttribute('src')).toBe('/justin.png');
      expect(screen.getByRole('img', { name: 'Mastra' }).getAttribute('src')).toBe('/mastra.svg');
      expect(screen.getByTitle('Justin in Mastra')).toBeDefined();
    });
  });

  describe('when the profile image fails', () => {
    it('shows the initial and keeps the organization badge', () => {
      render(
        <CompositeAvatar badge={<Avatar name="Mastra" src="/mastra.svg" size="xs" />}>
          <Avatar name="Justin Levine" src="/missing.png" size="md" />
        </CompositeAvatar>,
      );
      fireEvent.error(screen.getByRole('img', { name: 'Justin Levine' }));
      expect(screen.getByText('J')).toBeDefined();
      expect(screen.getByRole('img', { name: 'Mastra' })).toBeDefined();
    });
  });
});
