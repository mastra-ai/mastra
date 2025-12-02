import { createPaginator } from "@smithy/core";
import { QueryCommand } from "../commands/QueryCommand";
import { DynamoDBDocumentClient } from "../DynamoDBDocumentClient";
export const paginateQuery = createPaginator(DynamoDBDocumentClient, QueryCommand, "ExclusiveStartKey", "LastEvaluatedKey", "Limit");
