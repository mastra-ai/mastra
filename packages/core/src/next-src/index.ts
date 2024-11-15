import { Integration } from './integration';
import { Agent } from './agent';
import { createLogger, Logger, RegisteredLogger } from './logger';
import { AllTools, ToolApi } from './tools/types';
import { MastraEngine } from './engine';


export type SyncConfig<
  TIntegrations extends Integration[],
  MastraTools extends Record<
    string,
    ToolApi<TIntegrations, Record<string, any>, Record<string, any>>
  >,
  TParams
> = (params: {
  tools: AllTools<TIntegrations, MastraTools>;
  params: TParams;
  engine: MastraEngine;
  agents: Map<string, Agent<TIntegrations, MastraTools>>;
}) => Promise<void>;

export class Mastra<
  TIntegrations extends Integration[],
  MastraTools extends Record<
    string,
    ToolApi<TIntegrations, Record<string, any>, Record<string, any>>
  > = {}
> {
  private engine?: MastraEngine;
  private tools: AllTools<TIntegrations, MastraTools>;
  private agents: Map<string, Agent<TIntegrations, MastraTools>>;
  private integrations: Map<string, Integration>;
  private logger: Map<RegisteredLogger, Logger>;
  syncs: {
    [key: string]: SyncConfig<TIntegrations, MastraTools, any>;
  } = {};

  constructor(config: {
    tools: MastraTools;
    syncs: {
      [key: string]: SyncConfig<TIntegrations, MastraTools, any>;
    },
    agents: Agent<TIntegrations, MastraTools>[];
    integrations: TIntegrations;
    engine?: MastraEngine;
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

    config.integrations.forEach((integration) => {
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
    };

    // Hydrate tools with integration tools
    const hydratedTools = Object.entries(allTools).reduce<
      Record<string, ToolApi<TIntegrations, any, any>>
    >((memo, [key, val]) => {
      memo[key] = {
        ...val,
        executor: (params) => {
          return val.executor({
            ...params,
            getIntegration: <I>(name: TIntegrations[number]['name']) =>
              this.getIntegration(name) as I,
          });
        },
      };
      return memo;
    }, {});

    this.tools = hydratedTools as AllTools<TIntegrations, MastraTools>;
    this.agents = new Map();

    config.agents.forEach((agent) => {
      if (this.agents.has(agent.name)) {
        throw new Error(`Agent with name ${agent.name} already exists`);
      }
      this.agents.set(agent.name, agent);
      agent.__setTools(this.tools);
      const agentLogger = this.getLogger('AGENT');
      if (agentLogger) {
        agent.__setLogger(agentLogger);
      }
    });

    if (config.syncs && !config.engine) {
      throw new Error('Engine is required to run syncs');
    }

    if (config.engine) {
      this.engine = config.engine;
      this.syncs = config.syncs
    }
  }
  public async sync<K extends keyof typeof this.syncs>(
    key: K,
    params: Parameters<typeof this.syncs[K]>[0]['params'] // Infer params based on the selected sync function
  ): Promise<void> {
    if (!this.engine) {
      throw new Error(`Sync function ${key as string} not found`);
    }

    const syncFn = this.syncs[key];

    if (!syncFn) {
      throw new Error(`Sync function ${key as string} not found`);
    }

    await syncFn({ tools: this.tools, params, engine: this.engine, agents: this.agents });
  }

  public getAgent(name: string) {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent with name ${name} not found`);
    }
    return agent;
  }

  public getIntegration(name: string) {
    const integration = this.integrations.get(name.toUpperCase());

    if (!integration) {
      throw new Error(`Integration with name ${name} not found`);
    }
    return integration;
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

export * from './agent';
export * from './integration';
export * from './tools/types';
export * from './tools';
export * from './logger';
export * from './engine';
