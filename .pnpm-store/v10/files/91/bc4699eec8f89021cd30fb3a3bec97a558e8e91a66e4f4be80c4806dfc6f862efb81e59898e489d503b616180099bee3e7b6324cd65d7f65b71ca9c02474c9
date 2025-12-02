import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DynamoDBClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBClient";
import { ListBackupsInput, ListBackupsOutput } from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface ListBackupsCommandInput extends ListBackupsInput {}
export interface ListBackupsCommandOutput
  extends ListBackupsOutput,
    __MetadataBearer {}
declare const ListBackupsCommand_base: {
  new (
    input: ListBackupsCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListBackupsCommandInput,
    ListBackupsCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [ListBackupsCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    ListBackupsCommandInput,
    ListBackupsCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListBackupsCommand extends ListBackupsCommand_base {
  protected static __types: {
    api: {
      input: ListBackupsInput;
      output: ListBackupsOutput;
    };
    sdk: {
      input: ListBackupsCommandInput;
      output: ListBackupsCommandOutput;
    };
  };
}
