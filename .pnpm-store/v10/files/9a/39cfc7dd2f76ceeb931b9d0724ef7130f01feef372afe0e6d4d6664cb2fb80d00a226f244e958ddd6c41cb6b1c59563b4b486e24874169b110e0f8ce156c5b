import type { Mastra } from '@mastra/core';
import { MastraBase } from '@mastra/core/base';
import type { IMastraLogger } from '@mastra/core/logger';
import type { ConfigSelector, ConfigSelectorOptions, ObservabilityEntrypoint, ObservabilityInstance } from '@mastra/core/observability';
import type { ObservabilityRegistryConfig } from './config.js';
export declare class Observability extends MastraBase implements ObservabilityEntrypoint {
    #private;
    constructor(config: ObservabilityRegistryConfig);
    setMastraContext(options: {
        mastra: Mastra;
    }): void;
    setLogger(options: {
        logger: IMastraLogger;
    }): void;
    getSelectedInstance(options: ConfigSelectorOptions): ObservabilityInstance | undefined;
    /**
     * Registry management methods
     */
    registerInstance(name: string, instance: ObservabilityInstance, isDefault?: boolean): void;
    getInstance(name: string): ObservabilityInstance | undefined;
    getDefaultInstance(): ObservabilityInstance | undefined;
    listInstances(): ReadonlyMap<string, ObservabilityInstance>;
    unregisterInstance(name: string): boolean;
    hasInstance(name: string): boolean;
    setConfigSelector(selector: ConfigSelector): void;
    clear(): void;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=default.d.ts.map