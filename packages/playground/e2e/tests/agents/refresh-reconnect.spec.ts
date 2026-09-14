import { expect, test } from '@playwright/test';

const chatPath = '/agents/weather-agent/threads/new';
const agentDetails = /\/api\/agents\/weather-agent(?:\?.*)?$/;

for (const hasHandshake of [true, false]) {
  test.describe(hasHandshake ? 'After an established refresh connection' : 'Before the first refresh handshake', () => {
    test.describe('when the server restarts while disconnected', () => {
      test('recovers the stale chat without receiving a refresh broadcast', async ({ page }) => {
        let generation = 'dev-before-restart';
        let removed = false;
        let documents = 0;
        let connections = 0;
        let releaseReconnect!: () => void;
        let markDisconnected!: () => void;
        const reconnectGate = new Promise<void>(resolve => {
          releaseReconnect = resolve;
        });
        const disconnected = new Promise<void>(resolve => {
          markDisconnected = resolve;
        });

        // Model two dev-server generations at the HTTP boundary. Keep the shipped
        // HTML, native EventSource, routing, and chat client running unchanged.
        await page.route(`**${chatPath}`, async route => {
          const response = await route.fetch();
          const html = await response.text();
          expect(html).toContain('window.MASTRA_DEV_SERVER_INSTANCE_ID');
          documents++;
          await route.fulfill({
            response,
            body: html.replace(
              /(window\.MASTRA_DEV_SERVER_INSTANCE_ID\s*=\s*)[^;]*;/,
              (_match, assignment) => `${assignment}${JSON.stringify(generation)};`,
            ),
          });
        });
        await page.route(agentDetails, route =>
          removed
            ? route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Agent not found' }),
              })
            : route.continue(),
        );
        await page.route('**/refresh-events', async route => {
          connections++;
          if (!hasHandshake && connections === 1) {
            await route.abort('connectionfailed');
            return;
          }
          if (!hasHandshake || connections > 2) {
            markDisconnected();
            await reconnectGate;
          }
          // Completing the response disconnects the real EventSource. The next
          // request therefore exercises Studio's native reconnect path.
          await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: `id: ${generation}\ndata: connected\n\n`,
          });
        });

        try {
          await page.goto(chatPath);
          await expect(page.getByPlaceholder('Enter your message...')).toBeVisible();
          await disconnected;
          // In the established case, two same-generation handshakes must not reload.
          expect(documents).toBe(1);
          const reloaded = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
          generation = 'dev-after-restart';
          removed = true;
          releaseReconnect();
          await reloaded;
          await expect(page.getByRole('heading', { name: 'Agent not found' })).toBeVisible();
          await expect(page.getByPlaceholder('Enter your message...')).toHaveCount(0);
          await expect(page.getByRole('link', { name: 'Choose agent' })).toBeVisible();
          expect(documents).toBe(2);
        } finally {
          releaseReconnect();
          await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
      });
    });
  });
}
