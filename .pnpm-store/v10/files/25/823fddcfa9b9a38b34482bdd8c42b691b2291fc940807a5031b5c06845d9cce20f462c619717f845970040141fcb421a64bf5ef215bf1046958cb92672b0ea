import { PutItemCommand as __PutItemCommand } from "@aws-sdk/client-dynamodb";
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
export type PutCommandInput = Pick<
  __PutItemCommandInput,
  Exclude<
    keyof __PutItemCommandInput,
    "Item" | "Expected" | "ExpressionAttributeValues"
  >
> & {
  Item: Record<string, NativeAttributeValue> | undefined;
  Expected?:
    | Record<
        string,
        Pick<
          ExpectedAttributeValue,
          Exclude<keyof ExpectedAttributeValue, "Value" | "AttributeValueList">
        > & {
          Value?: NativeAttributeValue | undefined;
          AttributeValueList?: NativeAttributeValue[] | undefined;
        }
      >
    | undefined;
  ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
};
export type PutCommandOutput = Pick<
  __PutItemCommandOutput,
  Exclude<keyof __PutItemCommandOutput, "Attributes" | "ItemCollectionMetrics">
> & {
  Attributes?: Record<string, NativeAttributeValue> | undefined;
  ItemCollectionMetrics?:
    | (Pick<
        ItemCollectionMetrics,
        Exclude<keyof ItemCollectionMetrics, "ItemCollectionKey">
      > & {
        ItemCollectionKey?: Record<string, NativeAttributeValue> | undefined;
      })
    | undefined;
};
export declare class PutCommand extends DynamoDBDocumentClientCommand<
  PutCommandInput,
  PutCommandOutput,
  __PutItemCommandInput,
  __PutItemCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: PutCommandInput;
  protected readonly inputKeyNodes: {
    Item: import("../commands/utils").KeyNodeChildren;
    Expected: {
      "*": {
        Value: null;
        AttributeValueList: import("../commands/utils").KeyNodeChildren;
      };
    };
    ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
  };
  protected readonly outputKeyNodes: {
    Attributes: import("../commands/utils").KeyNodeChildren;
    ItemCollectionMetrics: {
      ItemCollectionKey: import("../commands/utils").KeyNodeChildren;
    };
  };
  protected readonly clientCommand: __PutItemCommand;
  readonly middlewareStack: MiddlewareStack<
    PutCommandInput | __PutItemCommandInput,
    PutCommandOutput | __PutItemCommandOutput
  >;
  constructor(input: PutCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<PutCommandInput, PutCommandOutput>;
}
import {
  ExpectedAttributeValue,
  ItemCollectionMetrics,
  PutItemCommandInput as __PutItemCommandInput,
  PutItemCommandOutput as __PutItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
