import { createPaginator } from "@smithy/core";
import { QueryCommand } from "../commands/QueryCommand";
import { DynamoDBClient } from "../DynamoDBClient";
export const paginateQuery = createPaginator(DynamoDBClient, QueryCommand, "ExclusiveStartKey", "LastEvaluatedKey", "Limit");
