import { GetItemCommand as __GetItemCommand } from "@aws-sdk/client-dynamodb";
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
export type GetCommandInput = Pick<
  __GetItemCommandInput,
  Exclude<keyof __GetItemCommandInput, "Key">
> & {
  Key: Record<string, NativeAttributeValue> | undefined;
};
export type GetCommandOutput = Pick<
  __GetItemCommandOutput,
  Exclude<keyof __GetItemCommandOutput, "Item">
> & {
  Item?: Record<string, NativeAttributeValue> | undefined;
};
export declare class GetCommand extends DynamoDBDocumentClientCommand<
  GetCommandInput,
  GetCommandOutput,
  __GetItemCommandInput,
  __GetItemCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: GetCommandInput;
  protected readonly inputKeyNodes: {
    Key: import("../commands/utils").KeyNodeChildren;
  };
  protected readonly outputKeyNodes: {
    Item: import("../commands/utils").KeyNodeChildren;
  };
  protected readonly clientCommand: __GetItemCommand;
  readonly middlewareStack: MiddlewareStack<
    GetCommandInput | __GetItemCommandInput,
    GetCommandOutput | __GetItemCommandOutput
  >;
  constructor(input: GetCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<GetCommandInput, GetCommandOutput>;
}
import {
  GetItemCommandInput as __GetItemCommandInput,
  GetItemCommandOutput as __GetItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
