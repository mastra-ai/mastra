import { TransactGetItemsCommand as __TransactGetItemsCommand } from "@aws-sdk/client-dynamodb";
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
export type TransactGetCommandInput = Pick<
  __TransactGetItemsCommandInput,
  Exclude<keyof __TransactGetItemsCommandInput, "TransactItems">
> & {
  TransactItems:
    | (Pick<TransactGetItem, Exclude<keyof TransactGetItem, "Get">> & {
        Get:
          | (Pick<Get, Exclude<keyof Get, "Key">> & {
              Key: Record<string, NativeAttributeValue> | undefined;
            })
          | undefined;
      })[]
    | undefined;
};
export type TransactGetCommandOutput = Pick<
  __TransactGetItemsCommandOutput,
  Exclude<keyof __TransactGetItemsCommandOutput, "Responses">
> & {
  Responses?:
    | (Pick<ItemResponse, Exclude<keyof ItemResponse, "Item">> & {
        Item?: Record<string, NativeAttributeValue> | undefined;
      })[]
    | undefined;
};
export declare class TransactGetCommand extends DynamoDBDocumentClientCommand<
  TransactGetCommandInput,
  TransactGetCommandOutput,
  __TransactGetItemsCommandInput,
  __TransactGetItemsCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: TransactGetCommandInput;
  protected readonly inputKeyNodes: {
    TransactItems: {
      "*": {
        Get: {
          Key: import("../commands/utils").KeyNodeChildren;
        };
      };
    };
  };
  protected readonly outputKeyNodes: {
    Responses: {
      "*": {
        Item: import("../commands/utils").KeyNodeChildren;
      };
    };
  };
  protected readonly clientCommand: __TransactGetItemsCommand;
  readonly middlewareStack: MiddlewareStack<
    TransactGetCommandInput | __TransactGetItemsCommandInput,
    TransactGetCommandOutput | __TransactGetItemsCommandOutput
  >;
  constructor(input: TransactGetCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<TransactGetCommandInput, TransactGetCommandOutput>;
}
import {
  Get,
  ItemResponse,
  TransactGetItem,
  TransactGetItemsCommandInput as __TransactGetItemsCommandInput,
  TransactGetItemsCommandOutput as __TransactGetItemsCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
