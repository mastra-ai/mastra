import type { Mastra } from '..';
import type { IMastraLogger } from '../logger/index.js';
import type { ObservabilityInstance, ConfigSelectorOptions, ObservabilityEntrypoint, ConfigSelector } from './types/index.js';
export declare class NoOpObservability implements ObservabilityEntrypoint {
    setMastraContext(_options: {
        mastra: Mastra;
    }): void;
    setLogger(_options: {
        logger: IMastraLogger;
    }): void;
    getSelectedInstance(_options: ConfigSelectorOptions): ObservabilityInstance | undefined;
    registerInstance(_name: string, _instance: ObservabilityInstance, _isDefault?: boolean): void;
    getInstance(_name: string): ObservabilityInstance | undefined;
    getDefaultInstance(): ObservabilityInstance | undefined;
    listInstances(): ReadonlyMap<string, ObservabilityInstance>;
    unregisterInstance(_name: string): boolean;
    hasInstance(_name: string): boolean;
    setConfigSelector(_selector: ConfigSelector): void;
    clear(): void;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=no-op.d.ts.map