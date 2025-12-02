import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { DeleteIndexInput, DeleteIndexOutput } from "../models/models_0";
import {
  S3VectorsClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../S3VectorsClient";
export { __MetadataBearer };
export { $Command };
export interface DeleteIndexCommandInput extends DeleteIndexInput {}
export interface DeleteIndexCommandOutput
  extends DeleteIndexOutput,
    __MetadataBearer {}
declare const DeleteIndexCommand_base: {
  new (
    input: DeleteIndexCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteIndexCommandInput,
    DeleteIndexCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [DeleteIndexCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    DeleteIndexCommandInput,
    DeleteIndexCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class DeleteIndexCommand extends DeleteIndexCommand_base {
  protected static __types: {
    api: {
      input: DeleteIndexInput;
      output: {};
    };
    sdk: {
      input: DeleteIndexCommandInput;
      output: DeleteIndexCommandOutput;
    };
  };
}
