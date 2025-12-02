import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { ListVectorsInput, ListVectorsOutput } from "../models/models_0";
import {
  S3VectorsClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../S3VectorsClient";
export { __MetadataBearer };
export { $Command };
export interface ListVectorsCommandInput extends ListVectorsInput {}
export interface ListVectorsCommandOutput
  extends ListVectorsOutput,
    __MetadataBearer {}
declare const ListVectorsCommand_base: {
  new (
    input: ListVectorsCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListVectorsCommandInput,
    ListVectorsCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [ListVectorsCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    ListVectorsCommandInput,
    ListVectorsCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListVectorsCommand extends ListVectorsCommand_base {
  protected static __types: {
    api: {
      input: ListVectorsInput;
      output: ListVectorsOutput;
    };
    sdk: {
      input: ListVectorsCommandInput;
      output: ListVectorsCommandOutput;
    };
  };
}
