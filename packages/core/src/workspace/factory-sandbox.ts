import type { JSONSchema7 } from 'json-schema';
import type { PublicSchema, StandardSchemaWithJSON } from '../schema';
import { standardSchemaToJSONSchema, toStandardSchema } from '../schema';
import type { MastraSandbox } from './sandbox/mastra-sandbox';

/**
 * Brand every `FactorySandbox` carries. A `Symbol.for` key so two copies of
 * `@mastra/core` in one process agree on it. Factory detects the contract by
 * this brand alone, never by `instanceof` or by the presence of `create`.
 */
export const FACTORY_SANDBOX_BRAND = Symbol.for('mastra.factory.sandbox');

/** A repository's clone URL and a fresh short-lived credential for it. */
export interface FactoryRepositoryAccess {
  cloneUrl: string;
  authorization?: { scheme: 'bearer'; token: string; username?: string };
}

/**
 * Everything factory knows about a session's sandbox needs: the whole
 * contract between factory and the host's `FactorySandbox`. Factory owns
 * intent; the provider owns resolving `sessionId` to a runnable VM.
 */
export interface FactorySandboxContext {
  /** Stable session id, the sandbox identity. */
  sessionId: string;
  /**
   * The provider's physical sandbox id persisted from a prior start, when the
   * session has been started before. Providers that reattach by physical id
   * (e.g. Railway) MUST forward it to the sandbox constructor so resume
   * reattaches the original VM instead of provisioning a replacement. E2B and
   * Platform accept it as a deterministic-reattach optimization. Undefined on
   * a session's first ever start.
   */
  sandboxId?: string;
  /** owner/name of the repository, when the session is repo-backed. */
  repoFullName?: string;
  /**
   * Configured repo setup command, when present. Part of a repo template's
   * identity: a different setup command produces a different template.
   */
  setupCommand?: string;
  /**
   * Resolves the session repository's clone URL and a fresh short-lived
   * credential for it. Providers use it for authenticated work that runs
   * outside the VM: resolving a private repo's head, or cloning it during
   * a template build. The credential is minted per call (installation
   * tokens expire in about an hour); never an org PAT.
   *
   * `undefined` when the session has no repository, which is how a provider
   * knows to build no repo template. The key is always present so that
   * passing the whole context to a provider helper keeps working when this
   * field changes, instead of silently resolving to "no repository".
   */
  getRepositoryAccess: (() => Promise<FactoryRepositoryAccess>) | undefined;
  /**
   * Every repository of the session's factory environment, in position
   * order, when the factory has one. Same shape and semantics as the repo
   * templates' `repos` option: each entry resolves its own access and runs
   * its own setup inside its clone at `<workingDirectory>/<repo>`. Mutually
   * exclusive with `getRepositoryAccess`, which is `undefined` whenever this
   * is set. Absent for a session whose factory has no environment repository.
   */
  repos?: Array<{ getRepositoryAccess: () => Promise<FactoryRepositoryAccess>; setupCommand?: string | string[] }>;
  /** Command run once at the workspace root after every repository is set up (`repos` only). */
  workspaceSetupCommand?: string | string[];
  /** A failing repository setup is recorded and the build continues (`repos` only). */
  continueOnSetupFailure?: boolean;
  /** Absolute workspace root the repositories check out under; the provider default when absent. */
  workingDirectory?: string;
  /**
   * Resolves the commit a repository's template should pin, given its clone
   * URL and the credential minted for it. Absent means the provider resolves
   * the default branch head itself.
   */
  resolveHead?: (cloneUrl: string, token?: string) => Promise<string | undefined>;
}

/**
 * Status of one environment template build as the provider reports it.
 * `unknown` is for a build id the provider can no longer resolve (for
 * example after a restart with only in-memory state); factory treats it as
 * not ready.
 */
export type FactorySandboxBuildStatus = 'pending' | 'building' | 'ready' | 'failed' | 'unknown';

/** What `builds.start` returns right after a build is requested. */
export interface FactorySandboxBuildStart {
  buildId: string;
  status: FactorySandboxBuildStatus;
  templateId?: string;
}

/** One build as the provider reports it, by id or in a listing. */
export interface FactorySandboxBuild {
  buildId: string;
  status: FactorySandboxBuildStatus;
  templateId?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  logs?: string[];
}

/**
 * Optional capability: the provider can build the environment template ahead
 * of any session and report on it. `get` and `list` take the settings because
 * template identity includes the template-affecting settings. A provider
 * without `list` has no build history.
 */
export interface FactorySandboxBuilds<TSettings> {
  start(ctx: FactorySandboxContext, settings: TSettings): Promise<FactorySandboxBuildStart>;
  get(ctx: FactorySandboxContext, settings: TSettings, buildId: string): Promise<FactorySandboxBuild>;
  list?(ctx: FactorySandboxContext, settings: TSettings): Promise<FactorySandboxBuild[]>;
}

/**
 * The one object a host hands factory for its sandboxes. Extend it to get the
 * brand. It owns the session sandbox constructor, the repo template factory, the schema of user-tunable
 * settings, and optionally the builds capability.
 *
 * `create` is synchronous and returns a `MastraSandbox`: factory constructs
 * the sandbox inside a synchronous memo and relies on the base class for the
 * start lifecycle and the runtime env. Construction must be cheap and
 * side-effect-free; VMs are provisioned on `start()` only. Local sandboxes
 * should root their `workingDirectory` at a per-session directory.
 *
 * `settings` is authored in any flavor `PublicSchema` accepts (zod, JSON
 * Schema, or a Standard Schema that can emit JSON Schema). Factory normalizes
 * it and serves the input-side JSON Schema on the wire. Every field must be
 * optional: an absent setting means the provider default. Providers may
 * ignore `ctx.resolveHead` and resolve heads themselves. `templateFields` names the settings whose change
 * produces a different template.
 */
/** The settings schema of a provider with nothing to tune. */
const NO_SETTINGS = { type: 'object', properties: {}, additionalProperties: false } as const satisfies PublicSchema;

export abstract class FactorySandbox<TSettings extends Record<string, unknown> = Record<string, unknown>> {
  /** Brand factory detects the class by; never test by shape. */
  readonly [FACTORY_SANDBOX_BRAND] = true as const;
  /** Provider id, e.g. `platform`, `e2b`, `docker`, `local`, `custom`. */
  abstract readonly provider: string;
  /** Defaults to no settings; override with the provider's schema. */
  readonly settings: PublicSchema<TSettings> = NO_SETTINGS as PublicSchema<TSettings>;
  /** Defaults to none; override with the settings that change the template identity. */
  readonly templateFields: ReadonlyArray<keyof TSettings & string> = [];
  abstract create(ctx: FactorySandboxContext, settings: TSettings): MastraSandbox;
  /**
   * The environment's repo template for the given context and settings, in
   * the provider's own resolver shape. Absent when the provider builds no
   * template ahead of a session.
   */
  template?(ctx: FactorySandboxContext, settings: TSettings): unknown;
  readonly builds?: FactorySandboxBuilds<TSettings>;
}

/** True for any object carrying the `FactorySandbox` brand. */
export function isFactorySandbox(value: unknown): value is FactorySandbox {
  return (
    typeof value === 'object' &&
    value !== null &&
    FACTORY_SANDBOX_BRAND in value &&
    (value as Record<symbol, unknown>)[FACTORY_SANDBOX_BRAND] === true
  );
}

/** What factory tells its clients about the configured sandbox. */
export interface FactorySandboxDescription {
  provider: string;
  settingsSchema: JSONSchema7;
  templateFields: string[];
  capabilities: {
    template: boolean;
    builds: { available: boolean; history: boolean };
  };
}

/** The settings schema as a Standard Schema with JSON Schema output. */
export function normalizeFactorySandboxSettings(sandbox: FactorySandbox): StandardSchemaWithJSON {
  return toStandardSchema(sandbox.settings as PublicSchema);
}

/** The wire description of a `FactorySandbox`: provider, JSON Schema settings, capabilities. */
export function describeFactorySandbox(sandbox: FactorySandbox): FactorySandboxDescription {
  return {
    provider: sandbox.provider,
    settingsSchema: standardSchemaToJSONSchema(normalizeFactorySandboxSettings(sandbox), {
      target: 'draft-07',
      io: 'input',
    }),
    templateFields: [...sandbox.templateFields],
    capabilities: {
      template: typeof sandbox.template === 'function',
      builds: {
        available: sandbox.builds !== undefined,
        history: typeof sandbox.builds?.list === 'function',
      },
    },
  };
}
