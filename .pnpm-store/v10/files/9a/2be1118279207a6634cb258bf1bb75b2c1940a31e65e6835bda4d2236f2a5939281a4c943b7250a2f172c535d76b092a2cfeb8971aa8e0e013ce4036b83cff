import {
  AwsSdkSigV4AuthInputConfig,
  AwsSdkSigV4AuthResolvedConfig,
  AwsSdkSigV4PreviouslyResolved,
} from "@aws-sdk/core";
import {
  HandlerExecutionContext,
  HttpAuthScheme,
  HttpAuthSchemeParameters,
  HttpAuthSchemeParametersProvider,
  HttpAuthSchemeProvider,
  Provider,
} from "@smithy/types";
import { DynamoDBClientResolvedConfig } from "../DynamoDBClient";
export interface DynamoDBHttpAuthSchemeParameters
  extends HttpAuthSchemeParameters {
  region?: string;
}
export interface DynamoDBHttpAuthSchemeParametersProvider
  extends HttpAuthSchemeParametersProvider<
    DynamoDBClientResolvedConfig,
    HandlerExecutionContext,
    DynamoDBHttpAuthSchemeParameters,
    object
  > {}
export declare const defaultDynamoDBHttpAuthSchemeParametersProvider: (
  config: DynamoDBClientResolvedConfig,
  context: HandlerExecutionContext,
  input: object
) => Promise<DynamoDBHttpAuthSchemeParameters>;
export interface DynamoDBHttpAuthSchemeProvider
  extends HttpAuthSchemeProvider<DynamoDBHttpAuthSchemeParameters> {}
export declare const defaultDynamoDBHttpAuthSchemeProvider: DynamoDBHttpAuthSchemeProvider;
export interface HttpAuthSchemeInputConfig extends AwsSdkSigV4AuthInputConfig {
  authSchemePreference?: string[] | Provider<string[]>;
  httpAuthSchemes?: HttpAuthScheme[];
  httpAuthSchemeProvider?: DynamoDBHttpAuthSchemeProvider;
}
export interface HttpAuthSchemeResolvedConfig
  extends AwsSdkSigV4AuthResolvedConfig {
  readonly authSchemePreference: Provider<string[]>;
  readonly httpAuthSchemes: HttpAuthScheme[];
  readonly httpAuthSchemeProvider: DynamoDBHttpAuthSchemeProvider;
}
export declare const resolveHttpAuthSchemeConfig: <T>(
  config: T & HttpAuthSchemeInputConfig & AwsSdkSigV4PreviouslyResolved
) => T & HttpAuthSchemeResolvedConfig;
