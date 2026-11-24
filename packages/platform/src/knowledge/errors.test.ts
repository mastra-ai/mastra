import { createServer } from 'node:http';
import {
  KnowledgeConflictError,
  KnowledgeMoveTooLargeError,
  KnowledgeNotFoundError,
  KnowledgePageDepthError,
  KnowledgePageHasChildrenError,
  KnowledgePageKeyConflictError,
} from '@mastra/core/storage';
import { afterEach, expect, it } from 'vitest';

import { PlatformKnowledge } from './index';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

it.each([
  { status: 404, name: 'KnowledgeNotFoundError', type: KnowledgeNotFoundError },
  { status: 409, name: 'KnowledgeConflictError', type: KnowledgeConflictError },
  { status: 409, name: 'KnowledgePageKeyConflictError', type: KnowledgePageKeyConflictError },
  { status: 409, name: 'KnowledgePageHasChildrenError', type: KnowledgePageHasChildrenError },
  { status: 400, name: 'KnowledgePageDepthError', type: KnowledgePageDepthError },
  { status: 400, name: 'KnowledgeMoveTooLargeError', type: KnowledgeMoveTooLargeError },
])('preserves $name from problem+json responses', async ({ status, name, type }) => {
  const server = createServer((_req, res) => {
    res.writeHead(status, { 'content-type': 'application/problem+json' });
    res.end(JSON.stringify({ name, detail: 'specific knowledge failure', title: 'Generic failure' }));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
  const storage = await new PlatformKnowledge({
    apiUrl: `http://127.0.0.1:${address.port}`,
    instanceId: 'instance',
    accessToken: 'token',
  }).getStorage();
  await expect(storage.listPages({ read: 'all' })).rejects.toThrow(type);
  await expect(storage.listPages({ read: 'all' })).rejects.toThrow('specific knowledge failure');
});

it('prefers the nested error message over a generic title', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ title: 'Bad Request', error: { message: 'pageKey is required' } }));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
  const storage = await new PlatformKnowledge({
    apiUrl: `http://127.0.0.1:${address.port}`,
    instanceId: 'instance',
    accessToken: 'token',
  }).getStorage();
  await expect(storage.listPages({ read: 'all' })).rejects.toThrow('pageKey is required');
});

it('returns an HTTP status error rather than a SyntaxError for non-JSON gateway failures', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(502, { 'content-type': 'text/html' });
    res.end('<html>Bad gateway</html>');
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
  const storage = await new PlatformKnowledge({
    apiUrl: `http://127.0.0.1:${address.port}`,
    instanceId: 'instance',
    accessToken: 'token',
  }).getStorage();
  await expect(storage.listPages({ read: 'all' })).rejects.toThrow(
    'Knowledge request failed (502): <html>Bad gateway</html>',
  );
});

it('keeps the HTTP status when the error body is JSON null', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end('null');
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
  const storage = await new PlatformKnowledge({
    apiUrl: `http://127.0.0.1:${address.port}`,
    instanceId: 'instance',
    accessToken: 'token',
  }).getStorage();
  await expect(storage.listPages({ read: 'all' })).rejects.toThrow('Knowledge request failed (500): null');
});

async function storageAnswering(status: number, body: unknown) {
  const server = createServer((_req, res) => {
    res.writeHead(status, { 'content-type': 'application/problem+json' });
    res.end(JSON.stringify(body));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP port');
  return new PlatformKnowledge({
    apiUrl: `http://127.0.0.1:${address.port}`,
    instanceId: 'instance',
    accessToken: 'token',
  }).getStorage();
}

it('rebuilds the fields of a key conflict and an oversized move from the service body', async () => {
  const conflict = await storageAnswering(409, {
    name: 'KnowledgePageKeyConflictError',
    detail: 'Knowledge page key "guides" already exists under page scope-1.',
    key: 'guides',
    parentId: 'scope-1',
  });
  await expect(conflict.listPages({ read: 'all' })).rejects.toMatchObject({
    name: 'KnowledgePageKeyConflictError',
    key: 'guides',
    parentId: 'scope-1',
    message: 'Knowledge page key "guides" already exists under page scope-1.',
  });
  const move = await storageAnswering(400, {
    name: 'KnowledgeMoveTooLargeError',
    detail: 'Moving page page-1 would move 5000 pages',
    pageId: 'page-1',
    pages: 5000,
  });
  await expect(move.listPages({ read: 'all' })).rejects.toMatchObject({
    name: 'KnowledgeMoveTooLargeError',
    pageId: 'page-1',
    pages: 5000,
  });
});

it.each([
  { name: 'KnowledgePageDepthError', type: KnowledgePageDepthError },
  { name: 'KnowledgeMoveTooLargeError', type: KnowledgeMoveTooLargeError },
])('keeps the 400 status on $name, as the plain Error it replaced did', async ({ name, type }) => {
  const storage = await storageAnswering(400, { name, detail: 'specific knowledge failure' });
  const error = await storage.listPages({ read: 'all' }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(type);
  expect(error).toMatchObject({ message: 'specific knowledge failure', status: 400 });
});

it('fills placeholders when an older service sends a move-size error without its fields', async () => {
  const storage = await storageAnswering(400, { name: 'KnowledgeMoveTooLargeError', detail: 'too many pages' });
  const error = await storage.listPages({ read: 'all' }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(KnowledgeMoveTooLargeError);
  expect(error).toMatchObject({ message: 'too many pages', status: 400, pageId: '', pages: 0 });
});

it('reads no scope declarations from a service without the getScopeDeclarations operation', async () => {
  const storage = await storageAnswering(404, { title: 'Not Found', detail: 'Knowledge operation not found' });
  await expect(storage.getScopeDeclarations()).resolves.toEqual({});
});

it('still fails getScopeDeclarations for a missing instance, any other 404, or a server error', async () => {
  const missing = await storageAnswering(404, { title: 'Not Found', detail: 'Knowledge instance not found' });
  await expect(missing.getScopeDeclarations()).rejects.toThrow('Knowledge instance not found');
  const elsewhere = await storageAnswering(404, { title: 'Not Found' });
  await expect(elsewhere.getScopeDeclarations()).rejects.toThrow('Not Found');
  const broken = await storageAnswering(500, { title: 'Internal Server Error' });
  await expect(broken.getScopeDeclarations()).rejects.toThrow('Internal Server Error');
});
