import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile, open } from 'node:fs/promises';
import { z } from 'zod';
import { BillingError, identifierSchema, parseInput } from '../src/billing/contracts/core.js';
import { localPaths, readLocalProfiles } from '../src/billing/providers/local/profiles.js';
import { briefSchema, kitInputSchema, approvalSchema } from '../src/images/schemas.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    profile: { type: 'string', default: 'owner' },
    'profile-file': { type: 'string' },
    workspace: { type: 'string' },
    url: { type: 'string', default: `http://127.0.0.1:${process.env.BILLING_PORT ?? 4111}` },
    json: { type: 'string' },
    input: { type: 'string' },
    key: { type: 'string' },
  },
});
const profileName = parseInput(z.enum(['owner', 'member', 'outsider']), values.profile);
const manifest = values['profile-file'] ? undefined : await readLocalProfiles(process.cwd());
const profile = values['profile-file']
  ? parseInput(
      z.object({ workspaceId: identifierSchema, credential: z.string().min(1).max(8192) }),
      JSON.parse(await readFile(values['profile-file'], 'utf8')),
    )
  : manifest?.profiles[profileName];
if (!profile || (!values['profile-file'] && !manifest?.ready)) throw new BillingError('state_unavailable');
const endpoint = parseInput(
  z.url().refine(value => {
    const u = new URL(value);
    return (
      u.protocol === 'http:' &&
      u.hostname === '127.0.0.1' &&
      !u.username &&
      !u.password &&
      u.pathname === '/' &&
      !u.search &&
      !u.hash
    );
  }),
  values.url,
);
const workspace = parseInput(identifierSchema, values.workspace ?? profile.workspaceId);
const key = parseInput(identifierSchema, values.key ?? randomUUID());
if (!values.key) console.error(`Idempotency key: ${key}`);
const base = `/billing/workspaces/${workspace}`;
async function request(path: string, body?: unknown) {
  const result = await fetch(`${endpoint.replace(/\/$/, '')}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(90000),
    headers: {
      authorization: `Bearer ${profile!.credential}`,
      'content-type': 'application/json',
      'idempotency-key': key,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = (await result.json()) as any;
  if (!result.ok) throw new BillingError(value?.error?.code ?? 'state_unavailable');
  return value;
}
async function input() {
  if ((values.json === undefined) === (values.input === undefined)) throw new BillingError('invalid_input');
  if (values.input && values.input.startsWith(localPaths(process.cwd()).directory))
    throw new BillingError('invalid_input');
  try {
    return JSON.parse(values.json ?? (await readFile(values.input!, 'utf8')));
  } catch {
    throw new BillingError('invalid_input');
  }
}
let result: unknown;
const [action, executionId, output] = positionals;
if (positionals.length > (action === 'download' ? 3 : ['status', 'resume', 'cancel'].includes(action) ? 2 : 1))
  throw new BillingError('invalid_input');
if (action === 'download') {
  const id = parseInput(z.uuid(), executionId);
  const filename = parseInput(z.string().min(1), output);
  const response = await fetch(`${endpoint.replace(/\/$/, '')}${base}/artifacts/${id}`, {
    headers: { authorization: `Bearer ${profile.credential}` },
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok || response.headers.get('content-type') !== 'image/png') {
    await response.body?.cancel();
    throw new BillingError('state_unavailable');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const file = await open(filename, 'wx', 0o600);
  try {
    await file.writeFile(bytes);
  } finally {
    await file.close();
  }
  result = { saved: filename, bytes: bytes.length };
} else if (action === 'generate')
  result = await request(`${base}/agents/image-agent/generate`, {
    prompt: parseInput(briefSchema, ((await input()) as { brief?: unknown }).brief),
  });
else if (action === 'start') {
  const kit = parseInput(kitInputSchema, await input());
  const created = await request(`${base}/workflows/image-kit/runs`, {});
  result = await request(`${base}/workflows/image-kit/runs/${created.executionId}/start`, {
    inputData: kit,
  });
} else if (['status', 'resume', 'cancel'].includes(action)) {
  const id = parseInput(identifierSchema, executionId);
  const path = `${base}/workflows/image-kit/runs/${id}`;
  result =
    action === 'status'
      ? await request(path)
      : await request(
          `${path}/${action}`,
          action === 'resume' ? { step: 'approval', resumeData: parseInput(approvalSchema, await input()) } : {},
        );
} else if (action === 'account') {
  const usage = await request(`${base}/usage`);
  result = {
    mode: usage.mode,
    authority: usage.authority,
    allowance: usage.allowance,
    meters: usage.meters.map((meter: any) => ({
      key: meter.key,
      funding: meter.funding,
      confirmedBalance: meter.confirmedBalance,
      consumedUnits: meter.consumedUnits,
    })),
  };
} else throw new BillingError('invalid_input');
console.log(JSON.stringify(result, null, 2));
