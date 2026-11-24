import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { serve } from '@hono/node-server';
import { Mastra } from '@mastra/core/mastra';
import { MastraServer } from '@mastra/hono';
import { LibSQLStore } from '@mastra/libsql';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MastraEditor } from './index';

const AGENT = 'support-agent';
const TONE = 'tone';
const POLICY = 'refund-policy';
const TONE_V1 = 'Tone revision ONE: be formal.';
const TONE_V2 = 'Tone revision TWO: be friendly.';
const TONE_V3 = 'Tone revision THREE: be playful.';
const POLICY_TEXT = 'Refunds are available for 30 days.';
const MODEL = { provider: 'openai', name: 'gpt-4o-mini' };

/**
 * Prompt blocks use the same version tags as agents: a name in the prompt's `metadata.versionTags`
 * that points at one of its versions. These tests drive the two ways a tag is used, the way a user
 * does (real MastraEditor + LibSQL + Hono over a socket, model mocked at the wire):
 * fetching a prompt by tag, and running an agent whose referenced prompts follow a per-request tag.
 */
describe('prompt version tags', () => {
  let dir: string;
  let llm: LLMock;
  let url: string;
  let close: () => Promise<void>;
  const toneVersions: Record<'v1' | 'v2' | 'v3', string> = { v1: '', v2: '', v3: '' };
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

  const setTags = (promptId: string, versionTags: Record<string, string>) =>
    http('PATCH', `/stored/prompt-blocks/${promptId}`, { metadata: { versionTags } });

  const listVersions = async (promptId: string) => {
    const result = await http('GET', `/stored/prompt-blocks/${promptId}/versions?perPage=100&orderBy[direction]=ASC`);
    expect(result.status, result.text).toBe(200);
    return result.json.versions as { id: string; versionNumber: number }[];
  };

  const createPrompt = async (id: string, content: string) => {
    const created = await http('POST', '/stored/prompt-blocks', { id, name: id, content });
    expect(created.status, created.text).toBe(200);
  };

  const publish = async (promptId: string, versionId: string) => {
    const result = await http('POST', `/stored/prompt-blocks/${promptId}/versions/${versionId}/activate`);
    expect(result.status, result.text).toBe(200);
  };

  /** Calls the agent and returns what the model was sent, so the test can see which prompt text ran. */
  async function generateAndCaptureModelInput(requestContext?: Record<string, unknown>) {
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const result = await http('POST', `/agents/${AGENT}/generate`, {
      messages: 'hi',
      ...(requestContext ? { requestContext } : {}),
    });
    expect(result.status, result.text).toBe(200);
    return JSON.stringify(llm.getRequests().map(request => request.body));
  }

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
    process.env.OPENAI_BASE_URL = `${llm.url.replace(/\/+$/, '')}/v1`;
    process.env.OPENAI_API_KEY = 'aimock-test-key';

    dir = await mkdtemp(join(tmpdir(), 'prompt-version-tags-'));
    const storage = new LibSQLStore({ id: 'prompt-version-tags', url: `file:${join(dir, 'mastra.db')}` });
    const mastra = new Mastra({ logger: false, storage, editor: new MastraEditor() });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    const server = serve({ fetch: app.fetch, port: 0 });
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no address');
    url = `http://localhost:${address.port}`;
    close = () => new Promise<void>(resolve => server.close(() => resolve()));

    // The tone prompt has three versions: v2 is published, v3 is the latest draft, v1 is older.
    await createPrompt(TONE, TONE_V1);
    for (const content of [TONE_V2, TONE_V3]) {
      const saved = await http('PATCH', `/stored/prompt-blocks/${TONE}`, { content });
      expect(saved.status, saved.text).toBe(200);
    }
    const versions = await listVersions(TONE);
    expect(versions.map(version => version.versionNumber)).toEqual([1, 2, 3]);
    [toneVersions.v1, toneVersions.v2, toneVersions.v3] = versions.map(version => version.id);
    await publish(TONE, toneVersions.v2);

    // A second published prompt that is never tagged.
    await createPrompt(POLICY, POLICY_TEXT);
    await publish(POLICY, (await listVersions(POLICY))[0]!.id);

    const agent = await http('POST', '/stored/agents', {
      id: AGENT,
      name: AGENT,
      model: MODEL,
      instructions: [
        { type: 'text', content: 'You are the support agent.' },
        { type: 'prompt_block_ref', id: TONE },
        { type: 'prompt_block_ref', id: POLICY },
      ],
    });
    expect(agent.status, agent.text).toBe(200);
  });

  afterEach(async () => {
    llm.clearFixtures();
    llm.clearRequests();
    // Each test starts from untagged prompts.
    await setTags(TONE, {});
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

  describe('fetching a prompt by tag', () => {
    it('returns the tagged version, while a plain fetch stays on the published one', async () => {
      expect((await setTags(TONE, { production: toneVersions.v1 })).status).toBe(200);

      const tagged = await http('GET', `/stored/prompt-blocks/${TONE}?tag=production`);
      expect(tagged.status, tagged.text).toBe(200);
      expect(tagged.json.content).toBe(TONE_V1);

      const published = await http('GET', `/stored/prompt-blocks/${TONE}`);
      expect(published.json.content).toBe(TONE_V2);
    });

    it('follows the tag when it is moved to another version', async () => {
      await setTags(TONE, { production: toneVersions.v1 });
      await setTags(TONE, { production: toneVersions.v3 });

      const tagged = await http('GET', `/stored/prompt-blocks/${TONE}?tag=production`);
      expect(tagged.json.content).toBe(TONE_V3);
    });

    it('treats the reserved "draft" and "published" names like the matching status', async () => {
      const draft = await http('GET', `/stored/prompt-blocks/${TONE}?tag=draft`);
      expect(draft.status, draft.text).toBe(200);
      expect(draft.json.content).toBe(TONE_V3);

      const published = await http('GET', `/stored/prompt-blocks/${TONE}?tag=published`);
      expect(published.json.content).toBe(TONE_V2);
    });

    it('answers 404 for a tag the prompt does not have', async () => {
      const missing = await http('GET', `/stored/prompt-blocks/${TONE}?tag=nope`);
      expect(missing.status).toBe(404);
      expect(missing.json.error).toContain('Version tag "nope" not found');
    });
  });

  describe('running an agent with a prompt tag', () => {
    it('renders the tagged version of a referenced prompt', async () => {
      await setTags(TONE, { production: toneVersions.v1 });

      const modelInput = await generateAndCaptureModelInput({ promptVersionTag: 'production' });
      expect(modelInput).toContain(TONE_V1);
      expect(modelInput).not.toContain(TONE_V2);
    });

    it('keeps calls without the tag on the published version', async () => {
      await setTags(TONE, { production: toneVersions.v1 });

      const modelInput = await generateAndCaptureModelInput();
      expect(modelInput).toContain(TONE_V2);
      expect(modelInput).not.toContain(TONE_V1);
    });

    it('uses the published version of a referenced prompt that does not have the tag', async () => {
      await setTags(TONE, { production: toneVersions.v1 });

      const modelInput = await generateAndCaptureModelInput({ promptVersionTag: 'production' });
      expect(modelInput).toContain(POLICY_TEXT);
    });

    it('follows the tag when it is moved', async () => {
      await setTags(TONE, { production: toneVersions.v1 });
      await setTags(TONE, { production: toneVersions.v3 });

      const modelInput = await generateAndCaptureModelInput({ promptVersionTag: 'production' });
      expect(modelInput).toContain(TONE_V3);
      expect(modelInput).not.toContain(TONE_V1);
    });

    it('falls back to published versions when no referenced prompt has the tag', async () => {
      const modelInput = await generateAndCaptureModelInput({ promptVersionTag: 'nope' });
      expect(modelInput).toContain(TONE_V2);
      expect(modelInput).toContain(POLICY_TEXT);
    });

    it('does not let the reserved "draft" name pull a draft prompt version into a run', async () => {
      const modelInput = await generateAndCaptureModelInput({ promptVersionTag: 'draft' });
      expect(modelInput).toContain(TONE_V2);
      expect(modelInput).not.toContain(TONE_V3);
    });
  });

  describe('setting tags on a prompt', () => {
    it('keeps other metadata and does not create a version', async () => {
      await http('PATCH', `/stored/prompt-blocks/${TONE}`, { metadata: { owner: 'support-team' } });

      const tagged = await setTags(TONE, { production: toneVersions.v1 });
      expect(tagged.status, tagged.text).toBe(200);
      expect(tagged.json.metadata.owner).toBe('support-team');
      expect(tagged.json.metadata.versionTags).toEqual({ production: toneVersions.v1 });
      expect((await listVersions(TONE)).map(version => version.versionNumber)).toEqual([1, 2, 3]);
    });

    it('rejects a reserved tag name', async () => {
      const result = await setTags(TONE, { published: toneVersions.v1 });
      expect(result.status).toBe(400);
      expect(result.text).toContain('reserved');
    });

    it('rejects a tag that points at another prompt’s version', async () => {
      const [policyVersion] = await listVersions(POLICY);

      const result = await setTags(TONE, { production: policyVersion!.id });
      expect(result.status).toBe(400);
      expect(result.json.error).toContain('Cannot set version tag "production"');
    });

    it('rejects tags in the request that creates a prompt', async () => {
      const result = await http('POST', '/stored/prompt-blocks', {
        id: 'brand-new',
        name: 'brand-new',
        content: 'hello',
        metadata: { versionTags: { production: toneVersions.v1 } },
      });
      expect(result.status).toBe(400);
      expect(result.json.error).toContain('cannot be set when creating');
    });
  });

  describe('keeping tagged versions', () => {
    it('refuses to delete a tagged version until the tag is removed', async () => {
      await setTags(TONE, { production: toneVersions.v1 });

      const refused = await http('DELETE', `/stored/prompt-blocks/${TONE}/versions/${toneVersions.v1}`);
      expect(refused.status).toBe(400);
      expect(refused.json.error).toContain('Cannot delete a tagged version');
      expect((await listVersions(TONE)).map(version => version.id)).toContain(toneVersions.v1);
    });

    // Version history is capped (50 per prompt) by pruning the oldest versions on save. A long-lived
    // "production" tag is exactly the kind of old version that would otherwise be pruned.
    it('survives version-history pruning, while untagged old versions are removed', async () => {
      const promptId = 'busy-prompt';
      await createPrompt(promptId, 'revision 1');
      await publish(promptId, (await listVersions(promptId))[0]!.id);
      await http('PATCH', `/stored/prompt-blocks/${promptId}`, { content: 'revision 2' });
      await http('PATCH', `/stored/prompt-blocks/${promptId}`, { content: 'revision 3' });
      const [, second, third] = await listVersions(promptId);
      // v1 is published; tag v2 and leave v3 unprotected.
      expect((await setTags(promptId, { production: second!.id })).status).toBe(200);

      for (let revision = 4; revision <= 56; revision++) {
        const saved = await http('PATCH', `/stored/prompt-blocks/${promptId}`, { content: `revision ${revision}` });
        expect(saved.status, saved.text).toBe(200);
      }

      const remaining = (await listVersions(promptId)).map(version => version.id);
      expect(remaining).toContain(second!.id);
      expect(remaining).not.toContain(third!.id);

      const tagged = await http('GET', `/stored/prompt-blocks/${promptId}?tag=production`);
      expect(tagged.status, tagged.text).toBe(200);
      expect(tagged.json.content).toBe('revision 2');
    }, 60_000);
  });
});
