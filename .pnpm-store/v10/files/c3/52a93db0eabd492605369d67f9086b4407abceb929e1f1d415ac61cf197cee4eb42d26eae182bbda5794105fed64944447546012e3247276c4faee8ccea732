import { BatchWriteItemCommand as __BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
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
export type BatchWriteCommandInput = Pick<
  __BatchWriteItemCommandInput,
  Exclude<keyof __BatchWriteItemCommandInput, "RequestItems">
> & {
  RequestItems:
    | Record<
        string,
        (Pick<
          WriteRequest,
          Exclude<keyof WriteRequest, "PutRequest" | "DeleteRequest">
        > & {
          PutRequest?:
            | (Pick<PutRequest, Exclude<keyof PutRequest, "Item">> & {
                Item: Record<string, NativeAttributeValue> | undefined;
              })
            | undefined;
          DeleteRequest?:
            | (Pick<DeleteRequest, Exclude<keyof DeleteRequest, "Key">> & {
                Key: Record<string, NativeAttributeValue> | undefined;
              })
            | undefined;
        })[]
      >
    | undefined;
};
export type BatchWriteCommandOutput = Pick<
  __BatchWriteItemCommandOutput,
  Exclude<
    keyof __BatchWriteItemCommandOutput,
    "UnprocessedItems" | "ItemCollectionMetrics"
  >
> & {
  UnprocessedItems?:
    | Record<
        string,
        (Pick<
          WriteRequest,
          Exclude<keyof WriteRequest, "PutRequest" | "DeleteRequest">
        > & {
          PutRequest?:
            | (Pick<PutRequest, Exclude<keyof PutRequest, "Item">> & {
                Item: Record<string, NativeAttributeValue> | undefined;
              })
            | undefined;
          DeleteRequest?:
            | (Pick<DeleteRequest, Exclude<keyof DeleteRequest, "Key">> & {
                Key: Record<string, NativeAttributeValue> | undefined;
              })
            | undefined;
        })[]
      >
    | undefined;
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
export declare class BatchWriteCommand extends DynamoDBDocumentClientCommand<
  BatchWriteCommandInput,
  BatchWriteCommandOutput,
  __BatchWriteItemCommandInput,
  __BatchWriteItemCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: BatchWriteCommandInput;
  protected readonly inputKeyNodes: {
    RequestItems: {
      "*": {
        "*": {
          PutRequest: {
            Item: import("../commands/utils").KeyNodeChildren;
          };
          DeleteRequest: {
            Key: import("../commands/utils").KeyNodeChildren;
          };
        };
      };
    };
  };
  protected readonly outputKeyNodes: {
    UnprocessedItems: {
      "*": {
        "*": {
          PutRequest: {
            Item: import("../commands/utils").KeyNodeChildren;
          };
          DeleteRequest: {
            Key: import("../commands/utils").KeyNodeChildren;
          };
        };
      };
    };
    ItemCollectionMetrics: {
      "*": {
        "*": {
          ItemCollectionKey: import("../commands/utils").KeyNodeChildren;
        };
      };
    };
  };
  protected readonly clientCommand: __BatchWriteItemCommand;
  readonly middlewareStack: MiddlewareStack<
    BatchWriteCommandInput | __BatchWriteItemCommandInput,
    BatchWriteCommandOutput | __BatchWriteItemCommandOutput
  >;
  constructor(input: BatchWriteCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<BatchWriteCommandInput, BatchWriteCommandOutput>;
}
import {
  BatchWriteItemCommandInput as __BatchWriteItemCommandInput,
  BatchWriteItemCommandOutput as __BatchWriteItemCommandOutput,
  DeleteRequest,
  ItemCollectionMetrics,
  PutRequest,
  WriteRequest,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
