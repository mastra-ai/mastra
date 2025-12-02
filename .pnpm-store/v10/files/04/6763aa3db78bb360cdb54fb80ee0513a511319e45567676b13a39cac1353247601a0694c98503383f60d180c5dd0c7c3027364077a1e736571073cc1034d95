export interface MessageStorageEntry<TPayload> {
    id: string;
    parent_id: string | null;
    format: string;
    content: TPayload;
}
export interface MessageFormatItem<TMessage> {
    parentId: string | null;
    message: TMessage;
}
export interface MessageFormatRepository<TMessage> {
    headId?: string | null;
    messages: MessageFormatItem<TMessage>[];
}
export interface MessageFormatAdapter<TMessage, TStorageFormat> {
    format: string;
    encode(item: MessageFormatItem<TMessage>): TStorageFormat;
    decode(stored: MessageStorageEntry<TStorageFormat>): MessageFormatItem<TMessage>;
    getId(message: TMessage): string;
}
//# sourceMappingURL=MessageFormatAdapter.d.ts.map