import { Button } from '@mastra/playground-ui/components/Button';
import {
  Composer as ComposerRoot,
  ComposerActions,
  ComposerBox,
  ComposerInput,
  ComposerRing,
} from '@mastra/playground-ui/components/Composer';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowUp, X } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { useSendAgentControllerMessageMutation } from '../../../hooks/useAgentControllerRunMutations';
import { useChatTranscript } from '../chat/context/useChatTranscript';
import { AGENT_CONTROLLER_ID } from '../chat/services/constants';
import { HighlightedCode } from './HighlightedCode';

import type { PendingSelection } from './buffers';

/** Fence language tag from the file extension, so the snippet is highlightable. */
function fenceTag(path: string): string {
  const name = path.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

interface SendSelectionBarProps {
  selection: PendingSelection;
  resourceId: string | undefined;
  projectPath: string | undefined;
  baseUrl: string | undefined;
  /** Pre-filled composer text (e.g. from a code lens action). */
  initialText?: string;
  onDismiss(): void;
  onSent(): void;
}

/**
 * Composer strip that appears when the user highlights a range in the editor.
 * Reuses the design-system Composer shell so it reads as the same input as the
 * session composer. Messages land in the shared chat transcript (optimistic
 * `localUser` append, exactly like the session composer) and the controller
 * transport dispatches to a fresh message or an in-flight steer by phase.
 */
export function SendSelectionBar({
  selection,
  resourceId,
  projectPath,
  baseUrl,
  initialText,
  onDismiss,
  onSent,
}: SendSelectionBarProps) {
  // The host keys this component by selection + prefill, so seeding state
  // from the prop is safe — a new lens action remounts with fresh text.
  const [draft, setDraft] = useState(initialText ?? '');
  const enabled = Boolean(resourceId);
  const { phase, localUser, failLocalUser, pushNotice } = useChatTranscript();
  const mutation = useSendAgentControllerMessageMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: resourceId ?? '',
    scope: projectPath,
    baseUrl,
    enabled,
  });

  const lineLabel =
    selection.startLine === selection.endLine
      ? `line ${selection.startLine}`
      : `lines ${selection.startLine}–${selection.endLine}`;

  async function submit() {
    const text = draft.trim();
    if (!text || !enabled || mutation.isPending) return;
    const header = `Regarding \`${selection.path}\` (${lineLabel}):`;
    const full = [header, '', '```' + fenceTag(selection.path), selection.snippet, '```', '', text].join('\n');
    // Mirror the session composer: append to the shared transcript first so
    // the message is visible in the session history immediately, steering when
    // a run is already in flight.
    const localId = localUser(full, phase === 'working');
    setDraft('');
    try {
      await mutation.mutateAsync({ text: full });
      onSent();
    } catch (error) {
      failLocalUser(localId);
      setDraft(text);
      pushNotice(error instanceof Error ? error.message : 'The message could not be sent.', 'error');
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.defaultPrevented) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    // Floats over the file contents: the wrapper is transparent and lets
    // clicks through everywhere except the composer card itself.
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 pb-3">
      <div className="pointer-events-auto">
        <ComposerRoot
          onSubmit={event => {
            event.preventDefault();
            void submit();
          }}
        >
          <ComposerRing busy={mutation.isPending}>
            <ComposerBox>
              <div className="border-border flex items-start justify-between gap-2 border-b px-3 py-2">
                <div className="min-w-0">
                  <Txt variant="caption" className="text-muted-foreground block truncate">
                    <Txt as="span" variant="caption" font="mono" className="text-foreground">
                      {selection.path}
                    </Txt>{' '}
                    · {lineLabel}
                  </Txt>
                  <pre className="text-caption mt-1 max-h-24 overflow-auto font-mono whitespace-pre-wrap">
                    <HighlightedCode code={selection.snippet} path={selection.path} />
                  </pre>
                </div>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Dismiss selection" onClick={onDismiss}>
                  <X size={14} />
                </Button>
              </div>
              <ComposerInput
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={enabled ? 'Ask the agent about this selection…' : 'Open a thread to send to the agent'}
                disabled={!enabled}
                aria-label="Message about selection"
                autoFocus
              />
              <ComposerActions>
                <Button
                  type="submit"
                  size="icon-sm"
                  className="ml-auto"
                  disabled={!enabled || !draft.trim() || mutation.isPending}
                  aria-label="Send message"
                >
                  <ArrowUp size={16} />
                </Button>
              </ComposerActions>
            </ComposerBox>
          </ComposerRing>
        </ComposerRoot>
      </div>
    </div>
  );
}
