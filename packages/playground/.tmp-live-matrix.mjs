// Live 18-workflow Studio matrix runner.
// Drives the real Studio UI and Workflow Builder model, saves via UI, executes via API.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4111';
const REPO = path.resolve('e2e/tests/workflow-builder');
const PORTABLE = JSON.parse(
  fs.readFileSync(path.join(REPO, 'workflow-builder-portable-prompt-suite.json'), 'utf8'),
).scenarios;
const REGISTRY = JSON.parse(fs.readFileSync(path.join(REPO, 'workflow-builder-prompt-suite.json'), 'utf8')).scenarios;
const STRICT = [
  {
    id: 'strict-support-answer-workflow',
    prompt:
      'Create a workflow named strict-support-answer-workflow with an input schema that requires exactly a prompt string and no additional properties, and an output schema that requires exactly a response string and no additional properties. Use support-agent to produce the response.',
    runInput: { prompt: 'How do I reset my password?' },
    expectedOutputShape: { response: 'string' },
  },
  {
    id: 'strict-support-ticket-workflow',
    prompt:
      'Create a workflow named strict-support-ticket-workflow with an input schema that requires exactly an email string and a summary string with no additional properties, and an output schema that requires exactly an agentText string and a ticket object containing ticketId and status strings with no additional properties. Use support-agent for the agentText and create-support-ticket for the ticket.',
    runInput: { email: 'ada@example.com', summary: 'Cannot sign in' },
    expectedOutputShape: { agentText: 'string', ticket: { ticketId: 'string', status: 'string' } },
  },
];

const SCENARIOS = [...PORTABLE, ...REGISTRY, ...STRICT];

function ok(actual, expected) {
  if (!expected) return true;
  if (typeof expected === 'string') return typeof actual === expected;
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length > 0;
  if (typeof expected === 'object' && expected !== null) {
    if (typeof actual !== 'object' || actual === null) return false;
    for (const k of Object.keys(expected)) if (!ok(actual[k], expected[k])) return false;
    return true;
  }
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function deepEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function attempt(page, scenario) {
  await page.goto(`${BASE}/workflow-builder/create`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('textarea', { timeout: 15000 });
  const ta = await page.$('textarea');
  await ta.fill(scenario.prompt);
  const submit = await page.$('button[type="submit"]');
  await submit.click();

  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const stopped = await page.$('text=/generation stopped/i');
    if (stopped) return { ok: false, err: 'generation-stopped' };
    const saveBtn = await page.$('button:has-text("Save"):not([disabled])');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(3000);
      const res = await fetch(`${BASE}/api/stored/workflows/${scenario.id}`);
      if (res.ok) return { ok: true };
      // Perhaps ID was auto-generated. List and see if it appeared very recently.
      const list = await (await fetch(`${BASE}/api/stored/workflows`)).json();
      const created = list.workflows.find(w => w.id === scenario.id);
      if (created) return { ok: true };
      return { ok: false, err: `not-persisted-under-requested-id (list has ${list.total})` };
    }
    await page.waitForTimeout(1500);
  }
  return { ok: false, err: 'timeout-waiting-ready' };
}

async function execScenario(scenario) {
  if (!scenario.runInput) return { ok: true, note: 'no-run-input' };
  try {
    const r = await fetch(`${BASE}/api/workflows/${scenario.id}/start-async`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inputData: scenario.runInput }),
    });
    if (!r.ok) return { ok: false, err: `http-${r.status}` };
    const body = await r.json();
    const out = body?.result ?? body?.output ?? body;
    if (scenario.expectedOutput) {
      const good = deepEq(out, scenario.expectedOutput);
      return { ok: good, output: out };
    }
    if (scenario.expectedOutputShape) {
      const good = ok(out, scenario.expectedOutputShape);
      return { ok: good, output: out };
    }
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, err: String(e).slice(0, 200) };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const s of SCENARIOS) {
    let creation = null;
    for (let i = 1; i <= 3; i++) {
      const page = await browser.newPage();
      try {
        creation = await attempt(page, s);
      } finally {
        await page.close();
      }
      if (creation.ok) break;
      // Between attempts, delete any partial persisted row so retry doesn't collide
      await fetch(`${BASE}/api/stored/workflows/${s.id}`, { method: 'DELETE' }).catch(() => {});
    }
    let exec = { ok: false, err: 'skipped' };
    if (creation.ok) exec = await execScenario(s);
    const row = { id: s.id, create: creation, exec };
    results.push(row);
    console.log(JSON.stringify(row));
  }
  await browser.close();
  const summary = results.map(r => ({
    id: r.id,
    create: r.create.ok,
    exec: r.exec.ok,
    err: r.create.err || r.exec.err,
  }));
  const passC = summary.filter(r => r.create).length;
  const passE = summary.filter(r => r.exec).length;
  console.log('\n=== SUMMARY ===');
  console.log(`Creation: ${passC}/${summary.length}`);
  console.log(`Execution: ${passE}/${summary.length}`);
  console.log(JSON.stringify(summary, null, 2));
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
