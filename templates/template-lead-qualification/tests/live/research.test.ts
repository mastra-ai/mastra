import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { expect, it, vi } from 'vitest';
import { OpenAIEvidenceProvider } from '../../src/mastra/providers/evidence';
import { scoreCompany } from '../../src/mastra/tools/score-company';
import { event, harness } from '../support/application';
import { ProviderDiagnostics } from '../support/provider-diagnostics';

const companyDomain = 'attio.com';

// Explicit opt-in configuration only. Missing credentials are a failure, never a skip.
it('researches_real_company_with_filtered_responses_and_bounded_usage', async () => {
  expect(
    process.env.OPENAI_API_KEY && !/^(example|placeholder|your[-_])/i.test(process.env.OPENAI_API_KEY),
  ).toBeTruthy();
  const nativeFetch = globalThis.fetch;
  const captures: Promise<void>[] = [];
  const calls: ProviderDiagnostics[] = [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    expect(String(input instanceof Request ? input.url : input)).toBe('https://api.openai.com/v1/responses');
    assert.equal(typeof init?.body, 'string');
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe('gpt-6-luna');
    expect(body.store).toBe(false);
    const call = new ProviderDiagnostics(
      Number(body.max_tool_calls ?? 0),
      Number(body.max_output_tokens),
      Boolean(body.include?.includes('web_search_call.action.sources')),
      body.text?.format?.type === 'json_schema',
    );
    calls.push(call);
    if (body.tools?.length) {
      assert.equal(body.max_tool_calls, 1);
      assert.equal(body.tools.length, 1);
      assert.deepEqual(body.tools[0].filters.allowed_domains, [companyDomain]);
      assert.ok(call.sourceMetadataRequested);
    }
    try {
      const response = await nativeFetch(input, init);
      captures.push(
        call.capture(response.clone()).catch(() => {
          call.captureFailure = 'provider_metadata_capture_failed';
        }),
      );
      return response;
    } catch {
      call.captureFailure = 'provider_transport_failed';
      throw new TypeError('Provider transport failed');
    }
  });
  let app: Awaited<ReturnType<typeof harness>> | undefined;
  let runId: string | undefined;
  try {
    app = await harness({ evidence: [new OpenAIEvidenceProvider()] });
    const response = await app.post(event(`live-${Date.now()}`, { domain: companyDomain }));
    expect(response.status).toBe(202);
    runId = (await response.json()).runId as string;
    await app.mastra.startWorkers();
    await vi.waitFor(async () => expect((await app!.store.qualifications.get(runId!))?.assessment).toBeTruthy(), {
      timeout: 200_000,
      interval: 500,
    });
    await Promise.all(captures);
    expect(calls.map(call => call.captureFailure).filter(Boolean)).toEqual([]);
    expect(calls.every(call => call.completed.size <= call.maxToolCalls)).toBe(true);
    expect(calls.every(call => call.outputTokens === null || call.outputTokens <= call.maxOutputTokens)).toBe(true);
    const record = (await app.store.qualifications.get(runId!))!;
    const assessment = record.assessment!;
    expect(assessment.identity.domain).toBe(companyDomain);
    expect(assessment.evidence.length).toBeGreaterThan(0);
    expect(
      Object.entries(assessment.facts).some(
        ([attribute, fact]) =>
          fact.disposition === 'accepted' &&
          (attribute !== 'buyingIntent' || (Array.isArray(fact.value) && fact.value.length > 0)),
      ),
    ).toBe(true);
    const business = assessment.facts.businessModel;
    expect(business).toMatchObject({ disposition: 'accepted', value: 'b2b_saas' });
    const inference = assessment.inferences?.find(
      candidate => candidate.value === business.value && business.candidateIds.includes(candidate.candidateId),
    );
    assert.ok(inference, 'The live scenario requires a persisted business-model inference');
    expect(inference.rationale.length).toBeGreaterThan(0);
    expect(inference.passages.length).toBeGreaterThan(0);
    for (const passage of inference.passages) {
      const source = assessment.evidence.find(item => item.id === passage.evidenceId);
      assert.ok(source, 'Each inference passage must name persisted evidence');
      expect(business.evidenceIds).toContain(source.id);
      expect(source.excerpt.includes(passage.quote)).toBe(true);
    }
    for (const source of assessment.evidence) {
      expect(source.kind).toBe('website');
      const hostname = new URL(source.source).hostname;
      expect(hostname === companyDomain || hostname.endsWith(`.${companyDomain}`)).toBe(true);
      expect(source.excerpt.length).toBeGreaterThan(0);
      expect(createHash('sha256').update(source.excerpt).digest('hex')).toBe(source.digest);
    }
    expect(assessment.result).toEqual(
      scoreCompany({
        identity: assessment.identity,
        facts: assessment.facts,
        policy: assessment.snapshot.config.policy,
        routing: assessment.snapshot.config.routing,
        assessmentTime: assessment.snapshot.assessmentTime,
      }),
    );
    expect(calls.filter(call => call.maxToolCalls > 0).length).toBeLessThanOrEqual(4);
    expect(calls.filter(call => call.maxToolCalls > 0).some(call => call.completed.size === 1)).toBe(true);
    expect(record.budget.searchCalls).toBeLessThanOrEqual(4);
    expect(record.budget.pageRequests).toBeLessThanOrEqual(4);
    expect(record.budget.outputTokens).toBeLessThanOrEqual(12_000);
    expect(assessment.snapshot.config.research.maxPageBytes).toBe(2_097_152);
    expect(assessment.snapshot.config.research.maxTotalPageBytes).toBe(8_388_608);
    expect(record.budget.compressedBytes).toBeLessThanOrEqual(8_388_608);
    expect(record.budget.decodedBytes).toBeLessThanOrEqual(8_388_608);
    expect(Date.parse(assessment.completedAt) - record.budget.startedAt!).toBeLessThanOrEqual(180_000);
    expect(calls.every(call => call.outputTokens !== null)).toBe(true);
  } finally {
    try {
      await app?.dispatcher.stop();
      await Promise.all(captures);
      let diagnostic: Record<string, unknown> = { state: 'assessment_unavailable' };
      try {
        const record = app && runId ? await app.store.qualifications.get(runId) : null;
        const businessInferences =
          record?.assessment?.inferences?.filter(inference =>
            record.assessment!.facts.businessModel.candidateIds.includes(inference.candidateId),
          ) ?? [];
        diagnostic = {
          state: record?.assessment?.processingStatus ?? 'pending',
          budget: record?.budget ?? null,
          failures:
            record?.assessment?.failures.map(failure => ({
              branch: failure.branch,
              code: failure.code,
              retryable: failure.retryable,
              ...(failure.page ? { page: failure.page } : {}),
            })) ?? [],
          classification: record?.assessment?.result.classification ?? null,
          evidenceCount: record?.assessment?.evidence.length ?? 0,
          rejections: record?.assessment?.rejections ?? [],
          rounds: record?.assessment?.rounds ?? [],
          employeeCount: record?.assessment
            ? {
                value: record.assessment.facts.employeeCount.value,
                basis: record.assessment.facts.employeeCount.basis,
                disposition: record.assessment.facts.employeeCount.disposition,
              }
            : null,
          headquartersCountry: record?.assessment?.facts.headquartersCountry.value ?? null,
          score: record?.assessment?.result.score ?? null,
          contributions:
            record?.assessment?.result.contributions.map(({ rule, points, state }) => ({ rule, points, state })) ?? [],
          businessModel: record?.assessment
            ? {
                value: record.assessment.facts.businessModel.value,
                method:
                  record.assessment.facts.businessModel.disposition !== 'accepted'
                    ? 'unresolved'
                    : businessInferences.length > 0
                      ? 'inferred'
                      : 'direct',
                evidenceCount: record.assessment.facts.businessModel.evidenceIds.length,
                citationCount:
                  businessInferences.length > 0
                    ? businessInferences.reduce((count, inference) => count + inference.passages.length, 0)
                    : record.assessment.facts.businessModel.evidenceIds.length,
              }
            : null,
          facts: record?.assessment
            ? Object.fromEntries(
                Object.entries(record.assessment.facts).map(([attribute, fact]) => [attribute, fact.disposition]),
              )
            : null,
        };
      } catch {
        diagnostic = { state: 'diagnostic_read_failed' };
      }
      console.info(
        JSON.stringify({
          event: 'research.live.diagnostics',
          runId: runId ?? null,
          ...diagnostic,
          providerCalls: calls.map(call => call.summary()),
        }),
      );
    } finally {
      try {
        await app?.close();
      } finally {
        vi.unstubAllGlobals();
      }
    }
  }
});
