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
