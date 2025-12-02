import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { CreateIndexInput, CreateIndexOutput } from "../models/models_0";
import {
  S3VectorsClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../S3VectorsClient";
export { __MetadataBearer };
export { $Command };
export interface CreateIndexCommandInput extends CreateIndexInput {}
export interface CreateIndexCommandOutput
  extends CreateIndexOutput,
    __MetadataBearer {}
declare const CreateIndexCommand_base: {
  new (
    input: CreateIndexCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    CreateIndexCommandInput,
    CreateIndexCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    input: CreateIndexCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    CreateIndexCommandInput,
    CreateIndexCommandOutput,
    S3VectorsClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class CreateIndexCommand extends CreateIndexCommand_base {
  protected static __types: {
    api: {
      input: CreateIndexInput;
      output: {};
    };
    sdk: {
      input: CreateIndexCommandInput;
      output: CreateIndexCommandOutput;
    };
  };
}
