import { AwsSdkInstrumentationConfig } from './types';
import { InstrumentationBase, InstrumentationModuleDefinition } from '@opentelemetry/instrumentation';
export declare class AwsInstrumentation extends InstrumentationBase<AwsSdkInstrumentationConfig> {
    static readonly component = "aws-sdk";
    private servicesExtensions;
    constructor(config?: AwsSdkInstrumentationConfig);
    protected init(): InstrumentationModuleDefinition[];
    protected patchV3ConstructStack(moduleExports: any, moduleVersion?: string): any;
    protected unpatchV3ConstructStack(moduleExports: any): any;
    protected patchV3SmithyClient(moduleExports: any): any;
    protected unpatchV3SmithyClient(moduleExports: any): any;
    protected patchV2(moduleExports: any, moduleVersion?: string): any;
    protected unpatchV2(moduleExports?: any): void;
    private _startAwsV3Span;
    private _startAwsV2Span;
    private _callUserPreRequestHook;
    private _callUserResponseHook;
    private _registerV2CompletedEvent;
    private _getV3ConstructStackPatch;
    private _getV3SmithyClientSendPatch;
    private patchV3MiddlewareStack;
    private _getV3MiddlewareStackClonePatch;
    private _getV3MiddlewareStackResolvePatch;
    private _getRequestSendPatch;
    private _getRequestPromisePatch;
    private _callOriginalFunction;
}
//# sourceMappingURL=aws-sdk.d.ts.map