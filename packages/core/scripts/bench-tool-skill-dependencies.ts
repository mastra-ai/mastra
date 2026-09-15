import { performance } from 'node:perf_hooks';
import { Agent } from '../src/agent';
import { MessageList } from '../src/agent/message-list';
import { SkillSearchProcessor } from '../src/processors/processors/skill-search';
import { ToolSearchProcessor } from '../src/processors/processors/tool-search';
import { createToolSkillPolicy } from '../src/processors/processors/tool-skill-dependencies';
import type { ProcessInputStepArgs } from '../src/processors';
import { RequestContext, MASTRA_THREAD_ID_KEY } from '../src/request-context';
import { createTool } from '../src/tools';

// Local in-memory benchmark: no provider, network, database, or billing calls.
void Agent; // Initialize the same public module graph as the runtime.
const skillCatalog = Array.from({ length: 1000 }, (_, index) => ({
  name: `skill-${index}`,
  instructions: 'Follow the tool instructions.',
}));
const skills = {
  listNames: async () => skillCatalog.map(skill => skill.name),
  list: async () => skillCatalog,
  get: async (name: string) => skillCatalog.find(skill => skill.name === name),
  maybeRefresh: async () => {},
};
const rules = Object.fromEntries(Array.from({ length: 10000 }, (_, index) => [`tool_${index}`, ['skill-0']]));
const policy = createToolSkillPolicy(rules);
const requestContext = new RequestContext();
requestContext.set(MASTRA_THREAD_ID_KEY, 'benchmark');
const args = { requestContext, messageList: new MessageList({}), stepNumber: 0 } as ProcessInputStepArgs;
const tracked = new SkillSearchProcessor({ workspace: { skills } as any, trackReadiness: true, ttl: 0 });
const baseline = new SkillSearchProcessor({ workspace: { skills } as any, ttl: 0 });
for (const processor of [tracked, baseline]) {
  const result = await processor.processInputStep(args);
  await (result.tools as any).load_skill.execute({ skillName: 'skill-0' });
  await processor.processInputStep(args);
}
const samples = 25;
async function measure(label: string, iterations: number, operation: () => unknown, asynchronous = false) {
  const values: number[] = [];
  for (let sample = -3; sample < samples; sample++) {
    const start = performance.now();
    for (let index = 0; index < iterations; index++) {
      if (asynchronous) await operation();
      else operation();
    }
    if (sample >= 0) values.push((performance.now() - start) / iterations);
  }
  values.sort((a, b) => a - b);
  return {
    label,
    iterations,
    samples,
    medianMs: values[Math.floor(samples / 2)],
    p95Ms: values[Math.floor(samples * 0.95)],
  };
}
const results = [];
results.push(
  await measure('unprotected policy check', 10000, () =>
    policy({ toolName: 'plain', phase: 'execute', requestContext }),
  ),
);
results.push(
  await measure('protected ready check; 10000 rules', 10000, () =>
    policy({ toolName: 'tool_0', phase: 'execute', requestContext }),
  ),
);
results.push(
  await measure('missing skill check', 10000, () =>
    policy({ toolName: 'tool_0', phase: 'execute', requestContext: undefined }),
  ),
);
for (const [name, processor] of [
  ['baseline', baseline],
  ['readiness enabled', tracked],
] as const) {
  results.push(
    await measure(
      `${name} skill step; 1000 catalog entries`,
      100,
      () => processor.processInputStep({ ...args, messageList: new MessageList({}), stepNumber: 1 }),
      true,
    ),
  );
}
const tool = createTool({ id: 'tool_0', description: 'Benchmark tool', execute: async () => ({ success: true }) });
for (const enabled of [false, true]) {
  const search = new ToolSearchProcessor({
    tools: { tool_0: tool },
    search: { autoLoad: true },
    toolPolicy: enabled ? policy : undefined,
    ttl: 0,
  });
  const initial = (await search.processInputStep(args)).tools as any;
  await initial.search_tools.execute({ query: 'tool_0' });
  const active = (await search.processInputStep(args)).tools as any;
  results.push(
    await measure(`${enabled ? 'protected' : 'baseline'} executor`, 1000, () => active.tool_0.execute({}), true),
  );
  search.clearAllState();
}
tracked.dispose();
baseline.dispose();
console.log(
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      node: process.version,
      topology: 'local native processor and executor',
      catalogSize: 1000,
      dependencyRules: 10000,
      providerCalls: 0,
      results,
    },
    null,
    2,
  ),
);
