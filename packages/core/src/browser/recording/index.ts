export { createBrowserRecordingTools, __isRecordingActive, __resetRecordingStateForTests } from './tools';
export type { BrowserRecordingOptions } from './tools';
export { writeMjpegAviFile } from './mjpeg-avi';
export type { MjpegAviOptions, MjpegFrame } from './mjpeg-avi';
export { decodeJpeg, drawCaptionOnFrame, encodeJpeg, selectCaptionAt } from './overlay';
export type { RecordingCaption, RgbaFrame } from './overlay';
