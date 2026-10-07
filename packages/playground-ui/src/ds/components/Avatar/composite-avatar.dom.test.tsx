import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './Avatar';
import { CompositeAvatar } from './composite-avatar';

describe('CompositeAvatar', () => {
  it('preserves the names of the profile and organization images', () => {
    render(
      <CompositeAvatar title="Justin in Mastra" badge={<Avatar name="Mastra" src="/mastra.svg" size="xs" />}>
        <Avatar name="Justin Levine" src="/justin.png" size="sm" />
      </CompositeAvatar>,
    );
    expect(screen.getByRole('img', { name: 'Justin Levine' }).getAttribute('src')).toBe('/justin.png');
    expect(screen.getByRole('img', { name: 'Mastra' }).getAttribute('src')).toBe('/mastra.svg');
    expect(screen.getByTitle('Justin in Mastra')).toBeDefined();
  });

  it('keeps the organization badge when the profile image falls back', () => {
    render(
      <CompositeAvatar badge={<Avatar name="Mastra" src="/mastra.svg" size="xs" />}>
        <Avatar name="Justin Levine" src="/missing.png" />
      </CompositeAvatar>,
    );
    fireEvent.error(screen.getByRole('img', { name: 'Justin Levine' }));
    expect(screen.getByText('J')).toBeDefined();
    expect(screen.getByRole('img', { name: 'Mastra' })).toBeDefined();
  });
});
