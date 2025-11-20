const errorFallback = 'Something went wrong while fetching the data.';
export const parseError = (error: Error) => {
  try {
    const httpErrorPattern = /^HTTP error! status:\s*\d+\s*- \s*/;
    const errorMessage = error?.message.replace(httpErrorPattern, '');
    const jsonError = JSON.parse(errorMessage || '{}');
    return {
      error: jsonError?.error || errorFallback,
      stack: jsonError?.stack || error?.stack,
    };
  } catch {
    return {
      error: error?.message || errorFallback,
      stack: undefined,
    };
  }
};
