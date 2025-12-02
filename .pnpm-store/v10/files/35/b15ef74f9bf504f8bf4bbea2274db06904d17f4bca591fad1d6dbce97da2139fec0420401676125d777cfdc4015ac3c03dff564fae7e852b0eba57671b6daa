import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { GetIndexInput, GetIndexOutput } from "../models/models_0";
import {
  S3VectorsClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../S3VectorsClient";
export { __MetadataBearer };
export { $Command };
export interface GetIndexCommandInput extends GetIndexInput {}
export interface GetIndexCommandOutput
  extends GetIndexOutput,
    __MetadataBearer {}
declare const GetIndexCommand_base: {
  new (
    input: GetIndexCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    GetIndexCommandInput,
    GetIndexCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [GetIndexCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    GetIndexCommandInput,
    GetIndexCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class GetIndexCommand extends GetIndexCommand_base {
  protected static __types: {
    api: {
      input: GetIndexInput;
      output: GetIndexOutput;
    };
    sdk: {
      input: GetIndexCommandInput;
      output: GetIndexCommandOutput;
    };
  };
}
