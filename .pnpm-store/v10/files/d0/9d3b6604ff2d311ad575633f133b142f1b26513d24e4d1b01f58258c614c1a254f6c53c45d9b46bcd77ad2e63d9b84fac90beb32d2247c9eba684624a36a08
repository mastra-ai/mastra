import { ThreadRuntimeCore } from "../../internal";

const EMPTY_THREAD_ERROR = new Error(
  "This is the empty thread, a placeholder for the main thread. You cannot perform any actions on this thread instance. This error is probably because you tried to call a thread method in your render function. Call the method inside a `useEffect` hook instead.",
);
export const EMPTY_THREAD_CORE: ThreadRuntimeCore = {
  getMessageById() {
    return undefined;
  },

  getBranches() {
    return [];
  },

  switchToBranch() {
    throw EMPTY_THREAD_ERROR;
  },

  append() {
    throw EMPTY_THREAD_ERROR;
  },

  startRun() {
    throw EMPTY_THREAD_ERROR;
  },

  resumeRun() {
    throw EMPTY_THREAD_ERROR;
  },

  cancelRun() {
    throw EMPTY_THREAD_ERROR;
  },

  addToolResult() {
    throw EMPTY_THREAD_ERROR;
  },

  speak() {
    throw EMPTY_THREAD_ERROR;
  },

  stopSpeaking() {
    throw EMPTY_THREAD_ERROR;
  },

  getSubmittedFeedback() {
    return undefined;
  },

  submitFeedback() {
    throw EMPTY_THREAD_ERROR;
  },

  getModelContext() {
    return {};
  },

  composer: {
    attachments: [],

    getAttachmentAccept() {
      return "*";
    },

    async addAttachment() {
      throw EMPTY_THREAD_ERROR;
    },

    async removeAttachment() {
      throw EMPTY_THREAD_ERROR;
    },

    isEditing: false,

    canCancel: false,
    isEmpty: true,

    text: "",

    setText() {
      throw EMPTY_THREAD_ERROR;
    },

    role: "user",

    setRole() {
      throw EMPTY_THREAD_ERROR;
    },

    runConfig: {},

    setRunConfig() {
      throw EMPTY_THREAD_ERROR;
    },

    async reset() {
      // noop
    },

    async clearAttachments() {
      // noop
    },

    send() {
      throw EMPTY_THREAD_ERROR;
    },

    cancel() {
      // noop
    },

    subscribe() {
      return () => {};
    },

    unstable_on() {
      return () => {};
    },
  },

  getEditComposer() {
    return undefined;
  },

  beginEdit() {
    throw EMPTY_THREAD_ERROR;
  },

  speech: undefined,

  capabilities: {
    switchToBranch: false,
    edit: false,
    reload: false,
    cancel: false,
    unstable_copy: false,
    speech: false,
    attachments: false,
    feedback: false,
  },

  isDisabled: true,
  isLoading: false,

  messages: [],

  state: null,

  suggestions: [],

  extras: undefined,

  subscribe() {
    return () => {};
  },

  import() {
    throw EMPTY_THREAD_ERROR;
  },

  export() {
    return { messages: [] };
  },

  reset() {
    throw EMPTY_THREAD_ERROR;
  },

  unstable_on() {
    return () => {};
  },
};
