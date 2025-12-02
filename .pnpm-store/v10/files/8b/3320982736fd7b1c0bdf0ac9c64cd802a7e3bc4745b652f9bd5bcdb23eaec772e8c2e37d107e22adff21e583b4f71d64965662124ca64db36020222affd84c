import { createPaginator } from "@smithy/core";
import { ListContributorInsightsCommand, } from "../commands/ListContributorInsightsCommand";
import { DynamoDBClient } from "../DynamoDBClient";
export const paginateListContributorInsights = createPaginator(DynamoDBClient, ListContributorInsightsCommand, "NextToken", "NextToken", "MaxResults");
