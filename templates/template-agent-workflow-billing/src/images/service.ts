import { constants } from 'node:fs';
import { open, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Transaction } from '@libsql/client/node';
import { BillingError, parseInput } from '../billing/contracts.js';
import { boundedJson } from '../billing/accounting.js';
import type { AdmissionIdentity } from '../billing/accounting.js';
import type { ArtifactReader } from '../billing/artifacts.js';
import { BillingDatabase } from '../billing/storage/database.js';
import { currentExecution } from '../billing/execution-scope.js';
import type { ExecutionScope } from '../billing/execution-scope.js';
import { privateDirectory } from '../local/profiles.js';
import { artifactSchema, imageProfile, briefSchema, kitOutputSchema } from './schemas.js';
import type { Artifact } from './schemas.js';
import { maxImageBytes, validatePng } from './png.js';

const responseSchema = z.object({
  data: z.tuple([
    z.object({
      b64_json: z
        .string()
        .min(1)
        .max(12 * 1024 * 1024),
    }),
  ]),
});
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export class ImageService implements ArtifactReader {
  private readonly databaseUrl: string;
  readonly directory: string;
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {
    const root = resolve(environment.BILLING_PROJECT_ROOT ?? environment.MASTRA_PROJECT_ROOT ?? '.');
    this.databaseUrl = environment.BILLING_DATABASE_URL ?? pathToFileURL(resolve(root, 'data/billing.db')).href;
    this.directory = resolve(dirname(fileURLToPath(this.databaseUrl)), 'private-images');
  }
  private async sql<T>(work: (tx: Transaction) => Promise<T>) {
    const database = await BillingDatabase.open({ url: this.databaseUrl });
    try {
      return await database.write(work);
    } finally {
      database.close();
    }
  }
  private async owned(tx: Transaction, identity: AdmissionIdentity) {
    if (identity.validUntil !== null && identity.validUntil <= Date.now()) throw new BillingError('unauthenticated');
    const member = (
      await tx.execute({
        sql: `SELECT i.active FROM memberships m JOIN identities i ON i.id = m.identity_id
      WHERE m.workspace_id = ? AND m.identity_id = ?`,
        args: [identity.workspaceId, identity.actorId],
      })
    ).rows[0];
    if (member?.active !== 1n) throw new BillingError('forbidden');
    if (identity.credentialHash !== null) {
      const credential = (
        await tx.execute({
          sql: 'SELECT active FROM local_credentials WHERE hash = ? AND identity_id = ?',
          args: [identity.credentialHash, identity.actorId],
        })
      ).rows[0];
      if (credential?.active !== 1n) throw new BillingError('unauthenticated');
    }
  }
  private async active(tx: Transaction, scope: ExecutionScope) {
    const { collector } = scope;
    await this.owned(tx, collector.identity);
    const row = (
      await tx.execute({
        sql: `SELECT e.*, r.reserve_state, r.segment_deadline, r.terminal_request FROM billing_executions e
      JOIN billing_remote_operations r ON r.execution_id = e.id WHERE e.id = ?`,
        args: [collector.executionId],
      })
    ).rows[0];
    if (
      !row ||
      row.actor_id !== collector.identity.actorId ||
      row.workspace_id !== collector.identity.workspaceId ||
      row.status !== 'running' ||
      row.recovery_fenced !== 0n ||
      row.reserve_state !== 'reserved' ||
      row.terminal_request !== null ||
      row.segment_deadline === null ||
      Number(row.segment_deadline) <= Date.now()
    )
      throw new BillingError('state_unavailable');
    if (collector.workflowVersion !== undefined) {
      const workflow = (
        await tx.execute({
          sql: 'SELECT version, status FROM billing_workflow_runs WHERE id = ?',
          args: [collector.executionId],
        })
      ).rows[0];
      if (workflow?.version !== BigInt(collector.workflowVersion) || workflow.status !== 'running')
        throw new BillingError('state_unavailable');
    }
    if (!collector.artifactSlots || scope.slot >= collector.artifactSlots) throw new BillingError('conflict');
    return row;
  }
  private async files() {
    await privateDirectory(dirname(this.directory));
    await privateDirectory(this.directory);
  }
  private async load(artifact: Artifact): Promise<Buffer | null> {
    try {
      await this.files();
      const handle = await open(
        resolve(this.directory, `${artifact.id}.png`),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const info = await handle.stat();
        if (
          !info.isFile() ||
          info.nlink !== 1 ||
          info.uid !== process.getuid?.() ||
          (info.mode & 0o7777) !== 0o600 ||
          info.size !== artifact.bytes
        )
          return null;
        const bounded = Buffer.alloc(artifact.bytes + 1);
        let length = 0;
        while (length < bounded.length) {
          const result = await handle.read(bounded, length, bounded.length - length, length);
          if (!result.bytesRead) break;
          length += result.bytesRead;
        }
        if (length !== artifact.bytes) return null;
        const bytes = bounded.subarray(0, length);
        if (digest(bytes) !== artifact.sha256) return null;
        validatePng(bytes);
        return bytes;
      } finally {
        await handle.close();
      }
    } catch {
      return null;
    }
  }
  async generate(): Promise<Artifact> {
    const scope = currentExecution();
    const prompt = parseInput(briefSchema, scope.prompt);
    await scope.checkpoint();
    const identity = JSON.stringify(
      boundedJson({ prompt, profile: imageProfile, slot: scope.slot, budget: scope.collector.artifactSlots }),
    );
    const previous = await this.sql(async tx => {
      await this.active(tx, scope);
      const slot = (
        await tx.execute({
          sql: 'SELECT * FROM image_slots WHERE execution_id = ? AND slot = ?',
          args: [scope.collector.executionId, scope.slot],
        })
      ).rows[0];
      if (slot) {
        if (slot.identity !== identity) throw new BillingError('conflict');
        if (slot.state !== 'completed') throw new BillingError('state_unavailable');
        const row = (
          await tx.execute({ sql: 'SELECT metadata FROM image_artifacts WHERE id = ?', args: [slot.artifact_id] })
        ).rows[0];
        if (!row) throw new BillingError('state_unavailable');
        return parseInput(artifactSchema, JSON.parse(String(row.metadata)));
      }
      await tx.execute({
        sql: "INSERT INTO image_slots VALUES (?, ?, ?, 'dispatched', NULL)",
        args: [scope.collector.executionId, scope.slot, identity],
      });
      return null;
    });
    if (previous) {
      if (!(await this.load(previous))) throw new BillingError('state_unavailable');
      return previous;
    }
    let temporary: string | undefined;
    try {
      await scope.checkpoint();
      // A durable dispatch claim is never automatically reissued, including after timeout or process death.
      const signal = AbortSignal.any([scope.signal, AbortSignal.timeout(120000)]);
      const response = await fetch(
        `${(this.environment.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/images/generations`,
        {
          method: 'POST',
          signal,
          redirect: 'error',
          headers: {
            authorization: `Bearer ${this.environment.OPENAI_API_KEY ?? ''}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ ...imageProfile, prompt }),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new BillingError('state_unavailable');
      }
      const limit = 12 * 1024 * 1024;
      if (Number(response.headers.get('content-length')) > limit) {
        await response.body?.cancel();
        throw new BillingError('state_unavailable');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new BillingError('state_unavailable');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > limit) throw new BillingError('state_unavailable');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const data = parseInput(responseSchema, JSON.parse(Buffer.concat(chunks).toString('utf8'))).data[0].b64_json;
      if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new BillingError('state_unavailable');
      const bytes = Buffer.from(data, 'base64');
      if (bytes.toString('base64') !== data) throw new BillingError('state_unavailable');
      if (bytes.length > maxImageBytes) throw new BillingError('state_unavailable');
      const dimensions = validatePng(bytes);
      await scope.checkpoint();
      await this.files();
      const id = randomUUID();
      temporary = resolve(this.directory, `${id}.tmp`);
      const handle = await open(
        temporary,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, resolve(this.directory, `${id}.png`));
      temporary = undefined;
      const directory = await open(this.directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
      return await this.sql(async tx => {
        const execution = await this.active(tx, scope);
        const artifact = parseInput(artifactSchema, {
          id,
          executionId: scope.collector.executionId,
          accountId: execution.account_id,
          workspaceId: scope.collector.identity.workspaceId,
          creatorId: scope.collector.identity.actorId,
          filename: `image-${scope.slot + 1}.png`,
          title: `Generated image ${scope.slot + 1}`,
          mime: 'image/png',
          ...dimensions,
          bytes: bytes.length,
          sha256: digest(bytes),
        });
        await tx.execute({
          sql: 'INSERT INTO image_artifacts VALUES (?, ?, ?, ?)',
          args: [id, scope.collector.executionId, scope.slot, JSON.stringify(artifact)],
        });
        await tx.execute({
          sql: "UPDATE image_slots SET state = 'completed', artifact_id = ? WHERE execution_id = ? AND slot = ? AND state = 'dispatched'",
          args: [id, scope.collector.executionId, scope.slot],
        });
        return artifact;
      });
    } catch {
      await this.sql(tx =>
        tx.execute({
          sql: "UPDATE image_slots SET state = 'uncertain' WHERE execution_id = ? AND slot = ? AND state = 'dispatched'",
          args: [scope.collector.executionId, scope.slot],
        }),
      ).catch(() => {});
      throw new BillingError('state_unavailable');
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
    }
  }
  async completed(scope: ExecutionScope): Promise<Artifact> {
    await scope.checkpoint();
    const artifact = await this.sql(async tx => {
      await this.active(tx, scope);
      const row = (
        await tx.execute({
          sql: `SELECT a.metadata FROM image_slots s JOIN image_artifacts a ON a.id = s.artifact_id
        WHERE s.execution_id = ? AND s.slot = ? AND s.state = 'completed'`,
          args: [scope.collector.executionId, scope.slot],
        })
      ).rows[0];
      if (!row) throw new BillingError('state_unavailable');
      return parseInput(artifactSchema, JSON.parse(String(row.metadata)));
    });
    if (!(await this.load(artifact))) throw new BillingError('state_unavailable');
    return artifact;
  }
  async completeKit(scope: ExecutionScope, value: unknown) {
    const output = parseInput(kitOutputSchema, value);
    const artifacts: Artifact[] = [];
    for (let slot = 0; slot < 3; slot++) artifacts.push(await this.completed({ ...scope, slot }));
    if (JSON.stringify(artifacts) !== JSON.stringify(output.artifacts)) throw new BillingError('state_unavailable');
    return output;
  }
  async read(identity: AdmissionIdentity, artifactId: string) {
    const id = parseInput(z.uuid(), artifactId);
    const artifact = await this.sql(async tx => {
      await this.owned(tx, identity);
      const row = (
        await tx.execute({
          sql: `SELECT a.metadata FROM image_artifacts a JOIN billing_executions e ON e.id = a.execution_id
        WHERE a.id = ? AND e.actor_id = ? AND e.workspace_id = ? AND e.status = 'completed' AND e.settlement IN ('settled', 'not_required')`,
          args: [id, identity.actorId, identity.workspaceId],
        })
      ).rows[0];
      if (!row) throw new BillingError('forbidden');
      return parseInput(artifactSchema, JSON.parse(String(row.metadata)));
    });
    const bytes = await this.load(artifact);
    return bytes ? { bytes, filename: artifact.filename, mime: artifact.mime } : null;
  }
}
