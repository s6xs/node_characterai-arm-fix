import { CharacterAI } from "../client";
import { EventEmitterSpecable } from "../utils/specable";
import { PassThrough } from "stream";
import DMConversation from "../chat/dmConversation";
import fs from 'fs';
type DeviceType = 'default' | string | number | false;
export interface ICharacterCallOptions {
    /**
     * **Specifies a microphone device/input to use.**
     *
     * You can use `'default'` to specify the default system input device
     * or a `'Device Name'` or the microphone's `id`.
     *
     * Set to `false` to send arbitrary PCM data through the input stream.
     * **Using arbitrary PCM data will go through ffmpeg.**
     * If you wish to play files, use the `playFile()` method instead.
     */
    microphoneDevice: DeviceType;
    speakerDevice: DeviceType;
    voiceId?: string;
    voiceQuery?: string;
}
export declare class CAICall extends EventEmitterSpecable {
    private client;
    private conversation;
    private liveKitRoom?;
    inputStream: PassThrough;
    outputStream: PassThrough;
    private inputMicrophoneIO;
    private speakerOutputIO;
    mute: boolean;
    id: string;
    roomId: string;
    private latestCandidateId;
    isCharacterSpeaking: boolean;
    private liveKitInputStream;
    private dataProcessCallback;
    private hasBeenShutDownNormally;
    ready: boolean;
    private resetStreams;
    private callForBackgroundConversationRefresh;
    connectToSession(options: ICharacterCallOptions, token: string, username: string): Promise<void>;
    playFile(filePath: fs.PathLike): Promise<void>;
    get canInterruptCharacter(): boolean;
    interruptCharacter(): Promise<void>;
    private internalHangup;
    hangUp(): Promise<void>;
    private clean;
    constructor(client: CharacterAI, conversation: DMConversation);
}
export {};
//# sourceMappingURL=call.d.ts.map