export class ChatHistoryManager {
    static instance = null;

    constructor(chatRef, setChat) {
        if (ChatHistoryManager.instance) {
            return ChatHistoryManager.instance;
        }

        this.chatRef = chatRef;
        this.setChat = setChat;
        ChatHistoryManager.instance = this;
    }

    static getInstance(chatRef, setChat) {
        if (!ChatHistoryManager.instance) {
            ChatHistoryManager.instance = new ChatHistoryManager(chatRef, setChat);
        } else if (chatRef && setChat) {
            // Update references if they're provided
            ChatHistoryManager.instance.chatRef = chatRef;
            ChatHistoryManager.instance.setChat = setChat;
        }
        return ChatHistoryManager.instance;
    }

    addTextMessage(content) {
        if (!this.chatRef || !this.setChat) {
            console.error("ChatHistoryManager: chatRef or setChat is not initialized");
            return;
        }

        let history = this.chatRef.current?.history || [];
        let updatedChatHistory = [...history];
        let lastTurn = updatedChatHistory[updatedChatHistory.length - 1];

        if (lastTurn !== undefined && lastTurn.role === content.role) {
            // AWS Nova 2 Sonic sends the FULL accumulated text in each textOutput event,
            // not just incremental chunks. So we need to check if the new text contains
            // the old text (meaning it's an update) or if it's truly new content.
            const lastMessage = lastTurn.message || '';
            const newMessage = content.message || '';
            
            if (newMessage.startsWith(lastMessage)) {
                // New text is a continuation - replace with the full new text
                updatedChatHistory[updatedChatHistory.length - 1] = {
                    ...content,
                    message: newMessage
                };
            } else if (lastMessage.startsWith(newMessage)) {
                // New text is shorter (might be a correction) - keep the longer one
                // Don't update
            } else {
                // Different text - append as new content
                updatedChatHistory[updatedChatHistory.length - 1] = {
                    ...content,
                    message: lastMessage + " " + newMessage
                };
            }
        }
        else {
            // Different role, add a new turn
            updatedChatHistory.push({
                role: content.role,
                message: content.message
            });
        }

        this.setChat({
            history: updatedChatHistory
        });
    }

    endTurn() {
        if (!this.chatRef || !this.setChat) {
            console.error("ChatHistoryManager: chatRef or setChat is not initialized");
            return;
        }

        let history = this.chatRef.current?.history || [];
        let updatedChatHistory = history.map(item => {
            return {
                ...item,
                endOfResponse: true
            };
        });

        this.setChat({
            history: updatedChatHistory
        });
    }

    endConversation() {
        if (!this.chatRef || !this.setChat) {
            console.error("ChatHistoryManager: chatRef or setChat is not initialized");
            return;
        }

        let history = this.chatRef.current?.history || [];
        let updatedChatHistory = history.map(item => {
            return {
                ...item,
                endOfResponse: true
            };
        });

        updatedChatHistory.push({
            endOfConversation: true
        });

        this.setChat({
            history: updatedChatHistory
        });
    }
}

export default ChatHistoryManager;

