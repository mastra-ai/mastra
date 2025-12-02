import {
  AwsCredentialIdentity,
  AwsCredentialIdentityProvider,
  HttpAuthScheme,
} from "@smithy/types";
import { S3VectorsHttpAuthSchemeProvider } from "./httpAuthSchemeProvider";
export interface HttpAuthExtensionConfiguration {
  setHttpAuthScheme(httpAuthScheme: HttpAuthScheme): void;
  httpAuthSchemes(): HttpAuthScheme[];
  setHttpAuthSchemeProvider(
    httpAuthSchemeProvider: S3VectorsHttpAuthSchemeProvider
  ): void;
  httpAuthSchemeProvider(): S3VectorsHttpAuthSchemeProvider;
  setCredentials(
    credentials: AwsCredentialIdentity | AwsCredentialIdentityProvider
  ): void;
  credentials():
    | AwsCredentialIdentity
    | AwsCredentialIdentityProvider
    | undefined;
}
export type HttpAuthRuntimeConfig = Partial<{
  httpAuthSchemes: HttpAuthScheme[];
  httpAuthSchemeProvider: S3VectorsHttpAuthSchemeProvider;
  credentials: AwsCredentialIdentity | AwsCredentialIdentityProvider;
}>;
export declare const getHttpAuthExtensionConfiguration: (
  runtimeConfig: HttpAuthRuntimeConfig
) => HttpAuthExtensionConfiguration;
export declare const resolveHttpAuthRuntimeConfig: (
  config: HttpAuthExtensionConfiguration
) => HttpAuthRuntimeConfig;
