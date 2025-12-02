import { LRLanguage, LanguageSupport } from '@codemirror/language';
import * as _codemirror_state from '@codemirror/state';
import { EditorState } from '@codemirror/state';
import { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';

/**
Configuration options to
[`jinjaCompletionSource`](https://codemirror.net/6/docs/ref/#lang-jinja.jinjaCompletionSource).
*/
type JinjaCompletionConfig = {
    /**
    Adds additional completions when completing a Jinja tag.
    */
    tags?: readonly Completion[];
    /**
    Add additional global variables.
    */
    variables?: readonly Completion[];
    /**
    Provides completions for properties completed under the given
    path. For example, when completing `user.address.`, `path` will
    be `["user", "address"]`.
    */
    properties?: (path: readonly string[], state: EditorState, context: CompletionContext) => readonly Completion[];
};
/**
Returns a completion source for jinja templates. Optionally takes
a configuration that adds additional custom completions.
*/
declare function jinjaCompletionSource(config?: JinjaCompletionConfig): (context: CompletionContext) => CompletionResult | null;
/**
This extension will, when the user types a `%` between two
matching braces, insert two percent signs instead and put the
cursor between them.
*/
declare const closePercentBrace: _codemirror_state.Extension;

/**
A language provider for Jinja templates.
*/
declare const jinjaLanguage: LRLanguage;
/**
Jinja template support.
*/
declare function jinja(config?: JinjaCompletionConfig & {
    /**
    Provide an HTML language configuration to use as a base.
    */
    base?: LanguageSupport;
}): LanguageSupport;

export { type JinjaCompletionConfig, closePercentBrace, jinja, jinjaCompletionSource, jinjaLanguage };
