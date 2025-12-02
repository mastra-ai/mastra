import React from 'react';

// basically Exclude<React.ClassAttributes<T>["ref"], string>

var updateRef = function updateRef(ref, value) {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  ref.current = value;
};
var useComposedRef = function useComposedRef(libRef, userRef) {
  var prevUserRef = React.useRef();
  return React.useCallback(function (instance) {
    libRef.current = instance;
    if (prevUserRef.current) {
      updateRef(prevUserRef.current, null);
    }
    prevUserRef.current = userRef;
    if (!userRef) {
      return;
    }
    updateRef(userRef, instance);
  }, [userRef]);
};

export { useComposedRef as default };
