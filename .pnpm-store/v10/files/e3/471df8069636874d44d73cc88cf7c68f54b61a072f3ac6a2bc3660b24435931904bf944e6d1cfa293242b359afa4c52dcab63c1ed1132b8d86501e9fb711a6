import type { StepResult, ToolSet, StaticToolCall, StaticToolResult, DynamicToolCall, DynamicToolResult } from 'ai-v5';
export declare class DefaultStepResult<TOOLS extends ToolSet> implements StepResult<TOOLS> {
    readonly content: StepResult<TOOLS>['content'];
    readonly finishReason: StepResult<TOOLS>['finishReason'];
    readonly usage: StepResult<TOOLS>['usage'];
    readonly warnings: StepResult<TOOLS>['warnings'];
    readonly request: StepResult<TOOLS>['request'];
    readonly response: StepResult<TOOLS>['response'];
    readonly providerMetadata: StepResult<TOOLS>['providerMetadata'];
    constructor({ content, finishReason, usage, warnings, request, response, providerMetadata, }: {
        content: StepResult<TOOLS>['content'];
        finishReason: StepResult<TOOLS>['finishReason'];
        usage: StepResult<TOOLS>['usage'];
        warnings: StepResult<TOOLS>['warnings'];
        request: StepResult<TOOLS>['request'];
        response: StepResult<TOOLS>['response'];
        providerMetadata: StepResult<TOOLS>['providerMetadata'];
    });
    get text(): string;
    get reasoning(): import("ai-v5").ReasoningOutput[];
    get reasoningText(): string | undefined;
    get files(): import("ai-v5").Experimental_GeneratedImage[];
    get sources(): (({
        type: "source";
    } & {
        type: "source";
        sourceType: "url";
        id: string;
        url: string;
        title?: string;
        providerMetadata?: import("@ai-sdk/provider-v5").SharedV2ProviderMetadata;
    }) | ({
        type: "source";
    } & {
        type: "source";
        sourceType: "document";
        id: string;
        mediaType: string;
        title: string;
        filename?: string;
        providerMetadata?: import("@ai-sdk/provider-v5").SharedV2ProviderMetadata;
    }))[];
    get toolCalls(): (({
        type: "tool-call";
    } & DynamicToolCall & {
        providerMetadata?: import("ai-v5").ProviderMetadata;
    }) | ({
        type: "tool-call";
    } & StaticToolCall<TOOLS> & {
        providerMetadata?: import("ai-v5").ProviderMetadata;
    }))[];
    get staticToolCalls(): StaticToolCall<TOOLS>[];
    get dynamicToolCalls(): DynamicToolCall[];
    get toolResults(): (({
        type: "tool-result";
    } & DynamicToolResult & {
        providerMetadata?: import("ai-v5").ProviderMetadata;
    }) | ({
        type: "tool-result";
    } & StaticToolResult<TOOLS> & {
        providerMetadata?: import("ai-v5").ProviderMetadata;
    }))[];
    get staticToolResults(): StaticToolResult<TOOLS>[];
    get dynamicToolResults(): DynamicToolResult[];
}
//# sourceMappingURL=output-helpers.d.ts.map