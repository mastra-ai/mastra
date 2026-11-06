import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { LocalSandbox } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createFactorySecretEncryption } from '../secret-encryption.js';
import { SessionCredentialsStorage } from '../storage/domains/session-credentials/base.js';
import type { FactoryToolScope } from './scope.js';
import { createSessionCredentialTools, redactCredentialValues, REDACTED } from './session-credential-tools.js';

const SECRET = 'sk_test_fake_throwaway_0123456789';

const scope = (sessionId: string, orgId = 'org-a', userId = 'alice'): FactoryToolScope => ({
  orgId,
  factoryProjectId: 'fac-a',
  userId,
  sessionId,
  resourceId: 'res',
  threadId: `thread-${sessionId}`,
  kind: 'user',
  interactive: false,
});

async function setup() {
  const backend = new LibSQLFactoryStorage({ id: 'credential-tools', url: ':memory:' });
  const credentials = backend.registerDomain(
    new SessionCredentialsStorage(createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 9) } })),
  );
  await backend.init();
  onTestFinished(() => backend.close());

  const workdir = mkdtempSync(path.join(tmpdir(), 'credential-tools-'));
  const sandbox = new LocalSandbox({ workingDirectory: workdir });
  await sandbox._start();
  onTestFinished(() => sandbox._stop?.());

  const record = vi.fn(async () => null);
  const tools = (s: FactoryToolScope) =>
    createSessionCredentialTools(s, {
      credentials,
      sessions: {
        getBySessionId: async (sessionId: string) =>
          (sessionId === 'sess-a' || sessionId === 'sess-b'
            ? { sessionId, orgId: 'org-a', userId: 'alice' }
            : null) as never,
      },
      findSandbox: async () => ({ sandbox, workdir }),
      publicOrigin: 'https://factory.example',
      audit: { record } as never,
    });

  const submit = async (s: FactoryToolScope, name: string, allowSandbox = true) => {
    const requested = (await tools(s).factory_request_credential!.execute!(
      { name, purpose: 'integration tests' },
      {} as never,
    )) as { requestId: string; url: string };
    await credentials.fulfillRequest({
      requestId: requested.requestId,
      submittedBy: 'alice',
      value: SECRET,
      allowSandbox,
    });
    return requested;
  };
  const run = (s: FactoryToolScope, command: string, names: string[]) =>
    tools(s).factory_run_with_credentials!.execute!({ command, credentials: names }, {} as never) as Promise<{
      exitCode: number;
      stdout: string;
      stderr: string;
    }>;
  return { credentials, tools, submit, run, record, sandbox };
}

describe('session credential tools', () => {
  it('instructs the agent to clarify unspecified credential details before requesting a link', async () => {
    const { tools } = await setup();
    const description = tools(scope('sess-a')).factory_request_credential!.description;
    expect(description).toContain('ask them for those details before calling this tool');
    expect(description).toContain('Do not invent a name or purpose');
    expect(description).toContain('Never ask them to share the secret value in chat');
  });

  it("refuses another org member driving the owner's shared session", async () => {
    const { tools, submit, run } = await setup();
    await submit(scope('sess-a'), 'FAKE_API_KEY');
    const bob = scope('sess-a', 'org-a', 'bob');

    await expect(run(bob, 'echo "$FAKE_API_KEY"', ['FAKE_API_KEY'])).rejects.toThrow('Only the owner');
    await expect(tools(bob).factory_list_credentials!.execute!({}, {} as never)).rejects.toThrow('Only the owner');
    await expect(
      tools(bob).factory_request_credential!.execute!({ name: 'OTHER_KEY', purpose: 'x' }, {} as never),
    ).rejects.toThrow('Only the owner');
    expect((await run(scope('sess-a'), 'test -n "$FAKE_API_KEY" && echo ok', ['FAKE_API_KEY'])).stdout).toContain('ok');
  });

  it('rejects all credential tools when the session belongs to another org or is missing', async () => {
    const { tools, run, submit } = await setup();
    await submit(scope('sess-a'), 'FAKE_API_KEY');

    for (const caller of [scope('sess-a', 'org-b'), scope('missing')]) {
      await expect(
        tools(caller).factory_request_credential!.execute!({ name: 'OTHER_KEY', purpose: 'test' }, {} as never),
      ).rejects.toThrow('This session is not available.');
      await expect(tools(caller).factory_list_credentials!.execute!({}, {} as never)).rejects.toThrow(
        'This session is not available.',
      );
      await expect(run(caller, 'true', ['FAKE_API_KEY'])).rejects.toThrow('This session is not available.');
    }
  });

  it('requests by link, then runs a real shell command with the credential in its env only', async () => {
    const { tools, submit, run, record, sandbox } = await setup();
    const a = scope('sess-a');
    const requested = await submit(a, 'FAKE_API_KEY');
    expect(requested.url).toBe(`https://factory.example/credentials/${requested.requestId}`);

    const listed = JSON.stringify(await tools(a).factory_list_credentials!.execute!({}, {} as never));
    expect(listed).toContain('FAKE_API_KEY');
    expect(listed).not.toContain(SECRET);

    // A CLI that authenticates with the env var: succeeds only with the right value.
    const ok = await run(a, `test "$FAKE_API_KEY" = '${SECRET}' && echo authenticated`, ['FAKE_API_KEY']);
    expect(ok).toMatchObject({ exitCode: 0, stdout: expect.stringContaining('authenticated') });

    // Accidental leaks in output are scrubbed: literal, base64 and URL-encoded.
    const leaky = await run(a, 'echo "$FAKE_API_KEY"; printf %s "$FAKE_API_KEY" | base64; echo "$FAKE_API_KEY" >&2', [
      'FAKE_API_KEY',
    ]);
    expect(leaky.stdout + leaky.stderr).not.toContain(SECRET);
    expect(leaky.stdout + leaky.stderr).not.toContain(Buffer.from(SECRET).toString('base64'));
    expect(leaky.stdout).toContain(REDACTED);

    // Not left behind in the sandbox env for later commands.
    const later = await sandbox.executeCommand('sh', ['-c', 'echo "[${FAKE_API_KEY:-unset}]"']);
    expect(later.stdout).toContain('[unset]');
    expect(JSON.stringify(record.mock.calls)).not.toContain(SECRET);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'factory.credential.used' }));
  });

  it('isolates credentials by session and org, and stops after revoke', async () => {
    const { credentials, submit, run } = await setup();
    await submit(scope('sess-a'), 'FAKE_API_KEY');
    await expect(run(scope('sess-b'), 'true', ['FAKE_API_KEY'])).rejects.toThrow(/No credential named FAKE_API_KEY/);
    await expect(run(scope('sess-a', 'org-b'), 'true', ['FAKE_API_KEY'])).rejects.toThrow(
      'This session is not available.',
    );

    await credentials.revoke({ orgId: 'org-a', sessionId: 'sess-a', name: 'FAKE_API_KEY' });
    await expect(run(scope('sess-a'), 'true', ['FAKE_API_KEY'])).rejects.toThrow(/No credential named/);
  });

  it('refuses command use unless the owner allowed it', async () => {
    const { submit, run } = await setup();
    await submit(scope('sess-a'), 'VIEW_ONLY_KEY', false);
    await expect(run(scope('sess-a'), 'true', ['VIEW_ONLY_KEY'])).rejects.toThrow(/sandbox use allowed/);
  });

  it('rejects reserved names', async () => {
    const { tools } = await setup();
    await expect(
      tools(scope('sess-a')).factory_request_credential!.execute!({ name: 'PATH', purpose: 'x' }, {} as never),
    ).rejects.toThrow();
  });
});

describe('redactCredentialValues', () => {
  it('scrubs literal, base64 and URL-encoded forms but leaves short values alone', () => {
    const value = 'p@ss/word+123';
    const text = `${value} ${Buffer.from(value).toString('base64')} ${encodeURIComponent(value)} abc`;
    expect(redactCredentialValues(text, [value, 'abc'])).toBe(`${REDACTED} ${REDACTED} ${REDACTED} abc`);
  });
});
