import {
  HostHeaderInputConfig,
  HostHeaderResolvedConfig,
} from "@aws-sdk/middleware-host-header";
import {
  UserAgentInputConfig,
  UserAgentResolvedConfig,
} from "@aws-sdk/middleware-user-agent";
import {
  RegionInputConfig,
  RegionResolvedConfig,
} from "@smithy/config-resolver";
import {
  EndpointInputConfig,
  EndpointResolvedConfig,
} from "@smithy/middleware-endpoint";
import {
  RetryInputConfig,
  RetryResolvedConfig,
} from "@smithy/middleware-retry";
import { HttpHandlerUserInput as __HttpHandlerUserInput } from "@smithy/protocol-http";
import {
  Client as __Client,
  DefaultsMode as __DefaultsMode,
  SmithyConfiguration as __SmithyConfiguration,
  SmithyResolvedConfiguration as __SmithyResolvedConfiguration,
} from "@smithy/smithy-client";
import {
  AwsCredentialIdentityProvider,
  BodyLengthCalculator as __BodyLengthCalculator,
  CheckOptionalClientConfig as __CheckOptionalClientConfig,
  ChecksumConstructor as __ChecksumConstructor,
  Decoder as __Decoder,
  Encoder as __Encoder,
  HashConstructor as __HashConstructor,
  HttpHandlerOptions as __HttpHandlerOptions,
  Logger as __Logger,
  Provider as __Provider,
  Provider,
  StreamCollector as __StreamCollector,
  UrlParser as __UrlParser,
  UserAgent as __UserAgent,
} from "@smithy/types";
import {
  HttpAuthSchemeInputConfig,
  HttpAuthSchemeResolvedConfig,
} from "./auth/httpAuthSchemeProvider";
import {
  CreateIndexCommandInput,
  CreateIndexCommandOutput,
} from "./commands/CreateIndexCommand";
import {
  CreateVectorBucketCommandInput,
  CreateVectorBucketCommandOutput,
} from "./commands/CreateVectorBucketCommand";
import {
  DeleteIndexCommandInput,
  DeleteIndexCommandOutput,
} from "./commands/DeleteIndexCommand";
import {
  DeleteVectorBucketCommandInput,
  DeleteVectorBucketCommandOutput,
} from "./commands/DeleteVectorBucketCommand";
import {
  DeleteVectorBucketPolicyCommandInput,
  DeleteVectorBucketPolicyCommandOutput,
} from "./commands/DeleteVectorBucketPolicyCommand";
import {
  DeleteVectorsCommandInput,
  DeleteVectorsCommandOutput,
} from "./commands/DeleteVectorsCommand";
import {
  GetIndexCommandInput,
  GetIndexCommandOutput,
} from "./commands/GetIndexCommand";
import {
  GetVectorBucketCommandInput,
  GetVectorBucketCommandOutput,
} from "./commands/GetVectorBucketCommand";
import {
  GetVectorBucketPolicyCommandInput,
  GetVectorBucketPolicyCommandOutput,
} from "./commands/GetVectorBucketPolicyCommand";
import {
  GetVectorsCommandInput,
  GetVectorsCommandOutput,
} from "./commands/GetVectorsCommand";
import {
  ListIndexesCommandInput,
  ListIndexesCommandOutput,
} from "./commands/ListIndexesCommand";
import {
  ListVectorBucketsCommandInput,
  ListVectorBucketsCommandOutput,
} from "./commands/ListVectorBucketsCommand";
import {
  ListVectorsCommandInput,
  ListVectorsCommandOutput,
} from "./commands/ListVectorsCommand";
import {
  PutVectorBucketPolicyCommandInput,
  PutVectorBucketPolicyCommandOutput,
} from "./commands/PutVectorBucketPolicyCommand";
import {
  PutVectorsCommandInput,
  PutVectorsCommandOutput,
} from "./commands/PutVectorsCommand";
import {
  QueryVectorsCommandInput,
  QueryVectorsCommandOutput,
} from "./commands/QueryVectorsCommand";
import {
  ClientInputEndpointParameters,
  ClientResolvedEndpointParameters,
  EndpointParameters,
} from "./endpoint/EndpointParameters";
import { RuntimeExtension, RuntimeExtensionsConfig } from "./runtimeExtensions";
export { __Client };
export type ServiceInputTypes =
  | CreateIndexCommandInput
  | CreateVectorBucketCommandInput
  | DeleteIndexCommandInput
  | DeleteVectorBucketCommandInput
  | DeleteVectorBucketPolicyCommandInput
  | DeleteVectorsCommandInput
  | GetIndexCommandInput
  | GetVectorBucketCommandInput
  | GetVectorBucketPolicyCommandInput
  | GetVectorsCommandInput
  | ListIndexesCommandInput
  | ListVectorBucketsCommandInput
  | ListVectorsCommandInput
  | PutVectorBucketPolicyCommandInput
  | PutVectorsCommandInput
  | QueryVectorsCommandInput;
export type ServiceOutputTypes =
  | CreateIndexCommandOutput
  | CreateVectorBucketCommandOutput
  | DeleteIndexCommandOutput
  | DeleteVectorBucketCommandOutput
  | DeleteVectorBucketPolicyCommandOutput
  | DeleteVectorsCommandOutput
  | GetIndexCommandOutput
  | GetVectorBucketCommandOutput
  | GetVectorBucketPolicyCommandOutput
  | GetVectorsCommandOutput
  | ListIndexesCommandOutput
  | ListVectorBucketsCommandOutput
  | ListVectorsCommandOutput
  | PutVectorBucketPolicyCommandOutput
  | PutVectorsCommandOutput
  | QueryVectorsCommandOutput;
export interface ClientDefaults
  extends Partial<__SmithyConfiguration<__HttpHandlerOptions>> {
  requestHandler?: __HttpHandlerUserInput;
  sha256?: __ChecksumConstructor | __HashConstructor;
  urlParser?: __UrlParser;
  bodyLengthChecker?: __BodyLengthCalculator;
  streamCollector?: __StreamCollector;
  base64Decoder?: __Decoder;
  base64Encoder?: __Encoder;
  utf8Decoder?: __Decoder;
  utf8Encoder?: __Encoder;
  runtime?: string;
  disableHostPrefix?: boolean;
  serviceId?: string;
  useDualstackEndpoint?: boolean | __Provider<boolean>;
  useFipsEndpoint?: boolean | __Provider<boolean>;
  region?: string | __Provider<string>;
  profile?: string;
  defaultUserAgentProvider?: Provider<__UserAgent>;
  credentialDefaultProvider?: (input: any) => AwsCredentialIdentityProvider;
  maxAttempts?: number | __Provider<number>;
  retryMode?: string | __Provider<string>;
  logger?: __Logger;
  extensions?: RuntimeExtension[];
  defaultsMode?: __DefaultsMode | __Provider<__DefaultsMode>;
}
export type S3VectorsClientConfigType = Partial<
  __SmithyConfiguration<__HttpHandlerOptions>
> &
  ClientDefaults &
  UserAgentInputConfig &
  RetryInputConfig &
  RegionInputConfig &
  HostHeaderInputConfig &
  EndpointInputConfig<EndpointParameters> &
  HttpAuthSchemeInputConfig &
  ClientInputEndpointParameters;
export interface S3VectorsClientConfig extends S3VectorsClientConfigType {}
export type S3VectorsClientResolvedConfigType =
  __SmithyResolvedConfiguration<__HttpHandlerOptions> &
    Required<ClientDefaults> &
    RuntimeExtensionsConfig &
    UserAgentResolvedConfig &
    RetryResolvedConfig &
    RegionResolvedConfig &
    HostHeaderResolvedConfig &
    EndpointResolvedConfig<EndpointParameters> &
    HttpAuthSchemeResolvedConfig &
    ClientResolvedEndpointParameters;
export interface S3VectorsClientResolvedConfig
  extends S3VectorsClientResolvedConfigType {}
export declare class S3VectorsClient extends __Client<
  __HttpHandlerOptions,
  ServiceInputTypes,
  ServiceOutputTypes,
  S3VectorsClientResolvedConfig
> {
  readonly config: S3VectorsClientResolvedConfig;
  constructor(
    ...[configuration]: __CheckOptionalClientConfig<S3VectorsClientConfig>
  );
  destroy(): void;
}
