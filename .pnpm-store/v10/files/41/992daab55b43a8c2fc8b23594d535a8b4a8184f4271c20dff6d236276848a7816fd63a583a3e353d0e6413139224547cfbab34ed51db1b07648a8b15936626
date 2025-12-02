import { createPaginator } from "@smithy/core";
import { ScanCommand } from "../commands/ScanCommand";
import { DynamoDBDocumentClient } from "../DynamoDBDocumentClient";
export const paginateScan = createPaginator(DynamoDBDocumentClient, ScanCommand, "ExclusiveStartKey", "LastEvaluatedKey", "Limit");
