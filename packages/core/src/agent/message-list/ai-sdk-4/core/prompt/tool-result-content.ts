export type ToolResultContent = Array<
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image';
      data: string; // base64 encoded png image, e.g. screenshot
      mimeType?: string; // e.g. 'image/png';
    }
>;
