import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DynamoDBClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBClient";
import { QueryInput, QueryOutput } from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface QueryCommandInput extends QueryInput {}
export interface QueryCommandOutput extends QueryOutput, __MetadataBearer {}
declare const QueryCommand_base: {
  new (input: QueryCommandInput): import("@smithy/smithy-client").CommandImpl<
    QueryCommandInput,
    QueryCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (input: QueryCommandInput): import("@smithy/smithy-client").CommandImpl<
    QueryCommandInput,
    QueryCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class QueryCommand extends QueryCommand_base {
  protected static __types: {
    api: {
      input: QueryInput;
      output: QueryOutput;
    };
    sdk: {
      input: QueryCommandInput;
      output: QueryCommandOutput;
    };
  };
}
