/**
 * Component that renders a user message.
 */

import {
	Container,
	Markdown,
	
	Spacer
} from "@mariozechner/pi-tui"
import type {MarkdownTheme} from "@mariozechner/pi-tui";
import { getMarkdownTheme, theme } from "../theme.js"

export class UserMessageComponent extends Container {
	constructor(text: string, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
		super()
		this.addChild(new Spacer(1))
		this.addChild(
			new Markdown(text, 1, 1, markdownTheme, {
				bgColor: (text: string) => theme.bg("userMessageBg", text),
				color: (text: string) => theme.fg("userMessageText", text),
			}),
		)
	}
}
