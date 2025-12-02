function clampProp(e, n, t, o, r) {
  return clampEntity(n, getDefinedProp(e, n), t, o, r);
}

function clampEntity(e, n, t, o, r, i) {
  const a = clampNumber(n, t, o);
  if (r && n !== a) {
    throw new RangeError(numberOutOfRange(e, n, t, o, i));
  }
  return a;
}

function getDefinedProp(e, n) {
  const t = e[n];
  if (void 0 === t) {
    throw new TypeError(missingField(n));
  }
  return t;
}

function z(e) {
  return null !== e && /object|function/.test(typeof e);
}

function Jn(e, n = Map) {
  const t = new n;
  return (n, ...o) => {
    if (t.has(n)) {
      return t.get(n);
    }
    const r = e(n, ...o);
    return t.set(n, r), r;
  };
}

function D(e) {
  return p({
    name: e
  }, 1);
}

function p(e, n) {
  return T((e => ({
    value: e,
    configurable: 1,
    writable: !n
  })), e);
}

function O(e) {
  return T((e => ({
    get: e,
    configurable: 1
  })), e);
}

function h(e) {
  return {
    [Symbol.toStringTag]: {
      value: e,
      configurable: 1
    }
  };
}

function zipProps(e, n) {
  const t = {};
  let o = e.length;
  for (const r of n) {
    t[e[--o]] = r;
  }
  return t;
}

function T(e, n, t) {
  const o = {};
  for (const r in n) {
    o[r] = e(n[r], r, t);
  }
  return o;
}

function b(e, n, t) {
  const o = {};
  for (let r = 0; r < n.length; r++) {
    const i = n[r];
    o[i] = e(i, r, t);
  }
  return o;
}

function remapProps(e, n, t) {
  const o = {};
  for (let r = 0; r < e.length; r++) {
    o[n[r]] = t[e[r]];
  }
  return o;
}

function Vn(e, n) {
  const t = {};
  for (const o of e) {
    t[o] = n[o];
  }
  return t;
}

function V(e, n) {
  const t = {};
  for (const o in n) {
    e.has(o) || (t[o] = n[o]);
  }
  return t;
}

function nn(e) {
  e = {
    ...e
  };
  const n = Object.keys(e);
  for (const t of n) {
    void 0 === e[t] && delete e[t];
  }
  return e;
}

function C(e, n) {
  for (const t of n) {
    if (!(t in e)) {
      return 0;
    }
  }
  return 1;
}

function allPropsEqual(e, n, t) {
  for (const o of e) {
    if (n[o] !== t[o]) {
      return 0;
    }
  }
  return 1;
}

function zeroOutProps(e, n, t) {
  const o = {
    ...t
  };
  for (let t = 0; t < n; t++) {
    o[e[t]] = 0;
  }
  return o;
}

function E(e, ...n) {
  return (...t) => e(...n, ...t);
}

function capitalize(e) {
  return e[0].toUpperCase() + e.substring(1);
}

function sortStrings(e) {
  return e.slice().sort();
}

function padNumber(e, n) {
  return String(n).padStart(e, "0");
}

function compareNumbers(e, n) {
  return Math.sign(e - n);
}

function clampNumber(e, n, t) {
  return Math.min(Math.max(e, n), t);
}

function divModFloor(e, n) {
  return [ Math.floor(e / n), modFloor(e, n) ];
}

function modFloor(e, n) {
  return (e % n + n) % n;
}

function divModTrunc(e, n) {
  return [ divTrunc(e, n), modTrunc(e, n) ];
}

function divTrunc(e, n) {
  return Math.trunc(e / n) || 0;
}

function modTrunc(e, n) {
  return e % n || 0;
}

function hasHalf(e) {
  return .5 === Math.abs(e % 1);
}

function givenFieldsToBigNano(e, n, t) {
  let o = 0, r = 0;
  for (let i = 0; i <= n; i++) {
    const n = e[t[i]], a = Xr[i], s = Qr / a, [c, u] = divModTrunc(n, s);
    o += u * a, r += c;
  }
  const [i, a] = divModTrunc(o, Qr);
  return [ r + i, a ];
}

function nanoToGivenFields(e, n, t) {
  const o = {};
  for (let r = n; r >= 0; r--) {
    const n = Xr[r];
    o[t[r]] = divTrunc(e, n), e = modTrunc(e, n);
  }
  return o;
}

function un(e) {
  return e === X ? si : [];
}

function cn(e) {
  return e === X ? li : [];
}

function ln(e) {
  return e === X ? [ "year", "day" ] : [];
}

function l(e) {
  if (void 0 !== e) {
    return m(e);
  }
}

function S(e) {
  if (void 0 !== e) {
    return d(e);
  }
}

function c(e) {
  if (void 0 !== e) {
    return u(e);
  }
}

function d(e) {
  return requireNumberIsPositive(u(e));
}

function u(e) {
  return requireNumberIsInteger(Mi(e));
}

function on(e) {
  if (null == e) {
    throw new TypeError("Cannot be null or undefined");
  }
  return e;
}

function requirePropDefined(e, n) {
  if (null == n) {
    throw new RangeError(missingField(e));
  }
  return n;
}

function de(e) {
  if (!z(e)) {
    throw new TypeError(hr);
  }
  return e;
}

function requireType(e, n, t = e) {
  if (typeof n !== e) {
    throw new TypeError(invalidEntity(t, n));
  }
  return n;
}

function requireNumberIsInteger(e, n = "number") {
  if (!Number.isInteger(e)) {
    throw new RangeError(expectedInteger(n, e));
  }
  return e || 0;
}

function requireNumberIsPositive(e, n = "number") {
  if (e <= 0) {
    throw new RangeError(expectedPositive(n, e));
  }
  return e;
}

function toString(e) {
  if ("symbol" == typeof e) {
    throw new TypeError(pr);
  }
  return String(e);
}

function toStringViaPrimitive(e, n) {
  return z(e) ? String(e) : m(e, n);
}

function toBigInt(e) {
  if ("string" == typeof e) {
    return BigInt(e);
  }
  if ("bigint" != typeof e) {
    throw new TypeError(invalidBigInt(e));
  }
  return e;
}

function toNumber(e, n = "number") {
  if ("bigint" == typeof e) {
    throw new TypeError(forbiddenBigIntToNumber(n));
  }
  if (e = Number(e), !Number.isFinite(e)) {
    throw new RangeError(expectedFinite(n, e));
  }
  return e;
}

function toInteger(e, n) {
  return Math.trunc(toNumber(e, n)) || 0;
}

function toStrictInteger(e, n) {
  return requireNumberIsInteger(toNumber(e, n), n);
}

function toPositiveInteger(e, n) {
  return requireNumberIsPositive(toInteger(e, n), n);
}

function createBigNano(e, n) {
  let [t, o] = divModTrunc(n, Qr), r = e + t;
  const i = Math.sign(r);
  return i && i === -Math.sign(o) && (r -= i, o += i * Qr), [ r, o ];
}

function addBigNanos(e, n, t = 1) {
  return createBigNano(e[0] + n[0] * t, e[1] + n[1] * t);
}

function moveBigNano(e, n) {
  return createBigNano(e[0], e[1] + n);
}

function re(e, n) {
  return addBigNanos(n, e, -1);
}

function te(e, n) {
  return compareNumbers(e[0], n[0]) || compareNumbers(e[1], n[1]);
}

function bigNanoOutside(e, n, t) {
  return -1 === te(e, n) || 1 === te(e, t);
}

function bigIntToBigNano(e, n = 1) {
  const t = BigInt(Qr / n);
  return [ Number(e / t), Number(e % t) * n ];
}

function he(e, n = 1) {
  const t = Qr / n, [o, r] = divModTrunc(e, t);
  return [ o, r * n ];
}

function bigNanoToBigInt(e, n = 1) {
  const [t, o] = e, r = Math.floor(o / n), i = Qr / n;
  return BigInt(t) * BigInt(i) + BigInt(r);
}

function oe(e, n = 1, t) {
  const [o, r] = e, [i, a] = divModTrunc(r, n);
  return o * (Qr / n) + (i + (t ? a / n : 0));
}

function divModBigNano(e, n, t = divModFloor) {
  const [o, r] = e, [i, a] = t(r, n);
  return [ o * (Qr / n) + i, a ];
}

function hashIntlFormatParts(e, n) {
  const t = e.formatToParts(n), o = {};
  for (const e of t) {
    o[e.type] = e.value;
  }
  return o;
}

function checkIsoYearMonthInBounds(e) {
  return clampProp(e, "isoYear", Li, Ai, 1), e.isoYear === Li ? clampProp(e, "isoMonth", 4, 12, 1) : e.isoYear === Ai && clampProp(e, "isoMonth", 1, 9, 1), 
  e;
}

function checkIsoDateInBounds(e) {
  return checkIsoDateTimeInBounds({
    ...e,
    ...Dt,
    isoHour: 12
  }), e;
}

function checkIsoDateTimeInBounds(e) {
  const n = clampProp(e, "isoYear", Li, Ai, 1), t = n === Li ? 1 : n === Ai ? -1 : 0;
  return t && checkEpochNanoInBounds(isoToEpochNano({
    ...e,
    isoDay: e.isoDay + t,
    isoNanosecond: e.isoNanosecond - t
  })), e;
}

function checkEpochNanoInBounds(e) {
  if (!e || bigNanoOutside(e, Ui, qi)) {
    throw new RangeError(Cr);
  }
  return e;
}

function isoTimeFieldsToNano(e) {
  return givenFieldsToBigNano(e, 5, j)[1];
}

function nanoToIsoTimeAndDay(e) {
  const [n, t] = divModFloor(e, Qr);
  return [ nanoToGivenFields(t, 5, j), n ];
}

function epochNanoToSec(e) {
  return epochNanoToSecMod(e)[0];
}

function epochNanoToSecMod(e) {
  return divModBigNano(e, _r);
}

function isoToEpochMilli(e) {
  return isoArgsToEpochMilli(e.isoYear, e.isoMonth, e.isoDay, e.isoHour, e.isoMinute, e.isoSecond, e.isoMillisecond);
}

function isoToEpochNano(e) {
  const n = isoToEpochMilli(e);
  if (void 0 !== n) {
    const [t, o] = divModTrunc(n, Gr);
    return [ t, o * be + (e.isoMicrosecond || 0) * Vr + (e.isoNanosecond || 0) ];
  }
}

function isoToEpochNanoWithOffset(e, n) {
  const [t, o] = nanoToIsoTimeAndDay(isoTimeFieldsToNano(e) - n);
  return checkEpochNanoInBounds(isoToEpochNano({
    ...e,
    isoDay: e.isoDay + o,
    ...t
  }));
}

function isoArgsToEpochSec(...e) {
  return isoArgsToEpochMilli(...e) / Hr;
}

function isoArgsToEpochMilli(...e) {
  const [n, t] = isoToLegacyDate(...e), o = n.valueOf();
  if (!isNaN(o)) {
    return o - t * Gr;
  }
}

function isoToLegacyDate(e, n = 1, t = 1, o = 0, r = 0, i = 0, a = 0) {
  const s = e === Li ? 1 : e === Ai ? -1 : 0, c = new Date;
  return c.setUTCHours(o, r, i, a), c.setUTCFullYear(e, n - 1, t + s), [ c, s ];
}

function Ie(e, n) {
  let [t, o] = moveBigNano(e, n);
  o < 0 && (o += Qr, t -= 1);
  const [r, i] = divModFloor(o, be), [a, s] = divModFloor(i, Vr);
  return epochMilliToIso(t * Gr + r, a, s);
}

function epochMilliToIso(e, n = 0, t = 0) {
  const o = Math.ceil(Math.max(0, Math.abs(e) - zi) / Gr) * Math.sign(e), r = new Date(e - o * Gr);
  return zipProps(wi, [ r.getUTCFullYear(), r.getUTCMonth() + 1, r.getUTCDate() + o, r.getUTCHours(), r.getUTCMinutes(), r.getUTCSeconds(), r.getUTCMilliseconds(), n, t ]);
}

function computeIsoDateParts(e) {
  return [ e.isoYear, e.isoMonth, e.isoDay ];
}

function computeIsoMonthsInYear() {
  return xi;
}

function computeIsoDaysInMonth(e, n) {
  switch (n) {
   case 2:
    return computeIsoInLeapYear(e) ? 29 : 28;

   case 4:
   case 6:
   case 9:
   case 11:
    return 30;
  }
  return 31;
}

function computeIsoDaysInYear(e) {
  return computeIsoInLeapYear(e) ? 366 : 365;
}

function computeIsoInLeapYear(e) {
  return e % 4 == 0 && (e % 100 != 0 || e % 400 == 0);
}

function computeIsoDayOfWeek(e) {
  const [n, t] = isoToLegacyDate(e.isoYear, e.isoMonth, e.isoDay);
  return modFloor(n.getUTCDay() - t, 7) || 7;
}

function computeGregoryEraParts({isoYear: e}) {
  return e < 1 ? [ "bce", 1 - e ] : [ "ce", e ];
}

function computeJapaneseEraParts(e) {
  const n = isoToEpochMilli(e);
  if (n < $i) {
    return computeGregoryEraParts(e);
  }
  const t = hashIntlFormatParts(La(Ti), n), {era: o, eraYear: r} = parseIntlYear(t, Ti);
  return [ o, r ];
}

function checkIsoDateTimeFields(e) {
  return checkIsoDateFields(e), constrainIsoTimeFields(e, 1), e;
}

function checkIsoDateFields(e) {
  return constrainIsoDateFields(e, 1), e;
}

function isIsoDateFieldsValid(e) {
  return allPropsEqual(Oi, e, constrainIsoDateFields(e));
}

function constrainIsoDateFields(e, n) {
  const {isoYear: t} = e, o = clampProp(e, "isoMonth", 1, computeIsoMonthsInYear(), n);
  return {
    isoYear: t,
    isoMonth: o,
    isoDay: clampProp(e, "isoDay", 1, computeIsoDaysInMonth(t, o), n)
  };
}

function constrainIsoTimeFields(e, n) {
  return zipProps(j, [ clampProp(e, "isoHour", 0, 23, n), clampProp(e, "isoMinute", 0, 59, n), clampProp(e, "isoSecond", 0, 59, n), clampProp(e, "isoMillisecond", 0, 999, n), clampProp(e, "isoMicrosecond", 0, 999, n), clampProp(e, "isoNanosecond", 0, 999, n) ]);
}

function H(e) {
  return void 0 === e ? 0 : ua(de(e));
}

function wn(e, n = 0) {
  e = normalizeOptions(e);
  const t = la(e), o = fa(e, n);
  return [ ua(e), o, t ];
}

function ve(e) {
  return la(normalizeOptions(e));
}

function _t(e) {
  return e = normalizeOptions(e), sa(e, 9, 6, 1);
}

function refineDiffOptions(e, n, t, o = 9, r = 0, i = 4) {
  n = normalizeOptions(n);
  let a = sa(n, o, r), s = parseRoundingIncInteger(n), c = ha(n, i);
  const u = aa(n, o, r, 1);
  return null == a ? a = Math.max(t, u) : checkLargestSmallestUnit(a, u), s = refineRoundingInc(s, u, 1), 
  e && (c = (e => e < 4 ? (e + 2) % 4 : e)(c)), [ a, u, s, c ];
}

function refineRoundingOptions(e, n = 6, t) {
  let o = parseRoundingIncInteger(e = normalizeOptionsOrString(e, Hi));
  const r = ha(e, 7);
  let i = aa(e, n);
  return i = requirePropDefined(Hi, i), o = refineRoundingInc(o, i, void 0, t), [ i, o, r ];
}

function refineDateDisplayOptions(e) {
  return da(normalizeOptions(e));
}

function refineTimeDisplayOptions(e, n) {
  return refineTimeDisplayTuple(normalizeOptions(e), n);
}

function refineTimeDisplayTuple(e, n = 4) {
  const t = refineSubsecDigits(e);
  return [ ha(e, 4), ...refineSmallestUnitAndSubsecDigits(aa(e, n), t) ];
}

function refineSmallestUnitAndSubsecDigits(e, n) {
  return null != e ? [ Xr[e], e < 4 ? 9 - 3 * e : -1 ] : [ void 0 === n ? 1 : 10 ** (9 - n), n ];
}

function parseRoundingIncInteger(e) {
  const n = e[_i];
  return void 0 === n ? 1 : toInteger(n, _i);
}

function refineRoundingInc(e, n, t, o) {
  const r = o ? Qr : Xr[n + 1];
  if (r) {
    const t = Xr[n];
    if (r % ((e = clampEntity(_i, e, 1, r / t - (o ? 0 : 1), 1)) * t)) {
      throw new RangeError(invalidEntity(_i, e));
    }
  } else {
    e = clampEntity(_i, e, 1, t ? 10 ** 9 : 1, 1);
  }
  return e;
}

function refineSubsecDigits(e) {
  let n = e[Ji];
  if (void 0 !== n) {
    if ("number" != typeof n) {
      if ("auto" === toString(n)) {
        return;
      }
      throw new RangeError(invalidEntity(Ji, n));
    }
    n = clampEntity(Ji, Math.floor(n), 0, 9, 1);
  }
  return n;
}

function normalizeOptions(e) {
  return void 0 === e ? {} : de(e);
}

function normalizeOptionsOrString(e, n) {
  return "string" == typeof e ? {
    [n]: e
  } : de(e);
}

function U(e) {
  if (void 0 !== e) {
    if (z(e)) {
      return Object.assign(Object.create(null), e);
    }
    throw new TypeError(hr);
  }
}

function overrideOverflowOptions(e, n) {
  return e && Object.assign(Object.create(null), e, {
    overflow: Xi[n]
  });
}

function refineUnitOption(e, n, t = 9, o = 0, r) {
  let i = n[e];
  if (void 0 === i) {
    return r ? o : void 0;
  }
  if (i = toString(i), "auto" === i) {
    return r ? o : null;
  }
  let a = $r[i];
  if (void 0 === a && (a = Ei[i]), void 0 === a) {
    throw new RangeError(invalidChoice(e, i, $r));
  }
  return clampEntity(e, a, o, t, 1, Et), a;
}

function refineChoiceOption(e, n, t, o = 0) {
  const r = t[e];
  if (void 0 === r) {
    return o;
  }
  const i = toString(r), a = n[i];
  if (void 0 === a) {
    throw new RangeError(invalidChoice(e, i, n));
  }
  return a;
}

function checkLargestSmallestUnit(e, n) {
  if (n > e) {
    throw new RangeError(Ar);
  }
}

function _(e) {
  return {
    branding: Oe,
    epochNanoseconds: e
  };
}

function Yn(e, n, t) {
  return {
    branding: Te,
    calendar: t,
    timeZone: n,
    epochNanoseconds: e
  };
}

function ee(e, n = e.calendar) {
  return {
    branding: We,
    calendar: n,
    ...Vn(Yi, e)
  };
}

function v(e, n = e.calendar) {
  return {
    branding: J,
    calendar: n,
    ...Vn(Bi, e)
  };
}

function createPlainYearMonthSlots(e, n = e.calendar) {
  return {
    branding: L,
    calendar: n,
    ...Vn(Bi, e)
  };
}

function createPlainMonthDaySlots(e, n = e.calendar) {
  return {
    branding: q,
    calendar: n,
    ...Vn(Bi, e)
  };
}

function Ge(e) {
  return {
    branding: xe,
    ...Vn(ki, e)
  };
}

function Vt(e) {
  return {
    branding: qt,
    sign: computeDurationSign(e),
    ...Vn(Ni, e)
  };
}

function M(e) {
  return epochNanoToSec(e.epochNanoseconds);
}

function y(e) {
  return divModBigNano(e.epochNanoseconds, be)[0];
}

function N(e) {
  return bigNanoToBigInt(e.epochNanoseconds, Vr);
}

function B(e) {
  return bigNanoToBigInt(e.epochNanoseconds);
}

function extractEpochNano(e) {
  return e.epochNanoseconds;
}

function I(e) {
  return "string" == typeof e ? e : m(e.id);
}

function isIdLikeEqual(e, n) {
  return e === n || I(e) === I(n);
}

function Ut(e, n, t, o, r) {
  const i = getMaxDurationUnit(o), [a, s] = ((e, n) => {
    const t = n((e = normalizeOptionsOrString(e, Vi))[Ki]);
    let o = ca(e);
    return o = requirePropDefined(Vi, o), [ o, t ];
  })(r, e);
  if (isUniformUnit(Math.max(a, i), s)) {
    return totalDayTimeDuration(o, a);
  }
  if (!s) {
    throw new RangeError(zr);
  }
  const [c, u, l] = createMarkerSystem(n, t, s), f = createMarkerToEpochNano(l), d = createMoveMarker(l), m = createDiffMarkers(l), p = d(u, c, o), h = m(u, c, p, a);
  return isUniformUnit(a, s) ? totalDayTimeDuration(h, a) : ((e, n, t, o, r, i, a) => {
    const s = computeDurationSign(e), [c, u] = clampRelativeDuration(o, bi(t, e), t, s, r, i, a), l = computeEpochNanoFrac(n, c, u);
    return e[F[t]] + l * s;
  })(h, f(p), a, u, c, f, d);
}

function totalDayTimeDuration(e, n) {
  return oe(durationFieldsToBigNano(e), Xr[n], 1);
}

function clampRelativeDuration(e, n, t, o, r, i, a) {
  const s = F[t], c = {
    ...n,
    [s]: n[s] + o
  }, u = a(e, r, n), l = a(e, r, c);
  return [ i(u), i(l) ];
}

function computeEpochNanoFrac(e, n, t) {
  const o = oe(re(n, t));
  if (!o) {
    throw new RangeError(vr);
  }
  return oe(re(n, e)) / o;
}

function ce(e, n) {
  const [t, o, r] = refineRoundingOptions(n, 5, 1);
  return _(roundBigNano(e.epochNanoseconds, t, o, r, 1));
}

function Pn(e, n, t) {
  let {epochNanoseconds: o, timeZone: r, calendar: i} = n;
  const [a, s, c] = refineRoundingOptions(t);
  if (0 === a && 1 === s) {
    return n;
  }
  const u = e(r);
  if (6 === a) {
    o = ((e, n, t, o) => {
      const r = fn(t, n), [i, a] = e(r), s = t.epochNanoseconds, c = we(n, i), u = we(n, a);
      if (bigNanoOutside(s, c, u)) {
        throw new RangeError(vr);
      }
      return roundWithMode(computeEpochNanoFrac(s, c, u), o) ? u : c;
    })(computeDayInterval, u, n, c);
  } else {
    const e = u.getOffsetNanosecondsFor(o);
    o = getMatchingInstantFor(u, roundDateTime(Ie(o, e), a, s, c), e, 2, 0, 1);
  }
  return Yn(o, r, i);
}

function dt(e, n) {
  return ee(roundDateTime(e, ...refineRoundingOptions(n)), e.calendar);
}

function Ee(e, n) {
  const [t, o, r] = refineRoundingOptions(n, 5);
  var i;
  return Ge((i = r, roundTimeToNano(e, computeNanoInc(t, o), i)[0]));
}

function dn(e, n) {
  const t = e(n.timeZone), o = fn(n, t), [r, i] = computeDayInterval(o), a = oe(re(we(t, r), we(t, i)), Kr, 1);
  if (a <= 0) {
    throw new RangeError(vr);
  }
  return a;
}

function Cn(e, n) {
  const {timeZone: t, calendar: o} = n, r = ((e, n, t) => we(n, e(fn(t, n))))(computeDayFloor, e(t), n);
  return Yn(r, t, o);
}

function roundDateTime(e, n, t, o) {
  return roundDateTimeToNano(e, computeNanoInc(n, t), o);
}

function roundDateTimeToNano(e, n, t) {
  const [o, r] = roundTimeToNano(e, n, t);
  return checkIsoDateTimeInBounds({
    ...moveByDays(e, r),
    ...o
  });
}

function roundTimeToNano(e, n, t) {
  return nanoToIsoTimeAndDay(roundByInc(isoTimeFieldsToNano(e), n, t));
}

function roundToMinute(e) {
  return roundByInc(e, Jr, 7);
}

function computeNanoInc(e, n) {
  return Xr[e] * n;
}

function computeDayInterval(e) {
  const n = computeDayFloor(e);
  return [ n, moveByDays(n, 1) ];
}

function computeDayFloor(e) {
  return Ci(6, e);
}

function roundDayTimeDurationByInc(e, n, t) {
  const o = Math.min(getMaxDurationUnit(e), 6);
  return nanoToDurationDayTimeFields(roundBigNanoByInc(durationFieldsToBigNano(e, o), n, t), o);
}

function roundRelativeDuration(e, n, t, o, r, i, a, s, c, u) {
  if (0 === o && 1 === r) {
    return e;
  }
  const l = isUniformUnit(o, s) ? isZonedEpochSlots(s) && o < 6 && t >= 6 ? nudgeZonedTimeDuration : nudgeDayTimeDuration : nudgeRelativeDuration;
  let [f, d, m] = l(e, n, t, o, r, i, a, s, c, u);
  return m && 7 !== o && (f = ((e, n, t, o, r, i, a, s) => {
    const c = computeDurationSign(e);
    for (let u = o + 1; u <= t; u++) {
      if (7 === u && 7 !== t) {
        continue;
      }
      const o = bi(u, e);
      o[F[u]] += c;
      const l = oe(re(a(s(r, i, o)), n));
      if (l && Math.sign(l) !== c) {
        break;
      }
      e = o;
    }
    return e;
  })(f, d, t, Math.max(6, o), a, s, c, u)), f;
}

function roundBigNano(e, n, t, o, r) {
  if (6 === n) {
    const n = (e => e[0] + e[1] / Qr)(e);
    return [ roundByInc(n, t, o), 0 ];
  }
  return roundBigNanoByInc(e, computeNanoInc(n, t), o, r);
}

function roundBigNanoByInc(e, n, t, o) {
  let [r, i] = e;
  o && i < 0 && (i += Qr, r -= 1);
  const [a, s] = divModFloor(roundByInc(i, n, t), Qr);
  return createBigNano(r + a, s);
}

function roundByInc(e, n, t) {
  return roundWithMode(e / n, t) * n;
}

function roundWithMode(e, n) {
  return ga[n](e);
}

function nudgeDayTimeDuration(e, n, t, o, r, i) {
  const a = computeDurationSign(e), s = durationFieldsToBigNano(e), c = roundBigNano(s, o, r, i), u = re(s, c), l = Math.sign(c[0] - s[0]) === a, f = nanoToDurationDayTimeFields(c, Math.min(t, 6));
  return [ {
    ...e,
    ...f
  }, addBigNanos(n, u), l ];
}

function nudgeZonedTimeDuration(e, n, t, o, r, i, a, s, c, u) {
  const l = computeDurationSign(e), f = oe(durationFieldsToBigNano(e, 5)), d = computeNanoInc(o, r);
  let m = roundByInc(f, d, i);
  const [p, h] = clampRelativeDuration(a, {
    ...e,
    ...Fi
  }, 6, l, s, c, u), g = m - oe(re(p, h));
  let T = 0;
  g && Math.sign(g) !== l ? n = moveBigNano(p, m) : (T += l, m = roundByInc(g, d, i), 
  n = moveBigNano(h, m));
  const D = nanoToDurationTimeFields(m);
  return [ {
    ...e,
    ...D,
    days: e.days + T
  }, n, Boolean(T) ];
}

function nudgeRelativeDuration(e, n, t, o, r, i, a, s, c, u) {
  const l = computeDurationSign(e), f = F[o], d = bi(o, e);
  7 === o && (e = {
    ...e,
    weeks: e.weeks + Math.trunc(e.days / 7)
  });
  const m = divTrunc(e[f], r) * r;
  d[f] = m;
  const [p, h] = clampRelativeDuration(a, d, o, r * l, s, c, u), g = m + computeEpochNanoFrac(n, p, h) * l * r, T = roundByInc(g, r, i), D = Math.sign(T - g) === l;
  return d[f] = T, [ d, D ? h : p, D ];
}

function me(e, n, t, o) {
  const [r, i, a, s] = (e => {
    const n = refineTimeDisplayTuple(e = normalizeOptions(e));
    return [ e.timeZone, ...n ];
  })(o), c = void 0 !== r;
  return ((e, n, t, o, r, i) => {
    t = roundBigNanoByInc(t, r, o, 1);
    const a = n.getOffsetNanosecondsFor(t);
    return formatIsoDateTimeFields(Ie(t, a), i) + (e ? Fe(roundToMinute(a)) : "Z");
  })(c, n(c ? e(r) : Ta), t.epochNanoseconds, i, a, s);
}

function In(e, n, t) {
  const [o, r, i, a, s, c] = (e => {
    e = normalizeOptions(e);
    const n = da(e), t = refineSubsecDigits(e), o = pa(e), r = ha(e, 4), i = aa(e, 4);
    return [ n, ma(e), o, r, ...refineSmallestUnitAndSubsecDigits(i, t) ];
  })(t);
  return ((e, n, t, o, r, i, a, s, c, u) => {
    o = roundBigNanoByInc(o, c, s, 1);
    const l = e(t).getOffsetNanosecondsFor(o);
    return formatIsoDateTimeFields(Ie(o, l), u) + Fe(roundToMinute(l), a) + ((e, n) => 1 !== n ? "[" + (2 === n ? "!" : "") + I(e) + "]" : "")(t, i) + formatCalendar(n, r);
  })(e, n.calendar, n.timeZone, n.epochNanoseconds, o, r, i, a, s, c);
}

function Tt(e, n) {
  const [t, o, r, i] = (e => (e = normalizeOptions(e), [ da(e), ...refineTimeDisplayTuple(e) ]))(n);
  return a = e.calendar, s = t, c = i, formatIsoDateTimeFields(roundDateTimeToNano(e, r, o), c) + formatCalendar(a, s);
  var a, s, c;
}

function yt(e, n) {
  return t = e.calendar, o = e, r = refineDateDisplayOptions(n), formatIsoDateFields(o) + formatCalendar(t, r);
  var t, o, r;
}

function et(e, n) {
  return formatDateLikeIso(e.calendar, formatIsoYearMonthFields, e, refineDateDisplayOptions(n));
}

function W(e, n) {
  return formatDateLikeIso(e.calendar, formatIsoMonthDayFields, e, refineDateDisplayOptions(n));
}

function qe(e, n) {
  const [t, o, r] = refineTimeDisplayOptions(n);
  return i = r, formatIsoTimeFields(roundTimeToNano(e, o, t)[0], i);
  var i;
}

function zt(e, n) {
  const [t, o, r] = refineTimeDisplayOptions(n, 3);
  return o > 1 && (e = {
    ...e,
    ...roundDayTimeDurationByInc(e, o, t)
  }), ((e, n) => {
    const {sign: t} = e, o = -1 === t ? negateDurationFields(e) : e, {hours: r, minutes: i} = o, [a, s] = divModBigNano(durationFieldsToBigNano(o, 3), _r, divModTrunc);
    checkDurationTimeUnit(a);
    const c = formatSubsecNano(s, n), u = n >= 0 || !t || c;
    return (t < 0 ? "-" : "") + "P" + formatDurationFragments({
      Y: formatDurationNumber(o.years),
      M: formatDurationNumber(o.months),
      W: formatDurationNumber(o.weeks),
      D: formatDurationNumber(o.days)
    }) + (r || i || a || u ? "T" + formatDurationFragments({
      H: formatDurationNumber(r),
      M: formatDurationNumber(i),
      S: formatDurationNumber(a, u) + c
    }) : "");
  })(e, r);
}

function formatDateLikeIso(e, n, t, o) {
  const r = I(e), i = o > 1 || 0 === o && r !== X;
  return 1 === o ? r === X ? n(t) : formatIsoDateFields(t) : i ? formatIsoDateFields(t) + formatCalendarId(r, 2 === o) : n(t);
}

function formatDurationFragments(e) {
  const n = [];
  for (const t in e) {
    const o = e[t];
    o && n.push(o, t);
  }
  return n.join("");
}

function formatIsoDateTimeFields(e, n) {
  return formatIsoDateFields(e) + "T" + formatIsoTimeFields(e, n);
}

function formatIsoDateFields(e) {
  return formatIsoYearMonthFields(e) + "-" + xr(e.isoDay);
}

function formatIsoYearMonthFields(e) {
  const {isoYear: n} = e;
  return (n < 0 || n > 9999 ? getSignStr(n) + padNumber(6, Math.abs(n)) : padNumber(4, n)) + "-" + xr(e.isoMonth);
}

function formatIsoMonthDayFields(e) {
  return xr(e.isoMonth) + "-" + xr(e.isoDay);
}

function formatIsoTimeFields(e, n) {
  const t = [ xr(e.isoHour), xr(e.isoMinute) ];
  return -1 !== n && t.push(xr(e.isoSecond) + ((e, n, t, o) => formatSubsecNano(e * be + n * Vr + t, o))(e.isoMillisecond, e.isoMicrosecond, e.isoNanosecond, n)), 
  t.join(":");
}

function Fe(e, n = 0) {
  if (1 === n) {
    return "";
  }
  const [t, o] = divModFloor(Math.abs(e), Kr), [r, i] = divModFloor(o, Jr), [a, s] = divModFloor(i, _r);
  return getSignStr(e) + xr(t) + ":" + xr(r) + (a || s ? ":" + xr(a) + formatSubsecNano(s) : "");
}

function formatCalendar(e, n) {
  if (1 !== n) {
    const t = I(e);
    if (n > 1 || 0 === n && t !== X) {
      return formatCalendarId(t, 2 === n);
    }
  }
  return "";
}

function formatCalendarId(e, n) {
  return "[" + (n ? "!" : "") + "u-ca=" + e + "]";
}

function formatSubsecNano(e, n) {
  let t = padNumber(9, e);
  return t = void 0 === n ? t.replace(Na, "") : t.slice(0, n), t ? "." + t : "";
}

function getSignStr(e) {
  return e < 0 ? "-" : "+";
}

function formatDurationNumber(e, n) {
  return e || n ? e.toLocaleString("fullwide", {
    useGrouping: 0
  }) : "";
}

function _zonedEpochSlotsToIso(e, n) {
  const {epochNanoseconds: t} = e, o = (n.getOffsetNanosecondsFor ? n : n(e.timeZone)).getOffsetNanosecondsFor(t), r = Ie(t, o);
  return {
    calendar: e.calendar,
    ...r,
    offsetNanoseconds: o
  };
}

function mn(e, n) {
  const t = fn(n, e);
  return {
    calendar: n.calendar,
    ...Vn(Yi, t),
    offset: Fe(t.offsetNanoseconds),
    timeZone: n.timeZone
  };
}

function getMatchingInstantFor(e, n, t, o = 0, r = 0, i, a) {
  if (void 0 !== t && 1 === o && (1 === o || a)) {
    return isoToEpochNanoWithOffset(n, t);
  }
  const s = e.getPossibleInstantsFor(n);
  if (void 0 !== t && 3 !== o) {
    const e = ((e, n, t, o) => {
      const r = isoToEpochNano(n);
      o && (t = roundToMinute(t));
      for (const n of e) {
        let e = oe(re(n, r));
        if (o && (e = roundToMinute(e)), e === t) {
          return n;
        }
      }
    })(s, n, t, i);
    if (void 0 !== e) {
      return e;
    }
    if (0 === o) {
      throw new RangeError(kr);
    }
  }
  return a ? isoToEpochNano(n) : we(e, n, r, s);
}

function we(e, n, t = 0, o = e.getPossibleInstantsFor(n)) {
  if (1 === o.length) {
    return o[0];
  }
  if (1 === t) {
    throw new RangeError(Yr);
  }
  if (o.length) {
    return o[3 === t ? 1 : 0];
  }
  const r = isoToEpochNano(n), i = ((e, n) => {
    const t = e.getOffsetNanosecondsFor(moveBigNano(n, -Qr));
    return ne(e.getOffsetNanosecondsFor(moveBigNano(n, Qr)) - t);
  })(e, r), a = i * (2 === t ? -1 : 1);
  return (o = e.getPossibleInstantsFor(Ie(r, a)))[2 === t ? 0 : o.length - 1];
}

function ae(e) {
  if (Math.abs(e) >= Qr) {
    throw new RangeError(wr);
  }
  return e;
}

function ne(e) {
  if (e > Qr) {
    throw new RangeError(Br);
  }
  return e;
}

function se(e, n, t) {
  return _(checkEpochNanoInBounds(addBigNanos(n.epochNanoseconds, (e => {
    if (durationHasDateParts(e)) {
      throw new RangeError(qr);
    }
    return durationFieldsToBigNano(e, 5);
  })(e ? negateDurationFields(t) : t))));
}

function hn(e, n, t, o, r, i = Object.create(null)) {
  const a = n(o.timeZone), s = e(o.calendar);
  return {
    ...o,
    ...moveZonedEpochs(a, s, o, t ? negateDurationFields(r) : r, i)
  };
}

function ct(e, n, t, o, r = Object.create(null)) {
  const {calendar: i} = t;
  return ee(moveDateTime(e(i), t, n ? negateDurationFields(o) : o, r), i);
}

function bt(e, n, t, o, r) {
  const {calendar: i} = t;
  return v(moveDate(e(i), t, n ? negateDurationFields(o) : o, r), i);
}

function Qe(e, n, t, o, r = Object.create(null)) {
  const i = t.calendar, a = e(i);
  let s = moveToDayOfMonthUnsafe(a, t);
  n && (o = xt(o)), o.sign < 0 && (s = a.dateAdd(s, {
    ...Si,
    months: 1
  }), s = moveByDays(s, -1));
  const c = a.dateAdd(s, o, r);
  return createPlainYearMonthSlots(moveToDayOfMonthUnsafe(a, c), i);
}

function Ye(e, n, t) {
  return Ge(moveTime(n, e ? negateDurationFields(t) : t)[0]);
}

function moveZonedEpochs(e, n, t, o, r) {
  const i = durationFieldsToBigNano(o, 5);
  let a = t.epochNanoseconds;
  if (durationHasDateParts(o)) {
    const s = fn(t, e);
    a = addBigNanos(we(e, {
      ...moveDate(n, s, {
        ...o,
        ...Fi
      }, r),
      ...Vn(j, s)
    }), i);
  } else {
    a = addBigNanos(a, i), H(r);
  }
  return {
    epochNanoseconds: checkEpochNanoInBounds(a)
  };
}

function moveDateTime(e, n, t, o) {
  const [r, i] = moveTime(n, t);
  return checkIsoDateTimeInBounds({
    ...moveDate(e, n, {
      ...t,
      ...Fi,
      days: t.days + i
    }, o),
    ...r
  });
}

function moveDate(e, n, t, o) {
  if (t.years || t.months || t.weeks) {
    return e.dateAdd(n, t, o);
  }
  H(o);
  const r = t.days + durationFieldsToBigNano(t, 5)[0];
  return r ? checkIsoDateInBounds(moveByDays(n, r)) : n;
}

function moveToDayOfMonthUnsafe(e, n, t = 1) {
  return moveByDays(n, t - e.day(n));
}

function moveTime(e, n) {
  const [t, o] = durationFieldsToBigNano(n, 5), [r, i] = nanoToIsoTimeAndDay(isoTimeFieldsToNano(e) + o);
  return [ r, t + i ];
}

function moveByDays(e, n) {
  return n ? {
    ...e,
    ...epochMilliToIso(isoToEpochMilli(e) + n * Gr)
  } : e;
}

function createMarkerSystem(e, n, t) {
  const o = e(t.calendar);
  return isZonedEpochSlots(t) ? [ t, o, n(t.timeZone) ] : [ {
    ...t,
    ...Dt
  }, o ];
}

function createMarkerToEpochNano(e) {
  return e ? extractEpochNano : isoToEpochNano;
}

function createMoveMarker(e) {
  return e ? E(moveZonedEpochs, e) : moveDateTime;
}

function createDiffMarkers(e) {
  return e ? E(diffZonedEpochsExact, e) : diffDateTimesExact;
}

function isZonedEpochSlots(e) {
  return e && e.epochNanoseconds;
}

function isUniformUnit(e, n) {
  return e <= 6 - (isZonedEpochSlots(n) ? 1 : 0);
}

function Wt(e, n, t, o, r, i, a) {
  const s = e(normalizeOptions(a).relativeTo), c = Math.max(getMaxDurationUnit(r), getMaxDurationUnit(i));
  if (isUniformUnit(c, s)) {
    return Vt(checkDurationUnits(((e, n, t, o) => {
      const r = addBigNanos(durationFieldsToBigNano(e), durationFieldsToBigNano(n), o ? -1 : 1);
      if (!Number.isFinite(r[0])) {
        throw new RangeError(Cr);
      }
      return {
        ...Si,
        ...nanoToDurationDayTimeFields(r, t)
      };
    })(r, i, c, o)));
  }
  if (!s) {
    throw new RangeError(zr);
  }
  o && (i = negateDurationFields(i));
  const [u, l, f] = createMarkerSystem(n, t, s), d = createMoveMarker(f), m = createDiffMarkers(f), p = d(l, u, r);
  return Vt(m(l, u, d(l, p, i), c));
}

function Gt(e, n, t, o, r) {
  const i = getMaxDurationUnit(o), [a, s, c, u, l] = ((e, n, t) => {
    e = normalizeOptionsOrString(e, Hi);
    let o = sa(e);
    const r = t(e[Ki]);
    let i = parseRoundingIncInteger(e);
    const a = ha(e, 7);
    let s = aa(e);
    if (void 0 === o && void 0 === s) {
      throw new RangeError(Ur);
    }
    return null == s && (s = 0), null == o && (o = Math.max(s, n)), checkLargestSmallestUnit(o, s), 
    i = refineRoundingInc(i, s, 1), [ o, s, i, a, r ];
  })(r, i, e), f = Math.max(i, a);
  if (!isZonedEpochSlots(l) && f <= 6) {
    return Vt(checkDurationUnits(((e, n, t, o, r) => {
      const i = roundBigNano(durationFieldsToBigNano(e), t, o, r);
      return {
        ...Si,
        ...nanoToDurationDayTimeFields(i, n)
      };
    })(o, a, s, c, u)));
  }
  if (!l) {
    throw new RangeError(zr);
  }
  const [d, m, p] = createMarkerSystem(n, t, l), h = createMarkerToEpochNano(p), g = createMoveMarker(p), T = createDiffMarkers(p), D = g(m, d, o);
  let I = T(m, d, D, a);
  const M = o.sign, N = computeDurationSign(I);
  if (M && N && M !== N) {
    throw new RangeError(vr);
  }
  return N && (I = roundRelativeDuration(I, h(D), a, s, c, u, m, d, h, g)), Vt(I);
}

function Rt(e) {
  return -1 === e.sign ? xt(e) : e;
}

function xt(e) {
  return Vt(negateDurationFields(e));
}

function negateDurationFields(e) {
  const n = {};
  for (const t of F) {
    n[t] = -1 * e[t] || 0;
  }
  return n;
}

function Jt(e) {
  return !e.sign;
}

function computeDurationSign(e, n = F) {
  let t = 0;
  for (const o of n) {
    const n = Math.sign(e[o]);
    if (n) {
      if (t && t !== n) {
        throw new RangeError(Rr);
      }
      t = n;
    }
  }
  return t;
}

function checkDurationUnits(e) {
  for (const n of vi) {
    clampEntity(n, e[n], -ya, ya, 1);
  }
  return checkDurationTimeUnit(oe(durationFieldsToBigNano(e), _r)), e;
}

function checkDurationTimeUnit(e) {
  if (!Number.isSafeInteger(e)) {
    throw new RangeError(Zr);
  }
}

function durationFieldsToBigNano(e, n = 6) {
  return givenFieldsToBigNano(e, n, F);
}

function nanoToDurationDayTimeFields(e, n = 6) {
  const [t, o] = e, r = nanoToGivenFields(o, n, F);
  if (r[F[n]] += t * (Qr / Xr[n]), !Number.isFinite(r[F[n]])) {
    throw new RangeError(Cr);
  }
  return r;
}

function nanoToDurationTimeFields(e, n = 5) {
  return nanoToGivenFields(e, n, F);
}

function durationHasDateParts(e) {
  return Boolean(computeDurationSign(e, Pi));
}

function getMaxDurationUnit(e) {
  let n = 9;
  for (;n > 0 && !e[F[n]]; n--) {}
  return n;
}

function createSplitTuple(e, n) {
  return [ e, n ];
}

function computePeriod(e) {
  const n = Math.floor(e / Da) * Da;
  return [ n, n + Da ];
}

function pe(e) {
  const n = parseDateTimeLike(e = toStringViaPrimitive(e));
  if (!n) {
    throw new RangeError(failedParse(e));
  }
  let t;
  if (n.m) {
    t = 0;
  } else {
    if (!n.offset) {
      throw new RangeError(failedParse(e));
    }
    t = parseOffsetNano(n.offset);
  }
  return n.timeZone && parseOffsetNanoMaybe(n.timeZone, 1), _(isoToEpochNanoWithOffset(checkIsoDateTimeFields(n), t));
}

function Xt(e) {
  const n = parseDateTimeLike(m(e));
  if (!n) {
    throw new RangeError(failedParse(e));
  }
  if (n.timeZone) {
    return finalizeZonedDateTime(n, n.offset ? parseOffsetNano(n.offset) : void 0);
  }
  if (n.m) {
    throw new RangeError(failedParse(e));
  }
  return finalizeDate(n);
}

function Mn(e, n) {
  const t = parseDateTimeLike(m(e));
  if (!t || !t.timeZone) {
    throw new RangeError(failedParse(e));
  }
  const {offset: o} = t, r = o ? parseOffsetNano(o) : void 0, [, i, a] = wn(n);
  return finalizeZonedDateTime(t, r, i, a);
}

function parseOffsetNano(e) {
  const n = parseOffsetNanoMaybe(e);
  if (void 0 === n) {
    throw new RangeError(failedParse(e));
  }
  return n;
}

function Ct(e) {
  const n = parseDateTimeLike(m(e));
  if (!n || n.m) {
    throw new RangeError(failedParse(e));
  }
  return ee(finalizeDateTime(n));
}

function At(e) {
  const n = parseDateTimeLike(m(e));
  if (!n || n.m) {
    throw new RangeError(failedParse(e));
  }
  return v(n.p ? finalizeDateTime(n) : finalizeDate(n));
}

function ot(e, n) {
  const t = parseYearMonthOnly(m(n));
  if (t) {
    return requireIsoCalendar(t), createPlainYearMonthSlots(checkIsoYearMonthInBounds(checkIsoDateFields(t)));
  }
  const o = At(n);
  return createPlainYearMonthSlots(moveToDayOfMonthUnsafe(e(o.calendar), o));
}

function requireIsoCalendar(e) {
  if (e.calendar !== X) {
    throw new RangeError(invalidSubstring(e.calendar));
  }
}

function Q(e, n) {
  const t = parseMonthDayOnly(m(n));
  if (t) {
    return requireIsoCalendar(t), createPlainMonthDaySlots(checkIsoDateFields(t));
  }
  const o = At(n), {calendar: r} = o, i = e(r), [a, s, c] = i.h(o), [u, l] = i.I(a, s), [f, d] = i.N(u, l, c);
  return createPlainMonthDaySlots(checkIsoDateInBounds(i.P(f, d, c)), r);
}

function ze(e) {
  let n, t = (e => {
    const n = Ca.exec(e);
    return n ? (organizeAnnotationParts(n[10]), organizeTimeParts(n)) : void 0;
  })(m(e));
  if (!t) {
    if (t = parseDateTimeLike(e), !t) {
      throw new RangeError(failedParse(e));
    }
    if (!t.p) {
      throw new RangeError(failedParse(e));
    }
    if (t.m) {
      throw new RangeError(invalidSubstring("Z"));
    }
    requireIsoCalendar(t);
  }
  if ((n = parseYearMonthOnly(e)) && isIsoDateFieldsValid(n)) {
    throw new RangeError(failedParse(e));
  }
  if ((n = parseMonthDayOnly(e)) && isIsoDateFieldsValid(n)) {
    throw new RangeError(failedParse(e));
  }
  return Ge(constrainIsoTimeFields(t, 1));
}

function Kt(e) {
  const n = (e => {
    const n = za.exec(e);
    return n ? (e => {
      function parseUnit(e, r, i) {
        let a = 0, s = 0;
        if (i && ([a, o] = divModFloor(o, Xr[i])), void 0 !== e) {
          if (t) {
            throw new RangeError(invalidSubstring(e));
          }
          s = (e => {
            const n = parseInt(e);
            if (!Number.isFinite(n)) {
              throw new RangeError(invalidSubstring(e));
            }
            return n;
          })(e), n = 1, r && (o = parseSubsecNano(r) * (Xr[i] / _r), t = 1);
        }
        return a + s;
      }
      let n = 0, t = 0, o = 0, r = {
        ...zipProps(F, [ parseUnit(e[2]), parseUnit(e[3]), parseUnit(e[4]), parseUnit(e[5]), parseUnit(e[6], e[7], 5), parseUnit(e[8], e[9], 4), parseUnit(e[10], e[11], 3) ]),
        ...nanoToGivenFields(o, 2, F)
      };
      if (!n) {
        throw new RangeError(noValidFields(F));
      }
      return parseSign(e[1]) < 0 && (r = negateDurationFields(r)), r;
    })(n) : void 0;
  })(m(e));
  if (!n) {
    throw new RangeError(failedParse(e));
  }
  return Vt(checkDurationUnits(n));
}

function sn(e) {
  const n = parseDateTimeLike(e) || parseYearMonthOnly(e) || parseMonthDayOnly(e);
  return n ? n.calendar : e;
}

function Ne(e) {
  const n = parseDateTimeLike(e);
  return n && (n.timeZone || n.m && Ta || n.offset) || e;
}

function finalizeZonedDateTime(e, n, t = 0, o = 0) {
  const r = ye(e.timeZone), i = ie(r);
  return Yn(getMatchingInstantFor(i, checkIsoDateTimeFields(e), n, t, o, !i.v, e.m), r, an(e.calendar));
}

function finalizeDateTime(e) {
  return resolveSlotsCalendar(checkIsoDateTimeInBounds(checkIsoDateTimeFields(e)));
}

function finalizeDate(e) {
  return resolveSlotsCalendar(checkIsoDateInBounds(checkIsoDateFields(e)));
}

function resolveSlotsCalendar(e) {
  return {
    ...e,
    calendar: an(e.calendar)
  };
}

function parseDateTimeLike(e) {
  const n = Ya.exec(e);
  return n ? (e => {
    const n = e[10], t = "Z" === (n || "").toUpperCase();
    return {
      isoYear: organizeIsoYearParts(e),
      isoMonth: parseInt(e[4]),
      isoDay: parseInt(e[5]),
      ...organizeTimeParts(e.slice(5)),
      ...organizeAnnotationParts(e[16]),
      p: Boolean(e[6]),
      m: t,
      offset: t ? void 0 : n
    };
  })(n) : void 0;
}

function parseYearMonthOnly(e) {
  const n = Ba.exec(e);
  return n ? (e => ({
    isoYear: organizeIsoYearParts(e),
    isoMonth: parseInt(e[4]),
    isoDay: 1,
    ...organizeAnnotationParts(e[5])
  }))(n) : void 0;
}

function parseMonthDayOnly(e) {
  const n = ka.exec(e);
  return n ? (e => ({
    isoYear: ji,
    isoMonth: parseInt(e[1]),
    isoDay: parseInt(e[2]),
    ...organizeAnnotationParts(e[3])
  }))(n) : void 0;
}

function parseOffsetNanoMaybe(e, n) {
  const t = Za.exec(e);
  return t ? ((e, n) => {
    const t = e[4] || e[5];
    if (n && t) {
      throw new RangeError(invalidSubstring(t));
    }
    return ae((parseInt0(e[2]) * Kr + parseInt0(e[3]) * Jr + parseInt0(e[4]) * _r + parseSubsecNano(e[5] || "")) * parseSign(e[1]));
  })(t, n) : void 0;
}

function organizeIsoYearParts(e) {
  const n = parseSign(e[1]), t = parseInt(e[2] || e[3]);
  if (n < 0 && !t) {
    throw new RangeError(invalidSubstring(-0));
  }
  return n * t;
}

function organizeTimeParts(e) {
  const n = parseInt0(e[3]);
  return {
    ...nanoToIsoTimeAndDay(parseSubsecNano(e[4] || ""))[0],
    isoHour: parseInt0(e[1]),
    isoMinute: parseInt0(e[2]),
    isoSecond: 60 === n ? 59 : n
  };
}

function organizeAnnotationParts(e) {
  let n, t;
  const o = [];
  if (e.replace(Ra, ((e, r, i) => {
    const a = Boolean(r), [s, c] = i.split("=").reverse();
    if (c) {
      if ("u-ca" === c) {
        o.push(s), n || (n = a);
      } else if (a || /[A-Z]/.test(c)) {
        throw new RangeError(invalidSubstring(e));
      }
    } else {
      if (t) {
        throw new RangeError(invalidSubstring(e));
      }
      t = s;
    }
    return "";
  })), o.length > 1 && n) {
    throw new RangeError(invalidSubstring(e));
  }
  return {
    timeZone: t,
    calendar: o[0] || X
  };
}

function parseSubsecNano(e) {
  return parseInt(e.padEnd(9, "0"));
}

function createRegExp(e) {
  return new RegExp(`^${e}$`, "i");
}

function parseSign(e) {
  return e && "+" !== e ? -1 : 1;
}

function parseInt0(e) {
  return void 0 === e ? 0 : parseInt(e);
}

function Me(e) {
  return ye(m(e));
}

function ye(e) {
  const n = getTimeZoneEssence(e);
  return "number" == typeof n ? Fe(n) : n ? (e => {
    if (Ua.test(e)) {
      throw new RangeError(br);
    }
    return e.toLowerCase().split("/").map(((e, n) => (e.length <= 3 || /\d/.test(e)) && !/etc|yap/.test(e) ? e.toUpperCase() : e.replace(/baja|dumont|[a-z]+/g, ((e, t) => e.length <= 2 && !n || "in" === e || "chat" === e ? e.toUpperCase() : e.length > 2 || !t ? capitalize(e).replace(/island|noronha|murdo|rivadavia|urville/, capitalize) : e)))).join("/");
  })(e) : Ta;
}

function getTimeZoneAtomic(e) {
  const n = getTimeZoneEssence(e);
  return "number" == typeof n ? n : n ? n.resolvedOptions().timeZone : Ta;
}

function getTimeZoneEssence(e) {
  const n = parseOffsetNanoMaybe(e = e.toUpperCase(), 1);
  return void 0 !== n ? n : e !== Ta ? qa(e) : void 0;
}

function Ze(e, n) {
  return te(e.epochNanoseconds, n.epochNanoseconds);
}

function yn(e, n) {
  return te(e.epochNanoseconds, n.epochNanoseconds);
}

function $t(e, n, t, o, r, i) {
  const a = e(normalizeOptions(i).relativeTo), s = Math.max(getMaxDurationUnit(o), getMaxDurationUnit(r));
  if (allPropsEqual(F, o, r)) {
    return 0;
  }
  if (isUniformUnit(s, a)) {
    return te(durationFieldsToBigNano(o), durationFieldsToBigNano(r));
  }
  if (!a) {
    throw new RangeError(zr);
  }
  const [c, u, l] = createMarkerSystem(n, t, a), f = createMarkerToEpochNano(l), d = createMoveMarker(l);
  return te(f(d(u, c, o)), f(d(u, c, r)));
}

function gt(e, n) {
  return rt(e, n) || He(e, n);
}

function rt(e, n) {
  return compareNumbers(isoToEpochMilli(e), isoToEpochMilli(n));
}

function He(e, n) {
  return compareNumbers(isoTimeFieldsToNano(e), isoTimeFieldsToNano(n));
}

function ue(e, n) {
  return !Ze(e, n);
}

function gn(e, n) {
  return !yn(e, n) && !!je(e.timeZone, n.timeZone) && isIdLikeEqual(e.calendar, n.calendar);
}

function ft(e, n) {
  return !gt(e, n) && isIdLikeEqual(e.calendar, n.calendar);
}

function It(e, n) {
  return !rt(e, n) && isIdLikeEqual(e.calendar, n.calendar);
}

function $e(e, n) {
  return !rt(e, n) && isIdLikeEqual(e.calendar, n.calendar);
}

function x(e, n) {
  return !rt(e, n) && isIdLikeEqual(e.calendar, n.calendar);
}

function Ve(e, n) {
  return !He(e, n);
}

function je(e, n) {
  if (e === n) {
    return 1;
  }
  const t = I(e), o = I(n);
  if (t === o) {
    return 1;
  }
  try {
    return getTimeZoneAtomic(t) === getTimeZoneAtomic(o);
  } catch (e) {}
}

function le(e, n, t, o) {
  const r = refineDiffOptions(e, U(o), 3, 5), i = diffEpochNanos(n.epochNanoseconds, t.epochNanoseconds, ...r);
  return Vt(e ? negateDurationFields(i) : i);
}

function Dn(e, n, t, o, r, i) {
  const a = getCommonCalendarSlot(o.calendar, r.calendar), s = U(i), [c, u, l, f] = refineDiffOptions(t, s, 5), d = o.epochNanoseconds, m = r.epochNanoseconds, p = te(m, d);
  let h;
  if (p) {
    if (c < 6) {
      h = diffEpochNanos(d, m, c, u, l, f);
    } else {
      const t = n(((e, n) => {
        if (!je(e, n)) {
          throw new RangeError(Fr);
        }
        return e;
      })(o.timeZone, r.timeZone)), i = e(a);
      h = diffZonedEpochsBig(i, t, o, r, p, c, s), h = roundRelativeDuration(h, m, c, u, l, f, i, o, extractEpochNano, E(moveZonedEpochs, t));
    }
  } else {
    h = Si;
  }
  return Vt(t ? negateDurationFields(h) : h);
}

function ut(e, n, t, o, r) {
  const i = getCommonCalendarSlot(t.calendar, o.calendar), a = U(r), [s, c, u, l] = refineDiffOptions(n, a, 6), f = isoToEpochNano(t), d = isoToEpochNano(o), m = te(d, f);
  let p;
  if (m) {
    if (s <= 6) {
      p = diffEpochNanos(f, d, s, c, u, l);
    } else {
      const n = e(i);
      p = diffDateTimesBig(n, t, o, m, s, a), p = roundRelativeDuration(p, d, s, c, u, l, n, t, isoToEpochNano, moveDateTime);
    }
  } else {
    p = Si;
  }
  return Vt(n ? negateDurationFields(p) : p);
}

function Ft(e, n, t, o, r) {
  const i = getCommonCalendarSlot(t.calendar, o.calendar), a = U(r);
  return diffDateLike(n, (() => e(i)), t, o, ...refineDiffOptions(n, a, 6, 9, 6), a);
}

function Xe(e, n, t, o, r) {
  const i = getCommonCalendarSlot(t.calendar, o.calendar), a = U(r), s = refineDiffOptions(n, a, 9, 9, 8), c = e(i);
  return diffDateLike(n, (() => c), moveToDayOfMonthUnsafe(c, t), moveToDayOfMonthUnsafe(c, o), ...s, a);
}

function diffDateLike(e, n, t, o, r, i, a, s, c) {
  const u = isoToEpochNano(t), l = isoToEpochNano(o);
  let f;
  if (te(l, u)) {
    if (6 === r) {
      f = diffEpochNanos(u, l, r, i, a, s);
    } else {
      const e = n();
      f = e.dateUntil(t, o, r, c), 6 === i && 1 === a || (f = roundRelativeDuration(f, l, r, i, a, s, e, t, isoToEpochNano, moveDate));
    }
  } else {
    f = Si;
  }
  return Vt(e ? negateDurationFields(f) : f);
}

function Ae(e, n, t, o) {
  const r = U(o), [i, a, s, c] = refineDiffOptions(e, r, 5, 5), u = roundByInc(diffTimes(n, t), computeNanoInc(a, s), c), l = {
    ...Si,
    ...nanoToDurationTimeFields(u, i)
  };
  return Vt(e ? negateDurationFields(l) : l);
}

function diffZonedEpochsExact(e, n, t, o, r, i) {
  const a = te(o.epochNanoseconds, t.epochNanoseconds);
  return a ? r < 6 ? diffEpochNanosExact(t.epochNanoseconds, o.epochNanoseconds, r) : diffZonedEpochsBig(n, e, t, o, a, r, i) : Si;
}

function diffDateTimesExact(e, n, t, o, r) {
  const i = isoToEpochNano(n), a = isoToEpochNano(t), s = te(a, i);
  return s ? o <= 6 ? diffEpochNanosExact(i, a, o) : diffDateTimesBig(e, n, t, s, o, r) : Si;
}

function diffZonedEpochsBig(e, n, t, o, r, i, a) {
  const [s, c, u] = ((e, n, t, o) => {
    function updateMid() {
      return l = {
        ...moveByDays(a, c++ * -o),
        ...i
      }, f = we(e, l), te(s, f) === -o;
    }
    const r = fn(n, e), i = Vn(j, r), a = fn(t, e), s = t.epochNanoseconds;
    let c = 0;
    const u = diffTimes(r, a);
    let l, f;
    if (Math.sign(u) === -o && c++, updateMid() && (-1 === o || updateMid())) {
      throw new RangeError(vr);
    }
    const d = oe(re(f, s));
    return [ r, l, d ];
  })(n, t, o, r);
  var l, f;
  return {
    ...6 === i ? (l = s, f = c, {
      ...Si,
      days: diffDays(l, f)
    }) : e.dateUntil(s, c, i, a),
    ...nanoToDurationTimeFields(u)
  };
}

function diffDateTimesBig(e, n, t, o, r, i) {
  const [a, s, c] = ((e, n, t) => {
    let o = n, r = diffTimes(e, n);
    return Math.sign(r) === -t && (o = moveByDays(n, -t), r += Qr * t), [ e, o, r ];
  })(n, t, o);
  return {
    ...e.dateUntil(a, s, r, i),
    ...nanoToDurationTimeFields(c)
  };
}

function diffEpochNanos(e, n, t, o, r, i) {
  return {
    ...Si,
    ...nanoToDurationDayTimeFields(roundBigNano(re(e, n), o, r, i), t)
  };
}

function diffEpochNanosExact(e, n, t) {
  return {
    ...Si,
    ...nanoToDurationDayTimeFields(re(e, n), t)
  };
}

function diffDays(e, n) {
  return diffEpochMilliByDay(isoToEpochMilli(e), isoToEpochMilli(n));
}

function diffEpochMilliByDay(e, n) {
  return Math.trunc((n - e) / Gr);
}

function diffTimes(e, n) {
  return isoTimeFieldsToNano(n) - isoTimeFieldsToNano(e);
}

function getCommonCalendarSlot(e, n) {
  if (!isIdLikeEqual(e, n)) {
    throw new RangeError(Er);
  }
  return e;
}

function createIntlCalendar(e) {
  function epochMilliToIntlFields(e) {
    return ((e, n) => ({
      ...parseIntlYear(e, n),
      F: e.month,
      day: parseInt(e.day)
    }))(hashIntlFormatParts(n, e), t);
  }
  const n = La(e), t = computeCalendarIdBase(e);
  return {
    id: e,
    O: createIntlFieldCache(epochMilliToIntlFields),
    B: createIntlYearDataCache(epochMilliToIntlFields)
  };
}

function createIntlFieldCache(e) {
  return Jn((n => {
    const t = isoToEpochMilli(n);
    return e(t);
  }), WeakMap);
}

function createIntlYearDataCache(e) {
  const n = e(0).year - Wi;
  return Jn((t => {
    let o, r = isoArgsToEpochMilli(t - n);
    const i = [], a = [];
    do {
      r += 400 * Gr;
    } while ((o = e(r)).year <= t);
    do {
      r += (1 - o.day) * Gr, o.year === t && (i.push(r), a.push(o.F)), r -= Gr;
    } while ((o = e(r)).year >= t);
    return {
      k: i.reverse(),
      C: Wr(a.reverse())
    };
  }));
}

function parseIntlYear(e, n) {
  let t, o, r = parseIntlPartsYear(e);
  if (e.era) {
    const i = Di[n];
    void 0 !== i && (t = "islamic" === n ? "ah" : e.era.normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, ""), 
    "bc" === t || "b" === t ? t = "bce" : "ad" !== t && "a" !== t || (t = "ce"), o = r, 
    r = eraYearToYear(o, i[t] || 0));
  }
  return {
    era: t,
    eraYear: o,
    year: r
  };
}

function parseIntlPartsYear(e) {
  return parseInt(e.relatedYear || e.year);
}

function computeIntlDateParts(e) {
  const {year: n, F: t, day: o} = this.O(e), {C: r} = this.B(n);
  return [ n, r[t] + 1, o ];
}

function computeIntlEpochMilli(e, n = 1, t = 1) {
  return this.B(e).k[n - 1] + (t - 1) * Gr;
}

function computeIntlLeapMonth(e) {
  const n = queryMonthStrings(this, e), t = queryMonthStrings(this, e - 1), o = n.length;
  if (o > t.length) {
    const e = getCalendarLeapMonthMeta(this);
    if (e < 0) {
      return -e;
    }
    for (let e = 0; e < o; e++) {
      if (n[e] !== t[e]) {
        return e + 1;
      }
    }
  }
}

function computeIntlDaysInYear(e) {
  return diffEpochMilliByDay(computeIntlEpochMilli.call(this, e), computeIntlEpochMilli.call(this, e + 1));
}

function computeIntlDaysInMonth(e, n) {
  const {k: t} = this.B(e);
  let o = n + 1, r = t;
  return o > t.length && (o = 1, r = this.B(e + 1).k), diffEpochMilliByDay(t[n - 1], r[o - 1]);
}

function computeIntlMonthsInYear(e) {
  return this.B(e).k.length;
}

function queryMonthStrings(e, n) {
  return Object.keys(e.B(n).C);
}

function rn(e) {
  return an(m(e));
}

function an(e) {
  if ((e = e.toLowerCase()) !== X && e !== gi && computeCalendarIdBase(e) !== computeCalendarIdBase(La(e).resolvedOptions().calendar)) {
    throw new RangeError(invalidCalendar(e));
  }
  return e;
}

function computeCalendarIdBase(e) {
  return "islamicc" === e && (e = "islamic"), e.split("-")[0];
}

function computeNativeWeekOfYear(e) {
  return this.R(e)[0];
}

function computeNativeYearOfWeek(e) {
  return this.R(e)[1];
}

function computeNativeDayOfYear(e) {
  const [n] = this.h(e);
  return diffEpochMilliByDay(this.q(n), isoToEpochMilli(e)) + 1;
}

function parseMonthCode(e) {
  const n = Wa.exec(e);
  if (!n) {
    throw new RangeError(invalidMonthCode(e));
  }
  return [ parseInt(n[1]), Boolean(n[2]) ];
}

function monthCodeNumberToMonth(e, n, t) {
  return e + (n || t && e >= t ? 1 : 0);
}

function monthToMonthCodeNumber(e, n) {
  return e - (n && e >= n ? 1 : 0);
}

function eraYearToYear(e, n) {
  return (n + e) * (Math.sign(n) || 1) || 0;
}

function getCalendarEraOrigins(e) {
  return Di[getCalendarIdBase(e)];
}

function getCalendarLeapMonthMeta(e) {
  return Ii[getCalendarIdBase(e)];
}

function getCalendarIdBase(e) {
  return computeCalendarIdBase(e.id || X);
}

function Qt(e, n, t, o) {
  const r = refineCalendarFields(t, o, en, [], ri);
  if (void 0 !== r.timeZone) {
    const o = t.dateFromFields(r), i = refineTimeBag(r), a = e(r.timeZone);
    return {
      epochNanoseconds: getMatchingInstantFor(n(a), {
        ...o,
        ...i
      }, void 0 !== r.offset ? parseOffsetNano(r.offset) : void 0),
      timeZone: a
    };
  }
  return {
    ...t.dateFromFields(r),
    ...Dt
  };
}

function jn(e, n, t, o, r, i) {
  const a = refineCalendarFields(t, r, en, ti, ri), s = e(a.timeZone), [c, u, l] = wn(i), f = t.dateFromFields(a, overrideOverflowOptions(i, c)), d = refineTimeBag(a, c);
  return Yn(getMatchingInstantFor(n(s), {
    ...f,
    ...d
  }, void 0 !== a.offset ? parseOffsetNano(a.offset) : void 0, u, l), s, o);
}

function Pt(e, n, t) {
  const o = refineCalendarFields(e, n, en, [], w), r = H(t);
  return ee(checkIsoDateTimeInBounds({
    ...e.dateFromFields(o, overrideOverflowOptions(t, r)),
    ...refineTimeBag(o, r)
  }));
}

function Yt(e, n, t, o = []) {
  const r = refineCalendarFields(e, n, en, o);
  return e.dateFromFields(r, t);
}

function nt(e, n, t, o) {
  const r = refineCalendarFields(e, n, fi, o);
  return e.yearMonthFromFields(r, t);
}

function K(e, n, t, o, r = []) {
  const i = refineCalendarFields(e, t, en, r);
  return n && void 0 !== i.month && void 0 === i.monthCode && void 0 === i.year && (i.year = ji), 
  e.monthDayFromFields(i, o);
}

function Ue(e, n) {
  const t = H(n);
  return Ge(refineTimeBag(refineFields(e, ei, [], 1), t));
}

function Ht(e) {
  const n = refineFields(e, Ni);
  return Vt(checkDurationUnits({
    ...Si,
    ...n
  }));
}

function refineCalendarFields(e, n, t, o = [], r = []) {
  return refineFields(n, [ ...e.fields(t), ...r ].sort(), o);
}

function refineFields(e, n, t, o = !t) {
  const r = {};
  let i, a = 0;
  for (const o of n) {
    if (o === i) {
      throw new RangeError(duplicateFields(o));
    }
    if ("constructor" === o || "__proto__" === o) {
      throw new RangeError(tn(o));
    }
    let n = e[o];
    if (void 0 !== n) {
      a = 1, Ga[o] && (n = Ga[o](n, o)), r[o] = n;
    } else if (t) {
      if (t.includes(o)) {
        throw new TypeError(missingField(o));
      }
      r[o] = hi[o];
    }
    i = o;
  }
  if (o && !a) {
    throw new TypeError(noValidFields(n));
  }
  return r;
}

function refineTimeBag(e, n) {
  return constrainIsoTimeFields(Ha({
    ...hi,
    ...e
  }), n);
}

function Sn(e, n, t, o, r, i) {
  const a = U(i), {calendar: s, timeZone: c} = t;
  return Yn(((e, n, t, o, r) => {
    const i = mergeCalendarFields(e, t, o, en, oi, ni), [a, s, c] = wn(r, 2);
    return getMatchingInstantFor(n, {
      ...e.dateFromFields(i, overrideOverflowOptions(r, a)),
      ...refineTimeBag(i, a)
    }, parseOffsetNano(i.offset), s, c);
  })(e(s), n(c), o, r, a), c, s);
}

function at(e, n, t, o, r) {
  const i = U(r);
  return ee(((e, n, t, o) => {
    const r = mergeCalendarFields(e, n, t, en, w), i = H(o);
    return checkIsoDateTimeInBounds({
      ...e.dateFromFields(r, overrideOverflowOptions(o, i)),
      ...refineTimeBag(r, i)
    });
  })(e(n.calendar), t, o, i));
}

function Zt(e, n, t, o, r) {
  const i = U(r);
  return ((e, n, t, o) => {
    const r = mergeCalendarFields(e, n, t, en);
    return e.dateFromFields(r, o);
  })(e(n.calendar), t, o, i);
}

function Ke(e, n, t, o, r) {
  const i = U(r);
  return createPlainYearMonthSlots(((e, n, t, o) => {
    const r = mergeCalendarFields(e, n, t, fi);
    return e.yearMonthFromFields(r, o);
  })(e(n.calendar), t, o, i));
}

function k(e, n, t, o, r) {
  const i = U(r);
  return ((e, n, t, o) => {
    const r = mergeCalendarFields(e, n, t, en);
    return e.monthDayFromFields(r, o);
  })(e(n.calendar), t, o, i);
}

function Be(e, n, t) {
  return Ge(((e, n, t) => {
    const o = H(t);
    return refineTimeBag({
      ...Vn(ei, e),
      ...refineFields(n, ei)
    }, o);
  })(e, n, t));
}

function kt(e, n) {
  return Vt((t = e, o = n, checkDurationUnits({
    ...t,
    ...refineFields(o, Ni)
  })));
  var t, o;
}

function mergeCalendarFields(e, n, t, o, r = [], i = []) {
  const a = [ ...e.fields(o), ...r ].sort();
  let s = refineFields(n, a, i);
  const c = refineFields(t, a);
  return s = e.mergeFields(s, c), refineFields(s, a, []);
}

function convertToPlainMonthDay(e, n) {
  const t = refineCalendarFields(e, n, pi);
  return e.monthDayFromFields(t);
}

function convertToPlainYearMonth(e, n, t) {
  const o = refineCalendarFields(e, n, di);
  return e.yearMonthFromFields(o, t);
}

function convertToIso(e, n, t, o, r) {
  n = Vn(t = e.fields(t), n), o = refineFields(o, r = e.fields(r), []);
  let i = e.mergeFields(n, o);
  return i = refineFields(i, [ ...t, ...r ].sort(), []), e.dateFromFields(i);
}

function refineYear(e, n) {
  let {era: t, eraYear: o, year: r} = n;
  const i = getCalendarEraOrigins(e);
  if (void 0 !== t || void 0 !== o) {
    if (void 0 === t || void 0 === o) {
      throw new TypeError(Dr);
    }
    if (!i) {
      throw new RangeError(gr);
    }
    const e = i[t];
    if (void 0 === e) {
      throw new RangeError(invalidEra(t));
    }
    const n = eraYearToYear(o, e);
    if (void 0 !== r && r !== n) {
      throw new RangeError(Ir);
    }
    r = n;
  } else if (void 0 === r) {
    throw new TypeError(missingYear(i));
  }
  return r;
}

function refineMonth(e, n, t, o) {
  let {month: r, monthCode: i} = n;
  if (void 0 !== i) {
    const n = ((e, n, t, o) => {
      const r = e.U(t), [i, a] = parseMonthCode(n);
      let s = monthCodeNumberToMonth(i, a, r);
      if (a) {
        const n = getCalendarLeapMonthMeta(e);
        if (void 0 === n) {
          throw new RangeError(Pr);
        }
        if (n > 0) {
          if (s > n) {
            throw new RangeError(Pr);
          }
          if (void 0 === r) {
            if (1 === o) {
              throw new RangeError(Pr);
            }
            s--;
          }
        } else {
          if (s !== -n) {
            throw new RangeError(Pr);
          }
          if (void 0 === r && 1 === o) {
            throw new RangeError(Pr);
          }
        }
      }
      return s;
    })(e, i, t, o);
    if (void 0 !== r && r !== n) {
      throw new RangeError(Mr);
    }
    r = n, o = 1;
  } else if (void 0 === r) {
    throw new TypeError(Nr);
  }
  return clampEntity("month", r, 1, e.L(t), o);
}

function refineDay(e, n, t, o, r) {
  return clampProp(n, "day", 1, e.j(o, t), r);
}

function spliceFields(e, n, t, o) {
  let r = 0;
  const i = [];
  for (const e of t) {
    void 0 !== n[e] ? r = 1 : i.push(e);
  }
  if (Object.assign(e, n), r) {
    for (const n of o || i) {
      delete e[n];
    }
  }
}

function Se(e) {
  return _(checkEpochNanoInBounds(bigIntToBigNano(toBigInt(e))));
}

function vn(e, n, t, o, r = X) {
  return Yn(checkEpochNanoInBounds(bigIntToBigNano(toBigInt(t))), n(o), e(r));
}

function pt(e, n, t, o, r = 0, i = 0, a = 0, s = 0, c = 0, u = 0, l = X) {
  return ee(checkIsoDateTimeInBounds(checkIsoDateTimeFields(T(toInteger, zipProps(wi, [ n, t, o, r, i, a, s, c, u ])))), e(l));
}

function Nt(e, n, t, o, r = X) {
  return v(checkIsoDateInBounds(checkIsoDateFields(T(toInteger, {
    isoYear: n,
    isoMonth: t,
    isoDay: o
  }))), e(r));
}

function tt(e, n, t, o = X, r = 1) {
  const i = toInteger(n), a = toInteger(t), s = e(o);
  return createPlainYearMonthSlots(checkIsoYearMonthInBounds(checkIsoDateFields({
    isoYear: i,
    isoMonth: a,
    isoDay: toInteger(r)
  })), s);
}

function G(e, n, t, o = X, r = ji) {
  const i = toInteger(n), a = toInteger(t), s = e(o);
  return createPlainMonthDaySlots(checkIsoDateInBounds(checkIsoDateFields({
    isoYear: toInteger(r),
    isoMonth: i,
    isoDay: a
  })), s);
}

function ke(e = 0, n = 0, t = 0, o = 0, r = 0, i = 0) {
  return Ge(constrainIsoTimeFields(T(toInteger, zipProps(j, [ e, n, t, o, r, i ])), 1));
}

function Lt(e = 0, n = 0, t = 0, o = 0, r = 0, i = 0, a = 0, s = 0, c = 0, u = 0) {
  return Vt(checkDurationUnits(T(toStrictInteger, zipProps(F, [ e, n, t, o, r, i, a, s, c, u ]))));
}

function fe(e, n, t = X) {
  return Yn(e.epochNanoseconds, n, t);
}

function Zn(e) {
  return _(e.epochNanoseconds);
}

function ht(e, n) {
  return ee(fn(n, e));
}

function Bt(e, n) {
  return v(fn(n, e));
}

function bn(e, n, t) {
  return convertToPlainYearMonth(e(n.calendar), t);
}

function Fn(e, n, t) {
  return convertToPlainMonthDay(e(n.calendar), t);
}

function Re(e, n) {
  return Ge(fn(n, e));
}

function mt(e, n, t, o) {
  const r = ((e, n, t, o) => {
    const r = ve(o);
    return we(e(n), t, r);
  })(e, t, n, o);
  return Yn(checkEpochNanoInBounds(r), t, n.calendar);
}

function St(e, n, t) {
  const o = e(n.calendar);
  return createPlainYearMonthSlots({
    ...n,
    ...convertToPlainYearMonth(o, t)
  });
}

function Ot(e, n, t) {
  return convertToPlainMonthDay(e(n.calendar), t);
}

function vt(e, n, t, o, r) {
  const i = e(r.timeZone), a = r.plainTime, s = void 0 !== a ? n(a) : Dt;
  return Yn(we(t(i), {
    ...o,
    ...s
  }), i, o.calendar);
}

function wt(e, n = Dt) {
  return ee(checkIsoDateTimeInBounds({
    ...e,
    ...n
  }));
}

function jt(e, n, t) {
  return convertToPlainYearMonth(e(n.calendar), t);
}

function Mt(e, n, t) {
  return convertToPlainMonthDay(e(n.calendar), t);
}

function _e(e, n, t, o) {
  return ((e, n, t) => convertToIso(e, n, di, de(t), li))(e(n.calendar), t, o);
}

function R(e, n, t, o) {
  return ((e, n, t) => convertToIso(e, n, pi, de(t), si))(e(n.calendar), t, o);
}

function Je(e, n, t, o, r) {
  const i = de(r), a = n(i.plainDate), s = e(i.timeZone);
  return Yn(we(t(s), {
    ...a,
    ...o
  }), s, a.calendar);
}

function Le(e, n) {
  return ee(checkIsoDateTimeInBounds({
    ...e,
    ...n
  }));
}

function De(e) {
  return _(checkEpochNanoInBounds(he(e, _r)));
}

function Pe(e) {
  return _(checkEpochNanoInBounds(he(e, be)));
}

function Ce(e) {
  return _(checkEpochNanoInBounds(bigIntToBigNano(toBigInt(e), Vr)));
}

function ge(e) {
  return _(checkEpochNanoInBounds(bigIntToBigNano(toBigInt(e))));
}

function pn(e, n, t = Dt) {
  const o = n.timeZone, r = e(o), i = {
    ...fn(n, r),
    ...t
  };
  return Yn(getMatchingInstantFor(r, i, i.offsetNanoseconds, 2), o, n.calendar);
}

function Tn(e, n, t) {
  const o = n.timeZone, r = e(o), i = {
    ...fn(n, r),
    ...t
  }, a = getPreferredCalendarSlot(n.calendar, t.calendar);
  return Yn(getMatchingInstantFor(r, i, i.offsetNanoseconds, 2), o, a);
}

function lt(e, n = Dt) {
  return ee({
    ...e,
    ...n
  });
}

function st(e, n) {
  return ee({
    ...e,
    ...n
  }, getPreferredCalendarSlot(e.calendar, n.calendar));
}

function it(e, n) {
  return {
    ...e,
    calendar: n
  };
}

function On(e, n) {
  return {
    ...e,
    timeZone: n
  };
}

function getPreferredCalendarSlot(e, n) {
  if (e === n) {
    return e;
  }
  const t = I(e), o = I(n);
  if (t === o || t === X) {
    return n;
  }
  if (o === X) {
    return e;
  }
  throw new RangeError(Er);
}

function createNativeOpsCreator(e, n) {
  return t => t === X ? e : t === gi || t === Ti ? Object.assign(Object.create(e), {
    id: t
  }) : Object.assign(Object.create(n), Aa(t));
}

function createOptionsTransformer(e, n, t) {
  const o = new Set(t);
  return r => (((e, n) => {
    for (const t of n) {
      if (t in e) {
        return 1;
      }
    }
    return 0;
  })(r = V(o, r), e) || Object.assign(r, n), t && (r.timeZone = Ta, [ "full", "long" ].includes(r.timeStyle) && (r.timeStyle = "medium")), 
  r);
}

function e(e, n = qn) {
  const [t, , , o] = e;
  return (r, i = Ns, ...a) => {
    const s = n(o && o(...a), r, i, t), c = s.resolvedOptions();
    return [ s, ...toEpochMillis(e, c, a) ];
  };
}

function qn(e, n, t, o) {
  if (t = o(t), e) {
    if (void 0 !== t.timeZone) {
      throw new TypeError(Lr);
    }
    t.timeZone = e;
  }
  return new En(n, t);
}

function toEpochMillis(e, n, t) {
  const [, o, r] = e;
  return t.map((e => (e.calendar && ((e, n, t) => {
    if ((t || e !== X) && e !== n) {
      throw new RangeError(Er);
    }
  })(I(e.calendar), n.calendar, r), o(e, n))));
}

function An(e) {
  const n = Bn();
  return Ie(n, e.getOffsetNanosecondsFor(n));
}

function Bn() {
  return he(Date.now(), be);
}

function Nn() {
  return ys || (ys = (new En).resolvedOptions().timeZone);
}

const expectedInteger = (e, n) => `Non-integer ${e}: ${n}`, expectedPositive = (e, n) => `Non-positive ${e}: ${n}`, expectedFinite = (e, n) => `Non-finite ${e}: ${n}`, forbiddenBigIntToNumber = e => `Cannot convert bigint to ${e}`, invalidBigInt = e => `Invalid bigint: ${e}`, pr = "Cannot convert Symbol to string", hr = "Invalid object", numberOutOfRange = (e, n, t, o, r) => r ? numberOutOfRange(e, r[n], r[t], r[o]) : invalidEntity(e, n) + `; must be between ${t}-${o}`, invalidEntity = (e, n) => `Invalid ${e}: ${n}`, missingField = e => `Missing ${e}`, tn = e => `Invalid field ${e}`, duplicateFields = e => `Duplicate field ${e}`, noValidFields = e => "No valid fields: " + e.join(), Z = "Invalid bag", invalidChoice = (e, n, t) => invalidEntity(e, n) + "; must be " + Object.keys(t).join(), A = "Cannot use valueOf", P = "Invalid calling context", gr = "Forbidden era/eraYear", Dr = "Mismatching era/eraYear", Ir = "Mismatching year/eraYear", invalidEra = e => `Invalid era: ${e}`, missingYear = e => "Missing year" + (e ? "/era/eraYear" : ""), invalidMonthCode = e => `Invalid monthCode: ${e}`, Mr = "Mismatching month/monthCode", Nr = "Missing month/monthCode", yr = "Cannot guess year", Pr = "Invalid leap month", g = "Invalid protocol", vr = "Invalid protocol results", Er = "Mismatching Calendars", invalidCalendar = e => `Invalid Calendar: ${e}`, Fr = "Mismatching TimeZones", br = "Forbidden ICU TimeZone", wr = "Out-of-bounds offset", Br = "Out-of-bounds TimeZone gap", kr = "Invalid TimeZone offset", Yr = "Ambiguous offset", Cr = "Out-of-bounds date", Zr = "Out-of-bounds duration", Rr = "Cannot mix duration signs", zr = "Missing relativeTo", qr = "Cannot use large units", Ur = "Required smallestUnit or largestUnit", Ar = "smallestUnit > largestUnit", failedParse = e => `Cannot parse: ${e}`, invalidSubstring = e => `Invalid substring: ${e}`, Ln = e => `Cannot format ${e}`, kn = "Mismatching types for formatting", Lr = "Cannot specify TimeZone", Wr = /*@__PURE__*/ E(b, ((e, n) => n)), jr = /*@__PURE__*/ E(b, ((e, n, t) => t)), xr = /*@__PURE__*/ E(padNumber, 2), $r = {
  nanosecond: 0,
  microsecond: 1,
  millisecond: 2,
  second: 3,
  minute: 4,
  hour: 5,
  day: 6,
  week: 7,
  month: 8,
  year: 9
}, Et = /*@__PURE__*/ Object.keys($r), Gr = 864e5, Hr = 1e3, Vr = 1e3, be = 1e6, _r = 1e9, Jr = 6e10, Kr = 36e11, Qr = 864e11, Xr = [ 1, Vr, be, _r, Jr, Kr, Qr ], w = /*@__PURE__*/ Et.slice(0, 6), ei = /*@__PURE__*/ sortStrings(w), ni = [ "offset" ], ti = [ "timeZone" ], oi = /*@__PURE__*/ w.concat(ni), ri = /*@__PURE__*/ oi.concat(ti), ii = [ "era", "eraYear" ], ai = /*@__PURE__*/ ii.concat([ "year" ]), si = [ "year" ], ci = [ "monthCode" ], ui = /*@__PURE__*/ [ "month" ].concat(ci), li = [ "day" ], fi = /*@__PURE__*/ ui.concat(si), di = /*@__PURE__*/ ci.concat(si), en = /*@__PURE__*/ li.concat(fi), mi = /*@__PURE__*/ li.concat(ui), pi = /*@__PURE__*/ li.concat(ci), hi = /*@__PURE__*/ jr(w, 0), X = "iso8601", gi = "gregory", Ti = "japanese", Di = {
  [gi]: {
    bce: -1,
    ce: 0
  },
  [Ti]: {
    bce: -1,
    ce: 0,
    meiji: 1867,
    taisho: 1911,
    showa: 1925,
    heisei: 1988,
    reiwa: 2018
  },
  ethioaa: {
    era0: 0
  },
  ethiopic: {
    era0: 0,
    era1: 5500
  },
  coptic: {
    era0: -1,
    era1: 0
  },
  roc: {
    beforeroc: -1,
    minguo: 0
  },
  buddhist: {
    be: 0
  },
  islamic: {
    ah: 0
  },
  indian: {
    saka: 0
  },
  persian: {
    ap: 0
  }
}, Ii = {
  chinese: 13,
  dangi: 13,
  hebrew: -6
}, m = /*@__PURE__*/ E(requireType, "string"), f = /*@__PURE__*/ E(requireType, "boolean"), Mi = /*@__PURE__*/ E(requireType, "number"), $ = /*@__PURE__*/ E(requireType, "function"), F = /*@__PURE__*/ Et.map((e => e + "s")), Ni = /*@__PURE__*/ sortStrings(F), yi = /*@__PURE__*/ F.slice(0, 6), Pi = /*@__PURE__*/ F.slice(6), vi = /*@__PURE__*/ Pi.slice(1), Ei = /*@__PURE__*/ Wr(F), Si = /*@__PURE__*/ jr(F, 0), Fi = /*@__PURE__*/ jr(yi, 0), bi = /*@__PURE__*/ E(zeroOutProps, F), j = [ "isoNanosecond", "isoMicrosecond", "isoMillisecond", "isoSecond", "isoMinute", "isoHour" ], Oi = [ "isoDay", "isoMonth", "isoYear" ], wi = /*@__PURE__*/ j.concat(Oi), Bi = /*@__PURE__*/ sortStrings(Oi), ki = /*@__PURE__*/ sortStrings(j), Yi = /*@__PURE__*/ sortStrings(wi), Dt = /*@__PURE__*/ jr(ki, 0), Ci = /*@__PURE__*/ E(zeroOutProps, wi), En = Intl.DateTimeFormat, Zi = "en-GB", Ri = 1e8, zi = Ri * Gr, qi = [ Ri, 0 ], Ui = [ -Ri, 0 ], Ai = 275760, Li = -271821, Wi = 1970, ji = 1972, xi = 12, $i = /*@__PURE__*/ isoArgsToEpochMilli(1868, 9, 8), Gi = /*@__PURE__*/ Jn(computeJapaneseEraParts, WeakMap), Hi = "smallestUnit", Vi = "unit", _i = "roundingIncrement", Ji = "fractionalSecondDigits", Ki = "relativeTo", Qi = {
  constrain: 0,
  reject: 1
}, Xi = /*@__PURE__*/ Object.keys(Qi), ea = {
  compatible: 0,
  reject: 1,
  earlier: 2,
  later: 3
}, na = {
  reject: 0,
  use: 1,
  prefer: 2,
  ignore: 3
}, ta = {
  auto: 0,
  never: 1,
  critical: 2,
  always: 3
}, oa = {
  auto: 0,
  never: 1,
  critical: 2
}, ra = {
  auto: 0,
  never: 1
}, ia = {
  floor: 0,
  halfFloor: 1,
  ceil: 2,
  halfCeil: 3,
  trunc: 4,
  halfTrunc: 5,
  expand: 6,
  halfExpand: 7,
  halfEven: 8
}, aa = /*@__PURE__*/ E(refineUnitOption, Hi), sa = /*@__PURE__*/ E(refineUnitOption, "largestUnit"), ca = /*@__PURE__*/ E(refineUnitOption, Vi), ua = /*@__PURE__*/ E(refineChoiceOption, "overflow", Qi), la = /*@__PURE__*/ E(refineChoiceOption, "disambiguation", ea), fa = /*@__PURE__*/ E(refineChoiceOption, "offset", na), da = /*@__PURE__*/ E(refineChoiceOption, "calendarName", ta), ma = /*@__PURE__*/ E(refineChoiceOption, "timeZoneName", oa), pa = /*@__PURE__*/ E(refineChoiceOption, "offset", ra), ha = /*@__PURE__*/ E(refineChoiceOption, "roundingMode", ia), L = "PlainYearMonth", q = "PlainMonthDay", J = "PlainDate", We = "PlainDateTime", xe = "PlainTime", Te = "ZonedDateTime", Oe = "Instant", qt = "Duration", ga = [ Math.floor, e => hasHalf(e) ? Math.floor(e) : Math.round(e), Math.ceil, e => hasHalf(e) ? Math.ceil(e) : Math.round(e), Math.trunc, e => hasHalf(e) ? Math.trunc(e) || 0 : Math.round(e), e => e < 0 ? Math.floor(e) : Math.ceil(e), e => Math.sign(e) * Math.round(Math.abs(e)) || 0, e => hasHalf(e) ? (e = Math.trunc(e) || 0) + e % 2 : Math.round(e) ], Ta = "UTC", Da = 5184e3, Ia = /*@__PURE__*/ isoArgsToEpochSec(1847), Ma = /*@__PURE__*/ isoArgsToEpochSec(/*@__PURE__*/ (/*@__PURE__*/ new Date).getUTCFullYear() + 10), Na = /0+$/, fn = /*@__PURE__*/ Jn(_zonedEpochSlotsToIso, WeakMap), ya = 2 ** 32 - 1, ie = /*@__PURE__*/ Jn((e => {
  const n = getTimeZoneEssence(e);
  return "object" == typeof n ? new IntlTimeZone(n) : new FixedTimeZone(n || 0);
}));

class FixedTimeZone {
  constructor(e) {
    this.v = e;
  }
  getOffsetNanosecondsFor() {
    return this.v;
  }
  getPossibleInstantsFor(e) {
    return [ isoToEpochNanoWithOffset(e, this.v) ];
  }
  l() {}
}

class IntlTimeZone {
  constructor(e) {
    this.$ = (e => {
      function getOffsetSec(e) {
        const i = clampNumber(e, o, r), [a, s] = computePeriod(i), c = n(a), u = n(s);
        return c === u ? c : pinch(t(a, s), c, u, e);
      }
      function pinch(n, t, o, r) {
        let i, a;
        for (;(void 0 === r || void 0 === (i = r < n[0] ? t : r >= n[1] ? o : void 0)) && (a = n[1] - n[0]); ) {
          const t = n[0] + Math.floor(a / 2);
          e(t) === o ? n[1] = t : n[0] = t + 1;
        }
        return i;
      }
      const n = Jn(e), t = Jn(createSplitTuple);
      let o = Ia, r = Ma;
      return {
        G(e) {
          const n = getOffsetSec(e - 86400), t = getOffsetSec(e + 86400), o = e - n, r = e - t;
          if (n === t) {
            return [ o ];
          }
          const i = getOffsetSec(o);
          return i === getOffsetSec(r) ? [ e - i ] : n > t ? [ o, r ] : [];
        },
        V: getOffsetSec,
        l(e, i) {
          const a = clampNumber(e, o, r);
          let [s, c] = computePeriod(a);
          const u = Da * i, l = i < 0 ? () => c > o || (o = a, 0) : () => s < r || (r = a, 
          0);
          for (;l(); ) {
            const o = n(s), r = n(c);
            if (o !== r) {
              const n = t(s, c);
              pinch(n, o, r);
              const a = n[0];
              if ((compareNumbers(a, e) || 1) === i) {
                return a;
              }
            }
            s += u, c += u;
          }
        }
      };
    })((e => n => {
      const t = hashIntlFormatParts(e, n * Hr);
      return isoArgsToEpochSec(parseIntlPartsYear(t), parseInt(t.month), parseInt(t.day), parseInt(t.hour), parseInt(t.minute), parseInt(t.second)) - n;
    })(e));
  }
  getOffsetNanosecondsFor(e) {
    return this.$.V(epochNanoToSec(e)) * _r;
  }
  getPossibleInstantsFor(e) {
    const [n, t] = [ isoArgsToEpochSec((o = e).isoYear, o.isoMonth, o.isoDay, o.isoHour, o.isoMinute, o.isoSecond), o.isoMillisecond * be + o.isoMicrosecond * Vr + o.isoNanosecond ];
    var o;
    return this.$.G(n).map((e => checkEpochNanoInBounds(moveBigNano(he(e, _r), t))));
  }
  l(e, n) {
    const [t, o] = epochNanoToSecMod(e), r = this.$.l(t + (n > 0 || o ? 1 : 0), n);
    if (void 0 !== r) {
      return he(r, _r);
    }
  }
}

const Pa = "([+−-])", va = "(?:[.,](\\d{1,9}))?", Ea = `(?:(?:${Pa}(\\d{6}))|(\\d{4}))-?(\\d{2})`, Sa = "(\\d{2})(?::?(\\d{2})(?::?(\\d{2})" + va + ")?)?", Fa = Pa + Sa, ba = Ea + "-?(\\d{2})(?:[T ]" + Sa + "(Z|" + Fa + ")?)?", Oa = "\\[(!?)([^\\]]*)\\]", wa = `((?:${Oa}){0,9})`, Ba = /*@__PURE__*/ createRegExp(Ea + wa), ka = /*@__PURE__*/ createRegExp("(?:--)?(\\d{2})-?(\\d{2})" + wa), Ya = /*@__PURE__*/ createRegExp(ba + wa), Ca = /*@__PURE__*/ createRegExp("T?" + Sa + "(?:" + Fa + ")?" + wa), Za = /*@__PURE__*/ createRegExp(Fa), Ra = /*@__PURE__*/ new RegExp(Oa, "g"), za = /*@__PURE__*/ createRegExp(`${Pa}?P(\\d+Y)?(\\d+M)?(\\d+W)?(\\d+D)?(?:T(?:(\\d+)${va}H)?(?:(\\d+)${va}M)?(?:(\\d+)${va}S)?)?`), qa = /*@__PURE__*/ Jn((e => new En(Zi, {
  timeZone: e,
  era: "short",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric"
}))), Ua = /^(AC|AE|AG|AR|AS|BE|BS|CA|CN|CS|CT|EA|EC|IE|IS|JS|MI|NE|NS|PL|PN|PR|PS|SS|VS)T$/, Aa = /*@__PURE__*/ Jn(createIntlCalendar), La = /*@__PURE__*/ Jn((e => new En(Zi, {
  calendar: e,
  timeZone: Ta,
  era: "short",
  year: "numeric",
  month: "short",
  day: "numeric"
}))), Wa = /^M(\d{2})(L?)$/, ja = {
  era: toStringViaPrimitive,
  eraYear: toInteger,
  year: toInteger,
  month: toPositiveInteger,
  monthCode: toStringViaPrimitive,
  day: toPositiveInteger
}, xa = /*@__PURE__*/ jr(w, toInteger), $a = /*@__PURE__*/ jr(F, toStrictInteger), Ga = /*@__PURE__*/ Object.assign({}, ja, xa, $a, {
  offset: toStringViaPrimitive
}), Ha = /*@__PURE__*/ E(remapProps, w, j), Va = {
  dateAdd(e, n, t) {
    const o = H(t);
    let r, {years: i, months: a, weeks: s, days: c} = n;
    if (c += durationFieldsToBigNano(n, 5)[0], i || a) {
      r = ((e, n, t, o, r) => {
        let [i, a, s] = e.h(n);
        if (t) {
          const [n, o] = e.I(i, a);
          i += t, a = monthCodeNumberToMonth(n, o, e.U(i)), a = clampEntity("month", a, 1, e.L(i), r);
        }
        return o && ([i, a] = e._(i, a, o)), s = clampEntity("day", s, 1, e.j(i, a), r), 
        e.q(i, a, s);
      })(this, e, i, a, o);
    } else {
      if (!s && !c) {
        return e;
      }
      r = isoToEpochMilli(e);
    }
    return r += (7 * s + c) * Gr, checkIsoDateInBounds(epochMilliToIso(r));
  },
  dateUntil(e, n, t) {
    if (t <= 7) {
      let o = 0, r = diffDays({
        ...e,
        ...Dt
      }, {
        ...n,
        ...Dt
      });
      return 7 === t && ([o, r] = divModTrunc(r, 7)), {
        ...Si,
        weeks: o,
        days: r
      };
    }
    const o = this.h(e), r = this.h(n);
    let [i, a, s] = ((e, n, t, o, r, i, a) => {
      let s = r - n, c = i - t, u = a - o;
      if (s || c) {
        const l = Math.sign(s || c);
        let f = e.j(r, i), d = 0;
        if (Math.sign(u) === -l) {
          const o = f;
          [r, i] = e._(r, i, -l), s = r - n, c = i - t, f = e.j(r, i), d = l < 0 ? -o : f;
        }
        if (u = a - Math.min(o, f) + d, s) {
          const [o, a] = e.I(n, t), [u, f] = e.I(r, i);
          if (c = u - o || Number(f) - Number(a), Math.sign(c) === -l) {
            const t = l < 0 && -e.L(r);
            s = (r -= l) - n, c = i - monthCodeNumberToMonth(o, a, e.U(r)) + (t || e.L(r));
          }
        }
      }
      return [ s, c, u ];
    })(this, ...o, ...r);
    return 8 === t && (a += this.J(i, o[0]), i = 0), {
      ...Si,
      years: i,
      months: a,
      days: s
    };
  },
  dateFromFields(e, n) {
    const t = H(n), o = refineYear(this, e), r = refineMonth(this, e, o, t), i = refineDay(this, e, r, o, t);
    return v(checkIsoDateInBounds(this.P(o, r, i)), this.id || X);
  },
  yearMonthFromFields(e, n) {
    const t = H(n), o = refineYear(this, e), r = refineMonth(this, e, o, t);
    return createPlainYearMonthSlots(checkIsoYearMonthInBounds(this.P(o, r, 1)), this.id || X);
  },
  monthDayFromFields(e, n) {
    const t = H(n), o = !this.id, {monthCode: r, year: i, month: a} = e;
    let s, c, u, l, f;
    if (void 0 !== r) {
      [s, c] = parseMonthCode(r), f = getDefinedProp(e, "day");
      const n = this.N(s, c, f);
      if (!n) {
        throw new RangeError(yr);
      }
      if ([u, l] = n, void 0 !== a && a !== l) {
        throw new RangeError(Mr);
      }
      o && (l = clampEntity("month", l, 1, xi, 1), f = clampEntity("day", f, 1, computeIsoDaysInMonth(void 0 !== i ? i : u, l), t));
    } else {
      u = void 0 === i && o ? ji : refineYear(this, e), l = refineMonth(this, e, u, t), 
      f = refineDay(this, e, l, u, t);
      const n = this.U(u);
      c = l === n, s = monthToMonthCodeNumber(l, n);
      const r = this.N(s, c, f);
      if (!r) {
        throw new RangeError(yr);
      }
      [u, l] = r;
    }
    return createPlainMonthDaySlots(checkIsoDateInBounds(this.P(u, l, f)), this.id || X);
  },
  fields(e) {
    return getCalendarEraOrigins(this) && e.includes("year") ? [ ...e, ...ii ] : e;
  },
  mergeFields(e, n) {
    const t = Object.assign(Object.create(null), e);
    return spliceFields(t, n, ui), getCalendarEraOrigins(this) && (spliceFields(t, n, ai), 
    this.id === Ti && spliceFields(t, n, mi, ii)), t;
  },
  inLeapYear(e) {
    const [n] = this.h(e);
    return this.K(n);
  },
  monthsInYear(e) {
    const [n] = this.h(e);
    return this.L(n);
  },
  daysInMonth(e) {
    const [n, t] = this.h(e);
    return this.j(n, t);
  },
  daysInYear(e) {
    const [n] = this.h(e);
    return this.X(n);
  },
  dayOfYear: computeNativeDayOfYear,
  era(e) {
    return this.ee(e)[0];
  },
  eraYear(e) {
    return this.ee(e)[1];
  },
  monthCode(e) {
    const [n, t] = this.h(e), [o, r] = this.I(n, t);
    return ((e, n) => "M" + xr(e) + (n ? "L" : ""))(o, r);
  },
  dayOfWeek: computeIsoDayOfWeek,
  daysInWeek() {
    return 7;
  }
}, _a = {
  dayOfYear: computeNativeDayOfYear,
  h: computeIsoDateParts,
  q: isoArgsToEpochMilli
}, Ja = /*@__PURE__*/ Object.assign({}, _a, {
  weekOfYear: computeNativeWeekOfYear,
  yearOfWeek: computeNativeYearOfWeek,
  R(e) {
    function computeWeekShift(e) {
      return (7 - e < n ? 7 : 0) - e;
    }
    function computeWeeksInYear(e) {
      const n = computeIsoDaysInYear(l + e), t = e || 1, o = computeWeekShift(modFloor(a + n * t, 7));
      return c = (n + (o - s) * t) / 7;
    }
    const n = this.id ? 1 : 4, t = computeIsoDayOfWeek(e), o = this.dayOfYear(e), r = modFloor(t - 1, 7), i = o - 1, a = modFloor(r - i, 7), s = computeWeekShift(a);
    let c, u = Math.floor((i - s) / 7) + 1, l = e.isoYear;
    return u ? u > computeWeeksInYear(0) && (u = 1, l++) : (u = computeWeeksInYear(-1), 
    l--), [ u, l, c ];
  }
}), Ka = {
  dayOfYear: computeNativeDayOfYear,
  h: computeIntlDateParts,
  q: computeIntlEpochMilli,
  weekOfYear: computeNativeWeekOfYear,
  yearOfWeek: computeNativeYearOfWeek,
  R() {
    return [];
  }
}, Y = /*@__PURE__*/ createNativeOpsCreator(/*@__PURE__*/ Object.assign({}, Va, Ja, {
  h: computeIsoDateParts,
  ee(e) {
    return this.id === gi ? computeGregoryEraParts(e) : this.id === Ti ? Gi(e) : [];
  },
  I: (e, n) => [ n, 0 ],
  N(e, n) {
    if (!n) {
      return [ ji, e ];
    }
  },
  K: computeIsoInLeapYear,
  U() {},
  L: computeIsoMonthsInYear,
  J: e => e * xi,
  j: computeIsoDaysInMonth,
  X: computeIsoDaysInYear,
  P: (e, n, t) => ({
    isoYear: e,
    isoMonth: n,
    isoDay: t
  }),
  q: isoArgsToEpochMilli,
  _: (e, n, t) => (e += divTrunc(t, xi), (n += modTrunc(t, xi)) < 1 ? (e--, n += xi) : n > xi && (e++, 
  n -= xi), [ e, n ]),
  year(e) {
    return e.isoYear;
  },
  month(e) {
    return e.isoMonth;
  },
  day: e => e.isoDay
}), /*@__PURE__*/ Object.assign({}, Va, Ka, {
  h: computeIntlDateParts,
  ee(e) {
    const n = this.O(e);
    return [ n.era, n.eraYear ];
  },
  I(e, n) {
    const t = computeIntlLeapMonth.call(this, e);
    return [ monthToMonthCodeNumber(n, t), t === n ];
  },
  N(e, n, t) {
    let [o, r, i] = computeIntlDateParts.call(this, {
      isoYear: ji,
      isoMonth: xi,
      isoDay: 31
    });
    const a = computeIntlLeapMonth.call(this, o), s = r === a;
    1 === (compareNumbers(e, monthToMonthCodeNumber(r, a)) || compareNumbers(Number(n), Number(s)) || compareNumbers(t, i)) && o--;
    for (let r = 0; r < 100; r++) {
      const i = o - r, a = computeIntlLeapMonth.call(this, i), s = monthCodeNumberToMonth(e, n, a);
      if (n === (s === a) && t <= computeIntlDaysInMonth.call(this, i, s)) {
        return [ i, s ];
      }
    }
  },
  K(e) {
    const n = computeIntlDaysInYear.call(this, e);
    return n > computeIntlDaysInYear.call(this, e - 1) && n > computeIntlDaysInYear.call(this, e + 1);
  },
  U: computeIntlLeapMonth,
  L: computeIntlMonthsInYear,
  J(e, n) {
    const t = n + e, o = Math.sign(e), r = o < 0 ? -1 : 0;
    let i = 0;
    for (let e = n; e !== t; e += o) {
      i += computeIntlMonthsInYear.call(this, e + r);
    }
    return i;
  },
  j: computeIntlDaysInMonth,
  X: computeIntlDaysInYear,
  P(e, n, t) {
    return epochMilliToIso(computeIntlEpochMilli.call(this, e, n, t));
  },
  q: computeIntlEpochMilli,
  _(e, n, t) {
    if (t) {
      if (n += t, !Number.isSafeInteger(n)) {
        throw new RangeError(Cr);
      }
      if (t < 0) {
        for (;n < 1; ) {
          n += computeIntlMonthsInYear.call(this, --e);
        }
      } else {
        let t;
        for (;n > (t = computeIntlMonthsInYear.call(this, e)); ) {
          n -= t, e++;
        }
      }
    }
    return [ e, n ];
  },
  year(e) {
    return this.O(e).year;
  },
  month(e) {
    const {year: n, F: t} = this.O(e), {C: o} = this.B(n);
    return o[t] + 1;
  },
  day(e) {
    return this.O(e).day;
  }
})), Qa = "numeric", Xa = [ "timeZoneName" ], es = {
  month: Qa,
  day: Qa
}, ns = {
  year: Qa,
  month: Qa
}, ts = /*@__PURE__*/ Object.assign({}, ns, {
  day: Qa
}), os = {
  hour: Qa,
  minute: Qa,
  second: Qa
}, rs = /*@__PURE__*/ Object.assign({}, ts, os), is = /*@__PURE__*/ Object.assign({}, rs, {
  timeZoneName: "short"
}), as = /*@__PURE__*/ Object.keys(ns), ss = /*@__PURE__*/ Object.keys(es), cs = /*@__PURE__*/ Object.keys(ts), us = /*@__PURE__*/ Object.keys(os), ls = [ "dateStyle" ], fs = /*@__PURE__*/ as.concat(ls), ds = /*@__PURE__*/ ss.concat(ls), ms = /*@__PURE__*/ cs.concat(ls, [ "weekday" ]), ps = /*@__PURE__*/ us.concat([ "dayPeriod", "timeStyle" ]), hs = /*@__PURE__*/ ms.concat(ps), gs = /*@__PURE__*/ hs.concat(Xa), Ts = /*@__PURE__*/ Xa.concat(ps), Ds = /*@__PURE__*/ Xa.concat(ms), Is = /*@__PURE__*/ Xa.concat([ "day", "weekday" ], ps), Ms = /*@__PURE__*/ Xa.concat([ "year", "weekday" ], ps), Ns = {}, t = [ /*@__PURE__*/ createOptionsTransformer(hs, rs), y ], s = [ /*@__PURE__*/ createOptionsTransformer(gs, is), y, 0, (e, n) => {
  const t = I(e.timeZone);
  if (n && I(n.timeZone) !== t) {
    throw new RangeError(Fr);
  }
  return t;
} ], n = [ /*@__PURE__*/ createOptionsTransformer(hs, rs, Xa), isoToEpochMilli ], o = [ /*@__PURE__*/ createOptionsTransformer(ms, ts, Ts), isoToEpochMilli ], r = [ /*@__PURE__*/ createOptionsTransformer(ps, os, Ds), e => isoTimeFieldsToNano(e) / be ], a = [ /*@__PURE__*/ createOptionsTransformer(fs, ns, Is), isoToEpochMilli, 1 ], i = [ /*@__PURE__*/ createOptionsTransformer(ds, es, Ms), isoToEpochMilli, 1 ];

let ys;

export { qt as DurationBranding, Oe as InstantBranding, J as PlainDateBranding, We as PlainDateTimeBranding, q as PlainMonthDayBranding, xe as PlainTimeBranding, L as PlainYearMonthBranding, En as RawDateTimeFormat, Te as ZonedDateTimeBranding, Rt as absDuration, Wt as addDurations, oe as bigNanoToNumber, E as bindArgs, mn as buildZonedIsoFields, te as compareBigNanos, $t as compareDurations, Ze as compareInstants, rt as compareIsoDateFields, gt as compareIsoDateTimeFields, He as compareIsoTimeFields, yn as compareZonedDateTimes, dn as computeZonedHoursInDay, Cn as computeZonedStartOfDay, Lt as constructDurationSlots, Se as constructInstantSlots, Nt as constructPlainDateSlots, pt as constructPlainDateTimeSlots, G as constructPlainMonthDaySlots, ke as constructPlainTimeSlots, tt as constructPlainYearMonthSlots, vn as constructZonedDateTimeSlots, U as copyOptions, Vt as createDurationSlots, qn as createFormatForPrep, e as createFormatPrepper, O as createGetterDescriptors, _ as createInstantSlots, D as createNameDescriptors, Y as createNativeStandardOps, v as createPlainDateSlots, ee as createPlainDateTimeSlots, Ge as createPlainTimeSlots, p as createPropDescriptors, h as createStringTagDescriptors, Yn as createZonedDateTimeSlots, o as dateConfig, en as dateFieldNamesAlpha, n as dateTimeConfig, re as diffBigNanos, le as diffInstants, ut as diffPlainDateTimes, Ft as diffPlainDates, Ae as diffPlainTimes, Xe as diffPlainYearMonth, Dn as diffZonedDateTimes, F as durationFieldNamesAsc, kt as durationWithFields, Ce as epochMicroToInstant, Pe as epochMilliToInstant, ge as epochNanoToInstant, Ie as epochNanoToIso, De as epochSecToInstant, V as excludePropsByName, nn as excludeUndefinedProps, tn as forbiddenField, A as forbiddenValueOf, zt as formatDurationIso, me as formatInstantIso, Fe as formatOffsetNano, yt as formatPlainDateIso, Tt as formatPlainDateTimeIso, W as formatPlainMonthDayIso, qe as formatPlainTimeIso, et as formatPlainYearMonthIso, In as formatZonedDateTimeIso, Bn as getCurrentEpochNano, An as getCurrentIsoDateTime, Nn as getCurrentTimeZoneId, Jt as getDurationBlank, N as getEpochMicro, y as getEpochMilli, B as getEpochNano, M as getEpochSec, I as getId, ln as getRequiredDateFields, cn as getRequiredMonthDayFields, un as getRequiredYearMonthFields, we as getSingleInstantFor, C as hasAllPropsByName, t as instantConfig, fe as instantToZonedDateTime, ue as instantsEqual, Z as invalidBag, P as invalidCallingContext, Ln as invalidFormatType, g as invalidProtocol, z as isObjectLike, je as isTimeZoneSlotsEqual, X as isoCalendarId, Dt as isoTimeFieldDefaults, j as isoTimeFieldNamesAsc, b as mapPropNames, T as mapProps, Jn as memoize, kn as mismatchingFormatTypes, i as monthDayConfig, se as moveInstant, bt as movePlainDate, ct as movePlainDateTime, Ye as movePlainTime, Qe as movePlainYearMonth, hn as moveZonedDateTime, be as nanoInMilli, xt as negateDuration, he as numberToBigNano, sn as parseCalendarId, Kt as parseDuration, pe as parseInstant, At as parsePlainDate, Ct as parsePlainDateTime, Q as parsePlainMonthDay, ze as parsePlainTime, ot as parsePlainYearMonth, Xt as parseRelativeToSlots, Ne as parseTimeZoneId, Mn as parseZonedDateTime, Ot as plainDateTimeToPlainMonthDay, St as plainDateTimeToPlainYearMonth, mt as plainDateTimeToZonedDateTime, at as plainDateTimeWithFields, st as plainDateTimeWithPlainDate, lt as plainDateTimeWithPlainTime, ft as plainDateTimesEqual, wt as plainDateToPlainDateTime, Mt as plainDateToPlainMonthDay, jt as plainDateToPlainYearMonth, vt as plainDateToZonedDateTime, Zt as plainDateWithFields, It as plainDatesEqual, R as plainMonthDayToPlainDate, k as plainMonthDayWithFields, x as plainMonthDaysEqual, Le as plainTimeToPlainDateTime, Je as plainTimeToZonedDateTime, Be as plainTimeWithFields, Ve as plainTimesEqual, _e as plainYearMonthToPlainDate, Ke as plainYearMonthWithFields, $e as plainYearMonthsEqual, Vn as pluckProps, ie as queryNativeTimeZone, rn as refineCalendarId, _t as refineDateDiffOptions, Ht as refineDurationBag, ve as refineEpochDisambigOptions, Qt as refineMaybeZonedDateTimeBag, H as refineOverflowOptions, Yt as refinePlainDateBag, Pt as refinePlainDateTimeBag, K as refinePlainMonthDayBag, Ue as refinePlainTimeBag, nt as refinePlainYearMonthBag, Me as refineTimeZoneId, jn as refineZonedDateTimeBag, wn as refineZonedFieldOptions, f as requireBoolean, $ as requireFunction, u as requireInteger, c as requireIntegerOrUndefined, on as requireNonNullish, de as requireObjectLike, d as requirePositiveInteger, S as requirePositiveIntegerOrUndefined, m as requireString, l as requireStringOrUndefined, an as resolveCalendarId, ye as resolveTimeZoneId, Gt as roundDuration, ce as roundInstant, dt as roundPlainDateTime, Ee as roundPlainTime, Pn as roundZonedDateTime, it as slotsWithCalendar, On as slotsWithTimeZone, r as timeConfig, w as timeFieldNamesAsc, Ut as totalDuration, Et as unitNamesAsc, ne as validateTimeZoneGap, ae as validateTimeZoneOffset, a as yearMonthConfig, s as zonedConfig, Zn as zonedDateTimeToInstant, Bt as zonedDateTimeToPlainDate, ht as zonedDateTimeToPlainDateTime, Fn as zonedDateTimeToPlainMonthDay, Re as zonedDateTimeToPlainTime, bn as zonedDateTimeToPlainYearMonth, Sn as zonedDateTimeWithFields, Tn as zonedDateTimeWithPlainDate, pn as zonedDateTimeWithPlainTime, gn as zonedDateTimesEqual, fn as zonedEpochSlotsToIso };
