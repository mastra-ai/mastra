import { WaiterConfiguration, WaiterResult } from "@smithy/util-waiter";
import { DescribeTableCommandInput } from "../commands/DescribeTableCommand";
import { DynamoDBClient } from "../DynamoDBClient";
/**
 *
 *  @deprecated Use waitUntilTableExists instead. waitForTableExists does not throw error in non-success cases.
 */
export declare const waitForTableExists: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeTableCommandInput) => Promise<WaiterResult>;
/**
 *
 *  @param params - Waiter configuration options.
 *  @param input - The input to DescribeTableCommand for polling.
 */
export declare const waitUntilTableExists: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeTableCommandInput) => Promise<WaiterResult>;
