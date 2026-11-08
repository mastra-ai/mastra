import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { BillingError, identifierSchema, parseInput } from '../src/billing/contracts.js';
import { localPaths, readLocalProfiles } from '../src/local/profiles.js';
import { weatherPrompt, observationsSchema, reportApprovalSchema } from '../src/weather/observations.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    profile: { type: 'string', default: 'owner' },
    workspace: { type: 'string' },
    url: { type: 'string', default: `http://127.0.0.1:${process.env.BILLING_PORT ?? 4111}` },
    json: { type: 'string' },
    input: { type: 'string' },
    key: { type: 'string' },
  },
});
const profileName = parseInput(z.enum(['owner', 'member', 'outsider']), values.profile);
const manifest = await readLocalProfiles(process.cwd());
const profile = manifest?.profiles[profileName];
if (!manifest?.ready || !profile) throw new BillingError('state_unavailable');
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
const workspace = parseInput(identifierSchema, values.workspace ?? manifest.profiles.owner?.workspaceId);
const key = parseInput(identifierSchema, values.key ?? randomUUID());
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
const [action, executionId] = positionals;
if (positionals.length > (['status', 'resume', 'cancel'].includes(action) ? 2 : 1))
  throw new BillingError('invalid_input');
if (action === 'generate')
  result = await request(`${base}/agents/weather-agent/generate`, { prompt: weatherPrompt(await input()) });
else if (action === 'start') {
  const observations = parseInput(observationsSchema, await input());
  const created = await request(`${base}/workflows/weather-report/runs`, {});
  result = await request(`${base}/workflows/weather-report/runs/${created.executionId}/start`, {
    inputData: observations,
  });
} else if (['status', 'resume', 'cancel'].includes(action)) {
  const id = parseInput(identifierSchema, executionId);
  const path = `${base}/workflows/weather-report/runs/${id}`;
  result =
    action === 'status'
      ? await request(path)
      : await request(
          `${path}/${action}`,
          action === 'resume' ? { step: 'approval', resumeData: parseInput(reportApprovalSchema, await input()) } : {},
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
