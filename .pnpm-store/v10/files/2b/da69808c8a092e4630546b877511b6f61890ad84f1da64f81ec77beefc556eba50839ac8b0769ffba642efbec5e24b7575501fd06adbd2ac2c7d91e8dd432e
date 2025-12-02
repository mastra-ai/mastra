#pragma once
#include <napi.h>

namespace couchnode
{

class Transcoder
{
public:
    Transcoder()
    {
    }

    static inline Transcoder parse(Napi::Value transcoder)
    {
        return Transcoder(transcoder);
    }

    std::tuple<std::string, uint32_t> encode(Napi::Value content) const
    {
        auto jsTranscoderObj = _jsObj.Value();
        auto jsEncodeVal = jsTranscoderObj.Get("encode");
        auto jsEncodeFn = jsEncodeVal.As<Napi::Function>();
        if (!jsEncodeFn.IsFunction()) {
            throw Napi::Error::New(content.Env(),
                                   "invalid transcoder encode function");
        }

        auto jsEncodedVal = jsEncodeFn.Call(jsTranscoderObj, {content});

        auto jsEncodedArr = jsEncodedVal.As<Napi::Array>();
        if (!jsEncodedArr.IsArray()) {
            throw Napi::Error::New(
                content.Env(),
                "transcoder encode function did not return a tuple");
        }

        auto jsContentVal = jsEncodedArr.Get(uint32_t(0));
        auto jsContentBuf = jsContentVal.As<Napi::Buffer<uint8_t>>();
        if (!jsContentBuf.IsBuffer()) {
            throw Napi::Error::New(content.Env(),
                                   "transcoder encode function did not return "
                                   "content as a buffer");
        }

        auto jsFlagsVal = jsEncodedArr.Get(uint32_t(1));
        auto jsFlagsNum = jsFlagsVal.As<Napi::Number>();
        if (!jsFlagsNum.IsNumber()) {
            throw Napi::Error::New(
                content.Env(),
                "transcoder encode function did not return flags as a number");
        }

        std::string data(reinterpret_cast<char *>(jsContentBuf.Data()),
                         jsContentBuf.Length());
        uint32_t flags =
            static_cast<uint32_t>(jsFlagsNum.Int64Value() & 0xFFFFFFFF);
        return std::make_tuple(std::move(data), flags);
    }

    Napi::Value decode(Napi::Env env, const std::string &data,
                       uint32_t flags) const
    {
        auto jsTranscoderObj = _jsObj.Value();
        auto jsDecodeVal = jsTranscoderObj.Get("decode");
        auto jsDecodeFn = jsDecodeVal.As<Napi::Function>();
        if (!jsDecodeFn.IsFunction()) {
            throw Napi::Error::New(env, "invalid transcoder decode function");
        }

        auto jsDataBuf = Napi::Buffer<uint8_t>::Copy(
            env, reinterpret_cast<const uint8_t *>(data.c_str()), data.size());
        auto jsFlagsNum = Napi::Number::New(env, flags);

        auto jsDecodedVal =
            jsDecodeFn.Call(jsTranscoderObj, {jsDataBuf, jsFlagsNum});

        return jsDecodedVal;
    }

private:
    Transcoder(Napi::Value transcoder)
    {
        auto jsTranscoderObj = transcoder.As<Napi::Object>();
        if (!jsTranscoderObj.IsObject()) {
            throw Napi::Error::New(transcoder.Env(),
                                   "invalid transcoder type specified");
        }

        _jsObj = Napi::Persistent(jsTranscoderObj);
    }

    Napi::ObjectReference _jsObj;
};

} // namespace couchnode
