export type SerializedTool = {
  description?: string;
  parameters: any; // JSON Schema
  disabled?: boolean;
  type?: string;
};

export type SerializedModelContext = {
  system?: string;
  tools?: Record<string, SerializedTool>;
};

export type FrameMessageType =
  | "model-context-request"
  | "model-context-update"
  | "tool-call"
  | "tool-result";

export type FrameMessage =
  | {
      type: "model-context-request";
    }
  | {
      type: "model-context-update";
      context: SerializedModelContext;
    }
  | {
      type: "tool-call";
      id: string;
      toolName: string;
      args: unknown;
    }
  | {
      type: "tool-result";
      id: string;
      result?: unknown;
      error?: string;
    };

export const FRAME_MESSAGE_CHANNEL = "assistant-ui-frame";
