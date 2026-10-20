import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { DuckDBStore } from '@mastra/duckdb';
import { researchMeasurementSchema } from '../../src/mastra/telemetry';
import { domainSchema, runReferenceSchema } from '../../src/mastra/contracts';

// Explicitly opt-in: this proof installs/builds a fresh copy and consumes one real research allowance.
it('documented_local_qualification_round_trip', async () => {
  assert.equal(process.env.FIRST_RUN_APPROVED, 'yes', 'Explicit fresh-copy/model authorization is required');
  const key = process.env.OPENAI_API_KEY;
  assert(key && !/^(example|placeholder|your[-_])/i.test(key), 'A real OPENAI_API_KEY is required');
  const domain = domainSchema.parse(process.env.FIRST_RUN_DOMAIN);
  let server: ReturnType<typeof spawn> | undefined;
  const evidenceFile = process.env.FIRST_RUN_EVIDENCE_FILE;
  assert(evidenceFile, 'An external FIRST_RUN_EVIDENCE_FILE is required');
  const directory = await mkdtemp(join(tmpdir(), 'lead-first-run-'));
  let ownsEvidenceFile = false;
  let stage: 'setup' | 'start' | 'intake' | 'research' | 'output' | 'replay' = 'setup';
  const proof: Record<string, unknown> = {
    domain,
    operatorDecision: 'simulated_local_operator',
    bounds: { researchCycles: 1, searches: 4, pageRequests: 4, outputTokens: 12000, processingMs: 180000 },
    completed: false,
    accepted: null,
    lastKnownStatus: null,
    budget: null,
    usage: { status: 'unavailable', complete: false, attempts: [] },
  };

  async function checkpoint() {
    await writeFile(evidenceFile!, JSON.stringify(proof, null, 2) + '\n', { mode: 0o600 });
  }

  try {
    const source = fileURLToPath(new URL('../../', import.meta.url));
    assert(!resolve(evidenceFile).startsWith(source), 'Evidence must be external to the template');
    await writeFile(evidenceFile, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    ownsEvidenceFile = true;
    const rootFiles = new Set([
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'oxlint.config.ts',
      '.oxfmtrc.json',
      '.gitignore',
      '.env.example',
      'README.md',
      'CONTRIBUTING.md',
      'vitest.config.ts',
      'vitest.live.config.ts',
      'vitest.attio-live.config.ts',
      'vitest.first-run.config.ts',
    ]);
    await cp(source, directory, {
      recursive: true,
      filter: async path => {
        const name = relative(source, path);
        if (!name) return true;
        const parts = name.split('/');
        if (parts.some(part => ['node_modules', 'data', '.mastra', '.git'].includes(part))) return false;
        if (parts.length === 1 && rootFiles.has(name)) return true;
        if (!['src', 'scripts', 'docs', 'tests'].includes(parts[0]!)) return false;
        if ((await stat(path)).isDirectory()) return true;
        return (
          /\.(?:ts|mjs|md)$/.test(name) ||
          /^tests\/fixtures\/qualification\/(?:(?:(?:model-)?(?:profiles|expected)|verifier-wire-schema)\.v1|verifier-diagnostic\.v[12])\.json$/.test(
            name,
          )
        );
      },
    });

    // Only the model credential is copied. No Attio settings, old state, mappings or transient testing globals.
    const environment = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      npm_config_cache: join(directory, 'npm-cache'),
      npm_config_userconfig: '/dev/null',
      TMPDIR: process.env.TMPDIR,
      OPENAI_API_KEY: key,
      LEAD_QUALIFICATION_MODE: 'local',
    };
    const commands: Array<Record<string, unknown>> = [];
    proof.commands = commands;
    async function command(args: string[], timeout: number) {
      const started = performance.now();
      const result = {
        command: ['npm', ...args],
        exitCode: null as number | null,
        signal: null as string | null,
        timedOut: false,
        elapsedMs: 0,
        stdoutBytes: 0,
        stderrBytes: 0,
      };
      commands.push(result);
      const child = spawn('npm', args, { cwd: directory, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', (chunk: Buffer) => {
        result.stdoutBytes += chunk.byteLength;
      });
      child.stderr.on('data', (chunk: Buffer) => {
        result.stderrBytes += chunk.byteLength;
      });
      const timer = setTimeout(() => {
        result.timedOut = true;
        child.kill('SIGKILL');
      }, timeout);
      try {
        const code = await new Promise<number | null>((resolve, reject) => {
          child.once('error', reject);
          child.once('exit', (code, signal) => {
            result.exitCode = code;
            result.signal = signal;
            resolve(code);
          });
        });
        expect(code, `npm ${args.join(' ')}`).toBe(0);
      } finally {
        clearTimeout(timer);
        result.elapsedMs = performance.now() - started;
        await checkpoint();
      }
    }
    await command(['install'], 180000);
    expect(await readFile(join(directory, '.env'), 'utf8')).toContain('OPENAI_API_KEY');
    const versions: Record<string, string | null> = {};
    for (const name of ['mastra', '@mastra/core', '@mastra/libsql', '@mastra/duckdb', '@mastra/observability']) {
      try {
        const manifest = JSON.parse(await readFile(join(directory, 'node_modules', name, 'package.json'), 'utf8')) as {
          version: unknown;
        };
        versions[name] =
          typeof manifest.version === 'string' && /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(manifest.version)
            ? manifest.version
            : null;
      } catch {
        versions[name] = null;
      }
    }
    proof.resolvedVersions = versions;
    await checkpoint();
    await writeFile(join(directory, '.env'), `OPENAI_API_KEY=${key}\nLEAD_QUALIFICATION_MODE=local\n`, { mode: 0o600 });
    await command(['run', 'build'], 120000);
    const listener = createServer();
    await new Promise<void>((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', resolve);
    });
    const address = listener.address();
    assert(address && typeof address !== 'string');
    const port = address.port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    stage = 'start';
    server = spawn('npm', ['start'], {
      cwd: directory,
      env: { ...environment, LEAD_QUALIFICATION_PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    const startRecord = {
      port,
      exitCode: null as number | null,
      signal: null as string | null,
      stdoutBytes: 0,
      stderrBytes: 0,
    };
    proof.start = startRecord;
    server.stdout?.on('data', (chunk: Buffer) => {
      startRecord.stdoutBytes += chunk.byteLength;
    });
    server.stderr?.on('data', (chunk: Buffer) => {
      startRecord.stderrBytes += chunk.byteLength;
    });
    server.on('error', () => {
      proof.startFailureCode = 'first_run_start_launch_failed';
    });
    server.on('exit', (code, signal) => {
      startRecord.exitCode = code;
      startRecord.signal = signal;
    });
    const base = `http://127.0.0.1:${port}`;
    const readyDeadline = Date.now() + 30000;
    while (true) {
      try {
        const ready = await fetch(
          `${base}/lead-qualification/report?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z`,
        );
        if (ready.ok) break;
      } catch {
        /* Bound startup polling. */
      }
      assert(Date.now() < readyDeadline, 'Fresh server did not become ready');
      await delay(250);
    }
    stage = 'intake';
    const response = await fetch(`${base}/lead-qualification/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 1,
        type: 'lead.received',
        eventId: 'fresh-domain-1',
        lead: { reference: 'fresh-company', domain },
      }),
    });
    proof.setup = 'installed_built_started';
    expect(response.status).toBe(202);
    const accepted = (await response.json()) as { runId: string; statusUrl: string };
    runReferenceSchema.parse({ runId: accepted.runId });
    assert.equal(accepted.statusUrl, `/lead-qualification/runs/${accepted.runId}`);
    proof.accepted = { runId: accepted.runId, statusUrl: accepted.statusUrl, observedAt: new Date().toISOString() };
    stage = 'research';
    await checkpoint();
    async function readRun() {
      const response = await fetch(`${base}${accepted.statusUrl}`);
      assert(response.ok, 'Accepted run read failed');
      const current = (await response.json()) as Record<string, any>;
      proof.lastKnownStatus = {
        observedAt: new Date().toISOString(),
        status: current.status ?? null,
        qualificationStatus: current.qualification?.status ?? null,
        businessState: current.business?.state ?? null,
      };
      if (current.qualification?.budget) proof.budget = current.qualification.budget;
      if (current.qualification?.assessment) proof.assessment = current.qualification.assessment;
      await checkpoint();
      return current;
    }
    const deadline = Date.now() + 190000;
    let run: Record<string, any>;
    for (;;) {
      run = await readRun();
      if (run.qualification?.assessment) break;
      assert(Date.now() < deadline, 'Bounded research did not finish');
      await delay(250);
    }
    const assessment = run.qualification.assessment;
    proof.assessment = assessment;
    proof.budget = run.qualification.budget;
    expect(assessment.identity.domain).toBe(domain);
    expect(assessment.evidence.length).toBeGreaterThan(0);
    expect(
      ['businessModel', 'employeeCount', 'headquartersCountry'].some(
        attribute =>
          assessment.facts[attribute].disposition === 'accepted' && assessment.facts[attribute].evidenceIds.length > 0,
      ),
    ).toBe(true);
    expect(run.qualification.budget.searchCalls).toBeLessThanOrEqual(4);
    expect(run.qualification.budget.pageRequests).toBeLessThanOrEqual(4);
    expect(run.qualification.budget.outputTokens).toBeLessThanOrEqual(12000);
    stage = 'output';
    for (;;) {
      run = await readRun();
      if (run.business?.state === 'awaiting_review') {
        const packet = run.business.packet;
        const decision = await fetch(`${base}/lead-qualification/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runId: accepted.runId,
            reviewId: packet.id,
            revision: 1,
            digest: packet.digest,
            decision: 'approved',
            override: {
              classification: 'nurture',
              reason: 'Local first-run operator proof; public evidence remains incomplete. No outreach or CRM action.',
            },
          }),
        });
        assert(decision.ok);
      }
      if (run.business?.state === 'applied') break;
      assert(Date.now() < deadline, 'Local output did not settle');
      await delay(250);
    }
    const report = await fetch(`${base}${accepted.statusUrl}/output`);
    expect(report.ok).toBe(true);
    expect(await report.text()).toContain('Lead qualification:');
    stage = 'replay';
    const replay = await fetch(`${base}/lead-qualification/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 1,
        type: 'lead.received',
        eventId: 'fresh-domain-1',
        lead: { reference: 'fresh-company', domain },
      }),
    });
    expect(((await replay.json()) as { runId: string }).runId).toBe(accepted.runId);
    proof.completed = true;
    proof.business = run.business;
    await checkpoint();
  } catch (error) {
    proof.failureCode = `first_run_${stage}_failed`;
    throw error;
  } finally {
    if (server?.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        /* Already exited. */
      }
      await Promise.race([new Promise(resolve => server!.once('exit', resolve)), delay(10000)]);
      try {
        process.kill(-server.pid, 'SIGKILL');
      } catch {
        /* Drained. */
      }
    }
    try {
      if (proof.accepted) {
        // Only inspect this stopped fresh copy; retain measured attempts without inventing a complete total.
        const telemetry = new DuckDBStore({
          path: join(directory, 'data/observability.duckdb'),
          memoryLimit: '512MB',
          threads: 2,
        });
        try {
          await stat(join(directory, 'data/observability.duckdb'));
          await telemetry.init();
          const records = await telemetry.observability.listLogs({ pagination: { page: 0, perPage: 100 } });
          const accepted = proof.accepted as { runId: string };
          const attempts = records.logs.flatMap(record => {
            if (record.message !== 'research.measurement') return [];
            const { cost: _cost, ...data } = record.data ?? {};
            const parsed = researchMeasurementSchema.safeParse(data);
            return parsed.success && parsed.data.runId === accepted.runId ? [parsed.data] : [];
          });
          proof.usage = {
            status: attempts.length ? 'observed_attempts_only' : 'unavailable',
            complete: false,
            attempts,
          };
        } catch {
          proof.usageReadFailureCode = 'first_run_usage_read_unavailable';
        } finally {
          try {
            await telemetry.close();
          } catch {
            proof.usageReadFailureCode = 'first_run_usage_read_unavailable';
          }
        }
      }
      if (ownsEvidenceFile) await checkpoint();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});
