import { AwsSdkSigV4AuthInputConfig, AwsSdkSigV4AuthResolvedConfig, AwsSdkSigV4PreviouslyResolved } from "@aws-sdk/core";
import { HandlerExecutionContext, HttpAuthScheme, HttpAuthSchemeParameters, HttpAuthSchemeParametersProvider, HttpAuthSchemeProvider, Provider } from "@smithy/types";
import { S3VectorsClientResolvedConfig } from "../S3VectorsClient";
/**
 * @internal
 */
export interface S3VectorsHttpAuthSchemeParameters extends HttpAuthSchemeParameters {
    region?: string;
}
/**
 * @internal
 */
export interface S3VectorsHttpAuthSchemeParametersProvider extends HttpAuthSchemeParametersProvider<S3VectorsClientResolvedConfig, HandlerExecutionContext, S3VectorsHttpAuthSchemeParameters, object> {
}
/**
 * @internal
 */
export declare const defaultS3VectorsHttpAuthSchemeParametersProvider: (config: S3VectorsClientResolvedConfig, context: HandlerExecutionContext, input: object) => Promise<S3VectorsHttpAuthSchemeParameters>;
/**
 * @internal
 */
export interface S3VectorsHttpAuthSchemeProvider extends HttpAuthSchemeProvider<S3VectorsHttpAuthSchemeParameters> {
}
/**
 * @internal
 */
export declare const defaultS3VectorsHttpAuthSchemeProvider: S3VectorsHttpAuthSchemeProvider;
/**
 * @internal
 */
export interface HttpAuthSchemeInputConfig extends AwsSdkSigV4AuthInputConfig {
    /**
     * A comma-separated list of case-sensitive auth scheme names.
     * An auth scheme name is a fully qualified auth scheme ID with the namespace prefix trimmed.
     * For example, the auth scheme with ID aws.auth#sigv4 is named sigv4.
     * @public
     */
    authSchemePreference?: string[] | Provider<string[]>;
    /**
     * Configuration of HttpAuthSchemes for a client which provides default identity providers and signers per auth scheme.
     * @internal
     */
    httpAuthSchemes?: HttpAuthScheme[];
    /**
     * Configuration of an HttpAuthSchemeProvider for a client which resolves which HttpAuthScheme to use.
     * @internal
     */
    httpAuthSchemeProvider?: S3VectorsHttpAuthSchemeProvider;
}
/**
 * @internal
 */
export interface HttpAuthSchemeResolvedConfig extends AwsSdkSigV4AuthResolvedConfig {
    /**
     * A comma-separated list of case-sensitive auth scheme names.
     * An auth scheme name is a fully qualified auth scheme ID with the namespace prefix trimmed.
     * For example, the auth scheme with ID aws.auth#sigv4 is named sigv4.
     * @public
     */
    readonly authSchemePreference: Provider<string[]>;
    /**
     * Configuration of HttpAuthSchemes for a client which provides default identity providers and signers per auth scheme.
     * @internal
     */
    readonly httpAuthSchemes: HttpAuthScheme[];
    /**
     * Configuration of an HttpAuthSchemeProvider for a client which resolves which HttpAuthScheme to use.
     * @internal
     */
    readonly httpAuthSchemeProvider: S3VectorsHttpAuthSchemeProvider;
}
/**
 * @internal
 */
export declare const resolveHttpAuthSchemeConfig: <T>(config: T & HttpAuthSchemeInputConfig & AwsSdkSigV4PreviouslyResolved) => T & HttpAuthSchemeResolvedConfig;
