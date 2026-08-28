// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FullThreadLink } from '../full-thread-link';
import { LinkComponentProvider } from '@/lib/framework';
import { StubLink, stubLinkPaths } from '@/test/link-provider';

afterEach(() => cleanup());

function renderLink(threadId: string, agentId = 'weather-agent', navigate = vi.fn()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LinkComponentProvider Link={StubLink} navigate={navigate} paths={stubLinkPaths}>
      {children}
    </LinkComponentProvider>
  );

  render(<FullThreadLink threadId={threadId} agentId={agentId} />, { wrapper });
  return navigate;
}

describe('FullThreadLink', () => {
  it("opens the agent's chat in enriched mode, where the whole thread is rebuilt", () => {
    const navigate = renderLink('thread-1');

    fireEvent.click(screen.getByRole('button', { name: 'See full thread' }));

    expect(navigate).toHaveBeenCalledWith('/agents/weather-agent/chat/thread-1?enriched=true');
  });

  it('encodes the thread and agent ids', () => {
    const navigate = renderLink('a b/c', 'x/y');

    fireEvent.click(screen.getByRole('button', { name: 'See full thread' }));

    expect(navigate).toHaveBeenCalledWith('/agents/x%2Fy/chat/a%20b%2Fc?enriched=true');
  });
});
