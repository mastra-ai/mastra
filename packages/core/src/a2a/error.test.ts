import { describe, expect, it } from 'vitest';

import { MastraA2AError } from './error';
import {
  ErrorCodeContentTypeNotSupported,
  ErrorCodeExtendedAgentCardNotConfigured,
  ErrorCodeExtensionSupportRequired,
  ErrorCodeInvalidAgentResponse,
  ErrorCodeVersionNotSupported,
} from './types';

describe('MastraA2AError', () => {
  it('creates the new A2A vNext error variants', () => {
    expect(MastraA2AError.contentTypeNotSupported('text/html')).toMatchObject({
      code: ErrorCodeContentTypeNotSupported,
      message: 'Content type not supported: text/html',
      data: { contentType: 'text/html' },
    });

    expect(MastraA2AError.invalidAgentResponse('Malformed result')).toMatchObject({
      code: ErrorCodeInvalidAgentResponse,
      message: 'Malformed result',
    });

    expect(MastraA2AError.extendedAgentCardNotConfigured()).toMatchObject({
      code: ErrorCodeExtendedAgentCardNotConfigured,
      message: 'Extended agent card is not configured',
    });

    expect(MastraA2AError.extensionSupportRequired('streaming')).toMatchObject({
      code: ErrorCodeExtensionSupportRequired,
      message: 'Extension support required: streaming',
      data: { extension: 'streaming' },
    });

    expect(MastraA2AError.versionNotSupported('0.4')).toMatchObject({
      code: ErrorCodeVersionNotSupported,
      message: 'Version not supported: 0.4',
      data: { version: '0.4' },
    });
  });
});
