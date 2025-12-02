/* IMPORT */
/* HELPERS */
const Queues = {};
/* MAIN */
//TODO: Maybe publish this as a standalone package
const Scheduler = {
    /* API */
    next: (id) => {
        const queue = Queues[id];
        if (!queue)
            return;
        queue.shift();
        const job = queue[0];
        if (job) {
            job(() => Scheduler.next(id));
        }
        else {
            delete Queues[id];
        }
    },
    schedule: (id) => {
        return new Promise(resolve => {
            let queue = Queues[id];
            if (!queue)
                queue = Queues[id] = [];
            queue.push(resolve);
            if (queue.length > 1)
                return;
            resolve(() => Scheduler.next(id));
        });
    }
};
/* EXPORT */
export default Scheduler;
