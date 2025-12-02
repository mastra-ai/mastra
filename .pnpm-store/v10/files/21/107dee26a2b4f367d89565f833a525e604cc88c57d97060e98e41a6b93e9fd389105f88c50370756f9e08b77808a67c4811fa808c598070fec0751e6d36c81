import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
import { CassandraDriverInstrumentationConfig } from './types';
export declare class CassandraDriverInstrumentation extends InstrumentationBase<CassandraDriverInstrumentationConfig> {
    constructor(config?: CassandraDriverInstrumentationConfig);
    protected init(): InstrumentationNodeModuleDefinition;
    private _getMaxQueryLength;
    private _shouldIncludeDbStatement;
    private _getPatchedExecute;
    private _getPatchedSendOnConnection;
    private _getPatchedBatch;
    private _getPatchedStream;
    private startSpan;
    private _callResponseHook;
}
//# sourceMappingURL=instrumentation.d.ts.map