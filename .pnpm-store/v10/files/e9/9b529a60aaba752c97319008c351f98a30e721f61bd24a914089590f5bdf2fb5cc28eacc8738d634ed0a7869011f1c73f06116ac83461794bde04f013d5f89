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
import { S3VectorsClientResolvedConfig } from "../S3VectorsClient";
export interface S3VectorsHttpAuthSchemeParameters
  extends HttpAuthSchemeParameters {
  region?: string;
}
export interface S3VectorsHttpAuthSchemeParametersProvider
  extends HttpAuthSchemeParametersProvider<
    S3VectorsClientResolvedConfig,
    HandlerExecutionContext,
    S3VectorsHttpAuthSchemeParameters,
    object
  > {}
export declare const defaultS3VectorsHttpAuthSchemeParametersProvider: (
  config: S3VectorsClientResolvedConfig,
  context: HandlerExecutionContext,
  input: object
) => Promise<S3VectorsHttpAuthSchemeParameters>;
export interface S3VectorsHttpAuthSchemeProvider
  extends HttpAuthSchemeProvider<S3VectorsHttpAuthSchemeParameters> {}
export declare const defaultS3VectorsHttpAuthSchemeProvider: S3VectorsHttpAuthSchemeProvider;
export interface HttpAuthSchemeInputConfig extends AwsSdkSigV4AuthInputConfig {
  authSchemePreference?: string[] | Provider<string[]>;
  httpAuthSchemes?: HttpAuthScheme[];
  httpAuthSchemeProvider?: S3VectorsHttpAuthSchemeProvider;
}
export interface HttpAuthSchemeResolvedConfig
  extends AwsSdkSigV4AuthResolvedConfig {
  readonly authSchemePreference: Provider<string[]>;
  readonly httpAuthSchemes: HttpAuthScheme[];
  readonly httpAuthSchemeProvider: S3VectorsHttpAuthSchemeProvider;
}
export declare const resolveHttpAuthSchemeConfig: <T>(
  config: T & HttpAuthSchemeInputConfig & AwsSdkSigV4PreviouslyResolved
) => T & HttpAuthSchemeResolvedConfig;
