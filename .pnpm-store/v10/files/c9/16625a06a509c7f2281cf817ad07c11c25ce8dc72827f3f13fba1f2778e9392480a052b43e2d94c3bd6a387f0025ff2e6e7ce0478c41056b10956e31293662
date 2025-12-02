import type {
  AnyEventBinding,
  EventBinding,
  EventOptions,
} from './event-types';

type UnbindFn = () => void;

function getOptions(
  shared?: EventOptions,
  fromBinding?: EventOptions | null,
): EventOptions {
  return {
    ...shared,
    ...fromBinding,
  };
}

export default function bindEvents(
  el: HTMLElement | Window,
  bindings: AnyEventBinding[],
  sharedOptions?: EventOptions,
): () => void {
  const unbindings: UnbindFn[] = (bindings as EventBinding[]).map(
    (binding): UnbindFn => {
      const options = getOptions(sharedOptions, binding.options);

      el.addEventListener(binding.eventName, binding.fn, options);

      return function unbind() {
        el.removeEventListener(binding.eventName, binding.fn, options);
      };
    },
  );

  // Return a function to unbind events
  return function unbindAll() {
    unbindings.forEach((unbind: UnbindFn) => {
      unbind();
    });
  };
}
