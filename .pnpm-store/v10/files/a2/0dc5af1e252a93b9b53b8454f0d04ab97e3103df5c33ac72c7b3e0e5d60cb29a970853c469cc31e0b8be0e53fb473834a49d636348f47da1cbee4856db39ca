import { useEffect, useState } from "react";

/*
This code is taken from https://gist.github.com/bvaughn/e25397f70e8c65b0ae0d7c90b731b189
because correct subscriptions in async React is complex!

It could probably be replaced with `useSyncExternalStore()`.

The MIT License (MIT)
Copyright © 2023 Brian Vaughn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/**
 * Hook used for safely managing subscriptions in concurrent mode.
 *
 * In order to avoid removing and re-adding subscriptions each time this hook is called,
 * the parameters passed to this hook should be memoized in some way–
 * either by wrapping the entire params object with useMemo()
 * or by wrapping the individual callbacks with useCallback().
 *
 * @internal
 */
export function useSubscription<Value>({
  // (Synchronously) returns the current value of our subscription.
  getCurrentValue,

  // This function is passed an event handler to attach to the subscription.
  // It should return an unsubscribe function that removes the handler.
  subscribe,
}: {
  getCurrentValue: () => Value;
  subscribe: (callback: () => void) => () => void;
}): Value {
  // Read the current value from our subscription.
  // When this value changes, we'll schedule an update with React.
  // It's important to also store the hook params so that we can check for staleness.
  // (See the comment in checkForUpdates() below for more info.)
  const [state, setState] = useState(() => ({
    getCurrentValue,
    subscribe,
    value: getCurrentValue(),
  }));

  let valueToReturn = state.value;

  // If parameters have changed since our last render, schedule an update with its current value.
  if (
    state.getCurrentValue !== getCurrentValue ||
    state.subscribe !== subscribe
  ) {
    // If the subscription has been updated, we'll schedule another update with React.
    // React will process this update immediately, so the old subscription value won't be committed.
    // It is still nice to avoid returning a mismatched value though, so let's override the return value.
    valueToReturn = getCurrentValue();

    setState({
      getCurrentValue,
      subscribe,
      value: valueToReturn,
    });
  }

  // It is important not to subscribe while rendering because this can lead to memory leaks.
  // (Learn more at reactjs.org/docs/strict-mode.html#detecting-unexpected-side-effects)
  // Instead, we wait until the commit phase to attach our handler.
  //
  // We intentionally use a passive effect (useEffect) rather than a synchronous one (useLayoutEffect)
  // so that we don't stretch the commit phase.
  // This also has an added benefit when multiple components are subscribed to the same source:
  // It allows each of the event handlers to safely schedule work without potentially removing an another handler.
  // (Learn more at https://codesandbox.io/s/k0yvr5970o)
  useEffect(() => {
    let didUnsubscribe = false;

    const checkForUpdates = () => {
      // It's possible that this callback will be invoked even after being unsubscribed,
      // if it's removed as a result of a subscription event/update.
      // In this case, React will log a DEV warning about an update from an unmounted component.
      // We can avoid triggering that warning with this check.
      if (didUnsubscribe) {
        return;
      }

      setState((prevState) => {
        // Ignore values from stale sources!
        // Since we subscribe an unsubscribe in a passive effect,
        // it's possible that this callback will be invoked for a stale (previous) subscription.
        // This check avoids scheduling an update for that stale subscription.
        if (
          prevState.getCurrentValue !== getCurrentValue ||
          prevState.subscribe !== subscribe
        ) {
          return prevState;
        }

        // Some subscriptions will auto-invoke the handler, even if the value hasn't changed.
        // If the value hasn't changed, no update is needed.
        // Return state as-is so React can bail out and avoid an unnecessary render.
        const value = getCurrentValue();
        if (prevState.value === value) {
          return prevState;
        }

        return { ...prevState, value };
      });
    };
    const unsubscribe = subscribe(checkForUpdates);

    // Because we're subscribing in a passive effect,
    // it's possible that an update has occurred between render and our effect handler.
    // Check for this and schedule an update if work has occurred.
    checkForUpdates();

    return () => {
      didUnsubscribe = true;
      unsubscribe();
    };
  }, [getCurrentValue, subscribe]);

  // Return the current value for our caller to use while rendering.
  return valueToReturn;
}
