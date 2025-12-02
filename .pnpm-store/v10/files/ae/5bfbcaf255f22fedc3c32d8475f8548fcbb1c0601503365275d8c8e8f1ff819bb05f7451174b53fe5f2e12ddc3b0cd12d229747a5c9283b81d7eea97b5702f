import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DynamoDBClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBClient";
import { ListTablesInput, ListTablesOutput } from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface ListTablesCommandInput extends ListTablesInput {}
export interface ListTablesCommandOutput
  extends ListTablesOutput,
    __MetadataBearer {}
declare const ListTablesCommand_base: {
  new (
    input: ListTablesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListTablesCommandInput,
    ListTablesCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [ListTablesCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    ListTablesCommandInput,
    ListTablesCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListTablesCommand extends ListTablesCommand_base {
  protected static __types: {
    api: {
      input: ListTablesInput;
      output: ListTablesOutput;
    };
    sdk: {
      input: ListTablesCommandInput;
      output: ListTablesCommandOutput;
    };
  };
}
