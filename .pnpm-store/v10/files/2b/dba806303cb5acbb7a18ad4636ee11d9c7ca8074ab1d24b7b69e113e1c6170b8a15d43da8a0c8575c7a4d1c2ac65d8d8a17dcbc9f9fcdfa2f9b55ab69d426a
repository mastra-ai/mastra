import { useCallback, useRef } from "react";

export const useManagedRef = <TNode>(
  callback: (node: TNode) => (() => void) | void,
) => {
  const cleanupRef = useRef<(() => void) | void>(undefined);

  const ref = useCallback(
    (el: TNode | null) => {
      // Call the previous cleanup function
      if (cleanupRef.current) {
        cleanupRef.current();
      }

      // Call the new callback and store its cleanup function
      if (el) {
        cleanupRef.current = callback(el);
      }
    },
    [callback],
  );

  return ref;
};
