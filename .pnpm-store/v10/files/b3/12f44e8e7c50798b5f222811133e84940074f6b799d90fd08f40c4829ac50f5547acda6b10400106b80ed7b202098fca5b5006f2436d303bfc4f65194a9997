/* IMPORT */
import process from 'node:process';
import { IS_WINDOWS } from './constants.js';
import Signals from './signals.js';
/* MAIN */
class Interceptor {
    /* CONSTRUCTOR */
    constructor() {
        /* VARIABLES */
        this.callbacks = new Set();
        this.exited = false;
        /* API */
        this.exit = (signal) => {
            if (this.exited)
                return;
            this.exited = true;
            for (const callback of this.callbacks) {
                callback();
            }
            if (signal) {
                if (IS_WINDOWS && (signal !== 'SIGINT' && signal !== 'SIGTERM' && signal !== 'SIGKILL')) { // Windows doesn't support POSIX signals, but Node emulates these 3 signals for us
                    process.kill(process.pid, 'SIGTERM');
                }
                else {
                    process.kill(process.pid, signal);
                }
            }
        };
        this.hook = () => {
            process.once('exit', () => this.exit());
            for (const signal of Signals) {
                try {
                    process.once(signal, () => this.exit(signal));
                }
                catch {
                    // Sometimes "process.once" can throw...
                }
            }
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
