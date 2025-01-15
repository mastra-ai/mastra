import { MissingTestCaseParamsError } from '../errors';
import {
  LLMTestCase,
  LLMTestCaseParams,
  MLLMTestCase,
  MLLMTestCaseParams,
  ConversationalTestCase,
  MLLMImage,
} from '../test-case';

import { BaseMetric, BaseConversationalMetric } from './base-metric';

export function formatTurns(
  llmTestCases: LLMTestCase[],
  testCaseParams: LLMTestCaseParams[],
): Record<string, string | string[]>[] {
  return llmTestCases.map(testCase => {
    const result: Record<string, string | string[]> = {};
    for (const param of testCaseParams) {
      const value = testCase[param];
      if (value) {
        result[param] = value;
      }
    }
    return result;
  });
}

export function processLLMTestCasesWindows(
  llmTestCasesWindows: LLMTestCase[][],
  testCaseParams: LLMTestCaseParams[],
): Record<string, string | string[]>[][] {
  return llmTestCasesWindows.map(window =>
    window.map(testCase => {
      const dict: Record<string, string | string[]> = {};
      for (const param of testCaseParams) {
        const value = testCase[param];
        if (value) {
          dict[param] = value;
        }
      }
      return dict;
    }),
  );
}

export function* getTurnsInSlidingWindow(turns: LLMTestCase[], windowSize: number): Generator<LLMTestCase[]> {
  for (let i = 0; i < turns.length; i++) {
    yield turns.slice(Math.max(0, i - windowSize + 1), i + 1);
  }
}

export function constructVerboseLogs(metric: BaseMetric, steps: string[]): string {
  let verboseLogs = '';

  for (let i = 0; i < steps.length - 1; i++) {
    verboseLogs += steps[i];
    if (i < steps.length - 2) {
      verboseLogs += ' \n \n';
    }
  }

  if (metric.verboseMode) {
    printVerboseLogs(metric.name, verboseLogs + `\n \n${steps[steps.length - 1]}`);
  }

  return verboseLogs;
}

export function checkConversationalTestCaseParams(
  testCase: ConversationalTestCase,
  testCaseParams: LLMTestCaseParams[],
  metric: BaseConversationalMetric,
  requireChatbotRole: boolean = false,
): void {
  if (!(testCase instanceof ConversationalTestCase)) {
    const errorStr = `Unable to evaluate test cases that are not of type 'ConversationalTestCase' using the conversational '${metric.name}' metric.`;
    metric.error = errorStr;
    throw new Error(errorStr);
  }

  if (requireChatbotRole && !testCase.chatbotRole) {
    const errorStr = `'chatbotRole' in a conversational test case cannot be empty for the '${metric.name}' metric.`;
    metric.error = errorStr;
    throw new MissingTestCaseParamsError(errorStr);
  }

  if (testCase.turns.length === 0) {
    const errorStr = "'turns' in conversational test case cannot be empty.";
    metric.error = errorStr;
    throw new MissingTestCaseParamsError(errorStr);
  }

  for (const turn of testCase.turns) {
    const missingParams: string[] = [];
    for (const param of testCaseParams) {
      if (!turn[param]) {
        missingParams.push(`'${param}'`);
      }
    }

    if (missingParams.length) {
      let missingParamsStr: string;
      if (missingParams.length === 1) {
        missingParamsStr = missingParams[0] as string;
      } else if (missingParams.length === 2) {
        missingParamsStr = missingParams.join(' and ');
      } else {
        missingParamsStr = `${missingParams.slice(0, -1).join(', ')}, and ${missingParams[missingParams.length - 1]}`;
      }

      const errorStr = `${missingParamsStr} for \`llmTestCase\` turns cannot be None for the '${metric.name}' metric`;
      metric.error = errorStr;
      throw new MissingTestCaseParamsError(errorStr);
    }
  }
}

export function checkLLMTestCaseParams(
  testCase: LLMTestCase,
  testCaseParams: LLMTestCaseParams[],
  metric: BaseMetric,
): void {
  if (!(testCase instanceof LLMTestCase)) {
    const errorStr = `Unable to evaluate test cases that are not of type 'LLMTestCase' using the non-conversational '${metric.name}' metric.`;
    metric.error = errorStr;
    throw new Error(errorStr);
  }

  const missingParams: string[] = [];
  for (const param of testCaseParams) {
    if (!testCase[param]) {
      missingParams.push(`'${param}'`);
    }
  }

  if (missingParams.length) {
    let missingParamsStr: string;
    if (missingParams.length === 1) {
      missingParamsStr = missingParams[0] as string;
    } else if (missingParams.length === 2) {
      missingParamsStr = missingParams.join(' and ');
    } else {
      missingParamsStr = `${missingParams.slice(0, -1).join(', ')}, and ${missingParams[missingParams.length - 1]}`;
    }

    const errorStr = `${missingParamsStr} cannot be None for the '${metric.name}' metric`;
    metric.error = errorStr;
    throw new MissingTestCaseParamsError(errorStr);
  }
}

export function checkMLLMTestCaseParams(
  testCase: MLLMTestCase,
  testCaseParams: MLLMTestCaseParams[],
  inputImageCount: number | null,
  actualOutputImageCount: number | null,
  metric: BaseMetric,
): void {
  if (inputImageCount !== null) {
    let count = 0;
    for (const ele of testCase.input) {
      if (ele instanceof MLLMImage) {
        count++;
      }
    }
    if (count !== inputImageCount) {
      const errorStr = `Can only evaluate test cases with '${inputImageCount}' input images using the '${metric.name}' metric. \`${count}\` found.`;
      throw new Error(errorStr);
    }
  }

  if (actualOutputImageCount !== null) {
    let count = 0;
    for (const ele of testCase.actualOutput) {
      if (ele instanceof MLLMImage) {
        count++;
      }
    }
    if (count !== actualOutputImageCount) {
      const errorStr = `Unable to evaluate test cases with '${actualOutputImageCount}' output images using the '${metric.name}' metric. \`${count}\` found.`;
      throw new Error(errorStr);
    }
  }

  if (!(testCase instanceof MLLMTestCase)) {
    const errorStr = `Unable to evaluate test cases that are not of type 'MLLMTestCase' using the '${metric.name}' metric.`;
    metric.error = errorStr;
    throw new Error(errorStr);
  }

  const missingParams: string[] = [];
  for (const param of testCaseParams) {
    if (!testCase[param]) {
      missingParams.push(`'${param}'`);
    }
  }

  if (missingParams.length) {
    let missingParamsStr: string;
    if (missingParams.length === 1) {
      missingParamsStr = missingParams[0] as string;
    } else if (missingParams.length === 2) {
      missingParamsStr = missingParams.join(' and ');
    } else {
      missingParamsStr = `${missingParams.slice(0, -1).join(', ')}, and ${missingParams[missingParams.length - 1]}`;
    }

    const errorStr = `${missingParamsStr} cannot be None for the '${metric.name}' metric`;
    metric.error = errorStr;
    throw new MissingTestCaseParamsError(errorStr);
  }
}

export function trimAndLoadJson(inputString: string, metric?: BaseMetric): any {
  const start = inputString.indexOf('{');
  let end = inputString.lastIndexOf('}') + 1;

  if (end === 0 && start !== -1) {
    end = inputString.length;
  }

  const jsonStr = start !== -1 && end !== 0 ? inputString.slice(start, end) : '';

  // Remove trailing comma if present
  const cleanJsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(cleanJsonStr);
  } catch (error) {
    if (error instanceof SyntaxError) {
      const errorStr = 'Evaluation LLM outputted an invalid JSON. Please use a better evaluation model.';
      if (metric) {
        metric.error = errorStr;
      }
      throw new Error(errorStr);
    }
    throw error;
  }
}

export function printVerboseLogs(metric: string, logs: string): void {
  console.log('*'.repeat(50));
  console.log(`${metric} Verbose Logs`);
  console.log('*'.repeat(50));
  console.log('');
  console.log(logs);
  console.log('');
  console.log('='.repeat(70));
}
