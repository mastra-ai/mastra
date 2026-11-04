// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Avatar } from '../Avatar/Avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../Tooltip/tooltip';
import { ProductAvatar } from './ProductAvatar';

afterEach(cleanup);

describe('ProductAvatar', () => {
  it('keeps its compact size outside a group', () => {
    render(<ProductAvatar product="studio" />);
    const avatar = screen.getByRole('img', { name: 'Studio' });
    expect(avatar.classList.contains('size-5')).toBe(true);
    expect(avatar.hasAttribute('data-size')).toBe(false);
  });

  it('takes an explicit size', () => {
    render(<ProductAvatar product="server" size="lg" />);
    const avatar = screen.getByRole('img', { name: 'Server' });
    expect(avatar.getAttribute('data-size')).toBe('lg');
    expect(avatar.classList.contains('size-avatar-lg')).toBe(true);
  });

  it('joins a group, taking its size and ring slot', () => {
    render(
      <Avatar.Group size="md" aria-label="Products">
        <Avatar name="Abhi" />
        <ProductAvatar product="studio" />
        <ProductAvatar product="observability" size="lg" />
        <Avatar.GroupCount>+3</Avatar.GroupCount>
      </Avatar.Group>,
    );
    const group = screen.getByLabelText('Products');
    const sizes = Array.from(group.querySelectorAll('[data-slot=avatar]'), avatar => avatar.getAttribute('data-size'));
    expect(sizes).toEqual(['md', 'md', 'lg']);
    expect(screen.getByRole('img', { name: 'Studio' }).classList.contains('size-avatar-md')).toBe(true);
  });

  it('fits a text row at the inline size', () => {
    render(
      <Avatar.Group size="inline" aria-label="Products">
        <ProductAvatar product="server" />
        <ProductAvatar product="studio" />
      </Avatar.Group>,
    );
    const group = screen.getByLabelText('Products');
    const sizes = Array.from(group.querySelectorAll('[data-slot=avatar]'), avatar => avatar.getAttribute('data-size'));
    expect(sizes).toEqual(['inline', 'inline']);
    expect(screen.getByRole('img', { name: 'Studio' }).classList.contains('size-icon-md')).toBe(true);
  });

  it('opens a tooltip on hover inside a group', async () => {
    render(
      <TooltipProvider delay={0}>
        <Avatar.Group size="md">
          <Tooltip>
            <TooltipTrigger render={<ProductAvatar product="studio" />} />
            <TooltipContent>Studio project</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<ProductAvatar product="observability" />} />
            <TooltipContent>Observability project</TooltipContent>
          </Tooltip>
        </Avatar.Group>
      </TooltipProvider>,
    );
    const avatar = screen.getByRole('img', { name: 'Observability' });
    expect(avatar.getAttribute('data-size')).toBe('md');
    fireEvent.pointerEnter(avatar);
    fireEvent.mouseEnter(avatar);
    fireEvent.mouseMove(avatar);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Observability project');
  });
});
