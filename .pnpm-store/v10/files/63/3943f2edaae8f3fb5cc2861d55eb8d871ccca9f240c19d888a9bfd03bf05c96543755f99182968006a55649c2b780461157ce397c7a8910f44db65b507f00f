import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  ListVectorBucketsInput,
  ListVectorBucketsOutput,
} from "../models/models_0";
import {
  S3VectorsClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../S3VectorsClient";
export { __MetadataBearer };
export { $Command };
export interface ListVectorBucketsCommandInput extends ListVectorBucketsInput {}
export interface ListVectorBucketsCommandOutput
  extends ListVectorBucketsOutput,
    __MetadataBearer {}
declare const ListVectorBucketsCommand_base: {
  new (
    input: ListVectorBucketsCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListVectorBucketsCommandInput,
    ListVectorBucketsCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [ListVectorBucketsCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    ListVectorBucketsCommandInput,
    ListVectorBucketsCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListVectorBucketsCommand extends ListVectorBucketsCommand_base {
  protected static __types: {
    api: {
      input: ListVectorBucketsInput;
      output: ListVectorBucketsOutput;
    };
    sdk: {
      input: ListVectorBucketsCommandInput;
      output: ListVectorBucketsCommandOutput;
    };
  };
}
