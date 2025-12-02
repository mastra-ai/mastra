import { DeleteItemCommand as __DeleteItemCommand } from "@aws-sdk/client-dynamodb";
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
export type DeleteCommandInput = Pick<
  __DeleteItemCommandInput,
  Exclude<
    keyof __DeleteItemCommandInput,
    "Key" | "Expected" | "ExpressionAttributeValues"
  >
> & {
  Key: Record<string, NativeAttributeValue> | undefined;
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
export type DeleteCommandOutput = Pick<
  __DeleteItemCommandOutput,
  Exclude<
    keyof __DeleteItemCommandOutput,
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
export declare class DeleteCommand extends DynamoDBDocumentClientCommand<
  DeleteCommandInput,
  DeleteCommandOutput,
  __DeleteItemCommandInput,
  __DeleteItemCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: DeleteCommandInput;
  protected readonly inputKeyNodes: {
    Key: import("../commands/utils").KeyNodeChildren;
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
  protected readonly clientCommand: __DeleteItemCommand;
  readonly middlewareStack: MiddlewareStack<
    DeleteCommandInput | __DeleteItemCommandInput,
    DeleteCommandOutput | __DeleteItemCommandOutput
  >;
  constructor(input: DeleteCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<DeleteCommandInput, DeleteCommandOutput>;
}
import {
  DeleteItemCommandInput as __DeleteItemCommandInput,
  DeleteItemCommandOutput as __DeleteItemCommandOutput,
  ExpectedAttributeValue,
  ItemCollectionMetrics,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
