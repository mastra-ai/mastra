import { AnnotationMarkers } from './annotation-markers';
import { AnnotationSelectionToolbar } from './annotation-selection-toolbar';
import { useChatAnnotations } from './chat-annotations';
import { useChatShellRegions } from '@/ds/components/ChatShell/chat-shell-context';

/**
 * Everything annotations add to a transcript, wired to `ChatAnnotationsProvider`: Add to chat over
 * selected text, and the numbered comment bubbles of what was added. Render it inside
 * `ChatShell.Transcript`; adding an annotation focuses the `ComposerInput` in `ChatShell.Dock`.
 */
export function TranscriptAnnotations() {
  const { transcriptRef, composerInputRef } = useChatShellRegions();
  const { annotations, addAnnotation, removeAnnotation, setAnnotationComment } = useChatAnnotations();

  return (
    <>
      <AnnotationMarkers
        containerRef={transcriptRef}
        annotations={annotations}
        onRemove={removeAnnotation}
        onCommentChange={setAnnotationComment}
      />
      <AnnotationSelectionToolbar
        containerRef={transcriptRef}
        onAnnotate={annotation => {
          addAnnotation(annotation);
          composerInputRef.current?.focus();
        }}
      />
    </>
  );
}
