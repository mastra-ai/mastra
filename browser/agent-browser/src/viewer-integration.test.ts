import { describe, it, expect } from 'vitest';
import { AgentBrowser } from './agent-browser';

describe('AgentBrowser shared viewer', () => {
  it('uses the tools browser for frames, tabs, language and text without replacing it', async () => {
    const browser = new AgentBrowser({
      executablePath: process.env.MASTRA_TEST_BROWSER_EXECUTABLE,
      headless: true,
      scope: 'shared',
      viewerPreferences: { width: 640, height: 480, deviceScaleFactor: 2, locale: 'ar-SA' },
      screencast: { format: 'png', maxWidth: 4096, maxHeight: 4096 },
    });
    let release: (() => Promise<void>) | undefined;
    try {
      await browser.launch();
      const manager = await browser.getManagerForThread();
      const original = manager.getPage();
      expect(await original.evaluate(() => [innerWidth, innerHeight, devicePixelRatio])).toEqual([640, 480, 2]);
      await original.setContent(
        '<input id="draft" style="position:absolute;left:200px;top:200px;width:100px;height:40px"><div style="height:1000px">Scroll content</div>',
      );
      await original.evaluate(
        () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const frames: any[] = [];
      const viewer = browser.getViewer();
      const incarnation = browser.getActivityState().incarnation;
      release = await viewer.subscribe(event => {
        if (event.type === 'frame') frames.push(event);
      });
      await expect.poll(() => frames.length).toBeGreaterThan(0);
      const png = Buffer.from(frames.at(-1).data, 'base64');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1280, 960]);
      // Protocol metadata and input coordinates must stay in CSS pixels.
      expect(frames.at(-1).viewport).toMatchObject({ width: 640, height: 480 });
      await viewer.command(
        { type: 'mouse', event: { type: 'mousePressed', x: 220, y: 220, button: 'left', clickCount: 1 } },
        incarnation,
      );
      await viewer.command(
        { type: 'mouse', event: { type: 'mouseReleased', x: 220, y: 220, button: 'left', clickCount: 1 } },
        incarnation,
      );
      await viewer.command({ type: 'text', text: '\u0645\u0631\u062d\u0628\u0627' }, incarnation);
      expect(await original.locator('#draft').inputValue()).toBe('\u0645\u0631\u062d\u0628\u0627');
      await original.locator('#draft').click({ timeout: 2000 });
      expect(await original.evaluate(() => document.activeElement?.id)).toBe('draft');
      await viewer.command(
        { type: 'preferences', preferences: { width: 390, height: 844, deviceScaleFactor: 2, locale: 'ar-SA' } },
        incarnation,
      );
      expect(manager.getPage()).toBe(original);
      expect(await original.locator('#draft').inputValue()).toBe('\u0645\u0631\u062d\u0628\u0627');
      await viewer.command({ type: 'new-tab' }, incarnation);
      expect((await browser.getBrowserState())?.tabs).toHaveLength(2);
      expect(await manager.getPage().evaluate(() => [innerWidth, navigator.language])).toEqual([390, 'ar-SA']);
      await viewer.command({ type: 'switch-tab', index: 0 }, incarnation);
      expect(manager.getPage()).toBe(original);
      await viewer.command({ type: 'close-tab', index: 1 }, incarnation);
      expect((await browser.getBrowserState())?.tabs).toHaveLength(1);
      await release();
      release = undefined;
      expect(browser.isBrowserRunning()).toBe(true);
    } finally {
      await release?.();
      await browser.close();
    }
  }, 25000);
});
