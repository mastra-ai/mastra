import { Integration } from '../integration';
import { Agent } from '../agent';
import { createLogger, Logger, RegisteredLogger } from '../logger';
import { AllTools, ToolApi } from '../tools/types';
import { MastraEngine } from '../engine';
import { MastraVector } from '../vector';
import { LLM } from '../llm';
import { z } from 'zod';
import { syncApi } from '../sync/types';
import { StripUndefined } from './types';
import { MastraMemory } from '../memory';
import { createTool } from '../tools';

export class Mastra<
  TIntegrations extends Integration[],
  MastraTools extends Record<string, any>,
  TSyncs extends Record<string, syncApi<any, any>>,
> {
  private engine?: MastraEngine;
  private vectors?: Record<string, MastraVector>;
  private tools: AllTools<MastraTools, TIntegrations>;
  private agents: Map<string, Agent<MastraTools, TIntegrations>>;
  llm: LLM<
    MastraTools,
    TIntegrations,
    keyof AllTools<MastraTools, TIntegrations>
  >;
  private integrations: Map<string, Integration>;
  private logger: Map<RegisteredLogger, Logger>;
  private syncs: TSyncs;
  memory?: MastraMemory;

  constructor(config: {
    tools?: MastraTools;
    memory?: MastraMemory;
    syncs?: TSyncs;
    agents?: Agent<MastraTools, TIntegrations>[];
    integrations?: TIntegrations;
    engine?: MastraEngine;
    vectors?: Record<string, MastraVector>;
    logger?: Logger;
  }) {
    this.logger = new Map();

    let logger: Logger = createLogger({ type: 'CONSOLE' });

    if (config.logger) {
      logger = config.logger;
    }

    this.setLogger({ key: 'AGENT', logger });
    this.setLogger({ key: 'WORKFLOW', logger });

    this.integrations = new Map();

    config.integrations?.forEach((integration) => {
      if (this.integrations.has(integration.name)) {
        throw new Error(
          `Integration with name ${integration.name} already exists`
        );
      }
      this.integrations.set(integration.name, integration);
    });

    const integrationTools =
      config.integrations?.reduce(
        (acc, integration) => ({
          ...acc,
          ...integration.tools,
        }),
        {}
      ) || {};

    const configuredTools = config?.tools || {};

    // Merge custom tools with integration tools
    const allTools = {
      ...configuredTools,
      ...integrationTools,
    } as unknown as MastraTools;

    // Hydrate tools with integration tools
    const hydratedTools = Object.entries(allTools ?? {}).reduce<
      Record<string, ToolApi>
    >((memo, [key, val]) => {
      memo[key] = {
        ...val,
        executor: (params) => {
          return val.executor({
            ...params,
            integrationsRegistry: () => ({
              get: <I extends TIntegrations[number]['name']>(name: I) =>
                this.getIntegration(name) as Extract<
                  TIntegrations[number],
                  { name: I }
                >,
            }),
            agents: this.agents,
            llm: this.llm,
            engine: this.engine,
            vectors: this.vectors,
          });
        },
      };
      return memo;
    }, {});

    this.tools = hydratedTools as AllTools<MastraTools, TIntegrations>;
    this.agents = new Map();

    this.llm = new LLM<
      MastraTools,
      TIntegrations,
      keyof AllTools<MastraTools, TIntegrations>
    >();
    this.llm.__setTools(this.tools);

    config.agents?.forEach((agent) => {
      if (this.agents.has(agent.name)) {
        throw new Error(`Agent with name ${agent.name} already exists`);
      }
      this.agents.set(agent.name, agent);
      agent.__setTools(this.tools);
      const agentLogger = this.getLogger('AGENT');
      if (agentLogger) {
        agent.__setLogger(agentLogger);
      }

      if (config.memory) {
        agent.__setMemory(config.memory);
      }
    });

    if (config.syncs && !config.engine) {
      throw new Error('Engine is required to run syncs');
    }

    this.syncs = (config.syncs || {}) as TSyncs;

    if (config.engine) {
      this.engine = config.engine;
    }

    if (config.vectors) {
      this.vectors = config.vectors;
    }

    this.memory = config.memory;
  }

  public async sync<K extends keyof TSyncs>(
    key: K,
    params: TSyncs[K]['schema']['_input']
  ): Promise<StripUndefined<TSyncs[K]['outputShema']>['_input']> {
    if (!this.engine) {
      throw new Error(`Engine is required to run syncs`);
    }

    const sync = this.syncs?.[key];

    if (!sync) {
      throw new Error(`Sync function ${key as string} not found`);
    }

    const syncFn = sync['executor'];

    if (!syncFn) {
      throw new Error(`Sync function ${key as string} not found`);
    }

    return await syncFn({
      data: params,
      engine: this.engine,
      agents: this.agents,
      vectors: this.vectors,
      llm: this.llm,
      integrationsRegistry: () => ({
        get: <I extends TIntegrations[number]['name']>(name: I) =>
          this.getIntegration(name) as Extract<
            TIntegrations[number],
            { name: I }
          >,
      }),
      toolsRegistry: <T>() => ({
        get: <N extends keyof T>(name: N) =>
          this.getTool(name as string) as T[N],
      }),
    });
  }

  public getAgent(name: string) {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent with name ${name} not found`);
    }
    return agent;
  }

  public getIntegration<I extends TIntegrations[number]['name']>(name: I) {
    const stringifiedName = String(name);
    const integration = this.integrations.get(stringifiedName.toUpperCase());

    if (!integration) {
      throw new Error(`Integration with name ${stringifiedName} not found`);
    }
    return integration as Extract<TIntegrations[number], { name: I }>;
  }

  public getTool<T extends keyof MastraTools>(name: T) {
    const tool = this.tools[name];

    if (!tool) {
      throw new Error(`Tool with name ${String(name)} not found`);
    }

    const toolSchema = tool.schema as MastraTools[T]['schema'];

    return {
      ...tool,
      execute: async (params: z.infer<typeof toolSchema>) => {
        return tool.executor({
          data: params,
          integrationsRegistry: () => ({
            get: <I extends TIntegrations[number]['name']>(name: I) =>
              this.getIntegration(name) as Extract<
                TIntegrations[number],
                { name: I }
              >,
          }),
          agents: this.agents,
          llm: this.llm,
          engine: this.engine,
        });
      },
    };
  }

  public availableIntegrations() {
    return Array.from(this.integrations.entries()).map(
      ([name, integration]) => {
        return {
          name,
          integration,
        };
      }
    );
  }

  public getTools() {
    return this.tools;
  }

  public setLogger({ key, logger }: { key: RegisteredLogger; logger: Logger }) {
    this.logger.set(key, logger);
  }

  public getLogger(key: RegisteredLogger) {
    return this.logger.get(key);
  }
}
