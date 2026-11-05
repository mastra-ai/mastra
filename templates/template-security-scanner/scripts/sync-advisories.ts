import { diagnostic, loadSettings, RuntimeDiagnostic } from '../src/config/settings.js';

/** Run one authenticated advisory synchronization and print its bounded operational result. */
async function main() {
  const settings = loadSettings();
  if (!settings.CONTROL_BOOTSTRAP_SECRET)
    throw new RuntimeDiagnostic('LOCAL_SESSION_REQUIRED', 'Configure the local control bootstrap secret.');
  const origin = `http://127.0.0.1:${settings.PORT}`;
  const session = await fetch(`${origin}/api/session`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ secret: settings.CONTROL_BOOTSTRAP_SECRET }),
    signal: AbortSignal.timeout(10000),
  });
  if (!session.ok)
    throw new RuntimeDiagnostic('LOCAL_SESSION_REQUIRED', 'The local server did not accept the operator session.');
  const cookie = session.headers.get('set-cookie')?.split(';', 1)[0];
  const identity = (await session.json()) as { csrfToken?: string };
  if (!cookie || !identity.csrfToken)
    throw new RuntimeDiagnostic('LOCAL_SESSION_REQUIRED', 'The local server did not return a usable session.');
  console.error(
    'Advisory sync may make up to 8 bounded Sherlock calls (4096 input bytes and 160 output tokens each) if a model is configured.',
  );
  const result = await fetch(`${origin}/api/advisories/sync`, {
    method: 'POST',
    headers: { origin, cookie, 'x-csrf-token': identity.csrfToken, 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(120000),
  });
  if (!result.ok) {
    const body = (await result.json().catch(() => ({}))) as { code?: string };
    throw new RuntimeDiagnostic(body.code ?? 'ADVISORY_SYNC_FAILED', 'The local advisory sync did not complete.');
  }
  const body = (await result.json()) as {
    outcome?: 'COMPLETED' | 'SKIPPED';
    reasonCode?: string;
    phase?: string;
    checkpoint?: { stale?: boolean; incomplete?: boolean; nextRetryAt?: string | null };
    head?: { imported?: number; materialRevisions?: number };
    rotation?: { imported?: number; materialRevisions?: number };
    refreshed?: number;
    hypotheses?: { ready?: number; pending?: number };
  };
  if (body.outcome === 'SKIPPED') {
    console.log(
      JSON.stringify({
        outcome: 'SKIPPED',
        reasonCode: body.reasonCode,
        phase: body.phase,
        checkpoint: {
          stale: body.checkpoint?.stale,
          incomplete: body.checkpoint?.incomplete,
          nextRetryAt: body.checkpoint?.nextRetryAt,
        },
      }),
    );
    return;
  }
  if (body.outcome !== 'COMPLETED')
    throw new RuntimeDiagnostic(
      'ADVISORY_SYNC_RESPONSE_INVALID',
      'The local advisory sync returned an invalid outcome.',
    );
  console.log(
    JSON.stringify({
      outcome: 'COMPLETED',
      importedHeadEntries: body.head?.imported ?? 0,
      importedRotationEntries: body.rotation?.imported ?? 0,
      importedHeadRevisions: body.head?.materialRevisions ?? 0,
      importedRotationRevisions: body.rotation?.materialRevisions ?? 0,
      refreshed: body.refreshed ?? 0,
      hypotheses: { ready: body.hypotheses?.ready ?? 0, pending: body.hypotheses?.pending ?? 0 },
    }),
  );
}

try {
  await main();
} catch (error) {
  console.error(JSON.stringify(diagnostic(error)));
  process.exitCode = 1;
}
