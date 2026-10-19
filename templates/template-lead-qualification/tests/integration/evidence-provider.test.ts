import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIEvidenceProvider, normalizedResearchError } from '../../src/mastra/providers/evidence';
import type { ResearchContext } from '../../src/mastra/providers/evidence';
import { failureSchema, ResearchError } from '../../src/mastra/research/contracts';
import { event, harness } from '../support/application';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const close of cleanup.splice(0)) await close();
});
async function context(): Promise<ResearchContext> {
  const app = await harness();
  cleanup.push(() => app.close());
  const { runId } = await (await app.post(event('controlled-response'))).json();
  const { snapshot } = (await app.store.qualifications.get(runId))!;
  const deadline = await app.store.qualifications.start(runId, snapshot);
  return {
    runId,
    snapshot,
    deadline,
    store: app.store.qualifications,
    domain: 'example.com',
    domains: ['example.com'],
    round: {
      index: 0,
      target: 'employeeCount',
      query: 'Find company workforce',
      gap: 'unresolved',
      year: 2026,
      searchDomains: ['example.com'],
      previousEvidence: [],
      consultedUrls: [],
      missingAttributes: ['employeeCount'],
      supportedFacts: {},
      counters: { discoveredUrls: 0, retrievedPages: 0, extractedCandidates: 0, selectedCandidates: 0, urls: [] },
    },
  };
}
function response(text: string, terminal: Record<string, unknown>) {
  const events = [
    { type: 'response.created', response: { id: 'resp_controlled', model: 'gpt-6-luna', created_at: 1 } },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { id: 'msg_controlled', type: 'message', role: 'assistant', content: [] },
    },
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, item_id: 'msg_controlled', delta: text },
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        id: 'msg_controlled',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text, annotations: [] }],
      },
    },
    terminal,
  ];
  return new Response(events.map(value => `data: ${JSON.stringify(value)}\n\n`).join('') + 'data: [DONE]\n\n', {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
function stubResponse(make: () => Response | Promise<Response>) {
  vi.stubEnv('OPENAI_API_KEY', 'controlled-functional-key');
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => make()),
  );
}
const usage = { input_tokens: 30, output_tokens: 40, output_tokens_details: { reasoning_tokens: 10 } };
const extraction = { companyName: null, identityAmbiguous: false, candidates: [], intentCoverageComplete: false };

describe('bounded Responses failures', () => {
  it('uses_low_effort_for_all_stages_with_unchanged_caps_and_observed_token_settlement', async () => {
    const input = await context();
    const provider = new OpenAIEvidenceProvider();
    stubResponse(() =>
      response(JSON.stringify(extraction), { type: 'response.completed', response: { status: 'completed', usage } }),
    );
    expect(await provider.extract('firmographics', [], input)).toEqual(extraction);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toMatchObject({
      model: 'gpt-6-luna',
      reasoning: { effort: 'low' },
      max_output_tokens: 2000,
    });
    const verification = { supportedCandidateIds: [], intentCoverageComplete: false };
    stubResponse(() =>
      response(JSON.stringify(verification), { type: 'response.completed', response: { status: 'completed', usage } }),
    );
    expect(await provider.verify('firmographics', [], [], input)).toEqual(verification);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toMatchObject({
      model: 'gpt-6-luna',
      reasoning: { effort: 'low' },
      max_output_tokens: 1000,
    });
    stubResponse(() =>
      response('{}', {
        type: 'response.completed',
        response: {
          status: 'completed',
          usage,
          output: [
            {
              id: 'ws_controlled',
              type: 'web_search_call',
              status: 'completed',
              action: { type: 'search', sources: [] },
            },
          ],
        },
      }),
    );
    expect(await provider.search('firmographics', input)).toEqual({
      sourceUrls: [],
      preferredSourceUrls: [],
      evidence: [],
    });
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toMatchObject({
      model: 'gpt-6-luna',
      reasoning: { effort: 'low' },
      max_output_tokens: 1500,
      max_tool_calls: 1,
    });
    expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(120);
    expect(
      failureSchema.parse({
        branch: 'firmographics',
        providerId: 'openai-web',
        code: 'provider_failed',
        retryable: false,
      }).provider,
    ).toBeUndefined();
  });

  it('encodes_observed_open_ranges_and_finite_inferred_estimates_in_the_actual_responses_schema', async () => {
    const input = await context();
    const provider = new OpenAIEvidenceProvider();
    const observed = {
      id: 'observed-count',
      attribute: 'employeeCount',
      value: { min: 150, max: null },
      evidenceId: 'source',
      quote: 'Our workforce: 150+ employees.',
      asOf: null,
      inference: null,
    };
    stubResponse(() =>
      response(JSON.stringify({ ...extraction, candidates: [observed] }), {
        type: 'response.completed',
        response: { status: 'completed', usage },
      }),
    );
    const decoded = await provider.extract('firmographics', [], input);
    expect(decoded.candidates).toEqual([
      expect.objectContaining({ attribute: 'employeeCount', value: observed.value, quote: observed.quote }),
    ]);
    expect(decoded.candidates[0]!.inference ?? null).toBeNull();
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
    const choices = body.text.format.schema.properties.candidates.items.anyOf as Array<{
      properties: {
        attribute: { const: string };
        value: { type: string; pattern?: string; properties?: { max: { type?: string; anyOf?: unknown[] } } };
        inference: { type?: string };
      };
      required: string[];
    }>;
    expect(choices).toHaveLength(5);
    const employees = choices.filter(choice => choice.properties.attribute.const === 'employeeCount');
    expect(employees).toHaveLength(2);
    const observedSchema = employees.find(choice => choice.properties.inference.type === 'null')!;
    const inferredSchema = employees.find(choice => choice.properties.inference.type === 'object')!;
    expect(observedSchema.properties.value.properties!.max.anyOf).toContainEqual({ type: 'null' });
    expect(inferredSchema.properties.value.properties!.max.type).toBe('integer');
    expect(inferredSchema.required).toContain('inference');
    expect(choices.find(choice => choice.properties.attribute.const === 'businessModel')!.properties.value.type).toBe(
      'string',
    );
    expect(
      choices.find(choice => choice.properties.attribute.const === 'headquartersCountry')!.properties.value.type,
    ).toBe('string');
    expect(choices.find(choice => choice.properties.attribute.const === 'buyingIntent')!.properties.value.type).toBe(
      'object',
    );
    const inferred = {
      ...observed,
      id: 'inferred-count',
      value: { min: 140, max: 170 },
      quote: 'Our workforce: about 150 employees.',
      inference: {
        rationale: 'The approximate statement supports this finite range independently of the ICP thresholds.',
        additionalPassages: [],
      },
    };
    stubResponse(() =>
      response(JSON.stringify({ ...extraction, candidates: [inferred] }), {
        type: 'response.completed',
        response: { status: 'completed', usage },
      }),
    );
    expect((await provider.extract('firmographics', [], input)).candidates).toEqual([inferred]);
    stubResponse(() =>
      response(JSON.stringify({ ...extraction, candidates: [{ ...observed, inference: inferred.inference }] }), {
        type: 'response.completed',
        response: { status: 'completed', usage },
      }),
    );
    await expect(provider.extract('firmographics', [], input)).rejects.toMatchObject({
      code: 'provider_extraction_invalid',
    });
  });

  it('reports_incomplete_structured_responses_with_safe_metadata_and_observed_usage', async () => {
    const input = await context();
    stubResponse(() =>
      response('{"sensitive-marker":', {
        type: 'response.incomplete',
        response: {
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens', private: 'sensitive-marker' },
          usage,
          error: { message: 'sensitive-marker', code: 'sensitive-marker' },
        },
      }),
    );
    const failure = await new OpenAIEvidenceProvider().extract('firmographics', [], input).catch(error => error);
    expect(failure).toBeInstanceOf(ResearchError);
    expect(failure).toMatchObject({
      code: 'provider_response_incomplete',
      retryable: false,
      provider: {
        stage: 'extract',
        responseStatus: 'incomplete',
        incompleteReason: 'max_output_tokens',
        inputTokens: 30,
        outputTokens: 40,
        reasoningTokens: 10,
      },
    });
    expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(40);
    expect(JSON.stringify(failure)).not.toContain('sensitive-marker');
  });

  it('distinguishes_invalid_structured_output_from_provider_failure_and_drops_unknown_metadata', async () => {
    for (const text of ['{"sensitive-marker":', '{"sensitive-marker":true}']) {
      const input = await context();
      stubResponse(() =>
        response(text, {
          type: 'response.completed',
          response: {
            status: 'completed',
            incomplete_details: { reason: 'sensitive-marker' },
            usage: { ...usage, input_tokens: -1, output_tokens_details: { reasoning_tokens: 'sensitive-marker' } },
          },
        }),
      );
      const failure = await new OpenAIEvidenceProvider().verify('firmographics', [], [], input).catch(error => error);
      expect(failure).toMatchObject({
        code: 'provider_verification_invalid',
        retryable: false,
        provider: { stage: 'verify', responseStatus: 'completed', outputTokens: 40 },
      });
      expect(failure.provider.errorClass).toMatch(/^(json_parse|type_validation|no_object|schema_validation|syntax)$/);
      expect(failure.cause).toBeInstanceOf(Error);
      expect(failure.provider).not.toHaveProperty('incompleteReason');
      expect(failure.provider).not.toHaveProperty('inputTokens');
      expect(failure.provider).not.toHaveProperty('reasoningTokens');
      expect(JSON.stringify(failure)).not.toContain('sensitive-marker');
      expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(40);
    }
  });

  it('pinpoints_schema_issues_from_the_actual_decoder_without_retaining_values_or_error_messages', async () => {
    for (const [change, expected] of [
      [{ value: 'US' }, { code: 'invalid_union', path: ['candidates', 0] }],
      [{ inference: { rationale: 'sensitive-marker' } }, { code: 'invalid_union', path: ['candidates', 0] }],
      [
        { value: { min: 190, max: null }, inference: { rationale: 'sensitive-marker', additionalPassages: [] } },
        { code: 'invalid_union', path: ['candidates', 0] },
      ],
    ] as const) {
      const input = await context();
      const candidate = Object.assign(
        {
          id: 'fixture',
          attribute: 'employeeCount',
          value: { min: 20, max: 30 },
          evidenceId: 'source',
          quote: 'sensitive-marker',
          asOf: null,
        },
        change,
      );
      stubResponse(() =>
        response(JSON.stringify({ ...extraction, candidates: [candidate] }), {
          type: 'response.completed',
          response: { status: 'completed', usage },
        }),
      );
      const failure = await new OpenAIEvidenceProvider().extract('firmographics', [], input).catch(error => error);
      expect(failure).toMatchObject({
        code: 'provider_extraction_invalid',
        provider: { validationIssues: [expected] },
      });
      expect(JSON.stringify(failure)).not.toContain('sensitive-marker');
    }
    const failure = normalizedResearchError(
      {
        name: 'ZodError',
        issues: [
          ...Array.from({ length: 12 }, () => ({
            code: 'invalid_type',
            path: ['candidates', 1, 'sensitive-marker', ...Array(20).fill('sensitive-marker')],
            message: 'sensitive-marker',
            input: 'sensitive-marker',
          })),
          { code: 'sensitive-marker', path: ['sensitive-marker'] },
        ],
      },
      { stage: 'extract' },
    );
    expect(failure.provider!.validationIssues).toHaveLength(8);
    expect(failure.provider!.validationIssues!.every(issue => issue.path.length === 8)).toBe(true);
    expect(failure.provider!.validationIssues![0]!.path.slice(0, 3)).toEqual(['candidates', 1, 'unknown_field']);
    expect(JSON.stringify(failure)).not.toContain('sensitive-marker');
  });

  it('retains_http_failure_classification_and_conservative_allowance_without_leaking_provider_content', async () => {
    for (const [httpStatus, code, retryable] of [
      [401, 'provider_auth_failed', false],
      [429, 'provider_rate_limited', true],
      [503, 'provider_failed', true],
    ] as const) {
      const input = await context();
      stubResponse(
        () =>
          new Response(
            JSON.stringify({
              error: {
                message: 'sensitive-marker https://private.example/token',
                type: 'server_error',
                code: 'sensitive-marker',
              },
            }),
            {
              status: httpStatus,
              headers: { 'Content-Type': 'application/json', 'retry-after': '1', 'private-header': 'sensitive-marker' },
            },
          ),
      );
      const failure = await new OpenAIEvidenceProvider().search('firmographics', input).catch(error => error);
      expect(failure).toMatchObject({
        code,
        retryable,
        retryAfterMs: 1000,
        provider: { stage: 'search', httpStatus, errorClass: 'api_call' },
      });
      expect(JSON.stringify(failure)).not.toContain('sensitive-marker');
      expect(JSON.stringify(failure)).not.toContain('private.example');
      expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(1500);
      expect((await input.store.get(input.runId))!.budget.searchCalls).toBe(1);
    }
  });

  it('retains_failed_response_status_and_settles_usage_without_misclassifying_the_payload_as_invalid_output', async () => {
    const input = await context();
    stubResponse(() =>
      response('{"supportedCandidateIds":[],"intentCoverageComplete":false}', {
        type: 'response.failed',
        response: {
          status: 'failed',
          usage,
          error: { code: 'server_error', message: 'sensitive-marker' },
        },
      }),
    );
    const failure = await new OpenAIEvidenceProvider().verify('firmographics', [], [], input).catch(error => error);
    expect(failure).toMatchObject({
      code: 'provider_failed',
      provider: { stage: 'verify', responseStatus: 'failed', outputTokens: 40 },
    });
    expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(40);
    expect(JSON.stringify(failure)).not.toContain('sensitive-marker');
  });

  it('retains_retryable_network_failures_and_the_unmeasured_reservation', async () => {
    const input = await context();
    stubResponse(() => {
      throw new TypeError('sensitive-marker');
    });
    const failure = await new OpenAIEvidenceProvider().extract('firmographics', [], input).catch(error => error);
    expect(failure).toMatchObject({
      code: 'provider_failed',
      retryable: true,
      provider: { stage: 'extract', errorClass: 'network' },
    });
    expect(JSON.stringify(failure)).not.toContain('sensitive-marker');
    expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(2000);
  });
});
