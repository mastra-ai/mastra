import { noop } from 'motion-utils';
import { addToQueue } from './queue.mjs';

class ViewTransitionBuilder {
    constructor(update, options = {}) {
        this.currentSubject = "root";
        this.targets = new Map();
        this.notifyReady = noop;
        this.readyPromise = new Promise((resolve) => {
            this.notifyReady = resolve;
        });
        this.update = update;
        this.options = {
            interrupt: "wait",
            ...options,
        };
        addToQueue(this);
    }
    get(subject) {
        this.currentSubject = subject;
        return this;
    }
    layout(keyframes, options) {
        this.updateTarget("layout", keyframes, options);
        return this;
    }
    new(keyframes, options) {
        this.updateTarget("new", keyframes, options);
        return this;
    }
    old(keyframes, options) {
        this.updateTarget("old", keyframes, options);
        return this;
    }
    enter(keyframes, options) {
        this.updateTarget("enter", keyframes, options);
        return this;
    }
    exit(keyframes, options) {
        this.updateTarget("exit", keyframes, options);
        return this;
    }
    crossfade(options) {
        this.updateTarget("enter", { opacity: 1 }, options);
        this.updateTarget("exit", { opacity: 0 }, options);
        return this;
    }
    updateTarget(target, keyframes, options = {}) {
        const { currentSubject, targets } = this;
        if (!targets.has(currentSubject)) {
            targets.set(currentSubject, {});
        }
        const targetData = targets.get(currentSubject);
        targetData[target] = { keyframes, options };
    }
    then(resolve, reject) {
        return this.readyPromise.then(resolve, reject);
    }
}
function animateView(update, defaultOptions = {}) {
    return new ViewTransitionBuilder(update, defaultOptions);
}

export { ViewTransitionBuilder, animateView };
