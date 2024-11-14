import { Integration } from './integration';
import { Agent } from './agent';
import { createLogger, Logger, RegisteredLogger } from './logger';
import { AllTools, ToolApi } from './tools/types';

type SyncFunction<
  TTools extends Record<string, ToolApi> | undefined = undefined
> = (params: { tools: TTools; params: Record<string, any> }) => Promise<void>;

export class Mastra<
  MastraTools extends Record<string, ToolApi>,
  TIntegrations extends Integration[]
> {
  private tools: AllTools<MastraTools, TIntegrations>;
  private agents: Map<string, Agent<MastraTools, TIntegrations>>;
  private integrations: Map<string, Integration>;
  private logger: Map<RegisteredLogger, Logger>;
  private syncs: Map<
    string,
    SyncFunction<AllTools<MastraTools, TIntegrations>>
  >;

  constructor(config: {
    tools: MastraTools;
    syncs: Record<
      string,
      (params: {
        tools: AllTools; // You'll need to define/import Tools type
      }) => Promise<void>
    >;
    agents: Agent<MastraTools, TIntegrations>[];
    integrations: TIntegrations;
    logger?: Logger;
  }) {
    this.logger = new Map();

    let logger: Logger = createLogger({ type: 'CONSOLE' });

    if (config.logger) {
      logger = config.logger;
    }

    this.setLogger({ key: 'AGENT', logger });
    this.setLogger({ key: 'WORKFLOW', logger });

    // Merge custom tools with integration tools
    this.tools = {
      ...(config.tools || {}),
      ...(config.integrations?.reduce(
        (acc, integration) => ({
          ...acc,
          ...integration.tools,
        }),
        {}
      ) || {}),
    } as AllTools<MastraTools, TIntegrations>;

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

    this.integrations = new Map();

    config.integrations.forEach((integration) => {
      if (this.integrations.has(integration.name)) {
        throw new Error(
          `Integration with name ${integration.name} already exists`
        );
      }
      this.integrations.set(integration.name, integration);
    });

    this.syncs = new Map();

    Object.entries(config.syncs).forEach(([key, sync]) => {
      this.syncs.set(key, sync);
    });
  }

  public async sync(key: string, params: Record<string, any>) {
    const sync = this.syncs.get(key);
    if (!sync) {
      throw new Error(`Sync function ${key} not found`);
    }
    await sync({ tools: this.tools, params });
  }

  public getAgent(name: string) {
    return this.agents.get(name);
  }

  public getIntegration(name: string) {
    return this.integrations.get(name);
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
