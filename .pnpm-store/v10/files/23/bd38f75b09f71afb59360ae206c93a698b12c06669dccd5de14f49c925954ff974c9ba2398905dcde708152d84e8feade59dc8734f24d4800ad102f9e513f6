import * as _codemirror_state from '@codemirror/state';
import { StateCommand } from '@codemirror/state';
import { KeyBinding } from '@codemirror/view';
import { Language, LanguageSupport, LanguageDescription } from '@codemirror/language';
import { MarkdownExtension } from '@lezer/markdown';

/**
Language support for strict CommonMark.
*/
declare const commonmarkLanguage: Language;
/**
Language support for [GFM](https://github.github.com/gfm/) plus
subscript, superscript, and emoji syntax.
*/
declare const markdownLanguage: Language;

/**
Returns a command like
[`insertNewlineContinueMarkup`](https://codemirror.net/6/docs/ref/#lang-markdown.insertNewlineContinueMarkup),
allowing further configuration.
*/
declare const insertNewlineContinueMarkupCommand: (config?: {
    /**
    By default, when pressing enter in a blank second item in a
    tight (no blank lines between items) list, the command will
    insert a blank line above that item, starting a non-tight list.
    Set this to false to disable this behavior.
    */
    nonTightLists?: boolean;
}) => StateCommand;
/**
This command, when invoked in Markdown context with cursor
selection(s), will create a new line with the markup for
blockquotes and lists that were active on the old line. If the
cursor was directly after the end of the markup for the old line,
trailing whitespace and list markers are removed from that line.

The command does nothing in non-Markdown context, so it should
not be used as the only binding for Enter (even in a Markdown
document, HTML and code regions might use a different language).
*/
declare const insertNewlineContinueMarkup: StateCommand;
/**
This command will, when invoked in a Markdown context with the
cursor directly after list or blockquote markup, delete one level
of markup. When the markup is for a list, it will be replaced by
spaces on the first invocation (a further invocation will delete
the spaces), to make it easy to continue a list.

When not after Markdown block markup, this command will return
false, so it is intended to be bound alongside other deletion
commands, with a higher precedence than the more generic commands.
*/
declare const deleteMarkupBackward: StateCommand;

/**
A small keymap with Markdown-specific bindings. Binds Enter to
[`insertNewlineContinueMarkup`](https://codemirror.net/6/docs/ref/#lang-markdown.insertNewlineContinueMarkup)
and Backspace to
[`deleteMarkupBackward`](https://codemirror.net/6/docs/ref/#lang-markdown.deleteMarkupBackward).
*/
declare const markdownKeymap: readonly KeyBinding[];
/**
Markdown language support.
*/
declare function markdown(config?: {
    /**
    When given, this language will be used by default to parse code
    blocks.
    */
    defaultCodeLanguage?: Language | LanguageSupport;
    /**
    A source of language support for highlighting fenced code
    blocks. When it is an array, the parser will use
    [`LanguageDescription.matchLanguageName`](https://codemirror.net/6/docs/ref/#language.LanguageDescription^matchLanguageName)
    with the fenced code info to find a matching language. When it
    is a function, will be called with the info string and may
    return a language or `LanguageDescription` object.
    */
    codeLanguages?: readonly LanguageDescription[] | ((info: string) => Language | LanguageDescription | null);
    /**
    Set this to false to disable installation of the Markdown
    [keymap](https://codemirror.net/6/docs/ref/#lang-markdown.markdownKeymap).
    */
    addKeymap?: boolean;
    /**
    Markdown parser
    [extensions](https://github.com/lezer-parser/markdown#user-content-markdownextension)
    to add to the parser.
    */
    extensions?: MarkdownExtension;
    /**
    The base language to use. Defaults to
    [`commonmarkLanguage`](https://codemirror.net/6/docs/ref/#lang-markdown.commonmarkLanguage).
    */
    base?: Language;
    /**
    By default, the extension installs an autocompletion source that
    completes HTML tags when a `<` is typed. Set this to false to
    disable this.
    */
    completeHTMLTags?: boolean;
    /**
    The returned language contains
    [`pasteURLAsLink`](https://codemirror.net/6/docs/ref/#lang-markdown.pasteURLAsLink) as a support
    extension unless you set this to false.
    */
    pasteURLAsLink?: boolean;
    /**
    By default, HTML tags in the document are handled by the [HTML
    language](https://github.com/codemirror/lang-html) package with
    tag matching turned off. You can pass in an alternative language
    configuration here if you want.
    */
    htmlTagLanguage?: LanguageSupport;
}): LanguageSupport;
/**
An extension that intercepts pastes when the pasted content looks
like a URL and the selection is non-empty and selects regular
text, making the selection a link with the pasted URL as target.
*/
declare const pasteURLAsLink: _codemirror_state.Extension;

export { commonmarkLanguage, deleteMarkupBackward, insertNewlineContinueMarkup, insertNewlineContinueMarkupCommand, markdown, markdownKeymap, markdownLanguage, pasteURLAsLink };
