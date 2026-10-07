import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AvatarRail } from './index';

describe('AvatarRail', () => {
  it('marks the current organization and activates a different organization', async () => {
    const select = vi.fn();
    const user = userEvent.setup();
    render(
      <AvatarRail aria-label="Organizations">
        <AvatarRail.Item aria-label="Mastra" current>
          M
        </AvatarRail.Item>
        <AvatarRail.Item aria-label="Acme" onClick={select}>
          A
        </AvatarRail.Item>
      </AvatarRail>,
    );
    expect(screen.getByRole('toolbar', { name: 'Organizations' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mastra' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'Acme' }).hasAttribute('aria-current')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Acme' }));
    expect(select).toHaveBeenCalledOnce();
  });

  it('roves focus without switching organization and skips disabled controls', async () => {
    const select = vi.fn();
    const user = userEvent.setup();
    render(
      <AvatarRail aria-label="Organizations">
        <AvatarRail.Item aria-label="Mastra" current onClick={select}>
          M
        </AvatarRail.Item>
        <AvatarRail.Item aria-label="Unavailable" disabled>
          U
        </AvatarRail.Item>
        <AvatarRail.Item aria-label="Acme" onClick={select}>
          A
        </AvatarRail.Item>
        <AvatarRail.Item aria-label="Create an organization" onClick={select}>
          +
        </AvatarRail.Item>
      </AvatarRail>,
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mastra' }));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Acme' }));
    expect(select).not.toHaveBeenCalled();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create an organization' }));
    expect(select).toHaveBeenCalledOnce();
    await user.keyboard('{ArrowDown}{ArrowUp}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Create an organization' }));
  });
});
