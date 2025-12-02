/* IMPORT */
/* MAIN */
class Interceptor {
    /* CONSTRUCTOR */
    constructor() {
        /* VARIABLES */
        this.callbacks = new Set();
        /* API */
        this.exit = () => {
            for (const callback of this.callbacks) {
                callback();
            }
        };
        this.hook = () => {
            window.addEventListener('beforeunload', this.exit);
        };
        this.register = (callback) => {
            this.callbacks.add(callback);
            return () => {
                this.callbacks.delete(callback);
            };
        };
        this.hook();
    }
}
/* EXPORT */
export default new Interceptor();
