#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const packageArg = args[0];
const restArgs = args.slice(1);

// Auto-discover observability packages
const observabilityDir = path.join(__dirname, '../observability');
const packages = fs.readdirSync(observabilityDir).filter(f => {
  const pkgJsonPath = path.join(observabilityDir, f, 'package.json');
  return fs.existsSync(pkgJsonPath);
});

if (packageArg && packages.includes(packageArg)) {
  // Test specific observability package by directory name
  const pkgJsonPath = path.join(observabilityDir, packageArg, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  const filterArg = pkg.name;
  const cmd = ['pnpm', '--filter', filterArg, 'test', ...restArgs];
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
  process.exit(result.status);
} else {
  // Run all observability packages using vitest workspace for aggregated results
  // This gives a single test summary across all packages instead of one per package
  const cmd = ['vitest', 'run', '--config', 'vitest.config.observability.ts', ...restArgs];
  if (packageArg) {
    // If a path filter was provided, add it as a pattern
    cmd.push(packageArg);
  }
  const result = spawnSync(cmd[0], cmd.slice(1), {
    stdio: 'inherit',
    cwd: __dirname + '/..',
  });
  process.exit(result.status);
}
