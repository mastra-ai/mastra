// File mostly copied from https://github.com/epicweb-dev/config/blob/main/eslint.js
import globals from 'globals';

const ERROR = 'error';
const WARN = 'warn';

const has = pkg => {
  try {
    import.meta.resolve(pkg, import.meta.url);
    return true;
  } catch {
    return false;
  }
};

const hasTypeScript = has('typescript');
const hasReact = has('react');
const hasTestingLibrary = has('@testing-library/dom');
const hasVitest = has('vitest');
const vitestFiles = ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'];
const testFiles = ['**/tests/**', '**/#tests/**', ...vitestFiles];
const playwrightFiles = ['**/e2e/**'];

export const createConfig = async () =>
  [
    {
      ignores: [
        '**/.tsup/**',
        '**/.mastra/**',
        '**/.cache/**',
        '**/node_modules/**',
        '**/build/**',
        '**/public/build/**',
        '**/playwright-report/**',
        '**/server-build/**',
        '**/dist/**',
        '**/coverage/**',
      ],
    },

    // all files
    {
      plugins: {
        import: (await import('eslint-plugin-import-x')).default,
      },
      languageOptions: {
        globals: {
          ...globals.browser,
          ...globals.node,
        },
      },
      rules: {
        'no-unexpected-multiline': ERROR,
        'no-warning-comments': [ERROR, { terms: ['FIXME'], location: 'anywhere' }],
        'import/no-duplicates': [WARN, { 'prefer-inline': false }],
        'import/order': [
          WARN,
          {
            alphabetize: { order: 'asc', caseInsensitive: true },
            pathGroups: [{ pattern: '#*/**', group: 'internal' }],
            groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          },
        ],
      },
    },

    // JSX/TSX files
    hasReact
      ? {
        files: ['**/*.tsx', '**/*.jsx'],
        plugins: {
          react: (await import('eslint-plugin-react')).default,
        },
        languageOptions: {
          parser: hasTypeScript ? (await import('typescript-eslint')).parser : undefined,
          parserOptions: {
            jsx: true,
          },
        },
        rules: {
          'react/jsx-key': WARN,
        },
      }
      : null,

    // react-hook rules are applicable in ts/js/tsx/jsx, but only with React as a
    // dep
    hasReact
      ? {
        files: ['**/*.ts?(x)', '**/*.js?(x)'],
        plugins: {
          'react-hooks': (await import('eslint-plugin-react-hooks')).default,
        },
        rules: {
          'react-hooks/rules-of-hooks': ERROR,
          'react-hooks/exhaustive-deps': WARN,
        },
      }
      : null,

    // JS and JSX files
    {
      files: ['**/*.js?(x)'],
      rules: {
        'no-undef': ERROR,

        // most of these rules are useful for JS but not TS because TS handles these better
        // if it weren't for https://github.com/import-js/eslint-plugin-import/issues/2132
        // we could enable this :(
        // 'import/no-unresolved': ERROR,
        'no-unused-vars': [
          WARN,
          {
            "args": "after-used",
            "argsIgnorePattern": "^_",
            "caughtErrors": "all",
            "destructuredArrayIgnorePattern": "^_",
            "varsIgnorePattern": "^_",
            "ignoreRestSiblings": true
          },
        ],
      },
    },

    // TS and TSX files
    hasTypeScript
      ? {
        files: ['**/*.ts?(x)'],
        languageOptions: {
          parser: (await import('typescript-eslint')).parser,
          parserOptions: {
            projectService: true,
          },
        },
        plugins: {
          '@typescript-eslint': (await import('typescript-eslint')).plugin,
        },
        rules: {
          '@typescript-eslint/no-unused-vars': [
            WARN,
            {
              "args": "all",
              "argsIgnorePattern": "^_",
              "caughtErrors": "all",
              "destructuredArrayIgnorePattern": "^_",
              "varsIgnorePattern": "^_",
              "ignoreRestSiblings": true
            },
          ],
          'import/consistent-type-specifier-style': [WARN, 'prefer-top-level'],
          '@typescript-eslint/consistent-type-imports': [
            WARN,
            {
              prefer: 'type-imports',
              disallowTypeAnnotations: true,
              fixStyle: 'separate-type-imports',
            },
          ],

          '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],

          '@typescript-eslint/no-floating-promises': 'error',

          // here are rules we've decided to not enable. Commented out rather
          // than setting them to disabled to avoid them being referenced at all
          // when config resolution happens.

          // @typescript-eslint/require-await - sometimes you really do want
          // async without await to make a function async. TypeScript will ensure
          // it's treated as an async function by consumers and that's enough for me.

          // @typescript-eslint/prefer-promise-reject-errors - sometimes you
          // aren't the one creating the error, and you just want to propagate an
          // error object with an unknown type.

          // @typescript-eslint/only-throw-error - same reason as above.
          // However, this rule supports options to allow you to throw `any` and
          // `unknown`. Unfortunately, in Remix you can throw Response objects,
          // and we don't want to enable this rule for those cases.

          // @typescript-eslint/no-unsafe-declaration-merging - this is a rare
          // enough problem (especially if you focus on types over interfaces)
          // that it's not worth enabling.

          // @typescript-eslint/no-unsafe-enum-comparison - enums are not
          // recommended or used in epic projects, so it's not worth enabling.

          // @typescript-eslint/no-unsafe-unary-minus - this is a rare enough
          // problem that it's not worth enabling.

          // @typescript-eslint/no-base-to-string - this doesn't handle when
          // your object actually does implement toString unless you do so with
          // a class which is not 100% of the time. For example, the timings
          // object in the epic stack uses defineProperty to implement toString.
          // It's not high enough risk/impact to enable.

          // @typescript-eslint/no-non-null-assertion - normally you should not
          // use ! to tell TS to ignore the null case, but you're a responsible
          // adult and if you're going to do that, the linter shouldn't yell at
          // you about it.

          // @typescript-eslint/restrict-template-expressions - toString is a
          // feature of many built-in objects and custom ones. It's not worth
          // enabling.

          // @typescript-eslint/no-confusing-void-expression - what's confusing
          // to one person isn't necessarily confusing to others. Arrow
          // functions that call something that returns void is not confusing
          // and the types will make sure you don't mess something up.

          // these each protect you from `any` and while it's best to avoid
          // using `any`, it's not worth having a lint rule yell at you when you
          // do:
          // - @typescript-eslint/no-unsafe-argument
          // - @typescript-eslint/no-unsafe-call
          // - @typescript-eslint/no-unsafe-member-access
          // - @typescript-eslint/no-unsafe-return
          // - @typescript-eslint/no-unsafe-assignment
        },
      }
      : null,

    // This assumes test files are those which are in the test directory or have
    // *.test.* or *.spec.* in the filename. If a file doesn't match this assumption,
    // then it will not be allowed to import test files.
    {
      files: ['**/*.ts?(x)', '**/*.js?(x)'],
      ignores: testFiles,
      rules: {
        'no-restricted-imports': [
          ERROR,
          {
            patterns: [
              {
                group: testFiles,
                message: 'Do not import test files in source files',
              },
            ],
          },
        ],
      },
    },

    hasTestingLibrary
      ? {
        files: testFiles,
        ignores: [...playwrightFiles],
        plugins: {
          'testing-library': (await import('eslint-plugin-testing-library')).default,
        },
        rules: {
          'testing-library/no-unnecessary-act': [ERROR, { isStrict: false }],
          'testing-library/no-wait-for-side-effects': ERROR,
          'testing-library/prefer-find-by': ERROR,
        },
      }
      : null,

    {
      files: [...testFiles, 'vitest.config.ts'],
      ignores: [...playwrightFiles],
      ...(await import('typescript-eslint')).configs.disableTypeChecked,
    },

    hasVitest
      ? {
        files: testFiles,
        ignores: [...playwrightFiles],
        plugins: {
          vitest: (await import('@vitest/eslint-plugin')).default,
        },
        rules: {
          // you don't want the editor to autofix this, but we do want to be
          // made aware of it
          'vitest/no-focused-tests': [WARN, { fixable: false }],
        },
      }
      : null,
  ].filter(Boolean);
