import { expect, it, vi } from 'vitest';
import { sourceContexts } from '../../src/mastra/evidence/context.ts';
import { canonicalJson, runParser } from '../../src/mastra/intake/source.ts';
import { officeAdapter } from '../../src/mastra/intake/adapters.ts';
import { context, source } from '../fixtures/support.ts';

vi.mock('../../src/mastra/intake/source.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/mastra/intake/source.ts')>()),
  runParser: vi.fn(),
}));

it('builds evidence contexts beyond the engine function argument limit', () => {
  const blocks = Array.from({ length: 150_000 }, (_, i) => ({
    text: i === 0 ? 'Control' : 'MFA',
    locator: { kind: 'csv.cell', row: i, column: 0 },
  }));
  // Header selection must use the minimum row number, not insertion order.
  blocks.reverse();
  const contexts = sourceContexts(blocks);
  expect(contexts.size).toBe(blocks.length);
  expect(contexts.get(canonicalJson(blocks[0]!.locator))?.context?.field).toContain('first-row cell: Control');
});

it('inspects large empty regions without spreading rows into function arguments', async () => {
  vi.mocked(runParser).mockResolvedValue({
    format: 'xlsx',
    regions: [
      {
        id: 'sheet:0',
        kind: 'sheet',
        name: 'Empty',
        part: 'xl/worksheets/sheet1.xml',
        index: 0,
        rows: Array.from({ length: 150_000 }, () => [{ text: '' }, { text: '' }]),
        rowIndices: Array.from({ length: 150_000 }, (_, i) => i),
      },
    ],
  });
  const inspection = await officeAdapter('xlsx').inspect(source(new Uint8Array()), context());
  expect(inspection.status).toBe('needs_mapping');
  expect(inspection.regions[0]).toMatchObject({ rowCount: 150_000, columnCount: 2, candidateCount: 0 });
});
