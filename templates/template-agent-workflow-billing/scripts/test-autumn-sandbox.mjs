import { spawn } from 'node:child_process';
if (
  process.argv.length !== 3 ||
  process.argv[2] !== '--live' ||
  !process.env.AUTUMN_SECRET_KEY ||
  !process.env.AUTUMN_TEST_CUSTOMER_ID ||
  !process.env.AUTUMN_TEST_FEATURE_ID
) {
  console.error('Sandbox proof requires --live and explicit Autumn test credentials/customer/feature.');
  process.exitCode = 1;
} else {
  const child = spawn(
    process.execPath,
    ['node_modules/vitest/vitest.mjs', 'run', 'tests/billing/autumn-sandbox.test.ts'],
    { stdio: 'inherit', env: { ...process.env, AUTUMN_VERIFY_SANDBOX: '1' } },
  );
  child.once('exit', code => {
    process.exitCode = code ?? 1;
  });
}
