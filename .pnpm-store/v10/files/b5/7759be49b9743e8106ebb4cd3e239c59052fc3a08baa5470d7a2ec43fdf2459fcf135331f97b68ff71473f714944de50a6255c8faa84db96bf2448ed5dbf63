import { QueryCommand as __QueryCommand } from "@aws-sdk/client-dynamodb";
import { Command as $Command } from "@smithy/smithy-client";
import {
  Handler,
  HttpHandlerOptions as __HttpHandlerOptions,
  MiddlewareStack,
} from "@smithy/types";
import { DynamoDBDocumentClientCommand } from "../baseCommand/DynamoDBDocumentClientCommand";
import {
  DynamoDBDocumentClientResolvedConfig,
  ServiceInputTypes,
  ServiceOutputTypes,
} from "../DynamoDBDocumentClient";
export { DynamoDBDocumentClientCommand, $Command };
export type QueryCommandInput = Pick<
  __QueryCommandInput,
  Exclude<
    keyof __QueryCommandInput,
    | "KeyConditions"
    | "QueryFilter"
    | "ExclusiveStartKey"
    | "ExpressionAttributeValues"
  >
> & {
  KeyConditions?:
    | Record<
        string,
        Pick<Condition, Exclude<keyof Condition, "AttributeValueList">> & {
          AttributeValueList?: NativeAttributeValue[] | undefined;
        }
      >
    | undefined;
  QueryFilter?:
    | Record<
        string,
        Pick<Condition, Exclude<keyof Condition, "AttributeValueList">> & {
          AttributeValueList?: NativeAttributeValue[] | undefined;
        }
      >
    | undefined;
  ExclusiveStartKey?: Record<string, NativeAttributeValue> | undefined;
  ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
};
export type QueryCommandOutput = Pick<
  __QueryCommandOutput,
  Exclude<keyof __QueryCommandOutput, "Items" | "LastEvaluatedKey">
> & {
  Items?: Record<string, NativeAttributeValue>[] | undefined;
  LastEvaluatedKey?: Record<string, NativeAttributeValue> | undefined;
};
export declare class QueryCommand extends DynamoDBDocumentClientCommand<
  QueryCommandInput,
  QueryCommandOutput,
  __QueryCommandInput,
  __QueryCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: QueryCommandInput;
  protected readonly inputKeyNodes: {
    KeyConditions: {
      "*": {
        AttributeValueList: import("../commands/utils").KeyNodeChildren;
      };
    };
    QueryFilter: {
      "*": {
        AttributeValueList: import("../commands/utils").KeyNodeChildren;
      };
    };
    ExclusiveStartKey: import("../commands/utils").KeyNodeChildren;
    ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
  };
  protected readonly outputKeyNodes: {
    Items: {
      "*": import("../commands/utils").KeyNodeChildren;
    };
    LastEvaluatedKey: import("../commands/utils").KeyNodeChildren;
  };
  protected readonly clientCommand: __QueryCommand;
  readonly middlewareStack: MiddlewareStack<
    QueryCommandInput | __QueryCommandInput,
    QueryCommandOutput | __QueryCommandOutput
  >;
  constructor(input: QueryCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<QueryCommandInput, QueryCommandOutput>;
}
import {
  Condition,
  QueryCommandInput as __QueryCommandInput,
  QueryCommandOutput as __QueryCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
