// Live 21-workflow Studio matrix runner (8 portable + 13 registry).
// Drives the real Studio UI and Workflow Builder model, saves via UI, executes via API.
//
// Every scenario comes from the two shared suites, so the live matrix and the
// deterministic Playwright specs run the same set. The suites differ only by
// dependency: portable needs nothing from the registry, registry needs tools,
// agents, or workflows. Whether the real model's graph is asserted is decided
// per scenario by `liveGraphPinned`, not by which list it came from.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4111';
const REPO = path.resolve('e2e/tests/workflow-builder');
const PORTABLE = JSON.parse(
  fs.readFileSync(path.join(REPO, 'workflow-builder-portable-prompt-suite.json'), 'utf8'),
).scenarios;
const REGISTRY = JSON.parse(fs.readFileSync(path.join(REPO, 'workflow-builder-prompt-suite.json'), 'utf8')).scenarios;
const SCENARIOS = [...PORTABLE, ...REGISTRY].slice(Number(process.env.START_AT ?? 0));

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

async function listWorkflows() {
  try {
    const d = await (await fetch(`${BASE}/api/stored/workflows`)).json();
    return Array.isArray(d) ? d : (d.workflows ?? []);
  } catch {
    return [];
  }
}

// Best-effort capture of the assistant's final chat message so we can read the
// agent's own reasoning when it declines or misbuilds a workflow.
async function captureAgentText(page) {
  try {
    return await page.evaluate(() => {
      const selectors = [
        '[data-message-role="assistant"]',
        '[data-role="assistant"]',
        '[class*="assistant"]',
        '[class*="message"]',
      ];
      for (const sel of selectors) {
        const els = Array.from(document.querySelectorAll(sel));
        if (els.length) {
          const text = els[els.length - 1].innerText?.trim();
          if (text) return text.slice(-4000);
        }
      }
      return (document.body.innerText || '').trim().slice(-4000);
    });
  } catch {
    return null;
  }
}

async function attempt(page, scenario) {
  const before = new Set((await listWorkflows()).map(w => w.id));
  await page.goto(`${BASE}/workflow-builder/create`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('textarea', { timeout: 15000 });
  const ta = await page.$('textarea');
  await ta.fill(scenario.prompt);
  const submit = await page.$('button[type="submit"]');
  await submit.click();

  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const stopped = await page.$('text=/generation stopped/i');
    if (stopped) return { ok: false, err: 'generation-stopped', agentText: await captureAgentText(page) };
    const saveBtn = await page.$('button:has-text("Save"):not([disabled])');
    if (saveBtn) {
      const agentText = await captureAgentText(page);
      await saveBtn.click();
      await page.waitForTimeout(3000);

      const after = await listWorkflows();
      const notes = [];
      let row = after.find(w => w.id === scenario.id);
      if (!row) {
        // ID drift is a known defect, not a capability failure: resolve whatever
        // was actually persisted so execution still gets verified.
        const fresh = after.filter(w => !before.has(w.id));
        if (fresh.length) {
          row = fresh[fresh.length - 1];
          notes.push(`id-drift: requested "${scenario.id}", persisted "${row.id}"`);
          if (fresh.length > 1) notes.push(`multiple-persisted(${fresh.length})`);
        }
      }
      if (!row) return { ok: false, err: 'not-persisted', agentText };
      if (!row.description) notes.push('missing-description');
      return { ok: true, actualId: row.id, notes, agentText };
    }
    await page.waitForTimeout(1500);
  }
  return { ok: false, err: 'timeout-waiting-ready', agentText: await captureAgentText(page) };
}

function collectEntryIds(graph, acc = []) {
  for (const e of graph ?? []) {
    if (e?.id) acc.push(e.id);
    if (Array.isArray(e?.steps)) collectEntryIds(e.steps, acc);
    if (e?.step) collectEntryIds([e.step], acc);
    if (Array.isArray(e?.branches)) collectEntryIds(e.branches, acc);
  }
  return acc;
}

// Structural check: output-only assertions let a sequential graph masquerade as
// a parallel/foreach one, which is exactly how R3 read green for weeks.
async function checkStructure(scenario, id) {
  // Only prompts that name the mechanism may pin the shape. Scenarios that
  // constrain schemas (or nothing) are judged on runtime output alone, so a
  // different-but-valid graph is a pass rather than a failure.
  if (!scenario.liveGraphPinned || !scenario.expectedGraphEntry) return { ok: true, note: 'graph-not-pinned' };
  try {
    const def = await (await fetch(`${BASE}/api/stored/workflows/${id}`)).json();
    const ids = collectEntryIds(def?.graph);
    const found = ids.includes(scenario.expectedGraphEntry);
    return found
      ? { ok: true }
      : { ok: false, err: `missing-graph-entry "${scenario.expectedGraphEntry}"`, entryIds: ids };
  } catch (e) {
    return { ok: false, err: String(e).slice(0, 200) };
  }
}

async function execScenario(scenario, id = scenario.id) {
  if (!scenario.runInput) return { ok: true, note: 'no-run-input' };
  try {
    const r = await fetch(`${BASE}/api/workflows/${id}/start-async`, {
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
      // Delete by whatever was actually persisted, not the requested id, or
      // failed attempts leave orphaned rows behind.
      const stale = creation.actualId ?? s.id;
      await fetch(`${BASE}/api/stored/workflows/${stale}`, { method: 'DELETE' }).catch(() => {});
    }
    const resolvedId = creation.actualId ?? s.id;
    let exec = { ok: false, err: 'skipped' };
    let structure = { ok: false, err: 'skipped' };
    if (creation.ok) {
      structure = await checkStructure(s, resolvedId);
      exec = await execScenario(s, resolvedId);
    }
    const row = {
      id: s.id,
      resolvedId,
      create: creation.ok,
      structure,
      exec,
      notes: creation.notes ?? [],
      err: creation.err,
      agentText: creation.agentText ?? null,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
  await browser.close();
  const summary = results.map(r => ({
    id: r.id,
    create: r.create,
    structure: r.structure.ok,
    exec: r.exec.ok,
    notes: r.notes,
    err: r.err || r.structure.err || r.exec.err,
  }));
  const passC = summary.filter(r => r.create).length;
  const passS = summary.filter(r => r.structure).length;
  const passE = summary.filter(r => r.exec).length;
  console.log('\n=== SUMMARY ===');
  console.log(`Creation:  ${passC}/${summary.length}`);
  console.log(`Structure: ${passS}/${summary.length}`);
  console.log(`Execution: ${passE}/${summary.length}`);
  console.log(JSON.stringify(summary, null, 2));

  const drift = results.filter(r => r.notes?.length);
  if (drift.length) {
    console.log('\n=== NON-BLOCKING DEFECTS (track, fix after generation) ===');
    for (const r of drift) console.log(`${r.id}: ${r.notes.join('; ')}`);
  }

  console.log('\n=== AGENT RESPONSES ===');
  for (const r of results) {
    if (!r.agentText) continue;
    console.log(`\n--- ${r.id} (create=${r.create}${r.err ? `, ${r.err}` : ''}) ---`);
    console.log(r.agentText);
  }
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
