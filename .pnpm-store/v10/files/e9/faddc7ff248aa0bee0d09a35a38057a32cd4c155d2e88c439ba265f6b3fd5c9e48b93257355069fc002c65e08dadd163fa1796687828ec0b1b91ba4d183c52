"use strict";
import { performAsyncSyscall } from "./syscall.js";
export function setupAuth(requestId) {
  return {
    getUserIdentity: async () => {
      return await performAsyncSyscall("1.0/getUserIdentity", {
        requestId
      });
    }
  };
}
//# sourceMappingURL=authentication_impl.js.map
