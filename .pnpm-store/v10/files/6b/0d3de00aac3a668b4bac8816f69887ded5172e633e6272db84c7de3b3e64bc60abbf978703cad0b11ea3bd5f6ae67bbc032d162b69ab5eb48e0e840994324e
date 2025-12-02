"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PcmRecorder = void 0;
const Exports_1 = require("../common/Exports");
class PcmRecorder {
    constructor(stopInputOnRelease) {
        this.privStopInputOnRelease = stopInputOnRelease;
    }
    record(context, mediaStream, outputStream) {
        const desiredSampleRate = 16000;
        const waveStreamEncoder = new Exports_1.RiffPcmEncoder(context.sampleRate, desiredSampleRate);
        const micInput = context.createMediaStreamSource(mediaStream);
        const attachScriptProcessor = () => {
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            const scriptNode = (() => {
                let bufferSize = 0;
                try {
                    return context.createScriptProcessor(bufferSize, 1, 1);
                }
                catch (error) {
                    // Webkit (<= version 31) requires a valid bufferSize.
                    bufferSize = 2048;
                    let audioSampleRate = context.sampleRate;
                    while (bufferSize < 16384 && audioSampleRate >= (2 * desiredSampleRate)) {
                        bufferSize <<= 1;
                        audioSampleRate >>= 1;
                    }
                    return context.createScriptProcessor(bufferSize, 1, 1);
                }
            })();
            scriptNode.onaudioprocess = (event) => {
                const inputFrame = event.inputBuffer.getChannelData(0);
                if (outputStream && !outputStream.isClosed) {
                    const waveFrame = waveStreamEncoder.encode(inputFrame);
                    if (!!waveFrame) {
                        outputStream.writeStreamChunk({
                            buffer: waveFrame,
                            isEnd: false,
                            timeReceived: Date.now(),
                        });
                    }
                }
            };
            micInput.connect(scriptNode);
            scriptNode.connect(context.destination);
            this.privMediaResources = {
                scriptProcessorNode: scriptNode,
                source: micInput,
                stream: mediaStream,
            };
        };
        // https://webaudio.github.io/web-audio-api/#audioworklet
        // Using AudioWorklet to improve audio quality and avoid audio glitches due to blocking the UI thread
        const skipAudioWorklet = !!this.privSpeechProcessorScript && this.privSpeechProcessorScript.toLowerCase() === "ignore";
        if (!!context.audioWorklet && !skipAudioWorklet) {
            if (!this.privSpeechProcessorScript) {
                const workletScript = `class SP extends AudioWorkletProcessor {
                    constructor(options) {
                      super(options);
                    }
                    process(inputs, outputs) {
                      const input = inputs[0];
                      const output = [];
                      for (let channel = 0; channel < input.length; channel += 1) {
                        output[channel] = input[channel];
                      }
                      this.port.postMessage(output[0]);
                      return true;
                    }
                  }
                  registerProcessor('speech-processor', SP);`;
                const blob = new Blob([workletScript], { type: "application/javascript; charset=utf-8" });
                this.privSpeechProcessorScript = URL.createObjectURL(blob);
            }
            context.audioWorklet
                .addModule(this.privSpeechProcessorScript)
                .then(() => {
                const workletNode = new AudioWorkletNode(context, "speech-processor");
                workletNode.port.onmessage = (ev) => {
                    const inputFrame = ev.data;
                    if (outputStream && !outputStream.isClosed) {
                        const waveFrame = waveStreamEncoder.encode(inputFrame);
                        if (!!waveFrame) {
                            outputStream.writeStreamChunk({
                                buffer: waveFrame,
                                isEnd: false,
                                timeReceived: Date.now(),
                            });
                        }
                    }
                };
                micInput.connect(workletNode);
                workletNode.connect(context.destination);
                this.privMediaResources = {
                    scriptProcessorNode: workletNode,
                    source: micInput,
                    stream: mediaStream,
                };
            })
                .catch(() => {
                attachScriptProcessor();
            });
        }
        else {
            try {
                attachScriptProcessor();
            }
            catch (err) {
                throw new Error(`Unable to start audio worklet node for PCMRecorder: ${err}`);
            }
        }
    }
    releaseMediaResources(context) {
        if (this.privMediaResources) {
            if (this.privMediaResources.scriptProcessorNode) {
                this.privMediaResources.scriptProcessorNode.disconnect(context.destination);
                this.privMediaResources.scriptProcessorNode = null;
            }
            if (this.privMediaResources.source) {
                this.privMediaResources.source.disconnect();
                if (this.privStopInputOnRelease) {
                    this.privMediaResources.stream.getTracks().forEach((track) => track.stop());
                }
                this.privMediaResources.source = null;
            }
        }
    }
    setWorkletUrl(url) {
        this.privSpeechProcessorScript = url;
    }
}
exports.PcmRecorder = PcmRecorder;

//# sourceMappingURL=PCMRecorder.js.map
