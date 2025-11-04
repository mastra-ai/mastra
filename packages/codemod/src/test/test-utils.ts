/* eslint-disable no-console */
// Adjusted from https://github.com/vercel/ai/blob/main/packages/codemod/src/test/test-utils.ts
// License: Apache-2.0

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { API, FileInfo } from 'jscodeshift';
import jscodeshift from 'jscodeshift';
import ts from 'typescript';
import { expect } from 'vitest';

/**
 * Applies a codemod transform to the input code.
 *
 * @param transform - The codemod transform function.
 * @param input - The input source code.
 * @param options - Optional transform options.
 * @returns The transformed code or the original input if no changes were made.
 */
export function applyTransform(
  transform: (fileInfo: FileInfo, api: API, options: any) => string | null,
  input: string,
  options = {},
): string {
  const fileInfo = {
    path: 'test.tsx', // Use .tsx to support both .ts and .tsx
    source: input,
  };
  const j = jscodeshift.withParser('tsx');
  const api: API = {
    j,
    jscodeshift: j,
    stats: () => {},
    report: console.log,
  };
  // A null result indicates no changes were made.
  const result = transform(fileInfo, api, options);
  return result === null ? input : result;
}

/**
 * Reads a fixture file from the __fixtures__ directory.
 *
 * @param name - The base name of the fixture.
 * @param type - The type of fixture ('input' or 'output').
 * @returns An object containing the fixture's content and its file extension.
 * @throws If the fixture file is not found.
 */
export function readFixture(name: string, type: 'input' | 'output'): { content: string; extension: string } {
  const basePath = join(__dirname, '__fixtures__', `${name}.${type}`);
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];

  for (const ext of extensions) {
    const fullPath = `${basePath}${ext}`;
    if (existsSync(fullPath)) {
      return { content: readFileSync(fullPath, 'utf8'), extension: ext };
    }
  }
  throw new Error(`Fixture not found: ${name}.${type} with extensions ${extensions.join(', ')}`);
}

/**
 * Validates the syntax of the provided code using TypeScript's compiler.
 *
 * @param code - The source code to validate.
 * @param extension - The file extension to determine ScriptKind.
 * @throws If the code contains syntax errors.
 */
export function validateSyntax(code: string, extension: string): void {
  // Add JSX namespace definition only for tsx files
  const jsxTypes = `
    declare namespace JSX {
      interface IntrinsicElements {
        [elemName: string]: any;
      }
    }
  `;

  // Add JSX types only for tsx files
  const codeWithTypes = extension === '.tsx' ? jsxTypes + code : code;

  // Determine the appropriate script kind based on file extension
  let scriptKind: ts.ScriptKind;
  switch (extension) {
    case '.tsx':
      scriptKind = ts.ScriptKind.TSX;
      break;
    case '.jsx':
      scriptKind = ts.ScriptKind.JSX;
      break;
    case '.ts':
      scriptKind = ts.ScriptKind.TS;
      break;
    case '.js':
    default:
      scriptKind = ts.ScriptKind.JS;
  }

  const fileName = `test${extension}`;

  // Create a source file
  const sourceFile = ts.createSourceFile(fileName, codeWithTypes, ts.ScriptTarget.Latest, true, scriptKind);

  // Create compiler options
  const compilerOptions: ts.CompilerOptions = {
    allowJs: true,
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    esModuleInterop: true,
    strict: true,
    noImplicitAny: false,
    skipLibCheck: true,
    jsxFactory: 'React.createElement',
    jsxFragmentFactory: 'React.Fragment',
    baseUrl: '.',
    paths: {
      '*': ['*'],
    },
    // Disable type checking for JS/JSX files
    checkJs: extension !== '.js' && extension !== '.jsx',
    allowSyntheticDefaultImports: true,
    // Ignore missing libraries
    noResolve: true,
  };

  // Create a program with the source file
  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (name: string, ...args) => {
    if (name === fileName) {
      return sourceFile;
    }
    return originalGetSourceFile.call(host, name, ...args);
  };

  // Override module resolution
  host.resolveModuleNameLiterals = moduleLiterals => {
    return moduleLiterals.map(moduleLiteral => ({
      resolvedModule: {
        resolvedFileName: `${moduleLiteral.text}.d.ts`,
        extension: '.d.ts',
        isExternalLibraryImport: true,
        packageId: {
          name: moduleLiteral.text,
          subModuleName: '',
          version: '1.0.0',
        },
      },
    }));
  };

  const program = ts.createProgram([fileName], compilerOptions, host);

  // Get only syntactic diagnostics for JS/JSX files
  const diagnostics =
    extension === '.js' || extension === '.jsx'
      ? program.getSyntacticDiagnostics(sourceFile)
      : [...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile)];

  // Filter out module resolution errors
  const relevantDiagnostics = diagnostics.filter(diagnostic => {
    // Ignore "Cannot find module" errors
    if (diagnostic.code === 2307) {
      // TypeScript error code for module not found
      return false;
    }
    return true;
  });

  // If there are any errors, throw with details
  if (relevantDiagnostics.length > 0) {
    const errors = relevantDiagnostics
      .map(diagnostic => {
        if (diagnostic.file) {
          const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
          return `${line + 1}:${character + 1} - ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`;
        }
        return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      })
      .join('\n');

    throw new Error(`Syntax error in code with extension ${extension}:\n${errors}`);
  }
}

/**
 * Tests a codemod transform by applying it to input fixtures and comparing the output to expected fixtures.
 * Additionally, validates that both input and output fixtures have valid syntax.
 *
 * @param transformer - The codemod transformer function.
 * @param fixtureName - The base name of the fixture to test.
 */
export function testTransform(
  transformer: (fileInfo: FileInfo, api: API, options: any) => string | null,
  fixtureName: string,
) {
  // Read input and output fixtures along with their extensions
  const { content: input, extension: inputExt } = readFixture(fixtureName, 'input');
  const { content: expectedOutput, extension: outputExt } = readFixture(fixtureName, 'output');

  // Validate that input code is syntactically correct
  validateSyntax(input, inputExt);

  // Validate that expected output is syntactically correct
  validateSyntax(expectedOutput, outputExt);

  // Apply the transformer to the input code
  const actualOutput = applyTransform(transformer, input);

  // Validate that output code is syntactically correct
  validateSyntax(actualOutput, outputExt);

  if (process.env.UPDATE_SNAPSHOT) {
    // Update the expected output fixture if the environment variable is set
    const outputPath = join(__dirname, '__fixtures__', `${fixtureName}.output${outputExt}`);
    writeFileSync(outputPath, actualOutput, 'utf8');
  } else {
    // Compare actual output to expected output
    expect(actualOutput).toBe(expectedOutput);
  }
}
