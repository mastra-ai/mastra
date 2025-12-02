import { ExecuteTransactionCommand as __ExecuteTransactionCommand } from "@aws-sdk/client-dynamodb";
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
export type ExecuteTransactionCommandInput = Pick<
  __ExecuteTransactionCommandInput,
  Exclude<keyof __ExecuteTransactionCommandInput, "TransactStatements">
> & {
  TransactStatements:
    | (Pick<
        ParameterizedStatement,
        Exclude<keyof ParameterizedStatement, "Parameters">
      > & {
        Parameters?: NativeAttributeValue[] | undefined;
      })[]
    | undefined;
};
export type ExecuteTransactionCommandOutput = Pick<
  __ExecuteTransactionCommandOutput,
  Exclude<keyof __ExecuteTransactionCommandOutput, "Responses">
> & {
  Responses?:
    | (Pick<ItemResponse, Exclude<keyof ItemResponse, "Item">> & {
        Item?: Record<string, NativeAttributeValue> | undefined;
      })[]
    | undefined;
};
export declare class ExecuteTransactionCommand extends DynamoDBDocumentClientCommand<
  ExecuteTransactionCommandInput,
  ExecuteTransactionCommandOutput,
  __ExecuteTransactionCommandInput,
  __ExecuteTransactionCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: ExecuteTransactionCommandInput;
  protected readonly inputKeyNodes: {
    TransactStatements: {
      "*": {
        Parameters: import("../commands/utils").KeyNodeChildren;
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
  protected readonly clientCommand: __ExecuteTransactionCommand;
  readonly middlewareStack: MiddlewareStack<
    ExecuteTransactionCommandInput | __ExecuteTransactionCommandInput,
    ExecuteTransactionCommandOutput | __ExecuteTransactionCommandOutput
  >;
  constructor(input: ExecuteTransactionCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<ExecuteTransactionCommandInput, ExecuteTransactionCommandOutput>;
}
import {
  ExecuteTransactionCommandInput as __ExecuteTransactionCommandInput,
  ExecuteTransactionCommandOutput as __ExecuteTransactionCommandOutput,
  ItemResponse,
  ParameterizedStatement,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
