interface StepBufferItem {
    stepType: 'initial' | 'tool-result';
    text: string;
    reasoning?: string;
    sources: any[];
    files: any[];
    toolCalls: any[];
    toolResults: any[];
    warnings?: any[];
    reasoningDetails?: any;
    providerMetadata?: any;
    experimental_providerMetadata?: any;
    isContinued?: boolean;
    logprobs?: any;
    finishReason?: string;
    response?: any;
    request?: any;
    usage?: any;
}

interface BufferedByStep {
    text: string;
    reasoning: string;
    sources: any[];
    files: any[];
    toolCalls: any[];
    toolResults: any[];
    msgCount: number;
}