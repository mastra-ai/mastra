import { awsExpectUnion as __expectUnion, loadRestJsonErrorCode, parseJsonBody as parseBody, parseJsonErrorBody as parseErrorBody, } from "@aws-sdk/core";
import { requestBuilder as rb } from "@smithy/core";
import { _json, collectBody, decorateServiceException as __decorateServiceException, expectInt32 as __expectInt32, expectNonNull as __expectNonNull, expectNumber as __expectNumber, expectObject as __expectObject, expectString as __expectString, limitedParseFloat32 as __limitedParseFloat32, map, parseEpochTimestamp as __parseEpochTimestamp, serializeFloat as __serializeFloat, take, withBaseException, } from "@smithy/smithy-client";
import { AccessDeniedException, ConflictException, InternalServerException, KmsDisabledException, KmsInvalidKeyUsageException, KmsInvalidStateException, KmsNotFoundException, NotFoundException, ServiceQuotaExceededException, ServiceUnavailableException, TooManyRequestsException, ValidationException, VectorData, } from "../models/models_0";
import { S3VectorsServiceException as __BaseException } from "../models/S3VectorsServiceException";
export const se_CreateIndexCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/CreateIndex");
    let body;
    body = JSON.stringify(take(input, {
        dataType: [],
        dimension: [],
        distanceMetric: [],
        indexName: [],
        metadataConfiguration: (_) => _json(_),
        vectorBucketArn: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_CreateVectorBucketCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/CreateVectorBucket");
    let body;
    body = JSON.stringify(take(input, {
        encryptionConfiguration: (_) => _json(_),
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_DeleteIndexCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/DeleteIndex");
    let body;
    body = JSON.stringify(take(input, {
        indexArn: [],
        indexName: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_DeleteVectorBucketCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/DeleteVectorBucket");
    let body;
    body = JSON.stringify(take(input, {
        vectorBucketArn: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_DeleteVectorBucketPolicyCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/DeleteVectorBucketPolicy");
    let body;
    body = JSON.stringify(take(input, {
        vectorBucketArn: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_DeleteVectorsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/DeleteVectors");
    let body;
    body = JSON.stringify(take(input, {
        indexArn: [],
        indexName: [],
        keys: (_) => _json(_),
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_GetIndexCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/GetIndex");
    let body;
    body = JSON.stringify(take(input, {
        indexArn: [],
        indexName: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_GetVectorBucketCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/GetVectorBucket");
    let body;
    body = JSON.stringify(take(input, {
        vectorBucketArn: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_GetVectorBucketPolicyCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/GetVectorBucketPolicy");
    let body;
    body = JSON.stringify(take(input, {
        vectorBucketArn: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_GetVectorsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/GetVectors");
    let body;
    body = JSON.stringify(take(input, {
        indexArn: [],
        indexName: [],
        keys: (_) => _json(_),
        returnData: [],
        returnMetadata: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_ListIndexesCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/ListIndexes");
    let body;
    body = JSON.stringify(take(input, {
        maxResults: [],
        nextToken: [],
        prefix: [],
        vectorBucketArn: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_ListVectorBucketsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/ListVectorBuckets");
    let body;
    body = JSON.stringify(take(input, {
        maxResults: [],
        nextToken: [],
        prefix: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_ListVectorsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/ListVectors");
    let body;
    body = JSON.stringify(take(input, {
        indexArn: [],
        indexName: [],
        maxResults: [],
        nextToken: [],
        returnData: [],
        returnMetadata: [],
        segmentCount: [],
        segmentIndex: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_PutVectorBucketPolicyCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/PutVectorBucketPolicy");
    let body;
    body = JSON.stringify(take(input, {
        policy: [],
        vectorBucketArn: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_PutVectorsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/PutVectors");
    let body;
    body = JSON.stringify(take(input, {
        indexArn: [],
        indexName: [],
        vectorBucketName: [],
        vectors: (_) => se_PutVectorsInputList(_, context),
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const se_QueryVectorsCommand = async (input, context) => {
    const b = rb(input, context);
    const headers = {
        "content-type": "application/json",
    };
    b.bp("/QueryVectors");
    let body;
    body = JSON.stringify(take(input, {
        filter: (_) => se_Document(_, context),
        indexArn: [],
        indexName: [],
        queryVector: (_) => se_VectorData(_, context),
        returnDistance: [],
        returnMetadata: [],
        topK: [],
        vectorBucketName: [],
    }));
    b.m("POST").h(headers).b(body);
    return b.build();
};
export const de_CreateIndexCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    await collectBody(output.body, context);
    return contents;
};
export const de_CreateVectorBucketCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    await collectBody(output.body, context);
    return contents;
};
export const de_DeleteIndexCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    await collectBody(output.body, context);
    return contents;
};
export const de_DeleteVectorBucketCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    await collectBody(output.body, context);
    return contents;
};
export const de_DeleteVectorBucketPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    await collectBody(output.body, context);
    return contents;
};
export const de_DeleteVectorsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    await collectBody(output.body, context);
    return contents;
};
export const de_GetIndexCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull(__expectObject(await parseBody(output.body, context)), "body");
    const doc = take(data, {
        index: (_) => de_Index(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetVectorBucketCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull(__expectObject(await parseBody(output.body, context)), "body");
    const doc = take(data, {
        vectorBucket: (_) => de_VectorBucket(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetVectorBucketPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull(__expectObject(await parseBody(output.body, context)), "body");
    const doc = take(data, {
        policy: __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_GetVectorsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull(__expectObject(await parseBody(output.body, context)), "body");
    const doc = take(data, {
        vectors: (_) => de_GetVectorsOutputList(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListIndexesCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull(__expectObject(await parseBody(output.body, context)), "body");
    const doc = take(data, {
        indexes: (_) => de_ListIndexesOutputList(_, context),
        nextToken: __expectString,
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListVectorBucketsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull(__expectObject(await parseBody(output.body, context)), "body");
    const doc = take(data, {
        nextToken: __expectString,
        vectorBuckets: (_) => de_ListVectorBucketsOutputList(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_ListVectorsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull(__expectObject(await parseBody(output.body, context)), "body");
    const doc = take(data, {
        nextToken: __expectString,
        vectors: (_) => de_ListVectorsOutputList(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
export const de_PutVectorBucketPolicyCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    await collectBody(output.body, context);
    return contents;
};
export const de_PutVectorsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    await collectBody(output.body, context);
    return contents;
};
export const de_QueryVectorsCommand = async (output, context) => {
    if (output.statusCode !== 200 && output.statusCode >= 300) {
        return de_CommandError(output, context);
    }
    const contents = map({
        $metadata: deserializeMetadata(output),
    });
    const data = __expectNonNull(__expectObject(await parseBody(output.body, context)), "body");
    const doc = take(data, {
        vectors: (_) => de_QueryVectorsOutputList(_, context),
    });
    Object.assign(contents, doc);
    return contents;
};
const de_CommandError = async (output, context) => {
    const parsedOutput = {
        ...output,
        body: await parseErrorBody(output.body, context),
    };
    const errorCode = loadRestJsonErrorCode(output, parsedOutput.body);
    switch (errorCode) {
        case "AccessDeniedException":
        case "com.amazonaws.s3vectors#AccessDeniedException":
            throw await de_AccessDeniedExceptionRes(parsedOutput, context);
        case "ConflictException":
        case "com.amazonaws.s3vectors#ConflictException":
            throw await de_ConflictExceptionRes(parsedOutput, context);
        case "InternalServerException":
        case "com.amazonaws.s3vectors#InternalServerException":
            throw await de_InternalServerExceptionRes(parsedOutput, context);
        case "NotFoundException":
        case "com.amazonaws.s3vectors#NotFoundException":
            throw await de_NotFoundExceptionRes(parsedOutput, context);
        case "ServiceQuotaExceededException":
        case "com.amazonaws.s3vectors#ServiceQuotaExceededException":
            throw await de_ServiceQuotaExceededExceptionRes(parsedOutput, context);
        case "ServiceUnavailableException":
        case "com.amazonaws.s3vectors#ServiceUnavailableException":
            throw await de_ServiceUnavailableExceptionRes(parsedOutput, context);
        case "TooManyRequestsException":
        case "com.amazonaws.s3vectors#TooManyRequestsException":
            throw await de_TooManyRequestsExceptionRes(parsedOutput, context);
        case "ValidationException":
        case "com.amazonaws.s3vectors#ValidationException":
            throw await de_ValidationExceptionRes(parsedOutput, context);
        case "KmsDisabledException":
        case "com.amazonaws.s3vectors#KmsDisabledException":
            throw await de_KmsDisabledExceptionRes(parsedOutput, context);
        case "KmsInvalidKeyUsageException":
        case "com.amazonaws.s3vectors#KmsInvalidKeyUsageException":
            throw await de_KmsInvalidKeyUsageExceptionRes(parsedOutput, context);
        case "KmsInvalidStateException":
        case "com.amazonaws.s3vectors#KmsInvalidStateException":
            throw await de_KmsInvalidStateExceptionRes(parsedOutput, context);
        case "KmsNotFoundException":
        case "com.amazonaws.s3vectors#KmsNotFoundException":
            throw await de_KmsNotFoundExceptionRes(parsedOutput, context);
        default:
            const parsedBody = parsedOutput.body;
            return throwDefaultError({
                output,
                parsedBody,
                errorCode,
            });
    }
};
const throwDefaultError = withBaseException(__BaseException);
const de_AccessDeniedExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new AccessDeniedException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_ConflictExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ConflictException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_InternalServerExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new InternalServerException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_KmsDisabledExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new KmsDisabledException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_KmsInvalidKeyUsageExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new KmsInvalidKeyUsageException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_KmsInvalidStateExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new KmsInvalidStateException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_KmsNotFoundExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new KmsNotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_NotFoundExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new NotFoundException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_ServiceQuotaExceededExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ServiceQuotaExceededException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_ServiceUnavailableExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ServiceUnavailableException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_TooManyRequestsExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new TooManyRequestsException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const de_ValidationExceptionRes = async (parsedOutput, context) => {
    const contents = map({});
    const data = parsedOutput.body;
    const doc = take(data, {
        fieldList: _json,
        message: __expectString,
    });
    Object.assign(contents, doc);
    const exception = new ValidationException({
        $metadata: deserializeMetadata(parsedOutput),
        ...contents,
    });
    return __decorateServiceException(exception, parsedOutput.body);
};
const se_Float32VectorData = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return __serializeFloat(entry);
    });
};
const se_PutInputVector = (input, context) => {
    return take(input, {
        data: (_) => se_VectorData(_, context),
        key: [],
        metadata: (_) => se_VectorMetadata(_, context),
    });
};
const se_PutVectorsInputList = (input, context) => {
    return input
        .filter((e) => e != null)
        .map((entry) => {
        return se_PutInputVector(entry, context);
    });
};
const se_VectorData = (input, context) => {
    return VectorData.visit(input, {
        float32: (value) => ({ float32: se_Float32VectorData(value, context) }),
        _: (name, value) => ({ [name]: value }),
    });
};
const se_VectorMetadata = (input, context) => {
    return input;
};
const se_Document = (input, context) => {
    return input;
};
const de_Float32VectorData = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return __limitedParseFloat32(entry);
    });
    return retVal;
};
const de_GetOutputVector = (output, context) => {
    return take(output, {
        data: (_) => de_VectorData(__expectUnion(_), context),
        key: __expectString,
        metadata: (_) => de_VectorMetadata(_, context),
    });
};
const de_GetVectorsOutputList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_GetOutputVector(entry, context);
    });
    return retVal;
};
const de_Index = (output, context) => {
    return take(output, {
        creationTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        dataType: __expectString,
        dimension: __expectInt32,
        distanceMetric: __expectString,
        indexArn: __expectString,
        indexName: __expectString,
        metadataConfiguration: _json,
        vectorBucketName: __expectString,
    });
};
const de_IndexSummary = (output, context) => {
    return take(output, {
        creationTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        indexArn: __expectString,
        indexName: __expectString,
        vectorBucketName: __expectString,
    });
};
const de_ListIndexesOutputList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_IndexSummary(entry, context);
    });
    return retVal;
};
const de_ListOutputVector = (output, context) => {
    return take(output, {
        data: (_) => de_VectorData(__expectUnion(_), context),
        key: __expectString,
        metadata: (_) => de_VectorMetadata(_, context),
    });
};
const de_ListVectorBucketsOutputList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_VectorBucketSummary(entry, context);
    });
    return retVal;
};
const de_ListVectorsOutputList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_ListOutputVector(entry, context);
    });
    return retVal;
};
const de_QueryOutputVector = (output, context) => {
    return take(output, {
        data: (_) => de_VectorData(__expectUnion(_), context),
        distance: __limitedParseFloat32,
        key: __expectString,
        metadata: (_) => de_VectorMetadata(_, context),
    });
};
const de_QueryVectorsOutputList = (output, context) => {
    const retVal = (output || [])
        .filter((e) => e != null)
        .map((entry) => {
        return de_QueryOutputVector(entry, context);
    });
    return retVal;
};
const de_VectorBucket = (output, context) => {
    return take(output, {
        creationTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        encryptionConfiguration: _json,
        vectorBucketArn: __expectString,
        vectorBucketName: __expectString,
    });
};
const de_VectorBucketSummary = (output, context) => {
    return take(output, {
        creationTime: (_) => __expectNonNull(__parseEpochTimestamp(__expectNumber(_))),
        vectorBucketArn: __expectString,
        vectorBucketName: __expectString,
    });
};
const de_VectorData = (output, context) => {
    if (output.float32 != null) {
        return {
            float32: de_Float32VectorData(output.float32, context),
        };
    }
    return { $unknown: Object.entries(output)[0] };
};
const de_VectorMetadata = (output, context) => {
    return output;
};
const deserializeMetadata = (output) => ({
    httpStatusCode: output.statusCode,
    requestId: output.headers["x-amzn-requestid"] ?? output.headers["x-amzn-request-id"] ?? output.headers["x-amz-request-id"],
    extendedRequestId: output.headers["x-amz-id-2"],
    cfId: output.headers["x-amz-cf-id"],
});
const collectBodyString = (streamBody, context) => collectBody(streamBody, context).then((body) => context.utf8Encoder(body));
