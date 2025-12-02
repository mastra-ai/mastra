import {StreamParser} from "@codemirror/language"
export interface Rule {
  regex?: string | RegExp | undefined;
  token?: string | string[] | null | undefined | ((matches: RegExpMatchArray) => string | string[] | null);
  sol?: boolean | undefined;
  next?: string | undefined;
  push?: string | undefined;
  pop?: boolean | undefined;
  indent?: boolean | undefined;
  dedent?: boolean | undefined;
  dedentIfLineStart?: boolean | undefined;
}
export declare function simpleMode<K extends string>(
  states: { [P in K]: P extends "languageData" ? {[name: string]: any} : Rule[] } & { start: Rule[] }): StreamParser<unknown>
