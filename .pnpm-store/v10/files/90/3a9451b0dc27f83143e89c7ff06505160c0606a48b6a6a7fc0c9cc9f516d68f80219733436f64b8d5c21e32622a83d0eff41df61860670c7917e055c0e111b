export declare class SpeechServiceConfig {
    private context;
    private recognition;
    constructor(context: Context);
    serialize(): string;
    get Context(): Context;
    get Recognition(): string;
    set Recognition(value: string);
}
export declare class Context {
    system: System;
    os: OS;
    audio: ISpeechConfigAudio;
    synthesis: {
        video: ISynthesisSectionVideo;
    };
    constructor(os: OS);
}
export declare class System {
    name: string;
    version: string;
    build: string;
    lang: string;
    constructor();
}
export declare class OS {
    platform: string;
    name: string;
    version: string;
    constructor(platform: string, name: string, version: string);
}
export declare class Device {
    manufacturer: string;
    model: string;
    version: string;
    constructor(manufacturer: string, model: string, version: string);
}
export interface ISpeechConfigAudio {
    source?: ISpeechConfigAudioDevice;
    playback?: ISpeechConfigAudioDevice;
}
export interface ISpeechConfigAudioDevice {
    manufacturer: string;
    model: string;
    connectivity: connectivity;
    type: type;
    samplerate: number;
    bitspersample: number;
    channelcount: number;
}
export declare enum connectivity {
    Bluetooth = "Bluetooth",
    Wired = "Wired",
    WiFi = "WiFi",
    Cellular = "Cellular",
    InBuilt = "InBuilt",
    Unknown = "Unknown"
}
export declare enum type {
    Phone = "Phone",
    Speaker = "Speaker",
    Car = "Car",
    Headset = "Headset",
    Thermostat = "Thermostat",
    Microphones = "Microphones",
    Deskphone = "Deskphone",
    RemoteControl = "RemoteControl",
    Unknown = "Unknown",
    File = "File",
    Stream = "Stream"
}
export interface ICoordinate {
    x: number;
    y: number;
}
export interface ISynthesisSectionVideo {
    protocol: {
        name: string;
        webrtcConfig: {
            clientDescription: string;
            iceServers: {
                urls: string[];
                username: string;
                credential: string;
            }[];
        };
    };
    format: {
        bitrate: number;
        codec: string;
        crop: {
            topLeft: ICoordinate;
            bottomRight: ICoordinate;
        };
        resolution: {
            width: number;
            height: number;
        };
    };
    talkingAvatar: {
        character: string;
        customized: boolean;
        useBuiltInVoice: boolean;
        style: string;
        background: {
            color: string;
        };
    };
}
