import { KafkaJsInstrumentationConfig } from './types';
import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
export declare class KafkaJsInstrumentation extends InstrumentationBase<KafkaJsInstrumentationConfig> {
    constructor(config?: KafkaJsInstrumentationConfig);
    protected init(): InstrumentationNodeModuleDefinition;
    private _getConsumerPatch;
    private _getProducerPatch;
    private _getConsumerRunPatch;
    private _getConsumerEachMessagePatch;
    private _getConsumerEachBatchPatch;
    private _getProducerSendBatchPatch;
    private _getProducerSendPatch;
    private _endSpansOnPromise;
    private _startConsumerSpan;
    private _startProducerSpan;
}
//# sourceMappingURL=instrumentation.d.ts.map