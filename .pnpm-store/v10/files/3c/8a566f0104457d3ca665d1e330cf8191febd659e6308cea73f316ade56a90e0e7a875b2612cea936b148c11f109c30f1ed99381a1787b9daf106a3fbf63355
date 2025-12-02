import { T as Test, S as Suite, a as SuiteHooks, F as File, b as TaskUpdateEvent, c as Task, d as TestAPI, e as SuiteAPI, f as SuiteCollector } from './hooks.d-C0RE9A6t.js';
export { A as AfterAllListener, l as AfterEachListener, B as BeforeAllListener, m as BeforeEachListener, n as Fixture, p as FixtureFn, q as FixtureOptions, r as Fixtures, I as ImportDuration, s as InferFixturesTypes, O as OnTestFailedHandler, t as OnTestFinishedHandler, R as RunMode, u as RuntimeContext, v as SequenceHooks, w as SequenceSetupFiles, x as SuiteFactory, y as TaskBase, z as TaskCustomOptions, C as TaskEventPack, D as TaskHook, E as TaskMeta, G as TaskPopulated, H as TaskResult, J as TaskResultPack, K as TaskState, L as TestAnnotation, M as TestAnnotationLocation, N as TestAttachment, P as TestContext, Q as TestFunction, U as TestOptions, V as Use, g as afterAll, h as afterEach, i as beforeAll, j as beforeEach, o as onTestFailed, k as onTestFinished } from './hooks.d-C0RE9A6t.js';
import { Awaitable } from '@vitest/utils';
import { FileSpecification, VitestRunner } from './types.js';
export { CancelReason, VitestRunnerConfig, VitestRunnerConstructor, VitestRunnerImportSource } from './types.js';
import '@vitest/utils/diff';

declare function setFn(key: Test, fn: () => Awaitable<void>): void;
declare function getFn<Task = Test>(key: Task): () => Awaitable<void>;
declare function setHooks(key: Suite, hooks: SuiteHooks): void;
declare function getHooks(key: Suite): SuiteHooks;

declare function updateTask(event: TaskUpdateEvent, task: Task, runner: VitestRunner): void;
declare function startTests(specs: string[] | FileSpecification[], runner: VitestRunner): Promise<File[]>;
declare function publicCollect(specs: string[] | FileSpecification[], runner: VitestRunner): Promise<File[]>;

/**
* Creates a suite of tests, allowing for grouping and hierarchical organization of tests.
* Suites can contain both tests and other suites, enabling complex test structures.
*
* @param {string} name - The name of the suite, used for identification and reporting.
* @param {Function} fn - A function that defines the tests and suites within this suite.
* @example
* ```ts
* // Define a suite with two tests
* suite('Math operations', () => {
*   test('should add two numbers', () => {
*     expect(add(1, 2)).toBe(3);
*   });
*
*   test('should subtract two numbers', () => {
*     expect(subtract(5, 2)).toBe(3);
*   });
* });
* ```
* @example
* ```ts
* // Define nested suites
* suite('String operations', () => {
*   suite('Trimming', () => {
*     test('should trim whitespace from start and end', () => {
*       expect('  hello  '.trim()).toBe('hello');
*     });
*   });
*
*   suite('Concatenation', () => {
*     test('should concatenate two strings', () => {
*       expect('hello' + ' ' + 'world').toBe('hello world');
*     });
*   });
* });
* ```
*/
declare const suite: SuiteAPI;
/**
* Defines a test case with a given name and test function. The test function can optionally be configured with test options.
*
* @param {string | Function} name - The name of the test or a function that will be used as a test name.
* @param {TestOptions | TestFunction} [optionsOrFn] - Optional. The test options or the test function if no explicit name is provided.
* @param {number | TestOptions | TestFunction} [optionsOrTest] - Optional. The test function or options, depending on the previous parameters.
* @throws {Error} If called inside another test function.
* @example
* ```ts
* // Define a simple test
* test('should add two numbers', () => {
*   expect(add(1, 2)).toBe(3);
* });
* ```
* @example
* ```ts
* // Define a test with options
* test('should subtract two numbers', { retry: 3 }, () => {
*   expect(subtract(5, 2)).toBe(3);
* });
* ```
*/
declare const test: TestAPI;
/**
* Creates a suite of tests, allowing for grouping and hierarchical organization of tests.
* Suites can contain both tests and other suites, enabling complex test structures.
*
* @param {string} name - The name of the suite, used for identification and reporting.
* @param {Function} fn - A function that defines the tests and suites within this suite.
* @example
* ```ts
* // Define a suite with two tests
* describe('Math operations', () => {
*   test('should add two numbers', () => {
*     expect(add(1, 2)).toBe(3);
*   });
*
*   test('should subtract two numbers', () => {
*     expect(subtract(5, 2)).toBe(3);
*   });
* });
* ```
* @example
* ```ts
* // Define nested suites
* describe('String operations', () => {
*   describe('Trimming', () => {
*     test('should trim whitespace from start and end', () => {
*       expect('  hello  '.trim()).toBe('hello');
*     });
*   });
*
*   describe('Concatenation', () => {
*     test('should concatenate two strings', () => {
*       expect('hello' + ' ' + 'world').toBe('hello world');
*     });
*   });
* });
* ```
*/
declare const describe: SuiteAPI;
/**
* Defines a test case with a given name and test function. The test function can optionally be configured with test options.
*
* @param {string | Function} name - The name of the test or a function that will be used as a test name.
* @param {TestOptions | TestFunction} [optionsOrFn] - Optional. The test options or the test function if no explicit name is provided.
* @param {number | TestOptions | TestFunction} [optionsOrTest] - Optional. The test function or options, depending on the previous parameters.
* @throws {Error} If called inside another test function.
* @example
* ```ts
* // Define a simple test
* it('adds two numbers', () => {
*   expect(add(1, 2)).toBe(3);
* });
* ```
* @example
* ```ts
* // Define a test with options
* it('subtracts two numbers', { retry: 3 }, () => {
*   expect(subtract(5, 2)).toBe(3);
* });
* ```
*/
declare const it: TestAPI;
declare function getCurrentSuite<ExtraContext = object>(): SuiteCollector<ExtraContext>;
declare function createTaskCollector(fn: (...args: any[]) => any, context?: Record<string, unknown>): TestAPI;

declare function getCurrentTest<T extends Test | undefined>(): T;

export { File, FileSpecification, Suite, SuiteAPI, SuiteCollector, SuiteHooks, Task, TaskUpdateEvent, Test, TestAPI, VitestRunner, publicCollect as collectTests, createTaskCollector, describe, getCurrentSuite, getCurrentTest, getFn, getHooks, it, setFn, setHooks, startTests, suite, test, updateTask };
