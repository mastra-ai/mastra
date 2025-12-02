import { time } from '../../frameloop/sync-time.mjs';
import { frame, cancelFrame, frameData } from '../../frameloop/frame.mjs';

const frameloopDriver = (update) => {
    const passTimestamp = ({ timestamp }) => update(timestamp);
    return {
        start: (keepAlive = true) => frame.update(passTimestamp, keepAlive),
        stop: () => cancelFrame(passTimestamp),
        /**
         * If we're processing this frame we can use the
         * framelocked timestamp to keep things in sync.
         */
        now: () => (frameData.isProcessing ? frameData.timestamp : time.now()),
    };
};

export { frameloopDriver };
