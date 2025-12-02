import { DataOperationsProvider } from './dataOperationsProvider';
import { PineconeRecord, RecordMetadata } from './types';
export declare class UpsertCommand<T extends RecordMetadata = RecordMetadata> {
    apiProvider: DataOperationsProvider;
    namespace: string;
    constructor(apiProvider: any, namespace: any);
    validator: (records: Array<PineconeRecord<T>>) => void;
    run(records: Array<PineconeRecord<T>>): Promise<void>;
}
