
/* MAIN */

//FIXME: The return type of these functions is wrong, it doesn't account for returning "undefined", but a correct type cannot be written because generics cannot be extended properly, it seems

const attemptifyAsync = <FN extends Function> ( fn: FN, onError: (( error: unknown ) => undefined) ): FN => {

  return function attemptified ( ...args: any ): any {

    return fn.apply ( undefined, args ).catch ( onError );

  } as any;

};

const attemptifySync = <FN extends Function> ( fn: FN, onError: (( error: unknown ) => undefined) ): FN => {

  return function attemptified ( ...args: any ): any {

    try {

      return fn.apply ( undefined, args );

    } catch ( error: unknown ) {

      return onError ( error );

    }

  } as any;

};

/* EXPORT */

export {attemptifyAsync, attemptifySync};
