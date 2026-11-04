// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChatAnnotationsProvider, useChatAnnotations } from '../chat-annotations';
import type { ChatAnnotation } from '../chat-annotations';

afterEach(cleanup);

describe('ChatAnnotationsProvider', () => {
  describe('when a comment changes while the message taking its annotation is being prepared', () => {
    it('still clears the annotation that went out, so the next message does not repeat it', () => {
      const { result } = renderHook(() => useChatAnnotations(), { wrapper: ChatAnnotationsProvider });
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

      let taken: ChatAnnotation[] = [];
      act(() => {
        taken = takeAtSubmit();
      });

      expect(taken.map(annotation => annotation.text)).toEqual(['Open rows']);
      expect(result.current.annotations).toEqual([]);
    });
  });
});
