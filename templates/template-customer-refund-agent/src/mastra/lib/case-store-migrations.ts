import type { Client } from "@libsql/client";
import { createHash } from "node:crypto";
import type { CaseFeedback } from "../domain/support-case";
import { type ProviderBinding } from "../providers/contracts";
import { now, parseLegacyCase, caseBinding } from "./case-store-shared";

export class CaseStoreMigrations {
  constructor(private readonly client: Client) {}
  async migrate(target = 26): Promise<void> {
    await this.client.execute(
      "CREATE TABLE IF NOT EXISTS support_schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    const applied = await this.client.execute(
      "SELECT version FROM support_schema_migrations ORDER BY version",
    );
    let version = Number(applied.rows.at(-1)?.version ?? 0);
    if (!Number.isInteger(target) || target < 0 || target > 26)
      throw new Error("Unsupported support schema target version.");
    // Versions 6 through 8 introduced append-only turn, decision, and audit
    // records. Their inverse would discard or weaken durable financial/replay
    // evidence, so refuse before changing any schema or migration marker.
    if (version >= 6 && target < version)
      throw new Error(
        `Refusing unsupported downgrade from support schema v${version} to v${target}.`,
      );
    while (version < target) {
      version += 1;
      await this.up(version);
    }
    while (version > target) {
      await this.down(version);
      version -= 1;
    }
  }
  private async up(version: number) {
    if (version === 1)
      await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS support_cases (id TEXT PRIMARY KEY, source TEXT NOT NULL, external_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS support_cases_source_external_id ON support_cases(source, external_id);
    `);
    if (version === 2) {
      for (const sql of [
        "ALTER TABLE support_cases ADD COLUMN version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE support_cases ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'local-demo'",
        'ALTER TABLE support_cases ADD COLUMN provider_binding TEXT NOT NULL DEFAULT \'{"tenantId":"local-demo","providerKind":"local","providerAccountId":"local-demo","externalConversationId":"legacy"}\'',
      ]) {
        try {
          await this.client.execute(sql);
        } catch (error) {
          if (!String(error).includes("duplicate column")) throw error;
        }
      }
      await this.client.executeMultiple(`
        CREATE TABLE IF NOT EXISTS support_messages (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS support_events (id TEXT PRIMARY KEY, source TEXT NOT NULL, external_id TEXT NOT NULL, case_id TEXT NOT NULL, accepted_at TEXT NOT NULL, UNIQUE(source, external_id));
        CREATE TABLE IF NOT EXISTS support_actions (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, kind TEXT NOT NULL, fingerprint TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(kind, fingerprint));
        CREATE TABLE IF NOT EXISTS support_idempotency (idempotency_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, effect TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS support_dispatch (id TEXT PRIMARY KEY, case_id TEXT NOT NULL UNIQUE, run_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, lease_until TEXT, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS support_outbox (id TEXT PRIMARY KEY, case_id TEXT NOT NULL, binding TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, receipt TEXT, last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS support_outbox_claimable ON support_outbox(state, created_at);
      `);
      const cases = await this.client.execute(
        "SELECT id, data FROM support_cases",
      );
      for (const row of cases.rows)
        for (const message of parseLegacyCase(row as Record<string, unknown>)
          .messages)
          await this.client.execute({
            sql: "INSERT OR IGNORE INTO support_messages(id, case_id, data, created_at) VALUES (?, ?, ?, ?)",
            args: [
              message.id,
              String(row.id),
              JSON.stringify(message),
              message.createdAt,
            ],
          });
    }
    if (version === 3) await this.up3();
    if (version === 4) await this.up4();
    if (version === 5) await this.up5();
    if (version === 6) await this.up6();
    if (version === 7) await this.up7();
    if (version === 8) await this.up8();
    if (version === 9) {
      await this.up9();
      return;
    }
    if (version === 10) {
      await this.up10();
      return;
    }
    if (version === 11) {
      await this.up11();
      return;
    }
    if (version === 12) {
      await this.up12();
      return;
    }
    if (version === 13) {
      await this.up13();
      return;
    }
    if (version === 16) {
      await this.up16();
      return;
    }
    if (version === 17) {
      await this.up17();
      return;
    }
    if (version === 18) {
      await this.up18();
      return;
    }
    if (version === 19) {
      await this.up19();
      return;
    }
    if (version === 20) {
      await this.up20();
      return;
    }
    if (version === 21) {
      await this.up21();
      return;
    }
    if (version === 22) {
      await this.up22();
      return;
    }
    if (version === 23) {
      await this.up23();
      return;
    }
    if (version === 24) {
      await this.up24();
      return;
    }
    if (version === 25) {
      await this.up25();
      return;
    }
    if (version === 26) {
      await this.up26();
      return;
    }
    if (version === 14) {
      await this.up14();
      return;
    }
    if (version === 15) {
      await this.up15();
      return;
    }
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (?, ?)",
      args: [version, now()],
    });
  }
  private async up3() {
    try {
      await this.client.execute(
        "ALTER TABLE support_outbox ADD COLUMN lease_until TEXT",
      );
    } catch (error) {
      if (!String(error).includes("duplicate column")) throw error;
    }
    const columns = await this.client.execute(
      "PRAGMA table_info(support_events)",
    );
    if (columns.rows.some((row) => String(row.name) === "tenant_id")) return;

    // Do not let a partly-applied ALTER skip this table rebuild.  The old event
    // key was global; the persisted case binding supplies the scoped key.
    const events = await this.client.execute("SELECT * FROM support_events");
    const cases = await this.client.execute(
      "SELECT id, tenant_id, provider_binding FROM support_cases",
    );
    const bindings = new Map(
      cases.rows.map((row) => {
        const value = row as Record<string, unknown>;
        const binding = JSON.parse(
          String(value.provider_binding),
        ) as ProviderBinding;
        return [String(value.id), binding] as const;
      }),
    );
    const tx = await this.client.transaction("write");
    try {
      await tx.executeMultiple(
        "CREATE TABLE support_events_v3 (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, source TEXT NOT NULL, external_id TEXT NOT NULL, case_id TEXT NOT NULL, accepted_at TEXT NOT NULL, UNIQUE(tenant_id, provider_account_id, source, external_id));",
      );
      for (const row of events.rows) {
        const event = row as Record<string, unknown>;
        const binding = bindings.get(String(event.case_id));
        await tx.execute({
          sql: "INSERT INTO support_events_v3(id, tenant_id, provider_account_id, source, external_id, case_id, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [
            String(event.id),
            binding?.tenantId ?? "local-demo",
            binding?.providerAccountId ?? "local-demo",
            String(event.source),
            String(event.external_id),
            String(event.case_id),
            String(event.accepted_at),
          ],
        });
      }
      await tx.executeMultiple(
        "DROP TABLE support_events; ALTER TABLE support_events_v3 RENAME TO support_events;",
      );
      await tx.commit();
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  private async up4() {
    const indexes = await this.client.execute(
      "PRAGMA index_list(support_cases)",
    );
    const scoped = indexes.rows.some(
      (row) => String(row.name) === "support_cases_scoped_external_id",
    );
    if (scoped) return;
    const tx = await this.client.transaction("write");
    try {
      const cases = await tx.execute("SELECT * FROM support_cases");
      await tx.executeMultiple(
        "CREATE TABLE support_cases_v4 (id TEXT PRIMARY KEY, source TEXT NOT NULL, external_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, provider_binding TEXT NOT NULL);",
      );
      for (const row of cases.rows) {
        const value = row as Record<string, unknown>;
        const binding = JSON.parse(
          String(value.provider_binding),
        ) as ProviderBinding;
        await tx.execute({
          sql: "INSERT INTO support_cases_v4(id, source, external_id, data, created_at, updated_at, version, tenant_id, provider_account_id, provider_binding) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          args: [
            String(value.id),
            String(value.source),
            String(value.external_id),
            String(value.data),
            String(value.created_at),
            String(value.updated_at),
            Number(value.version),
            binding.tenantId,
            binding.providerAccountId,
            String(value.provider_binding),
          ],
        });
      }
      await tx.executeMultiple(`
        DROP TABLE support_cases;
        ALTER TABLE support_cases_v4 RENAME TO support_cases;
        CREATE UNIQUE INDEX support_cases_scoped_external_id ON support_cases(tenant_id, provider_account_id, source, external_id);
      `);
      await tx.commit();
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  private async up5() {
    for (const sql of [
      "ALTER TABLE support_dispatch ADD COLUMN lease_token TEXT",
      "ALTER TABLE support_outbox ADD COLUMN lease_token TEXT",
    ]) {
      try {
        await this.client.execute(sql);
      } catch (error) {
        if (!String(error).includes("duplicate column")) throw error;
      }
    }
  }
  /** Phase 003 audit records are append-only.  The current case projection is
   * useful for UI, but it is never the authority for a second decision. */
  private async up6() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS support_turns (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        state TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(case_id, event_id),
        UNIQUE(case_id, sequence)
      );
      CREATE TABLE IF NOT EXISTS support_decisions (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL UNIQUE,
        command_fingerprint TEXT NOT NULL,
        native_run_id TEXT,
        native_tool_call_id TEXT,
        principal_id TEXT NOT NULL,
        approved INTEGER NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS support_audit (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        actor_id TEXT,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }
  /** A case is a conversation, not a work item. Each inbound turn owns a
   * separate dispatch and may create its own immutable approval command. */
  private async up7() {
    const tx = await this.client.transaction("write");
    try {
      await tx
        .executeMultiple(
          `
        ALTER TABLE support_turns ADD COLUMN run_id TEXT;
        ALTER TABLE support_turns ADD COLUMN command_fingerprint TEXT;
      `,
        )
        .catch?.(() => undefined);
      // SQLite cannot drop the old case_id UNIQUE constraint in place.
      await tx.executeMultiple(`
        CREATE TABLE support_dispatch_v7 (
          id TEXT PRIMARY KEY,
          case_id TEXT NOT NULL,
          turn_id TEXT NOT NULL UNIQUE,
          run_id TEXT NOT NULL UNIQUE,
          state TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          lease_until TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          lease_token TEXT
        );
        INSERT INTO support_dispatch_v7(id, case_id, turn_id, run_id, state, attempts, lease_until, last_error, created_at, updated_at, lease_token)
        SELECT id, case_id, 'legacy:' || case_id, run_id, state, attempts, lease_until, last_error, created_at, updated_at, lease_token FROM support_dispatch;
        DROP TABLE support_dispatch;
        ALTER TABLE support_dispatch_v7 RENAME TO support_dispatch;
        CREATE INDEX support_dispatch_claimable ON support_dispatch(state, created_at);
        CREATE INDEX support_dispatch_case_state ON support_dispatch(case_id, state, created_at);

        CREATE TABLE support_decisions_v7 (
          id TEXT PRIMARY KEY,
          case_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          command_fingerprint TEXT NOT NULL,
          native_run_id TEXT,
          native_tool_call_id TEXT,
          principal_id TEXT NOT NULL,
          approved INTEGER NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(case_id, turn_id, command_fingerprint)
        );
        INSERT INTO support_decisions_v7(id, case_id, turn_id, command_fingerprint, native_run_id, native_tool_call_id, principal_id, approved, note, created_at)
        SELECT id, case_id, 'legacy:' || case_id, command_fingerprint, native_run_id, native_tool_call_id, principal_id, approved, note, created_at FROM support_decisions;
        DROP TABLE support_decisions;
        ALTER TABLE support_decisions_v7 RENAME TO support_decisions;
        CREATE INDEX support_decisions_command ON support_decisions(case_id, command_fingerprint);
      `);
      await tx.commit();
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /** Per-turn inputs and outputs are immutable history. The case remains only
   * the current active-turn projection used by the UI. */
  private async up8() {
    for (const sql of [
      "ALTER TABLE support_turns ADD COLUMN message_data TEXT",
      "ALTER TABLE support_turns ADD COLUMN outcome_data TEXT",
    ]) {
      try {
        await this.client.execute(sql);
      } catch (error) {
        if (!String(error).includes("duplicate column")) throw error;
      }
    }
    const rows = await this.client.execute(
      "SELECT support_turns.id, support_turns.case_id, support_turns.sequence, support_cases.data FROM support_turns JOIN support_cases ON support_cases.id = support_turns.case_id WHERE support_turns.message_data IS NULL",
    );
    for (const row of rows.rows) {
      const value = row as Record<string, unknown>;
      const supportCase = parseLegacyCase({ data: value.data });
      const message = supportCase.messages.filter(
        (entry) => entry.author === "customer",
      )[Math.max(0, Number(value.sequence) - 1)];
      if (message)
        await this.client.execute({
          sql: "UPDATE support_turns SET message_data = ? WHERE id = ?",
          args: [JSON.stringify(message), String(value.id)],
        });
    }
  }
  /** Canonical conversation identity and trusted acceptance time are persisted
   * independently of provider-supplied event timestamps.  Historical conflicts
   * must be resolved by an operator, never guessed and merged by a migration. */
  private async up9() {
    const nowAtMigration = now();
    const tx = await this.client.transaction("write");
    try {
      try {
        await tx.execute(
          "ALTER TABLE support_cases ADD COLUMN accepted_at TEXT",
        );
      } catch (error) {
        if (!String(error).includes("duplicate column")) throw error;
      }
      await tx.executeMultiple(`
        CREATE TABLE IF NOT EXISTS support_conversations (
          tenant_id TEXT NOT NULL,
          provider_kind TEXT NOT NULL,
          provider_account_id TEXT NOT NULL,
          external_conversation_id TEXT NOT NULL,
          case_id TEXT NOT NULL UNIQUE,
          owner_id TEXT NOT NULL,
          PRIMARY KEY(tenant_id, provider_kind, provider_account_id, external_conversation_id)
        );
      `);
      const cases = await tx.execute(
        "SELECT id, data, created_at, accepted_at FROM support_cases",
      );
      for (const row of cases.rows) {
        const value = row as Record<string, unknown>;
        const supportCase = parseLegacyCase(value);
        const binding = caseBinding(supportCase);
        const storedOwner = supportCase.metadata.ownerId;
        const ownerId =
          typeof storedOwner === "string" && storedOwner
            ? storedOwner
            : `legacy:${createHash("sha256").update(String(value.id)).digest("hex")}`;
        const existing = await tx.execute({
          sql: "SELECT case_id, owner_id FROM support_conversations WHERE tenant_id = ? AND provider_kind = ? AND provider_account_id = ? AND external_conversation_id = ?",
          args: [
            binding.tenantId,
            binding.providerKind,
            binding.providerAccountId,
            binding.externalConversationId,
          ],
        });
        if (
          existing.rows[0] &&
          (String(existing.rows[0].case_id) !== String(value.id) ||
            String(existing.rows[0].owner_id) !== ownerId)
        )
          throw new Error(
            `Refusing canonical conversation migration: ambiguous historical conversation ${binding.tenantId}/${binding.providerAccountId}/${binding.externalConversationId}.`,
          );
        await tx.execute({
          sql: "INSERT OR IGNORE INTO support_conversations(tenant_id, provider_kind, provider_account_id, external_conversation_id, case_id, owner_id) VALUES (?, ?, ?, ?, ?, ?)",
          args: [
            binding.tenantId,
            binding.providerKind,
            binding.providerAccountId,
            binding.externalConversationId,
            String(value.id),
            ownerId,
          ],
        });
        const evidence = await tx.execute({
          sql: "SELECT accepted_at FROM support_events WHERE case_id = ? ORDER BY accepted_at LIMIT 1",
          args: [String(value.id)],
        });
        const candidate = String(
          evidence.rows[0]?.accepted_at ?? value.created_at,
        );
        const acceptedAt =
          Number.isNaN(Date.parse(candidate)) || candidate > nowAtMigration
            ? nowAtMigration
            : candidate;
        await tx.execute({
          sql: "UPDATE support_cases SET accepted_at = COALESCE(accepted_at, ?) WHERE id = ?",
          args: [acceptedAt, String(value.id)],
        });
      }
      await tx.execute({
        sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (9, ?)",
        args: [now()],
      });
      await tx.commit();
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /** Ratings belong to the response turn, not the mutable case projection. */
  private async up10() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS support_feedback (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(case_id, turn_id, actor_id)
      );
      CREATE INDEX IF NOT EXISTS support_feedback_case_created
        ON support_feedback(case_id, created_at DESC);
    `);
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (10, ?)",
      args: [now()],
    });
  }
  /**
   * Phase 004 makes both the response correlation and the feedback history
   * durable. Existing outbox/feedback rows are retained: a row is backfilled
   * only when its deterministic final-response id identifies exactly one turn;
   * all other historical attribution is explicitly marked unknown.
   */
  private async up11() {
    const outboxRows = await this.client.execute(
      "SELECT id, case_id FROM support_outbox",
    );
    const feedbackRows = await this.client.execute(
      "SELECT id, case_id, turn_id, actor_id, data, created_at FROM support_feedback",
    );
    const cases = await this.client.execute(
      "SELECT id, data FROM support_cases",
    );
    const tx = await this.client.transaction("write");
    try {
      for (const sql of [
        "ALTER TABLE support_outbox ADD COLUMN originating_turn_id TEXT",
        "ALTER TABLE support_outbox ADD COLUMN originating_run_id TEXT",
        "ALTER TABLE support_outbox ADD COLUMN originating_trace_id TEXT",
        "ALTER TABLE support_outbox ADD COLUMN correlation_state TEXT NOT NULL DEFAULT 'unknown'",
      ]) {
        try {
          await tx.execute(sql);
        } catch (error) {
          if (!String(error).includes("duplicate column")) throw error;
        }
      }
      for (const row of outboxRows.rows) {
        const caseId = String(row.case_id);
        const turns = await tx.execute({
          sql: "SELECT id, run_id, outcome_data FROM support_turns WHERE case_id = ?",
          args: [caseId],
        });
        const turn = turns.rows.find(
          (candidate) =>
            String(row.id) === `outbox_${caseId}_${String(candidate.id)}_final`,
        ) as Record<string, unknown> | undefined;
        if (!turn) continue;
        const outcome = turn.outcome_data
          ? (JSON.parse(String(turn.outcome_data)) as {
              telemetry?: { traceId?: unknown };
            })
          : undefined;
        const traceId = outcome?.telemetry?.traceId;
        await tx.execute({
          sql: "UPDATE support_outbox SET originating_turn_id = ?, originating_run_id = ?, originating_trace_id = ?, correlation_state = ? WHERE id = ?",
          args: [
            String(turn.id),
            turn.run_id ? String(turn.run_id) : null,
            typeof traceId === "string" ? traceId : null,
            typeof traceId === "string" ? "known" : "unknown",
            String(row.id),
          ],
        });
      }
      await tx.executeMultiple(`
        CREATE TABLE support_feedback_v11 (
          id TEXT PRIMARY KEY,
          case_id TEXT NOT NULL,
          turn_id TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT,
          dedupe_key TEXT NOT NULL,
          attribution_state TEXT NOT NULL DEFAULT 'known'
        );
      `);
      for (const row of feedbackRows.rows) {
        const feedback = JSON.parse(String(row.data)) as { rating?: unknown };
        await tx.execute({
          sql: "INSERT INTO support_feedback_v11(id, case_id, turn_id, actor_id, data, created_at, dedupe_key, attribution_state) VALUES (?, ?, ?, ?, ?, ?, ?, 'known')",
          args: [
            String(row.id),
            String(row.case_id),
            String(row.turn_id),
            String(row.actor_id),
            String(row.data),
            row.created_at ? String(row.created_at) : null,
            String(feedback.rating ?? "unknown"),
          ],
        });
      }
      await tx.executeMultiple(`
        DROP TABLE support_feedback;
        ALTER TABLE support_feedback_v11 RENAME TO support_feedback;
        CREATE UNIQUE INDEX support_feedback_exact_rating
          ON support_feedback(case_id, turn_id, actor_id, dedupe_key);
        CREATE INDEX support_feedback_case_created
          ON support_feedback(case_id, created_at DESC);
      `);
      for (const row of cases.rows) {
        const supportCase = parseLegacyCase(row as Record<string, unknown>);
        if (!supportCase.feedback) continue;
        await this.insertLegacyFeedback(
          tx,
          supportCase.id,
          supportCase.feedback,
        );
      }
      await tx.execute({
        sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (11, ?)",
        args: [now()],
      });
      await tx.commit();
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /**
   * Supervisor traces are not operational workflow turns.  Store their
   * authenticated, tenant-qualified association append-only so a later
   * follow-up cannot overwrite the original correlation on the case record.
   */
  private async up12() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS support_supervisor_executions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        case_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        trace_id TEXT,
        state TEXT NOT NULL CHECK(state IN ('completed', 'failed')),
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS support_supervisor_executions_run
        ON support_supervisor_executions(run_id);
      CREATE INDEX IF NOT EXISTS support_supervisor_executions_tenant_case_created
        ON support_supervisor_executions(tenant_id, case_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS support_supervisor_executions_trace
        ON support_supervisor_executions(trace_id);
    `);
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (12, ?)",
      args: [now()],
    });
  }
  /** Additive outbox evolution.  Legacy rows retain their original binding
   * and are explicitly represented as reply operations; no provider route is
   * reinterpreted during migration. */
  private async up13() {
    const tx = await this.client.transaction("write");
    try {
      for (const sql of [
        "ALTER TABLE support_outbox ADD COLUMN operation TEXT NOT NULL DEFAULT 'reply'",
        "ALTER TABLE support_outbox ADD COLUMN payload_fingerprint TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE support_outbox ADD COLUMN next_attempt_at TEXT",
      ])
        try {
          await tx.execute(sql);
        } catch (error) {
          if (!String(error).includes("duplicate column")) throw error;
        }
      await tx.executeMultiple(`
        CREATE TABLE IF NOT EXISTS support_outbox_account_limits (
          tenant_id TEXT NOT NULL, provider_kind TEXT NOT NULL, provider_account_id TEXT NOT NULL,
          blocked_until TEXT NOT NULL, updated_at TEXT NOT NULL,
          PRIMARY KEY(tenant_id, provider_kind, provider_account_id)
        );
        CREATE INDEX IF NOT EXISTS support_outbox_claimable_v13 ON support_outbox(state, next_attempt_at, created_at);
      `);
      const rows = await tx.execute(
        "SELECT id, binding, body, status, operation, payload_fingerprint FROM support_outbox",
      );
      for (const row of rows.rows) {
        const operation = String(row.operation || "reply");
        const fingerprint = createHash("sha256")
          .update(
            JSON.stringify({
              binding: JSON.parse(String(row.binding)),
              operation,
              body: String(row.body),
              status: String(row.status),
            }),
          )
          .digest("hex");
        await tx.execute({
          sql: "UPDATE support_outbox SET payload_fingerprint = ? WHERE id = ? AND payload_fingerprint = ''",
          args: [fingerprint, String(row.id)],
        });
      }
      await tx.execute({
        sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (13, ?)",
        args: [now()],
      });
      await tx.commit();
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /** Stripe accepts an idempotency key only for a bounded provider window.
   * Store intent before POST so a restart can retrieve/reconcile the original
   * refund instead of issuing a fresh request after that window expires. */
  private async up14() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS support_stripe_refund_attempts (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        command_fingerprint TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        dispatch_id TEXT NOT NULL,
        lease_token TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('prepared','pending','succeeded','failed','unknown','quarantined')),
        refund_id TEXT,
        provider_status TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        next_attempt_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS support_stripe_refund_attempt_command
        ON support_stripe_refund_attempts(case_id, command_fingerprint);
      CREATE INDEX IF NOT EXISTS support_stripe_refund_attempt_reconcile
        ON support_stripe_refund_attempts(status, next_attempt_at, updated_at);
    `);
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (14, ?)",
      args: [now()],
    });
  }
  /** Version 15 seals the command/turn that owns an external attempt. A
   * follow-up projection must never redirect an in-flight refund recovery. */
  private async up15() {
    for (const sql of [
      "ALTER TABLE support_stripe_refund_attempts ADD COLUMN turn_id TEXT",
      "ALTER TABLE support_stripe_refund_attempts ADD COLUMN command_data TEXT",
    ])
      try {
        await this.client.execute(sql);
      } catch (error) {
        if (!String(error).includes("duplicate column")) throw error;
      }
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (15, ?)",
      args: [now()],
    });
  }
  /** Reconciliation is a separately fenced job.  A provider result can arrive
   * after the workflow lease ends, so workers claim a short CAS lease rather
   * than racing on every pending row. */
  private async up16() {
    for (const sql of [
      "ALTER TABLE support_stripe_refund_attempts ADD COLUMN reconcile_lease_token TEXT",
      "ALTER TABLE support_stripe_refund_attempts ADD COLUMN reconcile_lease_until TEXT",
    ])
      try {
        await this.client.execute(sql);
      } catch (error) {
        if (!String(error).includes("duplicate column")) throw error;
      }
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (16, ?)",
      args: [now()],
    });
  }
  /** The exact target/body for an uncertain Stripe POST is immutable before
   * the effect boundary. Recovery must not re-quote a changed balance. */
  private async up17() {
    try {
      await this.client.execute(
        "ALTER TABLE support_stripe_refund_attempts ADD COLUMN stripe_request_data TEXT",
      );
    } catch (error) {
      if (!String(error).includes("duplicate column")) throw error;
    }
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (17, ?)",
      args: [now()],
    });
  }
  /** Poll observations must not extend the 365-day financial audit period. */
  private async up18() {
    for (const sql of [
      "ALTER TABLE support_stripe_refund_attempts ADD COLUMN terminal_at TEXT",
      "ALTER TABLE support_stripe_refund_attempts ADD COLUMN reconcile_attempts INTEGER NOT NULL DEFAULT 0",
    ])
      try {
        await this.client.execute(sql);
      } catch (error) {
        if (!String(error).includes("duplicate column")) throw error;
      }
    await this.client.execute({
      sql: "UPDATE support_stripe_refund_attempts SET terminal_at = updated_at WHERE terminal_at IS NULL AND status IN ('succeeded', 'failed', 'quarantined')",
    });
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (18, ?)",
      args: [now()],
    });
  }
  private async up19() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS support_subscription_cancellation_attempts (
        idempotency_key TEXT PRIMARY KEY, case_id TEXT NOT NULL, turn_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, subscription_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL, command_data TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('prepared','scheduled','unknown','failed')),
        cancels_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS support_subscription_cancellation_command
        ON support_subscription_cancellation_attempts(case_id, fingerprint);
    `);
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (19, ?)",
      args: [now()],
    });
  }
  private async up20() {
    await this.client.executeMultiple(`
      CREATE TABLE support_subscription_cancellation_attempts_v20 (
        idempotency_key TEXT PRIMARY KEY, case_id TEXT NOT NULL, turn_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, subscription_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL, command_data TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('prepared','scheduled','unknown','failed','quarantined')),
        cancels_at TEXT, terminal_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO support_subscription_cancellation_attempts_v20(
        idempotency_key, case_id, turn_id, tenant_id, provider_account_id,
        subscription_id, fingerprint, command_data, status, cancels_at,
        terminal_at, created_at, updated_at
      ) SELECT
        idempotency_key, case_id, turn_id, tenant_id, provider_account_id,
        subscription_id, fingerprint, command_data, status, cancels_at,
        CASE WHEN status IN ('scheduled', 'failed') THEN updated_at ELSE NULL END,
        created_at, updated_at
      FROM support_subscription_cancellation_attempts;
      DROP TABLE support_subscription_cancellation_attempts;
      ALTER TABLE support_subscription_cancellation_attempts_v20
        RENAME TO support_subscription_cancellation_attempts;
      CREATE UNIQUE INDEX support_subscription_cancellation_command
        ON support_subscription_cancellation_attempts(case_id, fingerprint);
    `);
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (20, ?)",
      args: [now()],
    });
  }
  private async up21() {
    await this.client.executeMultiple(`
      CREATE TABLE support_subscription_cancellation_attempts_v21 (
        idempotency_key TEXT PRIMARY KEY, case_id TEXT NOT NULL, turn_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL, provider_account_id TEXT NOT NULL, subscription_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL, command_data TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('prepared','claimed','scheduled','unknown','failed','quarantined')),
        cancels_at TEXT, terminal_at TEXT, next_reconcile_at TEXT,
        reconcile_lease_token TEXT, reconcile_lease_until TEXT,
        reconcile_attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO support_subscription_cancellation_attempts_v21(
        idempotency_key, case_id, turn_id, tenant_id, provider_account_id,
        subscription_id, fingerprint, command_data, status, cancels_at,
        terminal_at, next_reconcile_at, reconcile_lease_token,
        reconcile_lease_until, reconcile_attempts, created_at, updated_at
      ) SELECT
        idempotency_key, case_id, turn_id, tenant_id, provider_account_id,
        subscription_id, fingerprint, command_data, status, cancels_at,
        terminal_at, CASE WHEN status = 'unknown' THEN updated_at ELSE NULL END,
        NULL, NULL, 0, created_at, updated_at
      FROM support_subscription_cancellation_attempts;
      DROP TABLE support_subscription_cancellation_attempts;
      ALTER TABLE support_subscription_cancellation_attempts_v21
        RENAME TO support_subscription_cancellation_attempts;
      CREATE UNIQUE INDEX support_subscription_cancellation_command
        ON support_subscription_cancellation_attempts(case_id, fingerprint);
      CREATE INDEX support_subscription_cancellation_recovery_due
        ON support_subscription_cancellation_attempts(status, next_reconcile_at);
    `);
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (21, ?)",
      args: [now()],
    });
  }
  /** A signed Stripe event is acknowledged only after its durable local work
   * is complete.  The receipt contains no raw webhook body or provider
   * payload; its short lease fences concurrent delivery attempts. */
  private async up22() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS support_stripe_webhook_receipts (
        event_id TEXT PRIMARY KEY,
        state TEXT NOT NULL CHECK(state IN ('processing','completed','failed')),
        lease_token TEXT,
        lease_until TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS support_stripe_webhook_receipts_retention
        ON support_stripe_webhook_receipts(state, completed_at, created_at);
    `);
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (22, ?)",
      args: [now()],
    });
  }
  /** CREDIT is a separate financial action, but Stripe's bounded idempotency
   * window creates the same crash boundary as refunds. Persist its exact
   * command before POST so recovery can search the customer's balance ledger
   * instead of ever issuing a second credit blindly. */
  private async up23() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS support_stripe_subscription_credit_attempts (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        command_fingerprint TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        dispatch_id TEXT NOT NULL,
        lease_token TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        command_data TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('prepared','succeeded','unknown','quarantined')),
        credit_id TEXT,
        provider_status TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS support_stripe_credit_attempt_command
        ON support_stripe_subscription_credit_attempts(case_id, command_fingerprint);
    `);
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (23, ?)",
      args: [now()],
    });
  }
  /** A customer/subscription credit is compensation, not a per-case effect.
   * Reserve that target before any provider preflight so separately approved
   * cases cannot both observe an empty Stripe ledger and post twice. */
  private async up24() {
    const tx = await this.client.transaction("write");
    try {
      await tx.executeMultiple(`
      CREATE TABLE support_stripe_subscription_credit_attempts_v24 (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        command_fingerprint TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        dispatch_id TEXT NOT NULL,
        lease_token TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        command_data TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('prepared','succeeded','unknown','failed','quarantined')),
        credit_id TEXT,
        provider_status TEXT,
        terminal_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO support_stripe_subscription_credit_attempts_v24(id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, credit_id, provider_status, terminal_at, created_at, updated_at)
        SELECT id, case_id, tenant_id, provider_account_id, command_fingerprint, idempotency_key, dispatch_id, lease_token, turn_id, command_data, status, credit_id, provider_status,
          CASE WHEN status IN ('succeeded','quarantined') THEN updated_at ELSE NULL END,
          created_at, updated_at
        FROM support_stripe_subscription_credit_attempts;
      DROP TABLE support_stripe_subscription_credit_attempts;
      ALTER TABLE support_stripe_subscription_credit_attempts_v24 RENAME TO support_stripe_subscription_credit_attempts;
      CREATE UNIQUE INDEX support_stripe_credit_attempt_command
        ON support_stripe_subscription_credit_attempts(case_id, command_fingerprint);
      CREATE TABLE IF NOT EXISTS support_stripe_subscription_credit_reservations (
        tenant_id TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        subscription_id TEXT NOT NULL,
        case_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        command_fingerprint TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK(status IN ('prepared','succeeded','unknown','failed','quarantined')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(tenant_id, provider_account_id, customer_id, subscription_id)
      );
      CREATE INDEX IF NOT EXISTS support_stripe_credit_reservation_retention
        ON support_stripe_subscription_credit_reservations(status, updated_at);
      INSERT OR IGNORE INTO support_stripe_subscription_credit_reservations(tenant_id, provider_account_id, customer_id, subscription_id, case_id, turn_id, command_fingerprint, idempotency_key, status, created_at, updated_at)
        SELECT tenant_id, provider_account_id,
          json_extract(command_data, '$.customerId'), json_extract(command_data, '$.subscriptionId'),
          case_id, turn_id, command_fingerprint, idempotency_key, status, created_at, updated_at
        FROM support_stripe_subscription_credit_attempts
        WHERE json_extract(command_data, '$.customerId') IS NOT NULL
          AND json_extract(command_data, '$.subscriptionId') IS NOT NULL;
      `);
      await tx.execute({
        sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (24, ?)",
        args: [now()],
      });
      await tx.commit();
    } catch (error) {
      try {
        await tx.rollback();
      } catch {}
      throw error;
    }
  }
  /** Manual support resolution is a non-financial command.  Its immutable
   * receipt and ordered provider intents are deliberately separate from the
   * workflow finalizer and from approval/ledger records. */
  private async up25() {
    await this.client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS support_manual_resolutions (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        expected_version INTEGER NOT NULL,
        idempotency_key TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        note_message_id TEXT NOT NULL,
        note_outbox_id TEXT NOT NULL,
        close_outbox_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(tenant_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS support_manual_resolutions_case
        ON support_manual_resolutions(case_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS support_intercom_close_intents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        external_conversation_id TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('pending','claimed','applied','superseded','deferred')),
        attempts INTEGER NOT NULL DEFAULT 0,
        lease_token TEXT,
        lease_until TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(tenant_id, provider_account_id, event_id)
      );
      CREATE INDEX IF NOT EXISTS support_intercom_close_intents_claimable
        ON support_intercom_close_intents(state, lease_until, created_at);
    `);
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (25, ?)",
      args: [now()],
    });
  }
  /** Keep provider-close audit data append-only and independent of the case
   * projection so a later customer follow-up remains authoritative. */
  private async up26() {
    await this.client.execute({
      sql: "INSERT INTO support_schema_migrations(version, applied_at) VALUES (26, ?)",
      args: [now()],
    });
  }
  private async down(version: number) {
    if (version === 3) {
      const count = await this.client.execute(
        "SELECT COUNT(*) AS total FROM support_events",
      );
      if (Number(count.rows[0]?.total ?? 0) > 0)
        throw new Error(
          "Refusing destructive downgrade: tenant-qualified events exist.",
        );
      await this.client.executeMultiple(
        "DROP TABLE support_events; CREATE TABLE support_events (id TEXT PRIMARY KEY, source TEXT NOT NULL, external_id TEXT NOT NULL, case_id TEXT NOT NULL, accepted_at TEXT NOT NULL, UNIQUE(source, external_id));",
      );
    }
    if (version === 4) {
      const duplicates = await this.client.execute(
        "SELECT source, external_id FROM support_cases GROUP BY source, external_id HAVING COUNT(*) > 1 LIMIT 1",
      );
      if (duplicates.rows[0])
        throw new Error(
          "Refusing destructive downgrade: tenant-scoped cases share a source/external id.",
        );
      await this.client.executeMultiple(`
        CREATE TABLE support_cases_v3 (id TEXT PRIMARY KEY, source TEXT NOT NULL, external_id TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, tenant_id TEXT NOT NULL, provider_binding TEXT NOT NULL, UNIQUE(source, external_id));
        INSERT INTO support_cases_v3(id, source, external_id, data, created_at, updated_at, version, tenant_id, provider_binding) SELECT id, source, external_id, data, created_at, updated_at, version, tenant_id, provider_binding FROM support_cases;
        DROP TABLE support_cases;
        ALTER TABLE support_cases_v3 RENAME TO support_cases;
      `);
    }
    if (version === 2) {
      const counts = await this.client.execute(
        "SELECT (SELECT COUNT(*) FROM support_outbox) + (SELECT COUNT(*) FROM support_dispatch) + (SELECT COUNT(*) FROM support_idempotency) + (SELECT COUNT(*) FROM support_actions) AS total",
      );
      if (Number(counts.rows[0]?.total ?? 0) > 0)
        throw new Error(
          "Refusing destructive downgrade: durable Phase 002 records exist.",
        );
      await this.client.executeMultiple(
        "DROP TABLE IF EXISTS support_outbox; DROP TABLE IF EXISTS support_dispatch; DROP TABLE IF EXISTS support_idempotency; DROP TABLE IF EXISTS support_actions; DROP TABLE IF EXISTS support_events; DROP TABLE IF EXISTS support_messages;",
      );
    }
    await this.client.execute({
      sql: "DELETE FROM support_schema_migrations WHERE version = ?",
      args: [version],
    });
  }

  private async insertLegacyFeedback(
    tx: Pick<Client, "execute">,
    caseId: string,
    feedback: CaseFeedback,
  ) {
    const turn =
      typeof feedback.turnId === "string"
        ? await tx.execute({
            sql: "SELECT id FROM support_turns WHERE id = ? AND case_id = ?",
            args: [feedback.turnId, caseId],
          })
        : undefined;
    const knownTurn = turn?.rows[0] ? String(turn.rows[0].id) : undefined;
    const knownActor =
      typeof feedback.actorId === "string" && feedback.actorId.length > 0
        ? feedback.actorId
        : undefined;
    const knownTime =
      typeof feedback.submittedAt === "string" &&
      Number.isFinite(Date.parse(feedback.submittedAt));
    const attributionState =
      knownTurn && knownActor && knownTime ? "known" : "legacy-unknown";
    const turnId = knownTurn ?? `legacy:unknown:${caseId}`;
    const actorId = knownActor ?? "legacy:unknown";
    const existing = await tx.execute({
      sql: "SELECT id FROM support_feedback WHERE case_id = ? AND turn_id = ? AND actor_id = ? AND dedupe_key = ?",
      args: [caseId, turnId, actorId, feedback.rating],
    });
    if (existing.rows[0]) return;
    await tx.execute({
      sql: "INSERT INTO support_feedback(id, case_id, turn_id, actor_id, data, created_at, dedupe_key, attribution_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        `feedback_legacy_${crypto.randomUUID()}`,
        caseId,
        turnId,
        actorId,
        JSON.stringify(feedback),
        knownTime ? feedback.submittedAt : null,
        feedback.rating,
        attributionState,
      ],
    });
  }
}
