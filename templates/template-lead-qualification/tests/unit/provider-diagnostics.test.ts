import { describe, expect, it } from 'vitest';
import { ProviderDiagnostics } from '../support/provider-diagnostics';

describe('safe live diagnostics', () => {
  it('preserves_failure_status_usage_and_source_domains_without_raw_content', async () => {
    const diagnostic = new ProviderDiagnostics(1, 1500, true, false);
    const events = [
      {
        type: 'response.output_item.done',
        item: {
          type: 'web_search_call',
          id: 'ws_completed',
          status: 'completed',
          action: {
            type: 'search',
            sources: [{ type: 'url', url: 'https://mastra.ai/private-path?token=sensitive-marker' }],
          },
        },
      },
      {
        type: 'response.output_item.done',
        item: { type: 'web_search_call', id: 'ws_incomplete', status: 'incomplete', action: { type: 'search' } },
      },
      {
        type: 'response.failed',
        response: {
          status: 'failed',
          incomplete_details: { reason: 'max_output_tokens' },
          error: { code: 'invalid_json_schema', message: 'sensitive-marker' },
          usage: { input_tokens: 20, output_tokens: 10, output_tokens_details: { reasoning_tokens: 5 } },
          output: [{ type: 'message', content: [{ text: 'sensitive-marker' }] }],
        },
      },
    ];
    await diagnostic.capture(
      new Response(events.map(value => `data: ${JSON.stringify(value)}\n\n`).join(''), {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    expect(diagnostic.summary()).toMatchObject({
      httpStatus: 200,
      completedCount: 1,
      responseStatus: 'failed',
      finishReason: 'failed',
      incompleteReason: 'max_output_tokens',
      errorCode: 'invalid_json_schema',
      inputTokens: 20,
      outputTokens: 10,
      reasoningTokens: 5,
      urlCount: 1,
      sourceDomains: ['mastra.ai'],
      captureFailure: null,
    });
    expect(diagnostic.summary().calls).toEqual([
      { id: 'ws_completed', statuses: ['completed'] },
      { id: 'ws_incomplete', statuses: ['incomplete'] },
    ]);
    expect(JSON.stringify(diagnostic.summary())).not.toContain('sensitive-marker');
    expect(JSON.stringify(diagnostic.summary())).not.toContain('private-path');
  });

  it('retains_http_error_codes_and_bounds_malformed_provider_events', async () => {
    const http = new ProviderDiagnostics(1, 1500, true, false);
    await http.capture(
      new Response(JSON.stringify({ error: { code: 'invalid_json_schema', message: 'sensitive-marker' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(http.summary()).toMatchObject({ httpStatus: 400, errorCode: 'invalid_json_schema', outputTokens: null });
    expect(JSON.stringify(http.summary())).not.toContain('sensitive-marker');
    const bounded = new ProviderDiagnostics(1, 1500, true, false);
    await bounded.capture(new Response(`data: ${'x'.repeat(65_537)}`));
    expect(bounded.summary().captureFailure).toBe('provider_metadata_capture_failed');
  });
});

describe('SSE framing bounds', () => {
  async function capture(chunks: Uint8Array[], json = false) {
    const diagnostic = new ProviderDiagnostics(1, 1500, true, false);
    await diagnostic.capture(
      new Response(
        new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.close();
          },
        }),
        { headers: { 'content-type': json ? 'application/json' : 'text/event-stream' } },
      ),
    );
    return diagnostic.summary();
  }
  const encode = (text: string) => new TextEncoder().encode(text);
  it('parses_identical_large_coalesced_framed_and_arbitrarily_split_crlf_utf8_streams', async () => {
    const frames = Array.from(
      { length: 80 },
      () =>
        `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'private-🔒-ação'.repeat(80) })}\r\n\r\n`,
    );
    frames.push(
      `data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', usage: { input_tokens: 9, output_tokens: 4 } } })}\r\n\r\n`,
    );
    const bytes = encode(frames.join(''));
    expect(bytes.length).toBeGreaterThan(65_536);
    const arbitrary: Uint8Array[] = [];
    for (let offset = 0; offset < bytes.length;) {
      const size = [1, 7, 103, 509][offset % 4]!;
      arbitrary.push(bytes.slice(offset, offset + size));
      offset += size;
    }
    const summaries = await Promise.all([[bytes], frames.map(encode), arbitrary].map(chunks => capture(chunks)));
    expect(summaries[0]).toMatchObject({
      captureFailure: null,
      responseStatus: 'completed',
      inputTokens: 9,
      outputTokens: 4,
    });
    expect(summaries[1]).toEqual(summaries[0]);
    expect(summaries[2]).toEqual(summaries[0]);
    expect(JSON.stringify(summaries)).not.toContain('private');
  });
  it.each(['\n\n', '\r\n\r\n'])('preserves_the_exact_event_limit_at_every_%j_delimiter_split', async delimiter => {
    const event = (length: number) => {
      const prefix = 'data: ';
      const value = {
        type: 'response.completed',
        response: { status: 'completed', usage: { input_tokens: 9, output_tokens: 4 } },
        padding: 'private-boundary-marker',
      };
      const overhead = prefix.length + JSON.stringify(value).length;
      return prefix + JSON.stringify({ ...value, padding: value.padding + 'x'.repeat(length - overhead) });
    };
    for (const length of [65_536, 65_537]) {
      const content = event(length);
      expect(content.length).toBe(length);
      const baseline = await capture([encode(content + delimiter)]);
      expect(baseline.captureFailure).toBe(length === 65_536 ? null : 'provider_metadata_capture_failed');
      for (let split = 0; split <= delimiter.length; split++) {
        const result = await capture([encode(content + delimiter.slice(0, split)), encode(delimiter.slice(split))]);
        expect(result).toEqual(baseline);
        expect(JSON.stringify(result)).not.toContain('private-boundary-marker');
      }
    }
  });
  it('rejects_malformed_and_truncated_utf8_without_content', async () => {
    for (const bytes of [new Uint8Array([0xc3, 0x28]), new Uint8Array([0xf0, 0x9f, 0x94])]) {
      const result = await capture([encode('data: {"private":"'), bytes]);
      expect(result.captureFailure).toBe('provider_metadata_capture_failed');
      expect(JSON.stringify(result)).not.toContain('private');
    }
  });
  it.each([
    ['complete event', `data: ${JSON.stringify({ delta: 'x'.repeat(65_536) })}\n\n`, false],
    ['incomplete event', `data: ${'x'.repeat(65_537)}`, false],
    ['unframed content', 'x'.repeat(65_537), false],
    ['aggregate', `data: ${JSON.stringify({ delta: 'x'.repeat(2000) })}\n\n`.repeat(530), false],
    ['JSON', JSON.stringify({ text: 'x'.repeat(65_536) }), true],
    ['malformed event', 'data: {invalid-private}\n\n', false],
    ['malformed JSON', '{invalid-private}', true],
    ['unterminated event', 'data: {"private":true}', false],
    ['complete oversized ignored event', 'x'.repeat(65_537) + '\n\n', false],
  ])('rejects_oversized_or_invalid_%s_without_raw_content', async (_name, text, json) => {
    const result = await capture([encode(text as string)], json as boolean);
    expect(result.captureFailure).toBe('provider_metadata_capture_failed');
    expect(JSON.stringify(result)).not.toContain('private');
  });
});
