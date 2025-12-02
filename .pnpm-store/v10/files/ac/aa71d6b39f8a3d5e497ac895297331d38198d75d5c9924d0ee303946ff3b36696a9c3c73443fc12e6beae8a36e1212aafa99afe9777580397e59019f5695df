import { createPaginator } from "@smithy/core";
import { ListImportsCommand } from "../commands/ListImportsCommand";
import { DynamoDBClient } from "../DynamoDBClient";
export const paginateListImports = createPaginator(DynamoDBClient, ListImportsCommand, "NextToken", "NextToken", "PageSize");
