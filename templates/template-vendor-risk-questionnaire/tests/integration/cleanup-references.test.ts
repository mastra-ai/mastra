import { expect, it, vi } from 'vitest';
import { reviewFixture } from '../support/review.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { openDatabase } from '../../src/mastra/persistence/database.ts';
import { previewCleanup, confirmCleanup } from '../../src/mastra/runtime/maintenance.ts';

it('preserves questionnaire bytes referenced by another intake during cleanup', async () => {
  const root = await temporaryDirectory();
  try {
    const f = await reviewFixture(root);
    try {
      const options = { ...f.options, workflow: f.workflow, storage: f.storage };
      const preview = await previewCleanup(f.runId, options);
      expect(preview.records.find(r => r.table === 'vrq_sources')?.count).toBe(2);
      const removeWorkflow = f.workflow.deleteWorkflowRunById.bind(f.workflow);
      vi.spyOn(f.workflow, 'deleteWorkflowRunById').mockImplementation(async runId => {
        // This reference appears after preview validation and before the final delete
        // transaction, while cleanup is removing the native workflow history.
        const db = await openDatabase(f.url);
        try {
          await db.execute({
            sql: `INSERT INTO vrq_intakes
              SELECT ?,digest,canonical_json,mapping_json,source_digest,created_at
              FROM vrq_intakes WHERE run_id=?`,
            args: ['other-run', f.runId],
          });
        } finally {
          db.close();
        }
        return removeWorkflow(runId);
      });
      const result = await confirmCleanup(
        {
          runId: f.runId,
          revision: preview.revision,
          previewDigest: preview.previewDigest,
          confirm: true,
        },
        options,
      );
      expect(result.deletedRecords).toBe(preview.records.reduce((sum, r) => sum + r.count, 0) - 1);
      const db = await openDatabase(f.url);
      try {
        const remaining = (await db.execute('SELECT digest,bytes FROM vrq_sources')).rows;
        expect(remaining).toHaveLength(1);
        expect(remaining[0]!.digest).toBe(f.input.inputProvenance.sourceSha256);
        expect(
          (await db.execute("SELECT source_digest FROM vrq_intakes WHERE run_id='other-run'")).rows[0]!.source_digest,
        ).toBe(remaining[0]!.digest);
        expect((remaining[0]!.bytes as ArrayBuffer).byteLength).toBeGreaterThan(0);
      } finally {
        db.close();
      }
    } finally {
      await f.mastra.shutdown();
    }
  } finally {
    vi.restoreAllMocks();
    await cleanupDirectory(root);
  }
});
