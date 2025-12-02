import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
import { DnsInstrumentationConfig } from './types';
/**
 * Dns instrumentation for Opentelemetry
 */
export declare class DnsInstrumentation extends InstrumentationBase<DnsInstrumentationConfig> {
    constructor(config?: DnsInstrumentationConfig);
    init(): (InstrumentationNodeModuleDefinition | InstrumentationNodeModuleDefinition)[];
    /**
     * Get the patched lookup function
     */
    private _getLookup;
    /**
     * Creates spans for lookup operations, restoring spans' context if applied.
     */
    private _getPatchLookupFunction;
    /**
     * Wrap lookup callback function
     */
    private _wrapLookupCallback;
}
//# sourceMappingURL=instrumentation.d.ts.map