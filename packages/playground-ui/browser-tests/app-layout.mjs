import { chromium, expect } from '../../playground/node_modules/@playwright/test/index.mjs';

const origin = process.argv[2] ?? 'http://localhost:6019';
const browser = await chromium.launch({ headless: true });
const stories = ['full-chrome', 'no-breadcrumb', 'no-page-header', 'body-only', 'mobile-trigger-only'];
const viewports = [
  { width: 1440, height: 1000 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 375, height: 667 },
];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const story of stories) {
      await page.goto(`${origin}/iframe.html?id=layout-applayout--${story}&viewMode=story`);
      const main = page.getByRole('main');
      const frame = page.locator('[data-slot="app-frame"]');
      const trigger = page.getByRole('button', { name: 'Open navigation menu' });
      await expect(main).toBeVisible();
      for (const button of await page.getByRole('button').all()) {
        await expect(button).toHaveCSS('user-select', 'none');
      }
      await expect(main).not.toHaveCSS('user-select', 'none');
      await expect(page.getByRole('heading', { name: 'Research agent', exact: true })).toHaveCount(
        ['full-chrome', 'no-breadcrumb'].includes(story) ? 1 : 0,
      );
      await expect(page.getByRole('group', { name: 'Route header' })).toHaveCount(
        ['full-chrome', 'no-page-header'].includes(story) ? 1 : 0,
      );
      await expect(frame).toHaveCSS('overflow-y', 'clip');
      await expect(main).toHaveCSS('overflow-y', 'scroll');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(viewport.height);
      const frameBefore = await frame.boundingBox();
      await main.focus();
      await page.keyboard.press('PageDown');
      await expect.poll(() => main.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      expect(await frame.boundingBox()).toEqual(frameBefore);
      expect(await frame.evaluate(element => element.scrollTop)).toBe(0);
      await main.evaluate(element => {
        element.scrollTop = 0;
      });
      if (viewport.width < 1024) {
        await expect(trigger).toBeVisible();
        const bounds = await frame.boundingBox();
        expect(bounds.x).toBe(0);
        expect(bounds.width).toBe(viewport.width);
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Navigation' });
        await expect(dialog).toBeVisible();
        await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
        const tabStops = await dialog.locator('a[href], button:not([disabled])').count();
        for (let index = 0; index < tabStops + 2; index++) {
          await page.keyboard.press('Tab');
          await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
        }
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await trigger.click();
        await dialog.getByRole('link', { name: 'Traces', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        expect(new URL(page.url()).hash).toBe('#/traces');
      } else {
        await expect(trigger).toHaveCount(0);
        const toggle = page.getByRole('button', { name: 'Toggle sidebar' });
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await main.focus();
        await page.keyboard.press('[');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await page.keyboard.press('[');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect.poll(async () => (await frame.boundingBox()).width).toBeGreaterThan(frameBefore.width);
        await main.hover({ position: { x: 200, y: 150 } });
        await expect(toggle.locator('..')).toHaveCSS('opacity', '0');
        await toggle.hover();
        await expect(toggle.locator('..')).toHaveCSS('opacity', '1');
        await main.hover({ position: { x: 200, y: 150 } });
        await toggle.focus();
        await expect(toggle.locator('..')).toHaveCSS('opacity', '1');
        await page.keyboard.press('Enter');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      }
      console.log(`PASS ${story} ${viewport.width}x${viewport.height}`);
    }
    expect(errors).toEqual([]);
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${origin}/iframe.html?id=layout-applayout--drawer&viewMode=story`);
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible();
  console.log('PASS drawer close and breakpoint crossing');
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const story of ['layout-applayout--full-chrome', 'new-sidebarnew--default']) {
    await page.goto(`${origin}/iframe.html?id=${story}&viewMode=story`);
    await expect(page.getByRole('link', { name: 'Credit balance' })).toBeVisible();
    await page.getByRole('button', { name: /Justin Levine/ }).dblclick();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
    await page.keyboard.press('Escape');
    const footer = page.locator('[data-slot="sidebar-new-footer"]');
    for (const collapsed of [false, true]) {
      if (collapsed) await page.getByRole('button', { name: 'Toggle sidebar' }).click();
      const account = page.getByRole('button', { name: /Justin Levine/ });
      const footerTop = await footer.evaluate(element => element.getBoundingClientRect().top);
      const accountTop = await account.evaluate(element => element.getBoundingClientRect().top);
      await account.click();
      await expect(page.getByRole('menu')).toBeVisible();
      expect(await footer.evaluate(element => element.getBoundingClientRect().top)).toBe(footerTop);
      expect(await account.evaluate(element => element.getBoundingClientRect().top)).toBe(accountTop);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
      expect(await footer.evaluate(element => element.getBoundingClientRect().top)).toBe(footerTop);
    }
    await page.getByRole('button', { name: /Justin Levine/ }).click();
    await page.getByRole('menuitem', { name: 'Gateway', exact: true }).click();
    await expect(page.getByRole('link', { name: 'API keys', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to main navigation: Gateway' }).click();
    await expect(page.getByRole('link', { name: 'Traces', exact: true })).toBeVisible();
    console.log(`PASS shared sidebar navigation ${story}`);
  }
  await page.goto(`${origin}/iframe.html?id=new-sidebarnew--command-header&viewMode=story`);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Search', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  console.log('PASS original command header search');
  for (const viewport of [
    { width: 1440, height: 500 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${origin}/iframe.html?id=layout-applayout--full-chrome&viewMode=story`);
    const main = page.getByRole('main');
    const scrollbar = main.locator('..').locator(':scope > [data-orientation="vertical"]');
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await breadcrumb.hover();
    await expect(scrollbar).toHaveCSS('opacity', '0');
    await main.hover();
    await expect(scrollbar).toHaveCSS('opacity', '1');
    await expect(scrollbar).toHaveCSS('width', '4px');
    await page.mouse.wheel(0, 240);
    await expect.poll(() => main.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(scrollbar).toHaveAttribute('data-scrolling', '');
    await breadcrumb.hover();
    await expect(scrollbar).toHaveCSS('opacity', '0');
    await main.getByText('Research run 3', { exact: true }).dblclick();
    expect(await page.evaluate(() => window.getSelection()?.toString())).not.toBe('');
    console.log(`PASS matching content scrollbar and selectable page text ${viewport.width}x${viewport.height}`);
  }
  await page.setViewportSize({ width: 1440, height: 500 });
  for (const story of ['layout-applayout--full-chrome', 'new-sidebarnew--default']) {
    await page.goto(`${origin}/iframe.html?id=${story}&viewMode=story`);
    const navigation = page.getByRole('navigation', { name: 'Main', exact: true });
    const scrollbar = navigation.locator('[data-orientation="vertical"][data-has-overflow-y]');
    await page.getByRole('main').hover();
    await expect(scrollbar).toHaveCSS('opacity', '0');
    await navigation.hover();
    await expect(scrollbar).toHaveCSS('opacity', '1');
    await page.mouse.wheel(0, 160);
    await expect(scrollbar).toHaveAttribute('data-scrolling', '');
    await page.getByRole('main').hover();
    await expect(scrollbar).toHaveCSS('opacity', '0');
    console.log(`PASS transient scrollbar ${story}`);
  }
} finally {
  await browser.close();
}
