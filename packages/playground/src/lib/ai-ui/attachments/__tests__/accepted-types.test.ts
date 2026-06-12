// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { acceptAttributeValue, getAcceptedAttachmentTypes, isAcceptedAttachmentType } from '../accepted-types';

const flagWindow = window as unknown as { MASTRA_STUDIO_ATTACHMENT_TYPES?: string };

afterEach(() => {
  delete flagWindow.MASTRA_STUDIO_ATTACHMENT_TYPES;
});

describe('getAcceptedAttachmentTypes', () => {
  it('returns null when unconfigured (accept everything)', () => {
    expect(getAcceptedAttachmentTypes()).toBeNull();
  });

  it('returns null for an unreplaced template placeholder', () => {
    flagWindow.MASTRA_STUDIO_ATTACHMENT_TYPES = '%%MASTRA_STUDIO_ATTACHMENT_TYPES%%';
    expect(getAcceptedAttachmentTypes()).toBeNull();
  });

  it('parses a comma-separated allowlist, trimming whitespace', () => {
    flagWindow.MASTRA_STUDIO_ATTACHMENT_TYPES = 'image/*, application/pdf ,text/csv';
    expect(getAcceptedAttachmentTypes()).toEqual(['image/*', 'application/pdf', 'text/csv']);
  });
});

describe('isAcceptedAttachmentType', () => {
  const accepted = ['image/*', 'application/pdf', 'text/csv'];

  it('accepts everything when allowlist is null', () => {
    expect(isAcceptedAttachmentType('application/zip', null)).toBe(true);
  });

  it('matches exact types', () => {
    expect(isAcceptedAttachmentType('application/pdf', accepted)).toBe(true);
    expect(isAcceptedAttachmentType('text/csv', accepted)).toBe(true);
  });

  it('matches type/* wildcards', () => {
    expect(isAcceptedAttachmentType('image/png', accepted)).toBe(true);
    expect(isAcceptedAttachmentType('image/svg+xml', accepted)).toBe(true);
  });

  it('rejects types not on the allowlist', () => {
    expect(isAcceptedAttachmentType('application/zip', accepted)).toBe(false);
    expect(isAcceptedAttachmentType('text/plain', accepted)).toBe(false);
  });

  it('ignores content-type parameters and casing', () => {
    expect(isAcceptedAttachmentType('Text/CSV; charset=utf-8', accepted)).toBe(true);
  });

  it('treats */* as accept-everything', () => {
    expect(isAcceptedAttachmentType('application/zip', ['*/*'])).toBe(true);
  });
});

describe('acceptAttributeValue', () => {
  it('is undefined when unrestricted', () => {
    expect(acceptAttributeValue(null)).toBeUndefined();
  });

  it('joins the allowlist for the file input accept attribute', () => {
    expect(acceptAttributeValue(['image/*', 'application/pdf'])).toBe('image/*,application/pdf');
  });
});
