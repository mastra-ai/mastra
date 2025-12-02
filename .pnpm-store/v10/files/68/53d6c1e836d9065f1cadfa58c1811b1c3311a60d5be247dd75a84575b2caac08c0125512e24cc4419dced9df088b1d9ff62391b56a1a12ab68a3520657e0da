import { createPaginator } from "@smithy/core";
import { ScanCommand } from "../commands/ScanCommand";
import { DynamoDBClient } from "../DynamoDBClient";
export const paginateScan = createPaginator(DynamoDBClient, ScanCommand, "ExclusiveStartKey", "LastEvaluatedKey", "Limit");
