import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DynamoDBClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBClient";
import { ImportTableInput, ImportTableOutput } from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface ImportTableCommandInput extends ImportTableInput {}
export interface ImportTableCommandOutput
  extends ImportTableOutput,
    __MetadataBearer {}
declare const ImportTableCommand_base: {
  new (
    input: ImportTableCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ImportTableCommandInput,
    ImportTableCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: ImportTableCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ImportTableCommandInput,
    ImportTableCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ImportTableCommand extends ImportTableCommand_base {
  protected static __types: {
    api: {
      input: ImportTableInput;
      output: ImportTableOutput;
    };
    sdk: {
      input: ImportTableCommandInput;
      output: ImportTableCommandOutput;
    };
  };
}
