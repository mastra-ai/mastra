import { triggerScenario, type Scenario } from './scenario-trigger.js';
import type { WorkOsStagingAction } from './workos-staging-actions.js';

const scenarios = ['privilege', 'country', 'device'] as const;
const scenario = process.argv[2];
if (!scenarios.includes(scenario as Scenario)) throw new Error(`Usage: trigger.ts <${scenarios.join('|')}>`);

const options = parseOptions(process.argv.slice(3));
const stagingAction = await stagingActionFromOptions(scenario as Scenario, options);
const result = await triggerScenario(scenario as Scenario, {
  ...(stagingAction ? { stagingAction } : {}),
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function parseOptions(argv: readonly string[]): ReadonlyMap<string, string | true> {
  const parsed = new Map<string, string | true>();
  for (const argument of argv) {
    const match = /^--([A-Za-z][A-Za-z-]*)(?:=(.*))?$/u.exec(argument);
    if (!match) throw new Error(`Invalid option: ${argument}`);
    const key = match[1]!;
    if (parsed.has(key)) throw new Error(`Duplicate option: --${key}`);
    parsed.set(key, match[2] ?? true);
  }
  if (parsed.has('pass') || parsed.has('password'))
    throw new Error('Do not pass passwords as command-line arguments. Use --password-stdin.');
  return parsed;
}

async function stagingActionFromOptions(
  selectedScenario: Scenario,
  options: ReadonlyMap<string, string | true>,
): Promise<WorkOsStagingAction | undefined> {
  if (options.size === 0) return undefined;
  const execute = options.get('execute') === true;
  if (selectedScenario === 'country' || selectedScenario === 'device') {
    assertOnly(options, ['user', 'password-stdin', 'ip', 'user-agent', 'new-device', 'execute']);
    const email = stringOption(options, 'user');
    if (options.get('password-stdin') !== true) throw new Error(`${selectedScenario} login requires --password-stdin.`);
    const password = (await readStdin()).replace(/\r?\n$/u, '');
    const ipAddress = optionalString(options, 'ip');
    const userAgent = optionalString(options, 'user-agent');
    if (selectedScenario === 'device' && options.get('new-device') !== true)
      throw new Error('Device login requires --new-device.');
    const login = {
      email,
      password,
      execute,
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    };
    return selectedScenario === 'device'
      ? { kind: 'device-login', newDevice: true, ...login }
      : { kind: 'password-login', ...login };
  }

  assertOnly(options, ['userId', 'user-id', 'role', 'actorId', 'actor-id', 'execute']);
  const userId = optionalString(options, 'userId') ?? stringOption(options, 'user-id');
  return {
    kind: 'membership-role-change',
    userId,
    roleSlug: stringOption(options, 'role'),
    actorId: optionalString(options, 'actorId') ?? optionalString(options, 'actor-id') ?? 'staging-trigger',
    execute,
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function assertOnly(options: ReadonlyMap<string, string | true>, allowed: readonly string[]): void {
  const unknown = [...options.keys()].find(key => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown option: --${unknown}`);
}

function stringOption(options: ReadonlyMap<string, string | true>, key: string): string {
  const value = options.get(key);
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing --${key}=<value>.`);
  return value;
}

function optionalString(options: ReadonlyMap<string, string | true>, key: string): string | undefined {
  const value = options.get(key);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
