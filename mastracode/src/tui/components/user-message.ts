/**
 * Component that renders a user message with a role indicator.
 */

import { Container, Markdown, Spacer, Text } from '@mariozechner/pi-tui';
import type { MarkdownTheme } from '@mariozechner/pi-tui';
import { getMarkdownTheme, theme } from '../theme.js';

export class UserMessageComponent extends Container {
  constructor(text: string, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
    super();
    this.addChild(new Spacer(1));
    this.addChild(new Text(theme.bold(theme.fg('accent', '❯')) + ' ' + theme.bold(theme.fg('text', 'You')), 1, 0));
    this.addChild(
      new Markdown(text, 1, 1, markdownTheme, {
        bgColor: (text: string) => theme.bg('userMessageBg', text),
        color: (text: string) => theme.fg('userMessageText', text),
      }),
    );
  }
}
