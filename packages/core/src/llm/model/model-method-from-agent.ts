import type { AgentMethodType } from '../../agent';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { ModelMethodType } from './model.loop.types';

export function getModelMethodFromAgentMethod(methodType: AgentMethodType): ModelMethodType {
  if (methodType === 'generate' || methodType === 'generateLegacy') {
    return 'generate';
  } else if (methodType === 'stream' || methodType === 'streamLegacy') {
    return 'stream';
  } else {
    throw new MastraError({
      id: 'INVALID_METHOD_TYPE',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
    });
  }
}
