import { createPaginator } from "@smithy/core";
import { ListVectorBucketsCommand, } from "../commands/ListVectorBucketsCommand";
import { S3VectorsClient } from "../S3VectorsClient";
export const paginateListVectorBuckets = createPaginator(S3VectorsClient, ListVectorBucketsCommand, "nextToken", "nextToken", "maxResults");
