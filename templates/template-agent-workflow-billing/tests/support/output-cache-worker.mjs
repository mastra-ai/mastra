import { register } from 'node:module';
register('../../scripts/typescript-loader.mjs', import.meta.url);
const { runtimeFixture } = await import('./mastra.ts');
const { independentClient } = await import('./billing.ts');
const [serialized, replay] = process.argv.slice(2);
const options = JSON.parse(serialized);
const runtime = await runtimeFixture(options);
const observer = await independentClient(options.databaseUrl);
try {
  let output;
  const native = runtime.agents.assistant.native;
  const generate = native.generate;
  native.generate = async function (...args) {
    const result = { ...(await generate.apply(this, args)) };
    output = new WeakRef(result);
    return result;
  };
  await observer.execute(
    "CREATE TRIGGER reject_settlement BEFORE INSERT ON billing_ledger BEGIN SELECT RAISE(FAIL, 'settlement unavailable'); END",
  );
  let code;
  try {
    await runtime.billing
      .agent('assistant')
      .generate('[success] output', { billing: runtime.billingContext, idempotencyKey: 'lost-settlement' });
  } catch (error) {
    code = error.code;
  }
  await observer.execute('DROP TRIGGER reject_settlement');
  if (replay === 'true')
    await runtime.billing
      .agent('assistant')
      .generate('[success] output', { billing: runtime.billingContext, idempotencyKey: 'lost-settlement' });
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(resolve => setImmediate(resolve));
    global.gc();
  }
  process.send({ type: 'result', code, observed: output !== undefined, retained: !!output?.deref() });
} finally {
  observer.close();
  await runtime.close();
}
process.disconnect();
