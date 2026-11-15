import { estimateTokenCount } from 'tokenx';
import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';
import { KNOWLEDGE_READ_BODY_TOKENS, KNOWLEDGE_READ_REST_OUTLINE_TOKENS, knowledgeBodySections } from '../page-body';

const memory = knowledgeMemoryScopes();

function setup(maxTokens?: number) {
  const knowledge = new Knowledge({
    storage: new InMemoryStore(),
    tools: maxTokens === undefined ? true : { read: { maxTokens }, write: true },
    scopes: {
      ...memory,
      'docs:$orgId': { belongsTo: 'org:$orgId', access: [{ principal: 'org:$orgId', role: 'editor' }] },
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

/** The numbered lines a read returns, as `[line, text]`. */
function numbered(lines: string): Array<[number, string]> {
  return lines.split('\n').map(line => {
    const at = line.indexOf('│');
    return [Number(line.slice(0, at)), line.slice(at + 1)];
  });
}

/** Reads a page from the top by following `more`, and puts its body back together. */
async function readAll(call: (tool: string, input: Record<string, unknown>) => Promise<any>, page: string) {
  const text = new Map<number, string>();
  // From line 1: a first read without `from` shows a long page's headings, not its top lines.
  let from: unknown = { line: 1 };
  for (let turn = 0; turn < 500; turn++) {
    const result = await call('knowledge_read', { page, from });
    if (result.page.body !== undefined) return result.page.body as string;
    for (const [line, part] of numbered(result.page.lines)) text.set(line, (text.get(line) ?? '') + part);
    const more = (result.more ?? []).find((line: string) => line.startsWith('body:'));
    if (!more) break;
    from = JSON.parse(/from: (\{.*\})\.$/.exec(more)![1]!);
  }
  return [...text.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, line]) => line)
    .join('\n');
}

describe('writing back a long page read in part', () => {
  it('refuses a body written back without a range, and leaves the page as it was', async () => {
    const { knowledge, call } = setup();
    const body = referenceBody();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body });
    const read = await call('knowledge_read', { page: 'docs:acme#anthropic', from: { line: 1 } });
    expect(read.page.body).toBeUndefined();
    const shown = numbered(read.page.lines)
      .map(([, text]) => text)
      .join('\n');
    await expect(
      call('knowledge_page', {
        op: 'write',
        page: 'docs:acme#anthropic',
        body: shown + '\n\nOne more line.',
        expectedVersion: read.page.version,
      }),
    ).rejects.toThrow(/more than one knowledge_read returns.*with the range that read returned/s);
    expect(await readAll(call, 'docs:acme#anthropic')).toBe(body);
  });

  it('refuses a range even one line wider than the read it claims to come from', async () => {
    const { knowledge, call } = setup();
    const body = referenceBody();
    const lineCount = body.split('\n').length;
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body });
    const read = await call('knowledge_read', { page: 'docs:acme#anthropic', from: { line: 1 } });
    expect(read.page.range).toEqual({ start: { line: 1 }, end: { line: expect.any(Number) } });
    expect(read.page.lineCount).toBe(lineCount);
    const last = read.page.range.end.line;
    const second = await call('knowledge_read', { page: 'docs:acme#anthropic', from: { line: last + 1 } });
    const shifted = await call('knowledge_read', { page: 'docs:acme#anthropic', from: { line: 3 } });
    for (const range of [
      { start: { line: 1 }, end: { line: last + 1 } },
      { start: { line: 1 }, end: { line: last + 1, col: 0 } },
      { start: { line: 3 }, end: { line: shifted.page.range.end.line + 1 } },
      { start: { line: 1 }, end: { line: lineCount } },
      { start: { line: 1 }, end: second.page.range.end },
    ]) {
      await expect(
        call('knowledge_page', {
          op: 'write',
          page: 'docs:acme#anthropic',
          body: 'x',
          range,
          expectedVersion: read.page.version,
        }),
      ).rejects.toThrow(/run past what one knowledge_read from line \d+ shows/);
    }
    expect(await readAll(call, 'docs:acme#anthropic')).toBe(body);
  });

  it('writes back the last part of a long body that ends in a newline, with the range its read returned', async () => {
    const { knowledge, call } = setup();
    const body = `${referenceBody()}\n`;
    const { page } = await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body });
    const last = body.split('\n').length - 1;

    const tail = await call('knowledge_read', { page: 'docs:acme#anthropic', from: { line: last - 2 } });
    expect(tail.page.range.end).toEqual({ line: last });
    await call('knowledge_page', {
      op: 'write',
      page: 'docs:acme#anthropic',
      body: numbered(tail.page.lines)
        .map(([, text]) => text.replace('A table.', 'A bigger table.'))
        .join('\n'),
      range: tail.page.range,
      expectedVersion: tail.page.version,
    });

    expect(await readAll(call, 'docs:acme#anthropic')).toBe(body.replace('A table.', 'A bigger table.').slice(0, -1));
    // Line reads drop the final newline; the stored body keeps it.
    const stored = await (await knowledge.getStorage()).getPage({ id: page.id, read: 'all' });
    expect(stored?.body).toBe(body.replace('A table.', 'A bigger table.'));
  });

  it('writes just the lines a read returned, from a later read and from a section', async () => {
    const { knowledge, call } = setup();
    const body = referenceBody();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body });
    const lines = body.split('\n');
    const at = lines.findIndex(line => line.startsWith('The option30 setting')) + 1;

    const window = await call('knowledge_read', { page: 'docs:acme#anthropic', from: { line: at - 2 } });
    expect(window.page.range.start).toEqual({ line: at - 2 });
    const edited = numbered(window.page.lines)
      .map(([, text]) => text.replace('option30 setting', 'option30 SETTING'))
      .join('\n');
    const written = await call('knowledge_page', {
      op: 'write',
      page: 'docs:acme#anthropic',
      body: edited,
      range: window.page.range,
      expectedVersion: window.page.version,
    });

    const section = await call('knowledge_read', { page: 'docs:acme#anthropic', section: 'Setup' });
    expect(section.page.range).toEqual({ start: { line: 3 }, end: { line: 6 } });
    expect(section.page.lines).toBe('3│## Setup\n4│\n5│Set ANTHROPIC_API_KEY.\n6│');
    // A smaller range inside the one read: just line 5.
    await call('knowledge_page', {
      op: 'write',
      page: 'docs:acme#anthropic',
      body: 'Set ANTHROPIC_API_KEY, or pass apiKey.',
      range: { start: { line: 5 }, end: { line: 5 } },
      expectedVersion: written.page.version,
    });

    expect(await readAll(call, 'docs:acme#anthropic')).toBe(
      body
        .replace('option30 setting', 'option30 SETTING')
        .replace('Set ANTHROPIC_API_KEY.', 'Set ANTHROPIC_API_KEY, or pass apiKey.'),
    );
  });

  it('removes whole lines when the body written over them is empty', async () => {
    const { knowledge, call } = setup();
    const body = referenceBody();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body });
    const read = await call('knowledge_read', { page: 'docs:acme#anthropic', section: 'Setup' });
    await call('knowledge_page', {
      op: 'write',
      page: 'docs:acme#anthropic',
      body: '',
      range: read.page.range,
      expectedVersion: read.page.version,
    });
    expect(await readAll(call, 'docs:acme#anthropic')).toBe(body.replace('## Setup\n\nSet ANTHROPIC_API_KEY.\n\n', ''));
  });

  it('refuses a body that still carries the line numbers', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body: referenceBody() });
    const read = await call('knowledge_read', { page: 'docs:acme#anthropic', section: 'Setup' });
    await expect(
      call('knowledge_page', {
        op: 'write',
        page: 'docs:acme#anthropic',
        body: read.page.lines,
        range: read.page.range,
        expectedVersion: read.page.version,
      }),
    ).rejects.toThrow(/still has the line numbers/);
  });

  it('a range write needs the version it was read at, and a range inside the body', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body: referenceBody() });
    const read = await call('knowledge_read', { page: 'docs:acme#anthropic', from: { line: 1 } });
    await expect(
      call('knowledge_page', { op: 'write', page: 'docs:acme#anthropic', body: 'x', range: read.page.range }),
    ).rejects.toThrow(/expectedVersion/);
    for (const range of [
      { start: { line: 1 }, end: { line: 100_000 } },
      { start: { line: 1 }, end: { line: 1, col: 10_000 } },
    ]) {
      await expect(
        call('knowledge_page', {
          op: 'write',
          page: 'docs:acme#anthropic',
          body: 'x',
          range,
          expectedVersion: read.page.version,
        }),
      ).rejects.toThrow(/outside (the body|line 1)/);
    }
  });

  it('still writes a short page whole without a range', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'short', name: 'Short', body: 'Old body.' });
    const read = await call('knowledge_read', { page: 'docs:acme#short' });
    expect(read.page.body).toBe('Old body.');
    expect(read.page.range).toBeUndefined();
    const written = await call('knowledge_page', { op: 'write', page: 'docs:acme#short', body: 'New body.' });
    expect(written.page.version).toBe(read.page.version + 1);
  });
});

describe('knowledge_read on long pages', () => {
  it('reads whole lines up to the token cap, says where to read on, and gets back the whole body', async () => {
    const { knowledge, call } = setup();
    const body = referenceBody();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body });
    let from: unknown = { line: 1 };
    let reads = 0;
    for (;;) {
      const result = await call('knowledge_read', { page: 'docs:acme#anthropic', from });
      reads++;
      const text = numbered(result.page.lines)
        .map(([, line]) => line)
        .join('\n');
      expect(estimateTokenCount(text)).toBeLessThanOrEqual(KNOWLEDGE_READ_BODY_TOKENS);
      const more = (result.more ?? []).find((line: string) => line.startsWith('body:'));
      if (!more) break;
      expect(more).toMatch(
        /^body: showing lines \d+–\d+ of \d+\. (Read on with|`outline` lists the .*headings below( \(all of them with outline: true\))?; read the one you need with section, or read on with) from: \{"line":\d+\}\.$/,
      );
      from = JSON.parse(/from: (\{.*\})\.$/.exec(more)![1]!);
    }
    expect(reads).toBeGreaterThan(5);
    expect(await readAll(call, 'docs:acme#anthropic')).toBe(body);
  });

  it('shows a long page as its headings with the first lines under each, so one section read gets a fact far down', async () => {
    const { knowledge, call } = setup();
    // Shaped like the models page: the answer sits in a short section far past the first window.
    const body = `${referenceBody(12)}\n\n### Select the OpenAI Responses API\n\nCustom \`url\` endpoints use Chat Completions by default; set \`api: "responses"\`.\n\n## Use AI SDK with Mastra\n\nMore text.`;
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'models', name: 'Models', body });
    const first = await call('knowledge_read', { page: 'docs:acme#models' });
    const shown = new Map(
      numbered(
        first.page.lines
          .replace(/^\s*⋯ lines \d+–\d+$/gm, '')
          .replace(/\n+/g, '\n')
          .trim(),
      ),
    );
    const all = body.split('\n');
    // Every heading is there with its line number, and each shown line is the body's line.
    all.forEach((text, i) => {
      if (/^#{1,6} /.test(text)) expect(shown.get(i + 1)).toBe(text);
    });
    for (const [line, text] of shown) expect(all[line - 1]!.startsWith(text.replace(/…$/, ''))).toBe(true);
    expect(first.page.lines).toMatch(/…$/m);
    expect(first.page.lines).toContain('Custom `url` endpoints use Chat Completions by default');
    expect(first.page.range).toBeUndefined();
    expect(first.page.outline).toBeUndefined();
    expect(estimateTokenCount(first.page.lines)).toBeLessThanOrEqual(KNOWLEDGE_READ_BODY_TOKENS);
    expect(first.more[0]).toMatch(/shows every heading and the first lines under it/);
    const section = await call('knowledge_read', {
      page: 'docs:acme#models',
      section: 'Select the OpenAI Responses API',
    });
    expect(section.page.lines).toContain('api: "responses"');
    expect(section.more).toBeUndefined();
    // Reads that already aim somewhere get plain lines.
    const later = await call('knowledge_read', { page: 'docs:acme#models', from: { line: 20 } });
    expect(later.page.range.start).toEqual({ line: 20 });
    // A page with more headings than fit falls back to its top lines and the headings below them.
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'big', name: 'Big', body: referenceBody(400) });
    const big = await call('knowledge_read', { page: 'docs:acme#big' });
    expect(big.page.range.start).toEqual({ line: 1 });
    // Fewer headings than fit, but long sections: the lines under each are left out and marked.
    await knowledge.upsertPage({
      scope: 'docs:acme',
      path: 'long',
      name: 'Long',
      body: Array.from(
        { length: 6 },
        (_, i) => `## Part ${i}\n\n${Array.from({ length: 40 }, (_, j) => `Line ${j} of part ${i}.`).join('\n')}`,
      ).join('\n\n'),
    });
    const long = await call('knowledge_read', { page: 'docs:acme#long' });
    expect(long.page.lines).toMatch(/^\s*⋯ lines \d+–\d+$/m);
    expect(long.page.lines.match(/│## Part \d/g)).toHaveLength(6);
    expect(estimateTokenCount(JSON.stringify(big.page.outline))).toBeLessThanOrEqual(
      KNOWLEDGE_READ_REST_OUTLINE_TOKENS,
    );
    expect(big.more[0]).toMatch(/lists the first \d+ of \d+ headings below \(all of them with outline: true\)/);
  });

  it('returns a short body whole, with no more', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'short', name: 'Short', body: '# A\n\ntext' });
    const result = await call('knowledge_read', { page: 'docs:acme#short' });
    expect(result.page.body).toBe('# A\n\ntext');
    expect(result.page.lines).toBeUndefined();
    expect(result.more).toBeUndefined();
  });

  it('cuts a line too long for one read by column, and a range write on it changes only that part', async () => {
    const { knowledge, call } = setup();
    const row = `| ${Array.from({ length: 3000 }, (_, i) => `cell${i}`).join(' | ')} |`;
    const body = `# Table\n\n${row}\n\nAfter.`;
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'table', name: 'Table', body });
    const first = await call('knowledge_read', { page: 'docs:acme#table', from: { line: 1 } });
    expect(first.page.range).toEqual({ start: { line: 1 }, end: { line: 2 } });
    const second = await call('knowledge_read', { page: 'docs:acme#table', from: { line: 3 } });
    expect(second.page.range.start).toEqual({ line: 3 });
    expect(second.page.range.end).toEqual({ line: 3, col: expect.any(Number) });
    expect(second.more[0]).toMatch(/Read on with from: \{"line":3,"col":\d+\}\./);
    expect(await readAll(call, 'docs:acme#table')).toBe(body);

    // Context lines around a long line come as their own parts; the long line only around the match.
    const around = await call('knowledge_read', { page: 'docs:acme#table', match: 'cell1500 ' });
    expect(around.page.matches.map((m: any) => m.range.start.line)).toEqual([1, 3, 4]);
    const hit = await call('knowledge_read', { page: 'docs:acme#table', match: 'cell1500 ', context: 0 });
    expect(hit.page.matches).toHaveLength(1);
    const [match] = hit.page.matches;
    expect(match.range.start.line).toBe(3);
    expect(match.range.end.line).toBe(3);
    const [[, shown]] = numbered(match.lines);
    expect(shown.length).toBeLessThanOrEqual(410);
    expect(shown).toContain('cell1500 ');
    await call('knowledge_page', {
      op: 'write',
      page: 'docs:acme#table',
      body: shown.replace('cell1500 ', 'CELL1500 '),
      range: match.range,
      expectedVersion: hit.page.version,
    });
    expect(await readAll(call, 'docs:acme#table')).toBe(body.replace('cell1500 ', 'CELL1500 '));
  });

  it('returns only the asked-for part of the body on part reads, without notes, children or mentions', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body: referenceBody(3) });
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic/child', name: 'Child' });
    await knowledge.addNote({ scope: 'docs:acme', path: 'anthropic', text: 'A fact' });
    for (const part of [
      { outline: true },
      { section: 'Setup' },
      { match: 'ANTHROPIC_API_KEY' },
      { from: { line: 3 } },
    ]) {
      const result = await call('knowledge_read', { page: 'docs:acme#anthropic', ...part });
      expect(Object.keys(result).filter(key => key !== 'more')).toEqual(['page']);
      expect(result.page.ref).toBe('docs:acme#anthropic');
    }
    const empty = await call('knowledge_read', { page: 'docs:acme#anthropic/child', outline: true });
    expect(empty.more).toEqual(['body: the page has no body.']);
  });

  it('gives an outline of headings with their lines and sizes, skipping headings inside code fences', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body: referenceBody(3) });
    const result = await call('knowledge_read', { page: 'docs:acme#anthropic', outline: true });
    expect(result.page.body).toBeUndefined();
    expect(result.page.outline.map((entry: any) => `${entry.level} ${entry.title} ${entry.line}`)).toEqual([
      '2 Setup 3',
      '2 Options 7',
      '3 option0 9',
      '3 option1 13',
      '3 option2 17',
      '3 contextManagement 21',
      '2 Models 28',
    ]);
    const options = result.page.outline.find((entry: any) => entry.title === 'Options');
    const option0 = result.page.outline.find((entry: any) => entry.title === 'option0');
    expect(options.tokens).toBeGreaterThan(option0.tokens * 3);
  });

  it('reads one section with its subsections, and names the headings when the title misses', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body: referenceBody(3) });
    const result = await call('knowledge_read', { page: 'docs:acme#anthropic', section: 'contextmanagement' });
    expect(result.page.lines).toBe(
      '21│### contextManagement\n22│\n23│```ts\n24│# not a heading\n25│excludeTools?: string[]\n26│```\n27│',
    );
    expect(result.page.range).toEqual({ start: { line: 21 }, end: { line: 27 } });
    const options = await call('knowledge_read', { page: 'docs:acme#anthropic', section: 'Options' });
    expect(options.page.lines).toMatch(/^ 7│## Options/);
    expect(options.page.lines).toContain('### option2');
    expect(options.page.lines).not.toContain('## Models');
    await expect(call('knowledge_read', { page: 'docs:acme#anthropic', section: 'Pricing' })).rejects.toThrow(
      /no section titled "Pricing". Headings include: "Setup", "Options"/,
    );
  });

  it('matches lines like grep -C, with line numbers a write can take back', async () => {
    const { knowledge, call } = setup();
    const lines = Array.from({ length: 400 }, (_, i) => `**Speaker:** line ${i} of the transcript.`);
    lines[300] = '**Shane:** Peter Steinberger steers or queues with OpenClaw.';
    lines[100] = '**Shane:** a zebraword here.';
    const body = `# Episode\n\n## Transcript\n\n${lines.join('\n')}\n\n## More episodes\n\nOther shows.`;
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'podcast', name: 'Podcast', body });
    const steinberger = 5 + 300;

    const one = await call('knowledge_read', { page: 'docs:acme#podcast', match: 'steinberger', context: 1 });
    expect(one.page.matches).toEqual([
      {
        range: { start: { line: steinberger - 1 }, end: { line: steinberger + 1 } },
        lines: `${steinberger - 1}│${lines[299]}\n${steinberger}│${lines[300]}\n${steinberger + 1}│${lines[301]}`,
      },
    ]);
    expect(one.more).toBeUndefined();

    const two = await call('knowledge_read', { page: 'docs:acme#podcast', match: ['ZEBRAWORD', 'openclaw'] });
    expect(two.page.matches.map((m: any) => [m.range.start.line, m.range.end.line])).toEqual([
      [105 - 2, 105 + 2],
      [steinberger - 2, steinberger + 2],
    ]);
    const from = await call('knowledge_read', {
      page: 'docs:acme#podcast',
      match: ['zebraword', 'openclaw'],
      from: { line: 200 },
    });
    expect(from.page.matches).toHaveLength(1);

    await call('knowledge_page', {
      op: 'write',
      page: 'docs:acme#podcast',
      body: lines[300]!.replace('Steinberger', 'STEINBERGER'),
      range: { start: { line: steinberger }, end: { line: steinberger } },
      expectedVersion: one.page.version,
    });
    expect(await readAll(call, 'docs:acme#podcast')).toBe(body.replace('Steinberger', 'STEINBERGER'));

    const none = await call('knowledge_read', { page: 'docs:acme#podcast', match: 'nowhere' });
    expect(none.page.matches).toEqual([]);
    expect(none.more).toEqual(['match: no line contains "nowhere".']);
    await expect(call('knowledge_read', { page: 'docs:acme#podcast', match: 'x', outline: true })).rejects.toThrow(
      /at most one of outline, section and match/,
    );
  });

  it('stops matching at the token cap and goes on from the line it names, each match once', async () => {
    const { knowledge, call } = setup();
    const lines = Array.from(
      { length: 2000 },
      (_, i) => `Line ${i}: ${i % 10 === 0 ? 'needle' : 'hay'} and more words here.`,
    );
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'big', name: 'Big', body: lines.join('\n') });
    const seen: number[] = [];
    let from: unknown;
    let reads = 0;
    for (; reads < 50; reads++) {
      const result = await call('knowledge_read', {
        page: 'docs:acme#big',
        match: 'needle',
        context: 0,
        ...(from ? { from } : {}),
      });
      for (const match of result.page.matches) seen.push(match.range.start.line);
      const more = (result.more ?? []).find((line: string) => line.startsWith('match:'));
      if (!more) break;
      expect(more).toMatch(/^match: stopped at about [\d,]+ tokens; more matches from line \d+\./);
      from = JSON.parse(/from: (\{.*\})\.$/.exec(more)![1]!);
    }
    expect(reads).toBeGreaterThan(0);
    expect(seen).toEqual(Array.from({ length: 200 }, (_, i) => i * 10 + 1));
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
    expect(mentions.page.body).toBeUndefined();
  });

  it('leaves long notes and mentioning notes out of a whole read, counted, and reads them on their own', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'big', name: 'Big', body: 'Big body.' });
    await knowledge.upsertPage({ scope: 'docs:acme', path: 'small', name: 'Small', body: 'Small body.' });
    const long = 'word '.repeat(150);
    for (let i = 0; i < 8; i++) {
      await knowledge.upsertPage({ scope: 'docs:acme', path: `ref-${i}`, name: `Ref ${i}` });
      await knowledge.addNote({ scope: 'docs:acme', path: 'big', text: `Fact ${i}: ${long}` });
      await knowledge.addNote({ scope: 'docs:acme', path: `ref-${i}`, text: `[[docs:acme#big]] ${long}` });
    }
    await knowledge.addNote({ scope: 'docs:acme', path: 'small', text: 'One short fact.' });
    await knowledge.addNote({ scope: 'docs:acme', path: 'ref-0', text: 'Also [[docs:acme#small]].' });

    const small = await call('knowledge_read', { page: 'docs:acme#small' });
    expect(small.notes.map((note: any) => note.text)).toEqual(['One short fact.']);
    expect(small.mentionedIn).toHaveLength(1);
    expect(small.more).toBeUndefined();

    const whole = await call('knowledge_read', { page: 'docs:acme#big' });
    expect(whole.page.body).toBe('Big body.');
    expect(whole.notes).toBeUndefined();
    expect(whole.mentionedIn).toBeUndefined();
    expect(whole.notesLeftOut).toBe(8);
    expect(whole.mentionedInLeftOut).toBe(8);
    expect(whole.more).toEqual([
      expect.stringMatching(/^notes: 8 notes \(about [\d,]+ tokens\) left out\. Read them with notes: true\.$/),
      expect.stringMatching(
        /^mentionedIn: 8 notes mentioning this page \(about [\d,]+ tokens\) left out\. Read them with mentionedIn: true\.$/,
      ),
    ]);

    const notes = await call('knowledge_read', { page: 'docs:acme#big', notes: true });
    expect(notes.page.body).toBeUndefined();
    expect(notes.notes).toHaveLength(8);
    expect(notes.mentionedIn).toBeUndefined();
    const mentions = await call('knowledge_read', { page: 'docs:acme#big', mentionedIn: true, limit: 3 });
    expect(mentions.notes).toBeUndefined();
    expect(mentions.mentionedIn).toHaveLength(3);
    expect(mentions.more).toEqual([
      `mentionedIn: more than 3. Read again with mentionedInCursor: "${mentions.mentionedInCursor}".`,
    ]);
    await expect(call('knowledge_read', { page: 'docs:acme#big', notes: true, section: 'x' })).rejects.toThrow(
      /on their own/,
    );
  });

  it('says when search hit its limit, without telling the agent to search again', async () => {
    const { knowledge, call } = setup();
    for (let i = 0; i < 3; i++) await knowledge.upsertPage({ scope: 'docs:acme', path: `p${i}`, name: `Widget ${i}` });
    const more = (await call('knowledge_search', { query: 'widget', limit: 2 })).more[0];
    expect(more).toMatch(/^results: showing the top 2\. If none of these is what you need/);
    expect(more).not.toMatch(/there may be more|Search again/);
    expect((await call('knowledge_search', { query: 'widget', limit: 5 })).more).toBeUndefined();
  });

  it('matches quoted words, and says what to try when nothing has any word', async () => {
    const { knowledge, call } = setup();
    await knowledge.upsertPage({
      scope: 'docs:acme',
      path: 'models',
      name: 'Models',
      body: 'Set `api: "responses"` on a custom url model.',
    });
    const quoted = await call('knowledge_search', { query: '"api" "responses" `url`' });
    expect(quoted.results.map((hit: any) => hit.page.ref)).toEqual(['docs:acme#models']);
    const none = await call('knowledge_search', { query: 'gateway namespace' });
    expect(none.results).toEqual([]);
    expect(none.more).toEqual([
      'results: no page or note contains any word of "gateway namespace". Search again with different key words, or browse with knowledge_list.',
    ]);
    await expect(call('knowledge_search', { query: 'responses', scope: ['docs:acme#models'] })).rejects.toThrow(
      '"docs:acme#models" is a page ref, not a scope. scope takes scope addresses such as "docs:acme"; to see what is under the page, use knowledge_list with from: "docs:acme#models".',
    );
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

describe('tools.read.maxTokens', () => {
  it('sets how much one read, match or list returns, and the write guard follows it', async () => {
    const body = referenceBody();
    const small = setup();
    const large = setup(3_000);
    for (const { knowledge } of [small, large]) {
      await knowledge.upsertPage({ scope: 'docs:acme', path: 'anthropic', name: 'Anthropic', body });
      for (let i = 0; i < 120; i++)
        await knowledge.upsertPage({ scope: 'docs:acme', path: `section/p${i}`, name: `Page ${i}` });
    }
    const text = (result: any) =>
      numbered(result.page.lines)
        .map(([, line]) => line)
        .join('\n');
    const smallRead = await small.call('knowledge_read', { page: 'docs:acme#anthropic', from: { line: 1 } });
    const largeRead = await large.call('knowledge_read', { page: 'docs:acme#anthropic', from: { line: 1 } });
    expect(estimateTokenCount(text(smallRead))).toBeLessThanOrEqual(KNOWLEDGE_READ_BODY_TOKENS);
    expect(estimateTokenCount(text(largeRead))).toBeGreaterThan(KNOWLEDGE_READ_BODY_TOKENS * 2);
    expect(estimateTokenCount(text(largeRead))).toBeLessThanOrEqual(3_000);
    expect(await readAll(large.call, 'docs:acme#anthropic')).toBe(body);

    const smallList = await small.call('knowledge_list', { from: 'docs:acme#section', limit: 100 });
    const largeList = await large.call('knowledge_list', { from: 'docs:acme#section', limit: 100 });
    expect(largeList.entries.length).toBeGreaterThan(smallList.entries.length);

    // A range the larger read gave is accepted there; one line more is still refused.
    const { range, version } = largeRead.page;
    await expect(
      large.call('knowledge_page', {
        op: 'write',
        page: 'docs:acme#anthropic',
        range: { start: range.start, end: { line: range.end.line + 1 } },
        body: 'x',
        expectedVersion: version,
      }),
    ).rejects.toThrow(/run past what one knowledge_read/);
    const written = await large.call('knowledge_page', {
      op: 'write',
      page: 'docs:acme#anthropic',
      range,
      body: text(largeRead),
      expectedVersion: version,
    });
    expect(written.page.version).toBe(version + 1);
    expect(await readAll(large.call, 'docs:acme#anthropic')).toBe(body);
    // The default-cap tools refuse that wider range: it is more than one of their reads shows.
    const smallVersion = (await small.call('knowledge_read', { page: 'docs:acme#anthropic', from: { line: 1 } })).page
      .version;
    await expect(
      small.call('knowledge_page', {
        op: 'write',
        page: 'docs:acme#anthropic',
        range,
        body: 'x',
        expectedVersion: smallVersion,
      }),
    ).rejects.toThrow(/run past what one knowledge_read/);
  });

  it('refuses a cap that is not a whole number of at least 100', () => {
    for (const maxTokens of [0, 50, 1.5, Number.NaN]) expect(() => setup(maxTokens)).toThrow(/tools\.read\.maxTokens/);
  });
});
