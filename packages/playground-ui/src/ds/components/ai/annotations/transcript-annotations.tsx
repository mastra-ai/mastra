import type { RefObject } from 'react';

import { AnnotationMarkers } from './annotation-markers';
import { AnnotationSelectionToolbar } from './annotation-selection-toolbar';
import { useChatAnnotations } from './chat-annotations';

export interface TranscriptAnnotationsProps {
  /** The transcript. Text selected inside one message's content within it can be annotated. */
  containerRef: RefObject<HTMLElement | null>;
  /** Focused once an annotation is added, so the person can type their message straight away. */
  composerInputRef?: RefObject<HTMLTextAreaElement | null>;
}

/**
 * Everything annotations add to a transcript, wired to `ChatAnnotationsProvider`: Add to chat over
 * selected text, and the numbered comment bubbles of what was added. Render it inside the scrolled
 * transcript, below a positioned ancestor that scrolls with it, so the bubbles travel with the text.
 */
export function TranscriptAnnotations({ containerRef, composerInputRef }: TranscriptAnnotationsProps) {
  const { annotations, addAnnotation, removeAnnotation, setAnnotationComment } = useChatAnnotations();

  return (
    <>
      <AnnotationMarkers annotations={annotations} onRemove={removeAnnotation} onCommentChange={setAnnotationComment} />
      <AnnotationSelectionToolbar
        containerRef={containerRef}
        onAnnotate={annotation => {
          addAnnotation(annotation);
          composerInputRef?.current?.focus();
        }}
      />
    </>
  );
}
