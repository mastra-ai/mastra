import { BatchExecuteStatementCommand as __BatchExecuteStatementCommand } from "@aws-sdk/client-dynamodb";
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
export type BatchExecuteStatementCommandInput = Pick<
  __BatchExecuteStatementCommandInput,
  Exclude<keyof __BatchExecuteStatementCommandInput, "Statements">
> & {
  Statements:
    | (Pick<
        BatchStatementRequest,
        Exclude<keyof BatchStatementRequest, "Parameters">
      > & {
        Parameters?: NativeAttributeValue[] | undefined;
      })[]
    | undefined;
};
export type BatchExecuteStatementCommandOutput = Pick<
  __BatchExecuteStatementCommandOutput,
  Exclude<keyof __BatchExecuteStatementCommandOutput, "Responses">
> & {
  Responses?:
    | (Pick<
        BatchStatementResponse,
        Exclude<keyof BatchStatementResponse, "Error" | "Item">
      > & {
        Error?:
          | (Pick<
              BatchStatementError,
              Exclude<keyof BatchStatementError, "Item">
            > & {
              Item?: Record<string, NativeAttributeValue> | undefined;
            })
          | undefined;
        Item?: Record<string, NativeAttributeValue> | undefined;
      })[]
    | undefined;
};
export declare class BatchExecuteStatementCommand extends DynamoDBDocumentClientCommand<
  BatchExecuteStatementCommandInput,
  BatchExecuteStatementCommandOutput,
  __BatchExecuteStatementCommandInput,
  __BatchExecuteStatementCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: BatchExecuteStatementCommandInput;
  protected readonly inputKeyNodes: {
    Statements: {
      "*": {
        Parameters: import("../commands/utils").KeyNodeChildren;
      };
    };
  };
  protected readonly outputKeyNodes: {
    Responses: {
      "*": {
        Error: {
          Item: import("../commands/utils").KeyNodeChildren;
        };
        Item: import("../commands/utils").KeyNodeChildren;
      };
    };
  };
  protected readonly clientCommand: __BatchExecuteStatementCommand;
  readonly middlewareStack: MiddlewareStack<
    BatchExecuteStatementCommandInput | __BatchExecuteStatementCommandInput,
    BatchExecuteStatementCommandOutput | __BatchExecuteStatementCommandOutput
  >;
  constructor(input: BatchExecuteStatementCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<
    BatchExecuteStatementCommandInput,
    BatchExecuteStatementCommandOutput
  >;
}
import {
  BatchExecuteStatementCommandInput as __BatchExecuteStatementCommandInput,
  BatchExecuteStatementCommandOutput as __BatchExecuteStatementCommandOutput,
  BatchStatementError,
  BatchStatementRequest,
  BatchStatementResponse,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
