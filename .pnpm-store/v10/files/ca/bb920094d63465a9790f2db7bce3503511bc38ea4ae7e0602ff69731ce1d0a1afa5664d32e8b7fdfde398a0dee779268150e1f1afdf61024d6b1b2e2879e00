import { BatchExecuteStatementCommand, } from "./commands/BatchExecuteStatementCommand";
import { BatchGetCommand } from "./commands/BatchGetCommand";
import { BatchWriteCommand } from "./commands/BatchWriteCommand";
import { DeleteCommand } from "./commands/DeleteCommand";
import { ExecuteStatementCommand, } from "./commands/ExecuteStatementCommand";
import { ExecuteTransactionCommand, } from "./commands/ExecuteTransactionCommand";
import { GetCommand } from "./commands/GetCommand";
import { PutCommand } from "./commands/PutCommand";
import { QueryCommand } from "./commands/QueryCommand";
import { ScanCommand } from "./commands/ScanCommand";
import { TransactGetCommand } from "./commands/TransactGetCommand";
import { TransactWriteCommand, } from "./commands/TransactWriteCommand";
import { UpdateCommand } from "./commands/UpdateCommand";
import { DynamoDBDocumentClient } from "./DynamoDBDocumentClient";
export class DynamoDBDocument extends DynamoDBDocumentClient {
    static from(client, translateConfig) {
        return new DynamoDBDocument(client, translateConfig);
    }
    batchExecuteStatement(args, optionsOrCb, cb) {
        const command = new BatchExecuteStatementCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    batchGet(args, optionsOrCb, cb) {
        const command = new BatchGetCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    batchWrite(args, optionsOrCb, cb) {
        const command = new BatchWriteCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    delete(args, optionsOrCb, cb) {
        const command = new DeleteCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    executeStatement(args, optionsOrCb, cb) {
        const command = new ExecuteStatementCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    executeTransaction(args, optionsOrCb, cb) {
        const command = new ExecuteTransactionCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    get(args, optionsOrCb, cb) {
        const command = new GetCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    put(args, optionsOrCb, cb) {
        const command = new PutCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    query(args, optionsOrCb, cb) {
        const command = new QueryCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    scan(args, optionsOrCb, cb) {
        const command = new ScanCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    transactGet(args, optionsOrCb, cb) {
        const command = new TransactGetCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    transactWrite(args, optionsOrCb, cb) {
        const command = new TransactWriteCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
    update(args, optionsOrCb, cb) {
        const command = new UpdateCommand(args);
        if (typeof optionsOrCb === "function") {
            this.send(command, optionsOrCb);
        }
        else if (typeof cb === "function") {
            if (typeof optionsOrCb !== "object") {
                throw new Error(`Expect http options but get ${typeof optionsOrCb}`);
            }
            this.send(command, optionsOrCb || {}, cb);
        }
        else {
            return this.send(command, optionsOrCb);
        }
    }
}
