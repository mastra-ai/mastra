
/* IMPORT */

import RetryfyQueue from './retryify_queue';

/* MAIN */

//FIXME: There are a boatload of anys here, but apparently generics cannot be extended properly, so...

const retryifyAsync = <FN extends Function> ( fn: FN, isRetriableError: (( error: unknown ) => boolean | void) ): (( timeout: number ) => FN) => {

  return function retrified ( timestamp: number ) {

    return function attempt ( ...args: any ): any {

      return RetryfyQueue.schedule ().then ( cleanup => {

        const onResolve = ( result: any ): Promise<any> => {

          cleanup ();

          return result;

        };

        const onReject = ( error: unknown ): Promise<any> => {

          cleanup ();

          if ( Date.now () >= timestamp ) throw error;

          if ( isRetriableError ( error ) ) {

            const delay = Math.round ( 100 * Math.random () );
            const delayPromise = new Promise ( resolve => setTimeout ( resolve, delay ) );

            return delayPromise.then ( () => attempt.apply ( undefined, args ) );

          }

          throw error;

        };

        return fn.apply ( undefined, args ).then ( onResolve, onReject );

      });

    } as any;

  };

};

const retryifySync = <FN extends Function> ( fn: FN, isRetriableError: (( error: unknown ) => boolean | void) ): (( timeout: number ) => FN) => {

  return function retrified ( timestamp: number ) {

    return function attempt ( ...args: any ): any {

      try {

        return fn.apply ( undefined, args );

      } catch ( error: unknown ) {

        if ( Date.now () > timestamp ) throw error;

        if ( isRetriableError ( error ) ) return attempt.apply ( undefined, args );

        throw error;

      }

    } as any;

  };

};

/* EXPORT */

export {retryifyAsync, retryifySync};
