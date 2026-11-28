// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolRow } from './tool-row';

afterEach(cleanup);

describe('ToolRow', () => {
  it('offers Connect instead of the switch until the tool has an account', () => {
    const onConnect = vi.fn();
    render(<ToolRow logo={<span />} name="Linear" enabled onEnabledChange={vi.fn()} onConnect={onConnect} />);

    expect(screen.queryByRole('switch')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Linear' }));
    expect(onConnect).toHaveBeenCalled();
  });

  it('shows the switch once connected', () => {
    render(<ToolRow logo={<span />} name="GitHub" enabled onEnabledChange={vi.fn()} />);

    expect(screen.getByRole('switch', { name: 'GitHub' })).toBeTruthy();
  });
});
