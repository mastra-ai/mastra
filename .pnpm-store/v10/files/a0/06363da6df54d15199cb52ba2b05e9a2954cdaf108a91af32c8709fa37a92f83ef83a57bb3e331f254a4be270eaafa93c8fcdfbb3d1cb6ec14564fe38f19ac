#pragma once
#include <napi.h>

namespace couchnode
{

namespace utils
{

static inline Napi::Symbol napiGetSymbol(const Napi::Env &env, std::string name)
{
    auto Symbol = env.Global().Get("Symbol").As<Napi::Object>();
    auto forSymbol = Symbol.Get("for").As<Napi::Function>().Call(
        Symbol, {Napi::String::New(env, name)});
    return forSymbol.As<Napi::Symbol>();
}

template <typename T>
static inline Napi::Value napiDataToBuffer(Napi::Env env, const T &data)
{
    return Napi::Buffer<T>::Copy(env, &data, 1);
}

template <typename T>
static inline T napiBufferToData(Napi::Value buf)
{
    return *(T *)buf.template As<Napi::Buffer<T>>().Data();
}

} // namespace utils

} // namespace couchnode
