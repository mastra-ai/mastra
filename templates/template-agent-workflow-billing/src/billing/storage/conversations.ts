import { createHash, randomUUID } from 'node:crypto';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { Row, Transaction } from '@libsql/client/node';
import { BillingError, identifierSchema, parseInput } from '../contracts/core.js';
import { boundedJson, fingerprint } from '../runtime/accounting.js';
import type { Json } from '../runtime/accounting.js';
import type { BillingContext, OrganizationService } from '../organizations.js';
import { BillingDatabase } from './database.js';

export interface ConversationOwner {
  readonly actorId: string;
  readonly workspaceId: string;
  readonly agentId: string;
  readonly threadId: string;
  readonly resourceId: string;
}
export interface ConversationOperation {
  readonly id: string;
  readonly resourceId: string;
  readonly action: string;
  readonly requestKey: string;
  readonly executionId: string | null;
  readonly pending: Json | null;
}
const operation = (row: Row): ConversationOperation => ({
  id: String(row.id),
  resourceId: String(row.resource_id),
  action: String(row.action),
  requestKey: String(row.request_key),
  executionId: row.execution_id === null ? null : String(row.execution_id),
  pending: row.pending === null ? null : boundedJson(JSON.parse(String(row.pending))),
});

/** Minimal durable conversation references. Mastra alone owns transcript content. */
export class ConversationStorage {
  private constructor(
    private readonly database: BillingDatabase,
    private readonly organizations: OrganizationService,
  ) {}
  static async open(url: string, organizations: OrganizationService) {
    return new ConversationStorage(await BillingDatabase.open({ url }), organizations);
  }
  close() {
    this.database.close();
  }
  private newResource(context: BillingContext, agentId: string) {
    return (
      'billing-studio:' +
      createHash('sha256')
        .update(JSON.stringify([context.actorId, context.workspaceId, agentId]))
        .digest('hex')
    );
  }
  private async ownerResource(tx: Transaction, context: BillingContext, agentId: string) {
    const row = (
      await tx.execute({
        sql: 'SELECT resource_id FROM billing_studio_threads WHERE actor_id = ? AND workspace_id = ? AND agent_id = ? LIMIT 1',
        args: [context.actorId, context.workspaceId, agentId],
      })
    ).rows[0];
    // Preserve existing transcripts, including resources created before the reserved namespace.
    return row ? String(row.resource_id) : this.newResource(context, agentId);
  }
  async resource(context: BillingContext, agentId: string) {
    return this.authorized(context, tx => this.ownerResource(tx, context, agentId));
  }
  /** Ordinary native routes can never address a decorated conversation, even as its owner. */
  async assertUnprotected(
    references: { threads: string[]; resources: string[]; runs: string[]; messages: string[] },
    storage: MastraCompositeStore,
  ) {
    if (references.resources.some(resource => resource.startsWith('billing-studio:')))
      throw new BillingError('forbidden');
    if (references.messages.length) {
      const memory = await storage.getStore('memory');
      if (!memory) throw new BillingError('state_unavailable');
      const { messages } = await memory.listMessagesById({ messageIds: references.messages });
      references.threads.push(...messages.flatMap(message => (message.threadId ? [message.threadId] : [])));
      references.resources.push(...messages.flatMap(message => (message.resourceId ? [message.resourceId] : [])));
    }
    if (!references.threads.length && !references.resources.length && !references.runs.length) return;
    return this.database.write(async tx => {
      for (const [values, table, column] of [
        [references.threads, 'billing_studio_threads', 'thread_id'],
        [references.resources, 'billing_studio_threads', 'resource_id'],
        [references.runs, 'billing_studio_runs', 'run_id'],
      ] as const) {
        if (!values.length) continue;
        const found = (
          await tx.execute({
            sql: `SELECT 1 FROM ${table} WHERE ${column} IN (${values.map(() => '?').join(',')}) LIMIT 1`,
            args: values,
          })
        ).rows.length;
        if (found) throw new BillingError('forbidden');
      }
    });
  }
  private async authorized<T>(context: BillingContext, work: (tx: Transaction) => Promise<T>): Promise<T> {
    const identity = await this.organizations.accountingIdentity(context);
    return this.database.write(async tx => {
      if (identity.validUntil !== null && identity.validUntil <= Date.now()) throw new BillingError('unauthenticated');
      if (identity.credentialHash !== null) {
        const credential = (
          await tx.execute({
            sql: 'SELECT active FROM local_credentials WHERE hash = ? AND identity_id = ?',
            args: [identity.credentialHash, identity.actorId],
          })
        ).rows[0];
        if (credential?.active !== 1n) throw new BillingError('unauthenticated');
      }
      await this.organizations.storage.authorizeInTransaction(tx, identity.actorId, identity.workspaceId, 'execute');
      return work(tx);
    });
  }
  private async requireOwner(tx: Transaction, context: BillingContext, agentId: string, threadId: string) {
    const row = (
      await tx.execute({ sql: 'SELECT * FROM billing_studio_threads WHERE thread_id = ?', args: [threadId] })
    ).rows[0];
    if (
      !row ||
      row.actor_id !== context.actorId ||
      row.workspace_id !== context.workspaceId ||
      row.agent_id !== agentId
    )
      throw new BillingError('forbidden');
    return {
      actorId: context.actorId,
      workspaceId: context.workspaceId,
      agentId,
      threadId,
      resourceId: String(row.resource_id),
    };
  }
  async thread(
    context: BillingContext,
    agentId: string,
    threadId: string,
    create = false,
    existingNativeThread = false,
  ): Promise<ConversationOwner> {
    parseInput(identifierSchema, agentId);
    parseInput(identifierSchema, threadId);
    return this.authorized(context, async tx => {
      if (create) {
        const linked = (
          await tx.execute({ sql: 'SELECT 1 FROM billing_studio_threads WHERE thread_id = ?', args: [threadId] })
        ).rows.length;
        // A shared Memory thread without our durable owner link is never ours to claim.
        if (!linked && existingNativeThread) throw new BillingError('forbidden');
        await tx.execute({
          sql: 'INSERT INTO billing_studio_threads VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
          args: [
            threadId,
            context.actorId,
            context.workspaceId,
            agentId,
            await this.ownerResource(tx, context, agentId),
          ],
        });
      }
      return this.requireOwner(tx, context, agentId, threadId);
    });
  }
  async run(context: BillingContext, agentId: string, runId: string): Promise<ConversationOwner> {
    parseInput(identifierSchema, runId);
    return this.authorized(context, async tx => {
      const row = (
        await tx.execute({ sql: 'SELECT thread_id FROM billing_studio_runs WHERE run_id = ?', args: [runId] })
      ).rows[0];
      if (!row) throw new BillingError('forbidden');
      return this.requireOwner(tx, context, agentId, String(row.thread_id));
    });
  }
  async bindRun(context: BillingContext, owner: ConversationOwner, runId: string) {
    parseInput(identifierSchema, runId);
    return this.authorized(context, async tx => {
      await this.requireOwner(tx, context, owner.agentId, owner.threadId);
      await tx.execute({
        sql: 'INSERT INTO billing_studio_runs VALUES (?, ?) ON CONFLICT DO NOTHING',
        args: [runId, owner.threadId],
      });
      const row = (
        await tx.execute({ sql: 'SELECT thread_id FROM billing_studio_runs WHERE run_id = ?', args: [runId] })
      ).rows[0];
      if (row.thread_id !== owner.threadId) throw new BillingError('conflict');
    });
  }
  async claim(
    context: BillingContext,
    owner: ConversationOwner,
    input: {
      messageId: string;
      toolCallId: string;
      resourceId: string;
      action: string;
      input: Json;
      executionId?: string;
      pending?: Json;
    },
  ) {
    const digest = fingerprint(input.input);
    return this.authorized(context, async tx => {
      await this.requireOwner(tx, context, owner.agentId, owner.threadId);
      // The link fixes the immutable request identity. Workflow starts also use
      // durable create/start claims to recover before dispatch without repeating compute.
      const id = randomUUID();
      const inserted = await tx.execute({
        sql: 'INSERT INTO billing_studio_operations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (thread_id, tool_call_id) DO NOTHING',
        args: [
          id,
          owner.threadId,
          input.messageId,
          input.toolCallId,
          input.resourceId,
          input.action,
          digest,
          randomUUID(),
          input.executionId ?? null,
          input.pending === undefined ? null : JSON.stringify(input.pending),
        ],
      });
      const row = (
        await tx.execute({
          sql: 'SELECT * FROM billing_studio_operations WHERE thread_id = ? AND tool_call_id = ?',
          args: [owner.threadId, input.toolCallId],
        })
      ).rows[0];
      if (
        row.message_id !== input.messageId ||
        row.fingerprint !== digest ||
        row.action !== input.action ||
        row.resource_id !== input.resourceId
      )
        throw new BillingError('conflict');
      return { ...operation(row), claimed: inserted.rowsAffected === 1 };
    });
  }
  /** Recover at most twenty initiating operations when a native response was lost. */
  async list(context: BillingContext, owner: ConversationOwner, resourceId: string) {
    parseInput(identifierSchema, resourceId);
    return this.authorized(context, async tx => {
      await this.requireOwner(tx, context, owner.agentId, owner.threadId);
      const rows = (
        await tx.execute({
          sql: "SELECT * FROM billing_studio_operations WHERE thread_id = ? AND resource_id = ? AND action IN ('generate', 'start') ORDER BY rowid DESC LIMIT 20",
          args: [owner.threadId, resourceId],
        })
      ).rows;
      return rows.map(operation);
    });
  }
  async get(context: BillingContext, owner: ConversationOwner, id: string, toolCall = false) {
    parseInput(identifierSchema, id);
    return this.authorized(context, async tx => {
      await this.requireOwner(tx, context, owner.agentId, owner.threadId);
      const row = (
        await tx.execute({
          sql: `SELECT * FROM billing_studio_operations WHERE thread_id = ? AND ${toolCall ? 'tool_call_id' : 'id'} = ?`,
          args: [owner.threadId, id],
        })
      ).rows[0];
      if (!row) throw new BillingError('forbidden');
      return operation(row);
    });
  }
  async approval(context: BillingContext, owner: ConversationOwner, id: string, approved: boolean, claim = false) {
    return this.authorized(context, async tx => {
      await this.requireOwner(tx, context, owner.agentId, owner.threadId);
      const operation = (
        await tx.execute({
          sql: 'SELECT id FROM billing_studio_operations WHERE id = ? AND thread_id = ?',
          args: [id, owner.threadId],
        })
      ).rows[0];
      if (!operation) throw new BillingError('forbidden');
      if (claim)
        await tx.execute({
          sql: 'INSERT INTO billing_studio_approvals (operation_id, approved) VALUES (?, ?) ON CONFLICT DO NOTHING',
          args: [id, approved ? 1 : 0],
        });
      const row = (
        await tx.execute({ sql: 'SELECT * FROM billing_studio_approvals WHERE operation_id = ?', args: [id] })
      ).rows[0];
      if (row && row.approved !== (approved ? 1n : 0n)) throw new BillingError('conflict');
      return row ? { accepted: row.accepted === 1n } : null;
    });
  }
  async acceptApproval(context: BillingContext, owner: ConversationOwner, toolCallId: string) {
    const operation = await this.get(context, owner, toolCallId, true);
    await this.authorized(context, tx =>
      tx.execute({
        sql: 'UPDATE billing_studio_approvals SET accepted = 1 WHERE operation_id = ? AND accepted = 0',
        args: [operation.id],
      }),
    );
  }
  async bindExecution(context: BillingContext, owner: ConversationOwner, id: string, executionId: string) {
    return this.authorized(context, async tx => {
      await this.requireOwner(tx, context, owner.agentId, owner.threadId);
      const changed = await tx.execute({
        sql: 'UPDATE billing_studio_operations SET execution_id = ? WHERE id = ? AND thread_id = ? AND execution_id IS NULL',
        args: [executionId, id, owner.threadId],
      });
      if (!changed.rowsAffected) {
        const row = (
          await tx.execute({
            sql: 'SELECT execution_id FROM billing_studio_operations WHERE id = ? AND thread_id = ?',
            args: [id, owner.threadId],
          })
        ).rows[0];
        if (row?.execution_id !== executionId) throw new BillingError('conflict');
      }
    });
  }
}
