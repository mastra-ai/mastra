import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { realpath, readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { userInfo } from 'node:os';
import { unzipSync, strFromU8 } from 'fflate';
import { reviewFixture, decision } from '../support/review.ts';
import { jsonStream, userText } from '../support/drafting.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { submitReview } from '../../src/mastra/review/service.ts';
import { publishExport } from '../../src/mastra/exports/publication.ts';
import { openDatabase } from '../../src/mastra/persistence/database.ts';
import { openReviewStore } from '../../src/mastra/persistence/review.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { checkLocalContent } from '../../src/mastra/processing/local-filter.ts';

let root: string;
beforeEach(async () => {
  root = await realpath(await temporaryDirectory());
});
afterEach(async () => {
  await cleanupDirectory(root);
});
describe('Review authority and release security', () => {
  it('reports invalid citation attribution and allows a reviewed gap without changing source bindings', async () => {
    const f = await reviewFixture(root);
    try {
      const draft = f.status.results[0]!.draft!;
      const d = decision(f, { finalApproval: false });
      d.dispositions[0]!.correction = {
        ...draft,
        citations: draft.citations.map(citation => ({
          ...citation,
          supportingExcerpt: `Scope: production; ${citation.supportingExcerpt}`,
        })),
      };
      const calls = f.provider.calls.length;
      await expect(submitReview(d, f.options)).rejects.toThrow('INVALID_ATTRIBUTION');
      expect(f.provider.calls).toHaveLength(calls);
      const store = await openReviewStore(f.url);
      try {
        const rejected = (await store.read(f.runId))!;
        expect(rejected.state).toBe('awaiting_review');
        expect(rejected.projection).toBeNull();
        expect(rejected.results[0]!.draft).toEqual(draft);
      } finally {
        store.close();
      }
      const gaps = decision(f, {
        decisionId: 'review-gaps',
        finalApproval: false,
        dispositions: [
          {
            questionId: f.questions[0]!.id,
            disposition: 'unknown',
            safeReason: 'No releasable supported answer is available.',
            releaseDocumentIds: [],
          },
        ],
      });
      const pending = (await submitReview(gaps, f.options))!;
      expect(pending.state).toBe('awaiting_review');
      expect(pending.projection?.answers[0]?.value).toBe('unknown');
      const approved = (await submitReview(
        {
          ...gaps,
          decisionId: 'approve-gaps',
          expectedRevision: pending.revision,
          expectedDigest: pending.digest,
          finalApproval: true,
        },
        f.options,
      ))!;
      expect(approved.state).toBe('approved');
      expect(approved.projection?.evidence).toEqual([]);
    } finally {
      await f.mastra.shutdown();
    }
  });
  it('validates citation hashes locally without treating them as reviewer content', async () => {
    const f = await reviewFixture(root, {
      format: 'docx',
      text: 'control Production workforce MFA is required. Record revision 0.',
    });
    try {
      const draft = f.status.results[0]!.draft!;
      const sourceHash = draft.citations[0]!.sourceSha256;
      // This real source digest contains a numeric sequence matched by the PII preset.
      await expect(checkLocalContent(sourceHash, 'diagnostic')).rejects.toThrow('SECURITY_BLOCKED');
      const d = decision(f, { finalApproval: false });
      const text = 'Production workforce MFA is required for access.';
      d.dispositions[0]!.correction = {
        ...draft,
        text,
        claims: draft.claims.map(claim => ({ ...claim, text })),
      };
      const before = f.provider.calls.length;
      const tampered = structuredClone(d);
      const citation = tampered.dispositions[0]!.correction!.citations[0]!;
      citation.sourceSha256 = 'a'.repeat(64);
      citation.locator.sourceSha256 = citation.sourceSha256;
      await expect(submitReview(tampered, f.options)).rejects.toThrow('SOURCE_CHANGED');
      expect(f.provider.calls).toHaveLength(before);

      const unsafe = structuredClone(d);
      unsafe.dispositions[0]!.correction!.text = 'sk-proj-PROTECTEDREVIEWCANARY0123456789';
      await expect(submitReview(unsafe, f.options)).rejects.toThrow('SECURITY_BLOCKED');
      expect(f.provider.calls).toHaveLength(before);

      const reviewed = await submitReview(d, f.options);
      expect(reviewed?.state).toBe('awaiting_review');
      expect(reviewed?.projection?.answers[0]?.text).toBe(text);
      const requests = f.provider.calls
        .slice(before)
        .map(({ call }) => userText(call))
        .join('\n');
      expect(requests).toContain(text);
      expect(requests).toContain(draft.citations[0]!.supportingExcerpt);
      expect(requests).not.toContain(sourceHash);
      expect(requests).not.toContain('PROTECTEDREVIEWCANARY');
    } finally {
      await f.mastra.shutdown();
    }
  });
  it('persists_sql_payloads_as_data_without_query_or_authority_changes', async () => {
    const payload = "'; DROP TABLE vrq_intakes; UPDATE vrq_review SET state_json='approved'; --";
    const f = await reviewFixture(root, { questions: [{ text: `Describe this literal SQL example: ${payload}` }] }),
      d = decision(f);
    const db = await openDatabase(f.url);
    await db.execute({ sql: 'CREATE TABLE sentinel (id TEXT PRIMARY KEY, value TEXT)' });
    await db.execute({ sql: 'INSERT INTO sentinel (id,value) VALUES (?,?)', args: ['unrelated', 'preserved'] });
    d.dispositions[0]!.safeReason = payload;
    await expect(submitReview({ ...d, decisionId: payload }, f.options)).rejects.toThrow();
    expect(await submitReview({ ...d, finalApproval: false }, f.options)).toMatchObject({ state: 'awaiting_review' });
    const stored = await db.execute({
      sql: 'SELECT outcome_json,actor FROM vrq_decisions WHERE run_id = ? AND decision_id = ?',
      args: [f.runId, d.decisionId],
    });
    expect(String(stored.rows[0]!.outcome_json)).toContain(payload.replaceAll('"', '\\"'));
    expect(stored.rows[0]!.actor).toBe(userInfo().username);
    expect(
      (await db.execute({ sql: 'SELECT value FROM sentinel WHERE id = ?', args: ['unrelated'] })).rows[0]!.value,
    ).toBe('preserved');
    expect((await db.execute({ sql: 'SELECT count(*) AS total FROM vrq_intakes' })).rows[0]!.total).toBe(1);
    await expect(publishExport(f.runId, f.options)).rejects.toThrow('FINAL_APPROVAL_REQUIRED');
    db.close();
    await f.mastra.shutdown();
  });
  it('blocks_protected_reviewer_edits_and_invalidates_stale_approval', async () => {
    const f = await reviewFixture(root),
      initial = (await submitReview(decision(f), f.options))!,
      before = f.provider.calls.length;
    const canary = 'sk-proj-PROTECTEDREVIEWCANARY0123456789',
      draft = f.status.results[0]!.draft!,
      bad = decision(f, {
        decisionId: 'protected',
        expectedRevision: initial.revision,
        expectedDigest: initial.digest,
      });
    bad.dispositions[0]!.correction = { ...draft, text: canary };
    await expect(submitReview(bad, f.options)).rejects.toThrow();
    expect(f.provider.calls).toHaveLength(before);
    const review = await openReviewStore(f.url),
      pending = (await review.read(f.runId))!;
    expect(pending.state).toBe('awaiting_review');
    expect(pending.projection).toBeNull();
    await expect(publishExport(f.runId, f.options)).rejects.toThrow('FINAL_APPROVAL_REQUIRED');
    const unsupported = decision(f, {
      decisionId: 'unsupported',
      expectedRevision: pending.revision,
      expectedDigest: pending.digest,
    });
    unsupported.dispositions[0]!.correction = { ...draft, text: 'We guarantee zero incidents.' };
    const original = f.provider.factory;
    let customCalls = 0;
    const factory: typeof original = (phase, id) =>
      phase === 'verification'
        ? {
            doStream: async () => {
              customCalls++;
              return jsonStream({
                supportedClaimIds: [],
                conflictedClaimIds: [],
                unsupportedCommitment: true,
                applicable: true,
                complete: true,
                sensitive: false,
              });
            },
            doGenerate: async () => {
              throw new Error('unused');
            },
          }
        : original(phase, id);
    await expect(submitReview(unsupported, { ...f.options, models: factory })).rejects.toThrow(
      'UNSUPPORTED_CORRECTION',
    );
    const safe = decision(f, {
      decisionId: 'safe-revision',
      expectedRevision: pending.revision,
      expectedDigest: pending.digest,
    });
    safe.dispositions[0]!.correction = { ...draft, text: 'Production workforce MFA is required for access.' };
    const approved = (await submitReview(safe, f.options))!,
      bundle = await publishExport(f.runId, f.options);
    expect(approved.projection!.answers[0]!.text).toBe(safe.dispositions[0]!.correction!.text);
    const processing = await openProcessingStore(f.url),
      status = (await processing.status(f.runId))!;
    expect(status.usage.length).toBeGreaterThan(f.status.usage.length);
    expect(status.usage).toHaveLength(f.provider.calls.length + customCalls);
    expect(JSON.stringify(status.security)).not.toContain(canary);
    expect((await readFile(bundle.path)).includes(Buffer.from(canary))).toBe(false);
    // Unsupported reasons are retained in the local decision audit; no old final approval can release changed text.
    expect((await review.read(f.runId))?.projection?.approvalId).toBe('safe-revision');
    processing.close();
    review.close();
    await f.mastra.shutdown();
    const other = resolve(root, 'native-failure');
    await mkdir(other);
    const failed = await reviewFixture(other),
      raw = decision(failed);
    const failFactory: typeof original = (phase, id) =>
      phase === 'injection' && id === 'final-set'
        ? {
            doStream: async () => {
              throw new Error('PRIVATE_DETECTOR_RESPONSE');
            },
            doGenerate: async () => {
              throw new Error('unused');
            },
          }
        : failed.provider.factory(phase, id);
    await expect(submitReview(raw, { ...failed.options, models: failFactory })).rejects.toThrow();
    const fp = await openProcessingStore(failed.url),
      fr = await openReviewStore(failed.url),
      fs = (await fp.status(failed.runId))!;
    expect(fs.usage.some(u => u.questionId === 'final-set' && u.status === 'uncertain')).toBe(true);
    expect((await fr.read(failed.runId))?.state).toBe('awaiting_review');
    expect(JSON.stringify(fs)).not.toContain('PRIVATE_DETECTOR_RESPONSE');
    fp.close();
    fr.close();
    await failed.mastra.shutdown();
  });
  it('renders_untrusted_cell_and_markup_text_without_active_content', async () => {
    const value =
      '\t =HYPERLINK("https://example.test","execute") <script>alert(1)</script> [open](https://example.test)';
    const f = await reviewFixture(root, {
        questions: [{ text: value }],
        text: 'control Production workforce MFA is required.',
      }),
      d = decision(f);
    expect(f.status.results[0]!.draft).toMatchObject({ value: 'unknown', claims: [], citations: [] });
    d.dispositions[0]!.safeReason = value;
    await submitReview(d, f.options);
    const bundle = await publishExport(f.runId, f.options),
      zip = unzipSync(await readFile(bundle.path));
    for (const [name, bytes] of Object.entries(zip)) {
      const xml = strFromU8(bytes);
      expect(xml).not.toContain('<f>');
      expect(xml).not.toContain('<hyperlink');
      if (name.includes('sheet1')) {
        expect(xml).toContain('t="inlineStr"');
        expect(xml).toContain('&lt;script&gt;');
      }
    }
    expect(bundle.manifest.quality).toBe('delivered_with_gaps');
    const gapCheck = f.provider.calls.find(
      c => c.phase === 'verification' && JSON.parse(userText(c.call)).externalReason === value,
    );
    expect(gapCheck).toBeDefined();
    expect(JSON.parse(userText(gapCheck!.call))).toMatchObject({ draft: { claims: [], citations: [] }, excerpts: [] });
    await f.mastra.shutdown();
  });
});
