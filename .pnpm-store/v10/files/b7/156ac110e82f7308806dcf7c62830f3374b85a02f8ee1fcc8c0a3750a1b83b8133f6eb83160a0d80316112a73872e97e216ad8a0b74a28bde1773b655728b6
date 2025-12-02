/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* global expect, describe, it */

'use strict';

const fs = require('fs');
const path = require('path');

function applyTransform(module, options, input, testOptions = {}) {
  // Handle ES6 modules using default export for the transform
  const transform = module.default ? module.default : module;

  // Jest resets the module registry after each test, so we need to always get
  // a fresh copy of jscodeshift on every test run.
  let jscodeshift = require('./core');
  if (testOptions.parser || module.parser) {
    jscodeshift = jscodeshift.withParser(testOptions.parser || module.parser);
  }

  const output = transform(
    input,
    {
      jscodeshift,
      j: jscodeshift,
      stats: () => {},
    },
    options || {}
  );

  // Support async transforms
  if (output instanceof Promise) {
    return output.then(output => (output || '').trim());
  }

  return (output || '').trim();
}
exports.applyTransform = applyTransform;

function runSnapshotTest(module, options, input) {
  const output = applyTransform(module, options, input);
  if (output instanceof Promise) {
    return output.then(output => {
      expect(output).toMatchSnapshot();
      return output;
    });
  }
  expect(output).toMatchSnapshot();
  return output;
}
exports.runSnapshotTest = runSnapshotTest;

function runInlineTest(module, options, input, expectedOutput, testOptions) {
  const output = applyTransform(module, options, input, testOptions);
  const expectation = (output => expect(output).toEqual(expectedOutput.trim()))
  if (output instanceof Promise) {
    return output.then(output => {
      expectation(output);
      return output;
    });
  }
  expectation(output);
  return output;
}
exports.runInlineTest = runInlineTest;

function extensionForParser(parser) {
  switch (parser) {
    case 'ts':
    case 'tsx':
      return parser;
    default:
      return 'js'
  }
}

/**
 * Utility function to run a jscodeshift script within a unit test. This makes
 * several assumptions about the environment:
 *
 * - `dirName` contains the name of the directory the test is located in. This
 *   should normally be passed via __dirname.
 * - The test should be located in a subdirectory next to the transform itself.
 *   Commonly tests are located in a directory called __tests__.
 * - `transformName` contains the filename of the transform being tested,
 *   excluding the .js extension.
 * - `testFilePrefix` optionally contains the name of the file with the test
 *   data. If not specified, it defaults to the same value as `transformName`.
 *   This will be suffixed with ".input.js" for the input file and ".output.js"
 *   for the expected output. For example, if set to "foo", we will read the
 *   "foo.input.js" file, pass this to the transform, and expect its output to
 *   be equal to the contents of "foo.output.js".
 * - Test data should be located in a directory called __testfixtures__
 *   alongside the transform and __tests__ directory.
 */
function runTest(dirName, transformName, options, testFilePrefix, testOptions = {}) {
  if (!testFilePrefix) {
    testFilePrefix = transformName;
  }

  // Assumes transform is one level up from __tests__ directory
  const module = require(path.join(dirName, '..', transformName));
  const extension = extensionForParser(testOptions.parser || module.parser)
  const fixtureDir = path.join(dirName, '..', '__testfixtures__');
  const inputPath = path.join(fixtureDir, testFilePrefix + `.input.${extension}`);
  const source = fs.readFileSync(inputPath, 'utf8');
  const expectedOutput = fs.readFileSync(
    path.join(fixtureDir, testFilePrefix + `.output.${extension}`),
    'utf8'
  );
  const testResult = runInlineTest(module, options, {
    path: inputPath,
    source
  }, expectedOutput, testOptions);

  return testResult instanceof Promise ? testResult : undefined;
}
exports.runTest = runTest;

/**
 * Handles some boilerplate around defining a simple jest/Jasmine test for a
 * jscodeshift transform.
 */
function defineTest(dirName, transformName, options, testFilePrefix, testOptions) {
  const testName = testFilePrefix
    ? `transforms correctly using "${testFilePrefix}" data`
    : 'transforms correctly';
  describe(transformName, () => {
    it(testName, () => {
      const testResult = runTest(dirName, transformName, options, testFilePrefix, testOptions);
      return testResult instanceof Promise ? testResult : undefined;
    });
  });
}
exports.defineTest = defineTest;

function defineInlineTest(module, options, input, expectedOutput, testName) {
  it(testName || 'transforms correctly', () => {
    const testResult = runInlineTest(module, options, {
      source: input
    }, expectedOutput);
    return testResult instanceof Promise ? testResult : undefined;
  });
}
exports.defineInlineTest = defineInlineTest;

function defineSnapshotTest(module, options, input, testName) {
  it(testName || 'transforms correctly', () => {
    const testResult = runSnapshotTest(module, options, {
      source: input
    });
    return testResult instanceof Promise ? testResult : undefined;
  });
}
exports.defineSnapshotTest = defineSnapshotTest;

/**
 * Handles file-loading boilerplates, using same defaults as defineTest
 */
function defineSnapshotTestFromFixture(dirName, module, options, testFilePrefix, testName, testOptions = {}) {
  const extension = extensionForParser(testOptions.parser || module.parser)
  const fixtureDir = path.join(dirName, '..', '__testfixtures__');
  const inputPath = path.join(fixtureDir, testFilePrefix + `.input.${extension}`);
  const source = fs.readFileSync(inputPath, 'utf8');
  const testResult = defineSnapshotTest(module, options, source, testName)
  return testResult instanceof Promise ? testResult : undefined;
}
exports.defineSnapshotTestFromFixture = defineSnapshotTestFromFixture;
