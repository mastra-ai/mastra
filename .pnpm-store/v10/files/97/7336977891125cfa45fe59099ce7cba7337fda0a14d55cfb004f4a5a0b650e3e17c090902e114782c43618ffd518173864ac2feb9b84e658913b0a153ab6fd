import { TextMapGetter, TextMapSetter } from '@opentelemetry/api';
import type { SQS, SNS } from '../aws-sdk.types';
export declare const MAX_MESSAGE_ATTRIBUTES = 10;
declare class ContextSetter implements TextMapSetter<SQS.MessageBodyAttributeMap | SNS.MessageAttributeMap> {
    set(carrier: SQS.MessageBodyAttributeMap | SNS.MessageAttributeMap, key: string, value: string): void;
}
export declare const contextSetter: ContextSetter;
export interface AwsSdkContextObject {
    [key: string]: {
        StringValue?: string;
        Value?: string;
    };
}
declare class ContextGetter implements TextMapGetter<SQS.MessageBodyAttributeMap | SNS.MessageAttributeMap> {
    keys(carrier: SQS.MessageBodyAttributeMap | SNS.MessageAttributeMap): string[];
    get(carrier: AwsSdkContextObject, key: string): undefined | string | string[];
}
export declare const contextGetter: ContextGetter;
export declare const injectPropagationContext: (attributesMap?: SNS.MessageAttributeMap | SQS.MessageBodyAttributeMap | undefined) => SQS.MessageBodyAttributeMap | SNS.MessageAttributeMap;
export declare const extractPropagationContext: (message: SQS.Message, sqsExtractContextPropagationFromPayload: boolean | undefined) => AwsSdkContextObject | undefined;
export declare const addPropagationFieldsToAttributeNames: (messageAttributeNames: string[] | undefined, propagationFields: string[]) => string[];
export {};
//# sourceMappingURL=MessageAttributes.d.ts.map