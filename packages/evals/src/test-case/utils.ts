import { LLMTestCase, MLLMTestCase, ConversationalTestCase } from '../test-case';

type TestCase = LLMTestCase | MLLMTestCase | ConversationalTestCase;

export function checkValidTestCasesType(testCases: TestCase[]): void {
  let llmTestCaseCount = 0;
  let conversationalTestCaseCount = 0;

  for (const testCase of testCases) {
    if (testCase instanceof LLMTestCase || testCase instanceof MLLMTestCase) {
      llmTestCaseCount++;
    } else if (testCase instanceof ConversationalTestCase) {
      conversationalTestCaseCount++;
    }
  }

  if (llmTestCaseCount > 0 && conversationalTestCaseCount > 0) {
    throw new Error(
      'You cannot supply a mixture of `LLMTestCase`/`MLLMTestCase`(s) and `ConversationalTestCase`(s) as the list of test cases.',
    );
  }
}

export function isLLMTestCaseArray(testCases: TestCase[]) {
  return testCases.every(testCase => testCase instanceof LLMTestCase || testCase instanceof MLLMTestCase);
}

export function isConversationalTestCaseArray(testCases: TestCase[]) {
  return testCases.every(testCase => testCase instanceof ConversationalTestCase);
}
