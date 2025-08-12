import type { RuntimeContext } from "../../runtime-context";

export type MastraCustomSharedLLMOptions = {
    threadId?: string;
    resourceId?: string;
    runtimeContext: RuntimeContext;
    runId?: string;
};

// Tripwire result extensions
export type TripwireProperties = {
    tripwire?: boolean;
    tripwireReason?: string;
};