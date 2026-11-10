import { createTool } from '@mastra/core/tools';
import type { ExecuteCommandOptions } from '@mastra/core/workspace';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import { SessionCredentialError } from '../storage/domains/session-credentials/base.js';
import type { SessionCredentialsStorage } from '../storage/domains/session-credentials/base.js';
import type { FactoryToolScope } from './scope.js';

/** A running sandbox that can execute one command with its own env. */
export interface CredentialCommandSandbox {
  executeCommand(
    command: string,
    args?: string[],
    options?: ExecuteCommandOptions,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export interface SessionCredentialToolDependencies {
  credentials: SessionCredentialsStorage;
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  /** This session's live sandbox and its working directory, if this process has one. */
  findSandbox(input: {
    orgId: string;
    sessionId: string;
  }): Promise<{ sandbox: CredentialCommandSandbox; workdir?: string } | undefined>;
  /** Origin of the Factory UI; request links point at `/credentials/<id>` there. */
  publicOrigin: string;
  audit: AuditRecorder;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;
/** Values shorter than this are not scrubbed: replacing them would mangle unrelated output. */
const MIN_REDACTABLE_LENGTH = 6;
const MAX_OUTPUT_CHARS = 30_000;
export const REDACTED = '[REDACTED]';

/**
 * Best-effort scrub of credential values from command output: the literal
 * value and its base64, base64url and URL-encoded forms. A command that
 * transforms the value any other way (splits, reverses, hashes, sends it over
 * the network) gets past this; it is a guard against accidents, not a
 * boundary.
 */
export function redactCredentialValues(text: string, values: string[]): string {
  const forms = new Set<string>();
  for (const value of values) {
    if (value.length < MIN_REDACTABLE_LENGTH) continue;
    const bytes = Buffer.from(value, 'utf8');
    for (const form of [
      value,
      bytes.toString('base64'),
      bytes.toString('base64').replace(/=+$/, ''),
      bytes.toString('base64url'),
      encodeURIComponent(value),
    ]) {
      forms.add(form);
    }
  }
  // Longest first so a value that contains another is scrubbed whole.
  let out = text;
  for (const form of [...forms].sort((a, b) => b.length - a.length)) {
    out = out.split(form).join(REDACTED);
  }
  return out;
}

function tail(text: string): string {
  return text.length > MAX_OUTPUT_CHARS
    ? `[output truncated to the last ${MAX_OUTPUT_CHARS} characters]\n${text.slice(-MAX_OUTPUT_CHARS)}`
    : text;
}

function toolError(error: unknown): never {
  if (error instanceof SessionCredentialError) throw new Error(error.message);
  throw error;
}

/**
 * Session credentials: the agent asks for a named credential, the session
 * owner submits it on a private Factory page, and the agent runs commands
 * with it in their env. The agent never receives the value; it only learns
 * names and expiry.
 */
export function createSessionCredentialTools(
  scope: FactoryToolScope,
  deps: SessionCredentialToolDependencies,
): IntegrationTools {
  const agentActor = { actorId: `agent:${scope.threadId}`, actorType: 'agent' as const };

  // Credentials belong to the session owner. In a team-visible session another org member can drive the
  // agent, so every tool re-checks the caller against the session's current owner (workers act as the owner).
  const ownedSession = async () => {
    const session = await deps.sessions.getBySessionId(scope.sessionId);
    if (!session || session.orgId !== scope.orgId) throw new Error('This session is not available.');
    if (session.userId !== scope.userId) {
      throw new Error('Only the owner of this session can request or use its credentials.');
    }
    return session;
  };

  const request = createTool({
    id: 'factory_request_credential',
    description: [
      'Ask the owner of this session for a credential (an API key, token or password for a test account) that a command needs, for example to run real integration tests.',
      'If the person asks to store a value securely without specifying its environment variable name and intended use, ask them for those details before calling this tool. Do not invent a name or purpose from a vague request. Never ask them to share the secret value in chat.',
      'Returns a private link. Share that link with the person (in your reply or in Slack); they open it, sign in, and enter the value there. Never ask anyone to paste a secret into chat, Slack, an issue, or a tool argument, and never accept one that way.',
      'The link works once, for 15 minutes, and only for the session owner. You get a notification naming the credential when it is ready; then use factory_run_with_credentials.',
      'Ask for short-lived, least-privilege test credentials only.',
    ].join('\n'),
    inputSchema: z
      .object({
        name: z
          .string()
          .describe(
            'Environment variable the value will be exposed as, e.g. STRIPE_TEST_KEY. Uppercase letters, digits and underscores.',
          ),
        purpose: z
          .string()
          .min(1)
          .max(500)
          .describe('What the credential is for and what it will be used to run, shown to the person on the form.'),
      })
      .strict(),
    execute: async ({ name, purpose }) => {
      const session = await ownedSession();
      await deps.credentials.ensureReady();
      const record = await deps.credentials
        .createRequest({
          orgId: scope.orgId,
          factoryProjectId: scope.factoryProjectId,
          sessionId: scope.sessionId,
          threadId: scope.threadId,
          ownerUserId: session.userId,
          name,
          purpose,
        })
        .catch(toolError);
      await deps.audit.record({
        orgId: scope.orgId,
        ...agentActor,
        action: 'factory.credential.requested',
        factoryProjectId: scope.factoryProjectId,
        targets: [{ type: 'session', id: scope.sessionId }],
        metadata: { name, requestId: record.id },
      });
      return {
        requestId: record.id,
        url: `${deps.publicOrigin}/credentials/${record.id}`,
        expiresAt: record.expiresAt.toISOString(),
        instructions:
          'Share this link with the session owner. It contains no secret. Wait for the credential-available notification before using it.',
      };
    },
  });

  const list = createTool({
    id: 'factory_list_credentials',
    description:
      'List the credentials available to this session: names, expiry, and whether they can be passed to commands. Values are never shown.',
    inputSchema: z.object({}).strict(),
    execute: async () => {
      await ownedSession();
      await deps.credentials.ensureReady();
      const credentials = await deps.credentials.list({ orgId: scope.orgId, sessionId: scope.sessionId });
      return {
        // Only what the current owner submitted is usable (see resolveForCommand).
        credentials: credentials
          .filter(credential => credential.submittedBy === scope.userId)
          .map(credential => ({
            name: credential.name,
            allowSandbox: credential.allowSandbox,
            expiresAt: credential.expiresAt.toISOString(),
          })),
      };
    },
  });

  const run = createTool({
    id: 'factory_run_with_credentials',
    description: [
      "Run one shell command in this session's sandbox with the named credentials set as environment variables, only for that command. Use it for integration tests and CLIs that need a credential from factory_request_credential.",
      'Reference the values through the variables (e.g. `curl -H "Authorization: Bearer $STRIPE_TEST_KEY" ...` or `pnpm test:integration`). Never print, echo, log, encode, write to a file or send a credential anywhere other than the service it is for.',
      'Known forms of the values are scrubbed from the output, but that is best-effort.',
    ].join('\n'),
    inputSchema: z
      .object({
        command: z.string().min(1).describe('Shell command, run with `sh -c`.'),
        credentials: z.array(z.string()).min(1).max(10).describe('Names of the credentials to expose.'),
        cwd: z.string().optional().describe('Working directory. Defaults to the session working directory.'),
        timeoutMs: z.number().int().positive().max(MAX_TIMEOUT_MS).optional(),
      })
      .strict(),
    execute: async ({ command, credentials: names, cwd, timeoutMs }) => {
      await ownedSession();
      const found = await deps.findSandbox({ orgId: scope.orgId, sessionId: scope.sessionId });
      if (!found) throw new Error('This session has no sandbox running yet. Run a command to start one.');
      await deps.credentials.ensureReady();
      const env = await deps.credentials
        .resolveForCommand({ orgId: scope.orgId, sessionId: scope.sessionId, names, submittedBy: scope.userId })
        .catch(toolError);
      const values = Object.values(env);
      const workdir = cwd ?? found.workdir;
      let result: { exitCode: number; stdout: string; stderr: string };
      try {
        result = await found.sandbox.executeCommand('sh', ['-c', command], {
          env,
          timeout: timeoutMs ?? DEFAULT_TIMEOUT_MS,
          ...(workdir ? { cwd: workdir } : {}),
        });
      } catch (error) {
        throw new Error(redactCredentialValues(error instanceof Error ? error.message : String(error), values));
      }
      await deps.audit.record({
        orgId: scope.orgId,
        ...agentActor,
        action: 'factory.credential.used',
        factoryProjectId: scope.factoryProjectId,
        targets: [{ type: 'session', id: scope.sessionId }],
        metadata: { names: Object.keys(env), exitCode: result.exitCode },
      });
      return {
        exitCode: result.exitCode,
        stdout: tail(redactCredentialValues(result.stdout, values)),
        stderr: tail(redactCredentialValues(result.stderr, values)),
      };
    },
  });

  return {
    factory_request_credential: request,
    factory_list_credentials: list,
    factory_run_with_credentials: run,
  };
}
