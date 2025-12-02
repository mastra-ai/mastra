/* eslint-disable no-console */
import * as timings from '../timings';
import type { Action } from '../../state/store-types';

export default () =>
  (next: (a: Action) => unknown) =>
  (action: Action): any => {
    timings.forceEnable();
    const key = `redux action: ${action.type}`;
    timings.start(key);

    const result: unknown = next(action);

    timings.finish(key);

    return result;
  };
