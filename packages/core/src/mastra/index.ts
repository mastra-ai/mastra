import { Agent } from '../agent';
import { MastraDeployer } from '../deployer';
import { LogLevel, Logger, createLogger, noopLogger } from '../logger';
import { MastraMemory } from '../memory';
import { MastraStorage, MastraStorageLibSql } from '../storage';
import { InstrumentClass, OtelConfig, OTLPStorageExporter, Telemetry } from '../telemetry';
import { MastraTTS } from '../tts';
import { MastraVector } from '../vector';
import { Workflow } from '../workflows';

@InstrumentClass({
  prefix: 'mastra',
  excludeMethods: ['getLogger', 'getTelemetry'],
})
export class Mastra<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TWorkflows extends Record<string, Workflow> = Record<string, Workflow>,
  TVectors extends Record<string, MastraVector> = Record<string, MastraVector>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends Logger = Logger,
> {
  private vectors?: TVectors;
  private agents: TAgents;
  private logger: TLogger;
  private workflows: TWorkflows;
  private telemetry?: Telemetry;
  private tts?: TTTS;
  private deployer?: MastraDeployer;
  storage?: MastraStorage;
  memory?: MastraMemory;

  constructor(config?: {
    memory?: MastraMemory;
    agents?: TAgents;
    storage?: MastraStorage;
    vectors?: TVectors;
    logger?: TLogger | false;
    workflows?: TWorkflows;
    tts?: TTTS;
    telemetry?: OtelConfig;
    deployer?: MastraDeployer;
  }) {
    /*
      Logger
    */

    let logger: TLogger;
    if (config?.logger === false) {
      logger = noopLogger as unknown as TLogger;
    } else {
      if (config?.logger) {
        logger = config.logger;
      } else {
        const levleOnEnv = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.INFO;
        logger = createLogger({ name: 'Mastra', level: levleOnEnv }) as unknown as TLogger;
      }
    }
    this.logger = logger;

    /*
    Telemetry
    */
    // if storage is a libsql instance, we need to default the telemetry exporter to OTLPStorageExporter
    if (config?.storage && config?.storage instanceof MastraStorageLibSql) {
      const logger = config?.logger
        ? this.logger
        : createLogger({
            level: 'debug',
          });
      const newTelemetry = {
        ...(config?.telemetry || {}),
        export: {
          type: 'custom',
          exporter: new OTLPStorageExporter({
            logger,
            storage: config.storage,
          }),
        },
      };
      this.telemetry = Telemetry.init(newTelemetry as OtelConfig);
    }

    /**
     * Deployer
     **/
    if (config?.deployer) {
      this.deployer = config.deployer;
      if (this.telemetry) {
        this.deployer = this.telemetry.traceClass(config.deployer, {
          excludeMethods: ['__setTelemetry', '__getTelemetry'],
        });
        this.deployer.__setTelemetry(this.telemetry);
      }
    }

    /*
      Storage
    */
    if (config?.storage) {
      if (this.telemetry) {
        this.storage = this.telemetry.traceClass(config.storage, {
          excludeMethods: ['__setTelemetry', '__getTelemetry'],
        });
        this.storage.__setTelemetry(this.telemetry);
      } else {
        this.storage = config?.storage;
      }
    }

    /*
    Vectors
    */
    if (config?.vectors) {
      let vectors: Record<string, MastraVector> = {};
      Object.entries(config.vectors).forEach(([key, vector]) => {
        if (this.telemetry) {
          vectors[key] = this.telemetry.traceClass(vector, {
            excludeMethods: ['__setTelemetry', '__getTelemetry'],
          });
          vectors[key].__setTelemetry(this.telemetry);
        } else {
          vectors[key] = vector;
        }
      });

      this.vectors = vectors as TVectors;
    }

    if (config?.vectors) {
      this.vectors = config.vectors;
    }

    if (config?.memory) {
      this.memory = config.memory;
      if (this.telemetry) {
        this.memory = this.telemetry.traceClass(config.memory, {
          excludeMethods: ['__setTelemetry', '__getTelemetry'],
        });
        this.memory.__setTelemetry(this.telemetry);
      }
    }

    if (config?.tts) {
      this.tts = config.tts;
      Object.entries(this.tts).forEach(([key, ttsCl]) => {
        if (this.tts?.[key]) {
          if (this.telemetry) {
            // @ts-ignore
            this.tts[key] = this.telemetry.traceClass(ttsCl, {
              excludeMethods: ['__setTelemetry', '__getTelemetry'],
            });
            this.tts[key].__setTelemetry(this.telemetry);
          }
        }
      });
    }

    /*
    Agents
    */
    const agents: Record<string, Agent> = {};
    if (config?.agents) {
      Object.entries(config.agents).forEach(([key, agent]) => {
        if (agents[key]) {
          throw new Error(`Agent with name ID:${key} already exists`);
        }

        agent.__registerPrimitives({
          logger: this.getLogger(),
          telemetry: this.telemetry,
          storage: this.storage,
          memory: this.memory,
          agents: agents,
          tts: this.tts,
          vectors: this.vectors,
        });

        agents[key] = agent;
      });
    }

    this.agents = agents as TAgents;

    /*
    Workflows
    */
    this.workflows = {} as TWorkflows;

    if (config?.workflows) {
      Object.entries(config.workflows).forEach(([key, workflow]) => {
        workflow.__registerPrimitives({
          logger: this.getLogger(),
          telemetry: this.telemetry,
          storage: this.storage,
          memory: this.memory,
          agents: this.agents,
          tts: this.tts,
          vectors: this.vectors,
        });

        // @ts-ignore
        this.workflows[key] = workflow;
      });
    }
    this.setLogger({ logger });
  }

  public getAgent<TAgentName extends keyof TAgents>(name: TAgentName): TAgents[TAgentName] {
    const agent = this.agents?.[name];
    if (!agent) {
      throw new Error(`Agent with name ${String(name)} not found`);
    }
    return this.agents[name];
  }

  public getAgents() {
    return this.agents;
  }

  public getVector<TVectorName extends keyof TVectors>(name: TVectorName): TVectors[TVectorName] {
    const vector = this.vectors?.[name];
    if (!vector) {
      throw new Error(`Vector with name ${String(name)} not found`);
    }
    return vector;
  }

  public getVectors() {
    return this.vectors;
  }

  public getDeployer() {
    return this.deployer;
  }

  public getWorkflow<TWorkflowId extends keyof TWorkflows>(
    id: TWorkflowId,
    { serialized }: { serialized?: boolean } = {},
  ): TWorkflows[TWorkflowId] {
    const workflow = this.workflows?.[id];
    if (!workflow) {
      throw new Error(`Workflow with ID ${String(id)} not found`);
    }

    if (serialized) {
      return { name: workflow.name } as TWorkflows[TWorkflowId];
    }

    return workflow;
  }

  public getWorkflows(props: { serialized?: boolean } = {}): Record<string, Workflow> {
    if (props.serialized) {
      return Object.entries(this.workflows).reduce((acc, [k, v]) => {
        return {
          ...acc,
          [k]: { name: v.name },
        };
      }, {});
    }
    return this.workflows;
  }

  public setStorage({ storage }: { storage: MastraStorage }) {
    this.storage = storage;
  }

  public setLogger({ logger }: { logger: TLogger }) {
    this.logger = logger;

    if (this.agents) {
      Object.keys(this.agents).forEach(key => {
        this.agents?.[key]?.__setLogger(this.logger);
      });
    }

    if (this.workflows) {
      Object.keys(this.workflows).forEach(key => {
        this.workflows?.[key]?.__setLogger(this.logger);
      });
    }

    if (this.memory) {
      this.memory.__setLogger(this.logger);
    }

    if (this.deployer) {
      this.deployer.__setLogger(this.logger);
    }

    if (this.tts) {
      Object.keys(this.tts).forEach(key => {
        this.tts?.[key]?.__setLogger(this.logger);
      });
    }

    if (this.storage) {
      this.storage.__setLogger(this.logger);
    }

    if (this.vectors) {
      Object.keys(this.vectors).forEach(key => {
        this.vectors?.[key]?.__setLogger(this.logger);
      });
    }
  }

  public getLogger() {
    return this.logger;
  }

  public getTelemetry() {
    return this.telemetry;
  }

  public async getLogsByRunId({ runId, transportId }: { runId: string; transportId: string }) {
    if (!transportId) {
      throw new Error('Transport ID is required');
    }
    return await this.logger.getLogsByRunId({ runId, transportId });
  }

  public async getLogs(transportId: string) {
    if (!transportId) {
      throw new Error('Transport ID is required');
    }
    return await this.logger.getLogs(transportId);
  }
}
