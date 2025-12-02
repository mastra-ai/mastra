import { activeAnimations } from './animation-count.mjs';
import { statsBuffer } from './buffer.mjs';
import { frame, cancelFrame, frameData } from '../frameloop/frame.mjs';

function record() {
    const { value } = statsBuffer;
    if (value === null) {
        cancelFrame(record);
        return;
    }
    value.frameloop.rate.push(frameData.delta);
    value.animations.mainThread.push(activeAnimations.mainThread);
    value.animations.waapi.push(activeAnimations.waapi);
    value.animations.layout.push(activeAnimations.layout);
}
function mean(values) {
    return values.reduce((acc, value) => acc + value, 0) / values.length;
}
function summarise(values, calcAverage = mean) {
    if (values.length === 0) {
        return {
            min: 0,
            max: 0,
            avg: 0,
        };
    }
    return {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: calcAverage(values),
    };
}
const msToFps = (ms) => Math.round(1000 / ms);
function clearStatsBuffer() {
    statsBuffer.value = null;
    statsBuffer.addProjectionMetrics = null;
}
function reportStats() {
    const { value } = statsBuffer;
    if (!value) {
        throw new Error("Stats are not being measured");
    }
    clearStatsBuffer();
    cancelFrame(record);
    const summary = {
        frameloop: {
            setup: summarise(value.frameloop.setup),
            rate: summarise(value.frameloop.rate),
            read: summarise(value.frameloop.read),
            resolveKeyframes: summarise(value.frameloop.resolveKeyframes),
            preUpdate: summarise(value.frameloop.preUpdate),
            update: summarise(value.frameloop.update),
            preRender: summarise(value.frameloop.preRender),
            render: summarise(value.frameloop.render),
            postRender: summarise(value.frameloop.postRender),
        },
        animations: {
            mainThread: summarise(value.animations.mainThread),
            waapi: summarise(value.animations.waapi),
            layout: summarise(value.animations.layout),
        },
        layoutProjection: {
            nodes: summarise(value.layoutProjection.nodes),
            calculatedTargetDeltas: summarise(value.layoutProjection.calculatedTargetDeltas),
            calculatedProjections: summarise(value.layoutProjection.calculatedProjections),
        },
    };
    /**
     * Convert the rate to FPS
     */
    const { rate } = summary.frameloop;
    rate.min = msToFps(rate.min);
    rate.max = msToFps(rate.max);
    rate.avg = msToFps(rate.avg);
    [rate.min, rate.max] = [rate.max, rate.min];
    return summary;
}
function recordStats() {
    if (statsBuffer.value) {
        clearStatsBuffer();
        throw new Error("Stats are already being measured");
    }
    const newStatsBuffer = statsBuffer;
    newStatsBuffer.value = {
        frameloop: {
            setup: [],
            rate: [],
            read: [],
            resolveKeyframes: [],
            preUpdate: [],
            update: [],
            preRender: [],
            render: [],
            postRender: [],
        },
        animations: {
            mainThread: [],
            waapi: [],
            layout: [],
        },
        layoutProjection: {
            nodes: [],
            calculatedTargetDeltas: [],
            calculatedProjections: [],
        },
    };
    newStatsBuffer.addProjectionMetrics = (metrics) => {
        const { layoutProjection } = newStatsBuffer.value;
        layoutProjection.nodes.push(metrics.nodes);
        layoutProjection.calculatedTargetDeltas.push(metrics.calculatedTargetDeltas);
        layoutProjection.calculatedProjections.push(metrics.calculatedProjections);
    };
    frame.postRender(record, true);
    return reportStats;
}

export { recordStats };
