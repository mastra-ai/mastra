import { invariant } from '../../../invariant';

interface Entry {
  timerId: TimeoutID;
  callback: () => void;
}

export interface AsyncMarshal {
  add: (fn: () => void) => void;
  flush: () => void;
}

export default () => {
  const entries: Entry[] = [];

  const execute = (timerId: TimeoutID) => {
    const index: number = entries.findIndex(
      (item): boolean => item.timerId === timerId,
    );
    invariant(index !== -1, 'Could not find timer');
    // delete in place
    const [entry] = entries.splice(index, 1);
    entry.callback();
  };

  const add = (fn: () => void) => {
    const timerId: TimeoutID = setTimeout(() => execute(timerId));
    const entry: Entry = {
      timerId,
      callback: fn,
    };
    entries.push(entry);
  };

  const flush = () => {
    // nothing to flush
    if (!entries.length) {
      return;
    }

    const shallow: Entry[] = [...entries];
    // clearing entries in case a callback adds some more callbacks
    entries.length = 0;

    shallow.forEach((entry: Entry) => {
      clearTimeout(entry.timerId);
      entry.callback();
    });
  };

  return { add, flush };
};
