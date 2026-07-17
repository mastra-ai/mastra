/**
 * Registry of factory app-table storage domains.
 *
 * `MastraFactory.prepare()` registers the built-in domains (intake, audit,
 * work-items) and any integration-provided domains, then calls `init()` once
 * after the injected Mastra storage's own `init()`. Domain init is
 * **fail-soft**: one domain's DDL failure marks that domain not-ready (its
 * feature gates off) without aborting boot or the other domains. A failed
 * init is retried on the next `ensureReady()` call, preserving the old
 * `ensureXyzDbReady()` retry-on-request semantics.
 */

import type { FactoryStorageContext, FactoryStorageDomain } from './domain';
import type { AuditStorage } from './domains/audit/base';
import type { IntakeStorage } from './domains/intake/base';
import type { WorkItemsStorage } from './domains/work-items/base';

export class FactoryStore {
  #domains = new Map<string, FactoryStorageDomain>();
  #ctx?: FactoryStorageContext;
  /** Per-domain init latch; cleared on failure so `ensureReady()` retries. */
  #inits = new Map<string, Promise<void>>();
  #ready = new Set<string>();
  #errors = new Map<string, Error>();

  /**
   * Register a domain. Built-ins and integration-provided domains flow
   * through this same path. Callable any time before the domain is used;
   * domains registered after `init()` are initialized on first
   * `ensureReady()`.
   */
  register(domain: FactoryStorageDomain): void {
    if (this.#domains.has(domain.name)) {
      throw new Error(`[FactoryStore] Domain '${domain.name}' is already registered.`);
    }
    this.#domains.set(domain.name, domain);
  }

  /** Look up a registered domain (extension access; built-ins have typed accessors). */
  get(name: string): FactoryStorageDomain | undefined {
    return this.#domains.get(name);
  }

  #require(name: string): FactoryStorageDomain {
    const domain = this.#domains.get(name);
    if (!domain) throw new Error(`[FactoryStore] Domain '${name}' is not registered.`);
    return domain;
  }

  /** Intake settings domain (built-in). Throws when not registered. */
  get intake(): IntakeStorage {
    return this.#require('intake') as IntakeStorage;
  }

  /** Audit events domain (built-in). Throws when not registered. */
  get audit(): AuditStorage {
    return this.#require('audit') as AuditStorage;
  }

  /** Work items domain (built-in). Throws when not registered. */
  get workItems(): WorkItemsStorage {
    return this.#require('work-items') as WorkItemsStorage;
  }

  /** Names of all registered domains, in registration order. */
  names(): string[] {
    return [...this.#domains.keys()];
  }

  /**
   * Initialize every registered domain against the shared connection.
   * Fail-soft per domain: failures are recorded (see {@link initError}) and
   * logged, never thrown. Concurrent/repeated calls coalesce per domain;
   * previously failed domains are retried.
   */
  async init(ctx: FactoryStorageContext): Promise<void> {
    this.#ctx = ctx;
    await Promise.all(
      [...this.#domains.values()].map(domain =>
        this.#initDomain(domain, ctx).catch(() => {
          // Recorded in #errors; boot continues with this domain not-ready.
        }),
      ),
    );
  }

  /** True once the named domain's init has succeeded. */
  isReady(name: string): boolean {
    return this.#ready.has(name);
  }

  /** The most recent init failure for a domain, for diagnostics. */
  initError(name: string): Error | undefined {
    return this.#errors.get(name);
  }

  /**
   * Ensure the named domain is initialized, retrying a previously failed
   * init. Throws when the domain is unknown, when `init()` has never been
   * called (no storage was provided to the factory), or when the retry fails.
   */
  async ensureReady(name: string): Promise<void> {
    const domain = this.#domains.get(name);
    if (!domain) {
      throw new Error(`[FactoryStore] Unknown domain '${name}'.`);
    }
    if (this.#ready.has(name)) return;
    const ctx = this.#ctx;
    if (!ctx) {
      throw new Error(
        `[FactoryStore] Not initialized — MastraFactory.prepare() has not run or no storage was provided.`,
      );
    }
    await this.#initDomain(domain, ctx);
  }

  #initDomain(domain: FactoryStorageDomain, ctx: FactoryStorageContext): Promise<void> {
    const existing = this.#inits.get(domain.name);
    if (existing) return existing;
    const promise = Promise.resolve()
      .then(() => domain.init(ctx))
      .then(
        () => {
          this.#ready.add(domain.name);
          this.#errors.delete(domain.name);
        },
        (err: unknown) => {
          // Clear the latch so a later ensureReady() retries.
          this.#inits.delete(domain.name);
          const error = err instanceof Error ? err : new Error(String(err));
          this.#errors.set(domain.name, error);
          console.warn(`[FactoryStore] Domain '${domain.name}' init failed: ${error.message}`);
          throw error;
        },
      );
    this.#inits.set(domain.name, promise);
    return promise;
  }
}
