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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Conversation = exports.ConversationVisibility = exports.ConversationState = void 0;
const specable_1 = require("../utils/specable");
const client_1 = require("../client");
const parser_1 = __importDefault(require("../parser"));
const patcher_1 = __importDefault(require("../utils/patcher"));
const warnings_1 = __importDefault(require("../warnings"));
const message_1 = require("./message");
;
var ConversationState;
(function (ConversationState) {
    ConversationState["Active"] = "STATE_ACTIVE";
    ConversationState["Archived"] = "STATE_ARCHIVED";
})(ConversationState || (exports.ConversationState = ConversationState = {}));
;
var ConversationVisibility;
(function (ConversationVisibility) {
    ConversationVisibility["Public"] = "VISIBILITY_PUBLIC";
    ConversationVisibility["Private"] = "VISIBILITY_PRIVATE";
})(ConversationVisibility || (exports.ConversationVisibility = ConversationVisibility = {}));
;
;
class Conversation extends specable_1.Specable {
    get messages() { return Object.assign({}, this.cachedMessages); }
    get chatId() { return this.chat_id; }
    set chatId(value) { this.chat_id = value; }
    get creationDate() { return new Date(this.create_time); }
    get creatorId() { return this.creator_id; }
    set creatorId(value) { this.creator_id = value; }
    get characterId() { return this.character_id; }
    set characterId(value) { this.character_id = value; }
    // features
    async getCharacter() { return await this.client.fetchCharacter(this.character_id); }
    // currently not available use creatorId instead
    async getCreator() { return await this.client.fetchProfileByUsername(this.creator_id); }
    get preferredModelType() { return this.preferred_model_type; }
    set preferredModelType(value) { this.preferred_model_type = value; }
    // https://neo.character.ai/chat/${id}/preferred-model-type
    /**
     * Sets the model for this character.
     * **CAREFUL**: use `characterAI.getAvailableModels()` for the id
     */
    async setPreferredModelType(modelId) {
        this.client.checkAndThrow(client_1.CheckAndThrow.RequiresAuthentication);
        const request = await this.client.requester.request(`https://neo.character.ai/chat/${this.chatId}/preferred-model-type`, {
            method: 'PATCH',
            includeAuthorization: true,
            body: parser_1.default.stringify({ preferred_model_type: modelId })
        });
        const response = await parser_1.default.parseJSON(request);
        if (!request.ok)
            throw new Error(String(response));
        this.preferredModelType = modelId;
    }
    // (in cache)
    getLastMessage() {
        return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
    }
    async getTurnsBatch(nextToken, pinnedOnly) {
        let query = "";
        if (nextToken)
            query = `?next_token=${encodeURIComponent(nextToken)}`; // }
        if (pinnedOnly)
            query = "?pinned_only=true";
        // console.log(`https://neo.character.ai/turns/${this.chatId}/${query}`);
        const request = await this.client.requester.request(`https://neo.character.ai/turns/${this.chatId}/${query}`, {
            method: 'GET',
            includeAuthorization: true
        });
        const response = await parser_1.default.parseJSON(request);
        if (!request.ok)
            throw new Error(response);
        return response;
    }
    // responsible for checking if we reached the limit to avoid too much memory usage
    addMessage(message) {
        // messages are always ranked from more recent to oldest
        if (this.processingMessages.length >= this.maxMessagesStored) {
            // remove last & show warning
            this.processingMessages.pop();
            this.processingMessages.pop();
            warnings_1.default.show("reachedMaxMessages");
        }
        // add to front
        this.processingMessages.unshift(message);
        this.messageIds.unshift(message.turnId);
        this.cachedMessages = this.processingMessages;
        return message;
    }
    async fetchMessagesViaQuery(pinnedOnly, maxMessages = this.maxMessagesStored) {
        var _a;
        const { maxMessagesStored } = this;
        if (maxMessagesStored % 50 != 0)
            throw Error("Max messages to store must be a multiple of 50.");
        let messages = [];
        let nextToken = undefined;
        for (let i = 0; i < maxMessages / 50; i += 50) {
            const response = await this.getTurnsBatch(nextToken, pinnedOnly);
            const { turns } = response;
            if (!turns)
                break;
            if (turns["length"] == 0)
                break;
            nextToken = (_a = response === null || response === void 0 ? void 0 : response.meta) === null || _a === void 0 ? void 0 : _a.next_token;
            for (let j = 0; j < turns.length; j++)
                messages.push(new message_1.CAIMessage(this.client, this, turns[j]));
        }
        return messages;
    }
    // keeps up to date with messages. this WILL wipe old messages
    async refreshMessages() {
        if (this.frozen)
            return;
        const { maxMessagesStored } = this;
        if (maxMessagesStored % 50 != 0)
            throw Error("Max messages to store must be a multiple of 50.");
        this.frozen = true;
        this.processingMessages = [];
        this.messageIds = [];
        const messages = await this.fetchMessagesViaQuery(false);
        for (let i = 0; i < messages.length; i++)
            this.addMessage(messages[i]);
        const pinnedMessages = await this.getPinnedMessages();
        for (let i = 0; i < pinnedMessages.length; i++)
            this.processingMessages[i].isPinned = true;
        this.cachedMessages = this.processingMessages;
        this.frozen = false;
    }
    async sendMessage(content, options) {
        // DO NOT touch this. This is abstract/virtual behavior for higher level conversations (DM/Group)
        return new message_1.CAIMessage(this.client, this, {});
    }
    async getPinnedMessages() {
        return await this.fetchMessagesViaQuery(true);
    }
    async rename(newName) {
        // This is an abstract placeholder for higher level conversations (DM/Group), do not touch
    }
    async regenerateMessage(message) {
        // This is an abstract placeholder for higher level conversations (DM/Group), do not touch
        return new message_1.CAIMessage(this.client, new Conversation(this.client, {}), {});
    }
    async reset() { return await this.deleteMessagesInBulk(await this.fetchMessagesViaQuery(false, 999999)); }
    async deleteTurns(turnIds, refreshMessages) {
        await this.client.sendDMWebsocketCommandAsync({
            command: "remove_turns",
            originId: "Android",
            streaming: false,
            waitForAIResponse: false,
            payload: {
                chat_id: this.chatId,
                turn_ids: turnIds
            }
        });
        if (refreshMessages)
            await this.refreshMessages();
    }
    async deleteMessagesInBulk(input, refreshMessages = true) {
        this.client.checkAndThrow(client_1.CheckAndThrow.RequiresAuthentication);
        warnings_1.default.show('deletingInBulk');
        let turnIds = [];
        if (typeof input == 'number') {
            if (input <= 0 || input >= this.maxMessagesStored)
                throw new Error("Invalid deletion range. The input number must be positive and reach within your messageCache limit.");
            // 200 - 50 for example
            const messageCount = this.messages.length;
            const fetchedMessages = this.messages.slice(messageCount - input, messageCount);
            turnIds = fetchedMessages.map(message => message.turnId);
        }
        else if (Array.isArray(input)) {
            // if its a string instance, just copy and paste
            let assumedArray = input;
            if (assumedArray.every(item => typeof item === 'string'))
                turnIds = assumedArray;
            // if instance, get all ids
            if (assumedArray.every(item => item instanceof message_1.CAIMessage))
                turnIds = assumedArray.map(message => message.turnId);
        }
        if (turnIds.length == 0)
            return;
        return await this.deleteTurns(turnIds, refreshMessages);
    }
    async deleteMessageById(turnId, refreshMessages = true) {
        this.client.checkAndThrow(client_1.CheckAndThrow.RequiresAuthentication);
        return await this.deleteMessagesInBulk([turnId], refreshMessages);
    }
    async deleteMessage(message, refreshMessages = true) { return this.deleteMessageById(message.turnId, refreshMessages); }
    constructor(client, information) {
        super();
        // max messages stored before it enters into a snake like thing to delete the oldest messages from memory. 
        // must be a multiple of 50.
        this.maxMessagesStored = 200;
        this.cachedMessages = [];
        this.processingMessages = [];
        this.messageIds = [];
        // chat_id
        this.chat_id = "";
        // create_time
        this.create_time = "";
        // creator_id
        this.creator_id = "";
        // character_id
        this.character_id = "";
        // state
        this.state = ConversationState.Active;
        // type
        this.type = "TYPE_ONE_ON_ONE";
        // visibility
        this.visibility = ConversationVisibility.Private;
        // preferred_model_type
        this.preferred_model_type = "";
        this.frozen = false; // <- if refreshing, operations will be frozen
        this.client = client;
        patcher_1.default.patch(this.client, this, information);
    }
}
exports.Conversation = Conversation;
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", client_1.CharacterAI)
], Conversation.prototype, "client", void 0);
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", Object)
], Conversation.prototype, "maxMessagesStored", void 0);
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", Array)
], Conversation.prototype, "cachedMessages", void 0);
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", Array)
], Conversation.prototype, "processingMessages", void 0);
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", Array)
], Conversation.prototype, "messageIds", void 0);
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", Object)
], Conversation.prototype, "chat_id", void 0);
__decorate([
    specable_1.getterProperty,
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [Object])
], Conversation.prototype, "chatId", null);
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", String)
], Conversation.prototype, "create_time", void 0);
__decorate([
    specable_1.getterProperty,
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [])
], Conversation.prototype, "creationDate", null);
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", Object)
], Conversation.prototype, "creator_id", void 0);
__decorate([
    specable_1.getterProperty,
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [Object])
], Conversation.prototype, "creatorId", null);
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", Object)
], Conversation.prototype, "character_id", void 0);
__decorate([
    specable_1.getterProperty,
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [Object])
], Conversation.prototype, "characterId", null);
__decorate([
    specable_1.hiddenProperty,
    __metadata("design:type", Object)
], Conversation.prototype, "preferred_model_type", void 0);
__decorate([
    specable_1.getterProperty,
    __metadata("design:type", Object),
    __metadata("design:paramtypes", [Object])
], Conversation.prototype, "preferredModelType", null);
;
//# sourceMappingURL=conversation.js.map