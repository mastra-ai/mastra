import { createPaginator } from "@smithy/core";
import { ListExportsCommand } from "../commands/ListExportsCommand";
import { DynamoDBClient } from "../DynamoDBClient";
export const paginateListExports = createPaginator(DynamoDBClient, ListExportsCommand, "NextToken", "NextToken", "MaxResults");
