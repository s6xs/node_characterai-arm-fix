import { CharacterAI } from "../client";
import { Character } from "./character";
export declare class RecentCharacter extends Character {
    private chat_id;
    get lastConversationId(): string;
    private create_time;
    get lastConversationDate(): Date;
    removeFromRecents(): Promise<void>;
    getLastDMConversation(): Promise<import("node_characterai-arm-fix/src/chat/dmConversation").default>;
    constructor(client: CharacterAI, information: any);
}
//# sourceMappingURL=recentCharacter.d.ts.map