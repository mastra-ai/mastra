"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var headers_exports = {};
__export(headers_exports, {
  CITY_HEADER_NAME: () => CITY_HEADER_NAME,
  COUNTRY_HEADER_NAME: () => COUNTRY_HEADER_NAME,
  EMOJI_FLAG_UNICODE_STARTING_POSITION: () => EMOJI_FLAG_UNICODE_STARTING_POSITION,
  IP_HEADER_NAME: () => IP_HEADER_NAME,
  LATITUDE_HEADER_NAME: () => LATITUDE_HEADER_NAME,
  LONGITUDE_HEADER_NAME: () => LONGITUDE_HEADER_NAME,
  POSTAL_CODE_HEADER_NAME: () => POSTAL_CODE_HEADER_NAME,
  REGION_HEADER_NAME: () => REGION_HEADER_NAME,
  REQUEST_ID_HEADER_NAME: () => REQUEST_ID_HEADER_NAME,
  geolocation: () => geolocation,
  ipAddress: () => ipAddress
});
module.exports = __toCommonJS(headers_exports);
const CITY_HEADER_NAME = "x-vercel-ip-city";
const COUNTRY_HEADER_NAME = "x-vercel-ip-country";
const IP_HEADER_NAME = "x-real-ip";
const LATITUDE_HEADER_NAME = "x-vercel-ip-latitude";
const LONGITUDE_HEADER_NAME = "x-vercel-ip-longitude";
const REGION_HEADER_NAME = "x-vercel-ip-country-region";
const POSTAL_CODE_HEADER_NAME = "x-vercel-ip-postal-code";
const REQUEST_ID_HEADER_NAME = "x-vercel-id";
const EMOJI_FLAG_UNICODE_STARTING_POSITION = 127397;
function getHeader(headers, key) {
  return headers.get(key) ?? void 0;
}
function getHeaderWithDecode(request, key) {
  const header = getHeader(request.headers, key);
  return header ? decodeURIComponent(header) : void 0;
}
function getFlag(countryCode) {
  const regex = new RegExp("^[A-Z]{2}$").test(countryCode);
  if (!countryCode || !regex)
    return void 0;
  return String.fromCodePoint(
    ...countryCode.split("").map((char) => EMOJI_FLAG_UNICODE_STARTING_POSITION + char.charCodeAt(0))
  );
}
function ipAddress(input) {
  const headers = "headers" in input ? input.headers : input;
  return getHeader(headers, IP_HEADER_NAME);
}
function getRegionFromRequestId(requestId) {
  if (!requestId) {
    return "dev1";
  }
  return requestId.split(":")[0];
}
function geolocation(request) {
  return {
    // city name may be encoded to support multi-byte characters
    city: getHeaderWithDecode(request, CITY_HEADER_NAME),
    country: getHeader(request.headers, COUNTRY_HEADER_NAME),
    flag: getFlag(getHeader(request.headers, COUNTRY_HEADER_NAME)),
    countryRegion: getHeader(request.headers, REGION_HEADER_NAME),
    region: getRegionFromRequestId(
      getHeader(request.headers, REQUEST_ID_HEADER_NAME)
    ),
    latitude: getHeader(request.headers, LATITUDE_HEADER_NAME),
    longitude: getHeader(request.headers, LONGITUDE_HEADER_NAME),
    postalCode: getHeader(request.headers, POSTAL_CODE_HEADER_NAME)
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CITY_HEADER_NAME,
  COUNTRY_HEADER_NAME,
  EMOJI_FLAG_UNICODE_STARTING_POSITION,
  IP_HEADER_NAME,
  LATITUDE_HEADER_NAME,
  LONGITUDE_HEADER_NAME,
  POSTAL_CODE_HEADER_NAME,
  REGION_HEADER_NAME,
  REQUEST_ID_HEADER_NAME,
  geolocation,
  ipAddress
});
