#!/usr/bin/env node
// One-shot: rename local harness identifiers -> agentController equivalents in mastracode src + e2e.
// Excludes storage concerns: InMemoryHarness, harnessStorage, harnessStore, and the `harness:` storage-domain key.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;

// Ordered list: longer/more-specific identifiers first so partial overlaps are safe.
// camelCase locals -> agentController*, PascalCase -> AgentController*.
const renames = [
  // mocks / test helpers
  ['createBaseMockHarness', 'createBaseMockAgentController'],
  ['createMockHarness', 'createMockAgentController'],
  ['MockHarnessOptions', 'MockAgentControllerOptions'],
  ['harnessConstructorMock', 'agentControllerConstructorMock'],
  ['harnessListThreadsMock', 'agentControllerListThreadsMock'],
  ['harnessGetCurrentThreadIdMock', 'agentControllerGetCurrentThreadIdMock'],
  ['harnessSetThreadSettingMock', 'agentControllerSetThreadSettingMock'],
  ['harnessSubscribeMock', 'agentControllerSubscribeMock'],
  ['harnessSetStateMock', 'agentControllerSetStateMock'],
  ['harnessStateMock', 'agentControllerStateMock'],
  // factories / helpers
  ['createHarnessWithModels', 'createAgentControllerWithModels'],
  ['createHarnessWithAgent', 'createAgentControllerWithAgent'],
  ['createMastraCodeHarness', 'createMastraCodeAgentController'],
  ['createHarnessCtx', 'createAgentControllerCtx'],
  ['bootLocalHarness', 'bootLocalAgentController'],
  ['mountHarnessOnMastra', 'mountAgentControllerOnMastra'],
  ['subscribeToHarness', 'subscribeToAgentController'],
  ['captureHarnessAnalytics', 'captureAgentControllerAnalytics'],
  ['getHarnessHeaders', 'getAgentControllerHeaders'],
  ['getHarnessState', 'getAgentControllerState'],
  ['harnessMessageText', 'agentControllerMessageText'],
  ['MastraCodeHarness', 'MastraCodeAgentController'],
  ['createHarness', 'createAgentController'],
  ['makeHarness', 'makeAgentController'],
  // local vars / fields
  ['harnessContext', 'agentControllerContext'],
  ['harnessConfig', 'agentControllerConfig'],
  ['harnessCtx', 'agentControllerCtx'],
  ['harnessState', 'agentControllerState'],
  ['harnessModes', 'agentControllerModes'],
  ['harnessOverride', 'agentControllerOverride'],
  ['harnessOpts', 'agentControllerOpts'],
  ['harnessCall', 'agentControllerCall'],
  ['harnessRef', 'agentControllerRef'],
  ['harnessId', 'agentControllerId'],
  ['harnessV', 'agentControllerV'],
];

// Storage tokens we must never rewrite.
const PROTECT = ['InMemoryHarness', 'harnessStorage', 'harnessStore'];

const files = execSync(
  `grep -rlE "[Hh]arness" --include="*.ts" --include="*.tsx" src e2e | grep -v /dist/ || true`,
  { cwd: root, encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

let changed = 0;
for (const rel of files) {
  const path = root + rel;
  let txt = readFileSync(path, 'utf8');
  const orig = txt;
  for (const [from, to] of renames) {
    // Skip if this identifier is actually a protected storage token prefix collision — none here since storage tokens aren't in the list.
    txt = txt.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  // Sanity: ensure we didn't accidentally clobber a protected token (they aren't in the rename list, so untouched).
  for (const p of PROTECT) {
    if (orig.includes(p) && !txt.includes(p)) {
      throw new Error(`Protected token ${p} lost in ${rel}`);
    }
  }
  if (txt !== orig) {
    writeFileSync(path, txt);
    changed++;
  }
}
console.log(`rewrote ${changed} files`);
