
/* IMPORT */

import {IS_USER_ROOT} from './constants';

/* MAIN */

const Handlers = {

  /* API */

  isChangeErrorOk: ( error: unknown ): boolean => { //URL: https://github.com/isaacs/node-graceful-fs/blob/master/polyfills.js#L315-L342

    if ( !Handlers.isNodeError ( error ) ) return false;

    const {code} = error;

    if ( code === 'ENOSYS' ) return true;

    if ( !IS_USER_ROOT && ( code === 'EINVAL' || code === 'EPERM' ) ) return true;

    return false;

  },

  isNodeError: ( error: unknown ): error is NodeJS.ErrnoException => {

    return ( error instanceof Error );

  },

  isRetriableError: ( error: unknown ): boolean => {

    if ( !Handlers.isNodeError ( error ) ) return false;

    const {code} = error;

    if ( code === 'EMFILE' || code === 'ENFILE' || code === 'EAGAIN' || code === 'EBUSY' || code === 'EACCESS' || code === 'EACCES' || code === 'EACCS' || code === 'EPERM' ) return true;

    return false;

  },

  onChangeError: ( error: unknown ): undefined => {

    if ( !Handlers.isNodeError ( error ) ) throw error;

    if ( Handlers.isChangeErrorOk ( error ) ) return;

    throw error;

  }

};

/* EXPORT */

export default Handlers;
