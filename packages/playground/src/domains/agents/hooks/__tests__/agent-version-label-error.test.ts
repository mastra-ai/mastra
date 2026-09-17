import { MastraClientError } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import {
  AGENT_VERSION_LABEL_ERROR_CODES,
  getAgentVersionLabelError,
} from '../agent-version-label-error';

describe('getAgentVersionLabelError', () => {
  describe('when the SDK error contains each stable version-label error code', () => {
    it('narrows every code without dropping its HTTP status or details', () => {
      const narrowed = AGENT_VERSION_LABEL_ERROR_CODES.map(code =>
        getAgentVersionLabelError(
          new MastraClientError(409, 'Conflict', code, {
            error: { code, message: `Message for ${code}`, details: { label: 'preview' } },
          }),
        ),
      );

      expect(narrowed.map(error => error?.code)).toEqual(AGENT_VERSION_LABEL_ERROR_CODES);
      expect(narrowed.every(error => error?.status === 409)).toBe(true);
      expect(narrowed.every(error => error?.details?.label === 'preview')).toBe(true);
    });
  });

  describe('when an SDK error contains an unknown code', () => {
    it('leaves it for the generic Studio error treatment', () => {
      const error = new MastraClientError(500, 'Internal Server Error', 'Unknown', {
        error: { code: 'SOMETHING_NEW', message: 'Unknown failure' },
      });

      expect(getAgentVersionLabelError(error)).toBeUndefined();
    });
  });

  describe('when the thrown value is not an SDK HTTP error', () => {
    it('does not misclassify it as a version-label API error', () => {
      expect(getAgentVersionLabelError(new Error('network failed'))).toBeUndefined();
    });
  });

  describe('when the SDK error body is null or an array', () => {
    it('rejects the malformed envelope', () => {
      expect(getAgentVersionLabelError(new MastraClientError(500, 'Error', 'Malformed', null))).toBeUndefined();
      expect(getAgentVersionLabelError(new MastraClientError(500, 'Error', 'Malformed', []))).toBeUndefined();
    });
  });

  describe('when the envelope code or message is not a string', () => {
    it('rejects the malformed fields', () => {
      const numericCode = new MastraClientError(500, 'Error', 'Malformed', {
        error: { code: 42, message: 'Failure' },
      });
      const numericMessage = new MastraClientError(500, 'Error', 'Malformed', {
        error: { code: 'INVALID_LABEL', message: 42 },
      });

      expect(getAgentVersionLabelError(numericCode)).toBeUndefined();
      expect(getAgentVersionLabelError(numericMessage)).toBeUndefined();
    });
  });
});
