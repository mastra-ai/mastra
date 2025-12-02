// Portions of this file are derived from getsentry/sentry-javascript by Software, Inc. dba Sentry
// Licensed under the MIT License

import type { JsonType } from '../types'

// levels originally copied from Sentry to work with the sentry integration
// and to avoid relying on a frequently changing @sentry/types dependency
// but provided as an array of literal types, so we can constrain the level below
export const severityLevels = ['fatal', 'error', 'warning', 'log', 'info', 'debug'] as const
export declare type SeverityLevel = (typeof severityLevels)[number]

export interface PolymorphicEvent {
  [key: string]: unknown
  readonly type: string
  readonly target?: unknown
  readonly currentTarget?: unknown
}

export interface EventHint {
  mechanism?: Partial<Mechanism>
  syntheticException?: Error | null
}

export interface ErrorProperties {
  $exception_list: Exception[]
  $exception_level?: SeverityLevel
}

export interface Exception {
  type?: string
  value?: string
  mechanism?: Mechanism
  module?: string
  thread_id?: number
  stacktrace?: { frames?: StackFrame[]; type: 'raw' }
}

export type ExceptionList = Exception[]

export interface Mechanism {
  handled?: boolean
  type?: 'generic' | 'onunhandledrejection' | 'onuncaughtexception' | 'onconsole' | 'middleware'
  source?: string
  synthetic?: boolean
}

export type GetModuleFn = (filename: string | undefined) => string | undefined

export type StackParser = (stack: string, skipFirstLines?: number) => StackFrame[]
export type StackLineParser = (line: string) => StackFrame | undefined

export type StackFrameModifierFn = (frames: StackFrame[]) => Promise<StackFrame[]>

export interface StackFrame {
  platform: string
  filename?: string
  function?: string
  module?: string
  lineno?: number
  colno?: number
  abs_path?: string
  context_line?: string
  pre_context?: string[]
  post_context?: string[]
  in_app?: boolean
  instruction_addr?: string
  addr_mode?: string
  vars?: { [key: string]: JsonType }
  chunk_id?: string
}

export interface CoercingContext extends EventHint {
  // Used to forward to other types
  apply: (input: unknown) => ExceptionLike
  // Used to coerce nested exceptions
  next: (input: unknown) => ExceptionLike | undefined
}

export type ChunkIdMapType = Record<string, string>

export interface ParsingContext {
  chunkIdMap?: ChunkIdMapType
}

interface Coercer<T, U, C> {
  match(input: unknown): input is T
  coerce(input: T, ctx: C): U
}

export type ErrorTrackingCoercer<T> = Coercer<T, ExceptionLike | undefined, CoercingContext>

interface BaseException {
  type: string
  value: string
  synthetic: boolean
}

export interface ExceptionLike extends BaseException {
  stack?: string
  cause?: ExceptionLike
  level?: SeverityLevel
}

export interface ParsedException extends BaseException {
  stack?: StackFrame[]
  cause?: ParsedException
}
