// src/runtimes/remote-thread-list/EMPTY_THREAD_CORE.tsx
var EMPTY_THREAD_ERROR = new Error(
  "This is the empty thread, a placeholder for the main thread. You cannot perform any actions on this thread instance. This error is probably because you tried to call a thread method in your render function. Call the method inside a `useEffect` hook instead."
);
var EMPTY_THREAD_CORE = {
  getMessageById() {
    return void 0;
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
    return void 0;
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
    },
    async clearAttachments() {
    },
    send() {
      throw EMPTY_THREAD_ERROR;
    },
    cancel() {
    },
    subscribe() {
      return () => {
      };
    },
    unstable_on() {
      return () => {
      };
    }
  },
  getEditComposer() {
    return void 0;
  },
  beginEdit() {
    throw EMPTY_THREAD_ERROR;
  },
  speech: void 0,
  capabilities: {
    switchToBranch: false,
    edit: false,
    reload: false,
    cancel: false,
    unstable_copy: false,
    speech: false,
    attachments: false,
    feedback: false
  },
  isDisabled: true,
  isLoading: false,
  messages: [],
  state: null,
  suggestions: [],
  extras: void 0,
  subscribe() {
    return () => {
    };
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
    return () => {
    };
  }
};
export {
  EMPTY_THREAD_CORE
};
//# sourceMappingURL=EMPTY_THREAD_CORE.js.map