import { WaiterConfiguration, WaiterResult } from "@smithy/util-waiter";
import { DescribeTableCommandInput } from "../commands/DescribeTableCommand";
import { DynamoDBClient } from "../DynamoDBClient";
/**
 *
 *  @deprecated Use waitUntilTableNotExists instead. waitForTableNotExists does not throw error in non-success cases.
 */
export declare const waitForTableNotExists: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeTableCommandInput) => Promise<WaiterResult>;
/**
 *
 *  @param params - Waiter configuration options.
 *  @param input - The input to DescribeTableCommand for polling.
 */
export declare const waitUntilTableNotExists: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeTableCommandInput) => Promise<WaiterResult>;
