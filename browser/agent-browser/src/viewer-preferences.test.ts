import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright-core';
import type { Browser, BrowserContext } from 'playwright-core';
import { ViewerPreferences } from './viewer-preferences';

describe('viewer preferences in Chromium', () => {
  let browser: Browser;
  let context: BrowserContext;
  let baseUrl: string;
  const headers: string[] = [];
  const server = createServer((req, res) => {
    headers.push(String(req.headers['accept-language']));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<style>body{margin:0}.narrow{display:none}@media(max-width:500px){.narrow{display:block}}</style><input id="draft"><p class="narrow">Narrow layout</p><p>Browser text for frame proof</p>',
    );
  });
  beforeAll(async () => {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    browser = await chromium.launch({ executablePath: process.env.MASTRA_TEST_BROWSER_EXECUTABLE, headless: true });
    context = await browser.newContext();
  });
  afterAll(async () => {
    await browser?.close();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('reflows without reload, preserves input and sets real browser language', async () => {
    const page = await context.newPage();
    const settings = new ViewerPreferences(context);
    await settings.set({ width: 900, height: 700, deviceScaleFactor: 2, locale: 'ar-SA' });
    await page.goto(baseUrl);
    expect(headers.at(-1)).toMatch(/^ar-SA/);
    expect(await page.evaluate(() => navigator.language)).toBe('ar-SA');
    expect(await page.evaluate(() => new Intl.DateTimeFormat().resolvedOptions().locale)).toBe('ar-SA');
    await page.locator('#draft').fill('Unsaved input');
    await settings.set({ width: 390, height: 844, deviceScaleFactor: 2, locale: 'ar-SA' });
    expect(await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio])).toEqual([390, 844, 2]);
    expect(await page.locator('.narrow').isVisible()).toBe(true);
    expect(await page.locator('#draft').inputValue()).toBe('Unsaved input');
    const next = await context.newPage();
    await settings.apply(next);
    await next.goto(baseUrl);
    expect(await next.evaluate(() => [innerWidth, navigator.language])).toEqual([390, 'ar-SA']);
    expect(headers.at(-1)).toMatch(/^ar-SA/);

    await page.bringToFront();
    await page.evaluate(() => {
      const corner = document.createElement('div');
      corner.style.cssText = 'position:fixed;bottom:0;right:0;width:20px;height:20px;background:rgb(0,255,0)';
      document.body.append(corner);
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const session = await context.newCDPSession(page);
    const data = (await settings.capture(page, { format: 'png', maxWidth: 4096, maxHeight: 4096 }))!;
    const png = Buffer.from(data, 'base64');
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([780, 1688]);
    const bottomPixel = await page.evaluate(async data => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + data;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(img.width - 2, img.height - 2, 1, 1).data];
    }, data);
    expect(bottomPixel).toEqual([0, 255, 0, 255]);
    await session.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 40,
      y: 10,
      button: 'left',
      clickCount: 1,
    });
    await session.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 40,
      y: 10,
      button: 'left',
      clickCount: 1,
    });
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('draft');
    await page.keyboard.insertText(' Arabic input');
    expect(await page.locator('#draft').inputValue()).toContain('Arabic input');
    await session.detach();
  }, 20000);
});
