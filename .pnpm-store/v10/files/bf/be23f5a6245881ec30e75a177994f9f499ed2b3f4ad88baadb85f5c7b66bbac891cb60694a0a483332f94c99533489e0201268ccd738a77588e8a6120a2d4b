/* MAIN */
//FIXME: The return type of these functions is wrong, it doesn't account for returning "undefined", but a correct type cannot be written because generics cannot be extended properly, it seems
const attemptifyAsync = (fn, onError) => {
    return function attemptified(...args) {
        return fn.apply(undefined, args).catch(onError);
    };
};
const attemptifySync = (fn, onError) => {
    return function attemptified(...args) {
        try {
            return fn.apply(undefined, args);
        }
        catch (error) {
            return onError(error);
        }
    };
};
/* EXPORT */
export { attemptifyAsync, attemptifySync };
