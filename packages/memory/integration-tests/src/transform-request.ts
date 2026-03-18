export function transformRequest({ url, body }: { url: string; body: unknown }): { url: string; body: unknown } {
  let stringifiedBody = JSON.stringify(body);
  // Normalize dynamic fields that change between test runs
  // These regexes match JSON property patterns like "id":"value" in stringified JSON
  stringifiedBody = stringifiedBody.replaceAll(/"createdAt":"[^"]+"/g, '"createdAt":"REDACTED"');
  stringifiedBody = stringifiedBody.replaceAll(/"toolCallId":"[^"]+"/g, '"toolCallId":"REDACTED"');
  stringifiedBody = stringifiedBody.replaceAll(/"id":"[^"]+"/g, '"id":"REDACTED"');
  stringifiedBody = stringifiedBody.replaceAll(/\d+ms/g, 'REDACTED');
  // Google Gemini includes thoughtSignature which is session-specific
  stringifiedBody = stringifiedBody.replaceAll(/"thoughtSignature":"[^"]+"/g, '"thoughtSignature":"REDACTED"');
  // Tool outputs may contain stringified JSON with escaped quotes containing dynamic IDs like doc-TIMESTAMP
  // Example: "output": "{\"id\":\"doc-1773860673929\",\"status\":\"created\"}"
  stringifiedBody = stringifiedBody.replaceAll(/\\\"id\\\":\\\"[^\\]+\\\"/g, '\\"id\\":\\"REDACTED\\"');

  return {
    url,
    body: JSON.parse(stringifiedBody),
  };
}
