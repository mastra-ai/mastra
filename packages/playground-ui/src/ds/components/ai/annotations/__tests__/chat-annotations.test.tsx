// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import type { RenderHookResult } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatAnnotationsProvider, useChatAnnotations } from '../chat-annotations';
import type { ChatAnnotation, ChatAnnotationsApi } from '../chat-annotations';

afterEach(cleanup);

describe('ChatAnnotationsProvider', () => {
  describe('when a comment changes while the message taking its annotation is being prepared', () => {
    let hook: RenderHookResult<ChatAnnotationsApi, unknown>;
    let taken: ChatAnnotation[];

    beforeEach(() => {
      hook = renderHook(() => useChatAnnotations(), { wrapper: ChatAnnotationsProvider });
      const { result } = hook;
      act(() =>
        result.current.addAnnotation({
          text: 'Open rows',
          source: {
            element: document.createElement('p'),
            start: 0,
            end: 9,
            text: 'Openrows',
            textBefore: '',
            textAfter: '',
          },
        }),
      );
      const takeAtSubmit = result.current.takeAnnotations;
      act(() => {
        for (const { id } of result.current.annotations) result.current.setAnnotationComment(id, 'Late comment');
      });
      act(() => {
        taken = takeAtSubmit();
      });
    });

    it('hands over the annotation that went out', () => {
      expect(taken.map(annotation => annotation.text)).toEqual(['Open rows']);
    });

    it('still clears it, so the next message does not repeat it', () => {
      expect(hook.result.current.annotations).toEqual([]);
    });
  });
});
