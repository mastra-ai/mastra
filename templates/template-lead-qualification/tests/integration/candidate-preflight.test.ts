import { afterEach, describe, expect, it, vi } from 'vitest';
import { qualificationConfig } from '../../src/mastra/config/qualification';
import type { EvidenceProvider } from '../../src/mastra/providers/evidence';
import { event, harness } from '../support/application';
import { recordProvider, proposal } from '../support/research';
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
describe('provider-neutral candidate preflight', () => {
  it.each(['mixed', 'invalid', 'empty'] as const)(
    'verifies_only_valid_survivors_and_persists_%s_batches',
    async mode => {
      const config = structuredClone(qualificationConfig);
      config.sources.providerIds = ['records'];
      config.research.targeted.order = ['buyingIntent'];
      const invalid = {
        ...proposal(
          'buyingIntent',
          { type: 'demo_request', occurredAt: '2026-10-18T00:00:00Z' },
          'private invented quotation',
        ),
      };
      const valid = { ...invalid, id: 'valid', quote: 'Please send us a demo.' };
      const records = recordProvider(
        'records',
        () => [{ id: 'record-1', source: 'https://example.com/inquiry', excerpt: 'Please send us a demo.' }],
        () => (mode === 'mixed' ? [invalid, valid] : mode === 'invalid' ? [invalid] : []),
      );
      const extract = records.extract.getMockImplementation()!;
      records.extract.mockImplementation(async (...args) => ({
        ...(await extract(...args)),
        intentCoverageComplete: true,
      }));
      const verify = vi.fn<EvidenceProvider['verify']>(async (_branch, candidates) => {
        expect(candidates.every(candidate => candidate.id === 'valid')).toBe(true);
        return { supportedCandidateIds: candidates.map(candidate => candidate.id), intentCoverageComplete: true };
      });
      const provider = { ...records, verify };
      const app = await harness({ evidence: [provider], qualification: config });
      const { runId } = await (await app.post(event(`preflight-${mode}`))).json();
      const received = (await app.store.get(runId))!;
      vi.spyOn(app.store.qualifications, 'finish').mockRejectedValueOnce(
        new Error('controlled finalization interruption'),
      );
      await expect(app.qualification.qualify(runId, received.event)).rejects.toThrow(
        'controlled finalization interruption',
      );
      const round = (await app.store.qualifications.round(runId, 0))!;
      expect(verify).toHaveBeenCalledTimes(mode === 'invalid' ? 0 : 1);
      expect(round.result.intentCoverageComplete).toBe(mode !== 'invalid');
      expect(round.result.candidates).toHaveLength(mode === 'mixed' ? 1 : 0);
      expect(round.result.rejections).toHaveLength(mode === 'empty' ? 0 : 1);
      expect(
        round.result.rejections.every(
          rejection => rejection.reason === 'exact_quote_absent' && rejection.checks.semanticSupported === false,
        ),
      ).toBe(true);
      expect(JSON.stringify(round.result.rejections)).not.toContain('private invented quotation');
      const directory = app.directory;
      await app.close(false);
      const reopened = await harness({ directory, evidence: [provider], qualification: config });
      cleanup.push(() => reopened.close());
      const before = verify.mock.calls.length;
      const assessment = (await reopened.qualification.qualify(runId, received.event))!;
      expect(verify).toHaveBeenCalledTimes(before);
      expect(assessment.rejections).toEqual(round.result.rejections);
      expect((await reopened.store.qualifications.round(runId, 0))!).toEqual(round);
    },
  );
  it('keeps_semantic_support_required_after_literal_preflight', async () => {
    const config = structuredClone(qualificationConfig);
    config.sources.providerIds = ['records'];
    config.research.targeted.order = ['employeeCount'];
    const records = recordProvider(
      'records',
      () => [{ id: 'record-1', source: 'https://example.com/about', excerpt: '40 employees' }],
      () => [proposal('employeeCount', { min: 40, max: 40 }, '40 employees')],
    );
    const verify = vi.fn<EvidenceProvider['verify']>(async () => ({
      supportedCandidateIds: [],
      intentCoverageComplete: false,
    }));
    const app = await harness({ evidence: [{ ...records, verify }], qualification: config });
    cleanup.push(() => app.close());
    const { runId } = await (await app.post(event('preflight-semantic'))).json();
    const assessment = (await app.qualification.qualify(runId, (await app.store.get(runId))!.event))!;
    expect(verify).toHaveBeenCalledTimes(1);
    expect(assessment.facts.employeeCount.disposition).toBe('unsupported');
    expect(assessment.rejections[0]).toMatchObject({
      reason: 'semantic_verification_rejected',
      checks: { evidenceKnown: true, exactQuotePresent: true, semanticSupported: false },
    });
  });
});
