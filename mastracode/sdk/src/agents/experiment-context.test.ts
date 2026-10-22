import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { MastraCodeState } from '../schema.js';
import {
  createExperimentControllerContext,
  createExperimentControllerContextMiddleware,
} from './experiment-context.js';
import { getDynamicInstructionSections } from './instructions.js';
import { getDynamicModel } from './model.js';

// The server's own controller state: the folder the Code Agent is allowed to work in.
const projectPath = mkdtempSync(path.join(tmpdir(), 'experiment-context-'));
const server = {
  controllerId: 'mastra-code',
  initialState: { projectPath, projectName: 'server-project', configDir: '.mastracode' } satisfies MastraCodeState,
  defaultModeId: 'build',
};

afterAll(() => rmSync(projectPath, { recursive: true, force: true }));

/** What the dataset experiment route hands the agent after our middleware ran. */
function hydrated(body: string): RequestContext {
  const requestContext = new RequestContext();
  const live = createExperimentControllerContext(JSON.parse(body), server);
  if (live) requestContext.set('controller', live);
  return requestContext;
}

describe('dataset experiment over HTTP against the Code Agent', () => {
  it('resolves the model and instructions from a JSON controller snapshot', async () => {
    // A JSON body cannot carry the live session's getState(); before the
    // adapter this crashed with "getState is not a function".
    const requestContext = hydrated('{"session":{"modelId":"openai/gpt-5.6"}}');

    const model = getDynamicModel({ requestContext }) as { id: string };
    expect(model.id).toBe('openai/gpt-5.6');

    const sections = await getDynamicInstructionSections({ requestContext });
    const prompt = sections.map(section => section.content).join('\n');
    expect(prompt).toContain(`Working directory: ${projectPath}`);
    expect(prompt).toContain('server-project');
  });

  it('fails closed when the snapshot selects no model', () => {
    expect(() => getDynamicModel({ requestContext: hydrated('{"session":{}}') })).toThrow('No model selected');
  });

  it('ignores a project path chosen by the caller', () => {
    const live = createExperimentControllerContext(
      { session: { modelId: 'openai/gpt-5.6' }, state: { projectPath: '/' } },
      server,
    );
    expect(live?.getState().projectPath).toBe(projectPath);
  });

  it('leaves a live session context untouched', () => {
    const liveSession = { getState: () => ({ projectPath: '/live' }), session: { modelId: 'openai/gpt-5.6' } };
    expect(createExperimentControllerContext(liveSession, server)).toBeUndefined();
    expect(createExperimentControllerContext('not an object', server)).toBeUndefined();
  });

  it('keeps state local to one run', async () => {
    const first = createExperimentControllerContext({ session: { modelId: 'openai/gpt-5.6' } }, server)!;
    const second = createExperimentControllerContext({ session: { modelId: 'openai/gpt-5.6' } }, server)!;

    await first.setState({ yolo: false });

    expect(first.getState().yolo).toBe(false);
    expect(second.getState().yolo).toBeUndefined();
    expect(server.initialState).not.toHaveProperty('yolo');
    expect(first.sessionId).not.toBe(second.sessionId);
  });
});

describe('experiment controller middleware', () => {
  /** Minimal Hono-style context: the adapter already stored the parsed `requestContext`. */
  function request(controller: unknown) {
    const requestContext = new RequestContext();
    requestContext.set('controller', controller);
    return { c: { get: (key: string) => (key === 'requestContext' ? requestContext : undefined) }, requestContext };
  }

  it('mounts under the configured api prefix', () => {
    expect(createExperimentControllerContextMiddleware(server).path).toBe('/api/datasets/*');
    expect(createExperimentControllerContextMiddleware({ ...server, apiPrefix: '/custom' }).path).toBe(
      '/custom/datasets/*',
    );
    expect(createExperimentControllerContextMiddleware({ ...server, apiPrefix: 'custom/' }).path).toBe(
      '/custom/datasets/*',
    );
    expect(createExperimentControllerContextMiddleware({ ...server, apiPrefix: '/' }).path).toBe('/datasets/*');
  });

  it('replaces a JSON snapshot with a live context and continues the request', async () => {
    const { handler } = createExperimentControllerContextMiddleware(server);
    const { c, requestContext } = request(JSON.parse('{"session":{"modelId":"openai/gpt-5.6"}}'));
    const next = vi.fn(async () => {});

    await handler(c as never, next);

    expect(next).toHaveBeenCalledOnce();
    const live = requestContext.get('controller') as { getState: () => MastraCodeState; session: { modelId: string } };
    expect(live.getState().projectPath).toBe(projectPath);
    expect(live.session.modelId).toBe('openai/gpt-5.6');
  });

  it('leaves a live context and a request without a controller alone', async () => {
    const { handler } = createExperimentControllerContextMiddleware(server);
    const liveSession = { getState: () => ({ projectPath: '/live' }), session: { modelId: 'openai/gpt-5.6' } };
    const { c, requestContext } = request(liveSession);
    await handler(c as never, async () => {});
    expect(requestContext.get('controller')).toBe(liveSession);

    const empty = new RequestContext();
    await handler({ get: () => empty } as never, async () => {});
    expect(empty.get('controller')).toBeUndefined();
  });
});
