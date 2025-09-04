# Issue #7362: Unable to use image input with gemini-2.5-flash-image-preview

## Problem Description

Users are unable to send images to Google's Gemini model when using AI SDK v5. The error indicates that URL strings in file parts are being incorrectly processed as base64 content.

## Error Details

- **Error Message**: `AI_InvalidDataContentError: Invalid data content. Content string is not a base64-encoded media.`
- **Affected Versions**: Mastra with AI SDK v5 (`@ai-sdk/google@^2.0.11`)
- **Model**: `google('gemini-2.5-flash-image-preview')`

## Root Cause

The issue is in the message conversion logic. When AI SDK V5 messages contain file parts with URLs, the conversion code doesn't properly handle the different data formats:

1. **URLs** (e.g., `https://example.com/image.png`) - Should be placed in `experimental_attachments`
2. **Data URIs** (e.g., `data:image/png;base64,iVBOR...`) - Should be converted to image parts
3. **Raw Base64** (e.g., `iVBOR...`) - Should be treated as image content

## The Fix Applied

The fix in `packages/core/src/agent/message-list/index.ts` (lines 1973-2098) addresses this by:

1. **Handling both `url` and `data` fields** in V3 file parts (lines 1982-1988)
2. **Moving URL file parts to `experimental_attachments`** for AI SDK V4 compatibility (lines 2064-2098)
3. **Properly distinguishing between URLs, data URIs, and raw base64**

### Key Changes:

```typescript
// Handle both 'url' and 'data' fields in V3 file parts
const fileDataSource =
  'url' in p && typeof p.url === 'string'
    ? p.url
    : 'data' in p && typeof (p as any).data === 'string'
      ? (p as any).data
      : undefined;
```

```typescript
// Move URL file parts to experimental_attachments for AI SDK V4
if (urlFileParts.length > 0) {
  // Initialize experimental_attachments if not present
  if (!v2Msg.content.experimental_attachments) {
    v2Msg.content.experimental_attachments = [];
  }

  // Move URL file parts to experimental_attachments
  for (const urlPart of urlFileParts) {
    if (urlPart.type === 'file') {
      v2Msg.content.experimental_attachments.push({
        url: urlPart.data,
        contentType: urlPart.mimeType || 'application/octet-stream',
      });
    }
  }

  // Remove URL file parts from parts array
  v2Msg.content.parts = v2Msg.content.parts.filter(
    p =>
      !(
        p.type === 'file' &&
        typeof p.data === 'string' &&
        (p.data.startsWith('http://') || p.data.startsWith('https://'))
      ),
  );
}
```

## Test Coverage

The test in `packages/core/src/agent/issue-7362.test.ts` verifies:

1. ✅ URL strings are properly handled and placed in experimental_attachments
2. ✅ Base64 data URIs are converted to image parts
3. ✅ Raw base64 strings are treated as image content
4. ✅ URL objects are converted to strings and handled correctly
5. ✅ Mixed file types in a single message work properly

## Status

✅ Issue is FIXED - Tests are now passing with the applied changes
