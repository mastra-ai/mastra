import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DynamoDBClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBClient";
import {
  ListGlobalTablesInput,
  ListGlobalTablesOutput,
} from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface ListGlobalTablesCommandInput extends ListGlobalTablesInput {}
export interface ListGlobalTablesCommandOutput
  extends ListGlobalTablesOutput,
    __MetadataBearer {}
declare const ListGlobalTablesCommand_base: {
  new (
    input: ListGlobalTablesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListGlobalTablesCommandInput,
    ListGlobalTablesCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [ListGlobalTablesCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    ListGlobalTablesCommandInput,
    ListGlobalTablesCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListGlobalTablesCommand extends ListGlobalTablesCommand_base {
  protected static __types: {
    api: {
      input: ListGlobalTablesInput;
      output: ListGlobalTablesOutput;
    };
    sdk: {
      input: ListGlobalTablesCommandInput;
      output: ListGlobalTablesCommandOutput;
    };
  };
}
