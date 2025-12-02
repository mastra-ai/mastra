"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiffPcmEncoder = void 0;
class RiffPcmEncoder {
    constructor(actualSampleRate, desiredSampleRate) {
        this.privActualSampleRate = actualSampleRate;
        this.privDesiredSampleRate = desiredSampleRate;
    }
    encode(actualAudioFrame) {
        const audioFrame = this.downSampleAudioFrame(actualAudioFrame, this.privActualSampleRate, this.privDesiredSampleRate);
        if (!audioFrame) {
            return null;
        }
        const audioLength = audioFrame.length * 2;
        const buffer = new ArrayBuffer(audioLength);
        const view = new DataView(buffer);
        this.floatTo16BitPCM(view, 0, audioFrame);
        return buffer;
    }
    setString(view, offset, str) {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    }
    floatTo16BitPCM(view, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }
    downSampleAudioFrame(srcFrame, srcRate, dstRate) {
        if (!srcFrame) {
            return null;
        }
        if (dstRate === srcRate || dstRate > srcRate) {
            return srcFrame;
        }
        const ratio = srcRate / dstRate;
        const dstLength = Math.round(srcFrame.length / ratio);
        const dstFrame = new Float32Array(dstLength);
        let srcOffset = 0;
        let dstOffset = 0;
        while (dstOffset < dstLength) {
            const nextSrcOffset = Math.round((dstOffset + 1) * ratio);
            let accum = 0;
            let count = 0;
            while (srcOffset < nextSrcOffset && srcOffset < srcFrame.length) {
                accum += srcFrame[srcOffset++];
                count++;
            }
            dstFrame[dstOffset++] = accum / count;
        }
        return dstFrame;
    }
}
exports.RiffPcmEncoder = RiffPcmEncoder;

//# sourceMappingURL=RiffPcmEncoder.js.map
