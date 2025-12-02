import { createPaginator } from "@smithy/core";
import { ListVectorsCommand } from "../commands/ListVectorsCommand";
import { S3VectorsClient } from "../S3VectorsClient";
export const paginateListVectors = createPaginator(S3VectorsClient, ListVectorsCommand, "nextToken", "nextToken", "maxResults");
