import { UpdateItemCommand as __UpdateItemCommand } from "@aws-sdk/client-dynamodb";
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
export type UpdateCommandInput = Pick<
  __UpdateItemCommandInput,
  Exclude<
    keyof __UpdateItemCommandInput,
    "Key" | "AttributeUpdates" | "Expected" | "ExpressionAttributeValues"
  >
> & {
  Key: Record<string, NativeAttributeValue> | undefined;
  AttributeUpdates?:
    | Record<
        string,
        Pick<
          AttributeValueUpdate,
          Exclude<keyof AttributeValueUpdate, "Value">
        > & {
          Value?: NativeAttributeValue | undefined;
        }
      >
    | undefined;
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
export type UpdateCommandOutput = Pick<
  __UpdateItemCommandOutput,
  Exclude<
    keyof __UpdateItemCommandOutput,
    "Attributes" | "ItemCollectionMetrics"
  >
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
export declare class UpdateCommand extends DynamoDBDocumentClientCommand<
  UpdateCommandInput,
  UpdateCommandOutput,
  __UpdateItemCommandInput,
  __UpdateItemCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: UpdateCommandInput;
  protected readonly inputKeyNodes: {
    Key: import("../commands/utils").KeyNodeChildren;
    AttributeUpdates: {
      "*": {
        Value: null;
      };
    };
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
  protected readonly clientCommand: __UpdateItemCommand;
  readonly middlewareStack: MiddlewareStack<
    UpdateCommandInput | __UpdateItemCommandInput,
    UpdateCommandOutput | __UpdateItemCommandOutput
  >;
  constructor(input: UpdateCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<UpdateCommandInput, UpdateCommandOutput>;
}
import {
  AttributeValueUpdate,
  ExpectedAttributeValue,
  ItemCollectionMetrics,
  UpdateItemCommandInput as __UpdateItemCommandInput,
  UpdateItemCommandOutput as __UpdateItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
