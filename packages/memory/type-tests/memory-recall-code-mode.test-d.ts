import type { CodeModeConfig, CodeModeToolResult, CodeModeTransport } from '@mastra/core/tools';
import type {
  MemoryRecallCodeModeSandbox,
  MemoryRecallCodeModeToolResult,
  MemoryRecallCodeModeTransport,
} from '../src/processors/observational-memory/types';

type Assert<T extends true> = T;
type Extends<T, U> = T extends U ? true : false;
type Equal<T, U> = (<V>() => V extends T ? 1 : 2) extends <V>() => V extends U ? 1 : 2 ? true : false;

type _LocalResultMatchesCore = Assert<Equal<MemoryRecallCodeModeToolResult, CodeModeToolResult>>;
type _LocalTransportAcceptsCoreTransport = Assert<Extends<CodeModeTransport, MemoryRecallCodeModeTransport>>;
type _LocalTransportOptionsCoverCoreOptions = Assert<
  Extends<Parameters<CodeModeTransport['run']>[0], Parameters<MemoryRecallCodeModeTransport['run']>[0]>
>;
type _CurrentCoreSandboxSatisfiesLocalContract = Assert<
  Extends<NonNullable<CodeModeConfig['sandbox']>, MemoryRecallCodeModeSandbox>
>;
