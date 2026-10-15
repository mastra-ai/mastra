// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Avatar } from './Avatar';

afterEach(cleanup);

describe('Avatar', () => {
  describe('with a name', () => {
    it('shows the image named after the person', () => {
      render(<Avatar name="Justin Levine" src="/justin.png" />);
      expect(screen.getByRole('img', { name: 'Justin Levine' }).getAttribute('src')).toBe('/justin.png');
    });

    it('shows the initial when the image fails', () => {
      render(<Avatar name="justin" src="/missing.png" />);
      fireEvent.error(screen.getByRole('img', { name: 'justin' }));
      expect(screen.getByText('J')).toBeDefined();
    });

    it('shows a new image after the previous one failed', () => {
      const { rerender } = render(<Avatar name="justin" src="/missing.png" />);
      fireEvent.error(screen.getByRole('img', { name: 'justin' }));
      rerender(<Avatar name="justin" src="/justin.png" />);
      expect(screen.getByRole('img', { name: 'justin' }).getAttribute('src')).toBe('/justin.png');
    });
  });

  describe('composed from parts', () => {
    it('shows the fallback until the image loads', () => {
      render(
        <Avatar>
          <Avatar.Image src="/justin.png" alt="Justin Levine" />
          <Avatar.Fallback>JL</Avatar.Fallback>
        </Avatar>,
      );
      expect(screen.getByText('JL')).toBeDefined();
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('keeps the name of an organization avatar inside the badge', () => {
      render(
        <Avatar size="md">
          <Avatar.Fallback>JL</Avatar.Fallback>
          <Avatar.Badge>
            <Avatar name="Acme" src="/acme.svg" />
          </Avatar.Badge>
        </Avatar>,
      );
      const logo = screen.getByRole('img', { name: 'Acme' });
      expect(logo.closest('[data-slot=avatar]')?.getAttribute('data-size')).toBe('xs');
      expect(screen.getByText('JL')).toBeDefined();
    });
  });

  describe('in a group', () => {
    it('sizes every avatar and the count from the group', () => {
      render(
        <Avatar.Group size="lg" aria-label="Reviewers">
          <Avatar>
            <Avatar.Fallback>JL</Avatar.Fallback>
          </Avatar>
          <Avatar name="Abhi" />
          <Avatar.GroupCount>+3</Avatar.GroupCount>
        </Avatar.Group>,
      );
      const group = screen.getByLabelText('Reviewers');
      const sizes = Array.from(group.querySelectorAll('[data-slot=avatar]'), avatar =>
        avatar.getAttribute('data-size'),
      );
      expect(sizes).toEqual(['lg', 'lg']);
      expect(screen.getByText('+3').getAttribute('data-size')).toBe('lg');
    });

    it('stacks the first avatar on top and scales the overlap with the size', () => {
      render(
        <Avatar.Group size="lg" aria-label="Reviewers">
          <Avatar name="Abhi" />
          <Avatar name="Jane" />
          <Avatar.GroupCount>+3</Avatar.GroupCount>
        </Avatar.Group>,
      );
      const group = screen.getByLabelText('Reviewers');
      const items = Array.from(group.querySelectorAll<HTMLElement>('[data-slot=avatar-group-item]'));
      expect(items.map(item => item.style.zIndex)).toEqual(['3', '2', '1']);
      expect(group.classList.contains('[--avatar-group-size:var(--spacing-avatar-lg)]')).toBe(true);
    });
  });
});
