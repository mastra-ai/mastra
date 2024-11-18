import { Agent } from "../agent";
import { MastraEngine } from "../engine";
import { Integration } from "../integration";
import { AllTools, ToolApi } from "../tools/types";
import { MastraVector } from "../vector";

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
    vectors?: Record<string, MastraVector>;
    agents: Map<string, Agent<TIntegrations, MastraTools>>;
}) => Promise<void>;

export interface SyncMap {
    [key: string]: SyncConfig<Integration[], Record<
        string,
        ToolApi<Integration[], Record<string, any>, Record<string, any>>
    >, any>;
}