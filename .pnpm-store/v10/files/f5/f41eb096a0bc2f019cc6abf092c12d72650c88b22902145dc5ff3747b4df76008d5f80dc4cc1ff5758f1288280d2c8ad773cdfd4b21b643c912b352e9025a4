/* IMPORT */
import RetryfyQueue from './retryify_queue.js';
/* MAIN */
//FIXME: There are a boatload of anys here, but apparently generics cannot be extended properly, so...
const retryifyAsync = (fn, isRetriableError) => {
    return function retrified(timestamp) {
        return function attempt(...args) {
            return RetryfyQueue.schedule().then(cleanup => {
                const onResolve = (result) => {
                    cleanup();
                    return result;
                };
                const onReject = (error) => {
                    cleanup();
                    if (Date.now() >= timestamp)
                        throw error;
                    if (isRetriableError(error)) {
                        const delay = Math.round(100 * Math.random());
                        const delayPromise = new Promise(resolve => setTimeout(resolve, delay));
                        return delayPromise.then(() => attempt.apply(undefined, args));
                    }
                    throw error;
                };
                return fn.apply(undefined, args).then(onResolve, onReject);
            });
        };
    };
};
const retryifySync = (fn, isRetriableError) => {
    return function retrified(timestamp) {
        return function attempt(...args) {
            try {
                return fn.apply(undefined, args);
            }
            catch (error) {
                if (Date.now() > timestamp)
                    throw error;
                if (isRetriableError(error))
                    return attempt.apply(undefined, args);
                throw error;
            }
        };
    };
};
/* EXPORT */
export { retryifyAsync, retryifySync };
