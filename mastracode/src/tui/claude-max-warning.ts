/**
 * Claude Max OAuth warning prompt.
 *
 * Renders an inline question asking the user whether to proceed with
 * Anthropic OAuth (grey-area ToS), with different options depending on
 * whether we're in the login/onboarding flow or the startup check.
 */

import { Spacer } from '@mariozechner/pi-tui';
import { CLAUDE_MAX_OAUTH_WARNING_MESSAGE } from '../auth/claude-max-warning.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import type { TUIState } from './state.js';

export type ClaudeMaxWarningMode = 'login' | 'startup';
export type ClaudeMaxWarningResult = 'continue' | 'cancel' | 'remove';

/**
 * Show the Claude Max OAuth warning inline and return the user's choice.
 *
 * - **login** mode: "Continue" / "Cancel"
 * - **startup** mode: "Continue" / "Remove OAuth"
 */
export function showClaudeMaxOAuthWarning(
  state: TUIState,
  mode: ClaudeMaxWarningMode,
): Promise<ClaudeMaxWarningResult> {
  const options =
    mode === 'login'
      ? [
          { label: 'Continue', description: 'Proceed with Anthropic OAuth' },
          { label: 'Cancel', description: 'Go back' },
        ]
      : [
          { label: 'Continue', description: 'Keep Anthropic OAuth credentials' },
          { label: 'Remove OAuth', description: 'Log out from Anthropic' },
        ];

  return new Promise<ClaudeMaxWarningResult>(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: CLAUDE_MAX_OAUTH_WARNING_MESSAGE,
        options,
        formatResult: answer => `Claude Max OAuth warning → ${answer}`,
        isNegativeAnswer: answer => answer !== 'Continue',
        onSubmit: answer => {
          state.activeInlineQuestion = undefined;
          if (answer === 'Continue') {
            resolve('continue');
          } else if (answer === 'Cancel') {
            resolve('cancel');
          } else {
            resolve('remove');
          }
        },
        onCancel: () => {
          state.activeInlineQuestion = undefined;
          resolve('cancel');
        },
      },
      state.ui,
    );

    state.activeInlineQuestion = questionComponent;
    state.chatContainer.addChild(questionComponent);
    state.chatContainer.addChild(new Spacer(1));
    state.ui.requestRender();
    state.chatContainer.invalidate();
  });
}
