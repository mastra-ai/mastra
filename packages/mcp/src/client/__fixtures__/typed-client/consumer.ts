import { Agent } from '@mastra/core/agent';
import type { Tool, ValidationError } from '@mastra/core/tools';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { MCPClient } from '../../../index';
import type { MCPClientOptions } from '../../../index';
import type { MCPServers } from './contracts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;

export async function check(context: Parameters<NonNullable<Tool<any, any, any, any>['execute']>>[1]) {
  const server = { command: 'unused-fixture-server' };
  const client = new MCPClient<MCPServers>({ servers: { weather: server, stocks: server } });
  const subset = new MCPClient<Pick<MCPServers, 'weather'>>({ servers: { weather: server } });
  const options: MCPClientOptions<MCPServers> = { servers: { weather: server, stocks: server } };
  new MCPClient<MCPServers>(options);
  // @ts-expect-error all declared servers are required
  new MCPClient<MCPServers>({ servers: { weather: server } });
  // @ts-expect-error undeclared constructor keys are rejected
  new MCPClient<MCPServers>({ servers: { weather: server, stocks: server, other: server } });
  // @ts-expect-error malformed contract is rejected
  new MCPClient<{ weather: { tools: { bad: { input: string } } } }>({ servers: { weather: server } });

  const flat = await client.listTools();
  const grouped = await client.listToolsets();
  const flatErrors = await client.listToolsWithErrors({ perServerTimeoutMs: 100 });
  const groupedErrors = await client.listToolsetsWithErrors();
  type Keys = Assert<Equal<keyof typeof flat, 'weather_get_weather' | 'weather_ping' | 'stocks_quote'>>;
  type ErrorKeys = Assert<Equal<keyof typeof flatErrors.tools, keyof typeof flat>>;
  type Groups = Assert<Equal<keyof typeof grouped, 'weather' | 'stocks'>>;
  type ErrorGroups = Assert<Equal<keyof typeof groupedErrors.toolsets, keyof typeof grouped>>;
  type RawNames = Assert<Equal<keyof NonNullable<typeof grouped.weather>, 'get_weather' | 'ping'>>;
  type PartialServer = Assert<undefined extends typeof grouped.weather ? true : false>;
  type PartialTool = Assert<undefined extends typeof flat.weather_get_weather ? true : false>;
  type NotAny = Assert<Equal<IsAny<NonNullable<typeof flat.weather_get_weather>>, false>>;
  const subsetTools = await subset.listTools();
  type SubsetKeys = Assert<Equal<keyof typeof subsetTools, 'weather_get_weather' | 'weather_ping'>>;
  // @ts-expect-error no arbitrary flat keys
  flat.weather_missing;
  // @ts-expect-error grouped tools use raw names
  grouped.weather?.weather_get_weather;
  // @ts-expect-error server may be absent
  grouped.weather.get_weather;
  // @ts-expect-error tool and execute may be absent
  await flat.weather_get_weather.execute({ location: 'Paris' });

  const tool = flat.weather_get_weather;
  if (tool) {
    // @ts-expect-error execute is optional
    await tool.execute({ location: 'Paris' });
  }
  if (tool?.execute) {
    await tool.execute({ location: 'Paris' });
    // @ts-expect-error required input property
    await tool.execute({});
    // @ts-expect-error incorrect input type
    await tool.execute({ location: 42 });
    // @ts-expect-error required argument
    await tool.execute();
    // @ts-expect-error context must match core execution context
    await tool.execute({ location: 'Paris' }, { unknownContext: true });
    type Execute = NonNullable<typeof tool.execute>;
    type Input = Assert<Equal<Parameters<Execute>[0], { location: string }>>;
    type Context = Assert<
      Equal<Parameters<Execute>[1], Parameters<NonNullable<Tool<any, any, any, any>['execute']>>[1] | undefined>
    >;
    type Result = Awaited<ReturnType<Execute>>;
    type ResultNotAny = Assert<Equal<IsAny<Result>, false>>;
    type Alternatives = Assert<
      Equal<Result, MCPServers['weather']['tools']['get_weather']['output'] | CallToolResult | ValidationError | void>
    >;
    const result = await tool.execute({ location: 'Paris' });
    // @ts-expect-error success is not guaranteed
    const temperature: number = result.temperature;
    if (result && 'temperature' in result && typeof result.temperature === 'number') {
      const temperature: number = result.temperature;
      void temperature;
    }
    void temperature;
    const assertions: [Input, Context, ResultNotAny, Alternatives] = [true, true, true, true];
    void assertions;
  }
  const unknownResult = await flat.weather_ping?.execute?.({});
  type UnknownOutput = Assert<Equal<typeof unknownResult, unknown>>;
  // @ts-expect-error output without a schema must be narrowed
  unknownResult.content;

  const agent = new Agent({
    id: 'typed',
    name: 'Typed',
    instructions: 'Use tools',
    model: 'openai/gpt-4o',
    tools: flat,
  });
  await agent.generate('hello', { toolsets: grouped });
  await agent.stream('hello', { toolsets: groupedErrors.toolsets });
  new Agent({
    id: 'errors',
    name: 'Errors',
    instructions: 'Use tools',
    model: 'openai/gpt-4o',
    tools: flatErrors.tools,
  });
  const dynamic = new MCPClient({ servers: { weather: server } });
  const dynamicTools = await dynamic.listTools();
  await dynamicTools.any_arbitrary_key?.execute?.({ anything: 1 }, context);
  const dynamicGroups = await dynamic.listToolsets();
  await dynamicGroups.any_server?.any_tool?.execute?.('legacy', context);
  type BroadKeys = Assert<Equal<keyof typeof dynamicTools, string>>;
  const legacyOptions: MCPClientOptions = { servers: { arbitrary: server } };
  new MCPClient(legacyOptions);
  const errors: Record<string, string> = flatErrors.errors;
  const duration: number | undefined = flatErrors.durations?.arbitrary;
  const assertions: [
    Keys,
    ErrorKeys,
    Groups,
    ErrorGroups,
    RawNames,
    PartialServer,
    PartialTool,
    NotAny,
    SubsetKeys,
    UnknownOutput,
    BroadKeys,
  ] = [true, true, true, true, true, true, true, true, true, true, true];
  void [assertions, errors, duration];
}
