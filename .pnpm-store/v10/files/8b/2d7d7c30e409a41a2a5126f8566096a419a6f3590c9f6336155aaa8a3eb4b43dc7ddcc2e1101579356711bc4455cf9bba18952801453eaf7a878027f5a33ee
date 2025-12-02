import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DynamoDBClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBClient";
import { DeleteItemInput, DeleteItemOutput } from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface DeleteItemCommandInput extends DeleteItemInput {}
export interface DeleteItemCommandOutput
  extends DeleteItemOutput,
    __MetadataBearer {}
declare const DeleteItemCommand_base: {
  new (
    input: DeleteItemCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteItemCommandInput,
    DeleteItemCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: DeleteItemCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteItemCommandInput,
    DeleteItemCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class DeleteItemCommand extends DeleteItemCommand_base {
  protected static __types: {
    api: {
      input: DeleteItemInput;
      output: DeleteItemOutput;
    };
    sdk: {
      input: DeleteItemCommandInput;
      output: DeleteItemCommandOutput;
    };
  };
}
