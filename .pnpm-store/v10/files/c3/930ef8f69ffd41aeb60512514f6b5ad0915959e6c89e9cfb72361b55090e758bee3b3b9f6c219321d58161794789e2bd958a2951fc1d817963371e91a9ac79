export declare const FunctionBasedScorerBuilders: {
    basic: import("./base").MastraScorer<"test-scorer", any, any, Record<"generateScoreStepResult", number>>;
    withPreprocess: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: any;
        reformattedOutput: any;
    }> & Record<"generateScoreStepResult", number>>;
    withPreprocessAndAnalyze: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: any;
        reformattedOutput: any;
    }> & Record<"analyzeStepResult", {
        inputFromAnalyze: string;
        outputFromAnalyze: string;
    }> & Record<"generateScoreStepResult", number>>;
    withPreprocessAndAnalyzeAndReason: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: any;
        reformattedOutput: any;
    }> & Record<"analyzeStepResult", {
        inputFromAnalyze: string;
        outputFromAnalyze: string;
    }> & Record<"generateScoreStepResult", number> & Record<"generateReasonStepResult", string>>;
    withPreprocessAndReason: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: any;
        reformattedOutput: any;
    }> & Record<"generateScoreStepResult", number> & Record<"generateReasonStepResult", string>>;
    withAnalyze: import("./base").MastraScorer<"test-scorer", any, any, Record<"analyzeStepResult", {
        inputFromAnalyze: string;
        outputFromAnalyze: string;
    }> & Record<"generateScoreStepResult", number>>;
    withAnalyzeAndReason: import("./base").MastraScorer<"test-scorer", any, any, Record<"analyzeStepResult", {
        inputFromAnalyze: string;
        outputFromAnalyze: string;
    }> & Record<"generateScoreStepResult", number> & Record<"generateReasonStepResult", string>>;
    withReason: import("./base").MastraScorer<"test-scorer", any, any, Record<"generateScoreStepResult", number> & Record<"generateReasonStepResult", string>>;
};
export declare const PromptBasedScorerBuilders: {
    withAnalyze: import("./base").MastraScorer<"test-scorer", any, any, Record<"analyzeStepResult", {
        inputLength: number;
        outputLength: number;
    }> & Record<"generateScoreStepResult", number>>;
    withPreprocessAndAnalyze: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: string;
        reformattedOutput: string;
    }> & Record<"analyzeStepResult", {
        inputLength: number;
        outputLength: number;
    }> & Record<"generateScoreStepResult", number>>;
    withAnalyzeAndReason: import("./base").MastraScorer<"test-scorer", any, any, Record<"analyzeStepResult", {
        inputLength: number;
        outputLength: number;
    }> & Record<"generateScoreStepResult", number> & Record<"generateReasonStepResult", string>>;
    withGenerateScoreAsPromptObject: import("./base").MastraScorer<"test-scorer", any, any, Record<"generateScoreStepResult", number> & Record<"generateReasonStepResult", string>>;
    withAllSteps: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: string;
        reformattedOutput: string;
    }> & Record<"analyzeStepResult", {
        inputLength: number;
        outputLength: number;
    }> & Record<"generateScoreStepResult", number> & Record<"generateReasonStepResult", string>>;
};
export declare const MixedScorerBuilders: {
    withPreprocessFunctionAnalyzePrompt: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: string;
        reformattedOutput: string;
    }> & Record<"analyzeStepResult", {
        inputLength: number;
        outputLength: number;
    }> & Record<"generateScoreStepResult", number>>;
    withPreprocessPromptAnalyzeFunction: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: string;
        reformattedOutput: string;
    }> & Record<"analyzeStepResult", {
        inputFromAnalyze: string;
        outputFromAnalyze: string;
    }> & Record<"generateScoreStepResult", number>>;
    withReasonFunctionAnalyzePrompt: import("./base").MastraScorer<"test-scorer", any, any, Record<"analyzeStepResult", {
        inputLength: number;
        outputLength: number;
    }> & Record<"generateScoreStepResult", number> & Record<"generateReasonStepResult", string>>;
    withReasonPromptAnalyzeFunction: import("./base").MastraScorer<"test-scorer", any, any, Record<"analyzeStepResult", {
        inputFromAnalyze: string;
        outputFromAnalyze: string;
    }> & Record<"generateScoreStepResult", number> & Record<"generateReasonStepResult", string>>;
};
export declare const AsyncFunctionBasedScorerBuilders: {
    basic: import("./base").MastraScorer<"test-scorer", any, any, Record<"generateScoreStepResult", number>>;
    withPreprocess: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: any;
        reformattedOutput: any;
    }> & Record<"generateScoreStepResult", number>>;
    withPreprocessFunctionAndAnalyzePromptObject: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: any;
        reformattedOutput: any;
    }> & Record<"analyzeStepResult", {
        inputFromAnalyze: string;
        outputFromAnalyze: string;
    }> & Record<"generateScoreStepResult", number>>;
    withPreprocessPromptObjectAndAnalyzeFunction: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: string;
        reformattedOutput: string;
    }> & Record<"analyzeStepResult", {
        inputFromAnalyze: string;
        outputFromAnalyze: string;
    }> & Record<"generateScoreStepResult", number>>;
    withAsyncCreatePromptInPreprocess: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: string;
        reformattedOutput: string;
    }> & Record<"generateScoreStepResult", number>>;
    withAsyncCreatePromptInAnalyze: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: any;
        reformattedOutput: any;
    }> & Record<"analyzeStepResult", {
        inputFromAnalyze: string;
        outputFromAnalyze: string;
    }> & Record<"generateScoreStepResult", number>>;
    withAsyncCreatePromptInGenerateScore: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: any;
        reformattedOutput: any;
    }> & Record<"generateScoreStepResult", number>>;
    withAsyncCreatePromptInGenerateReason: import("./base").MastraScorer<"test-scorer", any, any, Record<"preprocessStepResult", {
        reformattedInput: any;
        reformattedOutput: any;
    }> & Record<"generateScoreStepResult", number> & Record<"generateReasonStepResult", string>>;
};
//# sourceMappingURL=base.test-utils.d.ts.map