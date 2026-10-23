import { afterEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RequestContext } from '@mastra/core/request-context';
import { noopObserve } from '@mastra/core/tools';
import { inputLimits, inputLimitsSchema, type InputLimits } from '../config/limits.js';
import { createPdfProvider, extractPdf } from '../src/mastra/providers/pdf.js';
import { CaseRepository } from '../src/mastra/storage/cases.js';
import { createIntakeService } from '../src/mastra/services/intake.js';
import type { InputProvider } from '../src/mastra/services/contracts.js';
import { createRegistry } from '../src/mastra/services/registry.js';
import { safeFailure } from '../src/mastra/services/errors.js';
import { createIntakeTools } from '../src/mastra/tools/intake.js';
import { fileInput, policyPdf, recordProvider } from './fixtures.js';
import { controlledProvider, startStudio, requestHost } from './http.js';

const executeFile = promisify(execFile);
const roots: string[] = [];
const repositories: CaseRepository[] = [];
const context = { operatorId: 'test-broker', threadId: 'thread-one' };
async function setup(limits: InputLimits = inputLimits, provider?: InputProvider) {
  const root = await mkdtemp(join(tmpdir(), 'policy-intake-'));
  roots.push(root);
  const repository = new CaseRepository(root);
  await repository.initialize();
  repositories.push(repository);
  return { root, repository, service: createIntakeService(repository, provider ?? createPdfProvider(limits), limits) };
}
afterEach(async () => {
  for (const repository of repositories.splice(0)) repository.close();
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('Durable insurance intake across real boundaries', () => {
  it('contains parser crashes, excessive output, heap exhaustion, CPU loops and stalled children', async () => {
    const root = await mkdtemp(join(tmpdir(), 'policy-parser-bounds-'));
    roots.push(root);
    const programs = [
      ['crash', 'process.exit(2)'],
      ['output', "process.stdout.write('x'.repeat(9*1024*1024));setInterval(()=>{},1000)"],
      ['heap', 'const values=[];while(true)values.push(Array(100000).fill(Math.random()))'],
      ['cpu', 'while(true){}'],
      ['stall', 'setInterval(()=>{},1000)'],
    ] as const;
    for (const [name, code] of programs) {
      const path = join(root, `${name}.mjs`);
      await writeFile(path, code);
      const started = Date.now();
      await expect(extractPdf(Buffer.from('%PDF-1.7'), 50, path)).rejects.toMatchObject({ code: 'UNREADABLE_PDF' });
      expect(Date.now() - started).toBeLessThan(20_000);
    }
    // The same application process remains usable after all child failures.
    expect((await extractPdf(await policyPdf(), 50))[0]?.text).toContain('Elm Harbor Fabrication LLC');
  });
  it('rejects_oversized_and_unreadable_inputs', async () => {
    const { service, repository } = await setup();
    for (const bytes of [
      Buffer.from('%PDF-1.7 corrupt'),
      await policyPdf('Image only', 1, { scan: true }),
      await policyPdf('Empty', 1, { blankPage: true }),
      await policyPdf('Encrypted', 2, { encrypted: true }),
    ])
      await expect(service.capture(context, fileInput(bytes))).rejects.toBeTruthy();
    await expect(
      service.capture(context, fileInput(Buffer.alloc(inputLimits.pdf.maxBytesPerFile + 1))),
    ).rejects.toBeTruthy();
    expect(await repository.active(context)).toBeNull();
    const mixed = await policyPdf('Mixed evidence', 3, { scan: true });
    await service.capture(context, fileInput(mixed));
    const status = await service.status(context);
    expect(status.sources?.[0]?.limitations.join(' ')).toContain('Image-only');
    expect(status.case?.clarification).toBeNull();
    expect(status.sources?.[0]?.kind).toBe('pdf');
    const current = status.case!;
    await expect(
      service.clarify(context, {
        caseId: current.id,
        expectedRevision: current.revision,
        identity: { policyNumber: null, insuredName: null, insuranceProduct: null },
        intent: 'agreed_terms_checking',
        referenceId: current.sourceIds[0],
        targetId: current.sourceIds[0],
        roles: [],
        acceptedBaseline: null,
      }),
    ).rejects.toBeTruthy();
    const extra = await policyPdf('Unaccepted proposal');
    await service.capture(context, fileInput(extra));
    const before = await repository.requireCase(context);
    const updated = await service.clarify(context, {
      caseId: before.id,
      expectedRevision: before.revision,
      identity: {
        policyNumber: null,
        insuredName: 'Elm Harbor Fabrication LLC',
        insuranceProduct: 'General liability',
      },
      intent: 'document_comparison',
      referenceId: before.sourceIds[0],
      targetId: before.sourceIds[1],
      roles: before.sourceIds.map(sourceId => ({ sourceId, role: 'proposal' })),
      acceptedBaseline: null,
    });
    expect(updated.identity.policyNumber).toBeNull();
    expect(updated.state).toBe('CREATED');
    await expect(
      service.clarify(context, { ...updated.clarification, expectedRevision: before.revision }),
    ).rejects.toMatchObject({ code: 'STALE_CASE' });
  });
  it('rejects_url_and_path_attachment_sources', async () => {
    const { service, root, repository } = await setup();
    await chmod(root, 0o755);
    await chmod(join(root, 'sources'), 0o755);
    await repository.initialize();
    expect((await stat(root)).mode & 0o777).toBe(0o700);
    expect((await stat(join(root, 'sources'))).mode & 0o777).toBe(0o700);
    for (const data of [
      'https://example.invalid/policy.pdf',
      'file:///etc/passwd',
      '../../secret.pdf',
      '/etc/passwd',
    ]) {
      await expect(service.capture(context, { files: [{ name: 'policy.pdf', data }] })).rejects.toBeTruthy();
    }
    expect(await repository.active(context)).toBeNull();
    const bytes = await policyPdf();
    const record = await service.capture(context, fileInput(bytes, '../../outside.pdf'));
    expect(record.sourceIds).toHaveLength(1);
    const saved = await readFile(join(root, 'sources', `${record.sourceIds[0]}.pdf`));
    expect(saved).toEqual(bytes);
    await expect(readFile(join(root, 'outside.pdf'))).rejects.toBeTruthy();
  });
  it('restart_preserves_thread_case_and_source_evidence', async () => {
    const { service, repository, root } = await setup();
    const second = { ...context, threadId: 'thread-two' };
    const first = await service.capture(context, fileInput(await policyPdf('Issued policy ONE')));
    const other = await service.capture(second, fileInput(await policyPdf('Issued policy TWO')));
    const firstSources = await repository.sources(context);
    repository.close();
    repositories.splice(repositories.indexOf(repository), 1);
    // Compile to a temporary directory, then load the repository in a fresh Node process.
    const compiled = join(root, 'compiled');
    await executeFile(
      process.execPath,
      [
        resolve('node_modules/typescript/bin/tsc'),
        '--noEmit',
        'false',
        '--outDir',
        compiled,
        '--noUnusedLocals',
        'false',
        '--noUnusedParameters',
        'false',
      ],
      { cwd: process.cwd() },
    );
    await symlink(resolve('node_modules'), join(compiled, 'node_modules'));
    const runner = `import{CaseRepository}from './compiled/src/mastra/storage/cases.js';const r=new CaseRepository(${JSON.stringify(root)});await r.initialize();const first=await r.requireCase(${JSON.stringify(context)});const second=await r.requireCase(${JSON.stringify(second)});const evidence=await r.evidence(${JSON.stringify(context)},first.sourceIds[0],{physicalPage:2});let denied=false;try{await r.evidence(${JSON.stringify(second)},first.sourceIds[0],{physicalPage:1})}catch{denied=true}console.log(JSON.stringify({first,second,evidence,denied}));r.close();`;
    await writeFile(join(root, 'restart.mjs'), runner);
    const result = JSON.parse(
      (await executeFile(process.execPath, [join(root, 'restart.mjs')], { cwd: process.cwd() })).stdout,
    ) as { first: { id: string }; second: { id: string }; evidence: { hash: string; text: string }; denied: boolean };
    expect(result.first.id).toBe(first.id);
    expect(result.second.id).toBe(other.id);
    expect(result.evidence.hash).toBe(firstSources[0]?.hash);
    expect(result.evidence.text).toContain('Physical source sheet 2');
    expect(result.denied).toBe(true);
  });
  it('input_adapter_preserves_structured_source_provenance', async () => {
    const records = { contract: { limit: 'USD 250000', insured: 'Elm Harbor Fabrication LLC' } };
    const provider = recordProvider('structured', records);
    const { service, repository } = await setup(inputLimits, provider);
    const record = await service.capture(context, {});
    records.contract.limit = 'USD 999999';
    const evidence = await service.evidence(context, record.sourceIds[0]!, { recordId: 'contract', field: 'limit' });
    expect(evidence).toMatchObject({ kind: 'records', value: 'USD 250000', version: '2026-01' });
    expect(evidence).not.toHaveProperty('physicalPage');
    expect((await repository.sources(context))[0]?.provenance.providerId).toBe('structured');
    const repeated = await service.capture(context, {});
    expect(repeated.sourceIds).toHaveLength(2);
    expect(createPdfProvider(inputLimits).id).toBe('local-pdf');
  });
  it('input_adapter_rejects_unverifiable_source_records', async () => {
    const base = recordProvider();
    for (const mutation of ['provenance', 'locator', 'value', 'hash']) {
      const provider: InputProvider = {
        ...base,
        async capture(...args) {
          const bundle = await base.capture(...args);
          const source = bundle.sources[0]!;
          if (mutation === 'provenance') delete (source as unknown as Record<string, unknown>).provenance;
          if (source.kind === 'records') {
            if (mutation === 'locator') source.evidence[0]!.field = 'missing';
            if (mutation === 'value') source.evidence[0]!.value = 'invented';
            if (mutation === 'hash') source.hash = '0'.repeat(64);
          }
          return bundle;
        },
      };
      const { service, repository } = await setup(inputLimits, provider);
      await expect(service.capture(context, {})).rejects.toBeTruthy();
      expect(await repository.active(context)).toBeNull();
    }
  });
  it('configured_input_limits_enforce_defaults_overrides_and_invalid_config', async () => {
    for (const limits of [
      inputLimits,
      { maxDocumentsPerCase: 2, pdf: { maxBytesPerFile: 100_000, maxPagesPerFile: 1, maxPagesPerCase: 2 } },
      { maxDocumentsPerCase: 5, pdf: { maxBytesPerFile: 11 * 1024 * 1024, maxPagesPerFile: 51, maxPagesPerCase: 102 } },
    ]) {
      const { service } = await setup(limits);
      const bytes = await policyPdf('At effective physical-page limit', limits.pdf.maxPagesPerFile);
      const padded = Buffer.concat([bytes, Buffer.alloc(limits.pdf.maxBytesPerFile - bytes.length, 32)]);
      const first = await service.capture(context, fileInput(padded));
      expect(first.sourceIds).toHaveLength(1);
      await expect(
        service.capture({ ...context, threadId: randomUUID() }, fileInput(Buffer.concat([padded, Buffer.from(' ')]))),
      ).rejects.toBeTruthy();
      await expect(
        service.capture(
          { ...context, threadId: randomUUID() },
          fileInput(await policyPdf('Over pages', limits.pdf.maxPagesPerFile + 1)),
        ),
      ).rejects.toMatchObject({ code: 'PAGE_LIMIT' });
      const files = [];
      for (let index = 0; index < limits.maxDocumentsPerCase; index++)
        files.push(fileInput(await policyPdf(`Document ${index}`, 1)).files[0]);
      const counted = await service.capture({ ...context, threadId: randomUUID() }, { files: [...files, files[0]] });
      expect(counted.sourceIds).toHaveLength(limits.maxDocumentsPerCase);
      await expect(
        service.capture(
          { ...context, threadId: randomUUID() },
          { files: [...files, fileInput(await policyPdf('Unique document above capacity', 1)).files[0]] },
        ),
      ).rejects.toBeTruthy();
      const capContext = { ...context, threadId: randomUUID() };
      let pagesRemaining = limits.pdf.maxPagesPerCase;
      const aggregateFiles = [];
      let index = 0;
      while (pagesRemaining > 0) {
        const count = Math.min(limits.pdf.maxPagesPerFile, pagesRemaining);
        aggregateFiles.push(fileInput(await policyPdf(`Aggregate ${index++}`, count)).files[0]);
        pagesRemaining -= count;
      }
      const aggregate = await service.capture(capContext, { files: aggregateFiles });
      expect(aggregate.sourceIds.length).toBeGreaterThan(0);
      await expect(
        service.capture(capContext, fileInput(await policyPdf('One page above aggregate', 1))),
      ).rejects.toMatchObject({ code: limits.maxDocumentsPerCase === 2 ? 'DOCUMENT_LIMIT' : 'CASE_PAGE_LIMIT' });
    }
    for (const value of [0, -1, 1, 2.2, Infinity, NaN]) {
      const invalid = { ...inputLimits, maxDocumentsPerCase: value };
      expect(inputLimitsSchema.safeParse(invalid).success).toBe(false);
      const provider = recordProvider();
      let calls = 0;
      const counted = {
        ...provider,
        async capture(...args: Parameters<InputProvider['capture']>) {
          calls++;
          return provider.capture(...args);
        },
      };
      const root = await mkdtemp(join(tmpdir(), 'policy-invalid-config-'));
      roots.push(root);
      const repository = new CaseRepository(root);
      repositories.push(repository);
      expect(() => createIntakeService(repository, counted, invalid)).toThrow();
      expect(calls).toBe(0);
    }
  });
  it('provider_registry_resolves_interfaces_and_rejects_invalid_selection', async () => {
    const selected = recordProvider('selected');
    const unselected: InputProvider = {
      ...recordProvider('unused'),
      async capture() {
        throw Error('Unselected provider was invoked');
      },
    };
    for (const input of [
      [selected, unselected],
      [unselected, selected],
    ]) {
      const registry = createRegistry(
        { input, draftOutput: [], reportOutput: [], correctionOutput: [] },
        { input: 'selected' },
      );
      const { service } = await setup(inputLimits, registry.resolve('input', undefined, 'structured-records'));
      await service.capture(context, {});
      const tools = createIntakeTools(service, context.operatorId);
      const requestContext = new RequestContext();
      requestContext.set('insuranceThreadId', context.threadId);
      const status = await tools.caseStatus.execute!({}, { requestContext, observe: noopObserve });
      expect(JSON.stringify(status)).toContain('Captured contract record');
      expect(() => registry.resolve('input', 'missing')).toThrow();
      expect(() => registry.resolve('input', 'selected', 'pdf-attachments')).toThrow();
      expect(() => registry.resolve('draftOutput')).toThrow();
    }
    const arrays = { input: [selected, selected], draftOutput: [], reportOutput: [], correctionOutput: [] } as const;
    expect(() => createRegistry(arrays, { input: 'selected' })).toThrow();
    expect(() => createRegistry({ ...arrays, input: [selected] }, { input: 'missing' })).toThrow();
    const repeated: InputProvider = {
      ...selected,
      async capture(...args) {
        const bundle = await selected.capture(...args);
        return { sources: [...bundle.sources, { ...bundle.sources[0]!, sourceId: randomUUID() }] };
      },
    };
    const { service } = await setup(inputLimits, repeated);
    expect((await service.capture(context, {})).sourceIds).toHaveLength(1);
  });
  it('agent_errors_always_include_safe_human_explanations', async () => {
    const provider = await controlledProvider(true);
    const root = await mkdtemp(join(tmpdir(), 'policy-http-'));
    roots.push(root);
    let studio: Awaited<ReturnType<typeof startStudio>> | undefined;
    try {
      studio = await startStudio(root, provider.url);
      const body = {
        messages: [{ role: 'user', content: 'Read case status.' }],
        memory: { thread: 'safe-errors', resource: 'broker' },
      };
      const response = await fetch(`${studio.url}/api/agents/policyCheckingAgent/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: studio.url },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      expect(text).not.toContain('SENTINEL_PRIVATE_PROVIDER_SECRET');
      expect(text).toContain('conversation model is unavailable');
      expect(provider.requests.length).toBeGreaterThan(0);
      for (const path of [
        '/api/agents/policyCheckingAgent/stream',
        '/api/tools/clarify-case/execute',
        '/api/workflows/any/resume',
      ]) {
        const denied = await fetch(`${studio.url}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'https://hostile.invalid' },
          body: '{}',
        });
        expect(denied.status).toBe(403);
        expect(await denied.text()).toContain('configured local Studio');
      }
      expect(await requestHost(`${studio.url}/api/agents`, 'attacker.invalid')).toBe(403);
      await studio.close();
      studio = undefined;
      studio = await startStudio(root);
      const fallback = await fetch(`${studio.url}/api/agents/policyCheckingAgent/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: studio.url },
        body: JSON.stringify(body),
      });
      const fallbackText = await fallback.text();
      expect(fallbackText).toContain('spending budget');
      expect(fallbackText).toContain('No case is selected');
      expect(fallbackText).not.toContain('dispatch-disabled');
      const failure = safeFailure(new Error('SENTINEL_PRIVATE_PROVIDER_SECRET'));
      expect(failure.message.length).toBeGreaterThan(10);
      expect(failure.nextAction).toContain('Check case status');
    } finally {
      await studio?.close();
      await provider.close();
    }
  });
});
