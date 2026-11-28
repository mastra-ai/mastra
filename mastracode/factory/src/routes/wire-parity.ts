// The contract copies these code SDK types so browser code never loads the SDK. A drift fails typecheck here.
import type * as Wire from '@internal/factory-contract';
import type * as Sdk from '@mastra/code-sdk/agents/custom-provider-check';
import type { CustomProviderAuthScheme as SdkAuthScheme } from '@mastra/code-sdk/onboarding/settings';
import type { EffectiveModelScope } from '../storage/domains/projects/base.js';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Holds<T extends true[]> = T;

export type WireParity = Holds<
  [
    Same<Wire.CustomProviderAuthScheme, SdkAuthScheme>,
    Same<Wire.CustomProviderCheckFailure, Sdk.CustomProviderCheckFailure>,
    Same<Wire.CustomProviderModelsResult, Sdk.CustomProviderModelsResult>,
    Same<Wire.CustomProviderModelTestResult, Sdk.CustomProviderModelTestResult>,
    Same<Wire.EffectiveModelScope, EffectiveModelScope>,
  ]
>;
