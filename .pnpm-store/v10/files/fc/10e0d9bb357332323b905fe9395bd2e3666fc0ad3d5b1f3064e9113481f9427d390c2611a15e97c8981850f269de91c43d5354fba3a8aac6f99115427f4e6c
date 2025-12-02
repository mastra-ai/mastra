import { InstrumentationBase, InstrumentationConfig, InstrumentationNodeModuleDefinition, InstrumentationNodeModuleFile } from '@opentelemetry/instrumentation';
export declare class NestInstrumentation extends InstrumentationBase {
    static readonly COMPONENT = "@nestjs/core";
    static readonly COMMON_ATTRIBUTES: {
        component: string;
    };
    constructor(config?: InstrumentationConfig);
    init(): InstrumentationNodeModuleDefinition;
    getNestFactoryFileInstrumentation(versions: string[]): InstrumentationNodeModuleFile;
    getRouterExecutionContextFileInstrumentation(versions: string[]): InstrumentationNodeModuleFile;
    private ensureWrapped;
}
//# sourceMappingURL=instrumentation.d.ts.map