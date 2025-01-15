import { existsSync } from 'fs';
import { URL } from 'url';

import { BaseTestCase } from './base';

// Enum for test case parameters
export enum MLLMTestCaseParams {
  INPUT = 'input',
  ACTUAL_OUTPUT = 'actualOutput',
  EXPECTED_OUTPUT = 'expectedOutput',
  CONTEXT = 'context',
  RETRIEVAL_CONTEXT = 'retrievalContext',
}

export class MLLMImage {
  url: string;
  local: boolean;

  constructor(url: string, local?: boolean) {
    this.url = url;
    this.local = local ?? MLLMImage.isLocalPath(url);
  }

  private static isLocalPath(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'file:' && existsSync(parsedUrl.pathname);
    } catch {
      // If URL parsing fails, check if it's a direct file path
      return existsSync(url);
    }
  }
}

// Type for content that can be either string or MLLMImage
export type MLLMContent = string | MLLMImage;

// Interface for constructor parameters
export interface MLLMTestCaseInit {
  input: MLLMContent[];
  actualOutput: MLLMContent[];
  expectedOutput?: MLLMContent[];
  context?: MLLMContent[];
  retrievalContext?: MLLMContent[];
  additionalMetadata?: Record<string, any>;
  comments?: string;
  name?: string;
}

export class MLLMTestCase extends BaseTestCase {
  input: MLLMContent[];
  actualOutput: MLLMContent[];
  expectedOutput?: MLLMContent[];
  context?: MLLMContent[];
  retrievalContext?: MLLMContent[];
  additionalMetadata?: Record<string, any>;
  comments?: string;
  name?: string;

  constructor({
    input,
    actualOutput,
    expectedOutput,
    context,
    retrievalContext,
    additionalMetadata,
    comments,
    name,
  }: MLLMTestCaseInit) {
    super();
    this.validateMLLMContentArray(input, 'input');
    this.validateMLLMContentArray(actualOutput, 'actualOutput');

    this.input = [...input];
    this.actualOutput = [...actualOutput];
    this.additionalMetadata = additionalMetadata;
    this.comments = comments;
    this.name = name;

    // Validate and set optional arrays
    if (expectedOutput !== undefined) {
      this.validateMLLMContentArray(expectedOutput, 'expectedOutput');
      this.expectedOutput = [...expectedOutput];
    }

    if (context !== undefined) {
      this.validateMLLMContentArray(context, 'context');
      this.context = [...context];
    }

    if (retrievalContext !== undefined) {
      this.validateMLLMContentArray(retrievalContext, 'retrievalContext');
      this.retrievalContext = [...retrievalContext];
    }
  }

  private validateMLLMContentArray(arr: any[], fieldName: string): void {
    if (!Array.isArray(arr)) {
      throw new TypeError(`'${fieldName}' must be an array`);
    }

    if (!arr.every(item => typeof item === 'string' || item instanceof MLLMImage)) {
      throw new TypeError(`'${fieldName}' must contain only strings or MLLMImage instances`);
    }
  }
}
