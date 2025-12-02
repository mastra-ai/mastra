#pragma once
#include "addondata.hpp"
#include "napi.h"
#include <core/cluster.hxx>
#include <couchbase/mutation_token.hxx>

namespace couchnode
{

class MutationToken : public Napi::ObjectWrap<MutationToken>
{
public:
    static Napi::FunctionReference &constructor(Napi::Env env)
    {
        return AddonData::fromEnv(env)->_mutationTokenCtor;
    }

    static void Init(Napi::Env env, Napi::Object exports);

    static Napi::Value toBuffer(Napi::Env env,
                                const couchbase::mutation_token &token);
    static couchbase::mutation_token fromBuffer(Napi::Value val);
    static Napi::Value create(Napi::Env env,
                              const couchbase::mutation_token &token);
    static couchbase::mutation_token parse(Napi::Value val);

    MutationToken(const Napi::CallbackInfo &info);
    ~MutationToken();

    Napi::Value jsToString(const Napi::CallbackInfo &info);
    Napi::Value jsToJSON(const Napi::CallbackInfo &info);
    Napi::Value jsInspect(const Napi::CallbackInfo &info);

private:
};

} // namespace couchnode
