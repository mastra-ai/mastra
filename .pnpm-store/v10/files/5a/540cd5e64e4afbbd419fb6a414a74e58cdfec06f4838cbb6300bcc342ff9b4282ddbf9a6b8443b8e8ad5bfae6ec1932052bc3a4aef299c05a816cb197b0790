// @flow

import environmentIsNode from 'detect-node';
import createGlobalThis from 'globalthis';
import stringify from 'json-stringify-safe';
import {
  sprintf,
} from 'sprintf-js';
import {
  logLevels,
} from '../constants';
import type {
  LoggerType,
  MessageContextType,
  MessageEventHandlerType,
  TranslateMessageFunctionType,
} from '../types';

const globalThis = createGlobalThis();

let domain;

if (environmentIsNode) {
  // eslint-disable-next-line global-require
  domain = require('domain');
}

const getParentDomainContext = () => {
  if (!domain) {
    return {};
  }

  const parentRoarrContexts = [];

  let currentDomain = process.domain;

  // $FlowFixMe
  if (!currentDomain || !currentDomain.parentDomain) {
    return {};
  }

  while (currentDomain && currentDomain.parentDomain) {
    currentDomain = currentDomain.parentDomain;

    if (currentDomain.roarr && currentDomain.roarr.context) {
      parentRoarrContexts.push(currentDomain.roarr.context);
    }
  }

  let domainContext = {};

  for (const parentRoarrContext of parentRoarrContexts) {
    domainContext = {
      ...domainContext,
      ...parentRoarrContext,
    };
  }

  return domainContext;
};

const getFirstParentDomainContext = () => {
  if (!domain) {
    return {};
  }

  let currentDomain = process.domain;

  // $FlowFixMe
  if (currentDomain && currentDomain.roarr && currentDomain.roarr.context) {
    return currentDomain.roarr.context;
  }

  // $FlowFixMe
  if (!currentDomain || !currentDomain.parentDomain) {
    return {};
  }

  while (currentDomain && currentDomain.parentDomain) {
    currentDomain = currentDomain.parentDomain;

    if (currentDomain.roarr && currentDomain.roarr.context) {
      return currentDomain.roarr.context;
    }
  }

  return {};
};

const createLogger = (onMessage: MessageEventHandlerType, parentContext?: MessageContextType): LoggerType => {
  // eslint-disable-next-line id-length, unicorn/prevent-abbreviations
  const log = (a, b, c, d, e, f, g, h, i, k) => {
    const time = Date.now();
    const sequence = globalThis.ROARR.sequence++;

    let context;
    let message;

    if (typeof a === 'string') {
      context = {
        ...getFirstParentDomainContext(),
        ...parentContext || {},
      };
      // eslint-disable-next-line id-length, object-property-newline
      const {...args} = {a, b, c, d, e, f, g, h, i, k};
      const values = Object.keys(args).map((key) => {
        return args[key];
      });
      // eslint-disable-next-line unicorn/no-reduce
      const hasOnlyOneParameterValued = 1 === values.reduce((accumulator, value) => {
        // eslint-disable-next-line no-return-assign, no-param-reassign
        return accumulator += typeof value === 'undefined' ? 0 : 1;
      }, 0);
      message = hasOnlyOneParameterValued ? sprintf('%s', a) : sprintf(a, b, c, d, e, f, g, h, i, k);
    } else {
      if (typeof b !== 'string') {
        throw new TypeError('Message must be a string.');
      }

      context = JSON.parse(stringify({
        ...getFirstParentDomainContext(),
        ...parentContext || {},
        ...a,
      }));

      message = sprintf(b, c, d, e, f, g, h, i, k);
    }

    onMessage({
      context,
      message,
      sequence,
      time,
      version: '1.0.0',
    });
  };

  log.child = (context: TranslateMessageFunctionType | MessageContextType): LoggerType => {
    if (typeof context === 'function') {
      return createLogger((message) => {
        if (typeof context !== 'function') {
          throw new TypeError('Unexpected state.');
        }
        onMessage(context(message));
      }, parentContext);
    }

    return createLogger(onMessage, {
      ...getFirstParentDomainContext(),
      ...parentContext,
      ...context,
    });
  };

  log.getContext = (): MessageContextType => {
    return {
      ...getFirstParentDomainContext(),
      ...parentContext || {},
    };
  };

  log.adopt = async (routine, context) => {
    if (!domain) {
      return routine();
    }

    const adoptedDomain = domain.create();

    return adoptedDomain
      .run(() => {
        // $FlowFixMe
        adoptedDomain.roarr = {
          context: {
            ...getParentDomainContext(),
            ...context,
          },
        };

        return routine();
      });
  };

  for (const logLevel of Object.keys(logLevels)) {
    // eslint-disable-next-line id-length, unicorn/prevent-abbreviations
    log[logLevel] = (a, b, c, d, e, f, g, h, i, k) => {
      return log.child({
        logLevel: logLevels[logLevel],
      })(a, b, c, d, e, f, g, h, i, k);
    };
  }

  // @see https://github.com/facebook/flow/issues/6705
  // $FlowFixMe
  return log;
};

export default createLogger;
