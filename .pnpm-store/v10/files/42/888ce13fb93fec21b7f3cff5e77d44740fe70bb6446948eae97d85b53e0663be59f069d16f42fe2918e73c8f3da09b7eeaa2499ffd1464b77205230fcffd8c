/* IMPORT */
import { LIMIT_FILES_DESCRIPTORS } from './constants.js';
/* MAIN */
class RetryfyQueue {
    constructor() {
        /* VARIABLES */
        this.interval = 25;
        this.intervalId = undefined;
        this.limit = LIMIT_FILES_DESCRIPTORS;
        this.queueActive = new Set();
        this.queueWaiting = new Set();
        /* LIFECYCLE API */
        this.init = () => {
            if (this.intervalId)
                return;
            this.intervalId = setInterval(this.tick, this.interval);
        };
        this.reset = () => {
            if (!this.intervalId)
                return;
            clearInterval(this.intervalId);
            delete this.intervalId;
        };
        /* API */
        this.add = (fn) => {
            this.queueWaiting.add(fn);
            if (this.queueActive.size < (this.limit / 2)) { // Active queue not under preassure, executing immediately
                this.tick();
            }
            else {
                this.init();
            }
        };
        this.remove = (fn) => {
            this.queueWaiting.delete(fn);
            this.queueActive.delete(fn);
        };
        this.schedule = () => {
            return new Promise(resolve => {
                const cleanup = () => this.remove(resolver);
                const resolver = () => resolve(cleanup);
                this.add(resolver);
            });
        };
        this.tick = () => {
            if (this.queueActive.size >= this.limit)
                return;
            if (!this.queueWaiting.size)
                return this.reset();
            for (const fn of this.queueWaiting) {
                if (this.queueActive.size >= this.limit)
                    break;
                this.queueWaiting.delete(fn);
                this.queueActive.add(fn);
                fn();
            }
        };
    }
}
;
/* EXPORT */
export default new RetryfyQueue();
