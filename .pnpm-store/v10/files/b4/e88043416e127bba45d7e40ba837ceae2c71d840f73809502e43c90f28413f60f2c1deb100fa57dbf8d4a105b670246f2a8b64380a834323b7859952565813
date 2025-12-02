import { TransactWriteItemsCommand as __TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";
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
export type TransactWriteCommandInput = Pick<
  __TransactWriteItemsCommandInput,
  Exclude<keyof __TransactWriteItemsCommandInput, "TransactItems">
> & {
  TransactItems:
    | (Pick<
        TransactWriteItem,
        Exclude<
          keyof TransactWriteItem,
          "ConditionCheck" | "Put" | "Delete" | "Update"
        >
      > & {
        ConditionCheck?:
          | (Pick<
              ConditionCheck,
              Exclude<keyof ConditionCheck, "Key" | "ExpressionAttributeValues">
            > & {
              Key: Record<string, NativeAttributeValue> | undefined;
              ExpressionAttributeValues?:
                | Record<string, NativeAttributeValue>
                | undefined;
            })
          | undefined;
        Put?:
          | (Pick<
              Put,
              Exclude<keyof Put, "Item" | "ExpressionAttributeValues">
            > & {
              Item: Record<string, NativeAttributeValue> | undefined;
              ExpressionAttributeValues?:
                | Record<string, NativeAttributeValue>
                | undefined;
            })
          | undefined;
        Delete?:
          | (Pick<
              Delete,
              Exclude<keyof Delete, "Key" | "ExpressionAttributeValues">
            > & {
              Key: Record<string, NativeAttributeValue> | undefined;
              ExpressionAttributeValues?:
                | Record<string, NativeAttributeValue>
                | undefined;
            })
          | undefined;
        Update?:
          | (Pick<
              Update,
              Exclude<keyof Update, "Key" | "ExpressionAttributeValues">
            > & {
              Key: Record<string, NativeAttributeValue> | undefined;
              ExpressionAttributeValues?:
                | Record<string, NativeAttributeValue>
                | undefined;
            })
          | undefined;
      })[]
    | undefined;
};
export type TransactWriteCommandOutput = Pick<
  __TransactWriteItemsCommandOutput,
  Exclude<keyof __TransactWriteItemsCommandOutput, "ItemCollectionMetrics">
> & {
  ItemCollectionMetrics?:
    | Record<
        string,
        (Pick<
          ItemCollectionMetrics,
          Exclude<keyof ItemCollectionMetrics, "ItemCollectionKey">
        > & {
          ItemCollectionKey?: Record<string, NativeAttributeValue> | undefined;
        })[]
      >
    | undefined;
};
export declare class TransactWriteCommand extends DynamoDBDocumentClientCommand<
  TransactWriteCommandInput,
  TransactWriteCommandOutput,
  __TransactWriteItemsCommandInput,
  __TransactWriteItemsCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: TransactWriteCommandInput;
  protected readonly inputKeyNodes: {
    TransactItems: {
      "*": {
        ConditionCheck: {
          Key: import("../commands/utils").KeyNodeChildren;
          ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
        };
        Put: {
          Item: import("../commands/utils").KeyNodeChildren;
          ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
        };
        Delete: {
          Key: import("../commands/utils").KeyNodeChildren;
          ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
        };
        Update: {
          Key: import("../commands/utils").KeyNodeChildren;
          ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
        };
      };
    };
  };
  protected readonly outputKeyNodes: {
    ItemCollectionMetrics: {
      "*": {
        "*": {
          ItemCollectionKey: import("../commands/utils").KeyNodeChildren;
        };
      };
    };
  };
  protected readonly clientCommand: __TransactWriteItemsCommand;
  readonly middlewareStack: MiddlewareStack<
    TransactWriteCommandInput | __TransactWriteItemsCommandInput,
    TransactWriteCommandOutput | __TransactWriteItemsCommandOutput
  >;
  constructor(input: TransactWriteCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<TransactWriteCommandInput, TransactWriteCommandOutput>;
}
import {
  ConditionCheck,
  Delete,
  ItemCollectionMetrics,
  Put,
  TransactWriteItem,
  TransactWriteItemsCommandInput as __TransactWriteItemsCommandInput,
  TransactWriteItemsCommandOutput as __TransactWriteItemsCommandOutput,
  Update,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
