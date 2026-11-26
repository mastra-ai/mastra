const errorFallback = 'Something went wrong while fetching the data.';
export const parseError = (error: Error) => {
  try {
    const httpErrorPattern = /^HTTP error! status:\s*\d+\s*- \s*/;
    const errorMessage = error?.message.replace(httpErrorPattern, '');
    const jsonError = JSON.parse(errorMessage || '{}');
    // Most handlers answer `{ error }`; trace-query handlers answer `{ message, issues: [{ message }] }`.
    const issues: string[] = Array.isArray(jsonError?.issues)
      ? jsonError.issues.map((issue: { message?: unknown }) => issue?.message).filter(Boolean)
      : [];
    return {
      error: jsonError?.error || (issues.length ? issues.join('. ') : jsonError?.message) || errorFallback,
      stack: jsonError?.stack || error?.stack,
    };
  } catch {
    return {
      error: error?.message || errorFallback,
      stack: undefined,
    };
  }
};
