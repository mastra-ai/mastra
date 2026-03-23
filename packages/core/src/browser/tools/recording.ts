/**
 * Browser Recording Tool
 *
 * Record browser sessions:
 * - start_recording: Start video recording
 * - stop_recording: Stop recording and get video
 * - start_tracing: Start performance trace
 * - stop_tracing: Stop trace and get data
 */

import { createTool } from '../../tools';
import { recordingInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserRecordingTool = createTool({
  id: 'browser_recording',
  description: `Record browser sessions. Actions:
- start_recording: Start video recording (optional path)
- stop_recording: Stop recording and get video path
- start_tracing: Start performance trace (screenshots, snapshots)
- stop_tracing: Stop trace and get data`,
  inputSchema: recordingInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.recording(input as Parameters<typeof browser.recording>[0]);
  },
});
