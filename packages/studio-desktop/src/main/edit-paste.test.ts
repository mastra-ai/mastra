import { describe, expect, it } from 'vitest';
import { buildFocusedTextInsertionScript } from './edit-paste';

describe('buildFocusedTextInsertionScript', () => {
  describe('when the pasted text contains secrets or quotes', () => {
    it('serializes the text safely into the focused-input insertion script', () => {
      const script = buildFocusedTextInsertionScript('sk-ant-"demo"');

      expect(script).toContain(JSON.stringify('sk-ant-"demo"'));
      expect(script).toContain("inputType: 'insertFromPaste'");
      expect(script).toContain('document.activeElement');
    });
  });
});
