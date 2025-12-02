#include "transactions.hpp"
#include "connection.hpp"
#include <core/transactions/internal/exceptions_internal.hxx>
#include <core/transactions/internal/utils.hxx>
#include <type_traits>

namespace couchnode
{

void Transactions::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func =
        DefineClass(env, "Transactions",
                    {
                        InstanceMethod<&Transactions::jsClose>("close"),
                    });

    constructor(env) = Napi::Persistent(func);
    exports.Set("Transactions", func);
}

Transactions::Transactions(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<Transactions>(info)
{
    auto clusterJsObj = info[0].As<Napi::Object>();
    auto configJsObj = info[1].As<Napi::Object>();

    if (!clusterJsObj.InstanceOf(Connection::constructor(info.Env()).Value())) {
        throw Napi::Error::New(info.Env(),
                               "first parameter must be a Connection object");
    }
    auto cluster = Connection::Unwrap(clusterJsObj)->cluster();

    auto txnsConfig = jsToCbpp<cbtxns::transactions_config>(configJsObj);
    std::future<
        std::pair<std::error_code, std::shared_ptr<cbcoretxns::transactions>>>
        future = cbcoretxns::transactions::create(cluster, txnsConfig);
    std::pair<std::error_code, std::shared_ptr<cbcoretxns::transactions>>
        result = future.get();
    if (result.first.value()) {
        Napi::Error err = Napi::Error::New(info.Env(), result.first.message());
        err.Set("code", Napi::Number::New(info.Env(), result.first.value()));
        throw err;
    }
    _impl.reset();
    _impl = std::move(result.second);
}

Transactions::~Transactions()
{
}

Napi::Value Transactions::jsClose(const Napi::CallbackInfo &info)
{
    auto callbackJsFn = info[0].As<Napi::Function>();

    _impl->close();
    callbackJsFn.Call({info.Env().Null()});

    return info.Env().Null();
}

} // namespace couchnode
