import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resetStorage } from '../../__utils__/reset-storage';

/**
 * FEATURE: Browser stream WebSocket gating
 * USER STORY: As a user opening an agent that has no browser tools configured,
 *   I do not want the studio to open a WebSocket to `/browser/<agentId>/stream`
 *   or hit the `/browser/session` HTTP probe — the connection would fail and
 *   the resulting reconnect loop produces console errors and re-renders that
 *   disrupt the chat UI.
 * BEHAVIOR UNDER TEST:
 *   - For an agent without browser tools, the playground must not initiate any
 *     WebSocket to the browser-stream endpoint and must not call the session
 *     probe endpoint for that agent.
 *   - For an agent with browser tools, the playground SHOULD call the probe
 *     endpoint at least once — this confirms the gate is not a blanket "never
 *     connect" but is actually keyed on the agent's browserTools metadata.
 */

interface ObservedTraffic {
  wsUrls: string[];
  probeUrls: string[];
}

function observeBrowserTraffic(page: Page): ObservedTraffic {
  const observed: ObservedTraffic = { wsUrls: [], probeUrls: [] };
  page.on('websocket', ws => observed.wsUrls.push(ws.url()));
  page.on('request', req => {
    const url = req.url();
    if (/\/browser\/session(\?|$)/.test(url)) observed.probeUrls.push(url);
  });
  return observed;
}

test.describe('Browser stream WebSocket gating', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('when the agent has no browser tools', () => {
    test('opens no WebSocket and issues no session probe', async ({ page }) => {
      const observed = observeBrowserTraffic(page);

      await page.goto('/agents/weather-agent/chat/1234');

      // Wait for the agent page to settle.
      await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();
      await expect(page.locator('a:has-text("New Chat")')).toBeVisible();

      // Negative assertion: poll for any browser traffic and fail fast if it appears.
      // The poll resolves at the timeout with the final count, which we expect to be 0.
      await expect
        .poll(() => observed.wsUrls.length + observed.probeUrls.length, {
          message: 'no browser traffic should occur for agents without browser tools',
          timeout: 2000,
        })
        .toBe(0);

      const browserStreamWs = observed.wsUrls.filter(url => /\/browser\/[^/]+\/stream/.test(url));
      expect(browserStreamWs, 'no browser-stream WebSocket should be opened').toEqual([]);
      expect(observed.probeUrls, 'no /browser/session probe should be issued').toEqual([]);
    });
  });

  test.describe('when the agent has browser tools', () => {
    test('issues the session probe', async ({ page }) => {
      // Override the agent details response so the client believes weather-agent
      // has browser tools. We don't need a real browser implementation — only the
      // client-side gate is exercised here; the probe response is also stubbed so
      // the server doesn't 404 on a real call.
      await page.route('**/api/agents/weather-agent*', async route => {
        if (route.request().method() !== 'GET') return route.fallback();
        const response = await route.fetch();
        const body = await response.json();
        await route.fulfill({
          response,
          json: { ...body, browserTools: ['browser_goto', 'browser_snapshot'] },
        });
      });

      // Stub the probe so the server (which has no real toolset for weather-agent)
      // doesn't return a 404 that the client could fall back from.
      await page.route('**/api/agents/weather-agent/browser/session*', route =>
        route.fulfill({ status: 200, json: { hasSession: false, screencastAvailable: true } }),
      );

      const observed = observeBrowserTraffic(page);

      await page.goto('/agents/weather-agent/chat/1234');

      await expect(page.locator('h2:has-text("Weather Agent")')).toBeVisible();

      // The probe should fire once the agent details resolve and the gate flips on.
      await expect
        .poll(() => observed.probeUrls.length, {
          message: 'probe endpoint should be called for an agent with browser tools',
          timeout: 5000,
        })
        .toBeGreaterThan(0);

      // The probe stub reports `hasSession: false` and the user has not opened the
      // browser panel, so no WebSocket should be opened either. This confirms the
      // probe result is honored — the gate is not "any browser tool => connect".
      const browserStreamWs = observed.wsUrls.filter(url => /\/browser\/[^/]+\/stream/.test(url));
      expect(browserStreamWs, 'WebSocket should not open when probe reports no session').toEqual([]);
    });
  });
});
