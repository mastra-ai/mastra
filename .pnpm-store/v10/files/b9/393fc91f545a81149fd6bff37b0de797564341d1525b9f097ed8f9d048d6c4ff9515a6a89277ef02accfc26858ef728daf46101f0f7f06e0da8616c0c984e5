class Processor {
    constructor(options) {
        this.selfOptions = options || {};
        this.pipes = {};
    }
    options(options) {
        if (options) {
            this.selfOptions = options;
        }
        return this.selfOptions;
    }
    pipe(name, pipeArg) {
        let pipe = pipeArg;
        if (typeof name === "string") {
            if (typeof pipe === "undefined") {
                return this.pipes[name];
            }
            this.pipes[name] = pipe;
        }
        if (name && name.name) {
            pipe = name;
            if (pipe.processor === this) {
                return pipe;
            }
            this.pipes[pipe.name] = pipe;
        }
        if (!pipe) {
            throw new Error(`pipe is not defined: ${name}`);
        }
        pipe.processor = this;
        return pipe;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process(input, pipe) {
        let context = input;
        context.options = this.options();
        let nextPipe = pipe || input.pipe || "default";
        let lastPipe = undefined;
        while (nextPipe) {
            if (typeof context.nextAfterChildren !== "undefined") {
                // children processed and coming back to parent
                context.next = context.nextAfterChildren;
                context.nextAfterChildren = null;
            }
            if (typeof nextPipe === "string") {
                nextPipe = this.pipe(nextPipe);
            }
            nextPipe.process(context);
            lastPipe = nextPipe;
            nextPipe = null;
            if (context) {
                if (context.next) {
                    context = context.next;
                    nextPipe = context.pipe || lastPipe;
                }
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return context.hasResult ? context.result : undefined;
    }
}
export default Processor;
