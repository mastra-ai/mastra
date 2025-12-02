#pragma once
#include <napi.h>

#include "transcoder.hpp"

namespace couchnode
{

template <typename T, typename Enabled = void>
struct js_to_cbpp_t;

template <typename T>
static inline T js_to_cbpp(Napi::Value jsVal)
{
    return js_to_cbpp_t<T>::from_js(jsVal);
}

template <typename T>
static inline void js_to_cbpp(T &cppObj, Napi::Value jsVal)
{
    cppObj = js_to_cbpp_t<T>::from_js(jsVal);
}

template <typename T>
static inline Napi::Value cbpp_to_js(Napi::Env env, const T &cppObj)
{
    return js_to_cbpp_t<T>::to_js(env, cppObj);
}

template <typename T>
static inline Napi::Value cbpp_to_js(Napi::Env env, const T &cppObj,
                                     const Transcoder &transcoder)
{
    return js_to_cbpp_t<T>::to_js(env, cppObj, transcoder);
}

template <typename T>
static inline T jsToCbpp(Napi::Value jsVal)
{
    return js_to_cbpp_t<T>::from_js(jsVal);
}

template <typename T>
static inline T jsToCbpp(Napi::Value jsVal, const Transcoder &transcoder)
{
    return js_to_cbpp_t<T>::from_js(jsVal, transcoder);
}

template <typename T>
Napi::Value cbppToJs(Napi::Env env, const T &cppObj)
{
    return js_to_cbpp_t<T>::to_js(env, cppObj);
}

template <typename T>
Napi::Value cbppToJs(Napi::Env env, const T &cppObj,
                     const Transcoder &transcoder)
{
    return js_to_cbpp_t<T>::to_js(env, cppObj, transcoder);
}

} // namespace couchnode
