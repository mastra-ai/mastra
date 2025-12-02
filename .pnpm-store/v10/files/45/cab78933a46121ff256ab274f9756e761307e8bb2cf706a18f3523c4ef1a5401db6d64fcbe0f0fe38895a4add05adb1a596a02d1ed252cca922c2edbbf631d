import { awsExpectUnion as __expectUnion, loadRestJsonErrorCode, parseJsonBody as parseBody, parseJsonErrorBody as parseErrorBody, } from "@aws-sdk/core";
import { HttpRequest as __HttpRequest } from "@smithy/protocol-http";
import { _json, collectBody, decorateServiceException as __decorateServiceException, expectBoolean as __expectBoolean, expectInt32 as __expectInt32, expectLong as __expectLong, expectNonNull as __expectNonNull, expectNumber as __expectNumber, expectString as __expectString, limitedParseDouble as __limitedParseDouble, parseEpochTimestamp as __parseEpochTimestamp, serializeFloat as __serializeFloat, take, withBaseException, } from "@smithy/smithy-client";
import { v4 as generateIdempotencyToken } from "@smithy/uuid";
import { DynamoDBServiceException as __BaseException } from "../models/DynamoDBServiceException";
import { AttributeValue, BackupInUseException, BackupNotFoundException, ConditionalCheckFailedException, ContinuousBackupsUnavailableException, DuplicateItemException, ExportConflictException, ExportNotFoundException, GlobalTableAlreadyExistsException, GlobalTableNotFoundException, IdempotentParameterMismatchException, ImportConflictException, ImportNotFoundException, IndexNotFoundException, InternalServerError, InvalidEndpointException, InvalidExportTimeException, InvalidRestoreTimeException, ItemCollectionSizeLimitExceededException, LimitExceededException, PointInTimeRecoveryUnavailableException, PolicyNotFoundException, ProvisionedThroughputExceededException, ReplicaAlreadyExistsException, ReplicaNotFoundException, ReplicatedWriteConflictException, RequestLimitExceeded, ResourceInUseException, ResourceNotFoundException, TableAlreadyExistsException, TableInUseException, TableNotFoundException, ThrottlingException, TransactionCanceledException, TransactionConflictException, TransactionInProgressException, } from "../models/models_0";
export const se_BatchExecuteStatementCommand = async (input, context) => {
    const headers = sharedHeaders("BatchExecuteStatement");
    let body;
    body = JSON.stringify(se_BatchExecuteStatementInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_BatchGetItemCommand = async (input, context) => {
    const headers = sharedHeaders("BatchGetItem");
    let body;
    body = JSON.stringify(se_BatchGetItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_BatchWriteItemCommand = async (input, context) => {
    const headers = sharedHeaders("BatchWriteItem");
    let body;
    body = JSON.stringify(se_BatchWriteItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_CreateBackupCommand = async (input, context) => {
    const headers = sharedHeaders("CreateBackup");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_CreateGlobalTableCommand = async (input, context) => {
    const headers = sharedHeaders("CreateGlobalTable");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_CreateTableCommand = async (input, context) => {
    const headers = sharedHeaders("CreateTable");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DeleteBackupCommand = async (input, context) => {
    const headers = sharedHeaders("DeleteBackup");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DeleteItemCommand = async (input, context) => {
    const headers = sharedHeaders("DeleteItem");
    let body;
    body = JSON.stringify(se_DeleteItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DeleteResourcePolicyCommand = async (input, context) => {
    const headers = sharedHeaders("DeleteResourcePolicy");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DeleteTableCommand = async (input, context) => {
    const headers = sharedHeaders("DeleteTable");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeBackupCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeBackup");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeContinuousBackupsCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeContinuousBackups");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeContributorInsightsCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeContributorInsights");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeEndpointsCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeEndpoints");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeExportCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeExport");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeGlobalTableCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeGlobalTable");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeGlobalTableSettingsCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeGlobalTableSettings");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeImportCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeImport");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeKinesisStreamingDestinationCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeKinesisStreamingDestination");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeLimitsCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeLimits");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeTableCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeTable");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeTableReplicaAutoScalingCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeTableReplicaAutoScaling");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DescribeTimeToLiveCommand = async (input, context) => {
    const headers = sharedHeaders("DescribeTimeToLive");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_DisableKinesisStreamingDestinationCommand = async (input, context) => {
    const headers = sharedHeaders("DisableKinesisStreamingDestination");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_EnableKinesisStreamingDestinationCommand = async (input, context) => {
    const headers = sharedHeaders("EnableKinesisStreamingDestination");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ExecuteStatementCommand = async (input, context) => {
    const headers = sharedHeaders("ExecuteStatement");
    let body;
    body = JSON.stringify(se_ExecuteStatementInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ExecuteTransactionCommand = async (input, context) => {
    const headers = sharedHeaders("ExecuteTransaction");
    let body;
    body = JSON.stringify(se_ExecuteTransactionInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ExportTableToPointInTimeCommand = async (input, context) => {
    const headers = sharedHeaders("ExportTableToPointInTime");
    let body;
    body = JSON.stringify(se_ExportTableToPointInTimeInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_GetItemCommand = async (input, context) => {
    const headers = sharedHeaders("GetItem");
    let body;
    body = JSON.stringify(se_GetItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_GetResourcePolicyCommand = async (input, context) => {
    const headers = sharedHeaders("GetResourcePolicy");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ImportTableCommand = async (input, context) => {
    const headers = sharedHeaders("ImportTable");
    let body;
    body = JSON.stringify(se_ImportTableInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ListBackupsCommand = async (input, context) => {
    const headers = sharedHeaders("ListBackups");
    let body;
    body = JSON.stringify(se_ListBackupsInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ListContributorInsightsCommand = async (input, context) => {
    const headers = sharedHeaders("ListContributorInsights");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ListExportsCommand = async (input, context) => {
    const headers = sharedHeaders("ListExports");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ListGlobalTablesCommand = async (input, context) => {
    const headers = sharedHeaders("ListGlobalTables");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ListImportsCommand = async (input, context) => {
    const headers = sharedHeaders("ListImports");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ListTablesCommand = async (input, context) => {
    const headers = sharedHeaders("ListTables");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ListTagsOfResourceCommand = async (input, context) => {
    const headers = sharedHeaders("ListTagsOfResource");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_PutItemCommand = async (input, context) => {
    const headers = sharedHeaders("PutItem");
    let body;
    body = JSON.stringify(se_PutItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_PutResourcePolicyCommand = async (input, context) => {
    const headers = sharedHeaders("PutResourcePolicy");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_QueryCommand = async (input, context) => {
    const headers = sharedHeaders("Query");
    let body;
    body = JSON.stringify(se_QueryInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_RestoreTableFromBackupCommand = async (input, context) => {
    const headers = sharedHeaders("RestoreTableFromBackup");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_RestoreTableToPointInTimeCommand = async (input, context) => {
    const headers = sharedHeaders("RestoreTableToPointInTime");
    let body;
    body = JSON.stringify(se_RestoreTableToPointInTimeInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_ScanCommand = async (input, context) => {
    const headers = sharedHeaders("Scan");
    let body;
    body = JSON.stringify(se_ScanInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_TagResourceCommand = async (input, context) => {
    const headers = sharedHeaders("TagResource");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_TransactGetItemsCommand = async (input, context) => {
    const headers = sharedHeaders("TransactGetItems");
    let body;
    body = JSON.stringify(se_TransactGetItemsInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_TransactWriteItemsCommand = async (input, context) => {
    const headers = sharedHeaders("TransactWriteItems");
    let body;
    body = JSON.stringify(se_TransactWriteItemsInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_UntagResourceCommand = async (input, context) => {
    const headers = sharedHeaders("UntagResource");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_UpdateContinuousBackupsCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateContinuousBackups");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_UpdateContributorInsightsCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateContributorInsights");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_UpdateGlobalTableCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateGlobalTable");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_UpdateGlobalTableSettingsCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateGlobalTableSettings");
    let body;
    body = JSON.stringify(se_UpdateGlobalTableSettingsInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_UpdateItemCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateItem");
    let body;
    body = JSON.stringify(se_UpdateItemInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_UpdateKinesisStreamingDestinationCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateKinesisStreamingDestination");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_UpdateTableCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateTable");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_UpdateTableReplicaAutoScalingCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateTableReplicaAutoScaling");
    let body;
    body = JSON.stringify(se_UpdateTableReplicaAutoScalingInput(input, context));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const se_UpdateTimeToLiveCommand = async (input, context) => {
    const headers = sharedHeaders("UpdateTimeToLive");
    let body;
    body = JSON.stringify(_json(input));
    return buildHttpRpcRequest(context, headers, "/", undefined, body);
};
export const de_BatchExecuteStatementCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_BatchExecuteStatementOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_BatchGetItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_BatchGetItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_BatchWriteItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_BatchWriteItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_CreateBackupCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_CreateBackupOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_CreateGlobalTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_CreateGlobalTableOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_CreateTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_CreateTableOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DeleteBackupCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DeleteBackupOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DeleteItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DeleteItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DeleteResourcePolicyCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DeleteTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DeleteTableOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeBackupCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DescribeBackupOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeContinuousBackupsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DescribeContinuousBackupsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeContributorInsightsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DescribeContributorInsightsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeEndpointsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeExportCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DescribeExportOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeGlobalTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DescribeGlobalTableOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeGlobalTableSettingsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DescribeGlobalTableSettingsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeImportCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DescribeImportOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeKinesisStreamingDestinationCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeLimitsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DescribeTableOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeTableReplicaAutoScalingCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_DescribeTableReplicaAutoScalingOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DescribeTimeToLiveCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_DisableKinesisStreamingDestinationCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_EnableKinesisStreamingDestinationCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ExecuteStatementCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ExecuteStatementOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ExecuteTransactionCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ExecuteTransactionOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ExportTableToPointInTimeCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ExportTableToPointInTimeOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_GetItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_GetItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_GetResourcePolicyCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ImportTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ImportTableOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ListBackupsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ListBackupsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ListContributorInsightsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ListExportsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ListGlobalTablesCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ListImportsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ListImportsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ListTablesCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ListTagsOfResourceCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_PutItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_PutItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_PutResourcePolicyCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_QueryCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_QueryOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_RestoreTableFromBackupCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_RestoreTableFromBackupOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_RestoreTableToPointInTimeCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_RestoreTableToPointInTimeOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_ScanCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_ScanOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_TagResourceCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    await collectBody(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
export const de_TransactGetItemsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_TransactGetItemsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_TransactWriteItemsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_TransactWriteItemsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_UntagResourceCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    await collectBody(output.body, context);
    const response = {
        $metadata: deserializeMetadata(output),
    };
    return response;
};
export const de_UpdateContinuousBackupsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_UpdateContinuousBackupsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_UpdateContributorInsightsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_UpdateGlobalTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_UpdateGlobalTableOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_UpdateGlobalTableSettingsCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_UpdateGlobalTableSettingsOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_UpdateItemCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_UpdateItemOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_UpdateKinesisStreamingDestinationCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_UpdateTableCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_UpdateTableOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_UpdateTableReplicaAutoScalingCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = de_UpdateTableReplicaAutoScalingOutput(data, context);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
export const de_UpdateTimeToLiveCommand = async (output, context) => {
    if (output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const data = await parseBody(output.body, context);
    let contents = {};
    contents = _json(data);
    const response = {
        $metadata: deserializeMetadata(output),
        ...contents,
    };
    return response;
};
const de_CommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadRestJsonErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "InternalServerError":
        case "com.amazonaws.dynamodb#InternalServerError":
            throw await de_InternalServerErrorRes(parsedOutput, context);
        case "RequestLimitExceeded":
        case "com.amazonaws.dynamodb#RequestLimitExceeded":
            throw await de_RequestLimitExceededRes(parsedOutput, context);
        case "ThrottlingException":
        case "com.amazonaws.dynamodb#ThrottlingException":
            throw await de_ThrottlingExceptionRes(parsedOutput, context);
        case "InvalidEndpointException":
        case "com.amazonaws.dynamodb#InvalidEndpointException":
            throw await de_InvalidEndpointExceptionRes(parsedOutput, context);
        case "ProvisionedThroughputExceededException":
        case "com.amazonaws.dynamodb#ProvisionedThroughputExceededException":
            throw await de_ProvisionedThroughputExceededExceptionRes(parsedOutput, context);
        case "ResourceNotFoundException":
        case "com.amazonaws.dynamodb#ResourceNotFoundException":
            throw await de_ResourceNotFoundExceptionRes(parsedOutput, context);
        case "ItemCollectionSizeLimitExceededException":
        case "com.amazonaws.dynamodb#ItemCollectionSizeLimitExceededException":
            throw await de_ItemCollectionSizeLimitExceededExceptionRes(parsedOutput, context);
        case "ReplicatedWriteConflictException":
        case "com.amazonaws.dynamodb#ReplicatedWriteConflictException":
            throw await de_ReplicatedWriteConflictExceptionRes(parsedOutput, context);
        case "BackupInUseException":
        case "com.amazonaws.dynamodb#BackupInUseException":
            throw await de_BackupInUseExceptionRes(parsedOutput, context);
        case "ContinuousBackupsUnavailableException":
        case "com.amazonaws.dynamodb#ContinuousBackupsUnavailableException":
            throw await de_ContinuousBackupsUnavailableExceptionRes(parsedOutput, context);
        case "LimitExceededException":
        case "com.amazonaws.dynamodb#LimitExceededException":
            throw await de_LimitExceededExceptionRes(parsedOutput, context);
        case "TableInUseException":
        case "com.amazonaws.dynamodb#TableInUseException":
            throw await de_TableInUseExceptionRes(parsedOutput, context);
        case "TableNotFoundException":
        case "com.amazonaws.dynamodb#TableNotFoundException":
            throw await de_TableNotFoundExceptionRes(parsedOutput, context);
        case "GlobalTableAlreadyExistsException":
        case "com.amazonaws.dynamodb#GlobalTableAlreadyExistsException":
            throw await de_GlobalTableAlreadyExistsExceptionRes(parsedOutput, context);
        case "ResourceInUseException":
        case "com.amazonaws.dynamodb#ResourceInUseException":
            throw await de_ResourceInUseExceptionRes(parsedOutput, context);
        case "BackupNotFoundException":
        case "com.amazonaws.dynamodb#BackupNotFoundException":
            throw await de_BackupNotFoundExceptionRes(parsedOutput, context);
        case "ConditionalCheckFailedException":
        case "com.amazonaws.dynamodb#ConditionalCheckFailedException":
            throw await de_ConditionalCheckFailedExceptionRes(parsedOutput, context);
        case "TransactionConflictException":
        case "com.amazonaws.dynamodb#TransactionConflictException":
            throw await de_TransactionConflictExceptionRes(parsedOutput, context);
        case "PolicyNotFoundException":
        case "com.amazonaws.dynamodb#PolicyNotFoundException":
            throw await de_PolicyNotFoundExceptionRes(parsedOutput, context);
        case "ExportNotFoundException":
        case "com.amazonaws.dynamodb#ExportNotFoundException":
            throw await de_ExportNotFoundExceptionRes(parsedOutput, context);
        case "GlobalTableNotFoundException":
        case "com.amazonaws.dynamodb#GlobalTableNotFoundException":
            throw await de_GlobalTableNotFoundExceptionRes(parsedOutput, context);
        case "ImportNotFoundException":
        case "com.amazonaws.dynamodb#ImportNotFoundException":
            throw await de_ImportNotFoundExceptionRes(parsedOutput, context);
        case "DuplicateItemException":
        case "com.amazonaws.dynamodb#DuplicateItemException":
            throw await de_DuplicateItemExceptionRes(parsedOutput, context);
        case "IdempotentParameterMismatchException":
        case "com.amazonaws.dynamodb#IdempotentParameterMismatchException":
            throw await de_IdempotentParameterMismatchExceptionRes(parsedOutput, context);
        case "TransactionCanceledException":
        case "com.amazonaws.dynamodb#TransactionCanceledException":
            throw await de_TransactionCanceledExceptionRes(parsedOutput, context);
        case "TransactionInProgressException":
        case "com.amazonaws.dynamodb#TransactionInProgressException":
            throw await de_TransactionInProgressExceptionRes(parsedOutput, context);
        case "ExportConflictException":
        case "com.amazonaws.dynamodb#ExportConflictException":
            throw await de_ExportConflictExceptionRes(parsedOutput, context);
        case "InvalidExportTimeException":
        case "com.amazonaws.dynamodb#InvalidExportTimeException":
            throw await de_InvalidExportTimeExceptionRes(parsedOutput, context);
        case "PointInTimeRecoveryUnavailableException":
        case "com.amazonaws.dynamodb#PointInTimeRecoveryUnavailableException":
            throw await de_PointInTimeRecoveryUnavailableExceptionRes(parsedOutput, context);
        case "ImportConflictException":
        case "com.amazonaws.dynamodb#ImportConflictException":
            throw await de_ImportConflictExceptionRes(parsedOutput, context);
        case "TableAlreadyExistsException":
        case "com.amazonaws.dynamodb#TableAlreadyExistsException":
            throw await de_TableAlreadyExistsExceptionRes(parsedOutput, context);
        case "InvalidRestoreTimeException":
        case "com.amazonaws.dynamodb#InvalidRestoreTimeException":
            throw await de_InvalidRestoreTimeExceptionRes(parsedOutput, context);
        case "ReplicaAlreadyExistsException":
        case "com.amazonaws.dynamodb#ReplicaAlreadyExistsException":
            throw await de_ReplicaAlreadyExistsExceptionRes(parsedOutput, context);
        case "ReplicaNotFoundException":
        case "com.amazonaws.dynamodb#ReplicaNotFoundException":
            throw await de_ReplicaNotFoundExceptionRes(parsedOutput, context);
        case "IndexNotFoundException":
        case "com.amazonaws.dynamodb#IndexNotFoundException":
            throw await de_IndexNotFoundExceptionRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody,
                errorCode,
            });
    }
};
const de_BackupInUseExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new BackupInUseException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_BackupNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new BackupNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ConditionalCheckFailedExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_ConditionalCheckFailedException(body, context);
    const exception = new ConditionalCheckFailedException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ContinuousBackupsUnavailableExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ContinuousBackupsUnavailableException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_DuplicateItemExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new DuplicateItemException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ExportConflictExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ExportConflictException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ExportNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ExportNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_GlobalTableAlreadyExistsExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new GlobalTableAlreadyExistsException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_GlobalTableNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new GlobalTableNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_IdempotentParameterMismatchExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new IdempotentParameterMismatchException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ImportConflictExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ImportConflictException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ImportNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ImportNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_IndexNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new IndexNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_InternalServerErrorRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new InternalServerError({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_InvalidEndpointExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new InvalidEndpointException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_InvalidExportTimeExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new InvalidExportTimeException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_InvalidRestoreTimeExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new InvalidRestoreTimeException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ItemCollectionSizeLimitExceededExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ItemCollectionSizeLimitExceededException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_LimitExceededExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new LimitExceededException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_PointInTimeRecoveryUnavailableExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new PointInTimeRecoveryUnavailableException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_PolicyNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new PolicyNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ProvisionedThroughputExceededExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ProvisionedThroughputExceededException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ReplicaAlreadyExistsExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ReplicaAlreadyExistsException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ReplicaNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ReplicaNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ReplicatedWriteConflictExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ReplicatedWriteConflictException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_RequestLimitExceededRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new RequestLimitExceeded({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ResourceInUseExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ResourceInUseException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ResourceNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ResourceNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_TableAlreadyExistsExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new TableAlreadyExistsException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_TableInUseExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new TableInUseException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_TableNotFoundExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new TableNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_ThrottlingExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new ThrottlingException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_TransactionCanceledExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = de_TransactionCanceledException(body, context);
    const exception = new TransactionCanceledException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_TransactionConflictExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new TransactionConflictException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const de_TransactionInProgressExceptionRes = async (parsedOutput, context) => {
    const body = parsedOutput.body;
    const deserialized = _json(body);
    const exception = new TransactionInProgressException({
        $metadata: deserializeMetadata(parsedOutput),
        ...deserialized,
    });
    return __decorateServiceException(exception, body);
};
const se_AttributeUpdates = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_AttributeValueUpdate(value, context);
        return acc;
    }, {});
};
const se_AttributeValue = (input, context) => {
    return AttributeValue.visit(input, {
        B: (value) => ({ B: context.base64Encoder(value) }),
        BOOL: (value) => ({ BOOL: value }),
        BS: (value) => ({ BS: se_BinarySetAttributeValue(value, context) }),
        L: (value) => ({ L: se_ListAttributeValue(value, context) }),
        M: (value) => ({ M: se_MapAttributeValue(value, context) }),
        N: (value) => ({ N: value }),
        NS: (value) => ({ NS: _json(value) }),
        NULL: (value) => ({ NULL: value }),
        S: (value) => ({ S: value }),
        SS: (value) => ({ SS: _json(value) }),
        _: (name, value) => ({ [name]: value }),
    });
};
const se_AttributeValueList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_AttributeValue(entry, context);
    });
};
const se_AttributeValueUpdate = (input, context) => {
    return take(input, {
        Action: [],
        Value: (_) => se_AttributeValue(_, context),
    });
};
const se_AutoScalingPolicyUpdate = (input, context) => {
    return take(input, {
        PolicyName: [],
        TargetTrackingScalingPolicyConfiguration: (_) => se_AutoScalingTargetTrackingScalingPolicyConfigurationUpdate(_, context),
    });
};
const se_AutoScalingSettingsUpdate = (input, context) => {
    return take(input, {
        AutoScalingDisabled: [],
        AutoScalingRoleArn: [],
        MaximumUnits: [],
        MinimumUnits: [],
        ScalingPolicyUpdate: (_) => se_AutoScalingPolicyUpdate(_, context),
    });
};
const se_AutoScalingTargetTrackingScalingPolicyConfigurationUpdate = (input, context) => {
    return take(input, {
        DisableScaleIn: [],
        ScaleInCooldown: [],
        ScaleOutCooldown: [],
        TargetValue: __serializeFloat,
    });
};
const se_BatchExecuteStatementInput = (input, context) => {
    return take(input, {
        ReturnConsumedCapacity: [],
        Statements: (_) => se_PartiQLBatchRequest(_, context),
    });
};
const se_BatchGetItemInput = (input, context) => {
    return take(input, {
        RequestItems: (_) => se_BatchGetRequestMap(_, context),
        ReturnConsumedCapacity: [],
    });
};
const se_BatchGetRequestMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_KeysAndAttributes(value, context);
        return acc;
    }, {});
};
const se_BatchStatementRequest = (input, context) => {
    return take(input, {
        ConsistentRead: [],
        Parameters: (_) => se_PreparedStatementParameters(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        Statement: [],
    });
};
const se_BatchWriteItemInput = (input, context) => {
    return take(input, {
        RequestItems: (_) => se_BatchWriteItemRequestMap(_, context),
        ReturnConsumedCapacity: [],
        ReturnItemCollectionMetrics: [],
    });
};
const se_BatchWriteItemRequestMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_WriteRequests(value, context);
        return acc;
    }, {});
};
const se_BinarySetAttributeValue = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return context.base64Encoder(entry);
    });
};
const se_Condition = (input, context) => {
    return take(input, {
        AttributeValueList: (_) => se_AttributeValueList(_, context),
        ComparisonOperator: [],
    });
};
const se_ConditionCheck = (input, context) => {
    return take(input, {
        ConditionExpression: [],
        ExpressionAttributeNames: _json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Key: (_) => se_Key(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
    });
};
const se_Delete = (input, context) => {
    return take(input, {
        ConditionExpression: [],
        ExpressionAttributeNames: _json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Key: (_) => se_Key(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
    });
};
const se_DeleteItemInput = (input, context) => {
    return take(input, {
        ConditionExpression: [],
        ConditionalOperator: [],
        Expected: (_) => se_ExpectedAttributeMap(_, context),
        ExpressionAttributeNames: _json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Key: (_) => se_Key(_, context),
        ReturnConsumedCapacity: [],
        ReturnItemCollectionMetrics: [],
        ReturnValues: [],
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
    });
};
const se_DeleteRequest = (input, context) => {
    return take(input, {
        Key: (_) => se_Key(_, context),
    });
};
const se_ExecuteStatementInput = (input, context) => {
    return take(input, {
        ConsistentRead: [],
        Limit: [],
        NextToken: [],
        Parameters: (_) => se_PreparedStatementParameters(_, context),
        ReturnConsumedCapacity: [],
        ReturnValuesOnConditionCheckFailure: [],
        Statement: [],
    });
};
const se_ExecuteTransactionInput = (input, context) => {
    return take(input, {
        ClientRequestToken: [true, (_) => _ ?? generateIdempotencyToken()],
        ReturnConsumedCapacity: [],
        TransactStatements: (_) => se_ParameterizedStatements(_, context),
    });
};
const se_ExpectedAttributeMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_ExpectedAttributeValue(value, context);
        return acc;
    }, {});
};
const se_ExpectedAttributeValue = (input, context) => {
    return take(input, {
        AttributeValueList: (_) => se_AttributeValueList(_, context),
        ComparisonOperator: [],
        Exists: [],
        Value: (_) => se_AttributeValue(_, context),
    });
};
const se_ExportTableToPointInTimeInput = (input, context) => {
    return take(input, {
        ClientToken: [true, (_) => _ ?? generateIdempotencyToken()],
        ExportFormat: [],
        ExportTime: (_) => _.getTime() / 1_000,
        ExportType: [],
        IncrementalExportSpecification: (_) => se_IncrementalExportSpecification(_, context),
        S3Bucket: [],
        S3BucketOwner: [],
        S3Prefix: [],
        S3SseAlgorithm: [],
        S3SseKmsKeyId: [],
        TableArn: [],
    });
};
const se_ExpressionAttributeValueMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_AttributeValue(value, context);
        return acc;
    }, {});
};
const se_FilterConditionMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_Condition(value, context);
        return acc;
    }, {});
};
const se_Get = (input, context) => {
    return take(input, {
        ExpressionAttributeNames: _json,
        Key: (_) => se_Key(_, context),
        ProjectionExpression: [],
        TableName: [],
    });
};
const se_GetItemInput = (input, context) => {
    return take(input, {
        AttributesToGet: _json,
        ConsistentRead: [],
        ExpressionAttributeNames: _json,
        Key: (_) => se_Key(_, context),
        ProjectionExpression: [],
        ReturnConsumedCapacity: [],
        TableName: [],
    });
};
const se_GlobalSecondaryIndexAutoScalingUpdate = (input, context) => {
    return take(input, {
        IndexName: [],
        ProvisionedWriteCapacityAutoScalingUpdate: (_) => se_AutoScalingSettingsUpdate(_, context),
    });
};
const se_GlobalSecondaryIndexAutoScalingUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_GlobalSecondaryIndexAutoScalingUpdate(entry, context);
    });
};
const se_GlobalTableGlobalSecondaryIndexSettingsUpdate = (input, context) => {
    return take(input, {
        IndexName: [],
        ProvisionedWriteCapacityAutoScalingSettingsUpdate: (_) => se_AutoScalingSettingsUpdate(_, context),
        ProvisionedWriteCapacityUnits: [],
    });
};
const se_GlobalTableGlobalSecondaryIndexSettingsUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_GlobalTableGlobalSecondaryIndexSettingsUpdate(entry, context);
    });
};
const se_ImportTableInput = (input, context) => {
    return take(input, {
        ClientToken: [true, (_) => _ ?? generateIdempotencyToken()],
        InputCompressionType: [],
        InputFormat: [],
        InputFormatOptions: _json,
        S3BucketSource: _json,
        TableCreationParameters: _json,
    });
};
const se_IncrementalExportSpecification = (input, context) => {
    return take(input, {
        ExportFromTime: (_) => _.getTime() / 1_000,
        ExportToTime: (_) => _.getTime() / 1_000,
        ExportViewType: [],
    });
};
const se_Key = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_AttributeValue(value, context);
        return acc;
    }, {});
};
const se_KeyConditions = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_Condition(value, context);
        return acc;
    }, {});
};
const se_KeyList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_Key(entry, context);
    });
};
const se_KeysAndAttributes = (input, context) => {
    return take(input, {
        AttributesToGet: _json,
        ConsistentRead: [],
        ExpressionAttributeNames: _json,
        Keys: (_) => se_KeyList(_, context),
        ProjectionExpression: [],
    });
};
const se_ListAttributeValue = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_AttributeValue(entry, context);
    });
};
const se_ListBackupsInput = (input, context) => {
    return take(input, {
        BackupType: [],
        ExclusiveStartBackupArn: [],
        Limit: [],
        TableName: [],
        TimeRangeLowerBound: (_) => _.getTime() / 1_000,
        TimeRangeUpperBound: (_) => _.getTime() / 1_000,
    });
};
const se_MapAttributeValue = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_AttributeValue(value, context);
        return acc;
    }, {});
};
const se_ParameterizedStatement = (input, context) => {
    return take(input, {
        Parameters: (_) => se_PreparedStatementParameters(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        Statement: [],
    });
};
const se_ParameterizedStatements = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_ParameterizedStatement(entry, context);
    });
};
const se_PartiQLBatchRequest = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_BatchStatementRequest(entry, context);
    });
};
const se_PreparedStatementParameters = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_AttributeValue(entry, context);
    });
};
const se_Put = (input, context) => {
    return take(input, {
        ConditionExpression: [],
        ExpressionAttributeNames: _json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Item: (_) => se_PutItemInputAttributeMap(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
    });
};
const se_PutItemInput = (input, context) => {
    return take(input, {
        ConditionExpression: [],
        ConditionalOperator: [],
        Expected: (_) => se_ExpectedAttributeMap(_, context),
        ExpressionAttributeNames: _json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Item: (_) => se_PutItemInputAttributeMap(_, context),
        ReturnConsumedCapacity: [],
        ReturnItemCollectionMetrics: [],
        ReturnValues: [],
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
    });
};
const se_PutItemInputAttributeMap = (input, context) => {
    return Object.entries(input).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = se_AttributeValue(value, context);
        return acc;
    }, {});
};
const se_PutRequest = (input, context) => {
    return take(input, {
        Item: (_) => se_PutItemInputAttributeMap(_, context),
    });
};
const se_QueryInput = (input, context) => {
    return take(input, {
        AttributesToGet: _json,
        ConditionalOperator: [],
        ConsistentRead: [],
        ExclusiveStartKey: (_) => se_Key(_, context),
        ExpressionAttributeNames: _json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        FilterExpression: [],
        IndexName: [],
        KeyConditionExpression: [],
        KeyConditions: (_) => se_KeyConditions(_, context),
        Limit: [],
        ProjectionExpression: [],
        QueryFilter: (_) => se_FilterConditionMap(_, context),
        ReturnConsumedCapacity: [],
        ScanIndexForward: [],
        Select: [],
        TableName: [],
    });
};
const se_ReplicaAutoScalingUpdate = (input, context) => {
    return take(input, {
        RegionName: [],
        ReplicaGlobalSecondaryIndexUpdates: (_) => se_ReplicaGlobalSecondaryIndexAutoScalingUpdateList(_, context),
        ReplicaProvisionedReadCapacityAutoScalingUpdate: (_) => se_AutoScalingSettingsUpdate(_, context),
    });
};
const se_ReplicaAutoScalingUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_ReplicaAutoScalingUpdate(entry, context);
    });
};
const se_ReplicaGlobalSecondaryIndexAutoScalingUpdate = (input, context) => {
    return take(input, {
        IndexName: [],
        ProvisionedReadCapacityAutoScalingUpdate: (_) => se_AutoScalingSettingsUpdate(_, context),
    });
};
const se_ReplicaGlobalSecondaryIndexAutoScalingUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_ReplicaGlobalSecondaryIndexAutoScalingUpdate(entry, context);
    });
};
const se_ReplicaGlobalSecondaryIndexSettingsUpdate = (input, context) => {
    return take(input, {
        IndexName: [],
        ProvisionedReadCapacityAutoScalingSettingsUpdate: (_) => se_AutoScalingSettingsUpdate(_, context),
        ProvisionedReadCapacityUnits: [],
    });
};
const se_ReplicaGlobalSecondaryIndexSettingsUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_ReplicaGlobalSecondaryIndexSettingsUpdate(entry, context);
    });
};
const se_ReplicaSettingsUpdate = (input, context) => {
    return take(input, {
        RegionName: [],
        ReplicaGlobalSecondaryIndexSettingsUpdate: (_) => se_ReplicaGlobalSecondaryIndexSettingsUpdateList(_, context),
        ReplicaProvisionedReadCapacityAutoScalingSettingsUpdate: (_) => se_AutoScalingSettingsUpdate(_, context),
        ReplicaProvisionedReadCapacityUnits: [],
        ReplicaTableClass: [],
    });
};
const se_ReplicaSettingsUpdateList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_ReplicaSettingsUpdate(entry, context);
    });
};
const se_RestoreTableToPointInTimeInput = (input, context) => {
    return take(input, {
        BillingModeOverride: [],
        GlobalSecondaryIndexOverride: _json,
        LocalSecondaryIndexOverride: _json,
        OnDemandThroughputOverride: _json,
        ProvisionedThroughputOverride: _json,
        RestoreDateTime: (_) => _.getTime() / 1_000,
        SSESpecificationOverride: _json,
        SourceTableArn: [],
        SourceTableName: [],
        TargetTableName: [],
        UseLatestRestorableTime: [],
    });
};
const se_ScanInput = (input, context) => {
    return take(input, {
        AttributesToGet: _json,
        ConditionalOperator: [],
        ConsistentRead: [],
        ExclusiveStartKey: (_) => se_Key(_, context),
        ExpressionAttributeNames: _json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        FilterExpression: [],
        IndexName: [],
        Limit: [],
        ProjectionExpression: [],
        ReturnConsumedCapacity: [],
        ScanFilter: (_) => se_FilterConditionMap(_, context),
        Segment: [],
        Select: [],
        TableName: [],
        TotalSegments: [],
    });
};
const se_TransactGetItem = (input, context) => {
    return take(input, {
        Get: (_) => se_Get(_, context),
    });
};
const se_TransactGetItemList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_TransactGetItem(entry, context);
    });
};
const se_TransactGetItemsInput = (input, context) => {
    return take(input, {
        ReturnConsumedCapacity: [],
        TransactItems: (_) => se_TransactGetItemList(_, context),
    });
};
const se_TransactWriteItem = (input, context) => {
    return take(input, {
        ConditionCheck: (_) => se_ConditionCheck(_, context),
        Delete: (_) => se_Delete(_, context),
        Put: (_) => se_Put(_, context),
        Update: (_) => se_Update(_, context),
    });
};
const se_TransactWriteItemList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_TransactWriteItem(entry, context);
    });
};
const se_TransactWriteItemsInput = (input, context) => {
    return take(input, {
        ClientRequestToken: [true, (_) => _ ?? generateIdempotencyToken()],
        ReturnConsumedCapacity: [],
        ReturnItemCollectionMetrics: [],
        TransactItems: (_) => se_TransactWriteItemList(_, context),
    });
};
const se_Update = (input, context) => {
    return take(input, {
        ConditionExpression: [],
        ExpressionAttributeNames: _json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Key: (_) => se_Key(_, context),
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
        UpdateExpression: [],
    });
};
const se_UpdateGlobalTableSettingsInput = (input, context) => {
    return take(input, {
        GlobalTableBillingMode: [],
        GlobalTableGlobalSecondaryIndexSettingsUpdate: (_) => se_GlobalTableGlobalSecondaryIndexSettingsUpdateList(_, context),
        GlobalTableName: [],
        GlobalTableProvisionedWriteCapacityAutoScalingSettingsUpdate: (_) => se_AutoScalingSettingsUpdate(_, context),
        GlobalTableProvisionedWriteCapacityUnits: [],
        ReplicaSettingsUpdate: (_) => se_ReplicaSettingsUpdateList(_, context),
    });
};
const se_UpdateItemInput = (input, context) => {
    return take(input, {
        AttributeUpdates: (_) => se_AttributeUpdates(_, context),
        ConditionExpression: [],
        ConditionalOperator: [],
        Expected: (_) => se_ExpectedAttributeMap(_, context),
        ExpressionAttributeNames: _json,
        ExpressionAttributeValues: (_) => se_ExpressionAttributeValueMap(_, context),
        Key: (_) => se_Key(_, context),
        ReturnConsumedCapacity: [],
        ReturnItemCollectionMetrics: [],
        ReturnValues: [],
        ReturnValuesOnConditionCheckFailure: [],
        TableName: [],
        UpdateExpression: [],
    });
};
const se_UpdateTableReplicaAutoScalingInput = (input, context) => {
    return take(input, {
        GlobalSecondaryIndexUpdates: (_) => se_GlobalSecondaryIndexAutoScalingUpdateList(_, context),
        ProvisionedWriteCapacityAutoScalingUpdate: (_) => se_AutoScalingSettingsUpdate(_, context),
        ReplicaUpdates: (_) => se_ReplicaAutoScalingUpdateList(_, context),
        TableName: [],
    });
};
const se_WriteRequest = (input, context) => {
    return take(input, {
        DeleteRequest: (_) => se_DeleteRequest(_, context),
        PutRequest: (_) => se_PutRequest(_, context),
    });
};
const se_WriteRequests = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_WriteRequest(entry, context);
    });
};
const de_ArchivalSummary = (output, context) => {
    return take(output, {
        ArchivalBackupArn: __expectString,
        ArchivalDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        ArchivalReason: __expectString,
    });
};
const de_AttributeMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_AttributeValue(__expectUnion(value), context);
        return acc;
    }, {});
};
const de_AttributeValue = (output, context) => {
    if (output.B != null) {
        return {
            B: context.base64Decoder(output.B),
        };
    }
    if (__expectBoolean(output.BOOL) !== undefined) {
        return { BOOL: __expectBoolean(output.BOOL) };
    }
    if (output.BS != null) {
        return {
            BS: de_BinarySetAttributeValue(output.BS, context),
        };
    }
    if (output.L != null) {
        return {
            L: de_ListAttributeValue(output.L, context),
        };
    }
    if (output.M != null) {
        return {
            M: de_MapAttributeValue(output.M, context),
        };
    }
    if (__expectString(output.N) !== undefined) {
        return { N: __expectString(output.N) };
    }
    if (output.NS != null) {
        return {
            NS: _json(output.NS),
        };
    }
    if (__expectBoolean(output.NULL) !== undefined) {
        return { NULL: __expectBoolean(output.NULL) };
    }
    if (__expectString(output.S) !== undefined) {
        return { S: __expectString(output.S) };
    }
    if (output.SS != null) {
        return {
            SS: _json(output.SS),
        };
    }
    return { $unknown: Object.entries(output)[0] };
};
const de_AutoScalingPolicyDescription = (output, context) => {
    return take(output, {
        PolicyName: __expectString,
        TargetTrackingScalingPolicyConfiguration: (_) => de_AutoScalingTargetTrackingScalingPolicyConfigurationDescription(_, context),
    });
};
const de_AutoScalingPolicyDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_AutoScalingPolicyDescription(entry, context);
    });
    return retVal;
};
const de_AutoScalingSettingsDescription = (output, context) => {
    return take(output, {
        AutoScalingDisabled: __expectBoolean,
        AutoScalingRoleArn: __expectString,
        MaximumUnits: __expectLong,
        MinimumUnits: __expectLong,
        ScalingPolicies: (_) => de_AutoScalingPolicyDescriptionList(_, context),
    });
};
const de_AutoScalingTargetTrackingScalingPolicyConfigurationDescription = (output, context) => {
    return take(output, {
        DisableScaleIn: __expectBoolean,
        ScaleInCooldown: __expectInt32,
        ScaleOutCooldown: __expectInt32,
        TargetValue: __limitedParseDouble,
    });
};
const de_BackupDescription = (output, context) => {
    return take(output, {
        BackupDetails: (_) => de_BackupDetails(_, context),
        SourceTableDetails: (_) => de_SourceTableDetails(_, context),
        SourceTableFeatureDetails: (_) => de_SourceTableFeatureDetails(_, context),
    });
};
const de_BackupDetails = (output, context) => {
    return take(output, {
        BackupArn: __expectString,
        BackupCreationDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        BackupExpiryDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        BackupName: __expectString,
        BackupSizeBytes: __expectLong,
        BackupStatus: __expectString,
        BackupType: __expectString,
    });
};
const de_BackupSummaries = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_BackupSummary(entry, context);
    });
    return retVal;
};
const de_BackupSummary = (output, context) => {
    return take(output, {
        BackupArn: __expectString,
        BackupCreationDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        BackupExpiryDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        BackupName: __expectString,
        BackupSizeBytes: __expectLong,
        BackupStatus: __expectString,
        BackupType: __expectString,
        TableArn: __expectString,
        TableId: __expectString,
        TableName: __expectString,
    });
};
const de_BatchExecuteStatementOutput = (output, context) => {
    return take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_, context),
        Responses: (_) => de_PartiQLBatchResponse(_, context),
    });
};
const de_BatchGetItemOutput = (output, context) => {
    return take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_, context),
        Responses: (_) => de_BatchGetResponseMap(_, context),
        UnprocessedKeys: (_) => de_BatchGetRequestMap(_, context),
    });
};
const de_BatchGetRequestMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_KeysAndAttributes(value, context);
        return acc;
    }, {});
};
const de_BatchGetResponseMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_ItemList(value, context);
        return acc;
    }, {});
};
const de_BatchStatementError = (output, context) => {
    return take(output, {
        Code: __expectString,
        Item: (_) => de_AttributeMap(_, context),
        Message: __expectString,
    });
};
const de_BatchStatementResponse = (output, context) => {
    return take(output, {
        Error: (_) => de_BatchStatementError(_, context),
        Item: (_) => de_AttributeMap(_, context),
        TableName: __expectString,
    });
};
const de_BatchWriteItemOutput = (output, context) => {
    return take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_, context),
        ItemCollectionMetrics: (_) => de_ItemCollectionMetricsPerTable(_, context),
        UnprocessedItems: (_) => de_BatchWriteItemRequestMap(_, context),
    });
};
const de_BatchWriteItemRequestMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_WriteRequests(value, context);
        return acc;
    }, {});
};
const de_BillingModeSummary = (output, context) => {
    return take(output, {
        BillingMode: __expectString,
        LastUpdateToPayPerRequestDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
    });
};
const de_BinarySetAttributeValue = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return context.base64Decoder(entry);
    });
    return retVal;
};
const de_CancellationReason = (output, context) => {
    return take(output, {
        Code: __expectString,
        Item: (_) => de_AttributeMap(_, context),
        Message: __expectString,
    });
};
const de_CancellationReasonList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_CancellationReason(entry, context);
    });
    return retVal;
};
const de_Capacity = (output, context) => {
    return take(output, {
        CapacityUnits: __limitedParseDouble,
        ReadCapacityUnits: __limitedParseDouble,
        WriteCapacityUnits: __limitedParseDouble,
    });
};
const de_ConditionalCheckFailedException = (output, context) => {
    return take(output, {
        Item: (_) => de_AttributeMap(_, context),
        message: __expectString,
    });
};
const de_ConsumedCapacity = (output, context) => {
    return take(output, {
        CapacityUnits: __limitedParseDouble,
        GlobalSecondaryIndexes: (_) => de_SecondaryIndexesCapacityMap(_, context),
        LocalSecondaryIndexes: (_) => de_SecondaryIndexesCapacityMap(_, context),
        ReadCapacityUnits: __limitedParseDouble,
        Table: (_) => de_Capacity(_, context),
        TableName: __expectString,
        WriteCapacityUnits: __limitedParseDouble,
    });
};
const de_ConsumedCapacityMultiple = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ConsumedCapacity(entry, context);
    });
    return retVal;
};
const de_ContinuousBackupsDescription = (output, context) => {
    return take(output, {
        ContinuousBackupsStatus: __expectString,
        PointInTimeRecoveryDescription: (_) => de_PointInTimeRecoveryDescription(_, context),
    });
};
const de_CreateBackupOutput = (output, context) => {
    return take(output, {
        BackupDetails: (_) => de_BackupDetails(_, context),
    });
};
const de_CreateGlobalTableOutput = (output, context) => {
    return take(output, {
        GlobalTableDescription: (_) => de_GlobalTableDescription(_, context),
    });
};
const de_CreateTableOutput = (output, context) => {
    return take(output, {
        TableDescription: (_) => de_TableDescription(_, context),
    });
};
const de_DeleteBackupOutput = (output, context) => {
    return take(output, {
        BackupDescription: (_) => de_BackupDescription(_, context),
    });
};
const de_DeleteItemOutput = (output, context) => {
    return take(output, {
        Attributes: (_) => de_AttributeMap(_, context),
        ConsumedCapacity: (_) => de_ConsumedCapacity(_, context),
        ItemCollectionMetrics: (_) => de_ItemCollectionMetrics(_, context),
    });
};
const de_DeleteRequest = (output, context) => {
    return take(output, {
        Key: (_) => de_Key(_, context),
    });
};
const de_DeleteTableOutput = (output, context) => {
    return take(output, {
        TableDescription: (_) => de_TableDescription(_, context),
    });
};
const de_DescribeBackupOutput = (output, context) => {
    return take(output, {
        BackupDescription: (_) => de_BackupDescription(_, context),
    });
};
const de_DescribeContinuousBackupsOutput = (output, context) => {
    return take(output, {
        ContinuousBackupsDescription: (_) => de_ContinuousBackupsDescription(_, context),
    });
};
const de_DescribeContributorInsightsOutput = (output, context) => {
    return take(output, {
        ContributorInsightsMode: __expectString,
        ContributorInsightsRuleList: _json,
        ContributorInsightsStatus: __expectString,
        FailureException: _json,
        IndexName: __expectString,
        LastUpdateDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        TableName: __expectString,
    });
};
const de_DescribeExportOutput = (output, context) => {
    return take(output, {
        ExportDescription: (_) => de_ExportDescription(_, context),
    });
};
const de_DescribeGlobalTableOutput = (output, context) => {
    return take(output, {
        GlobalTableDescription: (_) => de_GlobalTableDescription(_, context),
    });
};
const de_DescribeGlobalTableSettingsOutput = (output, context) => {
    return take(output, {
        GlobalTableName: __expectString,
        ReplicaSettings: (_) => de_ReplicaSettingsDescriptionList(_, context),
    });
};
const de_DescribeImportOutput = (output, context) => {
    return take(output, {
        ImportTableDescription: (_) => de_ImportTableDescription(_, context),
    });
};
const de_DescribeTableOutput = (output, context) => {
    return take(output, {
        Table: (_) => de_TableDescription(_, context),
    });
};
const de_DescribeTableReplicaAutoScalingOutput = (output, context) => {
    return take(output, {
        TableAutoScalingDescription: (_) => de_TableAutoScalingDescription(_, context),
    });
};
const de_ExecuteStatementOutput = (output, context) => {
    return take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacity(_, context),
        Items: (_) => de_ItemList(_, context),
        LastEvaluatedKey: (_) => de_Key(_, context),
        NextToken: __expectString,
    });
};
const de_ExecuteTransactionOutput = (output, context) => {
    return take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_, context),
        Responses: (_) => de_ItemResponseList(_, context),
    });
};
const de_ExportDescription = (output, context) => {
    return take(output, {
        BilledSizeBytes: __expectLong,
        ClientToken: __expectString,
        EndTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        ExportArn: __expectString,
        ExportFormat: __expectString,
        ExportManifest: __expectString,
        ExportStatus: __expectString,
        ExportTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        ExportType: __expectString,
        FailureCode: __expectString,
        FailureMessage: __expectString,
        IncrementalExportSpecification: (_) => de_IncrementalExportSpecification(_, context),
        ItemCount: __expectLong,
        S3Bucket: __expectString,
        S3BucketOwner: __expectString,
        S3Prefix: __expectString,
        S3SseAlgorithm: __expectString,
        S3SseKmsKeyId: __expectString,
        StartTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        TableArn: __expectString,
        TableId: __expectString,
    });
};
const de_ExportTableToPointInTimeOutput = (output, context) => {
    return take(output, {
        ExportDescription: (_) => de_ExportDescription(_, context),
    });
};
const de_GetItemOutput = (output, context) => {
    return take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacity(_, context),
        Item: (_) => de_AttributeMap(_, context),
    });
};
const de_GlobalSecondaryIndexDescription = (output, context) => {
    return take(output, {
        Backfilling: __expectBoolean,
        IndexArn: __expectString,
        IndexName: __expectString,
        IndexSizeBytes: __expectLong,
        IndexStatus: __expectString,
        ItemCount: __expectLong,
        KeySchema: _json,
        OnDemandThroughput: _json,
        Projection: _json,
        ProvisionedThroughput: (_) => de_ProvisionedThroughputDescription(_, context),
        WarmThroughput: _json,
    });
};
const de_GlobalSecondaryIndexDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_GlobalSecondaryIndexDescription(entry, context);
    });
    return retVal;
};
const de_GlobalTableDescription = (output, context) => {
    return take(output, {
        CreationDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        GlobalTableArn: __expectString,
        GlobalTableName: __expectString,
        GlobalTableStatus: __expectString,
        ReplicationGroup: (_) => de_ReplicaDescriptionList(_, context),
    });
};
const de_ImportSummary = (output, context) => {
    return take(output, {
        CloudWatchLogGroupArn: __expectString,
        EndTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        ImportArn: __expectString,
        ImportStatus: __expectString,
        InputFormat: __expectString,
        S3BucketSource: _json,
        StartTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        TableArn: __expectString,
    });
};
const de_ImportSummaryList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ImportSummary(entry, context);
    });
    return retVal;
};
const de_ImportTableDescription = (output, context) => {
    return take(output, {
        ClientToken: __expectString,
        CloudWatchLogGroupArn: __expectString,
        EndTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        ErrorCount: __expectLong,
        FailureCode: __expectString,
        FailureMessage: __expectString,
        ImportArn: __expectString,
        ImportStatus: __expectString,
        ImportedItemCount: __expectLong,
        InputCompressionType: __expectString,
        InputFormat: __expectString,
        InputFormatOptions: _json,
        ProcessedItemCount: __expectLong,
        ProcessedSizeBytes: __expectLong,
        S3BucketSource: _json,
        StartTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        TableArn: __expectString,
        TableCreationParameters: _json,
        TableId: __expectString,
    });
};
const de_ImportTableOutput = (output, context) => {
    return take(output, {
        ImportTableDescription: (_) => de_ImportTableDescription(_, context),
    });
};
const de_IncrementalExportSpecification = (output, context) => {
    return take(output, {
        ExportFromTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        ExportToTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        ExportViewType: __expectString,
    });
};
const de_ItemCollectionKeyAttributeMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_AttributeValue(__expectUnion(value), context);
        return acc;
    }, {});
};
const de_ItemCollectionMetrics = (output, context) => {
    return take(output, {
        ItemCollectionKey: (_) => de_ItemCollectionKeyAttributeMap(_, context),
        SizeEstimateRangeGB: (_) => de_ItemCollectionSizeEstimateRange(_, context),
    });
};
const de_ItemCollectionMetricsMultiple = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ItemCollectionMetrics(entry, context);
    });
    return retVal;
};
const de_ItemCollectionMetricsPerTable = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_ItemCollectionMetricsMultiple(value, context);
        return acc;
    }, {});
};
const de_ItemCollectionSizeEstimateRange = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return __limitedParseDouble(entry);
    });
    return retVal;
};
const de_ItemList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_AttributeMap(entry, context);
    });
    return retVal;
};
const de_ItemResponse = (output, context) => {
    return take(output, {
        Item: (_) => de_AttributeMap(_, context),
    });
};
const de_ItemResponseList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ItemResponse(entry, context);
    });
    return retVal;
};
const de_Key = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_AttributeValue(__expectUnion(value), context);
        return acc;
    }, {});
};
const de_KeyList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_Key(entry, context);
    });
    return retVal;
};
const de_KeysAndAttributes = (output, context) => {
    return take(output, {
        AttributesToGet: _json,
        ConsistentRead: __expectBoolean,
        ExpressionAttributeNames: _json,
        Keys: (_) => de_KeyList(_, context),
        ProjectionExpression: __expectString,
    });
};
const de_ListAttributeValue = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_AttributeValue(__expectUnion(entry), context);
    });
    return retVal;
};
const de_ListBackupsOutput = (output, context) => {
    return take(output, {
        BackupSummaries: (_) => de_BackupSummaries(_, context),
        LastEvaluatedBackupArn: __expectString,
    });
};
const de_ListImportsOutput = (output, context) => {
    return take(output, {
        ImportSummaryList: (_) => de_ImportSummaryList(_, context),
        NextToken: __expectString,
    });
};
const de_MapAttributeValue = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_AttributeValue(__expectUnion(value), context);
        return acc;
    }, {});
};
const de_PartiQLBatchResponse = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_BatchStatementResponse(entry, context);
    });
    return retVal;
};
const de_PointInTimeRecoveryDescription = (output, context) => {
    return take(output, {
        EarliestRestorableDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        LatestRestorableDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        PointInTimeRecoveryStatus: __expectString,
        RecoveryPeriodInDays: __expectInt32,
    });
};
const de_ProvisionedThroughputDescription = (output, context) => {
    return take(output, {
        LastDecreaseDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        LastIncreaseDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        NumberOfDecreasesToday: __expectLong,
        ReadCapacityUnits: __expectLong,
        WriteCapacityUnits: __expectLong,
    });
};
const de_PutItemInputAttributeMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_AttributeValue(__expectUnion(value), context);
        return acc;
    }, {});
};
const de_PutItemOutput = (output, context) => {
    return take(output, {
        Attributes: (_) => de_AttributeMap(_, context),
        ConsumedCapacity: (_) => de_ConsumedCapacity(_, context),
        ItemCollectionMetrics: (_) => de_ItemCollectionMetrics(_, context),
    });
};
const de_PutRequest = (output, context) => {
    return take(output, {
        Item: (_) => de_PutItemInputAttributeMap(_, context),
    });
};
const de_QueryOutput = (output, context) => {
    return take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacity(_, context),
        Count: __expectInt32,
        Items: (_) => de_ItemList(_, context),
        LastEvaluatedKey: (_) => de_Key(_, context),
        ScannedCount: __expectInt32,
    });
};
const de_ReplicaAutoScalingDescription = (output, context) => {
    return take(output, {
        GlobalSecondaryIndexes: (_) => de_ReplicaGlobalSecondaryIndexAutoScalingDescriptionList(_, context),
        RegionName: __expectString,
        ReplicaProvisionedReadCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_, context),
        ReplicaProvisionedWriteCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_, context),
        ReplicaStatus: __expectString,
    });
};
const de_ReplicaAutoScalingDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ReplicaAutoScalingDescription(entry, context);
    });
    return retVal;
};
const de_ReplicaDescription = (output, context) => {
    return take(output, {
        GlobalSecondaryIndexes: _json,
        KMSMasterKeyId: __expectString,
        OnDemandThroughputOverride: _json,
        ProvisionedThroughputOverride: _json,
        RegionName: __expectString,
        ReplicaInaccessibleDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        ReplicaStatus: __expectString,
        ReplicaStatusDescription: __expectString,
        ReplicaStatusPercentProgress: __expectString,
        ReplicaTableClassSummary: (_) => de_TableClassSummary(_, context),
        WarmThroughput: _json,
    });
};
const de_ReplicaDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ReplicaDescription(entry, context);
    });
    return retVal;
};
const de_ReplicaGlobalSecondaryIndexAutoScalingDescription = (output, context) => {
    return take(output, {
        IndexName: __expectString,
        IndexStatus: __expectString,
        ProvisionedReadCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_, context),
        ProvisionedWriteCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_, context),
    });
};
const de_ReplicaGlobalSecondaryIndexAutoScalingDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ReplicaGlobalSecondaryIndexAutoScalingDescription(entry, context);
    });
    return retVal;
};
const de_ReplicaGlobalSecondaryIndexSettingsDescription = (output, context) => {
    return take(output, {
        IndexName: __expectString,
        IndexStatus: __expectString,
        ProvisionedReadCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_, context),
        ProvisionedReadCapacityUnits: __expectLong,
        ProvisionedWriteCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_, context),
        ProvisionedWriteCapacityUnits: __expectLong,
    });
};
const de_ReplicaGlobalSecondaryIndexSettingsDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ReplicaGlobalSecondaryIndexSettingsDescription(entry, context);
    });
    return retVal;
};
const de_ReplicaSettingsDescription = (output, context) => {
    return take(output, {
        RegionName: __expectString,
        ReplicaBillingModeSummary: (_) => de_BillingModeSummary(_, context),
        ReplicaGlobalSecondaryIndexSettings: (_) => de_ReplicaGlobalSecondaryIndexSettingsDescriptionList(_, context),
        ReplicaProvisionedReadCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_, context),
        ReplicaProvisionedReadCapacityUnits: __expectLong,
        ReplicaProvisionedWriteCapacityAutoScalingSettings: (_) => de_AutoScalingSettingsDescription(_, context),
        ReplicaProvisionedWriteCapacityUnits: __expectLong,
        ReplicaStatus: __expectString,
        ReplicaTableClassSummary: (_) => de_TableClassSummary(_, context),
    });
};
const de_ReplicaSettingsDescriptionList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ReplicaSettingsDescription(entry, context);
    });
    return retVal;
};
const de_RestoreSummary = (output, context) => {
    return take(output, {
        RestoreDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        RestoreInProgress: __expectBoolean,
        SourceBackupArn: __expectString,
        SourceTableArn: __expectString,
    });
};
const de_RestoreTableFromBackupOutput = (output, context) => {
    return take(output, {
        TableDescription: (_) => de_TableDescription(_, context),
    });
};
const de_RestoreTableToPointInTimeOutput = (output, context) => {
    return take(output, {
        TableDescription: (_) => de_TableDescription(_, context),
    });
};
const de_ScanOutput = (output, context) => {
    return take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacity(_, context),
        Count: __expectInt32,
        Items: (_) => de_ItemList(_, context),
        LastEvaluatedKey: (_) => de_Key(_, context),
        ScannedCount: __expectInt32,
    });
};
const de_SecondaryIndexesCapacityMap = (output, context) => {
    return Object.entries(output).reduce((acc, [key, value]) => {
        if (value === null) {
            return acc;
        }
        acc[key] = de_Capacity(value, context);
        return acc;
    }, {});
};
const de_SourceTableDetails = (output, context) => {
    return take(output, {
        BillingMode: __expectString,
        ItemCount: __expectLong,
        KeySchema: _json,
        OnDemandThroughput: _json,
        ProvisionedThroughput: _json,
        TableArn: __expectString,
        TableCreationDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        TableId: __expectString,
        TableName: __expectString,
        TableSizeBytes: __expectLong,
    });
};
const de_SourceTableFeatureDetails = (output, context) => {
    return take(output, {
        GlobalSecondaryIndexes: _json,
        LocalSecondaryIndexes: _json,
        SSEDescription: (_) => de_SSEDescription(_, context),
        StreamDescription: _json,
        TimeToLiveDescription: _json,
    });
};
const de_SSEDescription = (output, context) => {
    return take(output, {
        InaccessibleEncryptionDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        KMSMasterKeyArn: __expectString,
        SSEType: __expectString,
        Status: __expectString,
    });
};
const de_TableAutoScalingDescription = (output, context) => {
    return take(output, {
        Replicas: (_) => de_ReplicaAutoScalingDescriptionList(_, context),
        TableName: __expectString,
        TableStatus: __expectString,
    });
};
const de_TableClassSummary = (output, context) => {
    return take(output, {
        LastUpdateDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        TableClass: __expectString,
    });
};
const de_TableDescription = (output, context) => {
    return take(output, {
        ArchivalSummary: (_) => de_ArchivalSummary(_, context),
        AttributeDefinitions: _json,
        BillingModeSummary: (_) => de_BillingModeSummary(_, context),
        CreationDateTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        DeletionProtectionEnabled: __expectBoolean,
        GlobalSecondaryIndexes: (_) => de_GlobalSecondaryIndexDescriptionList(_, context),
        GlobalTableVersion: __expectString,
        GlobalTableWitnesses: _json,
        ItemCount: __expectLong,
        KeySchema: _json,
        LatestStreamArn: __expectString,
        LatestStreamLabel: __expectString,
        LocalSecondaryIndexes: _json,
        MultiRegionConsistency: __expectString,
        OnDemandThroughput: _json,
        ProvisionedThroughput: (_) => de_ProvisionedThroughputDescription(_, context),
        Replicas: (_) => de_ReplicaDescriptionList(_, context),
        RestoreSummary: (_) => de_RestoreSummary(_, context),
        SSEDescription: (_) => de_SSEDescription(_, context),
        StreamSpecification: _json,
        TableArn: __expectString,
        TableClassSummary: (_) => de_TableClassSummary(_, context),
        TableId: __expectString,
        TableName: __expectString,
        TableSizeBytes: __expectLong,
        TableStatus: __expectString,
        WarmThroughput: _json,
    });
};
const de_TransactGetItemsOutput = (output, context) => {
    return take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_, context),
        Responses: (_) => de_ItemResponseList(_, context),
    });
};
const de_TransactionCanceledException = (output, context) => {
    return take(output, {
        CancellationReasons: (_) => de_CancellationReasonList(_, context),
        Message: __expectString,
    });
};
const de_TransactWriteItemsOutput = (output, context) => {
    return take(output, {
        ConsumedCapacity: (_) => de_ConsumedCapacityMultiple(_, context),
        ItemCollectionMetrics: (_) => de_ItemCollectionMetricsPerTable(_, context),
    });
};
const de_UpdateContinuousBackupsOutput = (output, context) => {
    return take(output, {
        ContinuousBackupsDescription: (_) => de_ContinuousBackupsDescription(_, context),
    });
};
const de_UpdateGlobalTableOutput = (output, context) => {
    return take(output, {
        GlobalTableDescription: (_) => de_GlobalTableDescription(_, context),
    });
};
const de_UpdateGlobalTableSettingsOutput = (output, context) => {
    return take(output, {
        GlobalTableName: __expectString,
        ReplicaSettings: (_) => de_ReplicaSettingsDescriptionList(_, context),
    });
};
const de_UpdateItemOutput = (output, context) => {
    return take(output, {
        Attributes: (_) => de_AttributeMap(_, context),
        ConsumedCapacity: (_) => de_ConsumedCapacity(_, context),
        ItemCollectionMetrics: (_) => de_ItemCollectionMetrics(_, context),
    });
};
const de_UpdateTableOutput = (output, context) => {
    return take(output, {
        TableDescription: (_) => de_TableDescription(_, context),
    });
};
const de_UpdateTableReplicaAutoScalingOutput = (output, context) => {
    return take(output, {
        TableAutoScalingDescription: (_) => de_TableAutoScalingDescription(_, context),
    });
};
const de_WriteRequest = (output, context) => {
    return take(output, {
        DeleteRequest: (_) => de_DeleteRequest(_, context),
        PutRequest: (_) => de_PutRequest(_, context),
    });
};
const de_WriteRequests = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_WriteRequest(entry, context);
    });
    return retVal;
};
const deserializeMetadata = (output) => ({
    httpStatusCode: output.statusCode,
    requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
    extendedRequestId: output.headers["x-amz-id-2"],
    cfId: output.headers["x-amz-cf-id"],
});
const collectBodyString = (streamBody, context) => collectBody(streamBody, context).then((body) => context.utf8Encoder(body));
const throwDefaultError = withBaseException(__BaseException);
const buildHttpRpcRequest = async (context, headers, path, resolvedHostname, body) => {
    const { hostname, protocol = "https", port, path: basePath } = await context.endpoint();
    const contents = {
        protocol,
        hostname,
        port,
        method: "POST",
        path: basePath.endsWith("/") ? basePath.slice(0, -1) + path : basePath + path,
        headers,
    };
    if (resolvedHostname !== undefined) {
        contents.hostname = resolvedHostname;
    }
    if (body !== undefined) {
        contents.body = body;
    }
    return new __HttpRequest(contents);
};
function sharedHeaders(operation) {
    return {
        "content-type": "application/x-amz-json-1.0",
        "x-amz-target": `DynamoDB_20120810.${operation}`,
    };
}
