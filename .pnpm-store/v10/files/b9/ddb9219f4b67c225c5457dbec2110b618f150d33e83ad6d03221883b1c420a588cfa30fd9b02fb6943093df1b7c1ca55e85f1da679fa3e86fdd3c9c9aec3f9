/** The JSON object to register dynamic languages */
interface LangRegistration {
  /** the path to the dynamic library */
  libraryPath: string
  /** the file extensions of the language. e.g. mojo */
  extensions: string[]
  /** the dylib symbol to load ts-language, default is `tree_sitter_{name}` */
  languageSymbol?: string
  /** the meta variable leading character, default is $ */
  metaVarChar?: string
  /**
   * An optional char to replace $ in your pattern.
   * See https://ast-grep.github.io/advanced/custom-language.html#register-language-in-sgconfig-yml
   */
  expandoChar?: string
}

/** A map of language names to their registration information */
export interface DynamicLangRegistrations {
  [langName: string]: LangRegistration
}

/**
 * @experimental
 * Register dynamic languages. This function should be called exactly once in the program.
 */
export declare function registerDynamicLanguage(langs: DynamicLangRegistrations): void