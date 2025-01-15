export class MissingTestCaseParamsError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'MissingTestCaseParamsError';
  }
}
