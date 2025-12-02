import { frame, cancelFrame } from '../frameloop/frame.mjs';

function observeTimeline(update, timeline) {
    let prevProgress;
    const onFrame = () => {
        const { currentTime } = timeline;
        const percentage = currentTime === null ? 0 : currentTime.value;
        const progress = percentage / 100;
        if (prevProgress !== progress) {
            update(progress);
        }
        prevProgress = progress;
    };
    frame.preUpdate(onFrame, true);
    return () => cancelFrame(onFrame);
}

export { observeTimeline };
