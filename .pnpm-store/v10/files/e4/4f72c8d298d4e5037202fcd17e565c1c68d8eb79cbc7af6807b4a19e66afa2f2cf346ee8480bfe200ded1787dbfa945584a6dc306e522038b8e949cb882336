import { ExecuteStatementCommand as __ExecuteStatementCommand } from "@aws-sdk/client-dynamodb";
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
export type ExecuteStatementCommandInput = Pick<
  __ExecuteStatementCommandInput,
  Exclude<keyof __ExecuteStatementCommandInput, "Parameters">
> & {
  Parameters?: NativeAttributeValue[] | undefined;
};
export type ExecuteStatementCommandOutput = Pick<
  __ExecuteStatementCommandOutput,
  Exclude<keyof __ExecuteStatementCommandOutput, "Items" | "LastEvaluatedKey">
> & {
  Items?: Record<string, NativeAttributeValue>[] | undefined;
  LastEvaluatedKey?: Record<string, NativeAttributeValue> | undefined;
};
export declare class ExecuteStatementCommand extends DynamoDBDocumentClientCommand<
  ExecuteStatementCommandInput,
  ExecuteStatementCommandOutput,
  __ExecuteStatementCommandInput,
  __ExecuteStatementCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: ExecuteStatementCommandInput;
  protected readonly inputKeyNodes: {
    Parameters: import("../commands/utils").KeyNodeChildren;
  };
  protected readonly outputKeyNodes: {
    Items: {
      "*": import("../commands/utils").KeyNodeChildren;
    };
    LastEvaluatedKey: import("../commands/utils").KeyNodeChildren;
  };
  protected readonly clientCommand: __ExecuteStatementCommand;
  readonly middlewareStack: MiddlewareStack<
    ExecuteStatementCommandInput | __ExecuteStatementCommandInput,
    ExecuteStatementCommandOutput | __ExecuteStatementCommandOutput
  >;
  constructor(input: ExecuteStatementCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<ExecuteStatementCommandInput, ExecuteStatementCommandOutput>;
}
import {
  ExecuteStatementCommandInput as __ExecuteStatementCommandInput,
  ExecuteStatementCommandOutput as __ExecuteStatementCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
