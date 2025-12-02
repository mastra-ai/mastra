
/* IMPORT */

import type {Exception} from '../types';

/* MAIN */

const isException = ( value: unknown ): value is Exception => {

  return ( value instanceof Error ) && ( 'code' in value );

};

const isFunction = ( value: unknown ): value is Function => {

  return ( typeof value === 'function' );

};

const isString = ( value: unknown ): value is string => {

  return ( typeof value === 'string' );

};

const isUndefined = ( value: unknown ): value is undefined => {

  return ( value === undefined );

};

/* EXPORT */

export {isException, isFunction, isString, isUndefined};
