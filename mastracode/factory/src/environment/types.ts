import type { FactorySandboxContext } from '../sandbox/session-sandbox.js';

/** Outcome of one `build()` call on a template resolver; `pending` asks the caller to poll again. */
export interface EnvironmentTemplateBuildResult {
  status: 'ready' | 'pending' | 'failed';
  templateId: string;
  retryAfterMs?: number;
  error?: string;
}

/**
 * The template a sandbox provider boots from, reduced to what the factory
 * needs: the ability to build it ahead of a session. Structurally the repo
 * templates' resolver (`createPlatformRepoTemplate(ctx)` and kin), so the host
 * hands the factory the very object it hands its `PlatformSandbox` and the two
 * builds share one identity. The factory never imports a workspace package.
 */
export type EnvironmentTemplateResolver = () => Promise<
  { build(options?: Record<string, unknown>): Promise<EnvironmentTemplateBuildResult> } | undefined
>;

/**
 * Host hook: the template resolver for a factory environment, or undefined
 * when the host cannot build templates for this context (local sandbox, no
 * platform credentials), in which case environments build lazily on the first
 * session as before.
 */
export type SandboxTemplateFactory = (ctx: FactorySandboxContext) => EnvironmentTemplateResolver | undefined;
