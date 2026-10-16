// Usage: node .action-format/compare.cjs <vitest-json>
const fs = require('fs');
const base = JSON.parse(fs.readFileSync(__dirname + '/baseline.json', 'utf8'));
const run = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const root = process.cwd() + '/packages/core/';
const now = {};
for (const f of run.testResults) {
  const c = { passed: 0, failed: 0, skipped: 0 };
  for (const a of f.assertionResults) {
    if (a.status === 'passed') c.passed++;
    else if (a.status === 'failed') c.failed++;
    else c.skipped++;
  }
  if (f.status === 'failed' && !f.assertionResults.length) c.failed = 1;
  now[f.name.replace(root, '')] = c;
}
let problems = 0;
for (const [name, b] of Object.entries(base.files)) {
  const n = now[name];
  if (!n) { console.log('MISSING', name); problems++; continue; }
  if (n.failed > b.failed || n.passed < b.passed) { console.log('REGRESSED', name, b, '->', n); problems++; }
}
const added = Object.keys(now).filter(k => !base.files[k]);
for (const k of added) {
  console.log('NEW', k, now[k]);
  if (now[k].failed) problems++;
}
console.log(`baseline ${base.totals.passed} passed / now ${run.numPassedTests} passed, ${run.numFailedTests} failed; problems=${problems}`);
