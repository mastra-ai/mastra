import { z } from 'zod';

import { Agent } from '../agent';
import { MastraEngine } from '../engine';
import { Integration } from '../integration';
import { LLM } from '../llm';
import { BaseLogger, createLogger } from '../logger';
import { Run } from '../run/types';
import { syncApi } from '../sync/types';
import { Telemetry, InstrumentClass, OtelConfig } from '../telemetry';
import { AllTools, ToolApi } from '../tools/types';
import { MastraVector } from '../vector';

import { StripUndefined } from './types';

@InstrumentClass({
  prefix: 'mastra',
})
export class Mastra<
  TIntegrations extends Integration[],
  MastraTools extends Record<string, any>,
  TSyncs extends Record<string, syncApi<any, any>>,
  TLogger extends BaseLogger = BaseLogger,
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
  private logger: TLogger;
  private syncs: TSyncs;
  private telemetry?: Telemetry;

  constructor(config: {
    tools?: MastraTools;
    syncs?: TSyncs;
    agents?: Agent<MastraTools, TIntegrations>[];
    integrations?: TIntegrations;
    engine?: MastraEngine;
    vectors?: Record<string, MastraVector>;
    logger?: TLogger;
    telemetry?: OtelConfig;
  }) {
    /* 
    Logger
    */
    let logger = createLogger({ type: 'CONSOLE' }) as TLogger;
    if (config.logger) {
      logger = config.logger;
    }
    this.logger = logger;

    /* 
    Telemetry
    */
    if (config.telemetry) {
      this.telemetry = Telemetry.init(config.telemetry);
    }

    /* 
    Integrations 
    */
    this.integrations = new Map();

    config.integrations?.forEach((integration) => {
      if (this.integrations.has(integration.name)) {
        throw new Error(
          `Integration with name ${integration.name} already exists`
        );
      }
      if (this.telemetry) {
        this.integrations.set(
          integration.name,
          this.telemetry.traceClass(integration)
        );
      } else {
        this.integrations.set(integration.name, integration);
      }
    });

    /* 
    Tools
    */
    const integrationTools =
      config.integrations?.reduce(
        (acc, integration) => ({
          ...acc,
          ...integration.tools,
        }),
        {}
      ) || {};

    const configuredTools = config?.tools || {};
    const allTools = { ...configuredTools, ...integrationTools } as AllTools<
      MastraTools,
      TIntegrations
    >;

    // Hydrate tools with traced integration registry
    const hydratedTools = Object.entries(allTools ?? {}).reduce<
      Record<string, ToolApi>
    >((memo, [key, val]) => {
      const hydratedExecutor = (params: any) => {
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
      };

      memo[key] = {
        ...val,
        executor: this.telemetry
          ? this.telemetry.traceMethod(hydratedExecutor, {
              spanName: `tool.${key}`,
              attributes: {
                toolName: key,
              },
            })
          : hydratedExecutor,
      };
      return memo;
    }, {});

    this.tools = hydratedTools as AllTools<MastraTools, TIntegrations>;

    /* 
    LLM
    */
    this.llm = new LLM<
      MastraTools,
      TIntegrations,
      keyof AllTools<MastraTools, TIntegrations>
    >();
    this.llm.__setTools(this.tools);
    if (this.telemetry) {
      this.llm.__setTelemetry(this.telemetry);
    }
    this.llm.__setLogger(this.getLogger());

    /* 
    Agents
    */
    this.agents = new Map();

    config.agents?.forEach((agent) => {
      if (this.agents.has(agent.name)) {
        throw new Error(`Agent with name ${agent.name} already exists`);
      }
      this.agents.set(agent.name, agent);
      agent.__setTools(this.tools);
      if (this.telemetry) {
        agent.__setTelemetry(this.telemetry);
      }
      agent.__setLogger(this.getLogger());
    });

    /* 
    Syncs
    */
    if (config.syncs && !config.engine) {
      throw new Error('Engine is required to run syncs');
    }
    this.syncs = (config.syncs || {}) as TSyncs;

    /* 
    Engine
    */
    if (config.engine) {
      if (this.telemetry) {
        this.engine = this.telemetry.traceClass(config.engine);
      } else {
        this.engine = config.engine;
      }
    }

    /* 
    Vectors
    */
    if (config.vectors) {
      this.vectors = config.vectors;
    }
  }

  public async sync<K extends keyof TSyncs>(
    key: K,
    params: TSyncs[K]['schema']['_input'],
    runId?: Run['runId']
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
      runId,
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

  public getLLM() {
    return this.llm;
  }

  public getTool<T extends keyof MastraTools>(name: T) {
    const tools = this.tools as MastraTools;
    const tool = tools[name];

    if (!tool) {
      throw new Error(`Tool with name ${String(name)} not found`);
    }

    const hydratedExecutor = async <
      IN extends MastraTools[T]['schema'],
      OUT extends StripUndefined<MastraTools[T]['outputSchema']>,
    >(
      params: z.infer<IN>,
      runId?: Run['runId']
    ): Promise<z.infer<OUT>> => {
      return tool.executor({
        data: params,
        runId,
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
    };

    return {
      ...tool,
      execute: this.telemetry
        ? this.telemetry.traceMethod(hydratedExecutor, {
            spanName: `tool.${String(name)}`,
            attributes: {
              toolName: String(name),
            },
          })
        : hydratedExecutor,
    };
  }

  public availableIntegrations() {
    return Array.from(this.integrations.entries()).map(
      ([name, integration]) => ({
        name,
        integration,
      })
    );
  }

  public getTools() {
    return this.tools;
  }

  public setLogger({ logger }: { logger: TLogger }) {
    this.logger = logger;
  }

  public getLogger() {
    return this.logger;
  }

  public async getLogsByRunId(runId: string) {
    return await this.logger.getLogsByRunId(runId);
  }
}
