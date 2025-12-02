import {
  DynamoDBClient,
  DynamoDBClientResolvedConfig,
  ServiceInputTypes as __ServiceInputTypes,
  ServiceOutputTypes as __ServiceOutputTypes,
} from "@aws-sdk/client-dynamodb";
import { marshallOptions, unmarshallOptions } from "@aws-sdk/util-dynamodb";
import { Client as __Client } from "@smithy/smithy-client";
import { HttpHandlerOptions as __HttpHandlerOptions } from "@smithy/types";
import {
  BatchExecuteStatementCommandInput,
  BatchExecuteStatementCommandOutput,
} from "./commands/BatchExecuteStatementCommand";
import {
  BatchGetCommandInput,
  BatchGetCommandOutput,
} from "./commands/BatchGetCommand";
import {
  BatchWriteCommandInput,
  BatchWriteCommandOutput,
} from "./commands/BatchWriteCommand";
import {
  DeleteCommandInput,
  DeleteCommandOutput,
} from "./commands/DeleteCommand";
import {
  ExecuteStatementCommandInput,
  ExecuteStatementCommandOutput,
} from "./commands/ExecuteStatementCommand";
import {
  ExecuteTransactionCommandInput,
  ExecuteTransactionCommandOutput,
} from "./commands/ExecuteTransactionCommand";
import { GetCommandInput, GetCommandOutput } from "./commands/GetCommand";
import { PutCommandInput, PutCommandOutput } from "./commands/PutCommand";
import { QueryCommandInput, QueryCommandOutput } from "./commands/QueryCommand";
import { ScanCommandInput, ScanCommandOutput } from "./commands/ScanCommand";
import {
  TransactGetCommandInput,
  TransactGetCommandOutput,
} from "./commands/TransactGetCommand";
import {
  TransactWriteCommandInput,
  TransactWriteCommandOutput,
} from "./commands/TransactWriteCommand";
import {
  UpdateCommandInput,
  UpdateCommandOutput,
} from "./commands/UpdateCommand";
export { __Client };
export type ServiceInputTypes =
  | __ServiceInputTypes
  | BatchExecuteStatementCommandInput
  | BatchGetCommandInput
  | BatchWriteCommandInput
  | DeleteCommandInput
  | ExecuteStatementCommandInput
  | ExecuteTransactionCommandInput
  | GetCommandInput
  | PutCommandInput
  | QueryCommandInput
  | ScanCommandInput
  | TransactGetCommandInput
  | TransactWriteCommandInput
  | UpdateCommandInput;
export type ServiceOutputTypes =
  | __ServiceOutputTypes
  | BatchExecuteStatementCommandOutput
  | BatchGetCommandOutput
  | BatchWriteCommandOutput
  | DeleteCommandOutput
  | ExecuteStatementCommandOutput
  | ExecuteTransactionCommandOutput
  | GetCommandOutput
  | PutCommandOutput
  | QueryCommandOutput
  | ScanCommandOutput
  | TransactGetCommandOutput
  | TransactWriteCommandOutput
  | UpdateCommandOutput;
export type TranslateConfig = {
  marshallOptions?: marshallOptions;
  unmarshallOptions?: unmarshallOptions;
};
export type DynamoDBDocumentClientResolvedConfig =
  DynamoDBClientResolvedConfig & {
    translateConfig?: TranslateConfig;
  };
export declare class DynamoDBDocumentClient extends __Client<
  __HttpHandlerOptions,
  ServiceInputTypes,
  ServiceOutputTypes,
  DynamoDBDocumentClientResolvedConfig
> {
  readonly config: DynamoDBDocumentClientResolvedConfig;
  protected constructor(
    client: DynamoDBClient,
    translateConfig?: TranslateConfig
  );
  static from(
    client: DynamoDBClient,
    translateConfig?: TranslateConfig
  ): DynamoDBDocumentClient;
  destroy(): void;
}
