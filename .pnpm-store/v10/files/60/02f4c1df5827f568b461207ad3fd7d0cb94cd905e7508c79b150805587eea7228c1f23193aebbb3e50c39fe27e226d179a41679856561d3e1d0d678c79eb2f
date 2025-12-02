// src/utils/hooks/useManagedRef.ts
import { useCallback, useRef } from "react";
var useManagedRef = (callback) => {
  const cleanupRef = useRef(void 0);
  const ref = useCallback(
    (el) => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      if (el) {
        cleanupRef.current = callback(el);
      }
    },
    [callback]
  );
  return ref;
};
export {
  useManagedRef
};
//# sourceMappingURL=useManagedRef.js.map