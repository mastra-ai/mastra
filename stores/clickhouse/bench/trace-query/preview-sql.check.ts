/**
 * Local parity check for `previewSql()` against core's `buildInputPreview()`, on the docker ClickHouse
 * (never the replica). Inputs are the core test cases plus extra shapes.
 *
 *   tsx bench/trace-query/preview-sql.check.ts
 */
import { createClient } from '@clickhouse/client';
import { buildInputPreview } from '@mastra/core/storage';

import { previewSql } from './preview-sql';
import { LOCAL } from './smoke';

const roleFirst = JSON.stringify({ messages: [{ role: 'user', content: 'secret question '.repeat(20) }] });
const contentFirst = JSON.stringify({ messages: [{ content: 'assistant answer '.repeat(20), role: 'assistant' }] });

const INPUTS: (string | null)[] = [
  JSON.stringify({
    messages: [
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'answer' },
      { role: 'user', content: 'second question' },
    ],
  }),
  JSON.stringify({ messages: [{ role: 'user', content: 'from the wire' }] }),
  '"plain scalar prompt"',
  '"truncated scalar promp',
  JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: 'part one' }, { type: 'image' }] }] }),
  roleFirst.slice(0, 80),
  contentFirst.slice(0, 250),
  '{"messages": [{"role"',
  `[${'{"role":"user"},'.repeat(10_000)}`,
  JSON.stringify({ messages: [{ content: 'content-first question', role: 'user' }] }),
  JSON.stringify({ messages: [{ role: 'user', content: 'a'.repeat(400) }] }),
  null,
  '   ',
  JSON.stringify({ messages: [{ role: 'assistant', content: 'no user turn' }] }),
  'plain prompt text',
  JSON.stringify({ query: 'lookup' }),
  // Extra shapes.
  JSON.stringify([
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'top-level array' },
  ]),
  JSON.stringify([1, 2, 3]),
  JSON.stringify({ messages: 'not an array' }),
  JSON.stringify({ messages: [{ role: 'user', content: ['bare string part', { type: 'text', text: 'and text' }] }] }),
  JSON.stringify({ messages: [{ role: 'user', content: 'ünïcödé ✓ '.repeat(20) }] }),
  JSON.stringify({ messages: [{ role: 'user', content: 'quote " and \\ backslash\nnewline' }] }),
  '  {"query":"padded"}  ',
  'x'.repeat(150),
  '42',
  'true',
];

async function main() {
  const client = createClient(LOCAL);
  try {
    const table = 'default.qx21_preview_check';
    await client.command({
      query: `CREATE OR REPLACE TABLE ${table} (i UInt32, input Nullable(String)) ENGINE = Memory`,
    });
    await client.insert({ table, values: INPUTS.map((input, i) => ({ i, input })), format: 'JSONEachRow' });
    const result = await client.query({
      query: `SELECT i, ${previewSql('input')} AS preview FROM ${table} ORDER BY i`,
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as { i: number; preview: string | null }[];
    await client.command({ query: `DROP TABLE ${table}` });
    let bad = 0;
    for (const { i, preview } of rows) {
      const input = INPUTS[i]!;
      const expected = buildInputPreview(input) ?? null;
      const ok = preview === expected;
      if (!ok) bad++;
      console.log(`${ok ? 'ok  ' : 'DIFF'} ${JSON.stringify(input)?.slice(0, 60)}`);
      if (!ok) console.log(`     ts:  ${JSON.stringify(expected)}\n     sql: ${JSON.stringify(preview)}`);
    }
    console.log(`${INPUTS.length - bad} / ${INPUTS.length} match`);
  } finally {
    await client.close();
  }
}

void main();
