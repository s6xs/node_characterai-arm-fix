"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const call_1 = require("../character/call");
const client_1 = require("../client");
const parser_1 = __importDefault(require("../parser"));
const warnings_1 = __importDefault(require("../warnings"));
const conversation_1 = require("./conversation");
const message_1 = require("./message");
const uuid_1 = require("uuid");
const generateBaseMessagePayload = (characterId, username) => {
    return {
        character_id: characterId,
        selected_language: "",
        tts_enabled: false,
        user_name: username,
        previous_annotations: {
            boring: 0,
            not_boring: 0,
            inaccurate: 0,
            not_inaccurate: 0,
            repetitive: 0,
            not_repetitive: 0,
            out_of_character: 0,
            not_out_of_character: 0,
            bad_memory: 0,
            not_bad_memory: 0,
            long: 0,
            not_long: 0,
            short: 0,
            not_short: 0,
            ends_chat_early: 0,
            not_ends_chat_early: 0,
            funny: 0,
            not_funny: 0,
            interesting: 0,
            not_interesting: 0,
            helpful: 0,
            not_helpful: 0
        }
    };
};
const generateBaseSendingPayload = (message, characterId, username, // our username
turnId, chatId, userId, imageUrl) => {
    return Object.assign(Object.assign({}, generateBaseMessagePayload(characterId, username)), { num_candidates: 1, turn: {
            turn_key: { turn_id: turnId, chat_id: chatId },
            author: { author_id: userId.toString(), is_human: true, name: username },
            candidates: [Object.assign({ candidate_id: turnId, raw_content: message }, imageUrl ? { tti_image_rel_path: imageUrl } : {})],
            primary_candidate_id: turnId
        } });
};
const generateBaseRegeneratingPayload = (characterId, turnId, username, // our username
chatId) => {
    return Object.assign(Object.assign({}, generateBaseMessagePayload(characterId, username)), { turn_key: { turn_id: turnId, chat_id: chatId } });
};
class DMConversation extends conversation_1.Conversation {
    async resurrect() {
        const resurectionRequest = await this.client.requester.request(`https://neo.character.ai/chats/recent/${this.chatId}`, {
            method: 'GET',
            includeAuthorization: true
        });
        const resurectionResponse = await parser_1.default.parseJSON(resurectionRequest);
        if (!resurectionRequest.ok)
            throw new Error(resurectionResponse);
    }
    async archive() {
        this.client.checkAndThrow(client_1.CheckAndThrow.RequiresAuthentication);
        const request = await this.client.requester.request(`https://neo.character.ai/chat/${this.chatId}/archive`, {
            method: 'PATCH',
            includeAuthorization: true,
            contentType: 'application/json'
        });
        const response = await parser_1.default.parseJSON(request);
        if (!request.ok)
            throw new Error(response);
    }
    async unarchive(refreshMessagesAfter = true) {
        this.client.checkAndThrow(client_1.CheckAndThrow.RequiresAuthentication);
        const request = await this.client.requester.request(`https://neo.character.ai/chat/${this.chatId}/unarchive`, {
            method: 'PATCH',
            includeAuthorization: true,
            contentType: 'application/json'
        });
        const response = await parser_1.default.parseJSON(request);
        if (!request.ok)
            throw new Error(response);
        if (!refreshMessagesAfter)
            return;
        await this.resurrect();
        await this.refreshMessages();
    }
    async duplicate() {
        await this.refreshMessages();
        const lastMessage = this.getLastMessage();
        if (!lastMessage)
            throw new Error("You must have atleast one message in the conversation to do this");
        return await lastMessage.copyFromHere(true);
    }
    async rename(newName) {
        this.client.checkAndThrow(client_1.CheckAndThrow.RequiresAuthentication);
        const request = await this.client.requester.request(`https://neo.character.ai/chat/${this.chatId}/update_name`, {
            method: 'PATCH',
            includeAuthorization: true,
            body: parser_1.default.stringify({ name: newName }),
            contentType: 'application/json'
        });
        const response = await parser_1.default.parseJSON(request);
        if (!request.ok)
            throw new Error(response);
    }
    async call(options) {
        // oh boy im hyped for this
        const call = new call_1.CAICall(this.client, this);
        return await this.client.connectToCall(call, options);
    }
    async sendMessage(content, options) {
        var _a, _b, _c;
        this.client.checkAndThrow(client_1.CheckAndThrow.RequiresAuthentication);
        if (this.frozen)
            warnings_1.default.show("sendingFrozen");
        // manual turn is FALSE by default
        const request = await this.client.sendDMWebsocketCommandAsync({
            command: ((_a = options === null || options === void 0 ? void 0 : options.manualTurn) !== null && _a !== void 0 ? _a : false) ? "create_chat" : "create_and_generate_turn",
            originId: "Android",
            streaming: false,
            payload: generateBaseSendingPayload(content, this.characterId, this.client.myProfile.username, (0, uuid_1.v4)(), this.chatId, this.client.myProfile.userId, (_c = (_b = options === null || options === void 0 ? void 0 : options.image) === null || _b === void 0 ? void 0 : _b.endpointUrl) !== null && _c !== void 0 ? _c : "")
        });
        // here we should receive OUR message not theirs if selected. im not sure how to do this but i will see
        return this.addMessage(new message_1.CAIMessage(this.client, this, request.turn));
    }
    async regenerateMessage(message) {
        this.client.checkAndThrow(client_1.CheckAndThrow.RequiresAuthentication);
        const request = await this.client.sendDMWebsocketCommandAsync({
            command: "generate_turn_candidate",
            originId: "Android",
            streaming: false,
            payload: generateBaseRegeneratingPayload(this.characterId, message.turnId, this.client.myProfile.username, this.chatId)
        });
        message.indexTurn(request.turn);
        return message;
    }
}
exports.default = DMConversation;
;
//# sourceMappingURL=dmConversation.js.map