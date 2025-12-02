#include "scan_iterator.hpp"
#include "connection.hpp"
#include "jstocbpp.hpp"

namespace couchnode
{

void ScanIterator::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func = DefineClass(
        env, "ScanIterator",
        {
            InstanceMethod<&ScanIterator::jsNext>("next"),
            InstanceMethod<&ScanIterator::jsCancel>("cancel"),
            InstanceAccessor<&ScanIterator::jsCancelled>("cancelled"),
        });

    constructor(env) = Napi::Persistent(func);
    exports.Set("ScanIterator", func);
}

ScanIterator::ScanIterator(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<ScanIterator>(info)
{
    if (info.Length() > 0) {
        auto wrapped_result =
            *info[0]
                 .As<const Napi::External<couchbase::core::scan_result>>()
                 .Data();
        this->result_ =
            std::make_shared<couchbase::core::scan_result>(wrapped_result);
    }
}

ScanIterator::~ScanIterator()
{
}

Napi::Value ScanIterator::jsNext(const Napi::CallbackInfo &info)
{
    auto env = info.Env();
    auto callbackJsFn = info[0].As<Napi::Function>();
    auto cookie = CallCookie(env, callbackJsFn, "cbRangeScanNext");

    auto handler = [](Napi::Env env, Napi::Function callback,
                      couchbase::core::range_scan_item resp,
                      std::error_code ec) mutable {
        Napi::Value jsErr, jsRes;
        if (ec && ec == couchbase::errc::key_value::range_scan_completed) {
            jsErr = env.Null();
            jsRes = env.Undefined();
        } else {
            try {
                jsErr = cbpp_to_js(env, ec);
                jsRes = cbpp_to_js(env, resp);
            } catch (const Napi::Error &e) {
                jsErr = e.Value();
                jsRes = env.Null();
            }
        }
        callback.Call({jsErr, jsRes});
    };

    this->result_->next(
        [cookie = std::move(cookie), handler = std::move(handler)](
            couchbase::core::range_scan_item resp, std::error_code ec) mutable {
            cookie.invoke([handler = std::move(handler), resp = std::move(resp),
                           ec = std::move(ec)](
                              Napi::Env env, Napi::Function callback) mutable {
                handler(env, callback, std::move(resp), std::move(ec));
            });
        });

    return env.Null();
}

Napi::Value ScanIterator::jsCancel(const Napi::CallbackInfo &info)
{
    auto env = info.Env();
    this->result_->cancel();
    return Napi::Boolean::New(env, this->result_->is_cancelled());
}

Napi::Value ScanIterator::jsCancelled(const Napi::CallbackInfo &info)
{
    auto env = info.Env();
    return Napi::Boolean::New(env, this->result_->is_cancelled());
}

} // namespace couchnode
