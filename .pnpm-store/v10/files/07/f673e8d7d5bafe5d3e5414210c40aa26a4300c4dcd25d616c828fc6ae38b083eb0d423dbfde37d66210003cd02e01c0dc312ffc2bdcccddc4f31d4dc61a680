import { Span } from '@opentelemetry/api';
import { InstrumentationConfig } from '@opentelemetry/instrumentation';
import { SQS } from './aws-sdk.types';
export declare type CommandInput = Record<string, any>;
/**
 * These are normalized request and response, which are used by both sdk v2 and v3.
 * They organize the relevant data in one interface which can be processed in a
 * uniform manner in hooks
 */
export interface NormalizedRequest {
    serviceName: string;
    commandName: string;
    commandInput: CommandInput;
    region?: string;
}
export interface NormalizedResponse {
    data: any;
    request: NormalizedRequest;
    requestId: string;
}
export interface AwsSdkRequestHookInformation {
    moduleVersion?: string;
    request: NormalizedRequest;
}
export interface AwsSdkRequestCustomAttributeFunction {
    (span: Span, requestInfo: AwsSdkRequestHookInformation): void;
}
export interface AwsSdkResponseHookInformation {
    moduleVersion?: string;
    response: NormalizedResponse;
}
/**
 * span can be used to add custom attributes, or for any other need.
 * response is the object that is returned to the user calling the aws-sdk operation.
 * The response type and attributes on the response are client-specific.
 */
export interface AwsSdkResponseCustomAttributeFunction {
    (span: Span, responseInfo: AwsSdkResponseHookInformation): void;
}
export interface AwsSdkSqsProcessHookInformation {
    message: SQS.Message;
}
export interface AwsSdkSqsProcessCustomAttributeFunction {
    (span: Span, sqsProcessInfo: AwsSdkSqsProcessHookInformation): void;
}
export declare type AwsSdkDynamoDBStatementSerializer = (operation: string, commandInput: CommandInput) => string | undefined;
export interface AwsSdkInstrumentationConfig extends InstrumentationConfig {
    /** hook for adding custom attributes before request is sent to aws */
    preRequestHook?: AwsSdkRequestCustomAttributeFunction;
    /** hook for adding custom attributes when response is received from aws */
    responseHook?: AwsSdkResponseCustomAttributeFunction;
    /** hook for adding custom attribute when an sqs process span is started */
    sqsProcessHook?: AwsSdkSqsProcessCustomAttributeFunction;
    /** custom serializer function for the db.statement attribute in DynamoDB spans */
    dynamoDBStatementSerializer?: AwsSdkDynamoDBStatementSerializer;
    /**
     * Most aws operation use http request under the hood.
     * if http instrumentation is enabled, each aws operation will also create
     * an http/s child describing the communication with amazon servers.
     * Setting the `suppressInternalInstrumentation` config value to `true` will
     * cause the instrumentation to suppress instrumentation of underlying operations,
     * effectively causing those http spans to be non-recordable.
     */
    suppressInternalInstrumentation?: boolean;
    /**
     * In some cases the context propagation headers may be found in the message payload
     * rather than the message attribute.
     * When this field is turned on the instrumentation will parse the payload and extract the
     * context from there.
     * Even if the field is on and MessageAttribute contains context propagation field are present,
     * the MessageAttribute will get priority.
     * By default it is off.
     */
    sqsExtractContextPropagationFromPayload?: boolean;
}
//# sourceMappingURL=types.d.ts.map