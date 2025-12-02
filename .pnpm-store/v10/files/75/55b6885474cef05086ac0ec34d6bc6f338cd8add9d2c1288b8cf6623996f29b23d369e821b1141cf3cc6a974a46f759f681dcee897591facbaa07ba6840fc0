#pragma once
#include "addondata.hpp"
#include "napi.h"
#include <core/scan_result.hxx>

namespace couchnode
{

class ScanIterator : public Napi::ObjectWrap<ScanIterator>
{
public:
    static Napi::FunctionReference &constructor(Napi::Env env)
    {
        return AddonData::fromEnv(env)->_scanIteratorCtor;
    }

    static void Init(Napi::Env env, Napi::Object exports);

    ScanIterator(const Napi::CallbackInfo &info);
    ~ScanIterator();

    Napi::Value jsNext(const Napi::CallbackInfo &info);
    Napi::Value jsCancel(const Napi::CallbackInfo &info);
    Napi::Value jsCancelled(const Napi::CallbackInfo &info);

private:
    std::shared_ptr<couchbase::core::scan_result> result_;
};

} // namespace couchnode
