import { Agent } from '@mastra/core/agent';

/**
 * URL media passthrough demo agent.
 *
 * Reproduces the customer scenario: a Gemini (Vertex) model that declares
 * `https://` and `gs://` in its `supportedUrls`, so Mastra passes file/image
 * URLs straight through to the model instead of downloading + inlining bytes.
 *
 * Use this to test the Studio chat "Add attachment -> Public URL" flow:
 *   1. `pnpm mastra dev`
 *   2. Open this agent's chat in Studio.
 *   3. Click the attach (+) button, paste a media URL, click "Add".
 *      - `https://` images/PDFs/video preview inline (browser-fetchable).
 *      - `gs://` / `s3://` show a placeholder chip (the browser can't fetch
 *        them) and are forwarded to the model to resolve server-side.
 *   4. The attachment chip appears, then send "What's in this image/video?".
 *
 * The same payload works via the API:
 *   {
 *     "role": "user",
 *     "parts": [
 *       { "type": "text", "text": "What's in this video?" },
 *       { "type": "file", "url": "gs://my-bucket/clip.mp4", "mediaType": "video/mp4" }
 *     ]
 *   }
 *
 * Note: `gs://` is only resolvable through the Vertex provider with GCP
 * credentials. The public `google/gemini-2.0-flash-001` (Gemini API) accepts
 * `https://` media but NOT `gs://` — swap to a Vertex-backed model to exercise
 * the `gs://` path end-to-end. Either way, Mastra forwards the URI rather than
 * downloading the bytes.
 */
export const urlMediaAgent = new Agent({
  id: 'url-media-agent',
  name: 'URL Media Agent',
  description:
    'Multimodal agent (Gemini) for testing URL-based file/image attachments that are passed through to the model without downloading.',
  instructions: [
    'You are a multimodal assistant.',
    'When the user attaches an image, PDF, or video by URL, describe its contents.',
    'If you cannot access the media, say so explicitly instead of guessing.',
  ].join(' '),
  model: 'google/gemini-2.5-flash',
});
