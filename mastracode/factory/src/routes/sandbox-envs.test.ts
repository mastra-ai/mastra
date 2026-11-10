import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { cachedSandboxEnvRevision } from '../sandbox/sandbox-env.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { SandboxEnvRoutes } from './sandbox-envs.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const SENTINEL = 'sentinel-value-7f3a';

async function setup(options: { writable?: boolean; audit?: AuditEmitter; enabled?: boolean } = {}) {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
  const other = await seed.projects.create({ orgId: 'org-2', userId: 'user-2', input: { name: 'Other' } });
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    new SandboxEnvRoutes({
      auth: fakeRouteAuth({ enabled: options.enabled ?? true }),
      projects: seed.projects,
      sandboxEnvs: seed.sandboxEnvs,
      writable: options.writable ?? true,
      ...(options.audit ? { audit: options.audit } : {}),
    }).routes(),
  );
  const base = `/web/factory/projects/${project.id}/sandbox-envs`;
  const send = (method: string, path: string, body?: unknown) =>
    app.request(`${base}${path}`, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
  return { seed, project, other, app, base, send };
}

describe('SandboxEnvRoutes', () => {
  it('sets, lists, updates and deletes a variable without ever returning its value', async () => {
    const audit = { emit: vi.fn(async () => {}) };
    const { seed, project, send } = await setup({ audit });

    const put = await send('PUT', '/NPM_TOKEN', { value: SENTINEL, appliesTo: 'runtime' });
    expect(put.status).toBe(200);
    const putText = await put.text();
    expect(JSON.parse(putText)).toMatchObject({
      env: { name: 'NPM_TOKEN', appliesTo: 'runtime', updatedBy: 'user-1' },
    });

    const list = await send('GET', '');
    expect(list.status).toBe(200);
    const listText = await list.text();
    expect(JSON.parse(listText)).toEqual({
      envs: [{ name: 'NPM_TOKEN', appliesTo: 'runtime', updatedAt: expect.any(String), updatedBy: 'user-1' }],
      writable: true,
    });

    const patch = await send('PATCH', '/NPM_TOKEN', { appliesTo: 'both' });
    expect(patch.status).toBe(200);
    const patchText = await patch.text();
    expect(JSON.parse(patchText)).toMatchObject({ env: { name: 'NPM_TOKEN', appliesTo: 'both' } });

    for (const text of [putText, listText, patchText]) {
      expect(text).not.toContain(SENTINEL);
      expect(text).not.toContain('"value"');
    }
    expect((await seed.sandboxEnvs.resolve('org-1', project.id)).build).toEqual({ NPM_TOKEN: SENTINEL });

    const del = await send('DELETE', '/NPM_TOKEN');
    expect(del.status).toBe(204);
    expect(await seed.sandboxEnvs.list('org-1', project.id)).toEqual([]);
    for (const missing of [
      await send('DELETE', '/NPM_TOKEN'),
      await send('PATCH', '/NPM_TOKEN', { appliesTo: 'build' }),
    ]) {
      expect(missing.status).toBe(404);
      expect(await missing.json()).toEqual({ error: 'Variable not found', message: 'Variable not found.' });
    }

    expect(audit.emit.mock.calls.map(([args]) => args.input)).toEqual([
      {
        action: 'factory.sandbox_env.set',
        factoryProjectId: project.id,
        targets: [{ type: 'sandbox_env', id: 'NPM_TOKEN', name: 'NPM_TOKEN' }],
        metadata: { appliesTo: 'runtime' },
      },
      {
        action: 'factory.sandbox_env.updated',
        factoryProjectId: project.id,
        targets: [{ type: 'sandbox_env', id: 'NPM_TOKEN', name: 'NPM_TOKEN' }],
        metadata: { appliesTo: 'both' },
      },
      {
        action: 'factory.sandbox_env.deleted',
        factoryProjectId: project.id,
        targets: [{ type: 'sandbox_env', id: 'NPM_TOKEN', name: 'NPM_TOKEN' }],
      },
    ]);
    expect(JSON.stringify(audit.emit.mock.calls)).not.toContain(SENTINEL);
  });

  it('marks every response no-store, including errors', async () => {
    const { send, app } = await setup();
    for (const response of [
      await send('GET', ''),
      await send('PUT', '/A', { value: 'x', appliesTo: 'build' }),
      await send('PATCH', '/A', { appliesTo: 'runtime' }),
      await send('DELETE', '/A'),
      await send('PUT', '/GH_TOKEN', { value: 'x', appliesTo: 'build' }),
      await app.request('/web/factory/projects/not-a-uuid/sandbox-envs'),
    ]) {
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('rejects invalid and reserved names, naming the variable', async () => {
    const { send } = await setup();
    for (const name of ['1ABC', 'HAS-DASH', 'A'.repeat(129)]) {
      expect((await send('PUT', `/${name}`, { value: 'x', appliesTo: 'runtime' })).status).toBe(400);
    }
    for (const name of [
      'GH_TOKEN',
      'GH_TOKEN_2',
      'MASTRA_REPOSITORY_ACCESS_TOKEN',
      'MASTRA_REPOSITORY_ACCESS_TOKEN_1',
      'MASTRA_BUILD_ENV_REVISION',
    ]) {
      const response = await send('PUT', `/${name}`, { value: 'x', appliesTo: 'runtime' });
      expect(response.status, name).toBe(400);
      expect(((await response.json()) as { message: string }).message).toBe(
        `${name}: This name is reserved by Factory.`,
      );
    }
    for (const name of ['__proto__', 'toString', 'constructor', 'hasOwnProperty']) {
      const response = await send('PUT', `/${name}`, { value: 'x', appliesTo: 'runtime' });
      expect(response.status, name).toBe(400);
      expect(((await response.json()) as { message: string }).message).toBe(`${name}: This name can't be used.`);
    }
    expect((await send('PUT', `/${'A'.repeat(128)}`, { value: 'x', appliesTo: 'runtime' })).status).toBe(200);
    expect((await send('PUT', '/GH_TOKENS', { value: 'x', appliesTo: 'runtime' })).status).toBe(200);
  });

  it('clears the cached revision on every write, so the next command in this process reloads', async () => {
    const { seed, project, send } = await setup();
    const scope = { orgId: 'org-1', projectId: project.id };
    const seen = [await cachedSandboxEnvRevision(seed.sandboxEnvs, scope)];
    expect((await send('PUT', '/A', { value: 'x', appliesTo: 'runtime' })).status).toBe(200);
    seen.push(await cachedSandboxEnvRevision(seed.sandboxEnvs, scope));
    expect((await send('PATCH', '/A', { appliesTo: 'both' })).status).toBe(200);
    seen.push(await cachedSandboxEnvRevision(seed.sandboxEnvs, scope));
    expect((await send('DELETE', '/A')).status).toBe(204);
    seen.push(await cachedSandboxEnvRevision(seed.sandboxEnvs, scope));
    // All four reads land well inside the one-second cache window.
    expect(new Set(seen).size).toBe(4);
  });

  it('rejects oversized values, bad applies-to and non-JSON bodies', async () => {
    const { send, base, app } = await setup();
    expect((await send('PUT', '/BIG', { value: 'x'.repeat(32 * 1024 + 1), appliesTo: 'runtime' })).status).toBe(400);
    expect((await send('PUT', '/BIG', { value: 'x'.repeat(32 * 1024), appliesTo: 'runtime' })).status).toBe(200);
    expect((await send('PUT', '/A', { value: 'x', appliesTo: 'always' })).status).toBe(400);
    const badPatch = await send('PATCH', '/BIG', { appliesTo: 'always' });
    expect(badPatch.status).toBe(400);
    expect(await badPatch.json()).toMatchObject({ error: 'invalid_sandbox_env', message: expect.any(String) });
    expect((await send('PUT', '/A', { appliesTo: 'runtime' })).status).toBe(400);
    const nul = await send('PUT', '/A', { value: 'x\0y', appliesTo: 'runtime' });
    expect(nul.status).toBe(400);
    expect(await nul.json()).toEqual({ error: 'invalid_sandbox_env', message: "Values can't contain NUL characters." });
    const form = await app.request(`${base}/A`, {
      method: 'PUT',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `value=${SENTINEL}&appliesTo=runtime`,
    });
    expect(form.status).toBe(415);
    expect(await form.text()).not.toContain(SENTINEL);
  });

  it("returns 404 for another org's project and unknown ids", async () => {
    const { app, other, seed } = await setup();
    await seed.sandboxEnvs.set('org-2', other.id, { name: 'THEIRS', value: SENTINEL, appliesTo: 'runtime' }, 'user-2');
    const path = `/web/factory/projects/${other.id}/sandbox-envs`;
    expect((await app.request(path)).status).toBe(404);
    const put = await app.request(`${path}/THEIRS`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'mine', appliesTo: 'runtime' }),
    });
    expect(put.status).toBe(404);
    expect((await app.request(`${path}/THEIRS`, { method: 'DELETE' })).status).toBe(404);
    expect((await seed.sandboxEnvs.resolve('org-2', other.id)).runtime).toEqual({ THEIRS: SENTINEL });
    expect((await app.request('/web/factory/projects/not-a-uuid/sandbox-envs')).status).toBe(404);
  });

  it('refuses writes with 409 and reports writable: false when values would be stored unencrypted', async () => {
    const { send, seed, project } = await setup({ writable: false });
    expect(await (await send('GET', '')).json()).toEqual({ envs: [], writable: false });
    const put = await send('PUT', '/A', { value: SENTINEL, appliesTo: 'runtime' });
    expect(put.status).toBe(409);
    expect(await put.json()).toMatchObject({ error: 'encryption_not_configured' });
    expect((await send('PATCH', '/A', { appliesTo: 'build' })).status).toBe(409);
    expect(await seed.sandboxEnvs.list('org-1', project.id)).toEqual([]);

    // A value stored before the key went missing can still be removed.
    await seed.sandboxEnvs.set('org-1', project.id, { name: 'OLD', value: 'x', appliesTo: 'runtime' }, 'user-1');
    expect((await send('DELETE', '/OLD')).status).toBe(204);
  });

  it('accepts writes with auth off and no key', async () => {
    const { send } = await setup({ enabled: false, writable: true });
    expect((await send('PUT', '/A', { value: 'x', appliesTo: 'runtime' })).status).toBe(200);
    expect(await (await send('GET', '')).json()).toMatchObject({ writable: true });
  });

  it('keeps the write when the audit emitter throws', async () => {
    const audit = { emit: vi.fn(async () => Promise.reject(new Error('unknown action'))) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { send, seed, project } = await setup({ audit });
    expect((await send('PUT', '/A', { value: SENTINEL, appliesTo: 'build' })).status).toBe(200);
    expect((await send('PATCH', '/A', { appliesTo: 'both' })).status).toBe(200);
    expect((await send('DELETE', '/A')).status).toBe(204);
    expect(audit.emit).toHaveBeenCalledTimes(3);
    expect(await seed.sandboxEnvs.list('org-1', project.id)).toEqual([]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SENTINEL);
    warn.mockRestore();
  });
});
