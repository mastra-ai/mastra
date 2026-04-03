import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const config = JSON.parse(process.env.SMOKE_RUN_CONFIG ?? '{}');

if (!config.baseUrl) {
  throw new Error('Missing SMOKE_RUN_CONFIG.baseUrl');
}

const baseUrl = config.baseUrl;
const screenshotDir = path.resolve(config.screenshotDir ?? './screenshots');
const domains = Array.isArray(config.domains) ? config.domains : [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await fs.mkdir(screenshotDir, { recursive: true });

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push(String(err)));

const results = [];

const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function shot(name) {
  const file = path.join(screenshotDir, `${String(results.length + 1).padStart(2, '0')}-${slug(name)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function gotoStudio(route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
}

async function findInput() {
  for (const selector of ['textarea', 'input[type="text"]', '[contenteditable="true"]']) {
    const locator = page.locator(selector).first();
    if (await locator.count()) return locator;
  }
  throw new Error('No input found');
}

async function submitCurrentPage() {
  for (const selector of ['button[type="submit"]', 'button:has-text("Submit")', 'button:has-text("Run")']) {
    const button = page.locator(selector).first();
    if (await button.count()) {
      await button.click();
      return;
    }
  }
  await page.keyboard.press('Enter');
}

async function pollForText(expectedTexts, maxRetries = 12, delayMs = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    const content = (await page.content()).toLowerCase();
    if (expectedTexts.some(text => content.includes(text.toLowerCase()))) return true;
    await page.waitForTimeout(delayMs);
  }
  return false;
}

async function record(domain, test, fn) {
  const entry = { domain, test, status: 'passed', error: null, screenshot: null };
  try {
    await fn(entry);
  } catch (error) {
    entry.status = 'failed';
    entry.error = error instanceof Error ? error.message : String(error);
    try {
      entry.screenshot = await shot(`${domain}-${test}-failure`);
    } catch {}
  }
  results.push(entry);
}

async function runAgents() {
  await record('agents', 'Agent listing loads', async entry => {
    await gotoStudio('/agents');
    const content = await page.content();
    if (!content.includes('Weather Agent')) throw new Error('Weather Agent not listed');
    entry.screenshot = await shot('agents-listing');
  });

  await record('agents', 'Agent detail view loads', async entry => {
    await gotoStudio('/agents/weather-agent/chat');
    const content = await page.content();
    if (!content.includes('Weather Agent')) throw new Error('Weather Agent detail not visible');
    if (!content.toLowerCase().includes('model')) throw new Error('Model settings panel not visible');
    entry.screenshot = await shot('agents-detail');
  });

  await record('agents', 'Agent chat works', async entry => {
    await gotoStudio('/agents/weather-agent/chat');
    const input = await findInput();
    await input.fill('Hello, can you help me?');
    await submitCurrentPage();
    const ok = await pollForText(['help', 'weather'], 8, 5000);
    if (!ok) throw new Error('Agent response did not appear');
    entry.screenshot = await shot('agents-chat-response');
  });

  await record('agents', 'Agent chat handles follow-up', async entry => {
    const input = await findInput();
    await input.fill('What can you do?');
    await submitCurrentPage();
    const ok = await pollForText(['can help', 'weather', 'tool'], 8, 5000);
    if (!ok) throw new Error('Follow-up response did not appear');
    entry.screenshot = await shot('agents-follow-up-response');
  });
}

async function runNetworks() {
  await record('networks', 'Network agent is listed', async entry => {
    await gotoStudio('/agents');
    const content = await page.content();
    if (!content.includes('Planner Network')) throw new Error('Planner Network not listed');
    entry.screenshot = await shot('networks-listing');
  });

  await record('networks', 'Network mode can be selected', async entry => {
    await gotoStudio('/agents/planner-network/chat');
    const before = await page.content();
    const networkToggle = page.getByText('Network', { exact: true }).first();
    if (await networkToggle.count()) await networkToggle.click();
    const after = await page.content();
    if (!after.includes('Planner Network') && !before.includes('Planner Network')) {
      throw new Error('Planner Network chat page did not load');
    }
    entry.screenshot = await shot('networks-mode-selected');
  });

  await record('networks', 'Network coordination works', async entry => {
    const input = await findInput();
    await input.fill('What activities can I do in Tokyo based on the weather?');
    await submitCurrentPage();
    const ok = await pollForText(['tokyo', 'activity'], 12, 5000);
    if (!ok) throw new Error('Network response did not appear');
    entry.screenshot = await shot('networks-chat-response');
  });
}

try {
  if (domains.includes('agents')) await runAgents();
  if (domains.includes('networks')) await runNetworks();

  console.log(JSON.stringify({ baseUrl, domains, results, consoleErrors, screenshotDir }, null, 2));
} finally {
  await browser.close();
}
