import type {
  AnalyzeStep,
  AnalyzeStepConfig,
  GenerateScoreStep,
  GenerateScoreStepConfig,
  PreprocessStep,
  PreprocessStepConfig,
  ReasonStep,
  ReasonStepConfig,
} from './types';

export function isAnalyzeConfig<TPreprocessOutput = any, TAnalyzeOutput = any>(
  step: AnalyzeStep<TPreprocessOutput, TAnalyzeOutput>,
): step is AnalyzeStepConfig<TPreprocessOutput, TAnalyzeOutput> {
  return typeof step === 'object' && step !== null && 'createPrompt' in step;
}

// Type guard helper
export function isGenerateScoreConfig<TPreprocessOutput = any, TAnalyzeOutput = any>(
  step: GenerateScoreStep<TPreprocessOutput, TAnalyzeOutput>,
): step is GenerateScoreStepConfig<TPreprocessOutput, TAnalyzeOutput> {
  return typeof step === 'object' && step !== null && 'createPrompt' in step;
}

export function isReasonConfig<TPreprocessOutput = any, TAnalyzeOutput = any>(
  step: ReasonStep<TPreprocessOutput, TAnalyzeOutput>,
): step is ReasonStepConfig<TPreprocessOutput, TAnalyzeOutput> {
  return typeof step === 'object' && step !== null && 'createPrompt' in step;
}

// Type guard helper
export function isPreprocessConfig<TOutput = any>(
  step: PreprocessStep<TOutput>,
): step is PreprocessStepConfig<TOutput> {
  return typeof step === 'object' && step !== null && 'createPrompt' in step;
}
