import { createAggregatedClient } from "@smithy/smithy-client";
import { CreateIndexCommand } from "./commands/CreateIndexCommand";
import { CreateVectorBucketCommand, } from "./commands/CreateVectorBucketCommand";
import { DeleteIndexCommand } from "./commands/DeleteIndexCommand";
import { DeleteVectorBucketCommand, } from "./commands/DeleteVectorBucketCommand";
import { DeleteVectorBucketPolicyCommand, } from "./commands/DeleteVectorBucketPolicyCommand";
import { DeleteVectorsCommand, } from "./commands/DeleteVectorsCommand";
import { GetIndexCommand } from "./commands/GetIndexCommand";
import { GetVectorBucketCommand, } from "./commands/GetVectorBucketCommand";
import { GetVectorBucketPolicyCommand, } from "./commands/GetVectorBucketPolicyCommand";
import { GetVectorsCommand } from "./commands/GetVectorsCommand";
import { ListIndexesCommand } from "./commands/ListIndexesCommand";
import { ListVectorBucketsCommand, } from "./commands/ListVectorBucketsCommand";
import { ListVectorsCommand } from "./commands/ListVectorsCommand";
import { PutVectorBucketPolicyCommand, } from "./commands/PutVectorBucketPolicyCommand";
import { PutVectorsCommand } from "./commands/PutVectorsCommand";
import { QueryVectorsCommand, } from "./commands/QueryVectorsCommand";
import { S3VectorsClient } from "./S3VectorsClient";
const commands = {
    CreateIndexCommand,
    CreateVectorBucketCommand,
    DeleteIndexCommand,
    DeleteVectorBucketCommand,
    DeleteVectorBucketPolicyCommand,
    DeleteVectorsCommand,
    GetIndexCommand,
    GetVectorBucketCommand,
    GetVectorBucketPolicyCommand,
    GetVectorsCommand,
    ListIndexesCommand,
    ListVectorBucketsCommand,
    ListVectorsCommand,
    PutVectorBucketPolicyCommand,
    PutVectorsCommand,
    QueryVectorsCommand,
};
export class S3Vectors extends S3VectorsClient {
}
createAggregatedClient(commands, S3Vectors);
