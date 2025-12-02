import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { ListIndexesInput, ListIndexesOutput } from "../models/models_0";
import {
  S3VectorsClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../S3VectorsClient";
export { __MetadataBearer };
export { $Command };
export interface ListIndexesCommandInput extends ListIndexesInput {}
export interface ListIndexesCommandOutput
  extends ListIndexesOutput,
    __MetadataBearer {}
declare const ListIndexesCommand_base: {
  new (
    input: ListIndexesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListIndexesCommandInput,
    ListIndexesCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [ListIndexesCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    ListIndexesCommandInput,
    ListIndexesCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListIndexesCommand extends ListIndexesCommand_base {
  protected static __types: {
    api: {
      input: ListIndexesInput;
      output: ListIndexesOutput;
    };
    sdk: {
      input: ListIndexesCommandInput;
      output: ListIndexesCommandOutput;
    };
  };
}
