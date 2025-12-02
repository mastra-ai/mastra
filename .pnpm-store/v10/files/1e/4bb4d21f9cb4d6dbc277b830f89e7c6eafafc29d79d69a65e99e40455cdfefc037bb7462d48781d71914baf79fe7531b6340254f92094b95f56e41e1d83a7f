function createSlotClass(e, t, n, o, r) {
  function Class(...e) {
    if (!(this instanceof Class)) {
      throw new TypeError(P);
    }
    oo(this, t(...e));
  }
  function bindMethod(e, t) {
    return Object.defineProperties((function(...t) {
      return e.call(this, getSpecificSlots(this), ...t);
    }), D(t));
  }
  function getSpecificSlots(t) {
    const n = no(t);
    if (!n || n.branding !== e) {
      throw new TypeError(P);
    }
    return n;
  }
  return Object.defineProperties(Class.prototype, {
    ...O(T(bindMethod, n)),
    ...p(T(bindMethod, o)),
    ...h("Temporal." + e)
  }), Object.defineProperties(Class, {
    ...p(r),
    ...D(e)
  }), [ Class, e => {
    const t = Object.create(Class.prototype);
    return oo(t, e), t;
  }, getSpecificSlots ];
}

function createProtocolValidator(e) {
  return e = e.concat("id").sort(), t => {
    if (!C(t, e)) {
      throw new TypeError(g);
    }
    return t;
  };
}

function rejectInvalidBag(e) {
  if (no(e) || void 0 !== e.calendar || void 0 !== e.timeZone) {
    throw new TypeError(Z);
  }
  return e;
}

function createCalendarFieldMethods(e, t) {
  const n = {};
  for (const o in e) {
    n[o] = ({o: e}, n) => {
      const r = no(n) || {}, {branding: a} = r, i = a === J || t.includes(a) ? r : toPlainDateSlots(n);
      return e[o](i);
    };
  }
  return n;
}

function createCalendarGetters(e) {
  const t = {};
  for (const n in e) {
    t[n] = e => {
      const {calendar: t} = e;
      return (o = t, "string" == typeof o ? Y(o) : (r = o, Object.assign(Object.create(co), {
        i: r
      })))[n](e);
      var o, r;
    };
  }
  return t;
}

function neverValueOf() {
  throw new TypeError(A);
}

function createCalendarFromSlots({calendar: e}) {
  return "string" == typeof e ? new lr(e) : e;
}

function toPlainMonthDaySlots(e, t) {
  if (t = U(t), z(e)) {
    const n = no(e);
    if (n && n.branding === q) {
      return H(t), n;
    }
    const o = extractCalendarSlotFromBag(e);
    return K(Qo(o || X), !o, e, t);
  }
  const n = Q(Y, e);
  return H(t), n;
}

function getOffsetNanosecondsForAdapter(e, t, n) {
  return o = t.call(e, Co(_(n))), ae(u(o));
  var o;
}

function createAdapterOps(e, t = ho) {
  const n = Object.keys(t).sort(), o = {};
  for (const r of n) {
    o[r] = E(t[r], e, $(e[r]));
  }
  return o;
}

function createTimeZoneOps(e, t) {
  return "string" == typeof e ? ie(e) : createAdapterOps(e, t);
}

function createTimeZoneOffsetOps(e) {
  return createTimeZoneOps(e, Do);
}

function toInstantSlots(e) {
  if (z(e)) {
    const t = no(e);
    if (t) {
      switch (t.branding) {
       case Oe:
        return t;

       case Te:
        return _(t.epochNanoseconds);
      }
    }
  }
  return pe(e);
}

function toTemporalInstant() {
  return Co(_(he(this.valueOf(), be)));
}

function getImplTransition(e, t, n) {
  const o = t.l(toInstantSlots(n).epochNanoseconds, e);
  return o ? Co(_(o)) : null;
}

function refineTimeZoneSlot(e) {
  return z(e) ? (no(e) || {}).timeZone || Fo(e) : (e => ye(Ne(m(e))))(e);
}

function toPlainTimeSlots(e, t) {
  if (z(e)) {
    const n = no(e) || {};
    switch (n.branding) {
     case xe:
      return H(t), n;

     case We:
      return H(t), Ge(n);

     case Te:
      return H(t), Re(createTimeZoneOffsetOps, n);
    }
    return Ue(e, t);
  }
  return H(t), ze(e);
}

function optionalToPlainTimeFields(e) {
  return void 0 === e ? void 0 : toPlainTimeSlots(e);
}

function toPlainYearMonthSlots(e, t) {
  if (t = U(t), z(e)) {
    const n = no(e);
    return n && n.branding === L ? (H(t), n) : nt(Ho(getCalendarSlotFromBag(e)), e, t);
  }
  const n = ot(Y, e);
  return H(t), n;
}

function toPlainDateTimeSlots(e, t) {
  if (t = U(t), z(e)) {
    const n = no(e) || {};
    switch (n.branding) {
     case We:
      return H(t), n;

     case J:
      return H(t), ee({
        ...n,
        ...Dt
      });

     case Te:
      return H(t), ht(createTimeZoneOffsetOps, n);
    }
    return Pt(Ko(getCalendarSlotFromBag(e)), e, t);
  }
  const n = Ct(e);
  return H(t), n;
}

function toPlainDateSlots(e, t) {
  if (t = U(t), z(e)) {
    const n = no(e) || {};
    switch (n.branding) {
     case J:
      return H(t), n;

     case We:
      return H(t), v(n);

     case Te:
      return H(t), Bt(createTimeZoneOffsetOps, n);
    }
    return Yt(Ko(getCalendarSlotFromBag(e)), e, t);
  }
  const n = At(e);
  return H(t), n;
}

function dayAdapter(e, t, n) {
  return d(t.call(e, Yo(v(n, e))));
}

function createCompoundOpsCreator(e) {
  return t => "string" == typeof t ? Y(t) : ((e, t) => {
    const n = Object.keys(t).sort(), o = {};
    for (const r of n) {
      o[r] = E(t[r], e, e[r]);
    }
    return o;
  })(t, e);
}

function toDurationSlots(e) {
  if (z(e)) {
    const t = no(e);
    return t && t.branding === qt ? t : Ht(e);
  }
  return Kt(e);
}

function refinePublicRelativeTo(e) {
  if (void 0 !== e) {
    if (z(e)) {
      const t = no(e) || {};
      switch (t.branding) {
       case Te:
       case J:
        return t;

       case We:
        return v(t);
      }
      const n = getCalendarSlotFromBag(e);
      return {
        ...Qt(refineTimeZoneSlot, createTimeZoneOps, Ko(n), e),
        calendar: n
      };
    }
    return Xt(e);
  }
}

function getCalendarSlotFromBag(e) {
  return extractCalendarSlotFromBag(e) || X;
}

function extractCalendarSlotFromBag(e) {
  const {calendar: t} = e;
  if (void 0 !== t) {
    return refineCalendarSlot(t);
  }
}

function refineCalendarSlot(e) {
  return z(e) ? (no(e) || {}).calendar || cr(e) : (e => an(sn(m(e))))(e);
}

function toZonedDateTimeSlots(e, t) {
  if (t = U(t), z(e)) {
    const n = no(e);
    if (n && n.branding === Te) {
      return wn(t), n;
    }
    const o = getCalendarSlotFromBag(e);
    return jn(refineTimeZoneSlot, createTimeZoneOps, Ko(o), o, e, t);
  }
  return Mn(e, t);
}

function adaptDateMethods(e) {
  return T((e => t => e(slotsToIso(t))), e);
}

function slotsToIso(e) {
  return fn(e, createTimeZoneOffsetOps);
}

function createDateTimeFormatClass() {
  const e = En.prototype, t = Object.getOwnPropertyDescriptors(e), n = Object.getOwnPropertyDescriptors(En), DateTimeFormat = function(e, t = {}) {
    if (!(this instanceof DateTimeFormat)) {
      return new DateTimeFormat(e, t);
    }
    Or.set(this, ((e, t = {}) => {
      const n = new En(e, t), o = n.resolvedOptions(), r = o.locale, a = Vn(Object.keys(t), o), i = Jn(createFormatPrepperForBranding), prepFormat = (...e) => {
        let t;
        const o = e.map(((e, n) => {
          const o = no(e), r = (o || {}).branding;
          if (n && t && t !== r) {
            throw new TypeError(kn);
          }
          return t = r, o;
        }));
        return t ? i(t)(r, a, ...o) : [ n, ...e ];
      };
      return prepFormat.u = n, prepFormat;
    })(e, t));
  };
  for (const e in t) {
    const n = t[e], o = e.startsWith("format") && createFormatMethod(e);
    "function" == typeof n.value ? n.value = "constructor" === e ? DateTimeFormat : o || createProxiedMethod(e) : o && (n.get = function() {
      return o.bind(this);
    });
  }
  return n.prototype.value = Object.create(e, t), Object.defineProperties(DateTimeFormat, n), 
  DateTimeFormat;
}

function createFormatMethod(e) {
  return function(...t) {
    const n = Or.get(this), [o, ...r] = n(...t);
    return o[e](...r);
  };
}

function createProxiedMethod(e) {
  return function(...t) {
    return Or.get(this).u[e](...t);
  };
}

function createFormatPrepperForBranding(t) {
  const n = xn[t];
  if (!n) {
    throw new TypeError(Ln(t));
  }
  return e(n, Jn(qn));
}

import { createFormatPrepper as e, instantConfig as t, dateTimeConfig as n, dateConfig as o, timeConfig as r, yearMonthConfig as a, monthDayConfig as i, zonedConfig as s, requireStringOrUndefined as l, requireIntegerOrUndefined as c, requireInteger as u, requirePositiveInteger as d, requireBoolean as f, requireString as m, requirePositiveIntegerOrUndefined as S, createGetterDescriptors as O, mapProps as T, createPropDescriptors as p, createStringTagDescriptors as h, createNameDescriptors as D, invalidCallingContext as P, hasAllPropsByName as C, invalidProtocol as g, invalidBag as Z, mapPropNames as b, durationFieldNamesAsc as F, getId as I, createPlainDateSlots as v, timeFieldNamesAsc as w, isoTimeFieldNamesAsc as j, getEpochSec as M, getEpochMilli as y, getEpochMicro as N, getEpochNano as B, createNativeStandardOps as Y, forbiddenValueOf as A, bindArgs as E, excludePropsByName as V, PlainDateBranding as J, PlainYearMonthBranding as L, PlainMonthDayBranding as q, plainMonthDayWithFields as k, plainMonthDaysEqual as x, plainMonthDayToPlainDate as R, formatPlainMonthDayIso as W, constructPlainMonthDaySlots as G, copyOptions as U, isObjectLike as z, refineOverflowOptions as H, refinePlainMonthDayBag as K, parsePlainMonthDay as Q, isoCalendarId as X, requireFunction as $, createInstantSlots as _, createPlainDateTimeSlots as ee, compareBigNanos as te, validateTimeZoneGap as ne, bigNanoToNumber as oe, diffBigNanos as re, validateTimeZoneOffset as ae, queryNativeTimeZone as ie, moveInstant as se, diffInstants as le, roundInstant as ce, instantsEqual as ue, requireObjectLike as de, instantToZonedDateTime as fe, formatInstantIso as me, constructInstantSlots as Se, InstantBranding as Oe, ZonedDateTimeBranding as Te, parseInstant as pe, numberToBigNano as he, epochSecToInstant as De, epochMilliToInstant as Pe, epochMicroToInstant as Ce, epochNanoToInstant as ge, compareInstants as Ze, nanoInMilli as be, formatOffsetNano as Fe, epochNanoToIso as Ie, refineEpochDisambigOptions as ve, getSingleInstantFor as we, isTimeZoneSlotsEqual as je, refineTimeZoneId as Me, resolveTimeZoneId as ye, parseTimeZoneId as Ne, plainTimeWithFields as Be, movePlainTime as Ye, diffPlainTimes as Ae, roundPlainTime as Ee, plainTimesEqual as Ve, plainTimeToZonedDateTime as Je, plainTimeToPlainDateTime as Le, formatPlainTimeIso as qe, constructPlainTimeSlots as ke, PlainTimeBranding as xe, zonedDateTimeToPlainTime as Re, PlainDateTimeBranding as We, createPlainTimeSlots as Ge, refinePlainTimeBag as Ue, parsePlainTime as ze, compareIsoTimeFields as He, plainYearMonthWithFields as Ke, movePlainYearMonth as Qe, diffPlainYearMonth as Xe, plainYearMonthsEqual as $e, plainYearMonthToPlainDate as _e, formatPlainYearMonthIso as et, constructPlainYearMonthSlots as tt, refinePlainYearMonthBag as nt, parsePlainYearMonth as ot, compareIsoDateFields as rt, plainDateTimeWithFields as at, slotsWithCalendar as it, plainDateTimeWithPlainDate as st, plainDateTimeWithPlainTime as lt, movePlainDateTime as ct, diffPlainDateTimes as ut, roundPlainDateTime as dt, plainDateTimesEqual as ft, plainDateTimeToZonedDateTime as mt, plainDateTimeToPlainYearMonth as St, plainDateTimeToPlainMonthDay as Ot, formatPlainDateTimeIso as Tt, constructPlainDateTimeSlots as pt, zonedDateTimeToPlainDateTime as ht, isoTimeFieldDefaults as Dt, refinePlainDateTimeBag as Pt, parsePlainDateTime as Ct, compareIsoDateTimeFields as gt, plainDateWithFields as Zt, movePlainDate as bt, diffPlainDates as Ft, plainDatesEqual as It, plainDateToZonedDateTime as vt, plainDateToPlainDateTime as wt, plainDateToPlainYearMonth as jt, plainDateToPlainMonthDay as Mt, formatPlainDateIso as yt, constructPlainDateSlots as Nt, zonedDateTimeToPlainDate as Bt, refinePlainDateBag as Yt, parsePlainDate as At, unitNamesAsc as Et, createDurationSlots as Vt, getDurationBlank as Jt, constructDurationSlots as Lt, DurationBranding as qt, durationWithFields as kt, negateDuration as xt, absDuration as Rt, addDurations as Wt, roundDuration as Gt, totalDuration as Ut, formatDurationIso as zt, refineDurationBag as Ht, parseDuration as Kt, refineMaybeZonedDateTimeBag as Qt, parseRelativeToSlots as Xt, compareDurations as $t, refineDateDiffOptions as _t, dateFieldNamesAlpha as en, forbiddenField as tn, excludeUndefinedProps as nn, requireNonNullish as on, refineCalendarId as rn, resolveCalendarId as an, parseCalendarId as sn, getRequiredDateFields as ln, getRequiredMonthDayFields as cn, getRequiredYearMonthFields as un, computeZonedHoursInDay as dn, zonedEpochSlotsToIso as fn, buildZonedIsoFields as mn, zonedDateTimeWithFields as Sn, slotsWithTimeZone as On, zonedDateTimeWithPlainDate as Tn, zonedDateTimeWithPlainTime as pn, moveZonedDateTime as hn, diffZonedDateTimes as Dn, roundZonedDateTime as Pn, computeZonedStartOfDay as Cn, zonedDateTimesEqual as gn, zonedDateTimeToInstant as Zn, zonedDateTimeToPlainYearMonth as bn, zonedDateTimeToPlainMonthDay as Fn, formatZonedDateTimeIso as In, constructZonedDateTimeSlots as vn, refineZonedFieldOptions as wn, refineZonedDateTimeBag as jn, parseZonedDateTime as Mn, compareZonedDateTimes as yn, getCurrentTimeZoneId as Nn, getCurrentEpochNano as Bn, createZonedDateTimeSlots as Yn, getCurrentIsoDateTime as An, RawDateTimeFormat as En, pluckProps as Vn, memoize as Jn, invalidFormatType as Ln, createFormatForPrep as qn, mismatchingFormatTypes as kn } from "./internal.js";

const xn = {
  Instant: t,
  PlainDateTime: n,
  PlainDate: o,
  PlainTime: r,
  PlainYearMonth: a,
  PlainMonthDay: i
}, Rn = /*@__PURE__*/ e(t), Wn = /*@__PURE__*/ e(s), Gn = /*@__PURE__*/ e(n), Un = /*@__PURE__*/ e(o), zn = /*@__PURE__*/ e(r), Hn = /*@__PURE__*/ e(a), Kn = /*@__PURE__*/ e(i), Qn = {
  era: l,
  eraYear: c,
  year: u,
  month: d,
  daysInMonth: d,
  daysInYear: d,
  inLeapYear: f,
  monthsInYear: d
}, Xn = {
  monthCode: m
}, $n = {
  day: d
}, _n = {
  dayOfWeek: d,
  dayOfYear: d,
  weekOfYear: S,
  yearOfWeek: c,
  daysInWeek: d
}, eo = /*@__PURE__*/ Object.assign({}, Qn, Xn, $n, _n), to = /*@__PURE__*/ new WeakMap, no = /*@__PURE__*/ to.get.bind(to), oo = /*@__PURE__*/ to.set.bind(to), ro = {
  ...createCalendarFieldMethods(Qn, [ L ]),
  ...createCalendarFieldMethods(_n, []),
  ...createCalendarFieldMethods(Xn, [ L, q ]),
  ...createCalendarFieldMethods($n, [ q ])
}, ao = /*@__PURE__*/ createCalendarGetters(eo), io = /*@__PURE__*/ createCalendarGetters({
  ...Qn,
  ...Xn
}), so = /*@__PURE__*/ createCalendarGetters({
  ...Xn,
  ...$n
}), lo = {
  calendarId: e => I(e.calendar)
}, co = /*@__PURE__*/ T(((e, t) => function(n) {
  const {i: o} = this;
  return e(o[t](Yo(v(n, o))));
}), eo), uo = /*@__PURE__*/ b((e => t => t[e]), F.concat("sign")), fo = /*@__PURE__*/ b(((e, t) => e => e[j[t]]), w), mo = {
  epochSeconds: M,
  epochMilliseconds: y,
  epochMicroseconds: N,
  epochNanoseconds: B
}, So = /*@__PURE__*/ E(V, new Set([ "branding" ])), [Oo, To, po] = createSlotClass(q, E(G, refineCalendarSlot), {
  ...lo,
  ...so
}, {
  getISOFields: So,
  getCalendar: createCalendarFromSlots,
  with(e, t, n) {
    return To(k(_o, e, this, rejectInvalidBag(t), n));
  },
  equals: (e, t) => x(e, toPlainMonthDaySlots(t)),
  toPlainDate(e, t) {
    return Yo(R($o, e, this, t));
  },
  toLocaleString(e, t, n) {
    const [o, r] = Kn(t, n, e);
    return o.format(r);
  },
  toString: W,
  toJSON: e => W(e),
  valueOf: neverValueOf
}, {
  from: (e, t) => To(toPlainMonthDaySlots(e, t))
}), ho = {
  getOffsetNanosecondsFor: getOffsetNanosecondsForAdapter,
  getPossibleInstantsFor(e, t, n) {
    const o = [ ...t.call(e, No(ee(n, X))) ].map((e => go(e).epochNanoseconds)), r = o.length;
    return r > 1 && (o.sort(te), ne(oe(re(o[0], o[r - 1])))), o;
  }
}, Do = {
  getOffsetNanosecondsFor: getOffsetNanosecondsForAdapter
}, [Po, Co, go] = createSlotClass(Oe, Se, mo, {
  add: (e, t) => Co(se(0, e, toDurationSlots(t))),
  subtract: (e, t) => Co(se(1, e, toDurationSlots(t))),
  until: (e, t, n) => ar(le(0, e, toInstantSlots(t), n)),
  since: (e, t, n) => ar(le(1, e, toInstantSlots(t), n)),
  round: (e, t) => Co(ce(e, t)),
  equals: (e, t) => ue(e, toInstantSlots(t)),
  toZonedDateTime(e, t) {
    const n = de(t);
    return dr(fe(e, refineTimeZoneSlot(n.timeZone), refineCalendarSlot(n.calendar)));
  },
  toZonedDateTimeISO: (e, t) => dr(fe(e, refineTimeZoneSlot(t))),
  toLocaleString(e, t, n) {
    const [o, r] = Rn(t, n, e);
    return o.format(r);
  },
  toString: (e, t) => me(refineTimeZoneSlot, createTimeZoneOffsetOps, e, t),
  toJSON: e => me(refineTimeZoneSlot, createTimeZoneOffsetOps, e),
  valueOf: neverValueOf
}, {
  from: e => Co(toInstantSlots(e)),
  fromEpochSeconds: e => Co(De(e)),
  fromEpochMilliseconds: e => Co(Pe(e)),
  fromEpochMicroseconds: e => Co(Ce(e)),
  fromEpochNanoseconds: e => Co(ge(e)),
  compare: (e, t) => Ze(toInstantSlots(e), toInstantSlots(t))
}), [Zo, bo] = createSlotClass("TimeZone", (e => {
  const t = Me(e);
  return {
    branding: "TimeZone",
    id: t,
    o: ie(t)
  };
}), {
  id: e => e.id
}, {
  getPossibleInstantsFor: ({o: e}, t) => e.getPossibleInstantsFor(toPlainDateTimeSlots(t)).map((e => Co(_(e)))),
  getOffsetNanosecondsFor: ({o: e}, t) => e.getOffsetNanosecondsFor(toInstantSlots(t).epochNanoseconds),
  getOffsetStringFor(e, t) {
    const n = toInstantSlots(t).epochNanoseconds, o = createAdapterOps(this, Do).getOffsetNanosecondsFor(n);
    return Fe(o);
  },
  getPlainDateTimeFor(e, t, n = X) {
    const o = toInstantSlots(t).epochNanoseconds, r = createAdapterOps(this, Do).getOffsetNanosecondsFor(o);
    return No(ee(Ie(o, r), refineCalendarSlot(n)));
  },
  getInstantFor(e, t, n) {
    const o = toPlainDateTimeSlots(t), r = ve(n), a = createAdapterOps(this);
    return Co(_(we(a, o, r)));
  },
  getNextTransition: ({o: e}, t) => getImplTransition(1, e, t),
  getPreviousTransition: ({o: e}, t) => getImplTransition(-1, e, t),
  equals(e, t) {
    return !!je(this, refineTimeZoneSlot(t));
  },
  toString: e => e.id,
  toJSON: e => e.id
}, {
  from(e) {
    const t = refineTimeZoneSlot(e);
    return "string" == typeof t ? new Zo(t) : t;
  }
}), Fo = /*@__PURE__*/ createProtocolValidator(Object.keys(ho)), [Io, vo] = createSlotClass(xe, ke, fo, {
  getISOFields: So,
  with(e, t, n) {
    return vo(Be(this, rejectInvalidBag(t), n));
  },
  add: (e, t) => vo(Ye(0, e, toDurationSlots(t))),
  subtract: (e, t) => vo(Ye(1, e, toDurationSlots(t))),
  until: (e, t, n) => ar(Ae(0, e, toPlainTimeSlots(t), n)),
  since: (e, t, n) => ar(Ae(1, e, toPlainTimeSlots(t), n)),
  round: (e, t) => vo(Ee(e, t)),
  equals: (e, t) => Ve(e, toPlainTimeSlots(t)),
  toZonedDateTime: (e, t) => dr(Je(refineTimeZoneSlot, toPlainDateSlots, createTimeZoneOps, e, t)),
  toPlainDateTime: (e, t) => No(Le(e, toPlainDateSlots(t))),
  toLocaleString(e, t, n) {
    const [o, r] = zn(t, n, e);
    return o.format(r);
  },
  toString: qe,
  toJSON: e => qe(e),
  valueOf: neverValueOf
}, {
  from: (e, t) => vo(toPlainTimeSlots(e, t)),
  compare: (e, t) => He(toPlainTimeSlots(e), toPlainTimeSlots(t))
}), [wo, jo, Mo] = createSlotClass(L, E(tt, refineCalendarSlot), {
  ...lo,
  ...io
}, {
  getISOFields: So,
  getCalendar: createCalendarFromSlots,
  with(e, t, n) {
    return jo(Ke(Xo, e, this, rejectInvalidBag(t), n));
  },
  add: (e, t, n) => jo(Qe(nr, 0, e, toDurationSlots(t), n)),
  subtract: (e, t, n) => jo(Qe(nr, 1, e, toDurationSlots(t), n)),
  until: (e, t, n) => ar(Xe(or, 0, e, toPlainYearMonthSlots(t), n)),
  since: (e, t, n) => ar(Xe(or, 1, e, toPlainYearMonthSlots(t), n)),
  equals: (e, t) => $e(e, toPlainYearMonthSlots(t)),
  toPlainDate(e, t) {
    return Yo(_e($o, e, this, t));
  },
  toLocaleString(e, t, n) {
    const [o, r] = Hn(t, n, e);
    return o.format(r);
  },
  toString: et,
  toJSON: e => et(e),
  valueOf: neverValueOf
}, {
  from: (e, t) => jo(toPlainYearMonthSlots(e, t)),
  compare: (e, t) => rt(toPlainYearMonthSlots(e), toPlainYearMonthSlots(t))
}), [yo, No] = createSlotClass(We, E(pt, refineCalendarSlot), {
  ...lo,
  ...ao,
  ...fo
}, {
  getISOFields: So,
  getCalendar: createCalendarFromSlots,
  with(e, t, n) {
    return No(at($o, e, this, rejectInvalidBag(t), n));
  },
  withCalendar: (e, t) => No(it(e, refineCalendarSlot(t))),
  withPlainDate: (e, t) => No(st(e, toPlainDateSlots(t))),
  withPlainTime: (e, t) => No(lt(e, optionalToPlainTimeFields(t))),
  add: (e, t, n) => No(ct(er, 0, e, toDurationSlots(t), n)),
  subtract: (e, t, n) => No(ct(er, 1, e, toDurationSlots(t), n)),
  until: (e, t, n) => ar(ut(tr, 0, e, toPlainDateTimeSlots(t), n)),
  since: (e, t, n) => ar(ut(tr, 1, e, toPlainDateTimeSlots(t), n)),
  round: (e, t) => No(dt(e, t)),
  equals: (e, t) => ft(e, toPlainDateTimeSlots(t)),
  toZonedDateTime: (e, t, n) => dr(mt(createTimeZoneOps, e, refineTimeZoneSlot(t), n)),
  toPlainDate: e => Yo(v(e)),
  toPlainTime: e => vo(Ge(e)),
  toPlainYearMonth(e) {
    return jo(St(Ho, e, this));
  },
  toPlainMonthDay(e) {
    return To(Ot(Qo, e, this));
  },
  toLocaleString(e, t, n) {
    const [o, r] = Gn(t, n, e);
    return o.format(r);
  },
  toString: Tt,
  toJSON: e => Tt(e),
  valueOf: neverValueOf
}, {
  from: (e, t) => No(toPlainDateTimeSlots(e, t)),
  compare: (e, t) => gt(toPlainDateTimeSlots(e), toPlainDateTimeSlots(t))
}), [Bo, Yo, Ao] = createSlotClass(J, E(Nt, refineCalendarSlot), {
  ...lo,
  ...ao
}, {
  getISOFields: So,
  getCalendar: createCalendarFromSlots,
  with(e, t, n) {
    return Yo(Zt($o, e, this, rejectInvalidBag(t), n));
  },
  withCalendar: (e, t) => Yo(it(e, refineCalendarSlot(t))),
  add: (e, t, n) => Yo(bt(er, 0, e, toDurationSlots(t), n)),
  subtract: (e, t, n) => Yo(bt(er, 1, e, toDurationSlots(t), n)),
  until: (e, t, n) => ar(Ft(tr, 0, e, toPlainDateSlots(t), n)),
  since: (e, t, n) => ar(Ft(tr, 1, e, toPlainDateSlots(t), n)),
  equals: (e, t) => It(e, toPlainDateSlots(t)),
  toZonedDateTime(e, t) {
    const n = !z(t) || t instanceof Zo ? {
      timeZone: t
    } : t;
    return dr(vt(refineTimeZoneSlot, toPlainTimeSlots, createTimeZoneOps, e, n));
  },
  toPlainDateTime: (e, t) => No(wt(e, optionalToPlainTimeFields(t))),
  toPlainYearMonth(e) {
    return jo(jt(Ho, e, this));
  },
  toPlainMonthDay(e) {
    return To(Mt(Qo, e, this));
  },
  toLocaleString(e, t, n) {
    const [o, r] = Un(t, n, e);
    return o.format(r);
  },
  toString: yt,
  toJSON: e => yt(e),
  valueOf: neverValueOf
}, {
  from: (e, t) => Yo(toPlainDateSlots(e, t)),
  compare: (e, t) => rt(toPlainDateSlots(e), toPlainDateSlots(t))
}), Eo = {
  fields(e, t, n) {
    return [ ...t.call(e, n) ];
  }
}, Vo = /*@__PURE__*/ Object.assign({
  dateFromFields(e, t, n, o) {
    return Ao(t.call(e, Object.assign(Object.create(null), n), o));
  }
}, Eo), Jo = /*@__PURE__*/ Object.assign({
  yearMonthFromFields(e, t, n, o) {
    return Mo(t.call(e, Object.assign(Object.create(null), n), o));
  }
}, Eo), Lo = /*@__PURE__*/ Object.assign({
  monthDayFromFields(e, t, n, o) {
    return po(t.call(e, Object.assign(Object.create(null), n), o));
  }
}, Eo), qo = {
  mergeFields(e, t, n, o) {
    return de(t.call(e, Object.assign(Object.create(null), n), Object.assign(Object.create(null), o)));
  }
}, ko = /*@__PURE__*/ Object.assign({}, Vo, qo), xo = /*@__PURE__*/ Object.assign({}, Jo, qo), Ro = /*@__PURE__*/ Object.assign({}, Lo, qo), Wo = {
  dateAdd(e, t, n, o, r) {
    return Ao(t.call(e, Yo(v(n, e)), ar(Vt(o)), r));
  }
}, Go = /*@__PURE__*/ Object.assign({}, Wo, {
  dateUntil(e, t, n, o, r, a) {
    return ir(t.call(e, Yo(v(n, e)), Yo(v(o, e)), Object.assign(Object.create(null), a, {
      largestUnit: Et[r]
    })));
  }
}), Uo = /*@__PURE__*/ Object.assign({}, Wo, {
  day: dayAdapter
}), zo = /*@__PURE__*/ Object.assign({}, Go, {
  day: dayAdapter
}), Ho = /*@__PURE__*/ createCompoundOpsCreator(Jo), Ko = /*@__PURE__*/ createCompoundOpsCreator(Vo), Qo = /*@__PURE__*/ createCompoundOpsCreator(Lo), Xo = /*@__PURE__*/ createCompoundOpsCreator(xo), $o = /*@__PURE__*/ createCompoundOpsCreator(ko), _o = /*@__PURE__*/ createCompoundOpsCreator(Ro), er = /*@__PURE__*/ createCompoundOpsCreator(Wo), tr = /*@__PURE__*/ createCompoundOpsCreator(Go), nr = /*@__PURE__*/ createCompoundOpsCreator(Uo), or = /*@__PURE__*/ createCompoundOpsCreator(zo), [rr, ar, ir] = createSlotClass(qt, Lt, {
  ...uo,
  blank: Jt
}, {
  with: (e, t) => ar(kt(e, t)),
  negated: e => ar(xt(e)),
  abs: e => ar(Rt(e)),
  add: (e, t, n) => ar(Wt(refinePublicRelativeTo, tr, createTimeZoneOps, 0, e, toDurationSlots(t), n)),
  subtract: (e, t, n) => ar(Wt(refinePublicRelativeTo, tr, createTimeZoneOps, 1, e, toDurationSlots(t), n)),
  round: (e, t) => ar(Gt(refinePublicRelativeTo, tr, createTimeZoneOps, e, t)),
  total: (e, t) => Ut(refinePublicRelativeTo, tr, createTimeZoneOps, e, t),
  toLocaleString(e, t, n) {
    return Intl.DurationFormat ? new Intl.DurationFormat(t, n).format(this) : zt(e);
  },
  toString: zt,
  toJSON: e => zt(e),
  valueOf: neverValueOf
}, {
  from: e => ar(toDurationSlots(e)),
  compare: (e, t, n) => $t(refinePublicRelativeTo, er, createTimeZoneOps, toDurationSlots(e), toDurationSlots(t), n)
}), sr = {
  toString: e => e.id,
  toJSON: e => e.id,
  ...ro,
  dateAdd: ({id: e, o: t}, n, o, r) => Yo(v(t.dateAdd(toPlainDateSlots(n), toDurationSlots(o), r), e)),
  dateUntil: ({o: e}, t, n, o) => ar(Vt(e.dateUntil(toPlainDateSlots(t), toPlainDateSlots(n), _t(o)))),
  dateFromFields: ({id: e, o: t}, n, o) => Yo(Yt(t, n, o, ln(e))),
  yearMonthFromFields: ({id: e, o: t}, n, o) => jo(nt(t, n, o, un(e))),
  monthDayFromFields: ({id: e, o: t}, n, o) => To(K(t, 0, n, o, cn(e))),
  fields({o: e}, t) {
    const n = new Set(en), o = [];
    for (const e of t) {
      if (m(e), !n.has(e)) {
        throw new RangeError(tn(e));
      }
      n.delete(e), o.push(e);
    }
    return e.fields(o);
  },
  mergeFields: ({o: e}, t, n) => e.mergeFields(nn(on(t)), nn(on(n)))
}, [lr] = createSlotClass("Calendar", (e => {
  const t = rn(e);
  return {
    branding: "Calendar",
    id: t,
    o: Y(t)
  };
}), {
  id: e => e.id
}, sr, {
  from(e) {
    const t = refineCalendarSlot(e);
    return "string" == typeof t ? new lr(t) : t;
  }
}), cr = /*@__PURE__*/ createProtocolValidator(Object.keys(sr).slice(4)), [ur, dr] = createSlotClass(Te, E(vn, refineCalendarSlot, refineTimeZoneSlot), {
  ...mo,
  ...lo,
  ...adaptDateMethods(ao),
  ...adaptDateMethods(fo),
  offset: e => Fe(slotsToIso(e).offsetNanoseconds),
  offsetNanoseconds: e => slotsToIso(e).offsetNanoseconds,
  timeZoneId: e => I(e.timeZone),
  hoursInDay: e => dn(createTimeZoneOps, e)
}, {
  getISOFields: e => mn(createTimeZoneOffsetOps, e),
  getCalendar: createCalendarFromSlots,
  getTimeZone: ({timeZone: e}) => "string" == typeof e ? new Zo(e) : e,
  with(e, t, n) {
    return dr(Sn($o, createTimeZoneOps, e, this, rejectInvalidBag(t), n));
  },
  withCalendar: (e, t) => dr(it(e, refineCalendarSlot(t))),
  withTimeZone: (e, t) => dr(On(e, refineTimeZoneSlot(t))),
  withPlainDate: (e, t) => dr(Tn(createTimeZoneOps, e, toPlainDateSlots(t))),
  withPlainTime: (e, t) => dr(pn(createTimeZoneOps, e, optionalToPlainTimeFields(t))),
  add: (e, t, n) => dr(hn(er, createTimeZoneOps, 0, e, toDurationSlots(t), n)),
  subtract: (e, t, n) => dr(hn(er, createTimeZoneOps, 1, e, toDurationSlots(t), n)),
  until: (e, t, n) => ar(Vt(Dn(tr, createTimeZoneOps, 0, e, toZonedDateTimeSlots(t), n))),
  since: (e, t, n) => ar(Vt(Dn(tr, createTimeZoneOps, 1, e, toZonedDateTimeSlots(t), n))),
  round: (e, t) => dr(Pn(createTimeZoneOps, e, t)),
  startOfDay: e => dr(Cn(createTimeZoneOps, e)),
  equals: (e, t) => gn(e, toZonedDateTimeSlots(t)),
  toInstant: e => Co(Zn(e)),
  toPlainDateTime: e => No(ht(createTimeZoneOffsetOps, e)),
  toPlainDate: e => Yo(Bt(createTimeZoneOffsetOps, e)),
  toPlainTime: e => vo(Re(createTimeZoneOffsetOps, e)),
  toPlainYearMonth(e) {
    return jo(bn(Ho, e, this));
  },
  toPlainMonthDay(e) {
    return To(Fn(Qo, e, this));
  },
  toLocaleString(e, t, n = {}) {
    const [o, r] = Wn(t, n, e);
    return o.format(r);
  },
  toString: (e, t) => In(createTimeZoneOffsetOps, e, t),
  toJSON: e => In(createTimeZoneOffsetOps, e),
  valueOf: neverValueOf
}, {
  from: (e, t) => dr(toZonedDateTimeSlots(e, t)),
  compare: (e, t) => yn(toZonedDateTimeSlots(e), toZonedDateTimeSlots(t))
}), fr = /*@__PURE__*/ Object.defineProperties({}, {
  ...h("Temporal.Now"),
  ...p({
    timeZoneId: () => Nn(),
    instant: () => Co(_(Bn())),
    zonedDateTime: (e, t = Nn()) => dr(Yn(Bn(), refineTimeZoneSlot(t), refineCalendarSlot(e))),
    zonedDateTimeISO: (e = Nn()) => dr(Yn(Bn(), refineTimeZoneSlot(e), X)),
    plainDateTime: (e, t = Nn()) => No(ee(An(createTimeZoneOffsetOps(refineTimeZoneSlot(t))), refineCalendarSlot(e))),
    plainDateTimeISO: (e = Nn()) => No(ee(An(createTimeZoneOffsetOps(refineTimeZoneSlot(e))), X)),
    plainDate: (e, t = Nn()) => Yo(v(An(createTimeZoneOffsetOps(refineTimeZoneSlot(t))), refineCalendarSlot(e))),
    plainDateISO: (e = Nn()) => Yo(v(An(createTimeZoneOffsetOps(refineTimeZoneSlot(e))), X)),
    plainTimeISO: (e = Nn()) => vo(Ge(An(createTimeZoneOffsetOps(refineTimeZoneSlot(e)))))
  })
}), mr = /*@__PURE__*/ Object.defineProperties({}, {
  ...h("Temporal"),
  ...p({
    PlainYearMonth: wo,
    PlainMonthDay: Oo,
    PlainDate: Bo,
    PlainTime: Io,
    PlainDateTime: yo,
    ZonedDateTime: ur,
    Instant: Po,
    Calendar: lr,
    TimeZone: Zo,
    Duration: rr,
    Now: fr
  })
}), Sr = /*@__PURE__*/ createDateTimeFormatClass(), Or = /*@__PURE__*/ new WeakMap, Tr = /*@__PURE__*/ Object.defineProperties(Object.create(Intl), p({
  DateTimeFormat: Sr
}));

export { Sr as DateTimeFormat, Tr as IntlExtended, mr as Temporal, toTemporalInstant };
