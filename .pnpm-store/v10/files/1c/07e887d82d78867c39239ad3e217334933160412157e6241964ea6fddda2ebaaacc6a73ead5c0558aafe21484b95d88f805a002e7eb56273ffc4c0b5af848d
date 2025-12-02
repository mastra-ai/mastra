import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DynamoDBClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBClient";
import { GetItemInput, GetItemOutput } from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface GetItemCommandInput extends GetItemInput {}
export interface GetItemCommandOutput extends GetItemOutput, __MetadataBearer {}
declare const GetItemCommand_base: {
  new (input: GetItemCommandInput): import("@smithy/smithy-client").CommandImpl<
    GetItemCommandInput,
    GetItemCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (input: GetItemCommandInput): import("@smithy/smithy-client").CommandImpl<
    GetItemCommandInput,
    GetItemCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class GetItemCommand extends GetItemCommand_base {
  protected static __types: {
    api: {
      input: GetItemInput;
      output: GetItemOutput;
    };
    sdk: {
      input: GetItemCommandInput;
      output: GetItemCommandOutput;
    };
  };
}
