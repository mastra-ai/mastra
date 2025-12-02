/* IMPORT */
import { IS_USER_ROOT } from './constants.js';
/* MAIN */
const Handlers = {
    /* API */
    isChangeErrorOk: (error) => {
        if (!Handlers.isNodeError(error))
            return false;
        const { code } = error;
        if (code === 'ENOSYS')
            return true;
        if (!IS_USER_ROOT && (code === 'EINVAL' || code === 'EPERM'))
            return true;
        return false;
    },
    isNodeError: (error) => {
        return (error instanceof Error);
    },
    isRetriableError: (error) => {
        if (!Handlers.isNodeError(error))
            return false;
        const { code } = error;
        if (code === 'EMFILE' || code === 'ENFILE' || code === 'EAGAIN' || code === 'EBUSY' || code === 'EACCESS' || code === 'EACCES' || code === 'EACCS' || code === 'EPERM')
            return true;
        return false;
    },
    onChangeError: (error) => {
        if (!Handlers.isNodeError(error))
            throw error;
        if (Handlers.isChangeErrorOk(error))
            return;
        throw error;
    }
};
/* EXPORT */
export default Handlers;
