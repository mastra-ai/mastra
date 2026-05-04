function replaceField(stringifiedBody: string, field: string, replacement: string) {
  let str = stringifiedBody;
  str = str.replaceAll(new RegExp(`"${field}":("[^"]+"|-?\\d+(?:\\.\\d+)?)`, 'g'), `"${field}":"${replacement}"`);
  str = str.replaceAll(
    new RegExp(`\\\\"${field}\\\\":(\\\\"[^"]+\\\\"|-?\\d+(?:\\.\\d+)?)`, 'g'),
    `\\"${field}\\":\\"${replacement}\\"`,
  );

  return str;
}

export function transformRequest({ url, body }: { url: string; body: unknown }): { url: string; body: unknown } {
  let stringifiedBody = JSON.stringify(body);

  // Normalize dynamic fields that change between test runs
  // These regexes match JSON property patterns like "id":"value" in stringified JSON
  stringifiedBody = replaceField(stringifiedBody, 'createdAt', 'REDACTED');
  stringifiedBody = replaceField(stringifiedBody, 'toolCallId', 'REDACTED');
  stringifiedBody = replaceField(stringifiedBody, 'tool_call_id', 'REDACTED');
  stringifiedBody = replaceField(stringifiedBody, 'call_id', 'REDACTED');
  stringifiedBody = replaceField(stringifiedBody, 'id', 'REDACTED');
  stringifiedBody = stringifiedBody.replaceAll(/\d+ms/g, 'REDACTED');
  // Google Gemini includes thoughtSignature which is session-specific
  stringifiedBody = replaceField(stringifiedBody, 'thoughtSignature', 'REDACTED');
  // OpenAI tool definitions may include "strict": false/true which varies by SDK version
  // Replace the property but preserve valid JSON structure
  stringifiedBody = stringifiedBody.replaceAll(/"strict":(true|false),/g, '');
  stringifiedBody = stringifiedBody.replaceAll(/,"strict":(true|false)/g, '');
  // Normalize dates/timestamps in remembered messages (timezone/date differences cause hash mismatches)
  stringifiedBody = stringifiedBody.replaceAll(/\d{4},\s*\w{3},\s*\d{1,2}/g, 'REDACTED_DATE');
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
