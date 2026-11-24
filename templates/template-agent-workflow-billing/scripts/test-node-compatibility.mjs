import { spawnSync } from 'node:child_process';
const options = process.argv.slice(2);
if (options.length !== 4 || options[0] !== '--node22' || options[2] !== '--node24')
  throw new Error('Provide --node22 and --node24 absolute installed binary paths.');
const suites = [
  ['tests/billing/policies.test.ts'],
  [
    'tests/billing/provider-contracts.test.ts',
    'tests/billing/storage.test.ts',
    'tests/billing/identity-organizations.test.ts',
    'tests/billing/accounting.test.ts',
    'tests/billing/mastra.test.ts',
    'tests/billing/recovery.test.ts',
    'tests/billing/images.test.ts',
  ],
  ['tests/billing/http.test.ts'],
  ['tests/billing/autumn-reservations.test.ts'],
  ['tests/template/studio.test.ts'],
];
for (const [index, major] of [
  [1, '22'],
  [3, '24'],
]) {
  const binary = options[index];
  if (!binary.startsWith('/')) throw new Error('Node binary paths must be absolute.');
  const version = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 10_000 });
  if (version.status !== 0 || !version.stdout.trim().startsWith(`v${major}.`))
    throw new Error(`Expected Node ${major}.`);
  for (const selected of suites) {
    console.log(JSON.stringify({ node: version.stdout.trim(), suites: selected }));
    const result = spawnSync(binary, ['node_modules/vitest/vitest.mjs', 'run', ...selected], {
      stdio: 'inherit',
      timeout: 1_200_000,
      env: { ...process.env, PATH: `${binary.slice(0, binary.lastIndexOf('/'))}:${process.env.PATH}` },
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
