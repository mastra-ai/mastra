import { isArray } from '@/utils'
import { getFilenameToChunkIdMap } from './chunk-ids'
import { createStackParser } from './parsers'
import {
  ErrorProperties,
  ExceptionLike,
  ExceptionList,
  CoercingContext,
  StackFrame,
  StackFrameModifierFn,
  StackParser,
  ErrorTrackingCoercer,
  EventHint,
  StackLineParser,
  ParsingContext,
  ChunkIdMapType,
  Mechanism,
  ParsedException,
  Exception,
} from './types'

const MAX_CAUSE_RECURSION = 4

export class ErrorPropertiesBuilder {
  stackParser: StackParser

  constructor(
    private coercers: ErrorTrackingCoercer<any>[] = [],
    parsers: StackLineParser[] = [],
    private modifiers: StackFrameModifierFn[] = []
  ) {
    this.stackParser = createStackParser(...parsers)
  }

  buildFromUnknown(input: unknown, hint: EventHint = {}): ErrorProperties {
    const providedMechanism = hint && hint.mechanism
    const mechanism = providedMechanism || {
      handled: true,
      type: 'generic',
    }
    const coercingContext: CoercingContext = this.buildCoercingContext(mechanism, hint, 0)
    const exceptionWithCause = coercingContext.apply(input)
    const parsingContext: ParsingContext = this.buildParsingContext()
    const exceptionWithStack = this.parseStacktrace(exceptionWithCause, parsingContext)
    const exceptionList = this.convertToExceptionList(exceptionWithStack, mechanism)
    return {
      $exception_list: exceptionList,
      $exception_level: 'error',
    }
  }

  async modifyFrames(exceptionList: ErrorProperties['$exception_list']): Promise<ErrorProperties['$exception_list']> {
    for (const exc of exceptionList) {
      if (exc.stacktrace && exc.stacktrace.frames && isArray(exc.stacktrace.frames)) {
        exc.stacktrace.frames = await this.applyModifiers(exc.stacktrace.frames)
      }
    }
    return exceptionList
  }

  private coerceFallback(ctx: CoercingContext): ExceptionLike {
    return {
      type: 'Error',
      value: 'Unknown error',
      stack: ctx.syntheticException?.stack,
      synthetic: true,
    }
  }

  private parseStacktrace(err: ExceptionLike, ctx: ParsingContext): ParsedException {
    let cause: ParsedException | undefined = undefined
    if (err.cause != null) {
      cause = this.parseStacktrace(err.cause, ctx)
    }
    let stack: StackFrame[] | undefined = undefined
    if (err.stack != '' && err.stack != null) {
      stack = this.applyChunkIds(this.stackParser(err.stack, err.synthetic ? 1 : 0), ctx.chunkIdMap)
    }
    return { ...err, cause, stack }
  }

  private applyChunkIds(frames: StackFrame[], chunkIdMap?: ChunkIdMapType): StackFrame[] {
    return frames.map((frame) => {
      if (frame.filename && chunkIdMap) {
        frame.chunk_id = chunkIdMap[frame.filename]
      }
      return frame
    })
  }

  private applyCoercers(input: unknown, ctx: CoercingContext): ExceptionLike | undefined {
    for (const adapter of this.coercers) {
      if (adapter.match(input)) {
        return adapter.coerce(input, ctx)
      }
    }
    return this.coerceFallback(ctx)
  }

  private async applyModifiers(frames: StackFrame[]): Promise<StackFrame[]> {
    let newFrames = frames
    for (const modifier of this.modifiers) {
      newFrames = await modifier(newFrames)
    }
    return newFrames
  }

  private convertToExceptionList(exceptionWithStack: ParsedException, mechanism: Mechanism): ExceptionList {
    const currentException: Exception = {
      type: exceptionWithStack.type,
      value: exceptionWithStack.value,
      mechanism: {
        type: mechanism.type ?? 'generic',
        handled: mechanism.handled ?? true,
        synthetic: exceptionWithStack.synthetic ?? false,
      },
    }
    if (exceptionWithStack.stack) {
      currentException.stacktrace = {
        type: 'raw',
        frames: exceptionWithStack.stack,
      }
    }
    const exceptionList: ExceptionList = [currentException]
    if (exceptionWithStack.cause != null) {
      // Cause errors are necessarily handled
      exceptionList.push(
        ...this.convertToExceptionList(exceptionWithStack.cause, {
          ...mechanism,
          handled: true,
        })
      )
    }
    return exceptionList
  }

  private buildParsingContext(): ParsingContext {
    const context = {
      chunkIdMap: getFilenameToChunkIdMap(this.stackParser),
    } as ParsingContext
    return context
  }

  private buildCoercingContext(mechanism: Mechanism, hint: EventHint, depth: number = 0): CoercingContext {
    const coerce = (input: unknown, depth: number) => {
      if (depth <= MAX_CAUSE_RECURSION) {
        const ctx = this.buildCoercingContext(mechanism, hint, depth)
        return this.applyCoercers(input, ctx)
      } else {
        return undefined
      }
    }
    const context = {
      ...hint,
      // Do not propagate synthetic exception as it doesn't make sense
      syntheticException: depth == 0 ? hint.syntheticException : undefined,
      mechanism,
      apply: (input: unknown) => {
        return coerce(input, depth)
      },
      next: (input: unknown) => {
        return coerce(input, depth + 1)
      },
    } as CoercingContext
    return context
  }
}
