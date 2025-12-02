import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DynamoDBClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBClient";
import { DeleteTableInput, DeleteTableOutput } from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface DeleteTableCommandInput extends DeleteTableInput {}
export interface DeleteTableCommandOutput
  extends DeleteTableOutput,
    __MetadataBearer {}
declare const DeleteTableCommand_base: {
  new (
    input: DeleteTableCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteTableCommandInput,
    DeleteTableCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: DeleteTableCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteTableCommandInput,
    DeleteTableCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class DeleteTableCommand extends DeleteTableCommand_base {
  protected static __types: {
    api: {
      input: DeleteTableInput;
      output: DeleteTableOutput;
    };
    sdk: {
      input: DeleteTableCommandInput;
      output: DeleteTableCommandOutput;
    };
  };
}
