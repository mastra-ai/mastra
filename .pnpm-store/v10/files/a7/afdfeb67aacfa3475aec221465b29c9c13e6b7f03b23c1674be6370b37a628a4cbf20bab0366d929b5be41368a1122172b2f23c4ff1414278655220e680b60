import { Command as $Command } from "@smithy/smithy-client";
import { MiddlewareStack } from "@smithy/types";
import { KeyNodeChildren } from "../commands/utils";
import { DynamoDBDocumentClientResolvedConfig } from "../DynamoDBDocumentClient";
export declare abstract class DynamoDBDocumentClientCommand<
  Input extends object,
  Output extends object,
  BaseInput extends object,
  BaseOutput extends object,
  ResolvedClientConfiguration
> extends $Command<
  Input | BaseInput,
  Output | BaseOutput,
  ResolvedClientConfiguration
> {
  protected abstract readonly inputKeyNodes: KeyNodeChildren;
  protected abstract readonly outputKeyNodes: KeyNodeChildren;
  protected abstract clientCommand: $Command<
    Input | BaseInput,
    Output | BaseOutput,
    ResolvedClientConfiguration
  >;
  abstract middlewareStack: MiddlewareStack<
    Input | BaseInput,
    Output | BaseOutput
  >;
  protected addMarshallingMiddleware(
    configuration: DynamoDBDocumentClientResolvedConfig
  ): void;
}
