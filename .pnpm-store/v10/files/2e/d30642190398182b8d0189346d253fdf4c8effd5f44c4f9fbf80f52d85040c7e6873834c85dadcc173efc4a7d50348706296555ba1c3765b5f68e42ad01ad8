#include "cas.hpp"
#include "utils.hpp"
#include <sstream>

namespace couchnode
{

void Cas::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func =
        DefineClass(env, "Cas",
                    {
                        InstanceMethod<&Cas::jsToString>("toString"),
                        InstanceMethod<&Cas::jsToString>("toJSON"),
                        InstanceMethod<&Cas::jsInspect>(utils::napiGetSymbol(
                            env, "nodejs.util.inspect.custom")),
                    });

    constructor(env) = Napi::Persistent(func);
    exports.Set("Cas", func);
}

Cas::Cas(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<Cas>(info)
{
    if (info[0].IsBuffer()) {
        info.This().As<Napi::Object>().Set("raw", info[0]);
        return;
    }

    couchbase::cas cas = Cas::parse(info[0]);
    auto rawBytesVal = Cas::toBuffer(info.Env(), cas);
    info.This().As<Napi::Object>().Set("raw", rawBytesVal);
}

Cas::~Cas()
{
}

Napi::Value Cas::toBuffer(Napi::Env env, couchbase::cas cas)
{
    return utils::napiDataToBuffer<couchbase::cas>(env, cas);
}

couchbase::cas Cas::fromBuffer(Napi::Value val)
{
    return utils::napiBufferToData<couchbase::cas>(val);
}

Napi::Value Cas::create(Napi::Env env, couchbase::cas cas)
{
    auto rawBytesVal = Cas::toBuffer(env, cas);
    return Cas::constructor(env).New({rawBytesVal});
}

couchbase::cas Cas::parse(Napi::Value val)
{
    if (val.IsNull()) {
        return couchbase::cas{0};
    } else if (val.IsUndefined()) {
        return couchbase::cas{0};
    } else if (val.IsString()) {
        auto textVal = val.ToString().Utf8Value();
        auto intVal = std::stoull(textVal);
        return couchbase::cas{intVal};
    } else if (val.IsBuffer()) {
        return Cas::fromBuffer(val);
    } else if (val.IsObject()) {
        auto objVal = val.As<Napi::Object>();
        auto maybeRawVal = objVal.Get("raw");
        if (!maybeRawVal.IsEmpty()) {
            return Cas::fromBuffer(maybeRawVal);
        }
    }

    return couchbase::cas{0};
}

Napi::Value Cas::jsToString(const Napi::CallbackInfo &info)
{
    auto cas = Cas::parse(info.This());

    std::stringstream stream;
    stream << cas.value();
    return Napi::String::New(info.Env(), stream.str());
}

Napi::Value Cas::jsInspect(const Napi::CallbackInfo &info)
{
    auto cas = Cas::parse(info.This());

    std::stringstream stream;
    stream << "Cas<" << cas.value() << ">";
    return Napi::String::New(info.Env(), stream.str());
}

} // namespace couchnode
