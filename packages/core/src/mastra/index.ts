import { z } from 'zod';

import { Action } from '../action';
import { Agent } from '../agent';
import { MastraEngine } from '../engine';
import { LLM } from '../llm';
import { ModelConfig } from '../llm/types';
import { BaseLogger, createLogger } from '../logger';
import { MastraMemory } from '../memory';
import { Run } from '../run/types';
import { Telemetry, InstrumentClass, OtelConfig } from '../telemetry';
import { MastraVector } from '../vector';
import { Workflow } from '../workflows';

import { StripUndefined } from './types';

@InstrumentClass({
  prefix: 'mastra',
  excludeMethods: ['getLogger', 'getTelemetry'],
})
export class Mastra<
  TSyncs extends Record<string, Action<any, any>>,
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TWorkflows extends Record<string, Workflow> = Record<string, Workflow>,
  TLogger extends BaseLogger = BaseLogger,
> {
  private vectors?: Record<string, MastraVector>;
  private agents: TAgents;
  private logger: TLogger;
  private syncs: TSyncs;
  private workflows: TWorkflows;
  private telemetry?: Telemetry;
  engine?: MastraEngine;
  memory?: MastraMemory;

  constructor(config?: {
    memory?: MastraMemory;
    syncs?: TSyncs;
    agents?: TAgents;
    engine?: MastraEngine;
    vectors?: Record<string, MastraVector>;
    logger?: TLogger;
    workflows?: TWorkflows;
    telemetry?: OtelConfig;
  }) {
    /*
    Logger
    */
    let logger = createLogger({ type: 'CONSOLE' }) as TLogger;
    if (config?.logger) {
      logger = config.logger;
    }
    this.logger = logger;

    /*
    Telemetry
    */
    if (config?.telemetry) {
      this.telemetry = Telemetry.init(config.telemetry);
    }

    /*
   Engine
   */
    if (config?.engine) {
      if (this.telemetry) {
        this.engine = this.telemetry.traceClass(config.engine, {
          excludeMethods: ['__setTelemetry', '__getTelemetry'],
        });
        this.engine.__setTelemetry(this.telemetry);
      } else {
        this.engine = config.engine;
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
      this.vectors = vectors;
    }

    /*
    Workflows
    */
    this.workflows = {} as TWorkflows;

    if (config?.workflows) {
      this.workflows = config?.workflows;
    }

    /*
    Syncs
    */
    if (config?.syncs && !config.engine) {
      throw new Error('Engine is required to run syncs');
    }

    this.syncs = (config?.syncs || {}) as TSyncs;

    /*
    Agents
    */
    const agents: Record<string, Agent> = {};
    if (config?.agents) {
      Object.entries(config.agents).forEach(([key, agent]) => {
        if (agents[key]) {
          throw new Error(`Agent with name ID:${key} already exists`);
        }

        agent.__setLogger(this.getLogger());

        if (this.telemetry) {
          agent.__setTelemetry(this.telemetry);
        }

        if (config.memory) {
          agent.__setMemory(config.memory);
        }

        agents[key] = agent;
      });
    }

    this.agents = agents as TAgents;

    if (config?.syncs && !config?.engine) {
      throw new Error('Engine is required to run syncs');
    }

    this.syncs = (config?.syncs || {}) as TSyncs;

    if (config?.engine) {
      this.engine = config.engine;
    }

    if (config?.vectors) {
      this.vectors = config.vectors;
    }

    this.memory = config?.memory;
  }

  LLM(modelConfig: ModelConfig) {
    const llm = new LLM({
      model: modelConfig,
    });

    if (this.telemetry) {
      llm.__setTelemetry(this.telemetry);
    }

    llm.__setLogger(this.getLogger());

    return llm;
  }

  public async sync<K extends keyof TSyncs>(
    key: K,
    params: TSyncs[K] extends Action<any, infer TSchemaIn, any>
      ? TSchemaIn extends z.ZodSchema
        ? z.infer<TSchemaIn>
        : never
      : never,
    runId?: Run['runId'],
  ): Promise<StripUndefined<TSyncs[K]['outputSchema']>['_input']> {
    if (!this.engine) {
      throw new Error(`Engine is required to run syncs`);
    }

    const sync = this.syncs?.[key];
    if (!sync) {
      throw new Error(`Sync function ${key as string} not found`);
    }

    const syncFn = sync['execute'];
    if (!syncFn) {
      throw new Error(`Sync function ${key as string} not found`);
    }

    return await syncFn({
      context: params,
      runId,
      engine: this.engine,
      agents: this.agents,
      vectors: this.vectors,
      llm: this.LLM,
    });
  }

  public getAgent<TAgentName extends keyof TAgents>(name: TAgentName): TAgents[TAgentName] {
    const agent = this.agents?.[name];
    if (!agent) {
      throw new Error(`Agent with name ${String(name)} not found`);
    }
    return this.agents[name];
  }

  public getWorkflow<TWorkflowId extends keyof TWorkflows>(id: TWorkflowId): TWorkflows[TWorkflowId] {
    const workflow = this.workflows?.[id];
    if (!workflow) {
      throw new Error(`Workflow with name ${name} not found`);
    }
    return workflow;
  }

  public setLogger({ logger }: { logger: TLogger }) {
    this.logger = logger;
  }

  public getLogger() {
    return this.logger;
  }

  public getTelemetry() {
    return this.telemetry;
  }

  public async getLogsByRunId(runId: string) {
    return await this.logger.getLogsByRunId(runId);
  }
}
