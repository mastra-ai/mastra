import { z } from 'zod';

type Json = Record<string, unknown>;
const json = (value: unknown): Json => z.record(z.string(), z.unknown()).parse(value);
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const fields = Object.entries(item);
      return Object.fromEntries(fields.sort(([a], [b]) => a.localeCompare(b)));
    }
    return item;
  });
/** Verify the sandbox namespace firewall against the expected confined egress policy. */
export function verifyFirewall(value: unknown, gatewayIp: string, port: number | readonly [number, number]) {
  z.ipv4().parse(gatewayIp);
  const allowedPorts = Array.isArray(port) ? port : [port];
  for (const item of allowedPorts) z.number().int().min(8080).max(8111).parse(item);
  if (allowedPorts.length === 2 && (allowedPorts[0] !== 8080 || allowedPorts[1] !== 8081))
    throw new Error('FIREWALL_PORT_RANGE_INVALID');
  const entries = z
    .object({ nftables: z.array(z.record(z.string(), z.unknown())).max(128) })
    .strict()
    .parse(value).nftables;
  const chains = entries.filter(entry => entry.chain).map(entry => json(entry.chain));
  const scanner = chains.filter(chain => chain.family === 'inet' && chain.table === 'scanner');
  if (
    scanner.length !== 2 ||
    scanner.some(
      chain =>
        !['input', 'output'].includes(String(chain.name)) ||
        chain.type !== 'filter' ||
        chain.hook !== chain.name ||
        chain.policy !== 'drop' ||
        chain.prio !== 0,
    ) ||
    new Set(scanner.map(chain => chain.name)).size !== 2
  )
    throw new Error('FIREWALL_DEFAULT_DROP');
  for (const chain of chains)
    if (
      !(chain.family === 'inet' && chain.table === 'scanner') &&
      !(chain.table === 'nat' && ['ip', 'ip6'].includes(String(chain.family)) && (!chain.type || chain.type === 'nat'))
    )
      throw new Error('FIREWALL_UNEXPECTED_FILTER');
  const match = (left: unknown, right: unknown, op = '==') => ({ match: { op, left, right } });
  const payload = (protocol: string, field: string) => ({ payload: { protocol, field } });
  /** Build a loopback firewall match for the selected direction, ports and optional runtime UID. */
  const loop = (direction: 'input' | 'output', ports: unknown, uid: boolean) => [
    match({ meta: { key: direction === 'input' ? 'iifname' : 'oifname' } }, 'lo'),
    match(payload('ip', direction === 'input' ? 'saddr' : 'daddr'), '127.0.0.1'),
    ...(uid ? [match({ meta: { key: 'skuid' } }, 10001)] : []),
    match(payload('tcp', 'dport'), ports),
  ];
  const established = [match({ ct: { key: 'state' } }, ['established', 'related'], 'in'), { accept: null }];
  const expected = {
    output: [
      established,
      [
        match(payload('ip', 'daddr'), gatewayIp),
        match(payload('tcp', 'dport'), allowedPorts.length === 1 ? allowedPorts[0] : { range: allowedPorts }),
        { accept: null },
      ],
      [...loop('output', 9222, true), { accept: null }],
      [...loop('output', { range: [40000, 40031] }, true), { counter: true }, { accept: null }],
      [{ counter: true }, { drop: null }],
    ],
    input: [
      established,
      [...loop('input', 9222, false), { accept: null }],
      [...loop('input', { range: [40000, 40031] }, false), { counter: true }, { accept: null }],
      [{ counter: true }, { drop: null }],
    ],
  };
  for (const direction of ['input', 'output'] as const) {
    const rules = entries
      .filter(entry => entry.rule)
      .map(entry => json(entry.rule))
      .filter(rule => rule.family === 'inet' && rule.table === 'scanner' && rule.chain === direction);
    const expressions = rules.map(rule =>
      z
        .array(z.record(z.string(), z.unknown()))
        .parse(rule.expr)
        .map(expression => {
          if ('counter' in expression) {
            const counter = z
              .object({ packets: z.number().int().nonnegative(), bytes: z.number().int().nonnegative() })
              .strict()
              .parse(expression.counter);
            void counter;
            return { counter: true };
          }
          return expression;
        }),
    );
    if (canonical(expressions) !== canonical(expected[direction])) throw new Error('FIREWALL_RULE_MISMATCH');
  }
  const scannerRules = entries
    .filter(entry => entry.rule)
    .map(entry => json(entry.rule))
    .filter(rule => rule.table === 'scanner');
  if (
    scannerRules.length !== 9 ||
    scannerRules.some(rule => rule.family !== 'inet' || !['input', 'output'].includes(String(rule.chain)))
  )
    throw new Error('FIREWALL_RULE_MISMATCH');
}
