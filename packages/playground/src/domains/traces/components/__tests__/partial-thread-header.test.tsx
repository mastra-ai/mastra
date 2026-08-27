// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PartialThreadHeader } from '../partial-thread-header';
import { LinkComponentProvider } from '@/lib/framework';
import { StubLink, stubLinkPaths } from '@/test/link-provider';

afterEach(() => cleanup());

function renderHeader(threadId: string, navigate = vi.fn()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LinkComponentProvider Link={StubLink} navigate={navigate} paths={stubLinkPaths}>
      {children}
    </LinkComponentProvider>
  );

  render(<PartialThreadHeader threadId={threadId} />, { wrapper });
  return navigate;
}

describe('PartialThreadHeader', () => {
  it('labels the pane as a partial thread', () => {
    renderHeader('thread-1');

    expect(screen.getByRole('heading').textContent).toBe('Partial thread');
  });

  it('navigates to the full thread investigation page', () => {
    const navigate = renderHeader('thread-1');

    fireEvent.click(screen.getByRole('button', { name: 'See full thread' }));

    expect(navigate).toHaveBeenCalledWith('/traces/investigate?threadId=thread-1');
  });

  it('encodes the thread id', () => {
    const navigate = renderHeader('a b/c');

    fireEvent.click(screen.getByRole('button', { name: 'See full thread' }));

    expect(navigate).toHaveBeenCalledWith('/traces/investigate?threadId=a+b%2Fc');
  });
});
