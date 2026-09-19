import { chromium } from 'playwright-core';
import { describe, expect, it, vi } from 'vitest';
import { BrowserActivityObserver } from '../activity-observer';

describe('trusted remote browser input', () => {
  it('observes real input across navigation and tabs without accepting page-forged events', async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_TEST_EXECUTABLE });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      const activity = vi.fn();
      const failure = vi.fn();
      const observer = new BrowserActivityObserver(context, activity, failure);
      await observer.start();
      await page.goto('data:text/html,<input aria-label="name"><button>Click</button>');
      await page.getByRole('button').click();
      await expect.poll(() => activity.mock.calls.length).toBeGreaterThan(0);
      activity.mockClear();
      await page.getByRole('textbox').pressSequentially('hello');
      await expect.poll(() => activity.mock.calls.length).toBeGreaterThan(0);
      activity.mockClear();
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
        document.querySelector('button')?.click();
      });
      expect(await page.evaluate(() => typeof (globalThis as any).__mastraBrowserActivity)).toBe('undefined');
      expect(activity).not.toHaveBeenCalled();
      await page.goto('data:text/html,<button>Next</button>');
      await page.getByRole('button').click();
      await expect.poll(() => activity.mock.calls.length).toBeGreaterThan(0);
      activity.mockClear();
      const next = await context.newPage();
      await next.goto('data:text/html,<button>New tab</button>');
      await next.getByRole('button').click();
      await expect.poll(() => activity.mock.calls.length).toBeGreaterThan(0);
      expect(failure).not.toHaveBeenCalled();
      activity.mockClear();
      await next.setContent('<button>Replaced document</button>');
      await next.getByRole('button').click();
      await expect.poll(() => activity.mock.calls.length).toBeGreaterThan(0);
      activity.mockClear();
      await context.route('https://main.fixture.test/**', route =>
        route.fulfill({
          contentType: 'text/html',
          body: '<iframe src="https://frame.other.test/"></iframe>',
        }),
      );
      await context.route('https://frame.other.test/**', route =>
        route.fulfill({
          contentType: 'text/html',
          body: '<button>Frame button</button>',
        }),
      );
      await next.goto('https://main.fixture.test/');
      await next.frameLocator('iframe').getByRole('button').click();
      await expect.poll(() => activity.mock.calls.length).toBeGreaterThan(0);
      expect(failure).not.toHaveBeenCalled();
      await observer.stop();
      activity.mockClear();
      await next.frameLocator('iframe').getByRole('button').click();
      expect(activity).not.toHaveBeenCalled();
    } finally {
      await browser.close();
    }
  }, 30000);
});
