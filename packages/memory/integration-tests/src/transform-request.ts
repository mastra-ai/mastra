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
  // OpenAI tool definitions may include "strict": false/true which varies by SDK version
  // Replace the property but preserve valid JSON structure
  stringifiedBody = stringifiedBody.replaceAll(/"strict":(true|false),/g, '');
  stringifiedBody = stringifiedBody.replaceAll(/,"strict":(true|false)/g, '');
  // Normalize timestamps in remembered messages (timezone differences cause 6:56 PM vs 1:56 PM)
  stringifiedBody = stringifiedBody.replaceAll(/\d{1,2}:\d{2}\s*(AM|PM)/gi, 'REDACTED_TIME');
  // Remove "caller" objects that may be present in some SDK versions
  // Handle both cases: with trailing comma and as last property
  stringifiedBody = stringifiedBody.replaceAll(/"caller":\s*\{\s*"type":\s*"[^"]+"\s*\},/g, '');
  stringifiedBody = stringifiedBody.replaceAll(/,"caller":\s*\{\s*"type":\s*"[^"]+"\s*\}/g, '');

  return {
    url,
    body: JSON.parse(stringifiedBody),
  };
}
