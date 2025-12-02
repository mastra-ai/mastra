import { ScanCommand as __ScanCommand } from "@aws-sdk/client-dynamodb";
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
export type ScanCommandInput = Pick<
  __ScanCommandInput,
  Exclude<
    keyof __ScanCommandInput,
    "ScanFilter" | "ExclusiveStartKey" | "ExpressionAttributeValues"
  >
> & {
  ScanFilter?:
    | Record<
        string,
        Pick<Condition, Exclude<keyof Condition, "AttributeValueList">> & {
          AttributeValueList?: NativeAttributeValue[] | undefined;
        }
      >
    | undefined;
  ExclusiveStartKey?: Record<string, NativeAttributeValue> | undefined;
  ExpressionAttributeValues?: Record<string, NativeAttributeValue> | undefined;
};
export type ScanCommandOutput = Pick<
  __ScanCommandOutput,
  Exclude<keyof __ScanCommandOutput, "Items" | "LastEvaluatedKey">
> & {
  Items?: Record<string, NativeAttributeValue>[] | undefined;
  LastEvaluatedKey?: Record<string, NativeAttributeValue> | undefined;
};
export declare class ScanCommand extends DynamoDBDocumentClientCommand<
  ScanCommandInput,
  ScanCommandOutput,
  __ScanCommandInput,
  __ScanCommandOutput,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly input: ScanCommandInput;
  protected readonly inputKeyNodes: {
    ScanFilter: {
      "*": {
        AttributeValueList: import("../commands/utils").KeyNodeChildren;
      };
    };
    ExclusiveStartKey: import("../commands/utils").KeyNodeChildren;
    ExpressionAttributeValues: import("../commands/utils").KeyNodeChildren;
  };
  protected readonly outputKeyNodes: {
    Items: {
      "*": import("../commands/utils").KeyNodeChildren;
    };
    LastEvaluatedKey: import("../commands/utils").KeyNodeChildren;
  };
  protected readonly clientCommand: __ScanCommand;
  readonly middlewareStack: MiddlewareStack<
    ScanCommandInput | __ScanCommandInput,
    ScanCommandOutput | __ScanCommandOutput
  >;
  constructor(input: ScanCommandInput);
  resolveMiddleware(
    clientStack: MiddlewareStack<ServiceInputTypes, ServiceOutputTypes>,
    configuration: DynamoDBDocumentClientResolvedConfig,
    options?: __HttpHandlerOptions
  ): Handler<ScanCommandInput, ScanCommandOutput>;
}
import {
  Condition,
  ScanCommandInput as __ScanCommandInput,
  ScanCommandOutput as __ScanCommandOutput,
} from "@aws-sdk/client-dynamodb";
import { NativeAttributeValue } from "@aws-sdk/util-dynamodb";
