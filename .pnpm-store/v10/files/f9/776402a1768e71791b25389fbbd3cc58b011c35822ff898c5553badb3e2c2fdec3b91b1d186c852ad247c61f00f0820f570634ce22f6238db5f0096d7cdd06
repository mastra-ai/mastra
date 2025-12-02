import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation';
import type { FastifyInstrumentationConfig } from './types';
export declare const ANONYMOUS_NAME = "anonymous";
/**
 * Fastify instrumentation for OpenTelemetry
 * @deprecated This instrumentation is deprecated in favor of the official instrumentation package `@fastify/otel`,
 *             which is maintained by the fastify authors.
 */
export declare class FastifyInstrumentation extends InstrumentationBase<FastifyInstrumentationConfig> {
    constructor(config?: FastifyInstrumentationConfig);
    init(): InstrumentationNodeModuleDefinition[];
    private _hookOnRequest;
    private _wrapHandler;
    private _wrapAddHook;
    private _patchConstructor;
    private _patchSend;
    private _hookPreHandler;
}
//# sourceMappingURL=instrumentation.d.ts.map