import { randomUUID } from 'node:crypto';
import posix from 'node:path/posix';

import type { Container, ExecutionRecord, FileEntry } from '@mainbrella/sdk';
import { vi } from 'vitest';

export const API_KEY = `mb_${'a'.repeat(64)}`;
export const CREATED_AT = '2026-10-08T12:00:00.000Z';

export class FakeAPI {
  readonly capabilities = {
    execution: {
      background: true,
      cancellation: true,
      streaming: true,
      reconnect: true,
      argv: true,
      stdin: true,
      managedProcessListing: true,
      maxManagedTimeoutMs: 900_000,
    },
    files: {
      read: true,
      write: true,
      binary: true,
      list: true,
      stat: true,
      mkdir: true,
      delete: true,
      move: true,
      maxFileBytes: 1048576,
    },
    previews: { supported: true },
    networking: { internetControl: true },
    persistence: { snapshots: true },
  };
  containers: Container[] = [];
  readonly jobs = new Map<string, ExecutionRecord>();
  readonly files = new Map<string, Buffer>();
  readonly entries = new Map<string, FileEntry>();
  readonly requests: { url: URL; method: string; body: unknown; headers: Headers }[] = [];
  jobResult: Partial<ExecutionRecord> = {};
  starting = false;
  splitStream = false;
  failStart = false;
  rejectCreation = false;
  cleanupConflict = false;
  failCleanup = false;
  failPreview = false;
  pageSize = 100;
  private generation = 0;

  constructor() {
    for (const directory of ['/', '/workspace', '/tmp']) this.addEntry(directory, 'directory');
  }

  addEntry(path: string, type: FileEntry['type'], content?: Buffer, linkTarget?: string): void {
    this.entries.set(path, {
      name: posix.basename(path),
      path,
      type,
      size: content?.byteLength ?? 0,
      mode: '0600',
      uid: 0,
      gid: 0,
      modifiedAt: CREATED_AT,
      linkTarget,
    });
    if (content) this.files.set(path, content);
  }

  fetch = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    this.requests.push({ url, method, body, headers });
    if (headers.get('Authorization') !== `Bearer ${API_KEY}`) return this.error('unauthorized', 401);
    if (url.pathname === '/capabilities') return Response.json(this.capabilities);
    if (url.pathname === '/containers') {
      if (method === 'POST') {
        if (this.rejectCreation) return this.error('access_inactive', 402);
        const createdAt = new Date(Date.parse(CREATED_AT) + this.generation++).toISOString();
        const container: Container = {
          id: 'c1',
          createdAt,
          status: this.starting ? 'starting' : 'running',
          expiresAt: '2026-10-09T12:00:00.000Z',
          size: 'lite',
        };
        this.containers = [container];
        return Response.json({
          containers: this.containers,
          creation: { id: randomUUID(), containerId: container.id, createdAt, status: container.status },
        });
      }
      if (method === 'DELETE') {
        if (this.failCleanup) return this.error('cleanup_failed', 503);
        if (this.cleanupConflict) return this.error('container_not_running', 409);
        this.containers = this.containers.filter(
          c => c.id !== url.searchParams.get('id') || c.createdAt !== url.searchParams.get('createdAt'),
        );
      }
      return Response.json({ containers: this.containers });
    }
    const selected = this.containers.find(
      c => c.id === url.searchParams.get('id') && c.createdAt === url.searchParams.get('createdAt'),
    );
    if (!selected && !url.pathname.startsWith('/containers/executions/'))
      return this.error('container_not_running', 409);
    if (url.pathname === '/containers/executions') {
      if (method === 'GET') return Response.json({ executions: Array.from(this.jobs.values()) });
      if (this.failStart) throw new Error('Disconnected after accepting command');
      const request = body as { stdin?: boolean };
      const record: ExecutionRecord = {
        id: randomUUID(),
        createdAt: CREATED_AT,
        startedAt: CREATED_AT,
        status: 'succeeded',
        retainUntil: Date.now() + 3600000,
        cursor: 2,
        outputBytes: 4,
        stdout: 'hello 🦄\n',
        stderr: 'stderr\n',
        exitCode: 0,
        timedOut: false,
        outputTruncated: false,
        stdinEnabled: request.stdin,
        ...this.jobResult,
      };
      this.jobs.set(record.id, record);
      return Response.json(record);
    }
    const match = /^\/containers\/executions\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if (match) {
      const record = this.jobs.get(match[1]!);
      if (!record) return this.error('execution_not_found', 404);
      if (match[2] === '/events') {
        const cursor = Number(url.searchParams.get('cursor'));
        const first = this.splitStream && cursor === 0;
        const frames = [
          ...(cursor < 1
            ? [`event: stdout\ndata: ${JSON.stringify({ type: 'stdout', sequence: 1, data: record.stdout })}\n\n`]
            : []),
          ...(!first && cursor < 2
            ? [`event: stderr\ndata: ${JSON.stringify({ type: 'stderr', sequence: 2, data: record.stderr })}\n\n`]
            : []),
          ...(!first ? [`event: status\ndata: ${JSON.stringify(record)}\n\n`] : []),
        ].join('');
        const bytes = Buffer.from(frames);
        return new Response(
          new ReadableStream({
            start(controller) {
              // Split multibyte UTF-8 and SSE frames to exercise the actual parser.
              for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.subarray(i, i + 7));
              controller.close();
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        );
      }
      if (match[2] === '/stdin') return Response.json({ bytes: 0, stdinClosed: method === 'DELETE' });
      if (method === 'DELETE') Object.assign(record, { status: 'canceled', exitCode: null });
      return Response.json(record);
    }
    if (url.pathname === '/containers/previews') {
      if (this.failPreview) throw new Error('Preview response lost');
      return Response.json({
        id: 'a'.repeat(32),
        url: 'https://private-preview.example',
        port: 3000,
        createdAt: CREATED_AT,
        expiresAt: Date.now() + 3600000,
      });
    }
    const path = url.searchParams.get('path') ?? (body as { path?: string })?.path;
    if (!path) return this.error('invalid_file_path', 400);
    if (url.pathname === '/containers/files/mkdir') {
      const request = body as { recursive?: boolean };
      if (!request.recursive && !this.entries.has(posix.dirname(path))) return this.error('file_not_found', 404);
      const current = this.entries.get(path);
      if (current && (current.type !== 'directory' || !request.recursive)) return this.error('file_exists', 409);
      for (let next = path; next !== '/' && !this.entries.has(next); next = posix.dirname(next))
        this.addEntry(next, 'directory');
      return Response.json({ path, ok: true });
    }
    if (url.pathname === '/containers/files') {
      if (method === 'PUT') {
        if (!this.entries.has(posix.dirname(path))) return this.error('file_not_found', 404);
        this.addEntry(path, 'file', Buffer.from(body as Uint8Array));
        return Response.json({ path, size: this.files.get(path)!.length });
      }
      if (!this.files.has(path)) return this.error('file_not_found', 404);
      return new Response(new Uint8Array(this.files.get(path)!));
    }
    const entry = this.entries.get(path);
    if (!entry) return this.error('file_not_found', 404);
    if (url.pathname === '/containers/files/stat') return Response.json(entry);
    if (url.pathname === '/containers/files/list') {
      if (entry.type !== 'directory') return this.error('not_directory', 409);
      const entries = Array.from(this.entries.values()).filter(e => e.path !== path && posix.dirname(e.path) === path);
      const offset = Number(url.searchParams.get('offset'));
      return Response.json({
        path,
        entries: entries.slice(offset, offset + this.pageSize),
        nextOffset: entries.length > offset + this.pageSize ? offset + this.pageSize : null,
      });
    }
    if (url.pathname === '/containers/files/remove') {
      const children = Array.from(this.entries.keys()).filter(p => p.startsWith(`${path}/`));
      if (children.length && url.searchParams.get('recursive') !== 'true')
        return this.error('directory_not_empty', 409);
      for (const p of [path, ...children]) {
        this.files.delete(p);
        this.entries.delete(p);
      }
      return Response.json({ path, ok: true });
    }
    if (url.pathname === '/containers/files/move') {
      const destination = (body as { destination: string }).destination;
      if (this.entries.has(destination)) return this.error('file_exists', 409);
      this.entries.set(destination, { ...entry, path: destination, name: posix.basename(destination) });
      this.entries.delete(path);
      if (this.files.has(path)) {
        this.files.set(destination, this.files.get(path)!);
        this.files.delete(path);
      }
      return Response.json({ path, destination, ok: true });
    }
    throw new Error(`Unhandled fake route ${method} ${url.pathname}`);
  });

  private error(error: string, status: number): Response {
    return Response.json({ error }, { status });
  }
}
