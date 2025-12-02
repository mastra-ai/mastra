"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarSynthesisAdapter = void 0;
const Exports_js_1 = require("../sdk/Exports.js");
const Exports_js_2 = require("./Exports.js");
class AvatarSynthesisAdapter extends Exports_js_2.SynthesisAdapterBase {
    constructor(authentication, connectionFactory, synthesizerConfig, avatarSynthesizer, avatarConfig) {
        super(authentication, connectionFactory, synthesizerConfig, undefined);
        this.privAvatarSynthesizer = avatarSynthesizer;
        this.privSynthesizer = avatarSynthesizer;
        this.privAvatarConfig = avatarConfig;
    }
    setSynthesisContextSynthesisSection() {
        this.privSynthesisContext.setSynthesisSection(undefined);
    }
    setSpeechConfigSynthesisSection() {
        this.privSynthesizerConfig.synthesisVideoSection = {
            format: {
                bitrate: this.privAvatarConfig.videoFormat?.bitrate,
                codec: this.privAvatarConfig.videoFormat?.codec,
                crop: {
                    bottomRight: {
                        x: this.privAvatarConfig.videoFormat?.cropRange?.bottomRight?.x,
                        y: this.privAvatarConfig.videoFormat?.cropRange?.bottomRight?.y,
                    },
                    topLeft: {
                        x: this.privAvatarConfig.videoFormat?.cropRange?.topLeft?.x,
                        y: this.privAvatarConfig.videoFormat?.cropRange?.topLeft?.y,
                    },
                },
                resolution: {
                    height: this.privAvatarConfig.videoFormat?.height,
                    width: this.privAvatarConfig.videoFormat?.width,
                },
            },
            protocol: {
                name: "WebRTC",
                webrtcConfig: {
                    clientDescription: btoa(this.privSynthesizerConfig.parameters.getProperty(Exports_js_1.PropertyId.TalkingAvatarService_WebRTC_SDP)),
                    iceServers: this.privAvatarConfig.remoteIceServers ?? this.privAvatarSynthesizer.iceServers,
                },
            },
            talkingAvatar: {
                background: {
                    color: this.privAvatarConfig.backgroundColor,
                    image: {
                        url: this.privAvatarConfig.backgroundImage?.toString(),
                    }
                },
                character: this.privAvatarConfig.character,
                customized: this.privAvatarConfig.customized,
                style: this.privAvatarConfig.style,
                useBuiltInVoice: this.privAvatarConfig.useBuiltInVoice,
            }
        };
    }
    onAvatarEvent(metadata) {
        if (!!this.privAvatarSynthesizer.avatarEventReceived) {
            const avatarEventArgs = new Exports_js_1.AvatarEventArgs(metadata.Data.Offset, metadata.Data.Name);
            try {
                this.privAvatarSynthesizer.avatarEventReceived(this.privAvatarSynthesizer, avatarEventArgs);
            }
            catch (error) {
                // Not going to let errors in the event handler
                // trip things up.
            }
        }
    }
}
exports.AvatarSynthesisAdapter = AvatarSynthesisAdapter;

//# sourceMappingURL=AvatarSynthesisAdapter.js.map
