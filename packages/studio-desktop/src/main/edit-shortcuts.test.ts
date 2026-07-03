import { describe, expect, it } from 'vitest';
import { editCommandForKeyboardInput } from './edit-shortcuts';

describe('editCommandForKeyboardInput', () => {
  describe('when the user presses the platform paste shortcut', () => {
    it('returns the paste command', () => {
      expect(
        editCommandForKeyboardInput({
          code: 'KeyV',
          control: process.platform !== 'darwin',
          key: 'v',
          meta: process.platform === 'darwin',
          type: 'keyDown',
        }),
      ).toBe('paste');
    });
  });

  describe('when the user presses the platform paste-and-match-style shortcut', () => {
    it('returns the paste-and-match-style command', () => {
      expect(
        editCommandForKeyboardInput({
          code: 'KeyV',
          control: process.platform !== 'darwin',
          key: 'v',
          meta: process.platform === 'darwin',
          shift: true,
          type: 'keyDown',
        }),
      ).toBe('pasteAndMatchStyle');
    });
  });

  describe('when the key event is not a paste shortcut', () => {
    it('does not return an editing command', () => {
      expect(
        editCommandForKeyboardInput({
          code: 'KeyC',
          control: process.platform !== 'darwin',
          key: 'c',
          meta: process.platform === 'darwin',
          type: 'keyDown',
        }),
      ).toBeUndefined();
    });
  });
});
