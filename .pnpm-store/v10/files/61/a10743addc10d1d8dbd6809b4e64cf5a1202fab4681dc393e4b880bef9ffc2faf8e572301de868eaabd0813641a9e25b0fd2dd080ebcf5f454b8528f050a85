import { LRLanguage, LanguageSupport } from '@codemirror/language';
import * as _codemirror_state from '@codemirror/state';
import { EditorState } from '@codemirror/state';
import { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';

/**
Configuration options to
[`liquidCompletionSource`](https://codemirror.net/6/docs/ref/#lang-liquid.liquidCompletionSource).
*/
type LiquidCompletionConfig = {
    /**
    Adds additional completions when completing a Liquid tag.
    */
    tags?: readonly Completion[];
    /**
    Add additional filter completions.
    */
    filters?: readonly Completion[];
    /**
    Add variable completions.
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
Returns a completion source for liquid templates. Optionally takes
a configuration that adds additional custom completions.
*/
declare function liquidCompletionSource(config?: LiquidCompletionConfig): (context: CompletionContext) => CompletionResult | null;
/**
This extension will, when the user types a `%` between two
matching braces, insert two percent signs instead and put the
cursor between them.
*/
declare const closePercentBrace: _codemirror_state.Extension;

/**
A language provider for Liquid templates.
*/
declare const liquidLanguage: LRLanguage;
/**
Liquid template support.
*/
declare function liquid(config?: LiquidCompletionConfig & {
    /**
    Provide an HTML language configuration to use as a base.
    */
    base?: LanguageSupport;
}): LanguageSupport;

export { type LiquidCompletionConfig, closePercentBrace, liquid, liquidCompletionSource, liquidLanguage };
