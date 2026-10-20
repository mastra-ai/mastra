import { createHash } from 'node:crypto';
import { sourcePassages } from '../../src/mastra/research/source-passages';
import type { Evidence, Candidate } from '../../src/mastra/research/contracts';
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
function response(
  text: string,
  terminal: Record<string, unknown>,
  hiddenType?: string,
  edit?: (events: Array<Record<string, unknown>>) => void,
) {
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
    ...(hiddenType
      ? [
          {
            type: hiddenType,
            item_id: 'PRIVATE_HIDDEN',
            output_index: 1,
            delta: 'PRIVATE_ARGUMENT',
            arguments: 'PRIVATE_ARGUMENT',
            code: 'PRIVATE_CODE',
            partial_image_b64: 'PRIVATE_IMAGE',
            partial_image_index: 0,
          },
        ]
      : []),
    terminal,
  ];
  edit?.(events);
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

function searchResponse(ids: string[], split: boolean, edit?: (events: Array<Record<string, unknown>>) => void) {
  const items = ids.map(id => ({
    id,
    type: 'web_search_call',
    status: 'completed',
    action: {
      type: 'search',
      query: 'example.com company workforce',
      sources: [{ type: 'url', url: 'https://example.com/about' }],
    },
  }));
  const events = [
    { type: 'response.created', response: { id: 'resp_search', model: 'gpt-6-luna', created_at: 1 } },
    ...items.flatMap((item, output_index) => [
      { type: 'response.output_item.added', output_index, item: { ...item, status: 'in_progress' } },
      { type: 'response.web_search_call.completed', output_index, item_id: item.id },
      { type: 'response.output_item.done', output_index, item },
    ]),
    {
      type: 'response.completed',
      response: {
        status: 'completed',
        model: 'gpt-6-luna',
        output: items,
        usage: { ...usage, total_tokens: 70 },
      },
    },
  ];
  edit?.(events);
  const bytes = new TextEncoder().encode(
    events.map(value => `data: ${JSON.stringify(value)}\n\n`).join('') + 'data: [DONE]\n\n',
  );
  return new Response(
    new ReadableStream({
      start(controller) {
        // Split inside JSON strings and SSE separators as well as between events.
        const size = split ? 17 : bytes.length;
        for (let start = 0; start < bytes.length; start += size) controller.enqueue(bytes.slice(start, start + size));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}

describe('installed SDK search contract', () => {
  it.each([false, true])(
    'deduplicates repeated observations and preserves the bounded wire request (split=%s)',
    async split => {
      const input = await context();
      input.round.searchDomains = ['example.com', 'careers.example.com'];
      stubResponse(() => searchResponse(['ws_single'], split));
      expect(await new OpenAIEvidenceProvider().search('firmographics', input)).toEqual({
        sourceUrls: ['https://example.com/about'],
        preferredSourceUrls: [],
        evidence: [],
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      const [destination, options] = vi.mocked(fetch).mock.calls[0]!;
      expect(destination).toBe('https://api.openai.com/v1/responses');
      expect(options!.method).toBe('POST');
      const body = JSON.parse(options!.body as string);
      expect(body).toMatchObject({
        model: 'gpt-6-luna',
        stream: true,
        store: false,
        reasoning: { effort: 'low' },
        max_output_tokens: 1500,
        max_tool_calls: 1,
        parallel_tool_calls: false,
        tool_choice: 'required',
        include: expect.arrayContaining(['web_search_call.action.sources']),
        tools: [
          {
            type: 'web_search',
            search_context_size: 'low',
            filters: { allowed_domains: input.round.searchDomains },
          },
        ],
      });
      expect(body.tools).toHaveLength(1);
      expect((await input.store.get(input.runId))!.budget).toMatchObject({ searchCalls: 1, outputTokens: 40 });
    },
  );

  it.each([false, true])(
    'rejects two distinct completed searches from one provider response without retry (split=%s)',
    async split => {
      const input = await context();
      stubResponse(() => searchResponse(['ws_first', 'ws_second'], split));
      await expect(new OpenAIEvidenceProvider().search('firmographics', input)).rejects.toMatchObject({
        code: 'provider_search_limit_exceeded',
        retryable: false,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect((await input.store.get(input.runId))!.budget).toMatchObject({ searchCalls: 1, outputTokens: 40 });
    },
  );

  it.each(['searching', 'in_progress', 'incomplete', 'failed', 'unknown'])(
    'rejects an unfinished extra final attempt (%s) and its source URLs',
    async status => {
      const input = await context();
      stubResponse(() =>
        searchResponse(['ws_first', 'ws_second'], true, events => {
          const terminal = events.at(-1)!.response as { output: Array<{ status: string }> };
          terminal.output[1]!.status = status;
          for (let index = events.length - 2; index >= 0; index--) {
            const event = events[index]!;
            if (event.output_index === 1 && event.type !== 'response.output_item.added') events.splice(index, 1);
          }
          events.splice(events.length - 1, 0, {
            type: 'response.web_search_call.searching',
            output_index: 1,
            item_id: 'ws_second',
          });
        }),
      );
      await expect(new OpenAIEvidenceProvider().search('firmographics', input)).rejects.toMatchObject({
        code: 'provider_search_limit_exceeded',
        retryable: false,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    'duplicate',
    'missing_id',
    'invalid_id',
    'unfinished',
    'open_page',
    'hidden',
    'snapshot_hidden',
    'hidden_tool',
    'regression',
    'wrong_index',
  ])('rejects ambiguous direct SDK search provenance (%s) without retry', async name => {
    const input = await context();
    stubResponse(() =>
      searchResponse(['ws_single'], true, events => {
        const terminal = events.at(-1)!.response as { output: Array<Record<string, unknown>> };
        const item = terminal.output[0]!;
        if (name === 'duplicate') terminal.output.push({ ...item });
        if (name === 'missing_id') delete item.id;
        if (name === 'invalid_id') item.id = '   ';
        if (name === 'unfinished') item.status = 'searching';
        if (name === 'open_page') (item.action as { type: string }).type = 'open_page';
        if (name === 'hidden')
          events.splice(events.length - 1, 0, {
            type: 'response.web_search_call.completed',
            output_index: 1,
            item_id: 'ws_hidden',
          });
        if (name === 'snapshot_hidden')
          (events[0]!.response as { output?: unknown }).output = [{ ...item, id: 'ws_hidden' }];
        if (name === 'hidden_tool')
          events.splice(events.length - 1, 0, {
            type: 'response.output_item.added',
            output_index: 1,
            item: {
              type: 'code_interpreter_call',
              id: 'ci_hidden',
              status: 'completed',
              code: 'PRIVATE_CODE',
              container_id: 'private_container',
              outputs: [],
            },
          });
        if (name === 'regression')
          events.splice(events.length - 1, 0, {
            type: 'response.web_search_call.searching',
            output_index: 0,
            item_id: 'ws_single',
          });
        if (name === 'wrong_index') events[2]!.output_index = 1;
      }),
    );
    const failure = await new OpenAIEvidenceProvider().search('firmographics', input).catch(error => error);
    expect(failure).toBeInstanceOf(ResearchError);
    expect(failure.retryable).toBe(false);
    expect(failure.code).toBe(
      name === 'duplicate' || name === 'hidden' || name === 'snapshot_hidden'
        ? 'provider_search_limit_exceeded'
        : name === 'hidden_tool'
          ? 'provider_tool_unexpected'
          : 'search_completion_unverified',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(failure)).not.toContain('PRIVATE');
  });

  it.each(['added', 'completed', 'done', 'terminal'])(
    'accepts consistent partial search lifecycle (%s) with final citation provenance',
    async observation => {
      const input = await context();
      stubResponse(() =>
        searchResponse(['ws_single.with punctuation'], true, events => {
          for (let index = events.length - 2; index > 0; index--) {
            const type = events[index]!.type;
            const keep =
              observation === 'added'
                ? type === 'response.output_item.added'
                : observation === 'completed'
                  ? type === 'response.web_search_call.completed'
                  : observation === 'done'
                    ? type === 'response.output_item.done'
                    : false;
            if (!keep) events.splice(index, 1);
          }
          const terminal = events.at(-1)!.response as { output: Array<Record<string, unknown>> };
          terminal.output.push({
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'Source',
                annotations: [{ type: 'url_citation', url: 'https://example.com/team' }],
              },
            ],
          });
        }),
      );
      expect(await new OpenAIEvidenceProvider().search('firmographics', input)).toEqual({
        sourceUrls: ['https://example.com/about', 'https://example.com/team'],
        preferredSourceUrls: ['https://example.com/team'],
        evidence: [],
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    'response.code_interpreter_call.in_progress',
    'response.file_search_call.searching',
    'response.function_call_arguments.delta',
    'response.function_call_arguments.done',
    'response.code_interpreter_call_code.delta',
    'response.code_interpreter_call_code.done',
    'response.image_generation_call.partial_image',
    'response.mcp_call.in_progress',
    'response.mcp_call_arguments.delta',
    'response.mcp_list_tools.completed',
    'response.custom_tool_call_input.delta',
    'response.shell_call_command.added',
    'response.shell_call_command.delta',
    'response.shell_call_command.done',
    'response.shell_call_output_content.delta',
    'response.shell_call_output_content.done',
  ])('rejects hidden tool-family events (%s) while accounting known tokens', async type => {
    const input = await context();
    stubResponse(() =>
      searchResponse(['ws_single'], true, events => {
        events.splice(events.length - 1, 0, {
          type,
          item_id: 'PRIVATE_HIDDEN',
          output_index: 1,
          delta: 'PRIVATE_ARGUMENT',
          arguments: 'PRIVATE_ARGUMENT',
          code: 'PRIVATE_CODE',
          partial_image_b64: 'PRIVATE_IMAGE',
          partial_image_index: 0,
        });
      }),
    );
    const failure = await new OpenAIEvidenceProvider().search('firmographics', input).catch(error => error);
    expect(failure).toBeInstanceOf(ResearchError);
    expect(failure).toMatchObject({ code: 'provider_tool_unexpected', retryable: false });
    expect(JSON.stringify(failure)).not.toContain('PRIVATE_');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await input.store.get(input.runId))!.budget).toMatchObject({ searchCalls: 1, outputTokens: 40 });
  });

  it.each(['extract', 'verify'] as const)('rejects forbidden lifecycle in the zero-tool %s stage', async stage => {
    for (const type of ['response.file_search_call.searching', 'response.web_search_call.in_progress']) {
      const input = await context();
      stubResponse(() =>
        response(
          JSON.stringify(
            stage === 'extract' ? extraction : { supportedCandidateIds: [], intentCoverageComplete: false },
          ),
          {
            type: 'response.completed',
            response: { status: 'completed', output: [], usage },
          },
          type,
        ),
      );
      const provider = new OpenAIEvidenceProvider();
      const result =
        stage === 'extract'
          ? provider.extract('firmographics', [], input)
          : provider.verify('firmographics', [], [], input);
      await expect(result).rejects.toMatchObject({ code: 'provider_tool_unexpected', retryable: false });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(40);
    }
  });

  it.each(['search', 'extract', 'verify'] as const)(
    'rejects supplied items and snapshots throughout %s',
    async stage => {
      const forbidden = {
        type: 'code_interpreter_call',
        id: 'PRIVATE_TOOL',
        status: 'completed',
        code: 'PRIVATE_CODE',
        container_id: 'PRIVATE_CONTAINER',
        outputs: [],
      };
      const observations: Array<Record<string, unknown>> = [
        ...['response.output_item.added', 'response.output_item.done', 'response.future_metadata.updated'].map(
          type => ({ type, output_index: 1, item: forbidden }),
        ),
        ...['response.created', 'response.in_progress', 'response.queued', 'response.future_metadata.updated'].map(
          type => ({ type, response: { id: 'partial', model: 'gpt-6-luna', created_at: 1, output: [forbidden] } }),
        ),
        { type: 'response.future_metadata.updated', item: { type: 'PRIVATE_UNKNOWN' } },
        { type: 'response.future_metadata.updated', item: null },
        { type: 'response.future_metadata.updated', response: { output: null } },
        ...(stage === 'search'
          ? []
          : [
              {
                type: 'response.future_metadata.updated',
                item: {
                  type: 'web_search_call',
                  id: 'PRIVATE_SEARCH',
                  status: 'completed',
                  action: { type: 'search' },
                },
              },
            ]),
      ];
      for (const observation of observations) {
        const input = await context();
        const edit = (events: Array<Record<string, unknown>>) => {
          events.splice(events.length - 1, 0, observation);
        };
        stubResponse(() =>
          stage === 'search'
            ? searchResponse(['ws_single'], true, edit)
            : response(
                JSON.stringify(
                  stage === 'extract' ? extraction : { supportedCandidateIds: [], intentCoverageComplete: false },
                ),
                { type: 'response.completed', response: { status: 'completed', output: [], usage } },
                undefined,
                edit,
              ),
        );
        const provider = new OpenAIEvidenceProvider();
        const call =
          stage === 'search'
            ? provider.search('firmographics', input)
            : stage === 'extract'
              ? provider.extract('firmographics', [], input)
              : provider.verify('firmographics', [], [], input);
        const failure = await call.catch(error => error);
        expect(failure).toBeInstanceOf(ResearchError);
        expect(failure).toMatchObject({ code: 'provider_tool_unexpected', retryable: false });
        expect(JSON.stringify(failure)).not.toContain('PRIVATE_');
        expect(fetch).toHaveBeenCalledTimes(1);
        expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(40);
      }
    },
  );
  it.each(['response.queued', 'response.future_metadata.updated'])(
    'tracks hidden search attempts in %s snapshots',
    async type => {
      const input = await context();
      stubResponse(() =>
        searchResponse(['ws_single'], true, events => {
          events.splice(events.length - 1, 0, {
            type,
            response: {
              output: [
                { type: 'web_search_call', id: 'PRIVATE_EXTRA', status: 'completed', action: { type: 'search' } },
              ],
            },
          });
        }),
      );
      await expect(new OpenAIEvidenceProvider().search('firmographics', input)).rejects.toMatchObject({
        code: 'provider_search_limit_exceeded',
        retryable: false,
      });
      expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(40);
    },
  );

  it('preserves ordinary and unknown future non-tool events', async () => {
    const input = await context();
    stubResponse(() =>
      searchResponse(['ws_single'], false, events => {
        events.splice(
          events.length - 1,
          0,
          {
            type: 'response.reasoning_summary_text.delta',
            item_id: 'reasoning',
            output_index: 1,
            summary_index: 0,
            delta: 'ordinary',
          },
          { type: 'response.future_metadata.updated', text: 'function_call_arguments.delta' },
          { type: 'response.function_call_arguments_extra.delta' },
          { type: 'prefix.response.mcp_call.in_progress' },
          {
            type: 'response.output_text.done',
            item_id: 'message',
            output_index: 2,
            content_index: 0,
            text: 'mcp_call.in_progress',
          },
        );
      }),
    );
    expect((await new OpenAIEvidenceProvider().search('firmographics', input)).sourceUrls).toEqual([
      'https://example.com/about',
    ]);
  });

  it('keeps unfinished message citations out of admitted search URLs', async () => {
    const input = await context();
    stubResponse(() =>
      searchResponse(['ws_single'], false, events => {
        const terminal = events.at(-1)!.response as { output: Array<Record<string, unknown>> };
        terminal.output.push({
          type: 'message',
          role: 'assistant',
          status: 'in_progress',
          content: [
            {
              type: 'output_text',
              text: 'Unfinished',
              annotations: [{ type: 'url_citation', url: 'https://example.com/unfinished' }],
            },
          ],
        });
      }),
    );
    expect(await new OpenAIEvidenceProvider().search('firmographics', input)).toEqual({
      sourceUrls: ['https://example.com/about'],
      preferredSourceUrls: [],
      evidence: [],
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry a transport failure inside the SDK search', async () => {
    const input = await context();
    stubResponse(() => {
      throw new TypeError('private transport failure');
    });
    const failure = await new OpenAIEvidenceProvider().search('firmographics', input).catch(error => error);
    expect(failure).toMatchObject({ code: 'provider_failed', provider: { stage: 'search' } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(failure)).not.toContain('private transport failure');
    expect((await input.store.get(input.runId))!.budget).toMatchObject({ searchCalls: 1, outputTokens: 1500 });
  });

  it.each(['search', 'extract', 'verify'] as const)(
    'keeps retryable API and connection failures inside one %s reservation',
    async stage => {
      for (const failureKind of [429, 503, 'connection_reset'] as const) {
        const input = await context();
        stubResponse(() => {
          if (failureKind === 'connection_reset')
            throw new TypeError('fetch failed', {
              cause: Object.assign(new Error('private connection detail'), { code: 'ECONNRESET' }),
            });
          return new Response(JSON.stringify({ error: { message: 'private API detail', type: 'server_error' } }), {
            status: failureKind,
            headers: { 'Content-Type': 'application/json' },
          });
        });
        const provider = new OpenAIEvidenceProvider();
        const operation =
          stage === 'search'
            ? provider.search('firmographics', input)
            : stage === 'extract'
              ? provider.extract('firmographics', [], input)
              : provider.verify('firmographics', [], [], input);
        const failure = await operation.catch(error => error);
        expect(failure).toBeInstanceOf(ResearchError);
        expect(failure).toMatchObject({
          code: failureKind === 429 ? 'provider_rate_limited' : 'provider_failed',
          retryable: failureKind !== 'connection_reset',
          provider: { stage },
        });
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(failure)).not.toContain('private');
        expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(
          stage === 'search' ? 1500 : stage === 'extract' ? 2000 : 1000,
        );
      }
    },
  );
});

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
    const excerpt = 'Our workforce: 150+ employees. Our workforce: about 150 employees.';
    const material: Evidence[] = [
      {
        id: 'source',
        excerpt,
        digest: createHash('sha256').update(excerpt).digest('hex'),
        kind: 'website',
        source: 'https://example.com/about',
        title: 'About',
        retrievedAt: input.snapshot.assessmentTime,
        publishedAt: null,
        providerId: 'openai-web',
        retrieval: 'page',
      },
    ];
    const wire = (candidate: Candidate) => {
      const { evidenceId: _evidenceId, quote: _quote, inference, ...fields } = candidate;
      return {
        ...fields,
        passageId: sourcePassages(material)[0]!.id,
        inference: inference ? { rationale: inference.rationale, additionalPassageIds: [] } : null,
      };
    };
    const observed = {
      id: 'observed-count',
      attribute: 'employeeCount' as const,
      value: { min: 150, max: null },
      evidenceId: 'source',
      quote: 'Our workforce: 150+ employees.',
      asOf: null,
      inference: null,
    };
    stubResponse(() =>
      response(JSON.stringify({ ...extraction, candidates: [wire(observed)] }), {
        type: 'response.completed',
        response: { status: 'completed', usage },
      }),
    );
    const decoded = await provider.extract('firmographics', material, input);
    expect(decoded.candidates).toEqual([
      expect.objectContaining({ attribute: 'employeeCount', value: observed.value, quote: excerpt }),
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
      response(JSON.stringify({ ...extraction, candidates: [wire(inferred)] }), {
        type: 'response.completed',
        response: { status: 'completed', usage },
      }),
    );
    expect((await provider.extract('firmographics', material, input)).candidates).toEqual([
      { ...inferred, quote: excerpt },
    ]);
    stubResponse(() =>
      response(
        JSON.stringify({
          ...extraction,
          candidates: [wire({ ...observed, inference: inferred.inference } as unknown as Candidate)],
        }),
        {
          type: 'response.completed',
          response: { status: 'completed', usage },
        },
      ),
    );
    await expect(provider.extract('firmographics', material, input)).rejects.toMatchObject({
      code: 'provider_extraction_invalid',
    });
  });

  it('materializes_long_unicode_roster_and_tail_selectors_with_old_prompts_and_safe_failures', async () => {
    const input = await context();
    input.snapshot = structuredClone(input.snapshot);
    input.snapshot.config.prompts.version = 'source-extraction-v13';
    input.snapshot.config.prompts.extraction =
      'Copy exact evidenceId and quote from each excerpt. Keep employee estimates inferred with uncertainty.';
    const excerpt = 'Published team: ' + 'Member ação 🔒. '.repeat(700) + 'Additional unlisted employees may exist.';
    const evidence: Evidence[] = [
      {
        id: 'long-source',
        excerpt,
        digest: createHash('sha256').update(excerpt).digest('hex'),
        kind: 'website',
        source: 'https://example.com/team',
        title: 'Team',
        retrievedAt: input.snapshot.assessmentTime,
        publishedAt: null,
        providerId: 'openai-web',
        retrieval: 'page',
      },
    ];
    const passages = sourcePassages(evidence);
    const candidate = {
      id: 'estimate',
      attribute: 'employeeCount',
      value: { min: 20, max: 90 },
      asOf: null,
      passageId: passages[0]!.id,
      inference: {
        rationale:
          'The published team is a workforce cue; its completeness and unlisted staff are uncertain, so these bounds are working assumptions.',
        additionalPassageIds: [passages.at(-1)!.id],
      },
    };
    const provider = new OpenAIEvidenceProvider();
    const resultFor = (value: unknown) =>
      stubResponse(() =>
        response(JSON.stringify({ ...extraction, candidates: [value] }), {
          type: 'response.completed',
          response: { status: 'completed', usage },
        }),
      );
    resultFor(candidate);
    const result = await provider.extract('firmographics', evidence, input);
    expect(result.candidates[0]).toMatchObject({
      evidenceId: 'long-source',
      quote: passages[0]!.quote,
      inference: {
        rationale: candidate.inference.rationale,
        additionalPassages: [{ evidenceId: 'long-source', quote: passages.at(-1)!.quote }],
      },
    });
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
    const serializedInput = body.input as Array<{ role: string; content: Array<{ text: string }> }>;
    const data = JSON.parse(serializedInput.find(message => message.role === 'user')!.content[0]!.text);
    expect(data.evidence[0]).not.toHaveProperty('excerpt');
    expect(data.sourcePassages).toEqual(passages);
    expect(JSON.stringify(serializedInput.find(message => message.role !== 'user'))).toContain(
      'Citation transport for this request',
    );
    expect(body.max_output_tokens).toBe(2000);
    for (const [change, code] of [
      [{ passageId: `passage-${'0'.repeat(40)}` }, 'provider_passage_unknown'],
      [
        { inference: { ...candidate.inference, additionalPassageIds: [candidate.passageId] } },
        'provider_passage_duplicate',
      ],
    ] as const) {
      resultFor({ ...candidate, ...change });
      const failure = await provider.extract('firmographics', evidence, input).catch(error => error);
      expect(failure).toMatchObject({ code, retryable: false });
      expect(JSON.stringify(failure)).not.toContain('Member ação');
      expect(fetch).toHaveBeenCalledTimes(1);
    }
    expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(120);
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
      expect(fetch).toHaveBeenCalledTimes(1);
      expect((await input.store.get(input.runId))!.budget.searchCalls).toBe(1);
    }
  });

  it('retains_failed_response_status_and_settles_usage_without_misclassifying_the_payload_as_invalid_output', async () => {
    for (const status of ['failed', 'cancelled', 'queued', 'in_progress'] as const) {
      const input = await context();
      stubResponse(() =>
        response(
          '{"supportedCandidateIds":[],"intentCoverageComplete":false,"diagnostics":[{"invalid":"sensitive-marker"}]}',
          {
            type: status === 'failed' || status === 'cancelled' ? 'response.failed' : 'response.completed',
            response: { status, usage, error: { code: 'server_error', message: 'sensitive-marker' } },
          },
        ),
      );
      const failure = await new OpenAIEvidenceProvider().verify('firmographics', [], [], input).catch(error => error);
      expect(failure).toMatchObject({
        code: status === 'failed' || status === 'cancelled' ? 'provider_failed' : 'provider_response_incomplete',
        provider: { stage: 'verify', responseStatus: status, outputTokens: 40 },
      });
      expect((await input.store.get(input.runId))!.budget.outputTokens).toBe(40);
      expect(JSON.stringify(failure)).not.toContain('sensitive-marker');
    }
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
