import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
import { IORedisInstrumentationConfig } from './types';
export declare class IORedisInstrumentation extends InstrumentationBase<IORedisInstrumentationConfig> {
    constructor(config?: IORedisInstrumentationConfig);
    setConfig(config?: IORedisInstrumentationConfig): void;
    init(): InstrumentationNodeModuleDefinition[];
    /**
     * Patch send command internal to trace requests
     */
    private _patchSendCommand;
    private _patchConnection;
    private _traceSendCommand;
    private _traceConnection;
}
//# sourceMappingURL=instrumentation.d.ts.map