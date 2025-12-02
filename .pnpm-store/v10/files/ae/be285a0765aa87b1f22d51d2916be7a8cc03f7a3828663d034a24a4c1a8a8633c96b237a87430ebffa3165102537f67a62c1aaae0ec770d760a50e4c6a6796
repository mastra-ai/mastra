import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DynamoDBClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBClient";
import { UpdateItemInput, UpdateItemOutput } from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface UpdateItemCommandInput extends UpdateItemInput {}
export interface UpdateItemCommandOutput
  extends UpdateItemOutput,
    __MetadataBearer {}
declare const UpdateItemCommand_base: {
  new (
    input: UpdateItemCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    UpdateItemCommandInput,
    UpdateItemCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: UpdateItemCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    UpdateItemCommandInput,
    UpdateItemCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class UpdateItemCommand extends UpdateItemCommand_base {
  protected static __types: {
    api: {
      input: UpdateItemInput;
      output: UpdateItemOutput;
    };
    sdk: {
      input: UpdateItemCommandInput;
      output: UpdateItemCommandOutput;
    };
  };
}
