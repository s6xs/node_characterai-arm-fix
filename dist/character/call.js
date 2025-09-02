"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAICall = void 0;
const client_1 = require("../client");
const parser_1 = __importDefault(require("../parser"));
const specable_1 = require("../utils/specable");
const stream_1 = require("stream");
const rtc_node_1 = require("@livekit/rtc-node");
const path_1 = __importDefault(require("path"));
const dmConversation_1 = __importDefault(require("../chat/dmConversation"));
const fs_1 = __importDefault(require("fs"));
const audioInterface_1 = __importDefault(require("./audioInterface"));
const child_process_1 = require("child_process");
const naudiodon_arm_rpi_1 = require("naudiodon-arm-rpi");
const warnings_1 = __importDefault(require("../warnings"));
let isSoxAvailable = null;
function checkIfSoxIsInstalled() {
    return new Promise(resolve => (0, child_process_1.exec)('sox --version', error => resolve(!error)));
}
function getDeviceId(type, device) {
    var _a, _b, _c, _d;
    if (device == 'default' || device == undefined)
        return -1;
    let method;
    switch (typeof device) {
        case 'number':
            method = type == 'microphone' ? audioInterface_1.default.getMicrophoneFromId : audioInterface_1.default.getSpeakerFromId;
            return (_b = (_a = method(device)) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : Error(`Cannot find ${type} device with the id ${device}`);
        case 'string':
            method = type == 'microphone' ? audioInterface_1.default.getMicrophoneFromName : audioInterface_1.default.getSpeakerFromName;
            return (_d = (_c = method(device)) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : Error(`Cannot find ${type} device with the name ${device}`);
    }
    return -1;
}
function spawnProcessTool(command, ffDebug) {
    const childProcess = (0, child_process_1.spawn)(command, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
    });
    if (ffDebug)
        childProcess.stderr.on('data', data => console.error(`ff stderr: ${data.toString()}`));
    // events
    if (ffDebug)
        childProcess.on('error', error => console.error(`Error executing command: ${error}`));
    return childProcess;
}
class CAICall extends specable_1.EventEmitterSpecable {
    resetStreams() {
        this.inputStream = new stream_1.PassThrough();
        this.outputStream = new stream_1.PassThrough();
        this.liveKitInputStream = new stream_1.PassThrough();
    }
    callForBackgroundConversationRefresh() {
        (async () => { var _a; return await ((_a = this.conversation) === null || _a === void 0 ? void 0 : _a.refreshMessages()); })();
    }
    async connectToSession(options, token, username) {
        var _a;
        this.client.checkAndThrow(client_1.CheckAndThrow.RequiresAuthentication);
        if (this.client.currentCall != this)
            throw new Error("You are connected into another call that isn't this one. Please disconnect from that one first because CharacterAI restricts to only 1 call per person.");
        if (this.liveKitRoom)
            throw new Error("You are already connected to this call.");
        this.ready = false;
        this.hasBeenShutDownNormally = false;
        console.log("[node_characterai] Call - WARNING: Experimental feature ahead! Report issues in the GitHub.");
        if (isSoxAvailable == null)
            isSoxAvailable = await checkIfSoxIsInstalled();
        console.log("[node_characterai] Call - Creating session...");
        const { conversation } = this;
        if (!conversation)
            throw Error("No conversation");
        const character = await conversation.getCharacter();
        let voiceQuery = (_a = options.voiceQuery) !== null && _a !== void 0 ? _a : character.displayName;
        if (options.voiceId && options.voiceQuery)
            throw Error("You can either use a specific voiceId or a query. By default, no queries or voiceId will result in query to be auto set to the character's name.");
        !options.voiceId && !options.voiceQuery;
        const request = await this.client.requester.request("https://neo.character.ai/multimodal/api/v1/sessions/joinOrCreateSession", {
            method: 'POST',
            includeAuthorization: true,
            body: parser_1.default.stringify(Object.assign(Object.assign({ roomId: conversation === null || conversation === void 0 ? void 0 : conversation.chatId }, (options.voiceId
                ? { voices: { [character.characterId]: options.voiceId } }
                : { voiceQueries: { [character.characterId]: voiceQuery } })), { rtcBackend: "lk", platform: "web", userAuthToken: token, username, enableASR: true })),
            contentType: 'application/json'
        });
        const response = await parser_1.default.parseJSON(request);
        if (!request.ok)
            throw new Error(String(response));
        const { lkUrl, lkToken, session } = response;
        const liveKitRoom = new rtc_node_1.Room();
        await liveKitRoom.connect(lkUrl, lkToken, { autoSubscribe: true, dynacast: true });
        const { id, roomId } = session;
        this.id = id;
        this.roomId = roomId;
        console.log("[node_characterai] Call - Connecting to room...");
        this.liveKitRoom = liveKitRoom;
        liveKitRoom.on('dataReceived', async (payload) => {
            const decoder = new TextDecoder();
            const data = decoder.decode(payload);
            const jsonData = JSON.parse(data);
            const { event } = jsonData;
            let isUtteranceCandidateFinal = true;
            let isSpeechStarted = false;
            // console.log(jsonData);
            switch (event) {
                // when we talk
                case 'UtteranceCandidate': isUtteranceCandidateFinal = false;
                case 'UtteranceFinalized':
                    isUtteranceCandidateFinal = true;
                    const { text, timestamp, userStopSpeakingTime, ted_confidence: tedConfidence, interruption_confidence: interruptionConfidence } = jsonData;
                    this.emit(isUtteranceCandidateFinal ? 'userSpeechProgress' : 'userSpeechEnded', {
                        text, timestamp, userStopSpeakingTime, tedConfidence, interruptionConfidence
                    });
                    break;
                case 'speechStarted': isSpeechStarted = true;
                case 'speechEnded':
                    const { candidateId } = jsonData;
                    this.latestCandidateId = candidateId;
                    this.isCharacterSpeaking = isSpeechStarted;
                    this.emit(isSpeechStarted ? 'characterBeganSpeaking' : 'characterEndedSpeaking');
                    // call for message refresh when that happens in a separate context
                    if (!isSpeechStarted)
                        this.callForBackgroundConversationRefresh();
                    break;
                case 'ParticipantDisconnected':
                    await this.internalHangup("Participant disconnected");
                    break;
                case 'WaitingForASRUserTrackAcquisition':
                    break;
                // other events:
                // 'ParticipantDisconnected'
                // 'TurnState'
                // 'WaitingForASRUserTrackAcquisition'
            }
        });
        liveKitRoom.on('disconnected', async (disconnectReason) => await this.internalHangup(disconnectReason.toString()));
        return new Promise(resolve => {
            liveKitRoom.once('trackSubscribed', async (track) => {
                if (track.kind != rtc_node_1.TrackKind.KIND_VIDEO &&
                    track.kind != rtc_node_1.TrackKind.KIND_AUDIO)
                    return;
                // 48000 PCM mono data
                const audioSource = new rtc_node_1.AudioSource(48000, 1);
                const audioTrack = rtc_node_1.LocalAudioTrack.createAudioTrack('audio', audioSource);
                if (!liveKitRoom.localParticipant) {
                    await this.internalHangup("Could not find local participant");
                    return;
                }
                await liveKitRoom.localParticipant.publishTrack(audioTrack, new rtc_node_1.TrackPublishOptions({ source: rtc_node_1.TrackSource.SOURCE_MICROPHONE }));
                console.log("[node_characterai] Call - Creating streams...");
                this.resetStreams();
                const { microphoneDevice, speakerDevice } = options;
                let microphoneId = undefined;
                let speakerId = undefined;
                // input
                if (microphoneDevice)
                    microphoneId = getDeviceId('microphone', microphoneDevice);
                // output
                if (speakerDevice)
                    speakerId = getDeviceId('speaker', speakerDevice);
                // input mic/arbitrary data -> pipe:0 -> output pipe:1 pcm data in stdout
                // god, this is awful. i wish i didn't have to do this.
                this.dataProcessCallback = async (data) => {
                    if (this.mute || !data || data.length === 0)
                        return;
                    // convert to int16 array & send 
                    const int16Array = new Int16Array(data.buffer, data.byteOffset, data.byteLength / Int16Array.BYTES_PER_ELEMENT);
                    if (int16Array.length === 0)
                        return;
                    const frame = new rtc_node_1.AudioFrame(int16Array, 48000, 1, int16Array.length);
                    // final audio frame here
                    await audioSource.captureFrame(frame);
                };
                this.liveKitInputStream.on('data', this.dataProcessCallback);
                if (microphoneId) {
                    const microphoneIO = (0, naudiodon_arm_rpi_1.AudioIO)({
                        inOptions: {
                            channelCount: 1,
                            sampleFormat: naudiodon_arm_rpi_1.SampleFormat16Bit,
                            sampleRate: 48000,
                            deviceId: microphoneId,
                            closeOnError: true,
                        }
                    });
                    this.inputMicrophoneIO = microphoneIO;
                    microphoneIO.pipe(this.liveKitInputStream);
                    microphoneIO.start();
                }
                if (speakerId) {
                    const speakerIO = (0, naudiodon_arm_rpi_1.AudioIO)({
                        outOptions: {
                            channelCount: 1,
                            sampleFormat: naudiodon_arm_rpi_1.SampleFormat16Bit,
                            sampleRate: 48000,
                            deviceId: speakerId,
                            closeOnError: true
                        }
                    });
                    this.speakerOutputIO = speakerIO;
                    this.outputStream.pipe(speakerIO);
                    speakerIO.start();
                }
                // start audio processing in different async context
                const stream = new rtc_node_1.AudioStream(track);
                (async () => {
                    var _a, e_1, _b, _c;
                    try {
                        for (var _d = true, stream_2 = __asyncValues(stream), stream_2_1; stream_2_1 = await stream_2.next(), _a = stream_2_1.done, !_a; _d = true) {
                            _c = stream_2_1.value;
                            _d = false;
                            const frame = _c;
                            // send to output ffmpeg
                            this.outputStream.write(frame.data);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (!_d && !_a && (_b = stream_2.return)) await _b.call(stream_2);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                })();
                // this.outputStream.on('data', data => console.log(data));
                this.ready = true;
                console.log("[node_characterai] Call - Call is ready!");
                resolve();
            });
        });
    }
    async playFile(filePath) {
        if (!this.ready)
            throw new Error("Call is not ready yet.");
        const resolvedPath = path_1.default.resolve(filePath.toString());
        if (!fs_1.default.existsSync(resolvedPath))
            throw new Error("Path is invalid");
        if (!isSoxAvailable) {
            warnings_1.default.show('soxNotFound');
            return;
        }
        return new Promise(resolve => {
            var _a;
            spawnProcessTool(`${(_a = audioInterface_1.default.soxPath) !== null && _a !== void 0 ? _a : 'sox'} "${filePath}" -r 48000 -c 1 -b 16 -L -t raw -`, false)
                .stdout.pipe(this.liveKitInputStream);
            resolve();
        });
    }
    get canInterruptCharacter() { return this.latestCandidateId != null; }
    // https://neo.character.ai/multimodal/api/v1/sessions/discardCandidate
    async interruptCharacter() {
        this.client.checkAndThrow(client_1.CheckAndThrow.RequiresToBeInCall);
        if (!this.canInterruptCharacter)
            return;
        const { conversation } = this;
        if (!conversation)
            throw new Error("No conversation");
        const request = await this.client.requester.request("https://neo.character.ai/multimodal/api/v1/sessions/discardCandidate", {
            method: 'POST',
            contentType: 'application/json',
            body: parser_1.default.stringify({ candidateId: this.latestCandidateId, characterId: conversation.characterId, roomId: this.roomId }),
            includeAuthorization: true
        });
        if (!request.ok)
            throw new Error("Could not interrupt character talking");
        this.latestCandidateId = null;
        this.callForBackgroundConversationRefresh();
    }
    async internalHangup(errorReason) {
        var _a;
        if (this.hasBeenShutDownNormally)
            return;
        this.client.currentCall = undefined;
        await ((_a = this.liveKitRoom) === null || _a === void 0 ? void 0 : _a.disconnect());
        this.clean();
        console.log("[node_characterai] Call - Call hung up.");
        if (errorReason)
            throw new Error(`Call error: ${errorReason}`);
    }
    async hangUp() { await this.internalHangup(); }
    clean() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        this.hasBeenShutDownNormally = true;
        (_a = this.liveKitInputStream) === null || _a === void 0 ? void 0 : _a.off('data', this.dataProcessCallback);
        (_b = this.inputStream) === null || _b === void 0 ? void 0 : _b.end();
        (_c = this.outputStream) === null || _c === void 0 ? void 0 : _c.end();
        (_d = this.liveKitInputStream) === null || _d === void 0 ? void 0 : _d.end();
        (_f = (_e = this.inputMicrophoneIO) === null || _e === void 0 ? void 0 : _e.quit) === null || _f === void 0 ? void 0 : _f.call(_e);
        (_h = (_g = this.speakerOutputIO) === null || _g === void 0 ? void 0 : _g.quit) === null || _h === void 0 ? void 0 : _h.call(_g);
        this.inputMicrophoneIO = null;
        this.speakerOutputIO = null;
        delete this.liveKitRoom;
    }
    constructor(client, conversation) {
        super();
        this.liveKitRoom = undefined;
        this.inputStream = new stream_1.PassThrough();
        this.outputStream = new stream_1.PassThrough();
        this.inputMicrophoneIO = null;
        this.speakerOutputIO = null;
        this.mute = false;
        this.id = "";
        this.roomId = "";
        this.latestCandidateId = null;
        this.isCharacterSpeaking = false;
        this.liveKitInputStream = new stream_1.PassThrough();
        this.hasBeenShutDownNormally = false;
        this.ready = false;
        this.client = client;
        this.conversation = conversation;
    }
}
exports.CAICall = CAICall;
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", client_1.CharacterAI)
], CAICall.prototype, "client", void 0);
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", dmConversation_1.default)
], CAICall.prototype, "conversation", void 0);
//# sourceMappingURL=call.js.map