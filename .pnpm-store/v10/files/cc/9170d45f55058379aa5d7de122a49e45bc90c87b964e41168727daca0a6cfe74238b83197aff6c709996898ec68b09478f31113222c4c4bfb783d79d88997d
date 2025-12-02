import { createPaginator } from "@smithy/core";
import { ListIndexesCommand } from "../commands/ListIndexesCommand";
import { S3VectorsClient } from "../S3VectorsClient";
export const paginateListIndexes = createPaginator(S3VectorsClient, ListIndexesCommand, "nextToken", "nextToken", "maxResults");
