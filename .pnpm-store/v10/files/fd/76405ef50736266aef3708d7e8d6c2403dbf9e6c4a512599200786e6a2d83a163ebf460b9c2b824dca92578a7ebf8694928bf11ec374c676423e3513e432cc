#pragma once
#include "addondata.hpp"
#include <core/transactions.hxx>
#include <memory>
#include <napi.h>

namespace cbtxns = couchbase::transactions;
namespace cbcoretxns = couchbase::core::transactions;

namespace couchnode
{

class Transactions : public Napi::ObjectWrap<Transactions>
{
public:
    static Napi::FunctionReference &constructor(Napi::Env env)
    {
        return AddonData::fromEnv(env)->_transactionsCtor;
    }

    cbcoretxns::transactions &transactions() const
    {
        return *_impl;
    }

    static void Init(Napi::Env env, Napi::Object exports);

    Transactions(const Napi::CallbackInfo &info);
    ~Transactions();

    Napi::Value jsClose(const Napi::CallbackInfo &info);

private:
    std::shared_ptr<cbcoretxns::transactions> _impl;
};

} // namespace couchnode
