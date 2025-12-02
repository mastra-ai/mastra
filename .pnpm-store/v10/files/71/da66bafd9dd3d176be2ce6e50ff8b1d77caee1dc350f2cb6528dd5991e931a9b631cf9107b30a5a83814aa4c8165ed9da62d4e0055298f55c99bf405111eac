import { Attributes, Context } from '@opentelemetry/api';
import { NormalizedRequest } from './types';
export declare const removeSuffixFromStringIfExists: (str: string, suffixToRemove: string) => string;
export declare const normalizeV2Request: (awsV2Request: any) => NormalizedRequest;
export declare const normalizeV3Request: (serviceName: string, commandNameWithSuffix: string, commandInput: Record<string, any>, region: string | undefined) => NormalizedRequest;
export declare const extractAttributesFromNormalizedRequest: (normalizedRequest: NormalizedRequest) => Attributes;
export declare const bindPromise: <T = unknown>(target: Promise<T>, contextForCallbacks: Context, rebindCount?: number) => Promise<T>;
//# sourceMappingURL=utils.d.ts.map