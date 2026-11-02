import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { KNOWLEDGE_READ_BODY_TOKENS, knowledgeBodySections } from '../page-body';

const memory = knowledgeMemoryScopes();

function setup() {
  const knowledge = new Knowledge({
    storage: new InMemoryStore(),
    tools: true,
    scopes: {
      ...memory,
      'docs:$orgId': { belongsTo: 'org:$orgId', access: [{ principal: 'org:$orgId', role: 'viewer' }] },
    },
  });
  const tools = knowledge.createTools();
  const call = (tool: string, input: Record<string, unknown>) => {
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, ['org:acme']);
    return tools[tool]!.execute!(input as never, { requestContext, agent: { agentId: 'a' } } as never) as Promise<any>;
  };
  return { knowledge, call };
}

/** A reference page shaped like the provider pages: intro, then many option sections, one with fenced code. */
function referenceBody(options = 60) {
  const lines = [
    'Intro paragraph about the provider.',
    '',
    '## Setup',
    '',
    'Set ANTHROPIC_API_KEY.',
    '',
    '## Options',
    '',
  ];
  for (let i = 0; i < options; i++) {
    lines.push(`### option${i}`, '', `The option${i} setting. ${'Lorem ipsum dolor sit amet. '.repeat(30)}`, '');
  }
  lines.push(
    '### contextManagement',
    '',
    '```ts',
    '# not a heading',
    'excludeTools?: string[]',
    '```',
    '',
    '## Models',
    '',
    'A table.',
  );
  return lines.join('\n');
}

describe('knowledge_read on long pages', () => {
  it('caps the body by tokens, says how much is left, and continues from bodyOffset to the end', async () => {
    const { knowledge, call } = setup();
    const body = referenceBody();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body });
    let offset = 0;
    let read = '';
    for (let turn = 0; turn < 10; turn++) {
      const result = await call('knowledge_read', { page: 'docs:acme#anthropic', bodyOffset: offset });
      expect(estimateTokenCount(result.page.body)).toBeLessThanOrEqual(KNOWLEDGE_READ_BODY_TOKENS);
      read += result.page.body;
      const cut = (result.more ?? []).find((line: string) => line.startsWith('body: truncated'));
      if (!cut) break;
      expect(cut).toMatch(/about \d+ more tokens\. Read again with bodyOffset: \d+ for the rest\./);
      offset = Number(/bodyOffset: (\d+)/.exec(cut)![1]);
    }
    expect(read).toBe(body);
  });

  it('returns a short body whole, with no more', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'short', name: 'Short', body: '# A\n\ntext' });
    const result = await call('knowledge_read', { page: 'docs:acme#short' });
    expect(result.page.body).toBe('# A\n\ntext');
    expect(result.more).toBeUndefined();
  });

  it('returns only the asked-for part of the body on part reads, without notes, children or mentions', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body: referenceBody(3) });
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic/child', name: 'Child' });
    await knowledge.addNote({ scope: 'docs:acme', path: 'anthropic', text: 'A fact' });
    for (const part of [{ outline: true }, { section: 'Setup' }, { match: 'ANTHROPIC_API_KEY' }, { bodyOffset: 10 }]) {
      const result = await call('knowledge_read', { page: 'docs:acme#anthropic', ...part });
      expect(Object.keys(result).filter(key => key !== 'more')).toEqual(['page']);
      expect(result.page.ref).toBe('docs:acme#anthropic');
    }
    const empty = await call('knowledge_read', { page: 'docs:acme#anthropic/child', outline: true });
    expect(empty.more).toEqual(['body: the page has no body.']);
  });

  it('gives an outline of headings with sizes, skipping headings inside code fences', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body: referenceBody(3) });
    const result = await call('knowledge_read', { page: 'docs:acme#anthropic', outline: true });
    expect(result.page.body).toBeUndefined();
    expect(result.page.outline.map((entry: any) => `${entry.level} ${entry.title}`)).toEqual([
      '2 Setup',
      '2 Options',
      '3 option0',
      '3 option1',
      '3 option2',
      '3 contextManagement',
      '2 Models',
    ]);
    const options = result.page.outline.find((entry: any) => entry.title === 'Options');
    const option0 = result.page.outline.find((entry: any) => entry.title === 'option0');
    expect(options.tokens).toBeGreaterThan(option0.tokens * 3);
  });

  it('reads one section with its subsections, and names the headings when the title misses', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body: referenceBody(3) });
    const result = await call('knowledge_read', { page: 'docs:acme#anthropic', section: 'contextmanagement' });
    expect(result.page.body).toBe('### contextManagement\n\n```ts\n# not a heading\nexcludeTools?: string[]\n```\n\n');
    const options = await call('knowledge_read', { page: 'docs:acme#anthropic', section: 'Options' });
    expect(options.page.body).toMatch(/^## Options/);
    expect(options.page.body).toContain('### option2');
    expect(options.page.body).not.toContain('## Models');
    await expect(call('knowledge_read', { page: 'docs:acme#anthropic', section: 'Pricing' })).rejects.toThrow(
      /no section titled "Pricing". Headings include: "Setup", "Options"/,
    );
  });

  it('gives only the matching paragraphs of a long section, with where they start in the body', async () => {
    const { knowledge, call } = setup();
    const lines = Array.from(
      { length: 400 },
      (_, i) => `**Speaker:** line ${i} of the transcript goes on for a while.`,
    );
    lines[300] = '**Shane:** Peter Steinberger steers or queues with OpenClaw.';
    const body = `# Episode\n\n## Transcript\n\n${lines.join('\n\n')}\n\n## More episodes\n\nOther shows.`;
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'podcast', name: 'Podcast', body });
    const result = await call('knowledge_read', { page: 'docs:acme#podcast', match: 'steinberger' });
    const at = body.indexOf(lines[299]!);
    expect(result.page.sections).toEqual(['Transcript']);
    expect(result.page.body).toBe(
      `## Transcript\n\n[… body character ${at} …]\n\n${lines.slice(299, 302).join('\n\n')}`,
    );
    expect(result.more).toBeUndefined();
    const from = await call('knowledge_read', { page: 'docs:acme#podcast', bodyOffset: at });
    expect(from.page.body.startsWith(lines[299]!)).toBe(true);
  });

  it('pulls only the sections that match a term, each with its heading', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body: referenceBody(3) });
    const result = await call('knowledge_read', { page: 'docs:acme#anthropic', match: 'EXCLUDETOOLS' });
    expect(result.page.sections).toEqual(['contextManagement']);
    expect(result.page.body).toMatch(/^### contextManagement/);
    const none = await call('knowledge_read', { page: 'docs:acme#anthropic', match: 'nowhere' });
    expect(none.page.sections).toEqual([]);
    expect(none.more).toEqual(['match: no section contains "nowhere".']);
    await expect(call('knowledge_read', { page: 'docs:acme#anthropic', match: 'x', outline: true })).rejects.toThrow(
      /at most one of outline, section and match/,
    );
  });

  it('says when notes, children and mentioning notes go past the limit, and how to get the rest', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'hub', name: 'Hub' });
    for (let i = 0; i < 3; i++) {
      await knowledge.upsertPage({ scope: 'docs:acme', path: `hub/child-${i}`, name: `Child ${i}` });
      await knowledge.addNote({ scope: 'docs:acme', path: 'hub', text: `Fact ${i}` });
      await knowledge.addNote({ scope: 'docs:acme', path: `hub/child-${i}`, text: `See [[docs:acme#hub]]` });
    }
    const first = await call('knowledge_read', { page: 'docs:acme#hub', limit: 2 });
    expect(first.more).toEqual([
      `notes: more than 2. Read again with cursor: "${first.nextCursor}".`,
      expect.stringMatching(/^children: more than 2\. List them with knowledge_list from: "docs:acme#hub", cursor: "/),
      `mentionedIn: more than 2. Read again with mentionedInCursor: "${first.mentionedInCursor}".`,
    ]);
    const childCursor = /cursor: "([^"]+)"/.exec(first.more[1])![1];
    expect(childCursor).toMatch(/^p/);
    const rest = await call('knowledge_list', { from: 'docs:acme#hub', cursor: childCursor });
    expect(rest.entries.map((entry: any) => entry.ref)).toEqual(['docs:acme#hub/child-2']);
    const mentions = await call('knowledge_read', {
      page: 'docs:acme#hub',
      limit: 2,
      mentionedInCursor: first.mentionedInCursor,
    });
    expect(mentions.mentionedIn).toHaveLength(1);
  });

  it('says when search hit its limit', async () => {
    const { knowledge, call } = setup();
    for (let i = 0; i < 3; i++) await knowledge.upsertPage({ scope: 'docs:acme', path: `p${i}`, name: `Widget ${i}` });
    expect((await call('knowledge_search', { query: 'widget', limit: 2 })).more[0]).toMatch(
      /showing the top 2; there may be more/,
    );
    expect((await call('knowledge_search', { query: 'widget', limit: 5 })).more).toBeUndefined();
  });
});

describe('knowledgeBodySections', () => {
  it('ends a section at the next heading at its level or above', () => {
    const body = '# A\n## B\ntext\n## C\n# D\n';
    expect(knowledgeBodySections(body).map(section => [section.title, body.slice(section.start, section.end)])).toEqual(
      [
        ['A', '# A\n## B\ntext\n## C\n'],
        ['B', '## B\ntext\n'],
        ['C', '## C\n'],
        ['D', '# D\n'],
      ],
    );
  });
});
