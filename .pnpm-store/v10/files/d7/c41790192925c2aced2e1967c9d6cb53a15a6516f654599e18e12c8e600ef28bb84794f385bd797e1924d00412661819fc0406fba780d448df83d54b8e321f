import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  DynamoDBClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBClient";
import {
  DescribeEndpointsRequest,
  DescribeEndpointsResponse,
} from "../models/models_0";
export { __MetadataBearer };
export { $Command };
export interface DescribeEndpointsCommandInput
  extends DescribeEndpointsRequest {}
export interface DescribeEndpointsCommandOutput
  extends DescribeEndpointsResponse,
    __MetadataBearer {}
declare const DescribeEndpointsCommand_base: {
  new (
    input: DescribeEndpointsCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    DescribeEndpointsCommandInput,
    DescribeEndpointsCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [DescribeEndpointsCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    DescribeEndpointsCommandInput,
    DescribeEndpointsCommandOutput,
    DynamoDBClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class DescribeEndpointsCommand extends DescribeEndpointsCommand_base {
  protected static __types: {
    api: {
      input: {};
      output: DescribeEndpointsResponse;
    };
    sdk: {
      input: DescribeEndpointsCommandInput;
      output: DescribeEndpointsCommandOutput;
    };
  };
}
