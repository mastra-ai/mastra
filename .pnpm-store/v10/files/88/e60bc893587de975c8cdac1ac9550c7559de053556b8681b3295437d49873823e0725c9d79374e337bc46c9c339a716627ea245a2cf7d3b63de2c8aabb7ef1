#pragma once
#include "jstocbpp_defs.hpp"

#include <map>
#include <napi.h>
#include <optional>
#include <set>
#include <variant>
#include <vector>

namespace couchnode
{

// integral types
template <typename T>
struct js_to_cbpp_t<T, typename std::enable_if_t<std::is_integral_v<T>>> {
    static inline Napi::Value to_js(Napi::Env env, T cppObj)
    {
        if constexpr (std::is_same_v<T, bool>) {
            return Napi::Boolean::New(env, cppObj);
        } else {
            return Napi::Number::New(env, cppObj);
        }
    }

    static inline T from_js(Napi::Value jsVal)
    {
        if constexpr (std::is_same_v<T, bool>) {
            return jsVal.ToBoolean().Value();
        } else {
            return static_cast<T>(jsVal.ToNumber().Int64Value());
        }
    }
};

// floating point types
template <typename T>
struct js_to_cbpp_t<T, typename std::enable_if_t<std::is_floating_point_v<T>>> {
    static inline Napi::Value to_js(Napi::Env env, T cppObj)
    {
        return Napi::Number::New(env, cppObj);
    }

    static inline T from_js(Napi::Value jsVal)
    {
        return static_cast<T>(jsVal.ToNumber().DoubleValue());
    }
};

// enum types
template <typename T>
struct js_to_cbpp_t<T, typename std::enable_if_t<std::is_enum_v<T>>> {
    static inline Napi::Value to_js(Napi::Env env, T cppObj)
    {
        return Napi::Number::New(env, static_cast<int64_t>(cppObj));
    }

    static inline T from_js(Napi::Value jsVal)
    {
        return static_cast<T>(jsVal.ToNumber().Int64Value());
    }
};

// std::string type
template <>
struct js_to_cbpp_t<std::string> {
    static inline Napi::Value to_js(Napi::Env env, const std::string &cppObj)
    {
        return Napi::String::New(env, cppObj);
    }

    static inline std::string from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return "";
        }

        return jsVal.ToString().Utf8Value();
    }
};

// std::chrono::nanoseconds type
template <>
struct js_to_cbpp_t<std::chrono::nanoseconds> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::chrono::nanoseconds &cppObj)
    {
        return Napi::Number::New(env, cppObj / std::chrono::milliseconds(1));
    }

    static inline std::chrono::nanoseconds from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsUndefined() || jsVal.IsNull()) {
            return std::chrono::nanoseconds::zero();
        }

        return std::chrono::duration_cast<std::chrono::nanoseconds>(
            jsVal.ToNumber().Int64Value() * std::chrono::milliseconds(1));
    }
};

// std::chrono::microseconds type
template <>
struct js_to_cbpp_t<std::chrono::microseconds> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::chrono::microseconds &cppObj)
    {
        return Napi::Number::New(env, cppObj / std::chrono::milliseconds(1));
    }

    static inline std::chrono::microseconds from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsUndefined() || jsVal.IsNull()) {
            return std::chrono::microseconds::zero();
        }

        return std::chrono::duration_cast<std::chrono::microseconds>(
            jsVal.ToNumber().Int64Value() * std::chrono::milliseconds(1));
    }
};

// std::chrono::milliseconds type
template <>
struct js_to_cbpp_t<std::chrono::milliseconds> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::chrono::milliseconds &cppObj)
    {
        return Napi::Number::New(env, cppObj / std::chrono::milliseconds(1));
    }

    static inline std::chrono::milliseconds from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsUndefined() || jsVal.IsNull()) {
            return std::chrono::milliseconds::zero();
        }

        return jsVal.ToNumber().Int64Value() * std::chrono::milliseconds(1);
    }
};

// std::chrono::seconds type
template <>
struct js_to_cbpp_t<std::chrono::seconds> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::chrono::seconds &cppObj)
    {
        return Napi::Number::New(env, cppObj / std::chrono::milliseconds(1));
    }

    static inline std::chrono::seconds from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsUndefined() || jsVal.IsNull()) {
            return std::chrono::seconds::zero();
        }

        return std::chrono::duration_cast<std::chrono::seconds>(
            jsVal.ToNumber().Int64Value() * std::chrono::milliseconds(1));
    }
};

// std::monostate type
template <>
struct js_to_cbpp_t<std::monostate> {
    static inline Napi::Value to_js(Napi::Env env, const std::monostate &cppObj)
    {
        return env.Undefined();
    }
};

// std::optional type
template <typename T>
struct js_to_cbpp_t<std::optional<T>> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::optional<T> &cppObj)
    {
        if (!cppObj.has_value()) {
            return env.Undefined();
        }
        return cbpp_to_js<T>(env, cppObj.value());
    }

    static inline std::optional<T> from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsUndefined()) {
            return std::optional<T>();
        }
        return js_to_cbpp<T>(jsVal);
    }
};

// std::vector type
template <typename T>
struct js_to_cbpp_t<std::vector<T>> {
    static inline Napi::Value to_js(Napi::Env env, const std::vector<T> &cppObj)
    {
        auto jsArr = Napi::Array::New(env);
        for (auto i = 0; i < cppObj.size(); ++i) {
            jsArr.Set(i, cbpp_to_js<T>(env, cppObj[i]));
        }
        return jsArr;
    }

    static inline std::vector<T> from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return {};
        }

        std::vector<T> cppObj;
        auto jsArr = jsVal.As<Napi::Array>();
        for (auto i = 0; i < jsArr.Length(); ++i) {
            cppObj.emplace_back(js_to_cbpp<T>(jsArr.Get(i)));
        }
        return cppObj;
    }
};

// std::array type
template <typename T, size_t N>
struct js_to_cbpp_t<std::array<T, N>> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::array<T, N> &cppObj)
    {
        auto jsArr = Napi::Array::New(env);
        for (auto i = 0; i < N; ++i) {
            jsArr.Set(i, cbpp_to_js<T>(env, cppObj[i]));
        }
        return jsArr;
    }

    static inline std::array<T, N> from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return {};
        }

        auto jsArr = jsVal.As<Napi::Array>();
        if (jsArr.Length() != N) {
            throw Napi::Error::New(jsVal.Env(), "invalid array size");
        }

        std::array<T, N> cppObj;
        for (auto i = 0; i < N; ++i) {
            cppObj[i] = js_to_cbpp<T>(jsArr.Get(i));
        }
        return cppObj;
    }
};

// std::set type
template <typename T>
struct js_to_cbpp_t<std::set<T>> {
    static inline Napi::Value to_js(Napi::Env env, const std::set<T> &cppObj)
    {
        auto jsArr = Napi::Array::New(env);
        auto cppObjVec = std::vector<T>(cppObj.begin(), cppObj.end());
        for (auto i = 0; i < cppObjVec.size(); ++i) {
            jsArr.Set(i, cbpp_to_js<T>(env, cppObjVec[i]));
        }
        return jsArr;
    }

    static inline std::set<T> from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return {};
        }

        std::set<T> cppObj;
        auto jsArr = jsVal.As<Napi::Array>();   
        for (auto i = 0; i < jsArr.Length(); ++i) {
            cppObj.insert(js_to_cbpp<T>(jsArr.Get(i)));
        }
        return cppObj;
    }
};

// std::map<string, ...> type
template <typename T, typename... Args>
struct js_to_cbpp_t<std::map<std::string, T, Args...>> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::map<std::string, T, Args...> &cppObj)
    {
        auto jsObj = Napi::Object::New(env);
        for (const auto &i : cppObj) {
            jsObj.Set(i.first, cbpp_to_js<T>(env, i.second));
        }
        return jsObj;
    }

    static inline std::map<std::string, T, Args...> from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return {};
        }

        std::map<std::string, T, Args...> cppObj;
        auto jsObj = jsVal.As<Napi::Object>();
        auto jsPropNames = jsObj.GetPropertyNames();
        for (auto i = 0; i < jsPropNames.Length(); ++i) {
            auto jsKey = jsPropNames.Get(i);
            auto key = jsKey.As<Napi::String>().Utf8Value();
            auto value = js_to_cbpp<T>(jsObj.Get(jsKey));
            cppObj.emplace(key, value);
        }
        return cppObj;
    }
};

// std::map<enum, ...> type
template <typename K, typename T>
struct js_to_cbpp_t<std::map<K, T>,
                    typename std::enable_if_t<std::is_enum_v<K>>> {
    static inline Napi::Value to_js(Napi::Env env, const std::map<K, T> &cppObj)
    {
        using enum_type_t = std::underlying_type_t<K>;
        auto jsObj = Napi::Object::New(env);
        for (const auto &i : cppObj) {
            jsObj.Set(std::to_string(static_cast<enum_type_t>(i.first)),
                      cbpp_to_js<T>(env, i.second));
        }
        return jsObj;
    }

    static inline std::map<K, T> from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return {};
        }

        std::map<K, T> cppObj;
        auto jsObj = jsVal.As<Napi::Object>();
        auto jsPropNames = jsObj.GetPropertyNames();
        for (auto i = 0; i < jsPropNames.Length(); ++i) {
            auto jsKey = jsPropNames.Get(i);
            auto keyStr = jsKey.As<Napi::String>().Utf8Value();
            auto key = static_cast<K>(std::stoi(keyStr));
            auto value = js_to_cbpp<T>(jsObj.Get(jsKey));
            cppObj.emplace(key, value);
        }
        return cppObj;
    }
};

// std::variant type
template <typename... Types>
struct js_to_cbpp_t<std::variant<Types...>> {
    template <size_t I = 0>
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::variant<Types...> &cppObj)
    {
        using V = std::variant<Types...>;

        if constexpr (I < std::variant_size_v<V>) {
            using VT = std::variant_alternative_t<I, V>;
            if (std::holds_alternative<VT>(cppObj)) {
                return cbpp_to_js(env, std::get<VT>(cppObj));
            }

            return to_js<I + 1>(env, cppObj);
        }

        throw Napi::Error::New(env, "invalid variant type value");
    }

    static inline std::variant<Types...> from_js(Napi::Value jsVal)
    {
        throw Napi::Error::New(jsVal.Env(), "invalid variant marshal from js");
    }
};

// std::vector<std::byte> type
template <>
struct js_to_cbpp_t<std::vector<std::byte>> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::vector<std::byte> &cppObj)
    {
        return Napi::Buffer<std::byte>::Copy(env, cppObj.data(), cppObj.size());
    }

    static inline std::vector<std::byte> from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return {};
        }

        auto jsBuf = jsVal.As<Napi::Buffer<std::byte>>();
        auto bufSize = jsBuf.Length();
        std::vector<std::byte> cppObj(bufSize);
        memcpy(cppObj.data(), jsBuf.Data(), bufSize);
        return cppObj;
    }
};

} // namespace couchnode
