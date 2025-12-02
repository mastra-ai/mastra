#pragma once
#include "addondata.hpp"
#include "napi.h"
#include <couchbase/cas.hxx>

namespace couchbase
{
typedef couchbase::cas cas;
}

namespace couchnode
{

class Cas : public Napi::ObjectWrap<Cas>
{
public:
    static Napi::FunctionReference &constructor(Napi::Env env)
    {
        return AddonData::fromEnv(env)->_casCtor;
    }

    static void Init(Napi::Env env, Napi::Object exports);

    static Napi::Value toBuffer(Napi::Env env, couchbase::cas cas);
    static couchbase::cas fromBuffer(Napi::Value val);
    static Napi::Value create(Napi::Env env, couchbase::cas cas);
    static couchbase::cas parse(Napi::Value val);

    Cas(const Napi::CallbackInfo &info);
    ~Cas();

    Napi::Value jsToString(const Napi::CallbackInfo &info);
    Napi::Value jsInspect(const Napi::CallbackInfo &info);

private:
};

} // namespace couchnode
