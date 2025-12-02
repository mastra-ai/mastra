import { BatchGetItemCommand as __BatchGetItemCommand } from "@aws-sdk/client-dynamodb";
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
export type BatchGetCommandInput = Pick<
  __BatchGetItemCommandInput,
  Exclude<keyof __BatchGetItemCommandInput, "RequestItems">
> & {
  RequestItems:
    | Record<
        string,
        Pick<KeysAndAttributes, Exclude<keyof KeysAndAttributes, "Keys">> & {
          Keys: Record<string, NativeAttributeValue>[] | undefined;
        }
      >
    | undefined;
};
export type BatchGetCommandOutput = Pick<
  __BatchGetItemCommandOutput,
  Exclude<keyof __BatchGetItemCommandOutput, "Responses" | "UnprocessedKeys">
> & {
  Responses?:
    | Record<string, Record<string, NativeAttributeValue>[]>
    | undefined;
  UnprocessedKeys?:
    | Record<
        string,
        Pick<KeysAndAttributes, Exclude<keyof KeysAndAttributes, "Keys">> & {
          Keys: Record<string, NativeAttributeValue>[] | undefined;
        }
      >
    | undefined;
};
export declare class BatchGetCommand extends DynamoDBDocumentClientCommand<
  BatchGetCommandInput,
  BatchGetCommandOutput,
  __BatchGetItemCommandInput,
  __BatchGetItemCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: BatchGetCommandInput;
  protected readonly inputKeyNodes: {
    RequestItems: {
      "*": {
        Keys: {
          "*": import("../commands/utils").KeyNodeChildren;
        };
      };
    };
  };
  protected readonly outputKeyNodes: {
    Responses: {
      "*": {
        "*": import("../commands/utils").KeyNodeChildren;
      };
    };
    UnprocessedKeys: {
      "*": {
        Keys: {
          "*": import("../commands/utils").KeyNodeChildren;
        };
      };
    };
  };
  protected readonly clientCommand: __BatchGetItemCommand;
  readonly middlewareStack: MiddlewareStack<
    BatchGetCommandInput | __BatchGetItemCommandInput,
    BatchGetCommandOutput | __BatchGetItemCommandOutput
  >;
  constructor(input: BatchGetCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<BatchGetCommandInput, BatchGetCommandOutput>;
}
import {
  BatchGetItemCommandInput as __BatchGetItemCommandInput,
  BatchGetItemCommandOutput as __BatchGetItemCommandOutput,
  KeysAndAttributes,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
