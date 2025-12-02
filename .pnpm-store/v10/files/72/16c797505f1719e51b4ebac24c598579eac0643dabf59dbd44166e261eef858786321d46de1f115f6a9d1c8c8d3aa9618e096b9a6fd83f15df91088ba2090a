// @flow

type WrapperFn<T> = {
  [[call]]: (...T) => void,
  cancel: () => void,
};

const rafSchd = <T: $ReadOnlyArray<any>>(
  fn: (...T) => void,
): WrapperFn<T> => {
  let lastArgs: T = ([]: any);
  let frameId: ?AnimationFrameID = null;

  const wrapperFn: WrapperFn<T> = (...args: T) => {
    // Always capture the latest value
    lastArgs = args;

    // There is already a frame queued
    if (frameId) {
      return;
    }

    // Schedule a new frame
    frameId = requestAnimationFrame(() => {
      frameId = null;
      fn(...lastArgs);
    });
  };

  // Adding cancel property to result function
  wrapperFn.cancel = () => {
    if (!frameId) {
      return;
    }

    cancelAnimationFrame(frameId);
    frameId = null;
  };

  return wrapperFn;
};

export default rafSchd;
