import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { prepareDiagnostic, runDiagnostic } from './verifier-diagnostic-runner';

const { values } = parseArgs({
  options: {
    plan: { type: 'boolean' },
    live: { type: 'boolean' },
    fixtures: { type: 'string' },
    approval: { type: 'string' },
    output: { type: 'string' },
  },
});
if (Boolean(values.plan) === Boolean(values.live) || !values.fixtures || !values.approval || !values.output)
  throw new Error('Choose --plan or --live with --fixtures --approval --output');
const paths = { fixtures: values.fixtures, approval: values.approval, output: values.output };
if (values.plan) {
  const prepared = await prepareDiagnostic(paths);
  await writeFile(prepared.approval.approvalPath, JSON.stringify(prepared.approval, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.info(
    JSON.stringify({
      approved: false,
      executionId: prepared.approval.executionId,
      approval: prepared.approval.approvalPath,
    }),
  );
} else await runDiagnostic(paths);
