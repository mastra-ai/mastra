// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolCard } from '../tool-card';
import type { ToolCardProps } from '../tool-card';
import { ChatRunningContext } from '@/domains/chat/context/chat-context';
import { toolCardKind } from '@/domains/chat/tools/tool-card-kind';
import { foldsIntoGroup } from '@/domains/chat/tools/tool-groups';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { LinkComponentProvider } from '@/lib/framework';

afterEach(cleanup);

const Link = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(function Link(props, ref) {
  return <a ref={ref} {...props} />;
});

const Providers = ({ children }: { children: ReactNode }) => (
  <MastraReactProvider baseUrl="http://localhost:4111">
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })}>
      <MemoryRouter>
        <LinkComponentProvider Link={Link} navigate={vi.fn()} paths={{} as LinkComponentProviderProps['paths']}>
          <ChatRunningContext.Provider value={{ isRunning: false }}>{children}</ChatRunningContext.Provider>
        </LinkComponentProvider>
      </MemoryRouter>
    </QueryClientProvider>
  </MastraReactProvider>
);

const props = (over: Partial<ToolCardProps>): ToolCardProps => ({
  toolName: 'knowledge_search',
  input: {},
  output: {},
  toolCallId: 'call-1',
  state: 'output-available',
  metadata: { mode: 'stream' },
  ...over,
});

const renderCard = (over: Partial<ToolCardProps>) => render(<ToolCard {...props(over)} />, { wrapper: Providers });

/** Opens the collapsed card and returns its body. */
function open(): HTMLElement {
  const badge = screen.getByTestId('knowledge-tool-badge');
  const [toggle] = within(badge).getAllByRole('button');
  if (!toggle) throw new Error('Knowledge card has no toggle');
  fireEvent.click(toggle);
  return badge;
}

const refunds = { id: 'page-refunds', name: 'Refunds', scope: 'org:acme', key: 'policies/refunds' };

describe('Knowledge tool cards', () => {
  describe('when knowledge_search returns hits', () => {
    it('lists each hit linked to its page in the Knowledge viewer', () => {
      renderCard({
        input: { query: 'refund' },
        output: {
          results: [
            { type: 'page', page: refunds },
            {
              type: 'note',
              page: { id: 'page-billing', name: 'Billing', scope: 'org:acme' },
              note: { id: 'n1', text: 'Refund disputes go through Refunds', author: 'agent:alex' },
            },
          ],
        },
      });
      const badge = open();
      expect(badge.textContent).toContain('Searched Knowledge');
      expect(badge.textContent).toContain('refund');
      expect(within(badge).getByRole('link', { name: 'Refunds' }).getAttribute('href')).toBe(
        '/knowledge?page=page-refunds&view=page',
      );
      expect(badge.textContent).toContain('org:acme#policies/refunds');
      expect(badge.textContent).toContain('Refund disputes go through Refunds');
    });
  });

  describe('when knowledge_read returns a page', () => {
    it('shows its markdown body without running markup the agent wrote', () => {
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'Refunds' },
        output: {
          page: {
            ...refunds,
            version: 3,
            body: '## Window\n\nRefunds within **30 days**. <script>window.hacked = 1</script>',
          },
          notes: [{ id: 'n1', text: 'Managers approve over $100', author: 'agent:alex' }],
          children: [{ id: 'page-eu', name: 'EU refunds', scope: 'org:acme' }],
          mentionedIn: [],
        },
      });
      const badge = open();
      const body = within(badge).getByTestId('knowledge-tool-body');
      expect(within(body).getByRole('heading', { name: 'Window' })).toBeTruthy();
      expect(body.querySelector('script')).toBeNull();
      expect(badge.textContent).toContain('Managers approve over $100');
      expect(badge.textContent).toContain('Child pages: EU refunds');
    });
  });

  describe('when knowledge_page writes', () => {
    it('says it updated an existing page and shows the new body and version', () => {
      renderCard({
        toolName: 'knowledge_page',
        input: { op: 'write', page: 'page-refunds', body: 'Refunds within 14 days.' },
        output: { page: { ...refunds, version: 4 } },
      });
      const badge = open();
      expect(badge.textContent).toContain('Updated page');
      expect(badge.textContent).toContain('Version 4');
      expect(within(badge).getByTestId('knowledge-tool-body').textContent).toContain('Refunds within 14 days.');
    });

    it('says it created a page when the call named no page', () => {
      renderCard({
        toolName: 'knowledge_page',
        input: { op: 'write', scope: 'org:acme', name: 'Refunds' },
        output: { page: { ...refunds, version: 1 } },
      });
      expect(screen.getByTestId('knowledge-tool-badge').textContent).toContain('Created page');
    });
  });

  describe('when knowledge_note adds a note', () => {
    it('shows the note and links the page it went on', () => {
      renderCard({
        toolName: 'knowledge_note',
        input: { op: 'add', page: 'Refunds', scope: ['org:acme'], text: 'Managers approve over $100' },
        output: { note: { id: 'n1', text: 'Managers approve over $100', author: 'agent:alex' }, page: 'page-refunds' },
      });
      const badge = open();
      expect(badge.textContent).toContain('Added note');
      expect(within(badge).getByRole('link', { name: 'Refunds' }).getAttribute('href')).toBe(
        '/knowledge?page=page-refunds&view=page',
      );
    });
  });

  describe('when knowledge_pin pins a page', () => {
    it('names the audience', () => {
      renderCard({
        toolName: 'knowledge_pin',
        input: { op: 'pin', page: 'Refunds', audience: ['team:acme:support'] },
        output: { page: 'page-refunds', audience: ['team:acme:support'] },
      });
      const badge = open();
      expect(badge.textContent).toContain('Pinned page');
      expect(badge.textContent).toContain('Pinned for team:acme:support');
    });
  });

  describe('when a Knowledge call is still running or failed', () => {
    it('keeps the plain tool badge', () => {
      const fields = { toolName: 'knowledge_search', toolCallId: 'c', input: { query: 'x' }, output: undefined };
      expect(toolCardKind({ ...fields, state: 'input-available' }, {})).toBe('plain');
      expect(toolCardKind({ ...fields, state: 'output-error', output: 'boom' }, {})).toBe('plain');
      renderCard({ state: 'input-available', output: undefined, input: { query: 'x' } });
      expect(screen.queryByTestId('knowledge-tool-badge')).toBeNull();
    });
  });

  describe('when several Knowledge calls run in a row', () => {
    it('folds them like other plain calls', () => {
      const part = {
        type: 'tool-knowledge_search',
        toolCallId: 'c',
        state: 'output-available',
        input: { query: 'x' },
        output: { results: [] },
      } as never;
      expect(foldsIntoGroup(part, {})).toBe(true);
    });
  });
});
