import { Paginator } from "@smithy/types";
import {
  QueryCommandInput,
  QueryCommandOutput,
} from "../commands/QueryCommand";
import { DynamoDBDocumentPaginationConfiguration } from "./Interfaces";
export { Paginator };
export declare const paginateQuery: (
  config: DynamoDBDocumentPaginationConfiguration,
  input: QueryCommandInput,
  ...additionalArguments: any
) => Paginator<QueryCommandOutput>;
