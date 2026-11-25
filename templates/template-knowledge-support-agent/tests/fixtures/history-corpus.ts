import type { Knowledge } from '@mastra/core/knowledge';

const author = 'synthetic-history-fixture';
export function historyRecord(summary: string, topicTags = ['connectivity'], observedOn = '2026-01-01') {
  return `\`\`\`support-record\n${JSON.stringify({ topicTags, observedOn, state: 'approved', summary })}\n\`\`\``;
}
export const reviewedNote = (body: string) =>
  `<!-- knowledge-review:11111111-1111-4111-8111-111111111111:${'a'.repeat(64)} -->\nReviewed by: Synthetic reviewer\n${body}`;

/** Deterministic generated records, written through public Knowledge APIs into real LibSQL. */
export async function generateHistoryCorpus(knowledge: Knowledge) {
  const put = (scope: string, path: string, body: string) =>
    knowledge.upsertPage({ scope, path, name: path.split('/').at(-1)!, body, author });
  const scopes = ['customer:north:store-1', 'customer:north:store-2', 'customer:south:store-1', 'docs:north'];
  for (const scope of scopes)
    for (let i = 0; i < 600; i++)
      await put(
        scope,
        `cases/noise-${String(i).padStart(4, '0')}`,
        historyRecord(
          scope === scopes[0] ? `NOISE_${i}` : `FOREIGN_${scope}_${i}`,
          scope === scopes[0] ? ['inventory'] : ['connectivity', 'printing'],
          '2026-11-01',
        ),
      );
  // Relevant records follow 600 unrelated siblings, outside the bounded enumeration window.
  // Their observation dates are older than the noise; native search must find them by tag.
  await put(
    'customer:north:store-1',
    'cases/z-archive/older',
    historyRecord('OLDER_RELEVANT', ['connectivity', 'legacy'], '2020-01-01'),
  );
  await put(
    'customer:north:store-1',
    'cases/z-a-best',
    historyRecord('BEST_A', ['connectivity', 'printing'], '2021-01-01'),
  );
  await put(
    'customer:north:store-1',
    'cases/z-b-best',
    historyRecord('BEST_B', ['connectivity', 'printing'], '2021-01-01'),
  );
  const notePage = await put('customer:north:store-1', 'cases/note-only', 'No structured page record.');
  for (let i = 0; i < 110; i++)
    await knowledge.addNote({
      scope: 'customer:north:store-1',
      path: 'cases/note-only',
      text: `Inventory observation ${i}`,
      author,
    });
  const approved = await knowledge.addNote({
    scope: 'customer:north:store-1',
    path: 'cases/note-only',
    text: reviewedNote(historyRecord('APPROVED_NOTE_ONLY', ['connectivity'], '2026-01-01')),
    author: 'review:synthetic-reviewer',
  });
  await knowledge.addNote({
    scope: 'customer:north:store-1',
    path: 'cases/note-only',
    text: reviewedNote(historyRecord('UNREVIEWED_NOTE', ['connectivity', 'printing'], '2026-11-01')),
    author,
  });
  await knowledge.addNote({
    scope: 'customer:north:store-1',
    path: 'cases/note-only',
    text: reviewedNote(historyRecord('HIDDEN_STAMP_NOTE', ['connectivity', 'printing'], '2026-11-02')),
    stamps: ['customer:north:store-2'],
    author: 'review:synthetic-reviewer',
  });
  await put(
    'customer:north:store-1',
    'outside/better',
    historyRecord('OUTSIDE_ROOT', ['connectivity', 'printing'], '2026-11-10'),
  );
  return {
    totalCases: scopes.length * 600 + 4,
    customerCases: 604,
    noteRef: `customer:north:store-1#cases/note-only?note=${approved.id}`,
    notePageId: notePage.page.id,
    async addMalformedRecords() {
      await put('customer:north:store-1', 'cases/broken', '```support-record\n{"topicTags":["connectivity"]}\n```');
      await knowledge.addNote({
        scope: 'customer:north:store-1',
        path: 'cases/z-a-best',
        text: reviewedNote('```support-record\n{invalid-json\n```'),
        author: 'review:synthetic-reviewer',
      });
    },
  };
}
