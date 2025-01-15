import { BaseTestCase } from './base';

// Enum for test case parameters
export enum LLMTestCaseParams {
  INPUT = 'input',
  ACTUAL_OUTPUT = 'actualOutput',
  EXPECTED_OUTPUT = 'expectedOutput',
  CONTEXT = 'context',
  RETRIEVAL_CONTEXT = 'retrievalContext',
  TOOLS_CALLED = 'toolsCalled',
  EXPECTED_TOOLS = 'expectedTools',
  REASONING = 'reasoning',
}

// Interface for constructor parameters
export interface LLMTestCaseInit {
  input: string;
  actualOutput: string;
  expectedOutput?: string;
  context?: string[];
  retrievalContext?: string[];
  additionalMetadata?: Record<string, any>;
  comments?: string;
  toolsCalled?: string[];
  expectedTools?: string[];
  reasoning?: string;
  name?: string;
}

export class LLMTestCase extends BaseTestCase {
  input: string;
  actualOutput: string;
  expectedOutput?: string;
  context?: string[];
  retrievalContext?: string[];
  additionalMetadata?: Record<string, any>;
  comments?: string;
  toolsCalled?: string[];
  expectedTools?: string[];
  reasoning?: string;
  name?: string;

  constructor({
    input,
    actualOutput,
    expectedOutput,
    context,
    retrievalContext,
    additionalMetadata,
    comments,
    toolsCalled,
    expectedTools,
    reasoning,
    name,
  }: LLMTestCaseInit) {
    super();
    this.input = input;
    this.actualOutput = actualOutput;
    this.expectedOutput = expectedOutput;
    this.additionalMetadata = additionalMetadata;
    this.comments = comments;
    this.reasoning = reasoning;
    this.name = name;

    // Validate and set context
    if (context !== undefined) {
      this.validateStringArray(context, 'context');
      this.context = [...context];
    }

    // Validate and set retrieval context
    if (retrievalContext !== undefined) {
      this.validateStringArray(retrievalContext, 'retrievalContext');
      this.retrievalContext = [...retrievalContext];
    }

    // Validate and set tools called
    if (toolsCalled !== undefined) {
      this.validateStringArray(toolsCalled, 'toolsCalled');
      this.toolsCalled = [...toolsCalled];
    }

    // Validate and set expected tools
    if (expectedTools !== undefined) {
      this.validateStringArray(expectedTools, 'expectedTools');
      this.expectedTools = [...expectedTools];
    }
  }

  private validateStringArray(arr: any[], fieldName: string): void {
    if (!Array.isArray(arr) || !arr.every(item => typeof item === 'string')) {
      throw new TypeError(`'${fieldName}' must be an array of strings`);
    }
  }
}
