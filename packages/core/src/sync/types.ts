import { Agent } from '../agent';
import { MastraEngine } from '../engine';
import { Integration } from '../integration';
import { LLM } from '../llm';
import { AllTools, ToolApi } from '../tools/types';
import { MastraVector } from '../vector';

export type SyncConfig<
  TIntegrations extends Integration[],
  MastraTools,
  TParams,
> = (params: {
  tools: AllTools<MastraTools, TIntegrations>;
  params: TParams;
  engine: MastraEngine;
  vectors?: Record<string, MastraVector>;
  agents: Map<string, Agent<MastraTools, TIntegrations>>;
  llm: LLM<
    MastraTools,
    TIntegrations,
    keyof AllTools<MastraTools, TIntegrations>
  >;
}) => Promise<void>;

export interface SyncMap {
  [key: string]: SyncConfig<Integration[], Record<string, ToolApi>, any>;
}
