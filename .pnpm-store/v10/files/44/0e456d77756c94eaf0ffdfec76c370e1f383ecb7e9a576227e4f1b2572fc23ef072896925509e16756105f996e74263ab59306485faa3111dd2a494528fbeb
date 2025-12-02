import * as _typescript_eslint_utils_ts_eslint0 from "@typescript-eslint/utils/ts-eslint";

//#region src/utils/index.d.ts
interface PluginDocs {
  recommended?: boolean;
  requiresTypeChecking?: boolean;
}
//#endregion
//#region src/rules/prefer-lowercase-title.d.ts
type MessageIds$3 = 'lowerCaseTitle' | 'fullyLowerCaseTitle';
//#endregion
//#region src/rules/max-nested-describe.d.ts
type Options$4 = [{
  max: number;
}];
//#endregion
//#region src/rules/no-identical-title.d.ts
type MESSAGE_ID$2 = 'multipleTestTitle' | 'multipleDescribeTitle';
//#endregion
//#region src/rules/no-focused-tests.d.ts
type Options$3 = [Partial<{
  fixable: boolean;
}>];
//#endregion
//#region src/utils/types.d.ts
declare enum UtilName {
  vi = "vi",
  vitest = "vitest",
}
declare enum TestCaseName {
  fit = "fit",
  it = "it",
  test = "test",
  xit = "xit",
  xtest = "xtest",
  bench = "bench",
}
declare enum HookName {
  beforeAll = "beforeAll",
  beforeEach = "beforeEach",
  afterAll = "afterAll",
  afterEach = "afterEach",
}
//#endregion
//#region src/rules/consistent-test-it.d.ts
type MessageIds$2 = 'consistentMethod' | 'consistentMethodWithinDescribe';
//#endregion
//#region src/rules/no-restricted-vi-methods.d.ts
type MESSAGE_ID$1 = 'restrictedViMethod' | 'restrictedViMethodWithMessage';
type Options$2 = [Record<string, string | null>];
//#endregion
//#region src/rules/max-expects.d.ts
type Options$1 = [{
  max: number;
}];
//#endregion
//#region src/rules/no-disabled-tests.d.ts
type MESSAGE_ID = 'missingFunction' | 'pending' | 'pendingSuite' | 'pendingTest' | 'disabledSuite' | 'disabledTest';
//#endregion
//#region src/rules/no-done-callback.d.ts
type MessageIds$1 = 'noDoneCallback' | 'suggestWrappingInPromise' | 'useAwaitInsteadOfCallback';
//#endregion
//#region src/rules/valid-expect.d.ts
type MESSAGE_IDS$2 = 'tooManyArgs' | 'notEnoughArgs' | 'modifierUnknown' | 'matcherNotFound' | 'matcherNotCalled' | 'asyncMustBeAwaited' | 'promisesWithAsyncAssertionsMustBeAwaited';
//#endregion
//#region src/rules/prefer-strict-equal.d.ts
type MESSAGE_IDS$1 = 'useToStrictEqual' | 'suggestReplaceWithStrictEqual';
//#endregion
//#region src/rules/no-importing-vitest-globals.d.ts
type MESSAGE_IDS = 'noImportingVitestGlobals' | 'noRequiringVitestGlobals';
//#endregion
//#region src/index.d.ts
declare const plugin: {
  readonly meta: {
    readonly name: "vitest";
    readonly version: string;
  };
  readonly rules: {
    readonly "prefer-lowercase-title": _typescript_eslint_utils_ts_eslint0.RuleModule<MessageIds$3, [Partial<{
      ignore: string[];
      allowedPrefixes: string[];
      ignoreTopLevelDescribe: boolean;
      lowercaseFirstCharacterOnly: boolean;
    }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "max-nested-describe": _typescript_eslint_utils_ts_eslint0.RuleModule<"maxNestedDescribe", Options$4, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-identical-title": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_ID$2, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-focused-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<"noFocusedTests", Options$3, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-conditional-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalTests", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "expect-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<"noAssertions", [{
      assertFunctionNames: string[];
      additionalTestBlockFunctions: string[];
    }], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "hoisted-apis-on-top": _typescript_eslint_utils_ts_eslint0.RuleModule<"hoistedApisOnTop" | "suggestMoveHoistedApiToTop" | "suggestReplaceMockWithDoMock", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "consistent-test-it": _typescript_eslint_utils_ts_eslint0.RuleModule<MessageIds$2, [Partial<{
      fn: TestCaseName.it | TestCaseName.test;
      withinDescribe: TestCaseName.it | TestCaseName.test;
    }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "consistent-vitest-vi": _typescript_eslint_utils_ts_eslint0.RuleModule<"consistentUtil", [Partial<{
      fn: UtilName;
    }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-to-be": _typescript_eslint_utils_ts_eslint0.RuleModule<"useToBe" | "useToBeUndefined" | "useToBeDefined" | "useToBeNull" | "useToBeNaN", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-hooks": _typescript_eslint_utils_ts_eslint0.RuleModule<"unexpectedHook", [Partial<{
      allow: readonly HookName[];
    }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-restricted-vi-methods": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_ID$1, Options$2, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "consistent-test-filename": _typescript_eslint_utils_ts_eslint0.RuleModule<"consistentTestFilename", [Partial<{
      pattern: RegExp | string;
      allTestPattern: RegExp | string;
    }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "max-expects": _typescript_eslint_utils_ts_eslint0.RuleModule<"maxExpect", Options$1, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-alias-methods": _typescript_eslint_utils_ts_eslint0.RuleModule<"noAliasMethods", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-commented-out-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<"noCommentedOutTests", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-conditional-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalExpect", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-conditional-in-test": _typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalInTest", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-disabled-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_ID, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-done-callback": _typescript_eslint_utils_ts_eslint0.RuleModule<MessageIds$1, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-duplicate-hooks": _typescript_eslint_utils_ts_eslint0.RuleModule<"noDuplicateHooks", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-large-snapshots": _typescript_eslint_utils_ts_eslint0.RuleModule<"noSnapShot" | "tooLongSnapShot", [{
      maxSize?: number;
      inlineMaxSize?: number;
      allowedSnapshots?: Record<string, Array<string | RegExp>>;
    }], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-interpolation-in-snapshots": _typescript_eslint_utils_ts_eslint0.RuleModule<"noInterpolationInSnapshots", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-mocks-import": _typescript_eslint_utils_ts_eslint0.RuleModule<"noMocksImport", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-restricted-matchers": _typescript_eslint_utils_ts_eslint0.RuleModule<"restrictedChain" | "restrictedChainWithMessage", Record<string, string | null>[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-standalone-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<"noStandaloneExpect", {
      additionalTestBlockFunctions?: string[];
    }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-test-prefixes": _typescript_eslint_utils_ts_eslint0.RuleModule<"usePreferredName", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-test-return-statement": _typescript_eslint_utils_ts_eslint0.RuleModule<"noTestReturnStatement", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-import-node-test": _typescript_eslint_utils_ts_eslint0.RuleModule<"noImportNodeTest", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-called-with": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledWith", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "valid-title": _typescript_eslint_utils_ts_eslint0.RuleModule<"titleMustBeString" | "emptyTitle" | "duplicatePrefix" | "accidentalSpace" | "disallowedWord" | "mustNotMatch" | "mustMatch" | "mustNotMatchCustom" | "mustMatchCustom", {
      ignoreTypeOfDescribeName?: boolean;
      allowArguments?: boolean;
      disallowedWords?: string[];
      mustNotMatch?: Partial<Record<"test" | "describe" | "it", string | [matcher: string, message?: string | undefined]>> | [matcher: string, message?: string | undefined] | string;
      mustMatch?: Partial<Record<"test" | "describe" | "it", string | [matcher: string, message?: string | undefined]>> | [matcher: string, message?: string | undefined] | string;
    }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "valid-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_IDS$2, [Partial<{
      alwaysAwait: boolean;
      asyncMatchers: string[];
      minArgs: number;
      maxArgs: number;
    }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-to-be-falsy": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeFalsy", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-to-be-object": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeObject", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-to-be-truthy": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeTruthy", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-to-have-length": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToHaveLength", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-equality-matcher": _typescript_eslint_utils_ts_eslint0.RuleModule<"useEqualityMatcher" | "suggestEqualityMatcher", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-strict-equal": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_IDS$1, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-expect-resolves": _typescript_eslint_utils_ts_eslint0.RuleModule<"expectResolves", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-each": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferEach", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-hooks-on-top": _typescript_eslint_utils_ts_eslint0.RuleModule<"noHookOnTop", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-hooks-in-order": _typescript_eslint_utils_ts_eslint0.RuleModule<"reorderHooks", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "require-local-test-context-for-concurrent-snapshots": _typescript_eslint_utils_ts_eslint0.RuleModule<"requireLocalTestContext", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-mock-promise-shorthand": _typescript_eslint_utils_ts_eslint0.RuleModule<"useMockShorthand", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-vi-mocked": _typescript_eslint_utils_ts_eslint0.RuleModule<"useViMocked", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-snapshot-hint": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingHint", [("always" | "multi" | undefined)?], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "valid-describe-callback": _typescript_eslint_utils_ts_eslint0.RuleModule<"nameAndCallback" | "secondArgumentMustBeFunction" | "unexpectedDescribeArgument" | "unexpectedReturnInDescribe", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "require-top-level-describe": _typescript_eslint_utils_ts_eslint0.RuleModule<"unexpectedHook" | "tooManyDescribes" | "unexpectedTestCase", [Partial<{
      maxNumberOfTopLevelDescribes: number;
    }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "require-to-throw-message": _typescript_eslint_utils_ts_eslint0.RuleModule<"addErrorMessage", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "require-hook": _typescript_eslint_utils_ts_eslint0.RuleModule<"useHook", [{
      allowedFunctionCalls?: readonly string[];
    }], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-todo": _typescript_eslint_utils_ts_eslint0.RuleModule<"emptyTest" | "unimplementedTest", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-spy-on": _typescript_eslint_utils_ts_eslint0.RuleModule<"useViSpayOn", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-comparison-matcher": _typescript_eslint_utils_ts_eslint0.RuleModule<"useToBeComparison", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-describe-function-title": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferFunction", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-to-contain": _typescript_eslint_utils_ts_eslint0.RuleModule<"useToContain", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-expect-assertions": _typescript_eslint_utils_ts_eslint0.RuleModule<"hasAssertionsTakesNoArguments" | "assertionsRequiresOneArgument" | "assertionsRequiresNumberArgument" | "haveExpectAssertions" | "suggestAddingHasAssertions" | "suggestAddingAssertions" | "suggestRemovingExtraArguments", {
      onlyFunctionsWithAsyncKeyword?: boolean;
      onlyFunctionsWithExpectInLoop?: boolean;
      onlyFunctionsWithExpectInCallback?: boolean;
    }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "padding-around-after-all-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "padding-around-after-each-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "padding-around-all": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "padding-around-before-all-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "padding-around-before-each-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "padding-around-describe-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "padding-around-expect-groups": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "padding-around-test-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "valid-expect-in-promise": _typescript_eslint_utils_ts_eslint0.RuleModule<"expectInFloatingPromise", [Partial<{
      alwaysAwait: boolean;
      asyncMatchers: string[];
      minArgs: number;
      maxArgs: number;
    }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-strict-boolean-matchers": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeTrue" | "preferToBeFalse", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "require-mock-type-parameters": _typescript_eslint_utils_ts_eslint0.RuleModule<"noTypeParameter", {
      checkImportFunctions?: boolean;
    }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "no-importing-vitest-globals": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_IDS, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-importing-vitest-globals": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferImportingVitestGlobals", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-called-once": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledOnce", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-called-times": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledTimes", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-expect-type-of": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferExpectTypeOf", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "warn-todo": _typescript_eslint_utils_ts_eslint0.RuleModule<"warnTodo", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-import-in-mock": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferImport", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
    readonly "prefer-called-exactly-once-with": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledExactlyOnceWith", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
  };
  readonly environments: {
    readonly env: {
      readonly globals: {
        readonly suite: true;
        readonly test: true;
        readonly describe: true;
        readonly it: true;
        readonly expectTypeOf: true;
        readonly assertType: true;
        readonly expect: true;
        readonly assert: true;
        readonly chai: true;
        readonly vitest: true;
        readonly vi: true;
        readonly beforeAll: true;
        readonly afterAll: true;
        readonly beforeEach: true;
        readonly afterEach: true;
        readonly onTestFailed: true;
        readonly onTestFinished: true;
      };
    };
  };
  readonly configs: {
    readonly 'legacy-recommended': {
      plugins: string[];
      rules: {};
    };
    readonly 'legacy-all': {
      plugins: string[];
      rules: {};
    };
    readonly recommended: {
      readonly name: "vitest/recommended";
      readonly plugins: {
        readonly vitest: {
          readonly meta: {
            readonly name: "vitest";
            readonly version: string;
          };
          readonly rules: {
            readonly "prefer-lowercase-title": _typescript_eslint_utils_ts_eslint0.RuleModule<MessageIds$3, [Partial<{
              ignore: string[];
              allowedPrefixes: string[];
              ignoreTopLevelDescribe: boolean;
              lowercaseFirstCharacterOnly: boolean;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "max-nested-describe": _typescript_eslint_utils_ts_eslint0.RuleModule<"maxNestedDescribe", Options$4, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-identical-title": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_ID$2, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-focused-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<"noFocusedTests", Options$3, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-conditional-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalTests", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "expect-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<"noAssertions", [{
              assertFunctionNames: string[];
              additionalTestBlockFunctions: string[];
            }], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "hoisted-apis-on-top": _typescript_eslint_utils_ts_eslint0.RuleModule<"hoistedApisOnTop" | "suggestMoveHoistedApiToTop" | "suggestReplaceMockWithDoMock", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "consistent-test-it": _typescript_eslint_utils_ts_eslint0.RuleModule<MessageIds$2, [Partial<{
              fn: TestCaseName.it | TestCaseName.test;
              withinDescribe: TestCaseName.it | TestCaseName.test;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "consistent-vitest-vi": _typescript_eslint_utils_ts_eslint0.RuleModule<"consistentUtil", [Partial<{
              fn: UtilName;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-be": _typescript_eslint_utils_ts_eslint0.RuleModule<"useToBe" | "useToBeUndefined" | "useToBeDefined" | "useToBeNull" | "useToBeNaN", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-hooks": _typescript_eslint_utils_ts_eslint0.RuleModule<"unexpectedHook", [Partial<{
              allow: readonly HookName[];
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-restricted-vi-methods": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_ID$1, Options$2, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "consistent-test-filename": _typescript_eslint_utils_ts_eslint0.RuleModule<"consistentTestFilename", [Partial<{
              pattern: RegExp | string;
              allTestPattern: RegExp | string;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "max-expects": _typescript_eslint_utils_ts_eslint0.RuleModule<"maxExpect", Options$1, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-alias-methods": _typescript_eslint_utils_ts_eslint0.RuleModule<"noAliasMethods", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-commented-out-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<"noCommentedOutTests", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-conditional-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalExpect", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-conditional-in-test": _typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalInTest", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-disabled-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_ID, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-done-callback": _typescript_eslint_utils_ts_eslint0.RuleModule<MessageIds$1, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-duplicate-hooks": _typescript_eslint_utils_ts_eslint0.RuleModule<"noDuplicateHooks", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-large-snapshots": _typescript_eslint_utils_ts_eslint0.RuleModule<"noSnapShot" | "tooLongSnapShot", [{
              maxSize?: number;
              inlineMaxSize?: number;
              allowedSnapshots?: Record<string, Array<string | RegExp>>;
            }], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-interpolation-in-snapshots": _typescript_eslint_utils_ts_eslint0.RuleModule<"noInterpolationInSnapshots", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-mocks-import": _typescript_eslint_utils_ts_eslint0.RuleModule<"noMocksImport", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-restricted-matchers": _typescript_eslint_utils_ts_eslint0.RuleModule<"restrictedChain" | "restrictedChainWithMessage", Record<string, string | null>[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-standalone-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<"noStandaloneExpect", {
              additionalTestBlockFunctions?: string[];
            }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-test-prefixes": _typescript_eslint_utils_ts_eslint0.RuleModule<"usePreferredName", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-test-return-statement": _typescript_eslint_utils_ts_eslint0.RuleModule<"noTestReturnStatement", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-import-node-test": _typescript_eslint_utils_ts_eslint0.RuleModule<"noImportNodeTest", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-called-with": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledWith", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "valid-title": _typescript_eslint_utils_ts_eslint0.RuleModule<"titleMustBeString" | "emptyTitle" | "duplicatePrefix" | "accidentalSpace" | "disallowedWord" | "mustNotMatch" | "mustMatch" | "mustNotMatchCustom" | "mustMatchCustom", {
              ignoreTypeOfDescribeName?: boolean;
              allowArguments?: boolean;
              disallowedWords?: string[];
              mustNotMatch?: Partial<Record<"test" | "describe" | "it", string | [matcher: string, message?: string | undefined]>> | [matcher: string, message?: string | undefined] | string;
              mustMatch?: Partial<Record<"test" | "describe" | "it", string | [matcher: string, message?: string | undefined]>> | [matcher: string, message?: string | undefined] | string;
            }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "valid-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_IDS$2, [Partial<{
              alwaysAwait: boolean;
              asyncMatchers: string[];
              minArgs: number;
              maxArgs: number;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-be-falsy": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeFalsy", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-be-object": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeObject", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-be-truthy": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeTruthy", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-have-length": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToHaveLength", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-equality-matcher": _typescript_eslint_utils_ts_eslint0.RuleModule<"useEqualityMatcher" | "suggestEqualityMatcher", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-strict-equal": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_IDS$1, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-expect-resolves": _typescript_eslint_utils_ts_eslint0.RuleModule<"expectResolves", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-each": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferEach", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-hooks-on-top": _typescript_eslint_utils_ts_eslint0.RuleModule<"noHookOnTop", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-hooks-in-order": _typescript_eslint_utils_ts_eslint0.RuleModule<"reorderHooks", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "require-local-test-context-for-concurrent-snapshots": _typescript_eslint_utils_ts_eslint0.RuleModule<"requireLocalTestContext", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-mock-promise-shorthand": _typescript_eslint_utils_ts_eslint0.RuleModule<"useMockShorthand", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-vi-mocked": _typescript_eslint_utils_ts_eslint0.RuleModule<"useViMocked", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-snapshot-hint": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingHint", [("always" | "multi" | undefined)?], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "valid-describe-callback": _typescript_eslint_utils_ts_eslint0.RuleModule<"nameAndCallback" | "secondArgumentMustBeFunction" | "unexpectedDescribeArgument" | "unexpectedReturnInDescribe", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "require-top-level-describe": _typescript_eslint_utils_ts_eslint0.RuleModule<"unexpectedHook" | "tooManyDescribes" | "unexpectedTestCase", [Partial<{
              maxNumberOfTopLevelDescribes: number;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "require-to-throw-message": _typescript_eslint_utils_ts_eslint0.RuleModule<"addErrorMessage", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "require-hook": _typescript_eslint_utils_ts_eslint0.RuleModule<"useHook", [{
              allowedFunctionCalls?: readonly string[];
            }], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-todo": _typescript_eslint_utils_ts_eslint0.RuleModule<"emptyTest" | "unimplementedTest", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-spy-on": _typescript_eslint_utils_ts_eslint0.RuleModule<"useViSpayOn", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-comparison-matcher": _typescript_eslint_utils_ts_eslint0.RuleModule<"useToBeComparison", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-describe-function-title": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferFunction", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-contain": _typescript_eslint_utils_ts_eslint0.RuleModule<"useToContain", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-expect-assertions": _typescript_eslint_utils_ts_eslint0.RuleModule<"hasAssertionsTakesNoArguments" | "assertionsRequiresOneArgument" | "assertionsRequiresNumberArgument" | "haveExpectAssertions" | "suggestAddingHasAssertions" | "suggestAddingAssertions" | "suggestRemovingExtraArguments", {
              onlyFunctionsWithAsyncKeyword?: boolean;
              onlyFunctionsWithExpectInLoop?: boolean;
              onlyFunctionsWithExpectInCallback?: boolean;
            }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-after-all-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-after-each-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-all": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-before-all-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-before-each-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-describe-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-expect-groups": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-test-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "valid-expect-in-promise": _typescript_eslint_utils_ts_eslint0.RuleModule<"expectInFloatingPromise", [Partial<{
              alwaysAwait: boolean;
              asyncMatchers: string[];
              minArgs: number;
              maxArgs: number;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-strict-boolean-matchers": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeTrue" | "preferToBeFalse", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "require-mock-type-parameters": _typescript_eslint_utils_ts_eslint0.RuleModule<"noTypeParameter", {
              checkImportFunctions?: boolean;
            }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-importing-vitest-globals": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_IDS, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-importing-vitest-globals": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferImportingVitestGlobals", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-called-once": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledOnce", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-called-times": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledTimes", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-expect-type-of": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferExpectTypeOf", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "warn-todo": _typescript_eslint_utils_ts_eslint0.RuleModule<"warnTodo", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-import-in-mock": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferImport", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-called-exactly-once-with": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledExactlyOnceWith", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
          };
          readonly environments: {
            readonly env: {
              readonly globals: {
                readonly suite: true;
                readonly test: true;
                readonly describe: true;
                readonly it: true;
                readonly expectTypeOf: true;
                readonly assertType: true;
                readonly expect: true;
                readonly assert: true;
                readonly chai: true;
                readonly vitest: true;
                readonly vi: true;
                readonly beforeAll: true;
                readonly afterAll: true;
                readonly beforeEach: true;
                readonly afterEach: true;
                readonly onTestFailed: true;
                readonly onTestFinished: true;
              };
            };
          };
          readonly configs: {
            readonly 'legacy-recommended': {
              plugins: string[];
              rules: {};
            };
            readonly 'legacy-all': {
              plugins: string[];
              rules: {};
            };
            readonly recommended: {
              readonly name: "vitest/recommended";
              readonly plugins: {
                readonly vitest: /*elided*/any;
              };
              readonly rules: {
                readonly "vitest/expect-expect": "error";
                readonly "vitest/no-identical-title": "error";
                readonly "vitest/no-commented-out-tests": "error";
                readonly "vitest/valid-title": "error";
                readonly "vitest/valid-expect": "error";
                readonly "vitest/valid-describe-callback": "error";
                readonly "vitest/require-local-test-context-for-concurrent-snapshots": "error";
                readonly "vitest/no-import-node-test": "error";
                readonly "vitest/prefer-called-exactly-once-with": "error";
              };
            };
            readonly all: {
              readonly name: "vitest/all";
              readonly plugins: {
                readonly vitest: /*elided*/any;
              };
              readonly rules: {
                readonly "vitest/prefer-lowercase-title": "warn";
                readonly "vitest/max-nested-describe": "warn";
                readonly "vitest/no-focused-tests": "warn";
                readonly "vitest/no-conditional-tests": "warn";
                readonly "vitest/consistent-test-it": "warn";
                readonly "vitest/consistent-vitest-vi": "warn";
                readonly "vitest/no-hooks": "warn";
                readonly "vitest/no-restricted-vi-methods": "warn";
                readonly "vitest/consistent-test-filename": "warn";
                readonly "vitest/max-expects": "warn";
                readonly "vitest/no-alias-methods": "warn";
                readonly "vitest/no-conditional-expect": "warn";
                readonly "vitest/no-conditional-in-test": "warn";
                readonly "vitest/no-disabled-tests": "warn";
                readonly "vitest/no-done-callback": "warn";
                readonly "vitest/no-duplicate-hooks": "warn";
                readonly "vitest/no-large-snapshots": "warn";
                readonly "vitest/no-interpolation-in-snapshots": "warn";
                readonly "vitest/no-mocks-import": "warn";
                readonly "vitest/no-restricted-matchers": "warn";
                readonly "vitest/no-standalone-expect": "warn";
                readonly "vitest/no-test-prefixes": "warn";
                readonly "vitest/no-test-return-statement": "warn";
                readonly "vitest/prefer-called-with": "warn";
                readonly "vitest/prefer-to-be-falsy": "off";
                readonly "vitest/prefer-to-be-object": "warn";
                readonly "vitest/prefer-to-be-truthy": "off";
                readonly "vitest/prefer-to-have-length": "warn";
                readonly "vitest/prefer-equality-matcher": "warn";
                readonly "vitest/prefer-strict-equal": "warn";
                readonly "vitest/prefer-expect-resolves": "warn";
                readonly "vitest/prefer-each": "warn";
                readonly "vitest/prefer-hooks-on-top": "warn";
                readonly "vitest/prefer-hooks-in-order": "warn";
                readonly "vitest/prefer-mock-promise-shorthand": "warn";
                readonly "vitest/prefer-vi-mocked": "warn";
                readonly "vitest/prefer-snapshot-hint": "warn";
                readonly "vitest/require-top-level-describe": "warn";
                readonly "vitest/require-to-throw-message": "warn";
                readonly "vitest/require-hook": "warn";
                readonly "vitest/prefer-todo": "warn";
                readonly "vitest/prefer-spy-on": "warn";
                readonly "vitest/prefer-comparison-matcher": "warn";
                readonly "vitest/prefer-describe-function-title": "warn";
                readonly "vitest/prefer-to-contain": "warn";
                readonly "vitest/prefer-expect-assertions": "warn";
                readonly "vitest/prefer-to-be": "warn";
                readonly "vitest/padding-around-after-all-blocks": "warn";
                readonly "vitest/padding-around-after-each-blocks": "warn";
                readonly "vitest/padding-around-all": "warn";
                readonly "vitest/padding-around-before-all-blocks": "warn";
                readonly "vitest/padding-around-before-each-blocks": "warn";
                readonly "vitest/padding-around-describe-blocks": "warn";
                readonly "vitest/padding-around-expect-groups": "warn";
                readonly "vitest/padding-around-test-blocks": "warn";
                readonly "vitest/valid-expect-in-promise": "warn";
                readonly "vitest/expect-expect": "warn";
                readonly "vitest/no-identical-title": "warn";
                readonly "vitest/no-commented-out-tests": "warn";
                readonly "vitest/valid-title": "warn";
                readonly "vitest/valid-expect": "warn";
                readonly "vitest/valid-describe-callback": "warn";
                readonly "vitest/require-local-test-context-for-concurrent-snapshots": "warn";
                readonly "vitest/no-import-node-test": "warn";
                readonly "vitest/prefer-strict-boolean-matchers": "warn";
                readonly "vitest/require-mock-type-parameters": "warn";
                readonly "vitest/no-importing-vitest-globals": "off";
                readonly "vitest/prefer-importing-vitest-globals": "warn";
                readonly "vitest/prefer-called-once": "off";
                readonly "vitest/prefer-called-times": "warn";
                readonly "vitest/prefer-expect-type-of": "warn";
                readonly "vitest/hoisted-apis-on-top": "warn";
                readonly "vitest/prefer-import-in-mock": "warn";
                readonly "vitest/prefer-called-exactly-once-with": "warn";
              };
            };
            readonly env: {
              readonly name: "vitest/env";
              readonly languageOptions: {
                readonly globals: {
                  readonly suite: "writable";
                  readonly test: "writable";
                  readonly describe: "writable";
                  readonly it: "writable";
                  readonly expectTypeOf: "writable";
                  readonly assertType: "writable";
                  readonly expect: "writable";
                  readonly assert: "writable";
                  readonly chai: "writable";
                  readonly vitest: "writable";
                  readonly vi: "writable";
                  readonly beforeAll: "writable";
                  readonly afterAll: "writable";
                  readonly beforeEach: "writable";
                  readonly afterEach: "writable";
                  readonly onTestFailed: "writable";
                  readonly onTestFinished: "writable";
                };
              };
            };
          };
        };
      };
      readonly rules: {
        readonly "vitest/expect-expect": "error";
        readonly "vitest/no-identical-title": "error";
        readonly "vitest/no-commented-out-tests": "error";
        readonly "vitest/valid-title": "error";
        readonly "vitest/valid-expect": "error";
        readonly "vitest/valid-describe-callback": "error";
        readonly "vitest/require-local-test-context-for-concurrent-snapshots": "error";
        readonly "vitest/no-import-node-test": "error";
        readonly "vitest/prefer-called-exactly-once-with": "error";
      };
    };
    readonly all: {
      readonly name: "vitest/all";
      readonly plugins: {
        readonly vitest: {
          readonly meta: {
            readonly name: "vitest";
            readonly version: string;
          };
          readonly rules: {
            readonly "prefer-lowercase-title": _typescript_eslint_utils_ts_eslint0.RuleModule<MessageIds$3, [Partial<{
              ignore: string[];
              allowedPrefixes: string[];
              ignoreTopLevelDescribe: boolean;
              lowercaseFirstCharacterOnly: boolean;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "max-nested-describe": _typescript_eslint_utils_ts_eslint0.RuleModule<"maxNestedDescribe", Options$4, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-identical-title": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_ID$2, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-focused-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<"noFocusedTests", Options$3, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-conditional-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalTests", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "expect-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<"noAssertions", [{
              assertFunctionNames: string[];
              additionalTestBlockFunctions: string[];
            }], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "hoisted-apis-on-top": _typescript_eslint_utils_ts_eslint0.RuleModule<"hoistedApisOnTop" | "suggestMoveHoistedApiToTop" | "suggestReplaceMockWithDoMock", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "consistent-test-it": _typescript_eslint_utils_ts_eslint0.RuleModule<MessageIds$2, [Partial<{
              fn: TestCaseName.it | TestCaseName.test;
              withinDescribe: TestCaseName.it | TestCaseName.test;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "consistent-vitest-vi": _typescript_eslint_utils_ts_eslint0.RuleModule<"consistentUtil", [Partial<{
              fn: UtilName;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-be": _typescript_eslint_utils_ts_eslint0.RuleModule<"useToBe" | "useToBeUndefined" | "useToBeDefined" | "useToBeNull" | "useToBeNaN", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-hooks": _typescript_eslint_utils_ts_eslint0.RuleModule<"unexpectedHook", [Partial<{
              allow: readonly HookName[];
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-restricted-vi-methods": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_ID$1, Options$2, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "consistent-test-filename": _typescript_eslint_utils_ts_eslint0.RuleModule<"consistentTestFilename", [Partial<{
              pattern: RegExp | string;
              allTestPattern: RegExp | string;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "max-expects": _typescript_eslint_utils_ts_eslint0.RuleModule<"maxExpect", Options$1, PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-alias-methods": _typescript_eslint_utils_ts_eslint0.RuleModule<"noAliasMethods", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-commented-out-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<"noCommentedOutTests", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-conditional-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalExpect", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-conditional-in-test": _typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalInTest", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-disabled-tests": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_ID, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-done-callback": _typescript_eslint_utils_ts_eslint0.RuleModule<MessageIds$1, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-duplicate-hooks": _typescript_eslint_utils_ts_eslint0.RuleModule<"noDuplicateHooks", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-large-snapshots": _typescript_eslint_utils_ts_eslint0.RuleModule<"noSnapShot" | "tooLongSnapShot", [{
              maxSize?: number;
              inlineMaxSize?: number;
              allowedSnapshots?: Record<string, Array<string | RegExp>>;
            }], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-interpolation-in-snapshots": _typescript_eslint_utils_ts_eslint0.RuleModule<"noInterpolationInSnapshots", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-mocks-import": _typescript_eslint_utils_ts_eslint0.RuleModule<"noMocksImport", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-restricted-matchers": _typescript_eslint_utils_ts_eslint0.RuleModule<"restrictedChain" | "restrictedChainWithMessage", Record<string, string | null>[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-standalone-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<"noStandaloneExpect", {
              additionalTestBlockFunctions?: string[];
            }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-test-prefixes": _typescript_eslint_utils_ts_eslint0.RuleModule<"usePreferredName", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-test-return-statement": _typescript_eslint_utils_ts_eslint0.RuleModule<"noTestReturnStatement", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-import-node-test": _typescript_eslint_utils_ts_eslint0.RuleModule<"noImportNodeTest", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-called-with": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledWith", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "valid-title": _typescript_eslint_utils_ts_eslint0.RuleModule<"titleMustBeString" | "emptyTitle" | "duplicatePrefix" | "accidentalSpace" | "disallowedWord" | "mustNotMatch" | "mustMatch" | "mustNotMatchCustom" | "mustMatchCustom", {
              ignoreTypeOfDescribeName?: boolean;
              allowArguments?: boolean;
              disallowedWords?: string[];
              mustNotMatch?: Partial<Record<"test" | "describe" | "it", string | [matcher: string, message?: string | undefined]>> | [matcher: string, message?: string | undefined] | string;
              mustMatch?: Partial<Record<"test" | "describe" | "it", string | [matcher: string, message?: string | undefined]>> | [matcher: string, message?: string | undefined] | string;
            }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "valid-expect": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_IDS$2, [Partial<{
              alwaysAwait: boolean;
              asyncMatchers: string[];
              minArgs: number;
              maxArgs: number;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-be-falsy": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeFalsy", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-be-object": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeObject", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-be-truthy": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeTruthy", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-have-length": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToHaveLength", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-equality-matcher": _typescript_eslint_utils_ts_eslint0.RuleModule<"useEqualityMatcher" | "suggestEqualityMatcher", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-strict-equal": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_IDS$1, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-expect-resolves": _typescript_eslint_utils_ts_eslint0.RuleModule<"expectResolves", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-each": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferEach", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-hooks-on-top": _typescript_eslint_utils_ts_eslint0.RuleModule<"noHookOnTop", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-hooks-in-order": _typescript_eslint_utils_ts_eslint0.RuleModule<"reorderHooks", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "require-local-test-context-for-concurrent-snapshots": _typescript_eslint_utils_ts_eslint0.RuleModule<"requireLocalTestContext", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-mock-promise-shorthand": _typescript_eslint_utils_ts_eslint0.RuleModule<"useMockShorthand", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-vi-mocked": _typescript_eslint_utils_ts_eslint0.RuleModule<"useViMocked", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-snapshot-hint": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingHint", [("always" | "multi" | undefined)?], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "valid-describe-callback": _typescript_eslint_utils_ts_eslint0.RuleModule<"nameAndCallback" | "secondArgumentMustBeFunction" | "unexpectedDescribeArgument" | "unexpectedReturnInDescribe", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "require-top-level-describe": _typescript_eslint_utils_ts_eslint0.RuleModule<"unexpectedHook" | "tooManyDescribes" | "unexpectedTestCase", [Partial<{
              maxNumberOfTopLevelDescribes: number;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "require-to-throw-message": _typescript_eslint_utils_ts_eslint0.RuleModule<"addErrorMessage", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "require-hook": _typescript_eslint_utils_ts_eslint0.RuleModule<"useHook", [{
              allowedFunctionCalls?: readonly string[];
            }], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-todo": _typescript_eslint_utils_ts_eslint0.RuleModule<"emptyTest" | "unimplementedTest", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-spy-on": _typescript_eslint_utils_ts_eslint0.RuleModule<"useViSpayOn", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-comparison-matcher": _typescript_eslint_utils_ts_eslint0.RuleModule<"useToBeComparison", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-describe-function-title": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferFunction", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-to-contain": _typescript_eslint_utils_ts_eslint0.RuleModule<"useToContain", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-expect-assertions": _typescript_eslint_utils_ts_eslint0.RuleModule<"hasAssertionsTakesNoArguments" | "assertionsRequiresOneArgument" | "assertionsRequiresNumberArgument" | "haveExpectAssertions" | "suggestAddingHasAssertions" | "suggestAddingAssertions" | "suggestRemovingExtraArguments", {
              onlyFunctionsWithAsyncKeyword?: boolean;
              onlyFunctionsWithExpectInLoop?: boolean;
              onlyFunctionsWithExpectInCallback?: boolean;
            }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-after-all-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-after-each-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-all": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-before-all-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-before-each-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-describe-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-expect-groups": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "padding-around-test-blocks": _typescript_eslint_utils_ts_eslint0.RuleModule<"missingPadding", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "valid-expect-in-promise": _typescript_eslint_utils_ts_eslint0.RuleModule<"expectInFloatingPromise", [Partial<{
              alwaysAwait: boolean;
              asyncMatchers: string[];
              minArgs: number;
              maxArgs: number;
            }>], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-strict-boolean-matchers": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferToBeTrue" | "preferToBeFalse", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "require-mock-type-parameters": _typescript_eslint_utils_ts_eslint0.RuleModule<"noTypeParameter", {
              checkImportFunctions?: boolean;
            }[], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "no-importing-vitest-globals": _typescript_eslint_utils_ts_eslint0.RuleModule<MESSAGE_IDS, [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-importing-vitest-globals": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferImportingVitestGlobals", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-called-once": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledOnce", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-called-times": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledTimes", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-expect-type-of": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferExpectTypeOf", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "warn-todo": _typescript_eslint_utils_ts_eslint0.RuleModule<"warnTodo", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-import-in-mock": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferImport", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
            readonly "prefer-called-exactly-once-with": _typescript_eslint_utils_ts_eslint0.RuleModule<"preferCalledExactlyOnceWith", [], PluginDocs, _typescript_eslint_utils_ts_eslint0.RuleListener>;
          };
          readonly environments: {
            readonly env: {
              readonly globals: {
                readonly suite: true;
                readonly test: true;
                readonly describe: true;
                readonly it: true;
                readonly expectTypeOf: true;
                readonly assertType: true;
                readonly expect: true;
                readonly assert: true;
                readonly chai: true;
                readonly vitest: true;
                readonly vi: true;
                readonly beforeAll: true;
                readonly afterAll: true;
                readonly beforeEach: true;
                readonly afterEach: true;
                readonly onTestFailed: true;
                readonly onTestFinished: true;
              };
            };
          };
          readonly configs: {
            readonly 'legacy-recommended': {
              plugins: string[];
              rules: {};
            };
            readonly 'legacy-all': {
              plugins: string[];
              rules: {};
            };
            readonly recommended: {
              readonly name: "vitest/recommended";
              readonly plugins: {
                readonly vitest: /*elided*/any;
              };
              readonly rules: {
                readonly "vitest/expect-expect": "error";
                readonly "vitest/no-identical-title": "error";
                readonly "vitest/no-commented-out-tests": "error";
                readonly "vitest/valid-title": "error";
                readonly "vitest/valid-expect": "error";
                readonly "vitest/valid-describe-callback": "error";
                readonly "vitest/require-local-test-context-for-concurrent-snapshots": "error";
                readonly "vitest/no-import-node-test": "error";
                readonly "vitest/prefer-called-exactly-once-with": "error";
              };
            };
            readonly all: {
              readonly name: "vitest/all";
              readonly plugins: {
                readonly vitest: /*elided*/any;
              };
              readonly rules: {
                readonly "vitest/prefer-lowercase-title": "warn";
                readonly "vitest/max-nested-describe": "warn";
                readonly "vitest/no-focused-tests": "warn";
                readonly "vitest/no-conditional-tests": "warn";
                readonly "vitest/consistent-test-it": "warn";
                readonly "vitest/consistent-vitest-vi": "warn";
                readonly "vitest/no-hooks": "warn";
                readonly "vitest/no-restricted-vi-methods": "warn";
                readonly "vitest/consistent-test-filename": "warn";
                readonly "vitest/max-expects": "warn";
                readonly "vitest/no-alias-methods": "warn";
                readonly "vitest/no-conditional-expect": "warn";
                readonly "vitest/no-conditional-in-test": "warn";
                readonly "vitest/no-disabled-tests": "warn";
                readonly "vitest/no-done-callback": "warn";
                readonly "vitest/no-duplicate-hooks": "warn";
                readonly "vitest/no-large-snapshots": "warn";
                readonly "vitest/no-interpolation-in-snapshots": "warn";
                readonly "vitest/no-mocks-import": "warn";
                readonly "vitest/no-restricted-matchers": "warn";
                readonly "vitest/no-standalone-expect": "warn";
                readonly "vitest/no-test-prefixes": "warn";
                readonly "vitest/no-test-return-statement": "warn";
                readonly "vitest/prefer-called-with": "warn";
                readonly "vitest/prefer-to-be-falsy": "off";
                readonly "vitest/prefer-to-be-object": "warn";
                readonly "vitest/prefer-to-be-truthy": "off";
                readonly "vitest/prefer-to-have-length": "warn";
                readonly "vitest/prefer-equality-matcher": "warn";
                readonly "vitest/prefer-strict-equal": "warn";
                readonly "vitest/prefer-expect-resolves": "warn";
                readonly "vitest/prefer-each": "warn";
                readonly "vitest/prefer-hooks-on-top": "warn";
                readonly "vitest/prefer-hooks-in-order": "warn";
                readonly "vitest/prefer-mock-promise-shorthand": "warn";
                readonly "vitest/prefer-vi-mocked": "warn";
                readonly "vitest/prefer-snapshot-hint": "warn";
                readonly "vitest/require-top-level-describe": "warn";
                readonly "vitest/require-to-throw-message": "warn";
                readonly "vitest/require-hook": "warn";
                readonly "vitest/prefer-todo": "warn";
                readonly "vitest/prefer-spy-on": "warn";
                readonly "vitest/prefer-comparison-matcher": "warn";
                readonly "vitest/prefer-describe-function-title": "warn";
                readonly "vitest/prefer-to-contain": "warn";
                readonly "vitest/prefer-expect-assertions": "warn";
                readonly "vitest/prefer-to-be": "warn";
                readonly "vitest/padding-around-after-all-blocks": "warn";
                readonly "vitest/padding-around-after-each-blocks": "warn";
                readonly "vitest/padding-around-all": "warn";
                readonly "vitest/padding-around-before-all-blocks": "warn";
                readonly "vitest/padding-around-before-each-blocks": "warn";
                readonly "vitest/padding-around-describe-blocks": "warn";
                readonly "vitest/padding-around-expect-groups": "warn";
                readonly "vitest/padding-around-test-blocks": "warn";
                readonly "vitest/valid-expect-in-promise": "warn";
                readonly "vitest/expect-expect": "warn";
                readonly "vitest/no-identical-title": "warn";
                readonly "vitest/no-commented-out-tests": "warn";
                readonly "vitest/valid-title": "warn";
                readonly "vitest/valid-expect": "warn";
                readonly "vitest/valid-describe-callback": "warn";
                readonly "vitest/require-local-test-context-for-concurrent-snapshots": "warn";
                readonly "vitest/no-import-node-test": "warn";
                readonly "vitest/prefer-strict-boolean-matchers": "warn";
                readonly "vitest/require-mock-type-parameters": "warn";
                readonly "vitest/no-importing-vitest-globals": "off";
                readonly "vitest/prefer-importing-vitest-globals": "warn";
                readonly "vitest/prefer-called-once": "off";
                readonly "vitest/prefer-called-times": "warn";
                readonly "vitest/prefer-expect-type-of": "warn";
                readonly "vitest/hoisted-apis-on-top": "warn";
                readonly "vitest/prefer-import-in-mock": "warn";
                readonly "vitest/prefer-called-exactly-once-with": "warn";
              };
            };
            readonly env: {
              readonly name: "vitest/env";
              readonly languageOptions: {
                readonly globals: {
                  readonly suite: "writable";
                  readonly test: "writable";
                  readonly describe: "writable";
                  readonly it: "writable";
                  readonly expectTypeOf: "writable";
                  readonly assertType: "writable";
                  readonly expect: "writable";
                  readonly assert: "writable";
                  readonly chai: "writable";
                  readonly vitest: "writable";
                  readonly vi: "writable";
                  readonly beforeAll: "writable";
                  readonly afterAll: "writable";
                  readonly beforeEach: "writable";
                  readonly afterEach: "writable";
                  readonly onTestFailed: "writable";
                  readonly onTestFinished: "writable";
                };
              };
            };
          };
        };
      };
      readonly rules: {
        readonly "vitest/prefer-lowercase-title": "warn";
        readonly "vitest/max-nested-describe": "warn";
        readonly "vitest/no-focused-tests": "warn";
        readonly "vitest/no-conditional-tests": "warn";
        readonly "vitest/consistent-test-it": "warn";
        readonly "vitest/consistent-vitest-vi": "warn";
        readonly "vitest/no-hooks": "warn";
        readonly "vitest/no-restricted-vi-methods": "warn";
        readonly "vitest/consistent-test-filename": "warn";
        readonly "vitest/max-expects": "warn";
        readonly "vitest/no-alias-methods": "warn";
        readonly "vitest/no-conditional-expect": "warn";
        readonly "vitest/no-conditional-in-test": "warn";
        readonly "vitest/no-disabled-tests": "warn";
        readonly "vitest/no-done-callback": "warn";
        readonly "vitest/no-duplicate-hooks": "warn";
        readonly "vitest/no-large-snapshots": "warn";
        readonly "vitest/no-interpolation-in-snapshots": "warn";
        readonly "vitest/no-mocks-import": "warn";
        readonly "vitest/no-restricted-matchers": "warn";
        readonly "vitest/no-standalone-expect": "warn";
        readonly "vitest/no-test-prefixes": "warn";
        readonly "vitest/no-test-return-statement": "warn";
        readonly "vitest/prefer-called-with": "warn";
        readonly "vitest/prefer-to-be-falsy": "off";
        readonly "vitest/prefer-to-be-object": "warn";
        readonly "vitest/prefer-to-be-truthy": "off";
        readonly "vitest/prefer-to-have-length": "warn";
        readonly "vitest/prefer-equality-matcher": "warn";
        readonly "vitest/prefer-strict-equal": "warn";
        readonly "vitest/prefer-expect-resolves": "warn";
        readonly "vitest/prefer-each": "warn";
        readonly "vitest/prefer-hooks-on-top": "warn";
        readonly "vitest/prefer-hooks-in-order": "warn";
        readonly "vitest/prefer-mock-promise-shorthand": "warn";
        readonly "vitest/prefer-vi-mocked": "warn";
        readonly "vitest/prefer-snapshot-hint": "warn";
        readonly "vitest/require-top-level-describe": "warn";
        readonly "vitest/require-to-throw-message": "warn";
        readonly "vitest/require-hook": "warn";
        readonly "vitest/prefer-todo": "warn";
        readonly "vitest/prefer-spy-on": "warn";
        readonly "vitest/prefer-comparison-matcher": "warn";
        readonly "vitest/prefer-describe-function-title": "warn";
        readonly "vitest/prefer-to-contain": "warn";
        readonly "vitest/prefer-expect-assertions": "warn";
        readonly "vitest/prefer-to-be": "warn";
        readonly "vitest/padding-around-after-all-blocks": "warn";
        readonly "vitest/padding-around-after-each-blocks": "warn";
        readonly "vitest/padding-around-all": "warn";
        readonly "vitest/padding-around-before-all-blocks": "warn";
        readonly "vitest/padding-around-before-each-blocks": "warn";
        readonly "vitest/padding-around-describe-blocks": "warn";
        readonly "vitest/padding-around-expect-groups": "warn";
        readonly "vitest/padding-around-test-blocks": "warn";
        readonly "vitest/valid-expect-in-promise": "warn";
        readonly "vitest/expect-expect": "warn";
        readonly "vitest/no-identical-title": "warn";
        readonly "vitest/no-commented-out-tests": "warn";
        readonly "vitest/valid-title": "warn";
        readonly "vitest/valid-expect": "warn";
        readonly "vitest/valid-describe-callback": "warn";
        readonly "vitest/require-local-test-context-for-concurrent-snapshots": "warn";
        readonly "vitest/no-import-node-test": "warn";
        readonly "vitest/prefer-strict-boolean-matchers": "warn";
        readonly "vitest/require-mock-type-parameters": "warn";
        readonly "vitest/no-importing-vitest-globals": "off";
        readonly "vitest/prefer-importing-vitest-globals": "warn";
        readonly "vitest/prefer-called-once": "off";
        readonly "vitest/prefer-called-times": "warn";
        readonly "vitest/prefer-expect-type-of": "warn";
        readonly "vitest/hoisted-apis-on-top": "warn";
        readonly "vitest/prefer-import-in-mock": "warn";
        readonly "vitest/prefer-called-exactly-once-with": "warn";
      };
    };
    readonly env: {
      readonly name: "vitest/env";
      readonly languageOptions: {
        readonly globals: {
          readonly suite: "writable";
          readonly test: "writable";
          readonly describe: "writable";
          readonly it: "writable";
          readonly expectTypeOf: "writable";
          readonly assertType: "writable";
          readonly expect: "writable";
          readonly assert: "writable";
          readonly chai: "writable";
          readonly vitest: "writable";
          readonly vi: "writable";
          readonly beforeAll: "writable";
          readonly afterAll: "writable";
          readonly beforeEach: "writable";
          readonly afterEach: "writable";
          readonly onTestFailed: "writable";
          readonly onTestFinished: "writable";
        };
      };
    };
  };
};
export = plugin;