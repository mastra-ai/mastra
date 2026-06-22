import { describe, expect, it } from 'vitest';

import { resolveDataCodeSectionPayload } from './data-code-section-utils';

describe('resolveDataCodeSectionPayload', () => {
  it('pretty-prints object values as JSON', () => {
    expect(resolveDataCodeSectionPayload({ data: { query: 'hello', count: 2 } })).toEqual({
      mode: 'json',
      value: '{\n  "query": "hello",\n  "count": 2\n}',
      copyValue: '{\n  "query": "hello",\n  "count": 2\n}',
      hasMultilineText: false,
    });
  });

  it('pretty-prints JSON stored as a string', () => {
    expect(resolveDataCodeSectionPayload({ data: '{"items":[{"title":"First"}]}' })).toEqual({
      mode: 'json',
      value: '{\n  "items": [\n    {\n      "title": "First"\n    }\n  ]\n}',
      copyValue: '{\n  "items": [\n    {\n      "title": "First"\n    }\n  ]\n}',
      hasMultilineText: false,
    });
  });

  it('renders markdown-looking strings as markdown content', () => {
    expect(resolveDataCodeSectionPayload({ data: '### Page\\n- One\\n- Two' })).toEqual({
      mode: 'markdown',
      value: '### Page\n- One\n- Two',
      copyValue: '### Page\n- One\n- Two',
      hasMultilineText: false,
    });
  });

  it('keeps ordinary strings as wrapped text', () => {
    expect(resolveDataCodeSectionPayload({ data: 'A long unstructured tool result' })).toEqual({
      mode: 'text',
      value: 'A long unstructured tool result',
      copyValue: 'A long unstructured tool result',
      hasMultilineText: false,
    });
  });

  it('keeps empty strings as valid text payloads', () => {
    expect(resolveDataCodeSectionPayload({ data: '' })).toEqual({
      mode: 'text',
      value: '',
      copyValue: '',
      hasMultilineText: false,
    });
  });

  it('keeps codeStr backward-compatible', () => {
    expect(resolveDataCodeSectionPayload({ codeStr: JSON.stringify({ output: '**Done**' }, null, 2) })).toEqual({
      mode: 'json',
      value: '{\n  "output": "**Done**"\n}',
      copyValue: '{\n  "output": "**Done**"\n}',
      hasMultilineText: false,
    });
  });
});
