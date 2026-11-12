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
import { KnowledgeLinksProvider } from '@/domains/chat/knowledge/knowledge-links';
import { toolCardKind } from '@/domains/chat/tools/tool-card-kind';
import { foldsIntoGroup } from '@/domains/chat/tools/tool-groups';
import { agentGlyph } from '@/ds/components/AgentIndicator';
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

  describe('when a read page body links other pages with [[scope#path]]', () => {
    const pricing = { id: 'page-pricing', name: 'Pricing', ref: 'site:mastra#pricing', scope: 'site:mastra' };
    const read = (body: string) =>
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'site:mastra#pricing' },
        output: {
          page: { ...pricing, body },
          notes: [
            {
              id: 'n-links',
              text: 'Links:\n[[site:mastra#contact]]\n[[site:mastra#customers/salesforce]]',
              author: 'site-sync',
              mentions: {
                'site:mastra#contact': 'page-contact',
                'site:mastra#customers/salesforce': 'page-salesforce',
              },
            },
          ],
          children: [],
          mentionedIn: [],
        },
      });

    it('links each ref the result resolves to its page in the Knowledge viewer', () => {
      read('Get a demo ([[site:mastra#contact]])\n\nRead →\n\n([[site:mastra#customers/salesforce]])');
      const body = within(open()).getByTestId('knowledge-tool-body');
      expect(within(body).getByRole('link', { name: 'site:mastra#contact' }).getAttribute('href')).toBe(
        '/knowledge?page=page-contact&view=page',
      );
      expect(within(body).getByRole('link', { name: 'site:mastra#customers/salesforce' }).getAttribute('href')).toBe(
        '/knowledge?page=page-salesforce&view=page',
      );
      expect(body.textContent).not.toContain('[[');
    });

    it('shows a ref nothing in the result resolves as plain text, named like an Object member or not', () => {
      read('See [[site:mastra#careers]] and [[constructor]].');
      const body = within(open()).getByTestId('knowledge-tool-body');
      expect(
        within(body)
          .getAllByTestId('knowledge-unresolved-mention')
          .map(span => span.textContent),
      ).toEqual(['site:mastra#careers', 'constructor']);
      expect(within(body).queryByRole('link')).toBeNull();
    });

    it('leaves refs in code as they were written', () => {
      read('Write `[[site:mastra#contact]]` like this:\n\n```\n[[site:mastra#contact]]\n```');
      const body = within(open()).getByTestId('knowledge-tool-body');
      expect(within(body).queryByRole('link')).toBeNull();
      expect(body.querySelectorAll('code')[0]?.textContent).toBe('[[site:mastra#contact]]');
    });
  });

  describe('when knowledge_page writes a body that links pages', () => {
    it('links the page to itself and shows other refs as plain text', () => {
      renderCard({
        toolName: 'knowledge_page',
        input: { page: 'site:mastra#pricing', body: 'This is [[site:mastra#pricing]]; see [[site:mastra#contact]].' },
        output: { page: { id: 'page-pricing', name: 'Pricing', ref: 'site:mastra#pricing', scope: 'site:mastra' } },
      });
      const body = within(open()).getByTestId('knowledge-tool-body');
      expect(within(body).getByRole('link', { name: 'site:mastra#pricing' }).getAttribute('href')).toBe(
        '/knowledge?page=page-pricing&view=page',
      );
      expect(within(body).getByTestId('knowledge-unresolved-mention').textContent).toBe('site:mastra#contact');
    });
  });

  describe('when knowledge_read returns part of a page', () => {
    const deployer = { id: 'page-cf', name: 'CloudflareDeployer', scope: 'docs:mastra', key: 'cloudflare-deployer' };
    const at = (line: number) => ({ line });
    const row = () => within(screen.getByTestId('knowledge-tool-badge'));

    it('puts the lines in the collapsed row, so two reads of one page do not look the same', () => {
      const first = renderCard({
        toolName: 'knowledge_read',
        input: { page: 'docs:mastra#cloudflare-deployer', from: at(60) },
        output: {
          page: { ...deployer, lines: '60│a\n61│b', range: { start: at(60), end: at(95) }, lineCount: 133 },
          more: ['body: showing lines 60–95 of 133. Read on with from: {"line":96}.'],
        },
      });
      expect(row().getByText('CloudflareDeployer: lines 60–95 of 133')).toBeTruthy();
      first.unmount();
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'docs:mastra#cloudflare-deployer', from: at(120) },
        output: { page: { ...deployer, lines: '120│z', range: { start: at(120), end: at(133) }, lineCount: 133 } },
      });
      expect(row().getByText('CloudflareDeployer: lines 120–133 of 133')).toBeTruthy();
    });

    it('shows the lines it read, the range and where to read on when opened', () => {
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'docs:mastra#cloudflare-deployer', from: at(60) },
        output: {
          page: {
            ...deployer,
            lines: '60│first line\n61│second line',
            range: { start: at(60), end: at(95) },
            lineCount: 133,
          },
        },
      });
      const body = open();
      expect(within(body).getByText('Lines 60–95 of 133, continues at line 96')).toBeTruthy();
      expect(body.textContent).toContain('60│first line');
    });

    it('says nothing extra in the row for a whole page, and "Whole page" when opened', () => {
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'Refunds' },
        output: { page: { ...refunds, body: 'Short page.' } },
      });
      expect(row().getByText('Refunds')).toBeTruthy();
      expect(row().queryByText(/lines|overview|section|matches/)).toBeNull();
      expect(open().textContent).toContain('Whole page');
    });

    it('says a long first read was cut to an overview of its headings', () => {
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'docs:mastra#cloudflare-deployer' },
        output: { page: { ...deployer, lines: '1│# Cloudflare\n⋯ lines 2–40', lineCount: 400 } },
      });
      expect(row().getByText('CloudflareDeployer: overview of 400 lines')).toBeTruthy();
    });

    it('names the terms and context of a match read and the lines each match covers', () => {
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'docs:mastra#cloudflare-deployer', match: ['kv'], context: 2 },
        output: {
          page: {
            ...deployer,
            lineCount: 133,
            matches: [{ range: { start: at(10), end: at(16) }, lines: '10│kv namespace' }],
          },
        },
      });
      expect(row().getByText('CloudflareDeployer: matches "kv" ±2')).toBeTruthy();
      const body = open();
      expect(body.textContent).toContain('1 match for "kv" with 2 lines of context: lines 10–16 of 133');
      expect(body.textContent).toContain('10│kv namespace');
    });

    it('names the section a read was limited to', () => {
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'docs:mastra#cloudflare-deployer', section: 'Setup' },
        output: { page: { ...deployer, lines: '5│x', range: { start: at(5), end: at(12) }, lineCount: 133 } },
      });
      expect(row().getByText('CloudflareDeployer: section "Setup", lines 5–12 of 133')).toBeTruthy();
    });
  });

  describe('when knowledge_page writes a range of the body', () => {
    it('names the lines replaced in the row and the body', () => {
      renderCard({
        toolName: 'knowledge_page',
        input: {
          op: 'write',
          page: 'page-refunds',
          body: 'Refunds within 14 days.',
          range: { start: { line: 12 }, end: { line: 14 } },
          expectedVersion: 3,
        },
        output: { page: { ...refunds, version: 4 } },
      });
      expect(within(screen.getByTestId('knowledge-tool-badge')).getByText('Refunds: lines 12–14')).toBeTruthy();
      expect(open().textContent).toContain('Replaced lines 12–14');
    });
  });

  describe('when knowledge_list lists the scopes a run can read', () => {
    it('names each scope with its child count', () => {
      renderCard({
        toolName: 'knowledge_list',
        input: {},
        output: {
          entries: [
            {
              ref: 'site:mastra',
              name: 'site:mastra',
              description: 'Pages synced from a website',
              depth: 1,
              children: 45,
              scope: true,
            },
            { ref: 'thread:t1', name: 'thread:t1', depth: 1, children: 0, scope: true },
          ],
        },
      });
      const badge = open();
      expect(badge.textContent).toContain('Listed Knowledge scopes');
      const entries = within(badge)
        .getAllByRole('listitem')
        .map(item => item.textContent);
      expect(entries).toEqual(['site:mastra45 childrenPages synced from a website', 'thread:t1']);
    });
  });

  describe('when knowledge_list lists the tree under a page, two levels deep', () => {
    it('indents each level, shows each ref, and says when entries were left out', () => {
      renderCard({
        toolName: 'knowledge_list',
        input: { from: 'site:mastra', depth: 2 },
        output: {
          from: 'site:mastra',
          entries: [
            { ref: 'site:mastra#customers', name: 'Customers', depth: 1, children: 1 },
            { ref: 'site:mastra#customers/replit', name: 'Replit', depth: 2, children: 0 },
          ],
          nextCursor: 'p01M6',
        },
      });
      const badge = open();
      expect(badge.textContent).toContain('Listed pages');
      const [customers, replit] = within(badge).getAllByRole('listitem');
      expect(customers?.textContent).toBe('Customerssite:mastra#customers1 child');
      expect(replit?.textContent).toBe('Replitsite:mastra#customers/replit');
      expect(replit?.className).toContain('pl-4');
      expect(customers?.className).not.toContain('pl-4');
      expect(badge.textContent).toContain('More entries not shown');
    });

    it('says so when nothing is under the starting point', () => {
      renderCard({ toolName: 'knowledge_list', input: { from: 'site:mastra#contact' }, output: { entries: [] } });
      expect(open().textContent).toContain('No pages under it');
    });
  });

  describe('when knowledge_list entries are opened from the card', () => {
    const output = {
      entries: [
        { ref: 'site:mastra', name: 'site:mastra', depth: 1, children: 45, scope: true },
        { ref: 'site:mastra#topics/observability', name: 'Observability', depth: 2, children: 3 },
        { ref: 'site:mastra#topics/observability/tracing', name: 'Tracing', depth: 3, children: 0 },
      ],
    };

    it('links every entry, scope roots and nested pages, to its page and keeps the child count', () => {
      renderCard({ toolName: 'knowledge_list', input: { depth: 3 }, output });
      const badge = open();
      const href = (name: string) => within(badge).getByRole('link', { name }).getAttribute('href');
      expect(href('site:mastra')).toBe('/knowledge?page=site%3Amastra&view=page');
      expect(href('Observability')).toBe('/knowledge?page=site%3Amastra%23topics%2Fobservability&view=page');
      expect(href('Tracing')).toBe('/knowledge?page=site%3Amastra%23topics%2Fobservability%2Ftracing&view=page');
      expect(within(badge).getAllByRole('listitem')[0]?.textContent).toContain('45 children');
    });

    it('shows entries as text in a host that opens pages only by id', () => {
      render(
        <KnowledgeLinksProvider pageHref={id => `/kb/${id}`}>
          <ToolCard {...props({ toolName: 'knowledge_list', input: {}, output })} />
        </KnowledgeLinksProvider>,
        { wrapper: Providers },
      );
      const badge = open();
      expect(within(badge).queryAllByRole('link')).toEqual([]);
      expect(badge.textContent).toContain('Observability');
    });
  });

  describe('when knowledge_list returns a shape it does not know', () => {
    it('falls back to the plain tool row', () => {
      renderCard({ toolName: 'knowledge_list', input: {}, output: { scopes: [] } });
      expect(screen.queryByTestId('knowledge-tool-badge')).toBeNull();
    });
  });

  describe('when a note names a page the server did not resolve, called like an Object member', () => {
    it('shows the name as plain text with no link', () => {
      renderCard({
        toolName: 'knowledge_note',
        input: { op: 'add', page: 'Refunds' },
        output: {
          page: 'page-refunds',
          note: { id: 'n1', text: 'See [[constructor]].', author: 'agent:alex', mentions: {} },
        },
      });
      const badge = open();
      expect(within(badge).getByTestId('knowledge-unresolved-mention').textContent).toBe('constructor');
      expect(within(badge).queryByRole('link', { name: 'constructor' })).toBeNull();
    });
  });

  describe('when knowledge_page deletes a page', () => {
    it('says it deleted the page and names it without a link', () => {
      renderCard({
        toolName: 'knowledge_page',
        input: { op: 'delete', page: 'Refunds' },
        output: { page: refunds },
      });
      const badge = open();
      const DeleteIcon = agentGlyph('deleting');
      const expectedIcon = render(<DeleteIcon />)
        .container.querySelector('[data-part=body]')
        ?.getAttribute('d');
      expect(badge.querySelector('[data-part=body]')?.getAttribute('d')).toBe(expectedIcon);
      expect(badge.textContent).toContain('Deleted page');
      expect(badge.textContent).not.toContain('Updated page');
      expect(badge.textContent).toContain('Refunds');
      expect(within(badge).queryByRole('link', { name: 'Refunds' })).toBeNull();
    });
  });

  describe('when knowledge_read reads a scope with child scopes', () => {
    it('lists the child scopes by name and address', () => {
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'org:acme' },
        output: {
          page: { id: 'scope-acme', name: 'Acme', scope: 'org:acme' },
          notes: [],
          children: [],
          childScopes: [{ address: 'team:acme:support', name: 'Support' }],
        },
      });
      expect(open().textContent).toContain('Child scopes: Support (team:acme:support)');
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

    it('links each [[Page Name]] the server resolved and leaves the rest as plain text', () => {
      const text = 'Raised to $150, see [[Escalation Process]] and [[Old Runbook]].';
      renderCard({
        toolName: 'knowledge_note',
        input: { op: 'add', page: 'customer:cust-dana#profile', scope: ['customer:cust-dana'], text },
        output: {
          note: { id: 'n1', text, author: 'agent:alex', mentions: { 'Escalation Process': 'page-escalation' } },
          page: 'page-profile',
        },
      });
      const badge = open();
      expect(within(badge).getByRole('link', { name: 'Escalation Process' }).getAttribute('href')).toBe(
        '/knowledge?page=page-escalation&view=page',
      );
      expect(within(badge).queryByRole('link', { name: 'Old Runbook' })).toBeNull();
      expect(within(badge).getByTestId('knowledge-unresolved-mention').textContent).toBe('Old Runbook');
      expect(badge.textContent).toContain('Raised to $150, see Escalation Process and Old Runbook.');
    });
  });

  describe('when knowledge_read returns notes that mention pages', () => {
    it('links the mentions in its notes and in the notes that mention it', () => {
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'Refunds' },
        output: {
          page: refunds,
          notes: [
            { id: 'n1', text: 'Escalate per [[Escalation Process]]', mentions: { 'Escalation Process': 'p-esc' } },
          ],
          children: [],
          mentionedIn: [
            {
              id: 'n2',
              text: 'Start at [[Refunds]]',
              mentions: { Refunds: 'page-refunds' },
              page: { id: 'p-faq', name: 'FAQ', scope: 'org:acme' },
            },
          ],
        },
      });
      const badge = open();
      expect(within(badge).getByRole('link', { name: 'Escalation Process' }).getAttribute('href')).toBe(
        '/knowledge?page=p-esc&view=page',
      );
      expect(
        within(badge)
          .getAllByRole('link', { name: 'Refunds' })
          .map(link => link.getAttribute('href')),
      ).toContain('/knowledge?page=page-refunds&view=page');
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

  describe('when a Knowledge call is still running', () => {
    it('keeps the plain tool badge', () => {
      const fields = { toolName: 'knowledge_search', toolCallId: 'c', input: { query: 'x' }, output: undefined };
      expect(toolCardKind({ ...fields, state: 'input-available' }, {})).toBe('plain');
      renderCard({ state: 'input-available', output: undefined, input: { query: 'x' } });
      expect(screen.queryByTestId('knowledge-tool-badge')).toBeNull();
    });
  });

  describe('when a Knowledge call failed', () => {
    it('says what it could not read and shows the error when opened', () => {
      renderCard({
        toolName: 'knowledge_read',
        input: { page: 'docs:mastra#observational-memory' },
        output: undefined,
        state: 'output-error',
        errorText: 'Knowledge page "docs:mastra#observational-memory" not found.',
      });
      const badge = open();
      expect(badge.textContent).toContain("Couldn't read");
      expect(badge.textContent).toContain('docs:mastra#observational-memory');
      expect(within(badge).getByTestId('knowledge-tool-error').textContent).toContain(
        'Knowledge page "docs:mastra#observational-memory" not found.',
      );
      expect(badge.textContent).not.toContain('[object Object]');
    });

    it.each([
      ['knowledge_search', { query: 'threshold' }, "Couldn't search Knowledge", 'threshold'],
      ['knowledge_page', { page: 'docs:mastra#om' }, "Couldn't change page", 'docs:mastra#om'],
      ['knowledge_note', { page: 'docs:mastra#om' }, "Couldn't change note", 'docs:mastra#om'],
      ['knowledge_pin', { page: 'docs:mastra#om' }, "Couldn't change pin", 'docs:mastra#om'],
    ])('names the failed %s call and its error', (toolName, input, title, detail) => {
      renderCard({ toolName, input, output: undefined, state: 'output-error', errorText: 'Storage is unavailable.' });
      const badge = open();
      expect(badge.textContent).toContain(title);
      expect(badge.textContent).toContain(detail);
      expect(within(badge).getByTestId('knowledge-tool-error').textContent).toContain('Storage is unavailable.');
    });

    it('still draws the failed card when the error text is empty', () => {
      renderCard({ toolName: 'knowledge_read', input: { page: 'x' }, output: undefined, state: 'output-error' });
      expect(within(open()).getByTestId('knowledge-tool-error').textContent).toContain('The tool call failed.');
    });
  });

  describe('when a result page carries its full readable ref', () => {
    it('shows the ref instead of rebuilding it from the last key', () => {
      renderCard({
        input: { query: 'logging' },
        output: {
          results: [
            {
              type: 'page',
              page: {
                id: 'p-log',
                name: 'Logging',
                scope: 'docs:mastra',
                key: 'logging',
                ref: 'docs:mastra#observability/logging',
              },
            },
          ],
        },
      });
      const badge = open();
      expect(badge.textContent).toContain('docs:mastra#observability/logging');
      expect(badge.textContent).not.toContain('docs:mastra#logging');
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
