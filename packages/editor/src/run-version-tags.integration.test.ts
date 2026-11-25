import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { TracingEvent } from '@mastra/core/observability';
import { MastraServer } from '@mastra/hono';
import { LibSQLStore } from '@mastra/libsql';
import { BaseExporter, Observability } from '@mastra/observability';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { MastraEditor } from './index';

const SUPPORT = 'support-agent';
const BILLING = 'billing-agent';
const TONE = 'tone';
const POLICY = 'refund-policy';
const SUPPORT_V1 = 'Support agent revision ONE.';
const SUPPORT_V2 = 'Support agent revision TWO.';
const BILLING_V1 = 'Billing agent revision ONE.';
const BILLING_V2 = 'Billing agent revision TWO.';
const TONE_V1 = 'Tone revision ONE: be formal.';
const TONE_V2 = 'Tone revision TWO: be friendly.';
const TONE_V3 = 'Tone revision THREE: be playful.';
const POLICY_TEXT = 'Refunds are available for 30 days.';
const MODEL = { provider: 'openai', name: 'gpt-4o-mini' };

type AgentRunSpan = { entityId?: string; metadata: Record<string, unknown> };

/** Keeps every finished agent run span, the way a tracing backend would receive it. */
class AgentRunSpans extends BaseExporter {
  name = 'agent-run-spans';
  spans: AgentRunSpan[] = [];

  constructor() {
    super({});
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (event.type !== 'span_ended' || event.exportedSpan.type !== 'agent_run') return;
    const span = event.exportedSpan;
    this.spans.push({ entityId: span.entityId, metadata: (span.metadata ?? {}) as Record<string, unknown> });
  }

  async shutdown(): Promise<void> {}
}

const toolNames = (request: ChatCompletionRequest) => (request.tools ?? []).map(tool => tool.function?.name);
const isSupport = (request: ChatCompletionRequest) => toolNames(request).includes(`agent-${BILLING}`);
const lastIsToolResult = (request: ChatCompletionRequest) => request.messages.at(-1)?.role === 'tool';

/**
 * A team tags a release ("production") across a supervisor, its sub-agent and the prompts they
 * reference, then calls the supervisor by that tag. These tests check that one tag selects the whole
 * run, that a mistyped prompt tag is refused, and that traces say which versions answered. Real
 * MastraEditor + LibSQL + Hono over a socket + tracing, with the model mocked at the wire.
 */
describe('running an agent by version tag', () => {
  let dir: string;
  let llm: LLMock;
  let url: string;
  let close: () => Promise<void>;
  const traces = new AgentRunSpans();
  const versions = {
    support: { v1: '', v2: '' },
    billing: { v1: '', v2: '' },
    tone: { v1: '', v2: '', v3: '' },
    policy: { v1: '' },
  };
  const previousBaseUrl = process.env.OPENAI_BASE_URL;
  const previousKey = process.env.OPENAI_API_KEY;

  async function http(method: string, path: string, body?: unknown) {
    const response = await fetch(`${url}/api${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: response.status, text, json };
  }

  const ok = async (method: string, path: string, body?: unknown) => {
    const result = await http(method, path, body);
    expect(result.status, result.text).toBe(200);
    return result;
  };

  const tagAgent = (agentId: string, versionTags: Record<string, string>) =>
    ok('PATCH', `/stored/agents/${agentId}`, { metadata: { versionTags } });
  const tagPrompt = (promptId: string, versionTags: Record<string, string>) =>
    ok('PATCH', `/stored/prompt-blocks/${promptId}`, { metadata: { versionTags } });

  const versionIds = async (kind: 'agents' | 'prompt-blocks', id: string) => {
    const result = await ok('GET', `/stored/${kind}/${id}/versions?perPage=100&orderBy[direction]=ASC`);
    return (result.json.versions as { id: string }[]).map(version => version.id);
  };

  /** Calls the support agent. With `delegate`, the mocked model hands the question to the billing agent. */
  async function callSupport(requestContext?: Record<string, unknown>, { delegate = false } = {}) {
    if (delegate) {
      llm.on(
        { endpoint: 'chat', predicate: request => isSupport(request) && !lastIsToolResult(request) },
        { toolCalls: [{ id: 'call-1', name: `agent-${BILLING}`, arguments: { prompt: 'What is my balance?' } }] },
      );
      llm.on({ endpoint: 'chat', predicate: request => !isSupport(request) }, { content: 'Your balance is zero.' });
    }
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const result = await http('POST', `/agents/${SUPPORT}/generate`, {
      messages: 'hi',
      ...(requestContext ? { requestContext } : {}),
    });
    const requests = llm.getRequests().map(request => request.body as ChatCompletionRequest);
    return {
      result,
      supportInput: JSON.stringify(requests.filter(isSupport)),
      billingInput: JSON.stringify(requests.filter(request => !isSupport(request))),
    };
  }

  const spanFor = (agentId: string) =>
    vi.waitFor(() => {
      const span = traces.spans.find(candidate => candidate.entityId === agentId);
      expect(span, `no finished agent run span for ${agentId}`).toBeDefined();
      return span!;
    });

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
    process.env.OPENAI_BASE_URL = `${llm.url.replace(/\/+$/, '')}/v1`;
    process.env.OPENAI_API_KEY = 'aimock-test-key';

    dir = await mkdtemp(join(tmpdir(), 'run-version-tags-'));
    const mastra = new Mastra({
      logger: false,
      storage: new LibSQLStore({ id: 'run-version-tags', url: `file:${join(dir, 'mastra.db')}` }),
      editor: new MastraEditor(),
      // The billing agent is defined in code; the versions saved for it below override its instructions.
      agents: {
        [BILLING]: new Agent({
          id: BILLING,
          name: BILLING,
          description: 'Answers billing questions',
          instructions: 'Billing agent as defined in code.',
          model: 'openai/gpt-4o-mini',
        }),
      },
      observability: new Observability({
        configs: { default: { serviceName: 'run-version-tags', exporters: [traces] } },
      }),
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    const server = serve({ fetch: app.fetch, port: 0 });
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no address');
    url = `http://localhost:${address.port}`;
    close = () => new Promise<void>(resolve => server.close(() => resolve()));

    // Tone: v2 is published, v3 is the latest draft, v1 is older. The policy prompt is never tagged.
    await ok('POST', '/stored/prompt-blocks', { id: TONE, name: TONE, content: TONE_V1 });
    await ok('PATCH', `/stored/prompt-blocks/${TONE}`, { content: TONE_V2 });
    await ok('PATCH', `/stored/prompt-blocks/${TONE}`, { content: TONE_V3 });
    [versions.tone.v1, versions.tone.v2, versions.tone.v3] = await versionIds('prompt-blocks', TONE);
    await ok('POST', `/stored/prompt-blocks/${TONE}/versions/${versions.tone.v2}/activate`);
    await ok('POST', '/stored/prompt-blocks', { id: POLICY, name: POLICY, content: POLICY_TEXT });
    [versions.policy.v1] = await versionIds('prompt-blocks', POLICY);
    await ok('POST', `/stored/prompt-blocks/${POLICY}/versions/${versions.policy.v1}/activate`);

    // Both agents have an older v1 and a published v2.
    await ok('POST', '/stored/agents', {
      id: BILLING,
      name: BILLING,
      description: 'Answers billing questions',
      model: MODEL,
      instructions: BILLING_V1,
    });
    await ok('PATCH', `/stored/agents/${BILLING}`, { instructions: BILLING_V2 });
    [versions.billing.v1, versions.billing.v2] = await versionIds('agents', BILLING);
    await ok('POST', `/stored/agents/${BILLING}/versions/${versions.billing.v2}/activate`);

    const supportInstructions = (text: string) => [
      { type: 'text', content: text },
      { type: 'prompt_block_ref', id: TONE },
      { type: 'prompt_block_ref', id: POLICY },
    ];
    await ok('POST', '/stored/agents', {
      id: SUPPORT,
      name: SUPPORT,
      model: MODEL,
      instructions: supportInstructions(SUPPORT_V1),
      agents: { [BILLING]: {} },
    });
    await ok('PATCH', `/stored/agents/${SUPPORT}`, { instructions: supportInstructions(SUPPORT_V2) });
    [versions.support.v1, versions.support.v2] = await versionIds('agents', SUPPORT);
    await ok('POST', `/stored/agents/${SUPPORT}/versions/${versions.support.v2}/activate`);
  });

  afterEach(async () => {
    llm.clearFixtures();
    llm.clearRequests();
    traces.spans = [];
    await tagAgent(SUPPORT, {});
    await tagAgent(BILLING, {});
    await tagPrompt(TONE, {});
  });

  afterAll(async () => {
    await close?.();
    await llm?.stop();
    await rm(dir, { recursive: true, force: true });
    if (previousBaseUrl === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = previousBaseUrl;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });

  describe('when only the agent tag is sent', () => {
    it('also selects the tagged version of the prompts the agent references', async () => {
      await tagAgent(SUPPORT, { production: versions.support.v1 });
      await tagPrompt(TONE, { production: versions.tone.v1 });

      const { result, supportInput } = await callSupport({ agentVersionTag: 'production' });

      expect(result.status, result.text).toBe(200);
      expect(supportInput).toContain(SUPPORT_V1);
      expect(supportInput).toContain(TONE_V1);
      expect(supportInput).not.toContain(TONE_V2);
    });

    it('keeps the tagged agent on published prompts that do not have the tag', async () => {
      await tagAgent(SUPPORT, { production: versions.support.v1 });

      const { result, supportInput } = await callSupport({ agentVersionTag: 'production' });

      expect(result.status, result.text).toBe(200);
      expect(supportInput).toContain(SUPPORT_V1);
      expect(supportInput).toContain(TONE_V2);
      expect(supportInput).toContain(POLICY_TEXT);
    });
  });

  describe('when a prompt tag is sent with the agent tag', () => {
    it('uses the prompt tag for the prompts', async () => {
      await tagAgent(SUPPORT, { production: versions.support.v1 });
      await tagPrompt(TONE, { production: versions.tone.v1, canary: versions.tone.v3 });

      const { supportInput } = await callSupport({ agentVersionTag: 'production', promptVersionTag: 'canary' });

      expect(supportInput).toContain(SUPPORT_V1);
      expect(supportInput).toContain(TONE_V3);
      expect(supportInput).not.toContain(TONE_V1);
    });
  });

  describe('when the prompt tag is on none of the prompts the agent uses', () => {
    it('answers 404 without calling the model', async () => {
      await tagPrompt(TONE, { production: versions.tone.v1 });

      const { result } = await callSupport({ promptVersionTag: 'prodution' });

      expect(result.status).toBe(404);
      expect(result.json.error).toContain('Version tag "prodution" not found on any prompt block');
      expect(llm.getRequests()).toHaveLength(0);
    });
  });

  describe('when the prompt tag is on some of the prompts the agent uses', () => {
    it('runs, with the untagged prompts on their published version', async () => {
      await tagPrompt(TONE, { production: versions.tone.v1 });

      const { result, supportInput } = await callSupport({ promptVersionTag: 'production' });

      expect(result.status, result.text).toBe(200);
      expect(supportInput).toContain(TONE_V1);
      expect(supportInput).toContain(POLICY_TEXT);
    });
  });

  describe('when a tagged agent hands work to a sub-agent', () => {
    it('runs the sub-agent version that has the same tag', async () => {
      await tagAgent(SUPPORT, { production: versions.support.v1 });
      await tagAgent(BILLING, { production: versions.billing.v1 });

      const { result, billingInput } = await callSupport({ agentVersionTag: 'production' }, { delegate: true });

      expect(result.status, result.text).toBe(200);
      expect(billingInput).toContain(BILLING_V1);
      expect(billingInput).not.toContain(BILLING_V2);
    });

    it('runs the published version of a sub-agent that does not have the tag', async () => {
      await tagAgent(SUPPORT, { production: versions.support.v1 });

      const { result, billingInput } = await callSupport({ agentVersionTag: 'production' }, { delegate: true });

      expect(result.status, result.text).toBe(200);
      expect(billingInput).toContain(BILLING_V2);
    });

    it('lets the request name another version for the sub-agent', async () => {
      await tagAgent(SUPPORT, { production: versions.support.v1 });
      await tagAgent(BILLING, { production: versions.billing.v1 });
      llm.on(
        { endpoint: 'chat', predicate: request => isSupport(request) && !lastIsToolResult(request) },
        { toolCalls: [{ id: 'call-1', name: `agent-${BILLING}`, arguments: { prompt: 'What is my balance?' } }] },
      );
      llm.on({ endpoint: 'chat' }, { content: 'ok' });

      const result = await http('POST', `/agents/${SUPPORT}/generate`, {
        messages: 'hi',
        requestContext: { agentVersionTag: 'production' },
        versions: { agents: { [BILLING]: { versionId: versions.billing.v2 } } },
      });

      expect(result.status, result.text).toBe(200);
      const billingInput = JSON.stringify(
        llm
          .getRequests()
          .map(request => request.body as ChatCompletionRequest)
          .filter(request => !isSupport(request)),
      );
      expect(billingInput).toContain(BILLING_V2);
      expect(billingInput).not.toContain(BILLING_V1);
    });
  });

  describe('the trace of a tagged run', () => {
    it('names the tag and the agent and prompt versions that answered', async () => {
      await tagAgent(SUPPORT, { production: versions.support.v1 });
      await tagAgent(BILLING, { production: versions.billing.v1 });
      await tagPrompt(TONE, { production: versions.tone.v1 });

      await callSupport({ agentVersionTag: 'production' }, { delegate: true });

      expect((await spanFor(SUPPORT)).metadata).toMatchObject({
        entityVersionId: versions.support.v1,
        versionTag: 'production',
        promptVersionTag: 'production',
        promptBlockVersions: { [TONE]: versions.tone.v1, [POLICY]: versions.policy.v1 },
        promptBlocksWithoutTag: [POLICY],
      });
      expect((await spanFor(BILLING)).metadata).toMatchObject({
        entityVersionId: versions.billing.v1,
        versionTag: 'production',
      });
    });
  });

  describe('the trace of an untagged run', () => {
    it('names the published prompt versions and no tag', async () => {
      await callSupport();

      const { metadata } = await spanFor(SUPPORT);
      expect(metadata.promptBlockVersions).toEqual({ [TONE]: versions.tone.v2, [POLICY]: versions.policy.v1 });
      expect(metadata).not.toHaveProperty('versionTag');
      expect(metadata).not.toHaveProperty('promptVersionTag');
      expect(metadata).not.toHaveProperty('promptBlocksWithoutTag');
    });
  });
});
