import { useLayoutEffect } from 'react';

var isClient = typeof document !== 'undefined';

var noop = function noop() {};
var index = isClient ? useLayoutEffect : noop;

export { index as default };
