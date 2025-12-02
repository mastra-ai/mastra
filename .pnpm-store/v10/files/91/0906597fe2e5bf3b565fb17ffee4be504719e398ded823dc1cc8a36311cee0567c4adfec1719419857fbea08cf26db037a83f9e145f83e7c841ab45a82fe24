#include "mutationtoken.hpp"
#include "jstocbpp.hpp"
#include "utils.hpp"
#include <sstream>

namespace couchnode
{

struct MutationTokenData {
    uint64_t partitionUuid;
    uint64_t sequenceNumber;
    uint16_t partitionId;
    char bucketName[256];
};

void MutationToken::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func = DefineClass(
        env, "MutationToken",
        {
            InstanceMethod<&MutationToken::jsToString>("toString"),
            InstanceMethod<&MutationToken::jsToJSON>("toJSON"),
            InstanceMethod<&MutationToken::jsInspect>(
                utils::napiGetSymbol(env, "nodejs.util.inspect.custom")),
        });

    constructor(env) = Napi::Persistent(func);
    exports.Set("MutationToken", func);
}

MutationToken::MutationToken(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<MutationToken>(info)
{
    if (info[0].IsBuffer()) {
        info.This().As<Napi::Object>().Set("raw", info[0]);
        return;
    }

    auto token = MutationToken::parse(info[0]);
    auto rawBytesVal = MutationToken::toBuffer(info.Env(), token);
    info.This().As<Napi::Object>().Set("raw", rawBytesVal);
}

MutationToken::~MutationToken()
{
}

Napi::Value MutationToken::toBuffer(Napi::Env env,
                                    const couchbase::mutation_token &token)
{
    MutationTokenData tokenData;
    tokenData.partitionId = token.partition_id();
    tokenData.partitionUuid = token.partition_uuid();
    tokenData.sequenceNumber = token.sequence_number();
    memcpy(tokenData.bucketName, token.bucket_name().c_str(),
           token.bucket_name().size() + 1);
    return utils::napiDataToBuffer<MutationTokenData>(env, tokenData);
}

couchbase::mutation_token MutationToken::fromBuffer(Napi::Value val)
{
    MutationTokenData tokenData =
        utils::napiBufferToData<MutationTokenData>(val);

    return couchbase::mutation_token{
        tokenData.partitionUuid, tokenData.sequenceNumber,
        tokenData.partitionId, tokenData.bucketName};
}

Napi::Value MutationToken::create(Napi::Env env,
                                  const couchbase::mutation_token &token)
{
    auto rawBytesVal = MutationToken::toBuffer(env, token);
    return MutationToken::constructor(env).New({rawBytesVal});
}

couchbase::mutation_token MutationToken::parse(Napi::Value val)
{
    if (val.IsNull()) {
        return couchbase::mutation_token{};
    } else if (val.IsUndefined()) {
        return couchbase::mutation_token{};
    } else if (val.IsObject()) {
        auto objVal = val.As<Napi::Object>();
        if (objVal.HasOwnProperty("partition_uuid")) {
            auto partitionUuid =
                jsToCbpp<std::uint64_t>(objVal.Get("partition_uuid"));
            auto sequenceNumber =
                jsToCbpp<std::uint64_t>(objVal.Get("sequence_number"));
            auto partitionId =
                jsToCbpp<std::uint16_t>(objVal.Get("partition_id"));
            auto bucketName = jsToCbpp<std::string>(objVal.Get("bucket_name"));
            return couchbase::mutation_token{partitionUuid, sequenceNumber,
                                             partitionId, bucketName};
        }

        auto maybeRawVal = objVal.Get("raw");
        if (!maybeRawVal.IsEmpty()) {
            return MutationToken::fromBuffer(maybeRawVal);
        }
    } else if (val.IsString()) {
        // not currently supported
    } else if (val.IsBuffer()) {
        return MutationToken::fromBuffer(val);
    }

    return couchbase::mutation_token{};
}

Napi::Value MutationToken::jsToString(const Napi::CallbackInfo &info)
{
    auto token = MutationToken::parse(info.This());

    std::stringstream stream;
    stream << token.bucket_name() << ":" << token.partition_id() << ":"
           << token.partition_uuid() << ":" << token.sequence_number();
    return Napi::String::New(info.Env(), stream.str());
}

Napi::Value MutationToken::jsToJSON(const Napi::CallbackInfo &info)
{
    auto env = info.Env();
    auto token = MutationToken::parse(info.This());

    auto resObj = Napi::Object::New(env);
    resObj.Set("bucket_name", Napi::String::New(env, token.bucket_name()));
    resObj.Set("partition_id", Napi::Number::New(env, token.partition_id()));
    resObj.Set("partition_uuid",
               Napi::String::New(env, std::to_string(token.partition_uuid())));
    resObj.Set("sequence_number",
               Napi::String::New(env, std::to_string(token.sequence_number())));
    return resObj;
}

Napi::Value MutationToken::jsInspect(const Napi::CallbackInfo &info)
{
    auto token = MutationToken::parse(info.This());

    std::stringstream stream;
    stream << "MutationToken<" << token.bucket_name() << ":"
           << token.partition_id() << ":" << token.partition_uuid() << ":"
           << token.sequence_number() << ">";
    return Napi::String::New(info.Env(), stream.str());
}

} // namespace couchnode
