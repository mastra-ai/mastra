import { createPaginator } from "@smithy/core";
import { ListTablesCommand } from "../commands/ListTablesCommand";
import { DynamoDBClient } from "../DynamoDBClient";
export const paginateListTables = createPaginator(DynamoDBClient, ListTablesCommand, "ExclusiveStartTableName", "LastEvaluatedTableName", "Limit");
