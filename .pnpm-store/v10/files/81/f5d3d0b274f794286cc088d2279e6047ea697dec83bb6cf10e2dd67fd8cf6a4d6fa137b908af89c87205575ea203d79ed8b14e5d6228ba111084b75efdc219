import { ErrorProperties, StackFrameModifierFn, StackParser, ErrorTrackingCoercer, EventHint, StackLineParser } from './types';
export declare class ErrorPropertiesBuilder {
    private coercers;
    private modifiers;
    stackParser: StackParser;
    constructor(coercers?: ErrorTrackingCoercer<any>[], parsers?: StackLineParser[], modifiers?: StackFrameModifierFn[]);
    buildFromUnknown(input: unknown, hint?: EventHint): ErrorProperties;
    modifyFrames(exceptionList: ErrorProperties['$exception_list']): Promise<ErrorProperties['$exception_list']>;
    private coerceFallback;
    private parseStacktrace;
    private applyChunkIds;
    private applyCoercers;
    private applyModifiers;
    private convertToExceptionList;
    private buildParsingContext;
    private buildCoercingContext;
}
//# sourceMappingURL=error-properties-builder.d.ts.map