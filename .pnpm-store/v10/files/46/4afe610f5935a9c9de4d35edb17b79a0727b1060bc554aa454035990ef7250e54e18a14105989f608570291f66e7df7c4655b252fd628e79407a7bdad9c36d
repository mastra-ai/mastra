// @flow

/* eslint-disable import/exports-last, flowtype/require-types-at-top */

export type SerializableValueType = string | number | boolean | null | {+[key: string]: SerializableValueType, ...} | $ReadOnlyArray<SerializableValueType>;

export type SerializableObjectType = {
  +[key: string]: SerializableValueType,
  ...
};

export type WriterType = {|
  +write: (message: string) => void,
|};

export type RoarrGlobalStateType = {|
  sequence: number,
  versions: $ReadOnlyArray<string>,
  ...WriterType,
|};

export type SprintfArgumentType = string | number | boolean | null;

// eslint-disable-next-line flowtype/no-weak-types
export type MessageContextType = Object;

export type MessageType = {|
  +context: MessageContextType,
  +message: string,
  +sequence: number,
  +time: number,
  +version: string,
|};

export type TranslateMessageFunctionType = (message: MessageType) => MessageType;

declare function Logger (
  context: MessageContextType,
  message: string,
  c?: SprintfArgumentType,
  d?: SprintfArgumentType,
  e?: SprintfArgumentType,
  f?: SprintfArgumentType,
  g?: SprintfArgumentType,
  h?: SprintfArgumentType,
  i?: SprintfArgumentType,
  k?: SprintfArgumentType
): void;

// eslint-disable-next-line no-redeclare
declare function Logger (
  message: string,
  b?: SprintfArgumentType,
  c?: SprintfArgumentType,
  d?: SprintfArgumentType,
  e?: SprintfArgumentType,
  f?: SprintfArgumentType,
  g?: SprintfArgumentType,
  h?: SprintfArgumentType,
  i?: SprintfArgumentType,
  k?: SprintfArgumentType
): void;

/**
 * see https://twitter.com/kuizinas/status/914139352908943360
 */
export type LoggerType = {|
  // eslint-disable-next-line no-undef
  [[call]]: typeof Logger,
  +adopt: <T>(routine: () => Promise<T>, context: MessageContextType) => Promise<T>,
  +child: (context: TranslateMessageFunctionType | MessageContextType) => LoggerType,
  +debug: typeof Logger,
  +error: typeof Logger,
  +fatal: typeof Logger,
  +getContext: () => MessageContextType,
  +info: typeof Logger,
  +trace: typeof Logger,
  +warn: typeof Logger,
|};

export type MessageEventHandlerType = (message: MessageType) => void;
