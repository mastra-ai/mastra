import type { ToolSet } from '@internal/ai-sdk-v5';
import { DefaultGeneratedFile, DefaultGeneratedFileWithType } from '../../stream/aisdk/v5/file';
import { DefaultStepResult } from '../../stream/aisdk/v5/output-helpers';
import { registerClass } from './registry';

type GeneratedFileData = { data: string; mediaType: string };

registerClass<DefaultGeneratedFile, GeneratedFileData>('DefaultGeneratedFile', {
  toData: f => ({ data: f.base64, mediaType: f.mediaType }),
  fromData: d => new DefaultGeneratedFile({ data: d.data, mediaType: d.mediaType }),
});

registerClass<DefaultGeneratedFileWithType, GeneratedFileData>('DefaultGeneratedFileWithType', {
  toData: f => ({ data: f.base64, mediaType: f.mediaType }),
  fromData: d => new DefaultGeneratedFileWithType({ data: d.data, mediaType: d.mediaType }),
});

// `DefaultStepResult` flows through workflow output schemas typed as `z.any()`,
// so it crosses the unix-socket pubsub on the evented engine. Without a class
// registration, consumers that rely on `instanceof DefaultStepResult` (e.g. the
// in-memory storage path) would receive plain data. The generic `TOOLS` type
// parameter is erased at runtime, so we register the constructor name once.
type DefaultStepResultData = {
  content: DefaultStepResult<ToolSet>['content'];
  finishReason: DefaultStepResult<ToolSet>['finishReason'];
  usage: DefaultStepResult<ToolSet>['usage'];
  warnings: DefaultStepResult<ToolSet>['warnings'];
  request: DefaultStepResult<ToolSet>['request'];
  response: DefaultStepResult<ToolSet>['response'];
  providerMetadata: DefaultStepResult<ToolSet>['providerMetadata'];
  tripwire?: DefaultStepResult<ToolSet>['tripwire'];
};

registerClass<DefaultStepResult<ToolSet>, DefaultStepResultData>('DefaultStepResult', {
  toData: s => ({
    content: s.content,
    finishReason: s.finishReason,
    usage: s.usage,
    warnings: s.warnings,
    request: s.request,
    response: s.response,
    providerMetadata: s.providerMetadata,
    tripwire: s.tripwire,
  }),
  fromData: d => new DefaultStepResult(d),
});
