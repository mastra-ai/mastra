import { test as setup, expect } from '@playwright/test';

/**
 * Pause the every-second `scheduled-tick` schedule so it does not hammer the
 * DB across the entire UI suite. The schedule must remain *registered* (the
 * schedules list assertions still see it), but firing it once per second for
 * 25+ minutes would clobber the workflow snapshot table and starve every
 * agent-chat / workflow test.
 *
 * This runs after the Playwright webServer is up (Playwright awaits the
 * webServer's `url` health check before running setup projects).
 */
const PORT = process.env.STUDIO_PORT || '4555';
const BASE_URL = `http://127.0.0.1:${PORT}`;

setup('pause scheduled-tick', async () => {
  // Generous deadline: on slow CI disks the schedules table can take a while
  // to migrate after the webServer's health check passes (the health endpoint
  // doesn't gate on storage init). 60s window with 500ms polls handles it.
  const deadline = Date.now() + 60_000;
  let tickId: string | undefined;
  let lastErr: unknown;
  let lastBody: string | undefined;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/schedules?workflowId=scheduled-tick`);
      if (res.ok) {
        const data = (await res.json()) as { schedules?: Array<{ id: string; target?: { workflowId?: string } }> };
        const tick = data?.schedules?.find(s => s.target?.workflowId === 'scheduled-tick');
        if (tick?.id) {
          tickId = tick.id;
          break;
        }
        lastErr = `200 but no scheduled-tick row (schedules=${data.schedules?.length ?? 0})`;
      } else {
        lastErr = `status ${res.status}`;
        // Capture body once so the failure message tells us *why* it 500'd.
        try {
          lastBody = (await res.text()).slice(0, 400);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      lastErr = err;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  expect(
    tickId,
    `scheduled-tick must be registered before UI suite runs (lastErr=${String(lastErr)}${lastBody ? ` body=${lastBody}` : ''})`,
  ).toBeDefined();
  const pause = await fetch(`${BASE_URL}/api/schedules/${tickId}/pause`, { method: 'POST' });
  expect(pause.ok, `failed to pause scheduled-tick (status=${pause.status})`).toBe(true);
});
