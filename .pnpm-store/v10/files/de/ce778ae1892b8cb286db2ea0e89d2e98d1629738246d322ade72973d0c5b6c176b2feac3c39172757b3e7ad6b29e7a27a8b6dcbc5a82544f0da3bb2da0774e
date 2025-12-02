/**
 * @license lucide-react v0.522.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react')) :
  typeof define === 'function' && define.amd ? define(['exports', 'react'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.LucideReact = {}, global.react));
})(this, (function (exports, react) { 'use strict';

  const toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const toCamelCase = (string) => string.replace(
    /^([A-Z])|[\s-_]+(\w)/g,
    (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
  );
  const toPascalCase = (string) => {
    const camelCase = toCamelCase(string);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  };
  const mergeClasses = (...classes) => classes.filter((className, index, array) => {
    return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
  }).join(" ").trim();
  const hasA11yProp = (props) => {
    for (const prop in props) {
      if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
        return true;
      }
    }
  };

  var defaultAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };

  const Icon = react.forwardRef(
    ({
      color = "currentColor",
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth,
      className = "",
      children,
      iconNode,
      ...rest
    }, ref) => react.createElement(
      "svg",
      {
        ref,
        ...defaultAttributes,
        width: size,
        height: size,
        stroke: color,
        strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
        className: mergeClasses("lucide", className),
        ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
        ...rest
      },
      [
        ...iconNode.map(([tag, attrs]) => react.createElement(tag, attrs)),
        ...Array.isArray(children) ? children : [children]
      ]
    )
  );

  const createLucideIcon = (iconName, iconNode) => {
    const Component = react.forwardRef(
      ({ className, ...props }, ref) => react.createElement(Icon, {
        ref,
        iconNode,
        className: mergeClasses(
          `lucide-${toKebabCase(toPascalCase(iconName))}`,
          `lucide-${iconName}`,
          className
        ),
        ...props
      })
    );
    Component.displayName = toPascalCase(iconName);
    return Component;
  };

  const __iconNode$p7 = [
    ["path", { d: "M3.5 13h6", key: "p1my2r" }],
    ["path", { d: "m2 16 4.5-9 4.5 9", key: "ndf0b3" }],
    ["path", { d: "M18 7v9", key: "pknjwm" }],
    ["path", { d: "m14 12 4 4 4-4", key: "buelq4" }]
  ];
  const AArrowDown = createLucideIcon("a-arrow-down", __iconNode$p7);

  const __iconNode$p6 = [
    ["path", { d: "M3.5 13h6", key: "p1my2r" }],
    ["path", { d: "m2 16 4.5-9 4.5 9", key: "ndf0b3" }],
    ["path", { d: "M18 16V7", key: "ty0viw" }],
    ["path", { d: "m14 11 4-4 4 4", key: "1pu57t" }]
  ];
  const AArrowUp = createLucideIcon("a-arrow-up", __iconNode$p6);

  const __iconNode$p5 = [
    ["path", { d: "M21 14h-5", key: "1vh23k" }],
    ["path", { d: "M16 16v-3.5a2.5 2.5 0 0 1 5 0V16", key: "1wh10o" }],
    ["path", { d: "M4.5 13h6", key: "dfilno" }],
    ["path", { d: "m3 16 4.5-9 4.5 9", key: "2dxa0e" }]
  ];
  const ALargeSmall = createLucideIcon("a-large-small", __iconNode$p5);

  const __iconNode$p4 = [
    [
      "path",
      {
        d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2",
        key: "169zse"
      }
    ]
  ];
  const Activity = createLucideIcon("activity", __iconNode$p4);

  const __iconNode$p3 = [
    ["circle", { cx: "16", cy: "4", r: "1", key: "1grugj" }],
    ["path", { d: "m18 19 1-7-6 1", key: "r0i19z" }],
    ["path", { d: "m5 8 3-3 5.5 3-2.36 3.5", key: "9ptxx2" }],
    ["path", { d: "M4.24 14.5a5 5 0 0 0 6.88 6", key: "10kmtu" }],
    ["path", { d: "M13.76 17.5a5 5 0 0 0-6.88-6", key: "2qq6rc" }]
  ];
  const Accessibility = createLucideIcon("accessibility", __iconNode$p3);

  const __iconNode$p2 = [
    ["path", { d: "M18 17.5a2.5 2.5 0 1 1-4 2.03V12", key: "yd12zl" }],
    [
      "path",
      {
        d: "M6 12H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",
        key: "larmp2"
      }
    ],
    ["path", { d: "M6 8h12", key: "6g4wlu" }],
    ["path", { d: "M6.6 15.572A2 2 0 1 0 10 17v-5", key: "1x1kqn" }]
  ];
  const AirVent = createLucideIcon("air-vent", __iconNode$p2);

  const __iconNode$p1 = [
    [
      "path",
      {
        d: "M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1",
        key: "ns4c3b"
      }
    ],
    ["path", { d: "m12 15 5 6H7Z", key: "14qnn2" }]
  ];
  const Airplay = createLucideIcon("airplay", __iconNode$p1);

  const __iconNode$p0 = [
    ["circle", { cx: "12", cy: "13", r: "8", key: "3y4lt7" }],
    ["path", { d: "M5 3 2 6", key: "18tl5t" }],
    ["path", { d: "m22 6-3-3", key: "1opdir" }],
    ["path", { d: "M6.38 18.7 4 21", key: "17xu3x" }],
    ["path", { d: "M17.64 18.67 20 21", key: "kv2oe2" }],
    ["path", { d: "m9 13 2 2 4-4", key: "6343dt" }]
  ];
  const AlarmClockCheck = createLucideIcon("alarm-clock-check", __iconNode$p0);

  const __iconNode$o$ = [
    ["circle", { cx: "12", cy: "13", r: "8", key: "3y4lt7" }],
    ["path", { d: "M5 3 2 6", key: "18tl5t" }],
    ["path", { d: "m22 6-3-3", key: "1opdir" }],
    ["path", { d: "M6.38 18.7 4 21", key: "17xu3x" }],
    ["path", { d: "M17.64 18.67 20 21", key: "kv2oe2" }],
    ["path", { d: "M9 13h6", key: "1uhe8q" }]
  ];
  const AlarmClockMinus = createLucideIcon("alarm-clock-minus", __iconNode$o$);

  const __iconNode$o_ = [
    ["circle", { cx: "12", cy: "13", r: "8", key: "3y4lt7" }],
    ["path", { d: "M5 3 2 6", key: "18tl5t" }],
    ["path", { d: "m22 6-3-3", key: "1opdir" }],
    ["path", { d: "M6.38 18.7 4 21", key: "17xu3x" }],
    ["path", { d: "M17.64 18.67 20 21", key: "kv2oe2" }],
    ["path", { d: "M12 10v6", key: "1bos4e" }],
    ["path", { d: "M9 13h6", key: "1uhe8q" }]
  ];
  const AlarmClockPlus = createLucideIcon("alarm-clock-plus", __iconNode$o_);

  const __iconNode$oZ = [
    ["path", { d: "M6.87 6.87a8 8 0 1 0 11.26 11.26", key: "3on8tj" }],
    ["path", { d: "M19.9 14.25a8 8 0 0 0-9.15-9.15", key: "15ghsc" }],
    ["path", { d: "m22 6-3-3", key: "1opdir" }],
    ["path", { d: "M6.26 18.67 4 21", key: "yzmioq" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M4 4 2 6", key: "1ycko6" }]
  ];
  const AlarmClockOff = createLucideIcon("alarm-clock-off", __iconNode$oZ);

  const __iconNode$oY = [
    ["circle", { cx: "12", cy: "13", r: "8", key: "3y4lt7" }],
    ["path", { d: "M12 9v4l2 2", key: "1c63tq" }],
    ["path", { d: "M5 3 2 6", key: "18tl5t" }],
    ["path", { d: "m22 6-3-3", key: "1opdir" }],
    ["path", { d: "M6.38 18.7 4 21", key: "17xu3x" }],
    ["path", { d: "M17.64 18.67 20 21", key: "kv2oe2" }]
  ];
  const AlarmClock = createLucideIcon("alarm-clock", __iconNode$oY);

  const __iconNode$oX = [
    ["path", { d: "M11 21c0-2.5 2-2.5 2-5", key: "1sicvv" }],
    ["path", { d: "M16 21c0-2.5 2-2.5 2-5", key: "1o3eny" }],
    ["path", { d: "m19 8-.8 3a1.25 1.25 0 0 1-1.2 1H7a1.25 1.25 0 0 1-1.2-1L5 8", key: "1bvca4" }],
    [
      "path",
      { d: "M21 3a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1z", key: "x3qr1j" }
    ],
    ["path", { d: "M6 21c0-2.5 2-2.5 2-5", key: "i3w1gp" }]
  ];
  const AlarmSmoke = createLucideIcon("alarm-smoke", __iconNode$oX);

  const __iconNode$oW = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["polyline", { points: "11 3 11 11 14 8 17 11 17 3", key: "1wcwz3" }]
  ];
  const Album = createLucideIcon("album", __iconNode$oW);

  const __iconNode$oV = [
    ["path", { d: "M2 12h20", key: "9i4pu4" }],
    ["path", { d: "M10 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4", key: "11f1s0" }],
    ["path", { d: "M10 8V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4", key: "t14dx9" }],
    ["path", { d: "M20 16v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1", key: "1w07xs" }],
    ["path", { d: "M14 8V7c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2v1", key: "1apec2" }]
  ];
  const AlignCenterHorizontal = createLucideIcon("align-center-horizontal", __iconNode$oV);

  const __iconNode$oU = [
    ["path", { d: "M12 2v20", key: "t6zp3m" }],
    ["path", { d: "M8 10H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h4", key: "14d6g8" }],
    ["path", { d: "M16 10h4a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-4", key: "1e2lrw" }],
    ["path", { d: "M8 20H7a2 2 0 0 1-2-2v-2c0-1.1.9-2 2-2h1", key: "1fkdwx" }],
    ["path", { d: "M16 14h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1", key: "1euafb" }]
  ];
  const AlignCenterVertical = createLucideIcon("align-center-vertical", __iconNode$oU);

  const __iconNode$oT = [
    ["path", { d: "M17 12H7", key: "16if0g" }],
    ["path", { d: "M19 18H5", key: "18s9l3" }],
    ["path", { d: "M21 6H3", key: "1jwq7v" }]
  ];
  const AlignCenter = createLucideIcon("align-center", __iconNode$oT);

  const __iconNode$oS = [
    ["rect", { width: "6", height: "16", x: "4", y: "2", rx: "2", key: "z5wdxg" }],
    ["rect", { width: "6", height: "9", x: "14", y: "9", rx: "2", key: "um7a8w" }],
    ["path", { d: "M22 22H2", key: "19qnx5" }]
  ];
  const AlignEndHorizontal = createLucideIcon("align-end-horizontal", __iconNode$oS);

  const __iconNode$oR = [
    ["rect", { width: "16", height: "6", x: "2", y: "4", rx: "2", key: "10wcwx" }],
    ["rect", { width: "9", height: "6", x: "9", y: "14", rx: "2", key: "4p5bwg" }],
    ["path", { d: "M22 22V2", key: "12ipfv" }]
  ];
  const AlignEndVertical = createLucideIcon("align-end-vertical", __iconNode$oR);

  const __iconNode$oQ = [
    ["rect", { width: "6", height: "14", x: "4", y: "5", rx: "2", key: "1wwnby" }],
    ["rect", { width: "6", height: "10", x: "14", y: "7", rx: "2", key: "1fe6j6" }],
    ["path", { d: "M17 22v-5", key: "4b6g73" }],
    ["path", { d: "M17 7V2", key: "hnrr36" }],
    ["path", { d: "M7 22v-3", key: "1r4jpn" }],
    ["path", { d: "M7 5V2", key: "liy1u9" }]
  ];
  const AlignHorizontalDistributeCenter = createLucideIcon(
    "align-horizontal-distribute-center",
    __iconNode$oQ
  );

  const __iconNode$oP = [
    ["rect", { width: "6", height: "14", x: "4", y: "5", rx: "2", key: "1wwnby" }],
    ["rect", { width: "6", height: "10", x: "14", y: "7", rx: "2", key: "1fe6j6" }],
    ["path", { d: "M10 2v20", key: "uyc634" }],
    ["path", { d: "M20 2v20", key: "1tx262" }]
  ];
  const AlignHorizontalDistributeEnd = createLucideIcon(
    "align-horizontal-distribute-end",
    __iconNode$oP
  );

  const __iconNode$oO = [
    ["rect", { width: "6", height: "14", x: "4", y: "5", rx: "2", key: "1wwnby" }],
    ["rect", { width: "6", height: "10", x: "14", y: "7", rx: "2", key: "1fe6j6" }],
    ["path", { d: "M4 2v20", key: "gtpd5x" }],
    ["path", { d: "M14 2v20", key: "tg6bpw" }]
  ];
  const AlignHorizontalDistributeStart = createLucideIcon(
    "align-horizontal-distribute-start",
    __iconNode$oO
  );

  const __iconNode$oN = [
    ["rect", { width: "6", height: "14", x: "2", y: "5", rx: "2", key: "dy24zr" }],
    ["rect", { width: "6", height: "10", x: "16", y: "7", rx: "2", key: "13zkjt" }],
    ["path", { d: "M12 2v20", key: "t6zp3m" }]
  ];
  const AlignHorizontalJustifyCenter = createLucideIcon(
    "align-horizontal-justify-center",
    __iconNode$oN
  );

  const __iconNode$oM = [
    ["rect", { width: "6", height: "14", x: "2", y: "5", rx: "2", key: "dy24zr" }],
    ["rect", { width: "6", height: "10", x: "12", y: "7", rx: "2", key: "1ht384" }],
    ["path", { d: "M22 2v20", key: "40qfg1" }]
  ];
  const AlignHorizontalJustifyEnd = createLucideIcon("align-horizontal-justify-end", __iconNode$oM);

  const __iconNode$oL = [
    ["rect", { width: "6", height: "14", x: "6", y: "5", rx: "2", key: "hsirpf" }],
    ["rect", { width: "6", height: "10", x: "16", y: "7", rx: "2", key: "13zkjt" }],
    ["path", { d: "M2 2v20", key: "1ivd8o" }]
  ];
  const AlignHorizontalJustifyStart = createLucideIcon("align-horizontal-justify-start", __iconNode$oL);

  const __iconNode$oK = [
    ["rect", { width: "6", height: "10", x: "9", y: "7", rx: "2", key: "yn7j0q" }],
    ["path", { d: "M4 22V2", key: "tsjzd3" }],
    ["path", { d: "M20 22V2", key: "1bnhr8" }]
  ];
  const AlignHorizontalSpaceAround = createLucideIcon("align-horizontal-space-around", __iconNode$oK);

  const __iconNode$oJ = [
    ["path", { d: "M3 12h18", key: "1i2n21" }],
    ["path", { d: "M3 18h18", key: "1h113x" }],
    ["path", { d: "M3 6h18", key: "d0wm0j" }]
  ];
  const AlignJustify = createLucideIcon("align-justify", __iconNode$oJ);

  const __iconNode$oI = [
    ["path", { d: "M15 12H3", key: "6jk70r" }],
    ["path", { d: "M17 18H3", key: "1amg6g" }],
    ["path", { d: "M21 6H3", key: "1jwq7v" }]
  ];
  const AlignLeft = createLucideIcon("align-left", __iconNode$oI);

  const __iconNode$oH = [
    ["rect", { width: "6", height: "14", x: "3", y: "5", rx: "2", key: "j77dae" }],
    ["rect", { width: "6", height: "10", x: "15", y: "7", rx: "2", key: "bq30hj" }],
    ["path", { d: "M3 2v20", key: "1d2pfg" }],
    ["path", { d: "M21 2v20", key: "p059bm" }]
  ];
  const AlignHorizontalSpaceBetween = createLucideIcon("align-horizontal-space-between", __iconNode$oH);

  const __iconNode$oG = [
    ["path", { d: "M21 12H9", key: "dn1m92" }],
    ["path", { d: "M21 18H7", key: "1ygte8" }],
    ["path", { d: "M21 6H3", key: "1jwq7v" }]
  ];
  const AlignRight = createLucideIcon("align-right", __iconNode$oG);

  const __iconNode$oF = [
    ["rect", { width: "6", height: "16", x: "4", y: "6", rx: "2", key: "1n4dg1" }],
    ["rect", { width: "6", height: "9", x: "14", y: "6", rx: "2", key: "17khns" }],
    ["path", { d: "M22 2H2", key: "fhrpnj" }]
  ];
  const AlignStartHorizontal = createLucideIcon("align-start-horizontal", __iconNode$oF);

  const __iconNode$oE = [
    ["rect", { width: "9", height: "6", x: "6", y: "14", rx: "2", key: "lpm2y7" }],
    ["rect", { width: "16", height: "6", x: "6", y: "4", rx: "2", key: "rdj6ps" }],
    ["path", { d: "M2 2v20", key: "1ivd8o" }]
  ];
  const AlignStartVertical = createLucideIcon("align-start-vertical", __iconNode$oE);

  const __iconNode$oD = [
    ["path", { d: "M22 17h-3", key: "1lwga1" }],
    ["path", { d: "M22 7h-5", key: "o2endc" }],
    ["path", { d: "M5 17H2", key: "1gx9xc" }],
    ["path", { d: "M7 7H2", key: "6bq26l" }],
    ["rect", { x: "5", y: "14", width: "14", height: "6", rx: "2", key: "1qrzuf" }],
    ["rect", { x: "7", y: "4", width: "10", height: "6", rx: "2", key: "we8e9z" }]
  ];
  const AlignVerticalDistributeCenter = createLucideIcon(
    "align-vertical-distribute-center",
    __iconNode$oD
  );

  const __iconNode$oC = [
    ["rect", { width: "14", height: "6", x: "5", y: "14", rx: "2", key: "jmoj9s" }],
    ["rect", { width: "10", height: "6", x: "7", y: "4", rx: "2", key: "aza5on" }],
    ["path", { d: "M2 20h20", key: "owomy5" }],
    ["path", { d: "M2 10h20", key: "1ir3d8" }]
  ];
  const AlignVerticalDistributeEnd = createLucideIcon("align-vertical-distribute-end", __iconNode$oC);

  const __iconNode$oB = [
    ["rect", { width: "14", height: "6", x: "5", y: "14", rx: "2", key: "jmoj9s" }],
    ["rect", { width: "10", height: "6", x: "7", y: "4", rx: "2", key: "aza5on" }],
    ["path", { d: "M2 14h20", key: "myj16y" }],
    ["path", { d: "M2 4h20", key: "mda7wb" }]
  ];
  const AlignVerticalDistributeStart = createLucideIcon(
    "align-vertical-distribute-start",
    __iconNode$oB
  );

  const __iconNode$oA = [
    ["rect", { width: "14", height: "6", x: "5", y: "16", rx: "2", key: "1i8z2d" }],
    ["rect", { width: "10", height: "6", x: "7", y: "2", rx: "2", key: "ypihtt" }],
    ["path", { d: "M2 12h20", key: "9i4pu4" }]
  ];
  const AlignVerticalJustifyCenter = createLucideIcon("align-vertical-justify-center", __iconNode$oA);

  const __iconNode$oz = [
    ["rect", { width: "14", height: "6", x: "5", y: "12", rx: "2", key: "4l4tp2" }],
    ["rect", { width: "10", height: "6", x: "7", y: "2", rx: "2", key: "ypihtt" }],
    ["path", { d: "M2 22h20", key: "272qi7" }]
  ];
  const AlignVerticalJustifyEnd = createLucideIcon("align-vertical-justify-end", __iconNode$oz);

  const __iconNode$oy = [
    ["rect", { width: "14", height: "6", x: "5", y: "16", rx: "2", key: "1i8z2d" }],
    ["rect", { width: "10", height: "6", x: "7", y: "6", rx: "2", key: "13squh" }],
    ["path", { d: "M2 2h20", key: "1ennik" }]
  ];
  const AlignVerticalJustifyStart = createLucideIcon("align-vertical-justify-start", __iconNode$oy);

  const __iconNode$ox = [
    ["rect", { width: "10", height: "6", x: "7", y: "9", rx: "2", key: "b1zbii" }],
    ["path", { d: "M22 20H2", key: "1p1f7z" }],
    ["path", { d: "M22 4H2", key: "1b7qnq" }]
  ];
  const AlignVerticalSpaceAround = createLucideIcon("align-vertical-space-around", __iconNode$ox);

  const __iconNode$ow = [
    ["rect", { width: "14", height: "6", x: "5", y: "15", rx: "2", key: "1w91an" }],
    ["rect", { width: "10", height: "6", x: "7", y: "3", rx: "2", key: "17wqzy" }],
    ["path", { d: "M2 21h20", key: "1nyx9w" }],
    ["path", { d: "M2 3h20", key: "91anmk" }]
  ];
  const AlignVerticalSpaceBetween = createLucideIcon("align-vertical-space-between", __iconNode$ow);

  const __iconNode$ov = [
    ["path", { d: "M10 10H6", key: "1bsnug" }],
    ["path", { d: "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2", key: "wrbu53" }],
    [
      "path",
      {
        d: "M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14",
        key: "lrkjwd"
      }
    ],
    ["path", { d: "M8 8v4", key: "1fwk8c" }],
    ["path", { d: "M9 18h6", key: "x1upvd" }],
    ["circle", { cx: "17", cy: "18", r: "2", key: "332jqn" }],
    ["circle", { cx: "7", cy: "18", r: "2", key: "19iecd" }]
  ];
  const Ambulance = createLucideIcon("ambulance", __iconNode$ov);

  const __iconNode$ou = [
    [
      "path",
      {
        d: "M17.5 12c0 4.4-3.6 8-8 8A4.5 4.5 0 0 1 5 15.5c0-6 8-4 8-8.5a3 3 0 1 0-6 0c0 3 2.5 8.5 12 13",
        key: "1o9ehi"
      }
    ],
    ["path", { d: "M16 12h3", key: "4uvgyw" }]
  ];
  const Ampersand = createLucideIcon("ampersand", __iconNode$ou);

  const __iconNode$ot = [
    [
      "path",
      {
        d: "M10 17c-5-3-7-7-7-9a2 2 0 0 1 4 0c0 2.5-5 2.5-5 6 0 1.7 1.3 3 3 3 2.8 0 5-2.2 5-5",
        key: "12lh1k"
      }
    ],
    [
      "path",
      {
        d: "M22 17c-5-3-7-7-7-9a2 2 0 0 1 4 0c0 2.5-5 2.5-5 6 0 1.7 1.3 3 3 3 2.8 0 5-2.2 5-5",
        key: "173c68"
      }
    ]
  ];
  const Ampersands = createLucideIcon("ampersands", __iconNode$ot);

  const __iconNode$os = [
    [
      "path",
      { d: "M10 2v5.632c0 .424-.272.795-.653.982A6 6 0 0 0 6 14c.006 4 3 7 5 8", key: "1h8rid" }
    ],
    ["path", { d: "M10 5H8a2 2 0 0 0 0 4h.68", key: "3ezsi6" }],
    ["path", { d: "M14 2v5.632c0 .424.272.795.652.982A6 6 0 0 1 18 14c0 4-3 7-5 8", key: "yt6q09" }],
    ["path", { d: "M14 5h2a2 2 0 0 1 0 4h-.68", key: "8f95yk" }],
    ["path", { d: "M18 22H6", key: "mg6kv4" }],
    ["path", { d: "M9 2h6", key: "1jrp98" }]
  ];
  const Amphora = createLucideIcon("amphora", __iconNode$os);

  const __iconNode$or = [
    ["path", { d: "M12 22V8", key: "qkxhtm" }],
    ["path", { d: "M5 12H2a10 10 0 0 0 20 0h-3", key: "1hv3nh" }],
    ["circle", { cx: "12", cy: "5", r: "3", key: "rqqgnr" }]
  ];
  const Anchor = createLucideIcon("anchor", __iconNode$or);

  const __iconNode$oq = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M16 16s-1.5-2-4-2-4 2-4 2", key: "epbg0q" }],
    ["path", { d: "M7.5 8 10 9", key: "olxxln" }],
    ["path", { d: "m14 9 2.5-1", key: "1j6cij" }],
    ["path", { d: "M9 10h.01", key: "qbtxuw" }],
    ["path", { d: "M15 10h.01", key: "1qmjsl" }]
  ];
  const Angry = createLucideIcon("angry", __iconNode$oq);

  const __iconNode$op = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M8 15h8", key: "45n4r" }],
    ["path", { d: "M8 9h2", key: "1g203m" }],
    ["path", { d: "M14 9h2", key: "116p9w" }]
  ];
  const Annoyed = createLucideIcon("annoyed", __iconNode$op);

  const __iconNode$oo = [
    ["path", { d: "M2 12 7 2", key: "117k30" }],
    ["path", { d: "m7 12 5-10", key: "1tvx22" }],
    ["path", { d: "m12 12 5-10", key: "ev1o1a" }],
    ["path", { d: "m17 12 5-10", key: "1e4ti3" }],
    ["path", { d: "M4.5 7h15", key: "vlsxkz" }],
    ["path", { d: "M12 16v6", key: "c8a4gj" }]
  ];
  const Antenna = createLucideIcon("antenna", __iconNode$oo);

  const __iconNode$on = [
    ["path", { d: "M7 10H6a4 4 0 0 1-4-4 1 1 0 0 1 1-1h4", key: "1hjpb6" }],
    [
      "path",
      { d: "M7 5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1 7 7 0 0 1-7 7H8a1 1 0 0 1-1-1z", key: "1qn45f" }
    ],
    ["path", { d: "M9 12v5", key: "3anwtq" }],
    ["path", { d: "M15 12v5", key: "5xh3zn" }],
    [
      "path",
      { d: "M5 20a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3 1 1 0 0 1-1 1H6a1 1 0 0 1-1-1", key: "1fi4x8" }
    ]
  ];
  const Anvil = createLucideIcon("anvil", __iconNode$on);

  const __iconNode$om = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m14.31 8 5.74 9.94", key: "1y6ab4" }],
    ["path", { d: "M9.69 8h11.48", key: "1wxppr" }],
    ["path", { d: "m7.38 12 5.74-9.94", key: "1grp0k" }],
    ["path", { d: "M9.69 16 3.95 6.06", key: "libnyf" }],
    ["path", { d: "M14.31 16H2.83", key: "x5fava" }],
    ["path", { d: "m16.62 12-5.74 9.94", key: "1vwawt" }]
  ];
  const Aperture = createLucideIcon("aperture", __iconNode$om);

  const __iconNode$ol = [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
    ["path", { d: "M6 8h.01", key: "x9i8wu" }],
    ["path", { d: "M10 8h.01", key: "1r9ogq" }],
    ["path", { d: "M14 8h.01", key: "1primd" }]
  ];
  const AppWindowMac = createLucideIcon("app-window-mac", __iconNode$ol);

  const __iconNode$ok = [
    ["rect", { x: "2", y: "4", width: "20", height: "16", rx: "2", key: "izxlao" }],
    ["path", { d: "M10 4v4", key: "pp8u80" }],
    ["path", { d: "M2 8h20", key: "d11cs7" }],
    ["path", { d: "M6 4v4", key: "1svtjw" }]
  ];
  const AppWindow = createLucideIcon("app-window", __iconNode$ok);

  const __iconNode$oj = [
    [
      "path",
      {
        d: "M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z",
        key: "3s7exb"
      }
    ],
    ["path", { d: "M10 2c1 .5 2 2 2 5", key: "fcco2y" }]
  ];
  const Apple = createLucideIcon("apple", __iconNode$oj);

  const __iconNode$oi = [
    ["rect", { width: "20", height: "5", x: "2", y: "3", rx: "1", key: "1wp1u1" }],
    ["path", { d: "M4 8v11a2 2 0 0 0 2 2h2", key: "tvwodi" }],
    ["path", { d: "M20 8v11a2 2 0 0 1-2 2h-2", key: "1gkqxj" }],
    ["path", { d: "m9 15 3-3 3 3", key: "1pd0qc" }],
    ["path", { d: "M12 12v9", key: "192myk" }]
  ];
  const ArchiveRestore = createLucideIcon("archive-restore", __iconNode$oi);

  const __iconNode$oh = [
    ["rect", { width: "20", height: "5", x: "2", y: "3", rx: "1", key: "1wp1u1" }],
    ["path", { d: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8", key: "1s80jp" }],
    ["path", { d: "m9.5 17 5-5", key: "nakeu6" }],
    ["path", { d: "m9.5 12 5 5", key: "1hccrj" }]
  ];
  const ArchiveX = createLucideIcon("archive-x", __iconNode$oh);

  const __iconNode$og = [
    ["rect", { width: "20", height: "5", x: "2", y: "3", rx: "1", key: "1wp1u1" }],
    ["path", { d: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8", key: "1s80jp" }],
    ["path", { d: "M10 12h4", key: "a56b0p" }]
  ];
  const Archive = createLucideIcon("archive", __iconNode$og);

  const __iconNode$of = [
    ["path", { d: "M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3", key: "irtipd" }],
    [
      "path",
      {
        d: "M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z",
        key: "1qyhux"
      }
    ],
    ["path", { d: "M5 18v2", key: "ppbyun" }],
    ["path", { d: "M19 18v2", key: "gy7782" }]
  ];
  const Armchair = createLucideIcon("armchair", __iconNode$of);

  const __iconNode$oe = [
    ["path", { d: "M15 5H9", key: "1tp3ed" }],
    ["path", { d: "M15 9v3h4l-7 7-7-7h4V9z", key: "ncdc4b" }]
  ];
  const ArrowBigDownDash = createLucideIcon("arrow-big-down-dash", __iconNode$oe);

  const __iconNode$od = [["path", { d: "M15 6v6h4l-7 7-7-7h4V6h6z", key: "1thax2" }]];
  const ArrowBigDown = createLucideIcon("arrow-big-down", __iconNode$od);

  const __iconNode$oc = [
    ["path", { d: "M19 15V9", key: "1hci5f" }],
    ["path", { d: "M15 15h-3v4l-7-7 7-7v4h3v6z", key: "16tjna" }]
  ];
  const ArrowBigLeftDash = createLucideIcon("arrow-big-left-dash", __iconNode$oc);

  const __iconNode$ob = [["path", { d: "M18 15h-6v4l-7-7 7-7v4h6v6z", key: "lbrdak" }]];
  const ArrowBigLeft = createLucideIcon("arrow-big-left", __iconNode$ob);

  const __iconNode$oa = [
    ["path", { d: "M5 9v6", key: "158jrl" }],
    ["path", { d: "M9 9h3V5l7 7-7 7v-4H9V9z", key: "1sg2xn" }]
  ];
  const ArrowBigRightDash = createLucideIcon("arrow-big-right-dash", __iconNode$oa);

  const __iconNode$o9 = [["path", { d: "M6 9h6V5l7 7-7 7v-4H6V9z", key: "7fvt9c" }]];
  const ArrowBigRight = createLucideIcon("arrow-big-right", __iconNode$o9);

  const __iconNode$o8 = [
    ["path", { d: "M9 19h6", key: "456am0" }],
    ["path", { d: "M9 15v-3H5l7-7 7 7h-4v3H9z", key: "1r2uve" }]
  ];
  const ArrowBigUpDash = createLucideIcon("arrow-big-up-dash", __iconNode$o8);

  const __iconNode$o7 = [["path", { d: "M9 18v-6H5l7-7 7 7h-4v6H9z", key: "1x06kx" }]];
  const ArrowBigUp = createLucideIcon("arrow-big-up", __iconNode$o7);

  const __iconNode$o6 = [
    ["path", { d: "m3 16 4 4 4-4", key: "1co6wj" }],
    ["path", { d: "M7 20V4", key: "1yoxec" }],
    ["rect", { x: "15", y: "4", width: "4", height: "6", ry: "2", key: "1bwicg" }],
    ["path", { d: "M17 20v-6h-2", key: "1qp1so" }],
    ["path", { d: "M15 20h4", key: "1j968p" }]
  ];
  const ArrowDown01 = createLucideIcon("arrow-down-0-1", __iconNode$o6);

  const __iconNode$o5 = [
    ["path", { d: "m3 16 4 4 4-4", key: "1co6wj" }],
    ["path", { d: "M7 20V4", key: "1yoxec" }],
    ["path", { d: "M17 10V4h-2", key: "zcsr5x" }],
    ["path", { d: "M15 10h4", key: "id2lce" }],
    ["rect", { x: "15", y: "14", width: "4", height: "6", ry: "2", key: "33xykx" }]
  ];
  const ArrowDown10 = createLucideIcon("arrow-down-1-0", __iconNode$o5);

  const __iconNode$o4 = [
    ["path", { d: "m3 16 4 4 4-4", key: "1co6wj" }],
    ["path", { d: "M7 20V4", key: "1yoxec" }],
    ["path", { d: "M20 8h-5", key: "1vsyxs" }],
    ["path", { d: "M15 10V6.5a2.5 2.5 0 0 1 5 0V10", key: "ag13bf" }],
    ["path", { d: "M15 14h5l-5 6h5", key: "ur5jdg" }]
  ];
  const ArrowDownAZ = createLucideIcon("arrow-down-a-z", __iconNode$o4);

  const __iconNode$o3 = [
    ["path", { d: "M19 3H5", key: "1236rx" }],
    ["path", { d: "M12 21V7", key: "gj6g52" }],
    ["path", { d: "m6 15 6 6 6-6", key: "h15q88" }]
  ];
  const ArrowDownFromLine = createLucideIcon("arrow-down-from-line", __iconNode$o3);

  const __iconNode$o2 = [
    ["path", { d: "M17 7 7 17", key: "15tmo1" }],
    ["path", { d: "M17 17H7V7", key: "1org7z" }]
  ];
  const ArrowDownLeft = createLucideIcon("arrow-down-left", __iconNode$o2);

  const __iconNode$o1 = [
    ["path", { d: "m3 16 4 4 4-4", key: "1co6wj" }],
    ["path", { d: "M7 20V4", key: "1yoxec" }],
    ["path", { d: "M11 4h4", key: "6d7r33" }],
    ["path", { d: "M11 8h7", key: "djye34" }],
    ["path", { d: "M11 12h10", key: "1438ji" }]
  ];
  const ArrowDownNarrowWide = createLucideIcon("arrow-down-narrow-wide", __iconNode$o1);

  const __iconNode$o0 = [
    ["path", { d: "m7 7 10 10", key: "1fmybs" }],
    ["path", { d: "M17 7v10H7", key: "6fjiku" }]
  ];
  const ArrowDownRight = createLucideIcon("arrow-down-right", __iconNode$o0);

  const __iconNode$n$ = [
    ["path", { d: "M12 2v14", key: "jyx4ut" }],
    ["path", { d: "m19 9-7 7-7-7", key: "1oe3oy" }],
    ["circle", { cx: "12", cy: "21", r: "1", key: "o0uj5v" }]
  ];
  const ArrowDownToDot = createLucideIcon("arrow-down-to-dot", __iconNode$n$);

  const __iconNode$n_ = [
    ["path", { d: "M12 17V3", key: "1cwfxf" }],
    ["path", { d: "m6 11 6 6 6-6", key: "12ii2o" }],
    ["path", { d: "M19 21H5", key: "150jfl" }]
  ];
  const ArrowDownToLine = createLucideIcon("arrow-down-to-line", __iconNode$n_);

  const __iconNode$nZ = [
    ["path", { d: "m3 16 4 4 4-4", key: "1co6wj" }],
    ["path", { d: "M7 20V4", key: "1yoxec" }],
    ["path", { d: "m21 8-4-4-4 4", key: "1c9v7m" }],
    ["path", { d: "M17 4v16", key: "7dpous" }]
  ];
  const ArrowDownUp = createLucideIcon("arrow-down-up", __iconNode$nZ);

  const __iconNode$nY = [
    ["path", { d: "m3 16 4 4 4-4", key: "1co6wj" }],
    ["path", { d: "M7 20V4", key: "1yoxec" }],
    ["path", { d: "M11 4h10", key: "1w87gc" }],
    ["path", { d: "M11 8h7", key: "djye34" }],
    ["path", { d: "M11 12h4", key: "q8tih4" }]
  ];
  const ArrowDownWideNarrow = createLucideIcon("arrow-down-wide-narrow", __iconNode$nY);

  const __iconNode$nX = [
    ["path", { d: "m3 16 4 4 4-4", key: "1co6wj" }],
    ["path", { d: "M7 4v16", key: "1glfcx" }],
    ["path", { d: "M15 4h5l-5 6h5", key: "8asdl1" }],
    ["path", { d: "M15 20v-3.5a2.5 2.5 0 0 1 5 0V20", key: "r6l5cz" }],
    ["path", { d: "M20 18h-5", key: "18j1r2" }]
  ];
  const ArrowDownZA = createLucideIcon("arrow-down-z-a", __iconNode$nX);

  const __iconNode$nW = [
    ["path", { d: "M12 5v14", key: "s699le" }],
    ["path", { d: "m19 12-7 7-7-7", key: "1idqje" }]
  ];
  const ArrowDown = createLucideIcon("arrow-down", __iconNode$nW);

  const __iconNode$nV = [
    ["path", { d: "m9 6-6 6 6 6", key: "7v63n9" }],
    ["path", { d: "M3 12h14", key: "13k4hi" }],
    ["path", { d: "M21 19V5", key: "b4bplr" }]
  ];
  const ArrowLeftFromLine = createLucideIcon("arrow-left-from-line", __iconNode$nV);

  const __iconNode$nU = [
    ["path", { d: "M8 3 4 7l4 4", key: "9rb6wj" }],
    ["path", { d: "M4 7h16", key: "6tx8e3" }],
    ["path", { d: "m16 21 4-4-4-4", key: "siv7j2" }],
    ["path", { d: "M20 17H4", key: "h6l3hr" }]
  ];
  const ArrowLeftRight = createLucideIcon("arrow-left-right", __iconNode$nU);

  const __iconNode$nT = [
    ["path", { d: "M3 19V5", key: "rwsyhb" }],
    ["path", { d: "m13 6-6 6 6 6", key: "1yhaz7" }],
    ["path", { d: "M7 12h14", key: "uoisry" }]
  ];
  const ArrowLeftToLine = createLucideIcon("arrow-left-to-line", __iconNode$nT);

  const __iconNode$nS = [
    ["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
    ["path", { d: "M19 12H5", key: "x3x0zl" }]
  ];
  const ArrowLeft = createLucideIcon("arrow-left", __iconNode$nS);

  const __iconNode$nR = [
    ["path", { d: "M3 5v14", key: "1nt18q" }],
    ["path", { d: "M21 12H7", key: "13ipq5" }],
    ["path", { d: "m15 18 6-6-6-6", key: "6tx3qv" }]
  ];
  const ArrowRightFromLine = createLucideIcon("arrow-right-from-line", __iconNode$nR);

  const __iconNode$nQ = [
    ["path", { d: "m16 3 4 4-4 4", key: "1x1c3m" }],
    ["path", { d: "M20 7H4", key: "zbl0bi" }],
    ["path", { d: "m8 21-4-4 4-4", key: "h9nckh" }],
    ["path", { d: "M4 17h16", key: "g4d7ey" }]
  ];
  const ArrowRightLeft = createLucideIcon("arrow-right-left", __iconNode$nQ);

  const __iconNode$nP = [
    ["path", { d: "M17 12H3", key: "8awo09" }],
    ["path", { d: "m11 18 6-6-6-6", key: "8c2y43" }],
    ["path", { d: "M21 5v14", key: "nzette" }]
  ];
  const ArrowRightToLine = createLucideIcon("arrow-right-to-line", __iconNode$nP);

  const __iconNode$nO = [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]
  ];
  const ArrowRight = createLucideIcon("arrow-right", __iconNode$nO);

  const __iconNode$nN = [
    ["path", { d: "m3 8 4-4 4 4", key: "11wl7u" }],
    ["path", { d: "M7 4v16", key: "1glfcx" }],
    ["rect", { x: "15", y: "4", width: "4", height: "6", ry: "2", key: "1bwicg" }],
    ["path", { d: "M17 20v-6h-2", key: "1qp1so" }],
    ["path", { d: "M15 20h4", key: "1j968p" }]
  ];
  const ArrowUp01 = createLucideIcon("arrow-up-0-1", __iconNode$nN);

  const __iconNode$nM = [
    ["path", { d: "m3 8 4-4 4 4", key: "11wl7u" }],
    ["path", { d: "M7 4v16", key: "1glfcx" }],
    ["path", { d: "M17 10V4h-2", key: "zcsr5x" }],
    ["path", { d: "M15 10h4", key: "id2lce" }],
    ["rect", { x: "15", y: "14", width: "4", height: "6", ry: "2", key: "33xykx" }]
  ];
  const ArrowUp10 = createLucideIcon("arrow-up-1-0", __iconNode$nM);

  const __iconNode$nL = [
    ["path", { d: "m3 8 4-4 4 4", key: "11wl7u" }],
    ["path", { d: "M7 4v16", key: "1glfcx" }],
    ["path", { d: "M20 8h-5", key: "1vsyxs" }],
    ["path", { d: "M15 10V6.5a2.5 2.5 0 0 1 5 0V10", key: "ag13bf" }],
    ["path", { d: "M15 14h5l-5 6h5", key: "ur5jdg" }]
  ];
  const ArrowUpAZ = createLucideIcon("arrow-up-a-z", __iconNode$nL);

  const __iconNode$nK = [
    ["path", { d: "m21 16-4 4-4-4", key: "f6ql7i" }],
    ["path", { d: "M17 20V4", key: "1ejh1v" }],
    ["path", { d: "m3 8 4-4 4 4", key: "11wl7u" }],
    ["path", { d: "M7 4v16", key: "1glfcx" }]
  ];
  const ArrowUpDown = createLucideIcon("arrow-up-down", __iconNode$nK);

  const __iconNode$nJ = [
    ["path", { d: "m5 9 7-7 7 7", key: "1hw5ic" }],
    ["path", { d: "M12 16V2", key: "ywoabb" }],
    ["circle", { cx: "12", cy: "21", r: "1", key: "o0uj5v" }]
  ];
  const ArrowUpFromDot = createLucideIcon("arrow-up-from-dot", __iconNode$nJ);

  const __iconNode$nI = [
    ["path", { d: "m18 9-6-6-6 6", key: "kcunyi" }],
    ["path", { d: "M12 3v14", key: "7cf3v8" }],
    ["path", { d: "M5 21h14", key: "11awu3" }]
  ];
  const ArrowUpFromLine = createLucideIcon("arrow-up-from-line", __iconNode$nI);

  const __iconNode$nH = [
    ["path", { d: "M7 17V7h10", key: "11bw93" }],
    ["path", { d: "M17 17 7 7", key: "2786uv" }]
  ];
  const ArrowUpLeft = createLucideIcon("arrow-up-left", __iconNode$nH);

  const __iconNode$nG = [
    ["path", { d: "m3 8 4-4 4 4", key: "11wl7u" }],
    ["path", { d: "M7 4v16", key: "1glfcx" }],
    ["path", { d: "M11 12h4", key: "q8tih4" }],
    ["path", { d: "M11 16h7", key: "uosisv" }],
    ["path", { d: "M11 20h10", key: "jvxblo" }]
  ];
  const ArrowUpNarrowWide = createLucideIcon("arrow-up-narrow-wide", __iconNode$nG);

  const __iconNode$nF = [
    ["path", { d: "M7 7h10v10", key: "1tivn9" }],
    ["path", { d: "M7 17 17 7", key: "1vkiza" }]
  ];
  const ArrowUpRight = createLucideIcon("arrow-up-right", __iconNode$nF);

  const __iconNode$nE = [
    ["path", { d: "M5 3h14", key: "7usisc" }],
    ["path", { d: "m18 13-6-6-6 6", key: "1kf1n9" }],
    ["path", { d: "M12 7v14", key: "1akyts" }]
  ];
  const ArrowUpToLine = createLucideIcon("arrow-up-to-line", __iconNode$nE);

  const __iconNode$nD = [
    ["path", { d: "m3 8 4-4 4 4", key: "11wl7u" }],
    ["path", { d: "M7 4v16", key: "1glfcx" }],
    ["path", { d: "M11 12h10", key: "1438ji" }],
    ["path", { d: "M11 16h7", key: "uosisv" }],
    ["path", { d: "M11 20h4", key: "1krc32" }]
  ];
  const ArrowUpWideNarrow = createLucideIcon("arrow-up-wide-narrow", __iconNode$nD);

  const __iconNode$nC = [
    ["path", { d: "m3 8 4-4 4 4", key: "11wl7u" }],
    ["path", { d: "M7 4v16", key: "1glfcx" }],
    ["path", { d: "M15 4h5l-5 6h5", key: "8asdl1" }],
    ["path", { d: "M15 20v-3.5a2.5 2.5 0 0 1 5 0V20", key: "r6l5cz" }],
    ["path", { d: "M20 18h-5", key: "18j1r2" }]
  ];
  const ArrowUpZA = createLucideIcon("arrow-up-z-a", __iconNode$nC);

  const __iconNode$nB = [
    ["path", { d: "m4 6 3-3 3 3", key: "9aidw8" }],
    ["path", { d: "M7 17V3", key: "19qxw1" }],
    ["path", { d: "m14 6 3-3 3 3", key: "6iy689" }],
    ["path", { d: "M17 17V3", key: "o0fmgi" }],
    ["path", { d: "M4 21h16", key: "1h09gz" }]
  ];
  const ArrowsUpFromLine = createLucideIcon("arrows-up-from-line", __iconNode$nB);

  const __iconNode$nA = [
    ["path", { d: "m5 12 7-7 7 7", key: "hav0vg" }],
    ["path", { d: "M12 19V5", key: "x0mq9r" }]
  ];
  const ArrowUp = createLucideIcon("arrow-up", __iconNode$nA);

  const __iconNode$nz = [
    ["path", { d: "M12 6v12", key: "1vza4d" }],
    ["path", { d: "M17.196 9 6.804 15", key: "1ah31z" }],
    ["path", { d: "m6.804 9 10.392 6", key: "1b6pxd" }]
  ];
  const Asterisk = createLucideIcon("asterisk", __iconNode$nz);

  const __iconNode$ny = [
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
    ["path", { d: "M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8", key: "7n84p3" }]
  ];
  const AtSign = createLucideIcon("at-sign", __iconNode$ny);

  const __iconNode$nx = [
    [
      "path",
      {
        d: "M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2",
        key: "57tc96"
      }
    ]
  ];
  const AudioWaveform = createLucideIcon("audio-waveform", __iconNode$nx);

  const __iconNode$nw = [
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
    [
      "path",
      {
        d: "M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z",
        key: "1l2ple"
      }
    ],
    [
      "path",
      {
        d: "M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z",
        key: "1wam0m"
      }
    ]
  ];
  const Atom = createLucideIcon("atom", __iconNode$nw);

  const __iconNode$nv = [
    ["path", { d: "M2 10v3", key: "1fnikh" }],
    ["path", { d: "M6 6v11", key: "11sgs0" }],
    ["path", { d: "M10 3v18", key: "yhl04a" }],
    ["path", { d: "M14 8v7", key: "3a1oy3" }],
    ["path", { d: "M18 5v13", key: "123xd1" }],
    ["path", { d: "M22 10v3", key: "154ddg" }]
  ];
  const AudioLines = createLucideIcon("audio-lines", __iconNode$nv);

  const __iconNode$nu = [
    [
      "path",
      {
        d: "m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526",
        key: "1yiouv"
      }
    ],
    ["circle", { cx: "12", cy: "8", r: "6", key: "1vp47v" }]
  ];
  const Award = createLucideIcon("award", __iconNode$nu);

  const __iconNode$nt = [
    ["path", { d: "m14 12-8.381 8.38a1 1 0 0 1-3.001-3L11 9", key: "5z9253" }],
    [
      "path",
      {
        d: "M15 15.5a.5.5 0 0 0 .5.5A6.5 6.5 0 0 0 22 9.5a.5.5 0 0 0-.5-.5h-1.672a2 2 0 0 1-1.414-.586l-5.062-5.062a1.205 1.205 0 0 0-1.704 0L9.352 5.648a1.205 1.205 0 0 0 0 1.704l5.062 5.062A2 2 0 0 1 15 13.828z",
        key: "19zklq"
      }
    ]
  ];
  const Axe = createLucideIcon("axe", __iconNode$nt);

  const __iconNode$ns = [
    ["path", { d: "M13.5 10.5 15 9", key: "1nsxvm" }],
    ["path", { d: "M4 4v15a1 1 0 0 0 1 1h15", key: "1w6lkd" }],
    ["path", { d: "M4.293 19.707 6 18", key: "3g1p8c" }],
    ["path", { d: "m9 15 1.5-1.5", key: "1xfbes" }]
  ];
  const Axis3d = createLucideIcon("axis-3d", __iconNode$ns);

  const __iconNode$nr = [
    ["path", { d: "M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5", key: "1u7htd" }],
    ["path", { d: "M15 12h.01", key: "1k8ypt" }],
    [
      "path",
      {
        d: "M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1",
        key: "11xh7x"
      }
    ],
    ["path", { d: "M9 12h.01", key: "157uk2" }]
  ];
  const Baby = createLucideIcon("baby", __iconNode$nr);

  const __iconNode$nq = [
    [
      "path",
      { d: "M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", key: "1ol0lm" }
    ],
    ["path", { d: "M8 10h8", key: "c7uz4u" }],
    ["path", { d: "M8 18h8", key: "1no2b1" }],
    ["path", { d: "M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6", key: "1fr6do" }],
    ["path", { d: "M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2", key: "donm21" }]
  ];
  const Backpack = createLucideIcon("backpack", __iconNode$nq);

  const __iconNode$np = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
    ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
  ];
  const BadgeAlert = createLucideIcon("badge-alert", __iconNode$np);

  const __iconNode$no = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "M12 7v10", key: "jspqdw" }],
    ["path", { d: "M15.4 10a4 4 0 1 0 0 4", key: "2eqtx8" }]
  ];
  const BadgeCent = createLucideIcon("badge-cent", __iconNode$no);

  const __iconNode$nn = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ];
  const BadgeCheck = createLucideIcon("badge-check", __iconNode$nn);

  const __iconNode$nm = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8", key: "1h4pet" }],
    ["path", { d: "M12 18V6", key: "zqpxq5" }]
  ];
  const BadgeDollarSign = createLucideIcon("badge-dollar-sign", __iconNode$nm);

  const __iconNode$nl = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "M7 12h5", key: "gblrwe" }],
    ["path", { d: "M15 9.4a4 4 0 1 0 0 5.2", key: "1makmb" }]
  ];
  const BadgeEuro = createLucideIcon("badge-euro", __iconNode$nl);

  const __iconNode$nk = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "M8 8h8", key: "1bis0t" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
    ["path", { d: "m13 17-5-1h1a4 4 0 0 0 0-8", key: "nu2bwa" }]
  ];
  const BadgeIndianRupee = createLucideIcon("badge-indian-rupee", __iconNode$nk);

  const __iconNode$nj = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["line", { x1: "12", x2: "12", y1: "16", y2: "12", key: "1y1yb1" }],
    ["line", { x1: "12", x2: "12.01", y1: "8", y2: "8", key: "110wyk" }]
  ];
  const BadgeInfo = createLucideIcon("badge-info", __iconNode$nj);

  const __iconNode$ni = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "m9 8 3 3v7", key: "17yadx" }],
    ["path", { d: "m12 11 3-3", key: "p4cfq1" }],
    ["path", { d: "M9 12h6", key: "1c52cq" }],
    ["path", { d: "M9 16h6", key: "8wimt3" }]
  ];
  const BadgeJapaneseYen = createLucideIcon("badge-japanese-yen", __iconNode$ni);

  const __iconNode$nh = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["line", { x1: "8", x2: "16", y1: "12", y2: "12", key: "1jonct" }]
  ];
  const BadgeMinus = createLucideIcon("badge-minus", __iconNode$nh);

  const __iconNode$ng = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    ["path", { d: "M9 9h.01", key: "1q5me6" }],
    ["path", { d: "M15 15h.01", key: "lqbp3k" }]
  ];
  const BadgePercent = createLucideIcon("badge-percent", __iconNode$ng);

  const __iconNode$nf = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "M8 12h4", key: "qz6y1c" }],
    ["path", { d: "M10 16V9.5a2.5 2.5 0 0 1 5 0", key: "3mlbjk" }],
    ["path", { d: "M8 16h7", key: "sbedsn" }]
  ];
  const BadgePoundSterling = createLucideIcon("badge-pound-sterling", __iconNode$nf);

  const __iconNode$ne = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["line", { x1: "12", x2: "12", y1: "8", y2: "16", key: "10p56q" }],
    ["line", { x1: "8", x2: "16", y1: "12", y2: "12", key: "1jonct" }]
  ];
  const BadgePlus = createLucideIcon("badge-plus", __iconNode$ne);

  const __iconNode$nd = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
    ["line", { x1: "12", x2: "12.01", y1: "17", y2: "17", key: "io3f8k" }]
  ];
  const BadgeQuestionMark = createLucideIcon("badge-question-mark", __iconNode$nd);

  const __iconNode$nc = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "M9 16h5", key: "1syiyw" }],
    ["path", { d: "M9 12h5a2 2 0 1 0 0-4h-3v9", key: "1ge9c1" }]
  ];
  const BadgeRussianRuble = createLucideIcon("badge-russian-ruble", __iconNode$nc);

  const __iconNode$nb = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["path", { d: "M11 17V8h4", key: "1bfq6y" }],
    ["path", { d: "M11 12h3", key: "2eqnfz" }],
    ["path", { d: "M9 16h4", key: "1skf3a" }]
  ];
  const BadgeSwissFranc = createLucideIcon("badge-swiss-franc", __iconNode$nb);

  const __iconNode$na = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ],
    ["line", { x1: "15", x2: "9", y1: "9", y2: "15", key: "f7djnv" }],
    ["line", { x1: "9", x2: "15", y1: "9", y2: "15", key: "1shsy8" }]
  ];
  const BadgeX = createLucideIcon("badge-x", __iconNode$na);

  const __iconNode$n9 = [
    [
      "path",
      {
        d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z",
        key: "3c2336"
      }
    ]
  ];
  const Badge = createLucideIcon("badge", __iconNode$n9);

  const __iconNode$n8 = [
    ["path", { d: "M22 18H6a2 2 0 0 1-2-2V7a2 2 0 0 0-2-2", key: "4irg2o" }],
    ["path", { d: "M17 14V4a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2v10", key: "14fcyx" }],
    ["rect", { width: "13", height: "8", x: "8", y: "6", rx: "1", key: "o6oiis" }],
    ["circle", { cx: "18", cy: "20", r: "2", key: "t9985n" }],
    ["circle", { cx: "9", cy: "20", r: "2", key: "e5v82j" }]
  ];
  const BaggageClaim = createLucideIcon("baggage-claim", __iconNode$n8);

  const __iconNode$n7 = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m4.9 4.9 14.2 14.2", key: "1m5liu" }]
  ];
  const Ban = createLucideIcon("ban", __iconNode$n7);

  const __iconNode$n6 = [
    ["path", { d: "M10 10.01h.01", key: "1e9xi7" }],
    ["path", { d: "M10 14.01h.01", key: "ac23bv" }],
    ["path", { d: "M14 10.01h.01", key: "2wfrvf" }],
    ["path", { d: "M14 14.01h.01", key: "8tw8yn" }],
    ["path", { d: "M18 6v11.5", key: "dkbidh" }],
    ["path", { d: "M6 6v12", key: "vkc79e" }],
    ["rect", { x: "2", y: "6", width: "20", height: "12", rx: "2", key: "1wpnh2" }]
  ];
  const Bandage = createLucideIcon("bandage", __iconNode$n6);

  const __iconNode$n5 = [
    ["path", { d: "M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5", key: "1cscit" }],
    [
      "path",
      {
        d: "M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z",
        key: "1y1nbv"
      }
    ]
  ];
  const Banana = createLucideIcon("banana", __iconNode$n5);

  const __iconNode$n4 = [
    ["path", { d: "M12 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5", key: "x6cv4u" }],
    ["path", { d: "m16 19 3 3 3-3", key: "1ibux0" }],
    ["path", { d: "M18 12h.01", key: "yjnet6" }],
    ["path", { d: "M19 16v6", key: "tddt3s" }],
    ["path", { d: "M6 12h.01", key: "c2rlol" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]
  ];
  const BanknoteArrowDown = createLucideIcon("banknote-arrow-down", __iconNode$n4);

  const __iconNode$n3 = [
    ["path", { d: "M12 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5", key: "x6cv4u" }],
    ["path", { d: "M18 12h.01", key: "yjnet6" }],
    ["path", { d: "M19 22v-6", key: "qhmiwi" }],
    ["path", { d: "m22 19-3-3-3 3", key: "rn6bg2" }],
    ["path", { d: "M6 12h.01", key: "c2rlol" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]
  ];
  const BanknoteArrowUp = createLucideIcon("banknote-arrow-up", __iconNode$n3);

  const __iconNode$n2 = [
    ["path", { d: "M13 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5", key: "16nib6" }],
    ["path", { d: "m17 17 5 5", key: "p7ous7" }],
    ["path", { d: "M18 12h.01", key: "yjnet6" }],
    ["path", { d: "m22 17-5 5", key: "gqnmv0" }],
    ["path", { d: "M6 12h.01", key: "c2rlol" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]
  ];
  const BanknoteX = createLucideIcon("banknote-x", __iconNode$n2);

  const __iconNode$n1 = [
    ["rect", { width: "20", height: "12", x: "2", y: "6", rx: "2", key: "9lu3g6" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }],
    ["path", { d: "M6 12h.01M18 12h.01", key: "113zkx" }]
  ];
  const Banknote = createLucideIcon("banknote", __iconNode$n1);

  const __iconNode$n0 = [
    ["path", { d: "M10 3a41 41 0 0 0 0 18", key: "1qcnzb" }],
    ["path", { d: "M14 3a41 41 0 0 1 0 18", key: "547vd4" }],
    [
      "path",
      {
        d: "M17 3a2 2 0 0 1 1.68.92 15.25 15.25 0 0 1 0 16.16A2 2 0 0 1 17 21H7a2 2 0 0 1-1.68-.92 15.25 15.25 0 0 1 0-16.16A2 2 0 0 1 7 3z",
        key: "1wepyy"
      }
    ],
    ["path", { d: "M3.84 17h16.32", key: "1wh981" }],
    ["path", { d: "M3.84 7h16.32", key: "19jf4x" }]
  ];
  const Barrel = createLucideIcon("barrel", __iconNode$n0);

  const __iconNode$m$ = [
    ["path", { d: "M3 5v14", key: "1nt18q" }],
    ["path", { d: "M8 5v14", key: "1ybrkv" }],
    ["path", { d: "M12 5v14", key: "s699le" }],
    ["path", { d: "M17 5v14", key: "ycjyhj" }],
    ["path", { d: "M21 5v14", key: "nzette" }]
  ];
  const Barcode = createLucideIcon("barcode", __iconNode$m$);

  const __iconNode$m_ = [
    ["path", { d: "M4 20h16", key: "14thso" }],
    ["path", { d: "m6 16 6-12 6 12", key: "1b4byz" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }]
  ];
  const Baseline = createLucideIcon("baseline", __iconNode$m_);

  const __iconNode$mZ = [
    ["path", { d: "M10 4 8 6", key: "1rru8s" }],
    ["path", { d: "M17 19v2", key: "ts1sot" }],
    ["path", { d: "M2 12h20", key: "9i4pu4" }],
    ["path", { d: "M7 19v2", key: "12npes" }],
    [
      "path",
      {
        d: "M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5",
        key: "14ym8i"
      }
    ]
  ];
  const Bath = createLucideIcon("bath", __iconNode$mZ);

  const __iconNode$mY = [
    ["path", { d: "m11 7-3 5h4l-3 5", key: "b4a64w" }],
    ["path", { d: "M14.856 6H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.935", key: "lre1cr" }],
    ["path", { d: "M22 14v-4", key: "14q9d5" }],
    ["path", { d: "M5.14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.936", key: "13q5k0" }]
  ];
  const BatteryCharging = createLucideIcon("battery-charging", __iconNode$mY);

  const __iconNode$mX = [
    ["path", { d: "M10 10v4", key: "1mb2ec" }],
    ["path", { d: "M14 10v4", key: "1nt88p" }],
    ["path", { d: "M22 14v-4", key: "14q9d5" }],
    ["path", { d: "M6 10v4", key: "1n77qd" }],
    ["rect", { x: "2", y: "6", width: "16", height: "12", rx: "2", key: "13zb55" }]
  ];
  const BatteryFull = createLucideIcon("battery-full", __iconNode$mX);

  const __iconNode$mW = [
    ["path", { d: "M22 14v-4", key: "14q9d5" }],
    ["path", { d: "M6 14v-4", key: "14a6bd" }],
    ["rect", { x: "2", y: "6", width: "16", height: "12", rx: "2", key: "13zb55" }]
  ];
  const BatteryLow = createLucideIcon("battery-low", __iconNode$mW);

  const __iconNode$mV = [
    ["path", { d: "M10 14v-4", key: "suye4c" }],
    ["path", { d: "M22 14v-4", key: "14q9d5" }],
    ["path", { d: "M6 14v-4", key: "14a6bd" }],
    ["rect", { x: "2", y: "6", width: "16", height: "12", rx: "2", key: "13zb55" }]
  ];
  const BatteryMedium = createLucideIcon("battery-medium", __iconNode$mV);

  const __iconNode$mU = [
    ["path", { d: "M10 9v6", key: "17i7lo" }],
    ["path", { d: "M12.543 6H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.605", key: "o09yah" }],
    ["path", { d: "M22 14v-4", key: "14q9d5" }],
    ["path", { d: "M7 12h6", key: "iekk3h" }],
    ["path", { d: "M7.606 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.606", key: "xyqvf1" }]
  ];
  const BatteryPlus = createLucideIcon("battery-plus", __iconNode$mU);

  const __iconNode$mT = [
    ["path", { d: "M10 17h.01", key: "nbq80n" }],
    ["path", { d: "M10 7v6", key: "nne03l" }],
    ["path", { d: "M14 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2", key: "1m83kb" }],
    ["path", { d: "M22 14v-4", key: "14q9d5" }],
    ["path", { d: "M6 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2", key: "h8lgfh" }]
  ];
  const BatteryWarning = createLucideIcon("battery-warning", __iconNode$mT);

  const __iconNode$mS = [
    ["path", { d: "M 22 14 L 22 10", key: "nqc4tb" }],
    ["rect", { x: "2", y: "6", width: "16", height: "12", rx: "2", key: "13zb55" }]
  ];
  const Battery = createLucideIcon("battery", __iconNode$mS);

  const __iconNode$mR = [
    ["path", { d: "M4.5 3h15", key: "c7n0jr" }],
    ["path", { d: "M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3", key: "m1uhx7" }],
    ["path", { d: "M6 14h12", key: "4cwo0f" }]
  ];
  const Beaker = createLucideIcon("beaker", __iconNode$mR);

  const __iconNode$mQ = [
    [
      "path",
      {
        d: "M9 9c-.64.64-1.521.954-2.402 1.165A6 6 0 0 0 8 22a13.96 13.96 0 0 0 9.9-4.1",
        key: "bq3udt"
      }
    ],
    ["path", { d: "M10.75 5.093A6 6 0 0 1 22 8c0 2.411-.61 4.68-1.683 6.66", key: "17ccse" }],
    [
      "path",
      {
        d: "M5.341 10.62a4 4 0 0 0 6.487 1.208M10.62 5.341a4.015 4.015 0 0 1 2.039 2.04",
        key: "18zqgq"
      }
    ],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const BeanOff = createLucideIcon("bean-off", __iconNode$mQ);

  const __iconNode$mP = [
    [
      "path",
      {
        d: "M10.165 6.598C9.954 7.478 9.64 8.36 9 9c-.64.64-1.521.954-2.402 1.165A6 6 0 0 0 8 22c7.732 0 14-6.268 14-14a6 6 0 0 0-11.835-1.402Z",
        key: "1tvzk7"
      }
    ],
    ["path", { d: "M5.341 10.62a4 4 0 1 0 5.279-5.28", key: "2cyri2" }]
  ];
  const Bean = createLucideIcon("bean", __iconNode$mP);

  const __iconNode$mO = [
    ["path", { d: "M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8", key: "1k78r4" }],
    ["path", { d: "M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4", key: "fb3tl2" }],
    ["path", { d: "M12 4v6", key: "1dcgq2" }],
    ["path", { d: "M2 18h20", key: "ajqnye" }]
  ];
  const BedDouble = createLucideIcon("bed-double", __iconNode$mO);

  const __iconNode$mN = [
    ["path", { d: "M3 20v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8", key: "1wm6mi" }],
    ["path", { d: "M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4", key: "4k93s5" }],
    ["path", { d: "M3 18h18", key: "1h113x" }]
  ];
  const BedSingle = createLucideIcon("bed-single", __iconNode$mN);

  const __iconNode$mM = [
    ["path", { d: "M2 4v16", key: "vw9hq8" }],
    ["path", { d: "M2 8h18a2 2 0 0 1 2 2v10", key: "1dgv2r" }],
    ["path", { d: "M2 17h20", key: "18nfp3" }],
    ["path", { d: "M6 8v9", key: "1yriud" }]
  ];
  const Bed = createLucideIcon("bed", __iconNode$mM);

  const __iconNode$mL = [
    [
      "path",
      {
        d: "M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3",
        key: "cisjcv"
      }
    ],
    [
      "path",
      {
        d: "m18.5 6 2.19 4.5a6.48 6.48 0 0 1-2.29 7.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5",
        key: "5byaag"
      }
    ],
    ["circle", { cx: "12.5", cy: "8.5", r: "2.5", key: "9738u8" }]
  ];
  const Beef = createLucideIcon("beef", __iconNode$mL);

  const __iconNode$mK = [
    ["path", { d: "M13 13v5", key: "igwfh0" }],
    ["path", { d: "M17 11.47V8", key: "16yw0g" }],
    ["path", { d: "M17 11h1a3 3 0 0 1 2.745 4.211", key: "1xbt65" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3", key: "c55o3e" }],
    [
      "path",
      { d: "M7.536 7.535C6.766 7.649 6.154 8 5.5 8a2.5 2.5 0 0 1-1.768-4.268", key: "1ydug7" }
    ],
    [
      "path",
      {
        d: "M8.727 3.204C9.306 2.767 9.885 2 11 2c1.56 0 2 1.5 3 1.5s1.72-.5 2.5-.5a1 1 0 1 1 0 5c-.78 0-1.5-.5-2.5-.5a3.149 3.149 0 0 0-.842.12",
        key: "q81o7q"
      }
    ],
    ["path", { d: "M9 14.6V18", key: "20ek98" }]
  ];
  const BeerOff = createLucideIcon("beer-off", __iconNode$mK);

  const __iconNode$mJ = [
    ["path", { d: "M17 11h1a3 3 0 0 1 0 6h-1", key: "1yp76v" }],
    ["path", { d: "M9 12v6", key: "1u1cab" }],
    ["path", { d: "M13 12v6", key: "1sugkk" }],
    [
      "path",
      {
        d: "M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z",
        key: "1510fo"
      }
    ],
    ["path", { d: "M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8", key: "19jb7n" }]
  ];
  const Beer = createLucideIcon("beer", __iconNode$mJ);

  const __iconNode$mI = [
    ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0", key: "vwvbt9" }],
    [
      "path",
      {
        d: "M13.916 2.314A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.74 7.327A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673 9 9 0 0 1-.585-.665",
        key: "1tip0g"
      }
    ],
    ["circle", { cx: "18", cy: "8", r: "3", key: "1g0gzu" }]
  ];
  const BellDot = createLucideIcon("bell-dot", __iconNode$mI);

  const __iconNode$mH = [
    ["path", { d: "M18.518 17.347A7 7 0 0 1 14 19", key: "1emhpo" }],
    ["path", { d: "M18.8 4A11 11 0 0 1 20 9", key: "127b67" }],
    ["path", { d: "M9 9h.01", key: "1q5me6" }],
    ["circle", { cx: "20", cy: "16", r: "2", key: "1v9bxh" }],
    ["circle", { cx: "9", cy: "9", r: "7", key: "p2h5vp" }],
    ["rect", { x: "4", y: "16", width: "10", height: "6", rx: "2", key: "bfnviv" }]
  ];
  const BellElectric = createLucideIcon("bell-electric", __iconNode$mH);

  const __iconNode$mG = [
    ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0", key: "vwvbt9" }],
    ["path", { d: "M15 8h6", key: "8ybuxh" }],
    [
      "path",
      {
        d: "M16.243 3.757A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673A9.4 9.4 0 0 1 18.667 12",
        key: "bdwj86"
      }
    ]
  ];
  const BellMinus = createLucideIcon("bell-minus", __iconNode$mG);

  const __iconNode$mF = [
    ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0", key: "vwvbt9" }],
    [
      "path",
      {
        d: "M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742",
        key: "178tsu"
      }
    ],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05", key: "1hqiys" }]
  ];
  const BellOff = createLucideIcon("bell-off", __iconNode$mF);

  const __iconNode$mE = [
    ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0", key: "vwvbt9" }],
    ["path", { d: "M15 8h6", key: "8ybuxh" }],
    ["path", { d: "M18 5v6", key: "g5ayrv" }],
    [
      "path",
      {
        d: "M20.002 14.464a9 9 0 0 0 .738.863A1 1 0 0 1 20 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 8.75-5.332",
        key: "1abcvy"
      }
    ]
  ];
  const BellPlus = createLucideIcon("bell-plus", __iconNode$mE);

  const __iconNode$mD = [
    ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0", key: "vwvbt9" }],
    [
      "path",
      {
        d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
        key: "11g9vi"
      }
    ]
  ];
  const Bell = createLucideIcon("bell", __iconNode$mD);

  const __iconNode$mC = [
    ["rect", { width: "13", height: "7", x: "3", y: "3", rx: "1", key: "11xb64" }],
    ["path", { d: "m22 15-3-3 3-3", key: "26chmm" }],
    ["rect", { width: "13", height: "7", x: "3", y: "14", rx: "1", key: "k6ky7n" }]
  ];
  const BetweenHorizontalEnd = createLucideIcon("between-horizontal-end", __iconNode$mC);

  const __iconNode$mB = [
    ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0", key: "vwvbt9" }],
    ["path", { d: "M22 8c0-2.3-.8-4.3-2-6", key: "5bb3ad" }],
    [
      "path",
      {
        d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
        key: "11g9vi"
      }
    ],
    ["path", { d: "M4 2C2.8 3.7 2 5.7 2 8", key: "tap9e0" }]
  ];
  const BellRing = createLucideIcon("bell-ring", __iconNode$mB);

  const __iconNode$mA = [
    ["rect", { width: "13", height: "7", x: "8", y: "3", rx: "1", key: "pkso9a" }],
    ["path", { d: "m2 9 3 3-3 3", key: "1agib5" }],
    ["rect", { width: "13", height: "7", x: "8", y: "14", rx: "1", key: "1q5fc1" }]
  ];
  const BetweenHorizontalStart = createLucideIcon("between-horizontal-start", __iconNode$mA);

  const __iconNode$mz = [
    ["rect", { width: "7", height: "13", x: "3", y: "3", rx: "1", key: "1fdu0f" }],
    ["path", { d: "m9 22 3-3 3 3", key: "17z65a" }],
    ["rect", { width: "7", height: "13", x: "14", y: "3", rx: "1", key: "1squn4" }]
  ];
  const BetweenVerticalEnd = createLucideIcon("between-vertical-end", __iconNode$mz);

  const __iconNode$my = [
    ["rect", { width: "7", height: "13", x: "3", y: "8", rx: "1", key: "1fjrkv" }],
    ["path", { d: "m15 2-3 3-3-3", key: "1uh6eb" }],
    ["rect", { width: "7", height: "13", x: "14", y: "8", rx: "1", key: "w3fjg8" }]
  ];
  const BetweenVerticalStart = createLucideIcon("between-vertical-start", __iconNode$my);

  const __iconNode$mx = [
    [
      "path",
      {
        d: "M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1",
        key: "1pmlyh"
      }
    ],
    ["path", { d: "M15 14a5 5 0 0 0-7.584 2", key: "5rb254" }],
    ["path", { d: "M9.964 6.825C8.019 7.977 9.5 13 8 15", key: "kbvsx9" }]
  ];
  const BicepsFlexed = createLucideIcon("biceps-flexed", __iconNode$mx);

  const __iconNode$mw = [
    ["circle", { cx: "18.5", cy: "17.5", r: "3.5", key: "15x4ox" }],
    ["circle", { cx: "5.5", cy: "17.5", r: "3.5", key: "1noe27" }],
    ["circle", { cx: "15", cy: "5", r: "1", key: "19l28e" }],
    ["path", { d: "M12 17.5V14l-3-3 4-3 2 3h2", key: "1npguv" }]
  ];
  const Bike = createLucideIcon("bike", __iconNode$mw);

  const __iconNode$mv = [
    ["rect", { x: "14", y: "14", width: "4", height: "6", rx: "2", key: "p02svl" }],
    ["rect", { x: "6", y: "4", width: "4", height: "6", rx: "2", key: "xm4xkj" }],
    ["path", { d: "M6 20h4", key: "1i6q5t" }],
    ["path", { d: "M14 10h4", key: "ru81e7" }],
    ["path", { d: "M6 14h2v6", key: "16z9wg" }],
    ["path", { d: "M14 4h2v6", key: "1idq9u" }]
  ];
  const Binary = createLucideIcon("binary", __iconNode$mv);

  const __iconNode$mu = [
    ["path", { d: "M10 10h4", key: "tcdvrf" }],
    ["path", { d: "M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3", key: "3apit1" }],
    [
      "path",
      {
        d: "M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z",
        key: "rhpgnw"
      }
    ],
    ["path", { d: "M 22 16 L 2 16", key: "14lkq7" }],
    [
      "path",
      {
        d: "M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z",
        key: "104b3k"
      }
    ],
    ["path", { d: "M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3", key: "14fczp" }]
  ];
  const Binoculars = createLucideIcon("binoculars", __iconNode$mu);

  const __iconNode$mt = [
    ["circle", { cx: "12", cy: "11.9", r: "2", key: "e8h31w" }],
    ["path", { d: "M6.7 3.4c-.9 2.5 0 5.2 2.2 6.7C6.5 9 3.7 9.6 2 11.6", key: "17bolr" }],
    ["path", { d: "m8.9 10.1 1.4.8", key: "15ezny" }],
    ["path", { d: "M17.3 3.4c.9 2.5 0 5.2-2.2 6.7 2.4-1.2 5.2-.6 6.9 1.5", key: "wtwa5u" }],
    ["path", { d: "m15.1 10.1-1.4.8", key: "1r0b28" }],
    ["path", { d: "M16.7 20.8c-2.6-.4-4.6-2.6-4.7-5.3-.2 2.6-2.1 4.8-4.7 5.2", key: "m7qszh" }],
    ["path", { d: "M12 13.9v1.6", key: "zfyyim" }],
    ["path", { d: "M13.5 5.4c-1-.2-2-.2-3 0", key: "1bi9q0" }],
    ["path", { d: "M17 16.4c.7-.7 1.2-1.6 1.5-2.5", key: "1rhjqw" }],
    ["path", { d: "M5.5 13.9c.3.9.8 1.8 1.5 2.5", key: "8gsud3" }]
  ];
  const Biohazard = createLucideIcon("biohazard", __iconNode$mt);

  const __iconNode$ms = [
    ["path", { d: "M16 7h.01", key: "1kdx03" }],
    ["path", { d: "M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20", key: "oj1oa8" }],
    ["path", { d: "m20 7 2 .5-2 .5", key: "12nv4d" }],
    ["path", { d: "M10 18v3", key: "1yea0a" }],
    ["path", { d: "M14 17.75V21", key: "1pymcb" }],
    ["path", { d: "M7 18a6 6 0 0 0 3.84-10.61", key: "1npnn0" }]
  ];
  const Bird = createLucideIcon("bird", __iconNode$ms);

  const __iconNode$mr = [
    [
      "path",
      {
        d: "M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727",
        key: "yr8idg"
      }
    ]
  ];
  const Bitcoin = createLucideIcon("bitcoin", __iconNode$mr);

  const __iconNode$mq = [
    ["circle", { cx: "9", cy: "9", r: "7", key: "p2h5vp" }],
    ["circle", { cx: "15", cy: "15", r: "7", key: "19ennj" }]
  ];
  const Blend = createLucideIcon("blend", __iconNode$mq);

  const __iconNode$mp = [
    ["path", { d: "M3 3h18", key: "o7r712" }],
    ["path", { d: "M20 7H8", key: "gd2fo2" }],
    ["path", { d: "M20 11H8", key: "1ynp89" }],
    ["path", { d: "M10 19h10", key: "19hjk5" }],
    ["path", { d: "M8 15h12", key: "1yqzne" }],
    ["path", { d: "M4 3v14", key: "fggqzn" }],
    ["circle", { cx: "4", cy: "19", r: "2", key: "p3m9r0" }]
  ];
  const Blinds = createLucideIcon("blinds", __iconNode$mp);

  const __iconNode$mo = [
    [
      "path",
      {
        d: "M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2",
        key: "1ah6g2"
      }
    ],
    ["rect", { x: "14", y: "2", width: "8", height: "8", rx: "1", key: "88lufb" }]
  ];
  const Blocks = createLucideIcon("blocks", __iconNode$mo);

  const __iconNode$mn = [
    ["path", { d: "m7 7 10 10-5 5V2l5 5L7 17", key: "1q5490" }],
    ["line", { x1: "18", x2: "21", y1: "12", y2: "12", key: "1rsjjs" }],
    ["line", { x1: "3", x2: "6", y1: "12", y2: "12", key: "11yl8c" }]
  ];
  const BluetoothConnected = createLucideIcon("bluetooth-connected", __iconNode$mn);

  const __iconNode$mm = [
    ["path", { d: "m17 17-5 5V12l-5 5", key: "v5aci6" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M14.5 9.5 17 7l-5-5v4.5", key: "1kddfz" }]
  ];
  const BluetoothOff = createLucideIcon("bluetooth-off", __iconNode$mm);

  const __iconNode$ml = [
    ["path", { d: "m7 7 10 10-5 5V2l5 5L7 17", key: "1q5490" }],
    ["path", { d: "M20.83 14.83a4 4 0 0 0 0-5.66", key: "k8tn1j" }],
    ["path", { d: "M18 12h.01", key: "yjnet6" }]
  ];
  const BluetoothSearching = createLucideIcon("bluetooth-searching", __iconNode$ml);

  const __iconNode$mk = [["path", { d: "m7 7 10 10-5 5V2l5 5L7 17", key: "1q5490" }]];
  const Bluetooth = createLucideIcon("bluetooth", __iconNode$mk);

  const __iconNode$mj = [
    [
      "path",
      { d: "M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8", key: "mg9rjx" }
    ]
  ];
  const Bold = createLucideIcon("bold", __iconNode$mj);

  const __iconNode$mi = [
    ["circle", { cx: "11", cy: "13", r: "9", key: "hd149" }],
    [
      "path",
      {
        d: "M14.35 4.65 16.3 2.7a2.41 2.41 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.95 1.95",
        key: "jp4j1b"
      }
    ],
    ["path", { d: "m22 2-1.5 1.5", key: "ay92ug" }]
  ];
  const Bomb = createLucideIcon("bomb", __iconNode$mi);

  const __iconNode$mh = [
    [
      "path",
      {
        d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
        key: "yt0hxn"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }]
  ];
  const Bolt = createLucideIcon("bolt", __iconNode$mh);

  const __iconNode$mg = [
    [
      "path",
      {
        d: "M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z",
        key: "w610uw"
      }
    ]
  ];
  const Bone = createLucideIcon("bone", __iconNode$mg);

  const __iconNode$mf = [
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["path", { d: "m8 13 4-7 4 7", key: "4rari8" }],
    ["path", { d: "M9.1 11h5.7", key: "1gkovt" }]
  ];
  const BookA = createLucideIcon("book-a", __iconNode$mf);

  const __iconNode$me = [
    ["path", { d: "M12 13h.01", key: "y0uutt" }],
    ["path", { d: "M12 6v3", key: "1m4b9j" }],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ]
  ];
  const BookAlert = createLucideIcon("book-alert", __iconNode$me);

  const __iconNode$md = [
    ["path", { d: "M12 6v7", key: "1f6ttz" }],
    ["path", { d: "M16 8v3", key: "gejaml" }],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["path", { d: "M8 8v3", key: "1qzp49" }]
  ];
  const BookAudio = createLucideIcon("book-audio", __iconNode$md);

  const __iconNode$mc = [
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["path", { d: "m9 9.5 2 2 4-4", key: "1dth82" }]
  ];
  const BookCheck = createLucideIcon("book-check", __iconNode$mc);

  const __iconNode$mb = [
    ["path", { d: "M2 16V4a2 2 0 0 1 2-2h11", key: "spzkk5" }],
    [
      "path",
      {
        d: "M22 18H11a2 2 0 1 0 0 4h10.5a.5.5 0 0 0 .5-.5v-15a.5.5 0 0 0-.5-.5H11a2 2 0 0 0-2 2v12",
        key: "1wz07i"
      }
    ],
    ["path", { d: "M5 14H4a2 2 0 1 0 0 4h1", key: "16gqf9" }]
  ];
  const BookCopy = createLucideIcon("book-copy", __iconNode$mb);

  const __iconNode$ma = [
    ["path", { d: "M12 17h1.5", key: "1gkc67" }],
    ["path", { d: "M12 22h1.5", key: "1my7sn" }],
    ["path", { d: "M12 2h1.5", key: "19tvb7" }],
    ["path", { d: "M17.5 22H19a1 1 0 0 0 1-1", key: "10akbh" }],
    ["path", { d: "M17.5 2H19a1 1 0 0 1 1 1v1.5", key: "1vrfjs" }],
    ["path", { d: "M20 14v3h-2.5", key: "1naeju" }],
    ["path", { d: "M20 8.5V10", key: "1ctpfu" }],
    ["path", { d: "M4 10V8.5", key: "1o3zg5" }],
    ["path", { d: "M4 19.5V14", key: "ob81pf" }],
    ["path", { d: "M4 4.5A2.5 2.5 0 0 1 6.5 2H8", key: "s8vcyb" }],
    ["path", { d: "M8 22H6.5a1 1 0 0 1 0-5H8", key: "1cu73q" }]
  ];
  const BookDashed = createLucideIcon("book-dashed", __iconNode$ma);

  const __iconNode$m9 = [
    ["path", { d: "M12 13V7", key: "h0r20n" }],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["path", { d: "m9 10 3 3 3-3", key: "zt5b4y" }]
  ];
  const BookDown = createLucideIcon("book-down", __iconNode$m9);

  const __iconNode$m8 = [
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["path", { d: "M8 12v-2a4 4 0 0 1 8 0v2", key: "1vsqkj" }],
    ["circle", { cx: "15", cy: "12", r: "1", key: "1tmaij" }],
    ["circle", { cx: "9", cy: "12", r: "1", key: "1vctgf" }]
  ];
  const BookHeadphones = createLucideIcon("book-headphones", __iconNode$m8);

  const __iconNode$m7 = [
    [
      "path",
      {
        d: "M16 8.2A2.22 2.22 0 0 0 13.8 6c-.8 0-1.4.3-1.8.9-.4-.6-1-.9-1.8-.9A2.22 2.22 0 0 0 8 8.2c0 .6.3 1.2.7 1.6A226.652 226.652 0 0 0 12 13a404 404 0 0 0 3.3-3.1 2.413 2.413 0 0 0 .7-1.7",
        key: "1t75a8"
      }
    ],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ]
  ];
  const BookHeart = createLucideIcon("book-heart", __iconNode$m7);

  const __iconNode$m6 = [
    ["path", { d: "m20 13.7-2.1-2.1a2 2 0 0 0-2.8 0L9.7 17", key: "q6ojf0" }],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["circle", { cx: "10", cy: "8", r: "2", key: "2qkj4p" }]
  ];
  const BookImage = createLucideIcon("book-image", __iconNode$m6);

  const __iconNode$m5 = [
    ["path", { d: "m19 3 1 1", key: "ze14oc" }],
    ["path", { d: "m20 2-4.5 4.5", key: "1sppr8" }],
    ["path", { d: "M20 7.898V21a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20", key: "1xzogz" }],
    ["path", { d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2h7.844", key: "vtdg6h" }],
    ["circle", { cx: "14", cy: "8", r: "2", key: "u49eql" }]
  ];
  const BookKey = createLucideIcon("book-key", __iconNode$m5);

  const __iconNode$m4 = [
    ["path", { d: "M10 2v8l3-3 3 3V2", key: "sqw3rj" }],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ]
  ];
  const BookMarked = createLucideIcon("book-marked", __iconNode$m4);

  const __iconNode$m3 = [
    ["path", { d: "M18 6V4a2 2 0 1 0-4 0v2", key: "1aquzs" }],
    ["path", { d: "M20 15v6a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20", key: "1rkj32" }],
    ["path", { d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H10", key: "18wgow" }],
    ["rect", { x: "12", y: "6", width: "8", height: "5", rx: "1", key: "73l30o" }]
  ];
  const BookLock = createLucideIcon("book-lock", __iconNode$m3);

  const __iconNode$m2 = [
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["path", { d: "M9 10h6", key: "9gxzsh" }]
  ];
  const BookMinus = createLucideIcon("book-minus", __iconNode$m2);

  const __iconNode$m1 = [
    ["path", { d: "M12 21V7", key: "gj6g52" }],
    ["path", { d: "m16 12 2 2 4-4", key: "mdajum" }],
    [
      "path",
      {
        d: "M22 6V4a1 1 0 0 0-1-1h-5a4 4 0 0 0-4 4 4 4 0 0 0-4-4H3a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h6a3 3 0 0 1 3 3 3 3 0 0 1 3-3h6a1 1 0 0 0 1-1v-1.3",
        key: "8arnkb"
      }
    ]
  ];
  const BookOpenCheck = createLucideIcon("book-open-check", __iconNode$m1);

  const __iconNode$m0 = [
    ["path", { d: "M12 7v14", key: "1akyts" }],
    ["path", { d: "M16 12h2", key: "7q9ll5" }],
    ["path", { d: "M16 8h2", key: "msurwy" }],
    [
      "path",
      {
        d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
        key: "ruj8y"
      }
    ],
    ["path", { d: "M6 12h2", key: "32wvfc" }],
    ["path", { d: "M6 8h2", key: "30oboj" }]
  ];
  const BookOpenText = createLucideIcon("book-open-text", __iconNode$m0);

  const __iconNode$l$ = [
    ["path", { d: "M12 7v14", key: "1akyts" }],
    [
      "path",
      {
        d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
        key: "ruj8y"
      }
    ]
  ];
  const BookOpen = createLucideIcon("book-open", __iconNode$l$);

  const __iconNode$l_ = [
    ["path", { d: "M12 7v6", key: "lw1j43" }],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["path", { d: "M9 10h6", key: "9gxzsh" }]
  ];
  const BookPlus = createLucideIcon("book-plus", __iconNode$l_);

  const __iconNode$lZ = [
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["path", { d: "M8 11h8", key: "vwpz6n" }],
    ["path", { d: "M8 7h6", key: "1f0q6e" }]
  ];
  const BookText = createLucideIcon("book-text", __iconNode$lZ);

  const __iconNode$lY = [
    ["path", { d: "M10 13h4", key: "ytezjc" }],
    ["path", { d: "M12 6v7", key: "1f6ttz" }],
    ["path", { d: "M16 8V6H8v2", key: "x8j6u4" }],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ]
  ];
  const BookType = createLucideIcon("book-type", __iconNode$lY);

  const __iconNode$lX = [
    ["path", { d: "M12 13V7", key: "h0r20n" }],
    ["path", { d: "M18 2h1a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20", key: "161d7n" }],
    ["path", { d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2", key: "1lorq7" }],
    ["path", { d: "m9 10 3-3 3 3", key: "11gsxs" }],
    ["path", { d: "m9 5 3-3 3 3", key: "l8vdw6" }]
  ];
  const BookUp2 = createLucideIcon("book-up-2", __iconNode$lX);

  const __iconNode$lW = [
    ["path", { d: "M12 13V7", key: "h0r20n" }],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["path", { d: "m9 10 3-3 3 3", key: "11gsxs" }]
  ];
  const BookUp = createLucideIcon("book-up", __iconNode$lW);

  const __iconNode$lV = [
    ["path", { d: "M15 13a3 3 0 1 0-6 0", key: "10j68g" }],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["circle", { cx: "12", cy: "8", r: "2", key: "1822b1" }]
  ];
  const BookUser = createLucideIcon("book-user", __iconNode$lV);

  const __iconNode$lU = [
    ["path", { d: "m14.5 7-5 5", key: "dy991v" }],
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ],
    ["path", { d: "m9.5 7 5 5", key: "s45iea" }]
  ];
  const BookX = createLucideIcon("book-x", __iconNode$lU);

  const __iconNode$lT = [
    [
      "path",
      {
        d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20",
        key: "k3hazp"
      }
    ]
  ];
  const Book = createLucideIcon("book", __iconNode$lT);

  const __iconNode$lS = [
    ["path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z", key: "169p4p" }],
    ["path", { d: "m9 10 2 2 4-4", key: "1gnqz4" }]
  ];
  const BookmarkCheck = createLucideIcon("bookmark-check", __iconNode$lS);

  const __iconNode$lR = [
    ["path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z", key: "1fy3hk" }],
    ["line", { x1: "15", x2: "9", y1: "10", y2: "10", key: "1gty7f" }]
  ];
  const BookmarkMinus = createLucideIcon("bookmark-minus", __iconNode$lR);

  const __iconNode$lQ = [
    ["path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z", key: "1fy3hk" }],
    ["line", { x1: "12", x2: "12", y1: "7", y2: "13", key: "1cppfj" }],
    ["line", { x1: "15", x2: "9", y1: "10", y2: "10", key: "1gty7f" }]
  ];
  const BookmarkPlus = createLucideIcon("bookmark-plus", __iconNode$lQ);

  const __iconNode$lP = [
    ["path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z", key: "169p4p" }],
    ["path", { d: "m14.5 7.5-5 5", key: "3lb6iw" }],
    ["path", { d: "m9.5 7.5 5 5", key: "ko136h" }]
  ];
  const BookmarkX = createLucideIcon("bookmark-x", __iconNode$lP);

  const __iconNode$lO = [
    ["path", { d: "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z", key: "1fy3hk" }]
  ];
  const Bookmark = createLucideIcon("bookmark", __iconNode$lO);

  const __iconNode$lN = [
    ["path", { d: "M4 9V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4", key: "vvzvr1" }],
    ["path", { d: "M8 8v1", key: "xcqmfk" }],
    ["path", { d: "M12 8v1", key: "1rj8u4" }],
    ["path", { d: "M16 8v1", key: "1q12zr" }],
    ["rect", { width: "20", height: "12", x: "2", y: "9", rx: "2", key: "igpb89" }],
    ["circle", { cx: "8", cy: "15", r: "2", key: "fa4a8s" }],
    ["circle", { cx: "16", cy: "15", r: "2", key: "14c3ya" }]
  ];
  const BoomBox = createLucideIcon("boom-box", __iconNode$lN);

  const __iconNode$lM = [
    ["path", { d: "M12 6V2H8", key: "1155em" }],
    ["path", { d: "m8 18-4 4V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2Z", key: "w2lp3e" }],
    ["path", { d: "M2 12h2", key: "1t8f8n" }],
    ["path", { d: "M9 11v2", key: "1ueba0" }],
    ["path", { d: "M15 11v2", key: "i11awn" }],
    ["path", { d: "M20 12h2", key: "1q8mjw" }]
  ];
  const BotMessageSquare = createLucideIcon("bot-message-square", __iconNode$lM);

  const __iconNode$lL = [
    ["path", { d: "M13.67 8H18a2 2 0 0 1 2 2v4.33", key: "7az073" }],
    ["path", { d: "M2 14h2", key: "vft8re" }],
    ["path", { d: "M20 14h2", key: "4cs60a" }],
    ["path", { d: "M22 22 2 2", key: "1r8tn9" }],
    ["path", { d: "M8 8H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 1.414-.586", key: "s09a7a" }],
    ["path", { d: "M9 13v2", key: "rq6x2g" }],
    ["path", { d: "M9.67 4H12v2.33", key: "110xot" }]
  ];
  const BotOff = createLucideIcon("bot-off", __iconNode$lL);

  const __iconNode$lK = [
    ["path", { d: "M12 8V4H8", key: "hb8ula" }],
    ["rect", { width: "16", height: "12", x: "4", y: "8", rx: "2", key: "enze0r" }],
    ["path", { d: "M2 14h2", key: "vft8re" }],
    ["path", { d: "M20 14h2", key: "4cs60a" }],
    ["path", { d: "M15 13v2", key: "1xurst" }],
    ["path", { d: "M9 13v2", key: "rq6x2g" }]
  ];
  const Bot = createLucideIcon("bot", __iconNode$lK);

  const __iconNode$lJ = [
    ["path", { d: "M17 3h4v4", key: "19p9u1" }],
    [
      "path",
      { d: "M18.575 11.082a13 13 0 0 1 1.048 9.027 1.17 1.17 0 0 1-1.914.597L14 17", key: "12t3w9" }
    ],
    ["path", { d: "M7 10 3.29 6.29a1.17 1.17 0 0 1 .6-1.91 13 13 0 0 1 9.03 1.05", key: "ogng5l" }],
    [
      "path",
      {
        d: "M7 14a1.7 1.7 0 0 0-1.207.5l-2.646 2.646A.5.5 0 0 0 3.5 18H5a1 1 0 0 1 1 1v1.5a.5.5 0 0 0 .854.354L9.5 18.207A1.7 1.7 0 0 0 10 17v-2a1 1 0 0 0-1-1z",
        key: "8v3fy2"
      }
    ],
    ["path", { d: "M9.707 14.293 21 3", key: "ydm3bn" }]
  ];
  const BowArrow = createLucideIcon("bow-arrow", __iconNode$lJ);

  const __iconNode$lI = [
    [
      "path",
      {
        d: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
        key: "hh9hay"
      }
    ],
    ["path", { d: "m3.3 7 8.7 5 8.7-5", key: "g66t2b" }],
    ["path", { d: "M12 22V12", key: "d0xqtd" }]
  ];
  const Box = createLucideIcon("box", __iconNode$lI);

  const __iconNode$lH = [
    [
      "path",
      {
        d: "M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z",
        key: "lc1i9w"
      }
    ],
    ["path", { d: "m7 16.5-4.74-2.85", key: "1o9zyk" }],
    ["path", { d: "m7 16.5 5-3", key: "va8pkn" }],
    ["path", { d: "M7 16.5v5.17", key: "jnp8gn" }],
    [
      "path",
      {
        d: "M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z",
        key: "8zsnat"
      }
    ],
    ["path", { d: "m17 16.5-5-3", key: "8arw3v" }],
    ["path", { d: "m17 16.5 4.74-2.85", key: "8rfmw" }],
    ["path", { d: "M17 16.5v5.17", key: "k6z78m" }],
    [
      "path",
      {
        d: "M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z",
        key: "1xygjf"
      }
    ],
    ["path", { d: "M12 8 7.26 5.15", key: "1vbdud" }],
    ["path", { d: "m12 8 4.74-2.85", key: "3rx089" }],
    ["path", { d: "M12 13.5V8", key: "1io7kd" }]
  ];
  const Boxes = createLucideIcon("boxes", __iconNode$lH);

  const __iconNode$lG = [
    [
      "path",
      { d: "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1", key: "ezmyqa" }
    ],
    [
      "path",
      {
        d: "M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1",
        key: "e1hn23"
      }
    ]
  ];
  const Braces = createLucideIcon("braces", __iconNode$lG);

  const __iconNode$lF = [
    ["path", { d: "M16 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-3", key: "1kt8lf" }],
    ["path", { d: "M8 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3", key: "gduv9" }]
  ];
  const Brackets = createLucideIcon("brackets", __iconNode$lF);

  const __iconNode$lE = [
    [
      "path",
      {
        d: "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",
        key: "l5xja"
      }
    ],
    ["path", { d: "M9 13a4.5 4.5 0 0 0 3-4", key: "10igwf" }],
    ["path", { d: "M6.003 5.125A3 3 0 0 0 6.401 6.5", key: "105sqy" }],
    ["path", { d: "M3.477 10.896a4 4 0 0 1 .585-.396", key: "ql3yin" }],
    ["path", { d: "M6 18a4 4 0 0 1-1.967-.516", key: "2e4loj" }],
    ["path", { d: "M12 13h4", key: "1ku699" }],
    ["path", { d: "M12 18h6a2 2 0 0 1 2 2v1", key: "105ag5" }],
    ["path", { d: "M12 8h8", key: "1lhi5i" }],
    ["path", { d: "M16 8V5a2 2 0 0 1 2-2", key: "u6izg6" }],
    ["circle", { cx: "16", cy: "13", r: ".5", key: "ry7gng" }],
    ["circle", { cx: "18", cy: "3", r: ".5", key: "1aiba7" }],
    ["circle", { cx: "20", cy: "21", r: ".5", key: "yhc1fs" }],
    ["circle", { cx: "20", cy: "8", r: ".5", key: "1e43v0" }]
  ];
  const BrainCircuit = createLucideIcon("brain-circuit", __iconNode$lE);

  const __iconNode$lD = [
    ["path", { d: "m10.852 14.772-.383.923", key: "11vil6" }],
    ["path", { d: "m10.852 9.228-.383-.923", key: "1fjppe" }],
    ["path", { d: "m13.148 14.772.382.924", key: "je3va1" }],
    ["path", { d: "m13.531 8.305-.383.923", key: "18epck" }],
    ["path", { d: "m14.772 10.852.923-.383", key: "k9m8cz" }],
    ["path", { d: "m14.772 13.148.923.383", key: "1xvhww" }],
    [
      "path",
      {
        d: "M17.598 6.5A3 3 0 1 0 12 5a3 3 0 0 0-5.63-1.446 3 3 0 0 0-.368 1.571 4 4 0 0 0-2.525 5.771",
        key: "jcbbz1"
      }
    ],
    ["path", { d: "M17.998 5.125a4 4 0 0 1 2.525 5.771", key: "1kkn7e" }],
    ["path", { d: "M19.505 10.294a4 4 0 0 1-1.5 7.706", key: "18bmuc" }],
    [
      "path",
      {
        d: "M4.032 17.483A4 4 0 0 0 11.464 20c.18-.311.892-.311 1.072 0a4 4 0 0 0 7.432-2.516",
        key: "uozx0d"
      }
    ],
    ["path", { d: "M4.5 10.291A4 4 0 0 0 6 18", key: "whdemb" }],
    ["path", { d: "M6.002 5.125a3 3 0 0 0 .4 1.375", key: "1kqy2g" }],
    ["path", { d: "m9.228 10.852-.923-.383", key: "1wtb30" }],
    ["path", { d: "m9.228 13.148-.923.383", key: "1a830x" }],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
  ];
  const BrainCog = createLucideIcon("brain-cog", __iconNode$lD);

  const __iconNode$lC = [
    [
      "path",
      {
        d: "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",
        key: "l5xja"
      }
    ],
    [
      "path",
      {
        d: "M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",
        key: "ep3f8r"
      }
    ],
    ["path", { d: "M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4", key: "1p4c4q" }],
    ["path", { d: "M17.599 6.5a3 3 0 0 0 .399-1.375", key: "tmeiqw" }],
    ["path", { d: "M6.003 5.125A3 3 0 0 0 6.401 6.5", key: "105sqy" }],
    ["path", { d: "M3.477 10.896a4 4 0 0 1 .585-.396", key: "ql3yin" }],
    ["path", { d: "M19.938 10.5a4 4 0 0 1 .585.396", key: "1qfode" }],
    ["path", { d: "M6 18a4 4 0 0 1-1.967-.516", key: "2e4loj" }],
    ["path", { d: "M19.967 17.484A4 4 0 0 1 18 18", key: "159ez6" }]
  ];
  const Brain = createLucideIcon("brain", __iconNode$lC);

  const __iconNode$lB = [
    ["path", { d: "M16 3v2.107", key: "gq8xun" }],
    [
      "path",
      {
        d: "M17 9c1 3 2.5 3.5 3.5 4.5A5 5 0 0 1 22 17a5 5 0 0 1-10 0c0-.3 0-.6.1-.9a2 2 0 1 0 3.3-2C13 11.5 16 9 17 9",
        key: "1l2pih"
      }
    ],
    [
      "path",
      { d: "M21 8.274V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.938", key: "jrnqjp" }
    ],
    ["path", { d: "M3 15h5.253", key: "xqg7rb" }],
    ["path", { d: "M3 9h8.228", key: "1ppb70" }],
    ["path", { d: "M8 15v6", key: "1stoo3" }],
    ["path", { d: "M8 3v6", key: "vlvjmk" }]
  ];
  const BrickWallFire = createLucideIcon("brick-wall-fire", __iconNode$lB);

  const __iconNode$lA = [
    ["path", { d: "M12 12h.01", key: "1mp3jc" }],
    ["path", { d: "M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2", key: "1ksdt3" }],
    ["path", { d: "M22 13a18.15 18.15 0 0 1-20 0", key: "12hx5q" }],
    ["rect", { width: "20", height: "14", x: "2", y: "6", rx: "2", key: "i6l2r4" }]
  ];
  const BriefcaseBusiness = createLucideIcon("briefcase-business", __iconNode$lA);

  const __iconNode$lz = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M12 9v6", key: "199k2o" }],
    ["path", { d: "M16 15v6", key: "8rj2es" }],
    ["path", { d: "M16 3v6", key: "1j6rpj" }],
    ["path", { d: "M3 15h18", key: "5xshup" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["path", { d: "M8 15v6", key: "1stoo3" }],
    ["path", { d: "M8 3v6", key: "vlvjmk" }]
  ];
  const BrickWall = createLucideIcon("brick-wall", __iconNode$lz);

  const __iconNode$ly = [
    ["path", { d: "M10 20v2", key: "1n8e1g" }],
    ["path", { d: "M14 20v2", key: "1lq872" }],
    ["path", { d: "M18 20v2", key: "10uadw" }],
    ["path", { d: "M21 20H3", key: "kdqkdp" }],
    ["path", { d: "M6 20v2", key: "a9bc87" }],
    ["path", { d: "M8 16V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12", key: "17n9tx" }],
    ["rect", { x: "4", y: "6", width: "16", height: "10", rx: "2", key: "1097i5" }]
  ];
  const BriefcaseConveyorBelt = createLucideIcon("briefcase-conveyor-belt", __iconNode$ly);

  const __iconNode$lx = [
    ["path", { d: "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16", key: "jecpp" }],
    ["rect", { width: "20", height: "14", x: "2", y: "6", rx: "2", key: "i6l2r4" }]
  ];
  const Briefcase = createLucideIcon("briefcase", __iconNode$lx);

  const __iconNode$lw = [
    ["path", { d: "M12 11v4", key: "a6ujw6" }],
    ["path", { d: "M14 13h-4", key: "1pl8zg" }],
    ["path", { d: "M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2", key: "1ksdt3" }],
    ["path", { d: "M18 6v14", key: "1mu4gy" }],
    ["path", { d: "M6 6v14", key: "1s15cj" }],
    ["rect", { width: "20", height: "14", x: "2", y: "6", rx: "2", key: "i6l2r4" }]
  ];
  const BriefcaseMedical = createLucideIcon("briefcase-medical", __iconNode$lw);

  const __iconNode$lv = [
    ["rect", { x: "8", y: "8", width: "8", height: "8", rx: "2", key: "yj20xf" }],
    ["path", { d: "M4 10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2", key: "1ltk23" }],
    ["path", { d: "M14 20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2", key: "1q24h9" }]
  ];
  const BringToFront = createLucideIcon("bring-to-front", __iconNode$lv);

  const __iconNode$lu = [
    ["path", { d: "m16 22-1-4", key: "1ow2iv" }],
    [
      "path",
      {
        d: "M19 13.99a1 1 0 0 0 1-1V12a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v.99a1 1 0 0 0 1 1",
        key: "iw8jdu"
      }
    ],
    ["path", { d: "M5 14h14l1.973 6.767A1 1 0 0 1 20 22H4a1 1 0 0 1-.973-1.233z", key: "1soew8" }],
    ["path", { d: "m8 22 1-4", key: "s3unb" }]
  ];
  const BrushCleaning = createLucideIcon("brush-cleaning", __iconNode$lu);

  const __iconNode$lt = [
    ["path", { d: "m11 10 3 3", key: "fzmg1i" }],
    [
      "path",
      { d: "M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z", key: "p4q2r7" }
    ],
    ["path", { d: "M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031", key: "wy6l02" }]
  ];
  const Brush = createLucideIcon("brush", __iconNode$lt);

  const __iconNode$ls = [
    ["path", { d: "M7.2 14.8a2 2 0 0 1 2 2", key: "1tw9gg" }],
    ["circle", { cx: "18.5", cy: "8.5", r: "3.5", key: "1wadoa" }],
    ["circle", { cx: "7.5", cy: "16.5", r: "5.5", key: "6mdt3g" }],
    ["circle", { cx: "7.5", cy: "4.5", r: "2.5", key: "637s54" }]
  ];
  const Bubbles = createLucideIcon("bubbles", __iconNode$ls);

  const __iconNode$lr = [
    ["path", { d: "M15 7.13V6a3 3 0 0 0-5.14-2.1L8 2", key: "vl8zik" }],
    ["path", { d: "M14.12 3.88 16 2", key: "qol33r" }],
    ["path", { d: "M22 13h-4v-2a4 4 0 0 0-4-4h-1.3", key: "1ou0bd" }],
    ["path", { d: "M20.97 5c0 2.1-1.6 3.8-3.5 4", key: "18gb23" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M7.7 7.7A4 4 0 0 0 6 11v3a6 6 0 0 0 11.13 3.13", key: "1njkjs" }],
    ["path", { d: "M12 20v-8", key: "i3yub9" }],
    ["path", { d: "M6 13H2", key: "82j7cp" }],
    ["path", { d: "M3 21c0-2.1 1.7-3.9 3.8-4", key: "4p0ekp" }]
  ];
  const BugOff = createLucideIcon("bug-off", __iconNode$lr);

  const __iconNode$lq = [
    [
      "path",
      {
        d: "M12.765 21.522a.5.5 0 0 1-.765-.424v-8.196a.5.5 0 0 1 .765-.424l5.878 3.674a1 1 0 0 1 0 1.696z",
        key: "17shqo"
      }
    ],
    ["path", { d: "M14.12 3.88 16 2", key: "qol33r" }],
    ["path", { d: "M18 11a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v3a6.1 6.1 0 0 0 2 4.5", key: "1tjixy" }],
    ["path", { d: "M20.97 5c0 2.1-1.6 3.8-3.5 4", key: "18gb23" }],
    ["path", { d: "M3 21c0-2.1 1.7-3.9 3.8-4", key: "4p0ekp" }],
    ["path", { d: "M6 13H2", key: "82j7cp" }],
    ["path", { d: "M6.53 9C4.6 8.8 3 7.1 3 5", key: "32zzws" }],
    ["path", { d: "m8 2 1.88 1.88", key: "fmnt4t" }],
    ["path", { d: "M9 7.13v-1a3.003 3.003 0 1 1 6 0v1", key: "d7y7pr" }]
  ];
  const BugPlay = createLucideIcon("bug-play", __iconNode$lq);

  const __iconNode$lp = [
    ["path", { d: "m8 2 1.88 1.88", key: "fmnt4t" }],
    ["path", { d: "M14.12 3.88 16 2", key: "qol33r" }],
    ["path", { d: "M9 7.13v-1a3.003 3.003 0 1 1 6 0v1", key: "d7y7pr" }],
    [
      "path",
      {
        d: "M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6",
        key: "xs1cw7"
      }
    ],
    ["path", { d: "M12 20v-9", key: "1qisl0" }],
    ["path", { d: "M6.53 9C4.6 8.8 3 7.1 3 5", key: "32zzws" }],
    ["path", { d: "M6 13H2", key: "82j7cp" }],
    ["path", { d: "M3 21c0-2.1 1.7-3.9 3.8-4", key: "4p0ekp" }],
    ["path", { d: "M20.97 5c0 2.1-1.6 3.8-3.5 4", key: "18gb23" }],
    ["path", { d: "M22 13h-4", key: "1jl80f" }],
    ["path", { d: "M17.2 17c2.1.1 3.8 1.9 3.8 4", key: "k3fwyw" }]
  ];
  const Bug = createLucideIcon("bug", __iconNode$lp);

  const __iconNode$lo = [
    ["path", { d: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z", key: "1b4qmf" }],
    ["path", { d: "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2", key: "i71pzd" }],
    ["path", { d: "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2", key: "10jefs" }],
    ["path", { d: "M10 6h4", key: "1itunk" }],
    ["path", { d: "M10 10h4", key: "tcdvrf" }],
    ["path", { d: "M10 14h4", key: "kelpxr" }],
    ["path", { d: "M10 18h4", key: "1ulq68" }]
  ];
  const Building2 = createLucideIcon("building-2", __iconNode$lo);

  const __iconNode$ln = [
    ["rect", { width: "16", height: "20", x: "4", y: "2", rx: "2", ry: "2", key: "76otgf" }],
    ["path", { d: "M9 22v-4h6v4", key: "r93iot" }],
    ["path", { d: "M8 6h.01", key: "1dz90k" }],
    ["path", { d: "M16 6h.01", key: "1x0f13" }],
    ["path", { d: "M12 6h.01", key: "1vi96p" }],
    ["path", { d: "M12 10h.01", key: "1nrarc" }],
    ["path", { d: "M12 14h.01", key: "1etili" }],
    ["path", { d: "M16 10h.01", key: "1m94wz" }],
    ["path", { d: "M16 14h.01", key: "1gbofw" }],
    ["path", { d: "M8 10h.01", key: "19clt8" }],
    ["path", { d: "M8 14h.01", key: "6423bh" }]
  ];
  const Building = createLucideIcon("building", __iconNode$ln);

  const __iconNode$lm = [
    ["path", { d: "M4 6 2 7", key: "1mqr15" }],
    ["path", { d: "M10 6h4", key: "1itunk" }],
    ["path", { d: "m22 7-2-1", key: "1umjhc" }],
    ["rect", { width: "16", height: "16", x: "4", y: "3", rx: "2", key: "1wxw4b" }],
    ["path", { d: "M4 11h16", key: "mpoxn0" }],
    ["path", { d: "M8 15h.01", key: "a7atzg" }],
    ["path", { d: "M16 15h.01", key: "rnfrdf" }],
    ["path", { d: "M6 19v2", key: "1loha6" }],
    ["path", { d: "M18 21v-2", key: "sqyl04" }]
  ];
  const BusFront = createLucideIcon("bus-front", __iconNode$lm);

  const __iconNode$ll = [
    ["path", { d: "M8 6v6", key: "18i7km" }],
    ["path", { d: "M15 6v6", key: "1sg6z9" }],
    ["path", { d: "M2 12h19.6", key: "de5uta" }],
    [
      "path",
      {
        d: "M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3",
        key: "1wwztk"
      }
    ],
    ["circle", { cx: "7", cy: "18", r: "2", key: "19iecd" }],
    ["path", { d: "M9 18h5", key: "lrx6i" }],
    ["circle", { cx: "16", cy: "18", r: "2", key: "1v4tcr" }]
  ];
  const Bus = createLucideIcon("bus", __iconNode$ll);

  const __iconNode$lk = [
    ["path", { d: "M10 3h.01", key: "lbucoy" }],
    ["path", { d: "M14 2h.01", key: "1k8aa1" }],
    ["path", { d: "m2 9 20-5", key: "1kz0j5" }],
    ["path", { d: "M12 12V6.5", key: "1vbrij" }],
    ["rect", { width: "16", height: "10", x: "4", y: "12", rx: "3", key: "if91er" }],
    ["path", { d: "M9 12v5", key: "3anwtq" }],
    ["path", { d: "M15 12v5", key: "5xh3zn" }],
    ["path", { d: "M4 17h16", key: "g4d7ey" }]
  ];
  const CableCar = createLucideIcon("cable-car", __iconNode$lk);

  const __iconNode$lj = [
    [
      "path",
      {
        d: "M17 21v-2a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1",
        key: "10bnsj"
      }
    ],
    ["path", { d: "M19 15V6.5a1 1 0 0 0-7 0v11a1 1 0 0 1-7 0V9", key: "1eqmu1" }],
    ["path", { d: "M21 21v-2h-4", key: "14zm7j" }],
    ["path", { d: "M3 5h4V3", key: "z442eg" }],
    [
      "path",
      { d: "M7 5a1 1 0 0 1 1 1v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1V3", key: "ebdjd7" }
    ]
  ];
  const Cable = createLucideIcon("cable", __iconNode$lj);

  const __iconNode$li = [
    ["circle", { cx: "9", cy: "7", r: "2", key: "1305pl" }],
    [
      "path",
      { d: "M7.2 7.9 3 11v9c0 .6.4 1 1 1h16c.6 0 1-.4 1-1v-9c0-2-3-6-7-8l-3.6 2.6", key: "xle13f" }
    ],
    ["path", { d: "M16 13H3", key: "1wpj08" }],
    ["path", { d: "M16 17H3", key: "3lvfcd" }]
  ];
  const CakeSlice = createLucideIcon("cake-slice", __iconNode$li);

  const __iconNode$lh = [
    ["path", { d: "M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8", key: "1w3rig" }],
    ["path", { d: "M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1", key: "n2jgmb" }],
    ["path", { d: "M2 21h20", key: "1nyx9w" }],
    ["path", { d: "M7 8v3", key: "1qtyvj" }],
    ["path", { d: "M12 8v3", key: "hwp4zt" }],
    ["path", { d: "M17 8v3", key: "1i6e5u" }],
    ["path", { d: "M7 4h.01", key: "1bh4kh" }],
    ["path", { d: "M12 4h.01", key: "1ujb9j" }],
    ["path", { d: "M17 4h.01", key: "1upcoc" }]
  ];
  const Cake = createLucideIcon("cake", __iconNode$lh);

  const __iconNode$lg = [
    ["rect", { width: "16", height: "20", x: "4", y: "2", rx: "2", key: "1nb95v" }],
    ["line", { x1: "8", x2: "16", y1: "6", y2: "6", key: "x4nwl0" }],
    ["line", { x1: "16", x2: "16", y1: "14", y2: "18", key: "wjye3r" }],
    ["path", { d: "M16 10h.01", key: "1m94wz" }],
    ["path", { d: "M12 10h.01", key: "1nrarc" }],
    ["path", { d: "M8 10h.01", key: "19clt8" }],
    ["path", { d: "M12 14h.01", key: "1etili" }],
    ["path", { d: "M8 14h.01", key: "6423bh" }],
    ["path", { d: "M12 18h.01", key: "mhygvu" }],
    ["path", { d: "M8 18h.01", key: "lrp35t" }]
  ];
  const Calculator = createLucideIcon("calculator", __iconNode$lg);

  const __iconNode$lf = [
    ["path", { d: "M11 14h1v4", key: "fy54vd" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", key: "12vinp" }]
  ];
  const Calendar1 = createLucideIcon("calendar-1", __iconNode$lf);

  const __iconNode$le = [
    ["path", { d: "m14 18 4 4 4-4", key: "1waygx" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M18 14v8", key: "irew45" }],
    [
      "path",
      { d: "M21 11.354V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.343", key: "bse4f3" }
    ],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }]
  ];
  const CalendarArrowDown = createLucideIcon("calendar-arrow-down", __iconNode$le);

  const __iconNode$ld = [
    ["path", { d: "m14 18 4-4 4 4", key: "ftkppy" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M18 22v-8", key: "su0gjh" }],
    ["path", { d: "M21 11.343V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9", key: "1exg90" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }]
  ];
  const CalendarArrowUp = createLucideIcon("calendar-arrow-up", __iconNode$ld);

  const __iconNode$lc = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8", key: "bce9hv" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "m16 20 2 2 4-4", key: "13tcca" }]
  ];
  const CalendarCheck2 = createLucideIcon("calendar-check-2", __iconNode$lc);

  const __iconNode$lb = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "m9 16 2 2 4-4", key: "19s6y9" }]
  ];
  const CalendarCheck = createLucideIcon("calendar-check", __iconNode$lb);

  const __iconNode$la = [
    ["path", { d: "M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5", key: "1osxxc" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M3 10h5", key: "r794hk" }],
    ["path", { d: "M17.5 17.5 16 16.3V14", key: "akvzfd" }],
    ["circle", { cx: "16", cy: "16", r: "6", key: "qoo3c4" }]
  ];
  const CalendarClock = createLucideIcon("calendar-clock", __iconNode$la);

  const __iconNode$l9 = [
    ["path", { d: "m15.228 16.852-.923-.383", key: "npixar" }],
    ["path", { d: "m15.228 19.148-.923.383", key: "51cr3n" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "m16.47 14.305.382.923", key: "obybxd" }],
    ["path", { d: "m16.852 20.772-.383.924", key: "dpfhf9" }],
    ["path", { d: "m19.148 15.228.383-.923", key: "1reyyz" }],
    ["path", { d: "m19.53 21.696-.382-.924", key: "1goivc" }],
    ["path", { d: "m20.772 16.852.924-.383", key: "htqkph" }],
    ["path", { d: "m20.772 19.148.924.383", key: "9w9pjp" }],
    ["path", { d: "M21 11V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6", key: "1dju0s" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }]
  ];
  const CalendarCog = createLucideIcon("calendar-cog", __iconNode$l9);

  const __iconNode$l8 = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 14h.01", key: "6423bh" }],
    ["path", { d: "M12 14h.01", key: "1etili" }],
    ["path", { d: "M16 14h.01", key: "1gbofw" }],
    ["path", { d: "M8 18h.01", key: "lrp35t" }],
    ["path", { d: "M12 18h.01", key: "mhygvu" }],
    ["path", { d: "M16 18h.01", key: "kzsmim" }]
  ];
  const CalendarDays = createLucideIcon("calendar-days", __iconNode$l8);

  const __iconNode$l7 = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M21 17V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11Z", key: "kg77oy" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M15 22v-4a2 2 0 0 1 2-2h4", key: "1gnbqr" }]
  ];
  const CalendarFold = createLucideIcon("calendar-fold", __iconNode$l7);

  const __iconNode$l6 = [
    ["path", { d: "M3 10h18V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7", key: "136lmk" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    [
      "path",
      {
        d: "M21.29 14.7a2.43 2.43 0 0 0-2.65-.52c-.3.12-.57.3-.8.53l-.34.34-.35-.34a2.43 2.43 0 0 0-2.65-.53c-.3.12-.56.3-.79.53-.95.94-1 2.53.2 3.74L17.5 22l3.6-3.55c1.2-1.21 1.14-2.8.19-3.74Z",
        key: "1t7hil"
      }
    ]
  ];
  const CalendarHeart = createLucideIcon("calendar-heart", __iconNode$l6);

  const __iconNode$l5 = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M10 16h4", key: "17e571" }]
  ];
  const CalendarMinus2 = createLucideIcon("calendar-minus-2", __iconNode$l5);

  const __iconNode$l4 = [
    ["path", { d: "M16 19h6", key: "xwg31i" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.5", key: "1scpom" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }]
  ];
  const CalendarMinus = createLucideIcon("calendar-minus", __iconNode$l4);

  const __iconNode$l3 = [
    ["path", { d: "M4.2 4.2A2 2 0 0 0 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 1.82-1.18", key: "16swn3" }],
    ["path", { d: "M21 15.5V6a2 2 0 0 0-2-2H9.5", key: "yhw86o" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M3 10h7", key: "1wap6i" }],
    ["path", { d: "M21 10h-5.5", key: "quycpq" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const CalendarOff = createLucideIcon("calendar-off", __iconNode$l3);

  const __iconNode$l2 = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M10 16h4", key: "17e571" }],
    ["path", { d: "M12 14v4", key: "1thi36" }]
  ];
  const CalendarPlus2 = createLucideIcon("calendar-plus-2", __iconNode$l2);

  const __iconNode$l1 = [
    ["path", { d: "M16 19h6", key: "xwg31i" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M19 16v6", key: "tddt3s" }],
    ["path", { d: "M21 12.598V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.5", key: "1glfrc" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }]
  ];
  const CalendarPlus = createLucideIcon("calendar-plus", __iconNode$l1);

  const __iconNode$l0 = [
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M17 14h-6", key: "bkmgh3" }],
    ["path", { d: "M13 18H7", key: "bb0bb7" }],
    ["path", { d: "M7 14h.01", key: "1qa3f1" }],
    ["path", { d: "M17 18h.01", key: "1bdyru" }]
  ];
  const CalendarRange = createLucideIcon("calendar-range", __iconNode$l0);

  const __iconNode$k$ = [
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M21 11.75V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.25", key: "1jrsq6" }],
    ["path", { d: "m22 22-1.875-1.875", key: "13zax7" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }]
  ];
  const CalendarSearch = createLucideIcon("calendar-search", __iconNode$k$);

  const __iconNode$k_ = [
    ["path", { d: "M11 10v4h4", key: "172dkj" }],
    ["path", { d: "m11 14 1.535-1.605a5 5 0 0 1 8 1.5", key: "vu0qm5" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "m21 18-1.535 1.605a5 5 0 0 1-8-1.5", key: "1qgeyt" }],
    ["path", { d: "M21 22v-4h-4", key: "hrummi" }],
    ["path", { d: "M21 8.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4.3", key: "mctw84" }],
    ["path", { d: "M3 10h4", key: "1el30a" }],
    ["path", { d: "M8 2v4", key: "1cmpym" }]
  ];
  const CalendarSync = createLucideIcon("calendar-sync", __iconNode$k_);

  const __iconNode$kZ = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8", key: "3spt84" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "m17 22 5-5", key: "1k6ppv" }],
    ["path", { d: "m17 17 5 5", key: "p7ous7" }]
  ];
  const CalendarX2 = createLucideIcon("calendar-x-2", __iconNode$kZ);

  const __iconNode$kY = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
    ["path", { d: "M3 10h18", key: "8toen8" }]
  ];
  const Calendar = createLucideIcon("calendar", __iconNode$kY);

  const __iconNode$kX = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" }],
    ["path", { d: "M3 10h18", key: "8toen8" }],
    ["path", { d: "m14 14-4 4", key: "rymu2i" }],
    ["path", { d: "m10 14 4 4", key: "3sz06r" }]
  ];
  const CalendarX = createLucideIcon("calendar-x", __iconNode$kX);

  const __iconNode$kW = [
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }],
    ["path", { d: "M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16", key: "qmtpty" }],
    ["path", { d: "M9.5 4h5L17 7h3a2 2 0 0 1 2 2v7.5", key: "1ufyfc" }],
    ["path", { d: "M14.121 15.121A3 3 0 1 1 9.88 10.88", key: "11zox6" }]
  ];
  const CameraOff = createLucideIcon("camera-off", __iconNode$kW);

  const __iconNode$kV = [
    [
      "path",
      {
        d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z",
        key: "1tc9qg"
      }
    ],
    ["circle", { cx: "12", cy: "13", r: "3", key: "1vg3eu" }]
  ];
  const Camera = createLucideIcon("camera", __iconNode$kV);

  const __iconNode$kU = [
    [
      "path",
      {
        d: "M5.7 21a2 2 0 0 1-3.5-2l8.6-14a6 6 0 0 1 10.4 6 2 2 0 1 1-3.464-2 2 2 0 1 0-3.464-2Z",
        key: "isaq8g"
      }
    ],
    ["path", { d: "M17.75 7 15 2.1", key: "12x7e8" }],
    ["path", { d: "M10.9 4.8 13 9", key: "100a87" }],
    ["path", { d: "m7.9 9.7 2 4.4", key: "ntfhaj" }],
    ["path", { d: "M4.9 14.7 7 18.9", key: "1x43jy" }]
  ];
  const CandyCane = createLucideIcon("candy-cane", __iconNode$kU);

  const __iconNode$kT = [
    ["path", { d: "M10 10v7.9", key: "m8g9tt" }],
    ["path", { d: "M11.802 6.145a5 5 0 0 1 6.053 6.053", key: "dn87i3" }],
    ["path", { d: "M14 6.1v2.243", key: "1kzysn" }],
    [
      "path",
      { d: "m15.5 15.571-.964.964a5 5 0 0 1-7.071 0 5 5 0 0 1 0-7.07l.964-.965", key: "3sxy18" }
    ],
    [
      "path",
      {
        d: "M16 7V3a1 1 0 0 1 1.707-.707 2.5 2.5 0 0 0 2.152.717 1 1 0 0 1 1.131 1.131 2.5 2.5 0 0 0 .717 2.152A1 1 0 0 1 21 8h-4",
        key: "gpb6xx"
      }
    ],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    [
      "path",
      {
        d: "M8 17v4a1 1 0 0 1-1.707.707 2.5 2.5 0 0 0-2.152-.717 1 1 0 0 1-1.131-1.131 2.5 2.5 0 0 0-.717-2.152A1 1 0 0 1 3 16h4",
        key: "qexcha"
      }
    ]
  ];
  const CandyOff = createLucideIcon("candy-off", __iconNode$kT);

  const __iconNode$kS = [
    ["path", { d: "M10 7v10.9", key: "1gynux" }],
    ["path", { d: "M14 6.1V17", key: "116kdf" }],
    [
      "path",
      {
        d: "M16 7V3a1 1 0 0 1 1.707-.707 2.5 2.5 0 0 0 2.152.717 1 1 0 0 1 1.131 1.131 2.5 2.5 0 0 0 .717 2.152A1 1 0 0 1 21 8h-4",
        key: "gpb6xx"
      }
    ],
    [
      "path",
      {
        d: "M16.536 7.465a5 5 0 0 0-7.072 0l-2 2a5 5 0 0 0 0 7.07 5 5 0 0 0 7.072 0l2-2a5 5 0 0 0 0-7.07",
        key: "1tsln4"
      }
    ],
    [
      "path",
      {
        d: "M8 17v4a1 1 0 0 1-1.707.707 2.5 2.5 0 0 0-2.152-.717 1 1 0 0 1-1.131-1.131 2.5 2.5 0 0 0-.717-2.152A1 1 0 0 1 3 16h4",
        key: "qexcha"
      }
    ]
  ];
  const Candy = createLucideIcon("candy", __iconNode$kS);

  const __iconNode$kR = [
    ["path", { d: "M12 22v-4", key: "1utk9m" }],
    [
      "path",
      {
        d: "M7 12c-1.5 0-4.5 1.5-5 3 3.5 1.5 6 1 6 1-1.5 1.5-2 3.5-2 5 2.5 0 4.5-1.5 6-3 1.5 1.5 3.5 3 6 3 0-1.5-.5-3.5-2-5 0 0 2.5.5 6-1-.5-1.5-3.5-3-5-3 1.5-1 4-4 4-6-2.5 0-5.5 1.5-7 3 0-2.5-.5-5-2-7-1.5 2-2 4.5-2 7-1.5-1.5-4.5-3-7-3 0 2 2.5 5 4 6",
        key: "1mezod"
      }
    ]
  ];
  const Cannabis = createLucideIcon("cannabis", __iconNode$kR);

  const __iconNode$kQ = [
    ["path", { d: "M10.5 5H19a2 2 0 0 1 2 2v8.5", key: "jqtk4d" }],
    ["path", { d: "M17 11h-.5", key: "1961ue" }],
    ["path", { d: "M19 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2", key: "1keqsi" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M7 11h4", key: "1o1z6v" }],
    ["path", { d: "M7 15h2.5", key: "1ina1g" }]
  ];
  const CaptionsOff = createLucideIcon("captions-off", __iconNode$kQ);

  const __iconNode$kP = [
    ["rect", { width: "18", height: "14", x: "3", y: "5", rx: "2", ry: "2", key: "12ruh7" }],
    ["path", { d: "M7 15h4M15 15h2M7 11h2M13 11h4", key: "1ueiar" }]
  ];
  const Captions = createLucideIcon("captions", __iconNode$kP);

  const __iconNode$kO = [
    [
      "path",
      { d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8", key: "1imjwt" }
    ],
    ["path", { d: "M7 14h.01", key: "1qa3f1" }],
    ["path", { d: "M17 14h.01", key: "7oqj8z" }],
    ["rect", { width: "18", height: "8", x: "3", y: "10", rx: "2", key: "a7itu8" }],
    ["path", { d: "M5 18v2", key: "ppbyun" }],
    ["path", { d: "M19 18v2", key: "gy7782" }]
  ];
  const CarFront = createLucideIcon("car-front", __iconNode$kO);

  const __iconNode$kN = [
    ["path", { d: "M10 2h4", key: "n1abiw" }],
    [
      "path",
      { d: "m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8", key: "1imjwt" }
    ],
    ["path", { d: "M7 14h.01", key: "1qa3f1" }],
    ["path", { d: "M17 14h.01", key: "7oqj8z" }],
    ["rect", { width: "18", height: "8", x: "3", y: "10", rx: "2", key: "a7itu8" }],
    ["path", { d: "M5 18v2", key: "ppbyun" }],
    ["path", { d: "M19 18v2", key: "gy7782" }]
  ];
  const CarTaxiFront = createLucideIcon("car-taxi-front", __iconNode$kN);

  const __iconNode$kM = [
    [
      "path",
      {
        d: "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2",
        key: "5owen"
      }
    ],
    ["circle", { cx: "7", cy: "17", r: "2", key: "u2ysq9" }],
    ["path", { d: "M9 17h6", key: "r8uit2" }],
    ["circle", { cx: "17", cy: "17", r: "2", key: "axvx0g" }]
  ];
  const Car = createLucideIcon("car", __iconNode$kM);

  const __iconNode$kL = [
    ["path", { d: "M18 19V9a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v8a2 2 0 0 0 2 2h2", key: "19jm3t" }],
    ["path", { d: "M2 9h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H2", key: "13hakp" }],
    ["path", { d: "M22 17v1a1 1 0 0 1-1 1H10v-9a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9", key: "1crci8" }],
    ["circle", { cx: "8", cy: "19", r: "2", key: "t8fc5s" }]
  ];
  const Caravan = createLucideIcon("caravan", __iconNode$kL);

  const __iconNode$kK = [
    ["path", { d: "M12 14v4", key: "1thi36" }],
    [
      "path",
      {
        d: "M14.172 2a2 2 0 0 1 1.414.586l3.828 3.828A2 2 0 0 1 20 7.828V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
        key: "1o66bk"
      }
    ],
    ["path", { d: "M8 14h8", key: "1fgep2" }],
    ["rect", { x: "8", y: "10", width: "8", height: "8", rx: "1", key: "1aonk6" }]
  ];
  const CardSim = createLucideIcon("card-sim", __iconNode$kK);

  const __iconNode$kJ = [
    [
      "path",
      {
        d: "M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46",
        key: "rfqxbe"
      }
    ],
    ["path", { d: "M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z", key: "6b25w4" }],
    ["path", { d: "M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z", key: "fn65lo" }]
  ];
  const Carrot = createLucideIcon("carrot", __iconNode$kJ);

  const __iconNode$kI = [
    ["circle", { cx: "7", cy: "12", r: "3", key: "12clwm" }],
    ["path", { d: "M10 9v6", key: "17i7lo" }],
    ["circle", { cx: "17", cy: "12", r: "3", key: "gl7c2s" }],
    ["path", { d: "M14 7v8", key: "dl84cr" }]
  ];
  const CaseLower = createLucideIcon("case-lower", __iconNode$kI);

  const __iconNode$kH = [
    ["path", { d: "m3 15 4-8 4 8", key: "1vwr6u" }],
    ["path", { d: "M4 13h6", key: "1r9ots" }],
    ["circle", { cx: "18", cy: "12", r: "3", key: "1kchzo" }],
    ["path", { d: "M21 9v6", key: "anns31" }]
  ];
  const CaseSensitive = createLucideIcon("case-sensitive", __iconNode$kH);

  const __iconNode$kG = [
    ["path", { d: "m3 15 4-8 4 8", key: "1vwr6u" }],
    ["path", { d: "M4 13h6", key: "1r9ots" }],
    ["path", { d: "M15 11h4.5a2 2 0 0 1 0 4H15V7h4a2 2 0 0 1 0 4", key: "1sqfas" }]
  ];
  const CaseUpper = createLucideIcon("case-upper", __iconNode$kG);

  const __iconNode$kF = [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
    ["circle", { cx: "8", cy: "10", r: "2", key: "1xl4ub" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
    ["circle", { cx: "16", cy: "10", r: "2", key: "r14t7q" }],
    ["path", { d: "m6 20 .7-2.9A1.4 1.4 0 0 1 8.1 16h7.8a1.4 1.4 0 0 1 1.4 1l.7 3", key: "l01ucn" }]
  ];
  const CassetteTape = createLucideIcon("cassette-tape", __iconNode$kF);

  const __iconNode$kE = [
    ["path", { d: "M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6", key: "3zrzxg" }],
    ["path", { d: "M2 12a9 9 0 0 1 8 8", key: "g6cvee" }],
    ["path", { d: "M2 16a5 5 0 0 1 4 4", key: "1y1dii" }],
    ["line", { x1: "2", x2: "2.01", y1: "20", y2: "20", key: "xu2jvo" }]
  ];
  const Cast = createLucideIcon("cast", __iconNode$kE);

  const __iconNode$kD = [
    ["path", { d: "M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z", key: "109fe4" }],
    ["path", { d: "M18 11V4H6v7", key: "mon5oj" }],
    ["path", { d: "M15 22v-4a3 3 0 0 0-3-3a3 3 0 0 0-3 3v4", key: "1k4jtn" }],
    ["path", { d: "M22 11V9", key: "3zbp94" }],
    ["path", { d: "M2 11V9", key: "1x5rnq" }],
    ["path", { d: "M6 4V2", key: "1rsq15" }],
    ["path", { d: "M18 4V2", key: "1jsdo1" }],
    ["path", { d: "M10 4V2", key: "75d9ly" }],
    ["path", { d: "M14 4V2", key: "8nj3z6" }]
  ];
  const Castle = createLucideIcon("castle", __iconNode$kD);

  const __iconNode$kC = [
    [
      "path",
      {
        d: "M12 5c.67 0 1.35.09 2 .26 1.78-2 5.03-2.84 6.42-2.26 1.4.58-.42 7-.42 7 .57 1.07 1 2.24 1 3.44C21 17.9 16.97 21 12 21s-9-3-9-7.56c0-1.25.5-2.4 1-3.44 0 0-1.89-6.42-.5-7 1.39-.58 4.72.23 6.5 2.23A9.04 9.04 0 0 1 12 5Z",
        key: "x6xyqk"
      }
    ],
    ["path", { d: "M8 14v.5", key: "1nzgdb" }],
    ["path", { d: "M16 14v.5", key: "1lajdz" }],
    ["path", { d: "M11.25 16.25h1.5L12 17l-.75-.75Z", key: "12kq1m" }]
  ];
  const Cat = createLucideIcon("cat", __iconNode$kC);

  const __iconNode$kB = [
    [
      "path",
      {
        d: "M16.75 12h3.632a1 1 0 0 1 .894 1.447l-2.034 4.069a1 1 0 0 1-1.708.134l-2.124-2.97",
        key: "ir91b5"
      }
    ],
    [
      "path",
      {
        d: "M17.106 9.053a1 1 0 0 1 .447 1.341l-3.106 6.211a1 1 0 0 1-1.342.447L3.61 12.3a2.92 2.92 0 0 1-1.3-3.91L3.69 5.6a2.92 2.92 0 0 1 3.92-1.3z",
        key: "jlp8i1"
      }
    ],
    ["path", { d: "M2 19h3.76a2 2 0 0 0 1.8-1.1L9 15", key: "19bib8" }],
    ["path", { d: "M2 21v-4", key: "l40lih" }],
    ["path", { d: "M7 9h.01", key: "19b3jx" }]
  ];
  const Cctv = createLucideIcon("cctv", __iconNode$kB);

  const __iconNode$kA = [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    [
      "path",
      {
        d: "M7 11.207a.5.5 0 0 1 .146-.353l2-2a.5.5 0 0 1 .708 0l3.292 3.292a.5.5 0 0 0 .708 0l4.292-4.292a.5.5 0 0 1 .854.353V16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z",
        key: "q0gr47"
      }
    ]
  ];
  const ChartArea = createLucideIcon("chart-area", __iconNode$kA);

  const __iconNode$kz = [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["rect", { x: "7", y: "13", width: "9", height: "4", rx: "1", key: "1iip1u" }],
    ["rect", { x: "7", y: "5", width: "12", height: "4", rx: "1", key: "1anskk" }]
  ];
  const ChartBarBig = createLucideIcon("chart-bar-big", __iconNode$kz);

  const __iconNode$ky = [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["path", { d: "M7 11h8", key: "1feolt" }],
    ["path", { d: "M7 16h12", key: "wsnu98" }],
    ["path", { d: "M7 6h3", key: "w9rmul" }]
  ];
  const ChartBarIncreasing = createLucideIcon("chart-bar-increasing", __iconNode$ky);

  const __iconNode$kx = [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["path", { d: "M7 11h8", key: "1feolt" }],
    ["path", { d: "M7 16h3", key: "ur6vzw" }],
    ["path", { d: "M7 6h12", key: "sz5b0d" }]
  ];
  const ChartBarDecreasing = createLucideIcon("chart-bar-decreasing", __iconNode$kx);

  const __iconNode$kw = [
    ["path", { d: "M11 13v4", key: "vyy2rb" }],
    ["path", { d: "M15 5v4", key: "1gx88a" }],
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["rect", { x: "7", y: "13", width: "9", height: "4", rx: "1", key: "1iip1u" }],
    ["rect", { x: "7", y: "5", width: "12", height: "4", rx: "1", key: "1anskk" }]
  ];
  const ChartBarStacked = createLucideIcon("chart-bar-stacked", __iconNode$kw);

  const __iconNode$kv = [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["path", { d: "M7 16h8", key: "srdodz" }],
    ["path", { d: "M7 11h12", key: "127s9w" }],
    ["path", { d: "M7 6h3", key: "w9rmul" }]
  ];
  const ChartBar = createLucideIcon("chart-bar", __iconNode$kv);

  const __iconNode$ku = [
    ["path", { d: "M9 5v4", key: "14uxtq" }],
    ["rect", { width: "4", height: "6", x: "7", y: "9", rx: "1", key: "f4fvz0" }],
    ["path", { d: "M9 15v2", key: "r5rk32" }],
    ["path", { d: "M17 3v2", key: "1l2re6" }],
    ["rect", { width: "4", height: "8", x: "15", y: "5", rx: "1", key: "z38je5" }],
    ["path", { d: "M17 13v3", key: "5l0wba" }],
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }]
  ];
  const ChartCandlestick = createLucideIcon("chart-candlestick", __iconNode$ku);

  const __iconNode$kt = [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["rect", { x: "15", y: "5", width: "4", height: "12", rx: "1", key: "q8uenq" }],
    ["rect", { x: "7", y: "8", width: "4", height: "9", rx: "1", key: "sr5ea" }]
  ];
  const ChartColumnBig = createLucideIcon("chart-column-big", __iconNode$kt);

  const __iconNode$ks = [
    ["path", { d: "M13 17V9", key: "1fwyjl" }],
    ["path", { d: "M18 17v-3", key: "1sqioe" }],
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["path", { d: "M8 17V5", key: "1wzmnc" }]
  ];
  const ChartColumnDecreasing = createLucideIcon("chart-column-decreasing", __iconNode$ks);

  const __iconNode$kr = [
    ["path", { d: "M13 17V9", key: "1fwyjl" }],
    ["path", { d: "M18 17V5", key: "sfb6ij" }],
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["path", { d: "M8 17v-3", key: "17ska0" }]
  ];
  const ChartColumnIncreasing = createLucideIcon("chart-column-increasing", __iconNode$kr);

  const __iconNode$kq = [
    ["path", { d: "M11 13H7", key: "t0o9gq" }],
    ["path", { d: "M19 9h-4", key: "rera1j" }],
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["rect", { x: "15", y: "5", width: "4", height: "12", rx: "1", key: "q8uenq" }],
    ["rect", { x: "7", y: "8", width: "4", height: "9", rx: "1", key: "sr5ea" }]
  ];
  const ChartColumnStacked = createLucideIcon("chart-column-stacked", __iconNode$kq);

  const __iconNode$kp = [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["path", { d: "M18 17V9", key: "2bz60n" }],
    ["path", { d: "M13 17V5", key: "1frdt8" }],
    ["path", { d: "M8 17v-3", key: "17ska0" }]
  ];
  const ChartColumn = createLucideIcon("chart-column", __iconNode$kp);

  const __iconNode$ko = [
    ["path", { d: "M10 6h8", key: "zvc2xc" }],
    ["path", { d: "M12 16h6", key: "yi5mkt" }],
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["path", { d: "M8 11h7", key: "wz2hg0" }]
  ];
  const ChartGantt = createLucideIcon("chart-gantt", __iconNode$ko);

  const __iconNode$kn = [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["path", { d: "m19 9-5 5-4-4-3 3", key: "2osh9i" }]
  ];
  const ChartLine = createLucideIcon("chart-line", __iconNode$kn);

  const __iconNode$km = [
    ["path", { d: "m13.11 7.664 1.78 2.672", key: "go2gg9" }],
    ["path", { d: "m14.162 12.788-3.324 1.424", key: "11x848" }],
    ["path", { d: "m20 4-6.06 1.515", key: "1wxxh7" }],
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["circle", { cx: "12", cy: "6", r: "2", key: "1jj5th" }],
    ["circle", { cx: "16", cy: "12", r: "2", key: "4ma0v8" }],
    ["circle", { cx: "9", cy: "15", r: "2", key: "lf2ghp" }]
  ];
  const ChartNetwork = createLucideIcon("chart-network", __iconNode$km);

  const __iconNode$kl = [
    ["path", { d: "M12 20V10", key: "g8npz5" }],
    ["path", { d: "M18 20v-4", key: "8uic4z" }],
    ["path", { d: "M6 20V4", key: "1w1bmo" }]
  ];
  const ChartNoAxesColumnDecreasing = createLucideIcon("chart-no-axes-column-decreasing", __iconNode$kl);

  const __iconNode$kk = [
    ["line", { x1: "12", x2: "12", y1: "20", y2: "10", key: "1vz5eb" }],
    ["line", { x1: "18", x2: "18", y1: "20", y2: "4", key: "cun8e5" }],
    ["line", { x1: "6", x2: "6", y1: "20", y2: "16", key: "hq0ia6" }]
  ];
  const ChartNoAxesColumnIncreasing = createLucideIcon("chart-no-axes-column-increasing", __iconNode$kk);

  const __iconNode$kj = [
    ["line", { x1: "18", x2: "18", y1: "20", y2: "10", key: "1xfpm4" }],
    ["line", { x1: "12", x2: "12", y1: "20", y2: "4", key: "be30l9" }],
    ["line", { x1: "6", x2: "6", y1: "20", y2: "14", key: "1r4le6" }]
  ];
  const ChartNoAxesColumn = createLucideIcon("chart-no-axes-column", __iconNode$kj);

  const __iconNode$ki = [
    ["path", { d: "M12 16v5", key: "zza2cw" }],
    ["path", { d: "M16 14v7", key: "1g90b9" }],
    ["path", { d: "M20 10v11", key: "1iqoj0" }],
    [
      "path",
      { d: "m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15", key: "1fw8x9" }
    ],
    ["path", { d: "M4 18v3", key: "1yp0dc" }],
    ["path", { d: "M8 14v7", key: "n3cwzv" }]
  ];
  const ChartNoAxesCombined = createLucideIcon("chart-no-axes-combined", __iconNode$ki);

  const __iconNode$kh = [
    ["path", { d: "M8 6h10", key: "9lnwnk" }],
    ["path", { d: "M6 12h9", key: "1g9pqf" }],
    ["path", { d: "M11 18h7", key: "c8dzvl" }]
  ];
  const ChartNoAxesGantt = createLucideIcon("chart-no-axes-gantt", __iconNode$kh);

  const __iconNode$kg = [
    [
      "path",
      {
        d: "M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z",
        key: "pzmjnu"
      }
    ],
    ["path", { d: "M21.21 15.89A10 10 0 1 1 8 2.83", key: "k2fpak" }]
  ];
  const ChartPie = createLucideIcon("chart-pie", __iconNode$kg);

  const __iconNode$kf = [
    ["circle", { cx: "7.5", cy: "7.5", r: ".5", fill: "currentColor", key: "kqv944" }],
    ["circle", { cx: "18.5", cy: "5.5", r: ".5", fill: "currentColor", key: "lysivs" }],
    ["circle", { cx: "11.5", cy: "11.5", r: ".5", fill: "currentColor", key: "byv1b8" }],
    ["circle", { cx: "7.5", cy: "16.5", r: ".5", fill: "currentColor", key: "nkw3mc" }],
    ["circle", { cx: "17.5", cy: "14.5", r: ".5", fill: "currentColor", key: "1gjh6j" }],
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }]
  ];
  const ChartScatter = createLucideIcon("chart-scatter", __iconNode$kf);

  const __iconNode$ke = [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16", key: "c24i48" }],
    ["path", { d: "M7 16c.5-2 1.5-7 4-7 2 0 2 3 4 3 2.5 0 4.5-5 5-7", key: "lw07rv" }]
  ];
  const ChartSpline = createLucideIcon("chart-spline", __iconNode$ke);

  const __iconNode$kd = [
    ["path", { d: "M18 6 7 17l-5-5", key: "116fxf" }],
    ["path", { d: "m22 10-7.5 7.5L13 16", key: "ke71qq" }]
  ];
  const CheckCheck = createLucideIcon("check-check", __iconNode$kd);

  const __iconNode$kc = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]];
  const Check = createLucideIcon("check", __iconNode$kc);

  const __iconNode$kb = [
    ["path", { d: "M20 4L9 15", key: "1qkx8z" }],
    ["path", { d: "M21 19L3 19", key: "100sma" }],
    ["path", { d: "M9 15L4 10", key: "9zxff7" }]
  ];
  const CheckLine = createLucideIcon("check-line", __iconNode$kb);

  const __iconNode$ka = [
    [
      "path",
      {
        d: "M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z",
        key: "1qvrer"
      }
    ],
    ["path", { d: "M6 17h12", key: "1jwigz" }]
  ];
  const ChefHat = createLucideIcon("chef-hat", __iconNode$ka);

  const __iconNode$k9 = [
    ["path", { d: "M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z", key: "cvxqlc" }],
    ["path", { d: "M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z", key: "1ostrc" }],
    ["path", { d: "M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12", key: "hqx58h" }],
    ["path", { d: "M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z", key: "eykp1o" }]
  ];
  const Cherry = createLucideIcon("cherry", __iconNode$k9);

  const __iconNode$k8 = [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]];
  const ChevronDown = createLucideIcon("chevron-down", __iconNode$k8);

  const __iconNode$k7 = [
    ["path", { d: "m17 18-6-6 6-6", key: "1yerx2" }],
    ["path", { d: "M7 6v12", key: "1p53r6" }]
  ];
  const ChevronFirst = createLucideIcon("chevron-first", __iconNode$k7);

  const __iconNode$k6 = [
    ["path", { d: "m7 18 6-6-6-6", key: "lwmzdw" }],
    ["path", { d: "M17 6v12", key: "1o0aio" }]
  ];
  const ChevronLast = createLucideIcon("chevron-last", __iconNode$k6);

  const __iconNode$k5 = [["path", { d: "m15 18-6-6 6-6", key: "1wnfg3" }]];
  const ChevronLeft = createLucideIcon("chevron-left", __iconNode$k5);

  const __iconNode$k4 = [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]];
  const ChevronRight = createLucideIcon("chevron-right", __iconNode$k4);

  const __iconNode$k3 = [["path", { d: "m18 15-6-6-6 6", key: "153udz" }]];
  const ChevronUp = createLucideIcon("chevron-up", __iconNode$k3);

  const __iconNode$k2 = [
    ["path", { d: "m7 20 5-5 5 5", key: "13a0gw" }],
    ["path", { d: "m7 4 5 5 5-5", key: "1kwcof" }]
  ];
  const ChevronsDownUp = createLucideIcon("chevrons-down-up", __iconNode$k2);

  const __iconNode$k1 = [
    ["path", { d: "m7 6 5 5 5-5", key: "1lc07p" }],
    ["path", { d: "m7 13 5 5 5-5", key: "1d48rs" }]
  ];
  const ChevronsDown = createLucideIcon("chevrons-down", __iconNode$k1);

  const __iconNode$k0 = [
    ["path", { d: "M12 12h.01", key: "1mp3jc" }],
    ["path", { d: "M16 12h.01", key: "1l6xoz" }],
    ["path", { d: "m17 7 5 5-5 5", key: "1xlxn0" }],
    ["path", { d: "m7 7-5 5 5 5", key: "19njba" }],
    ["path", { d: "M8 12h.01", key: "czm47f" }]
  ];
  const ChevronsLeftRightEllipsis = createLucideIcon("chevrons-left-right-ellipsis", __iconNode$k0);

  const __iconNode$j$ = [
    ["path", { d: "m9 7-5 5 5 5", key: "j5w590" }],
    ["path", { d: "m15 7 5 5-5 5", key: "1bl6da" }]
  ];
  const ChevronsLeftRight = createLucideIcon("chevrons-left-right", __iconNode$j$);

  const __iconNode$j_ = [
    ["path", { d: "m11 17-5-5 5-5", key: "13zhaf" }],
    ["path", { d: "m18 17-5-5 5-5", key: "h8a8et" }]
  ];
  const ChevronsLeft = createLucideIcon("chevrons-left", __iconNode$j_);

  const __iconNode$jZ = [
    ["path", { d: "m20 17-5-5 5-5", key: "30x0n2" }],
    ["path", { d: "m4 17 5-5-5-5", key: "16spf4" }]
  ];
  const ChevronsRightLeft = createLucideIcon("chevrons-right-left", __iconNode$jZ);

  const __iconNode$jY = [
    ["path", { d: "m6 17 5-5-5-5", key: "xnjwq" }],
    ["path", { d: "m13 17 5-5-5-5", key: "17xmmf" }]
  ];
  const ChevronsRight = createLucideIcon("chevrons-right", __iconNode$jY);

  const __iconNode$jX = [
    ["path", { d: "m7 15 5 5 5-5", key: "1hf1tw" }],
    ["path", { d: "m7 9 5-5 5 5", key: "sgt6xg" }]
  ];
  const ChevronsUpDown = createLucideIcon("chevrons-up-down", __iconNode$jX);

  const __iconNode$jW = [
    ["path", { d: "m17 11-5-5-5 5", key: "e8nh98" }],
    ["path", { d: "m17 18-5-5-5 5", key: "2avn1x" }]
  ];
  const ChevronsUp = createLucideIcon("chevrons-up", __iconNode$jW);

  const __iconNode$jV = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
    ["line", { x1: "21.17", x2: "12", y1: "8", y2: "8", key: "a0cw5f" }],
    ["line", { x1: "3.95", x2: "8.54", y1: "6.06", y2: "14", key: "1kftof" }],
    ["line", { x1: "10.88", x2: "15.46", y1: "21.94", y2: "14", key: "1ymyh8" }]
  ];
  const Chrome = createLucideIcon("chrome", __iconNode$jV);

  const __iconNode$jU = [
    ["path", { d: "M10 9h4", key: "u4k05v" }],
    ["path", { d: "M12 7v5", key: "ma6bk" }],
    ["path", { d: "M14 22v-4a2 2 0 0 0-4 0v4", key: "1pdhuj" }],
    [
      "path",
      {
        d: "M18 22V5.618a1 1 0 0 0-.553-.894l-4.553-2.277a2 2 0 0 0-1.788 0L6.553 4.724A1 1 0 0 0 6 5.618V22",
        key: "1rkokr"
      }
    ],
    [
      "path",
      {
        d: "m18 7 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.618a1 1 0 0 1 .553-.894L6 7",
        key: "1w6esw"
      }
    ]
  ];
  const Church = createLucideIcon("church", __iconNode$jU);

  const __iconNode$jT = [
    ["path", { d: "M12 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h13", key: "1gdiyg" }],
    ["path", { d: "M18 8c0-2.5-2-2.5-2-5", key: "1il607" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M21 12a1 1 0 0 1 1 1v2a1 1 0 0 1-.5.866", key: "166zjj" }],
    ["path", { d: "M22 8c0-2.5-2-2.5-2-5", key: "1gah44" }],
    ["path", { d: "M7 12v4", key: "jqww69" }]
  ];
  const CigaretteOff = createLucideIcon("cigarette-off", __iconNode$jT);

  const __iconNode$jS = [
    ["path", { d: "M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14", key: "1mb5g1" }],
    ["path", { d: "M18 8c0-2.5-2-2.5-2-5", key: "1il607" }],
    ["path", { d: "M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1", key: "1yl5r7" }],
    ["path", { d: "M22 8c0-2.5-2-2.5-2-5", key: "1gah44" }],
    ["path", { d: "M7 12v4", key: "jqww69" }]
  ];
  const Cigarette = createLucideIcon("cigarette", __iconNode$jS);

  const __iconNode$jR = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
    ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
  ];
  const CircleAlert = createLucideIcon("circle-alert", __iconNode$jR);

  const __iconNode$jQ = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M12 8v8", key: "napkw2" }],
    ["path", { d: "m8 12 4 4 4-4", key: "k98ssh" }]
  ];
  const CircleArrowDown = createLucideIcon("circle-arrow-down", __iconNode$jQ);

  const __iconNode$jP = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m12 8-4 4 4 4", key: "15vm53" }],
    ["path", { d: "M16 12H8", key: "1fr5h0" }]
  ];
  const CircleArrowLeft = createLucideIcon("circle-arrow-left", __iconNode$jP);

  const __iconNode$jO = [
    ["path", { d: "M12 22a10 10 0 1 1 10-10", key: "130bv5" }],
    ["path", { d: "M22 22 12 12", key: "131aw7" }],
    ["path", { d: "M22 16v6h-6", key: "1gvm70" }]
  ];
  const CircleArrowOutDownRight = createLucideIcon("circle-arrow-out-down-right", __iconNode$jO);

  const __iconNode$jN = [
    ["path", { d: "M2 8V2h6", key: "hiwtdz" }],
    ["path", { d: "m2 2 10 10", key: "1oh8rs" }],
    ["path", { d: "M12 2A10 10 0 1 1 2 12", key: "rrk4fa" }]
  ];
  const CircleArrowOutUpLeft = createLucideIcon("circle-arrow-out-up-left", __iconNode$jN);

  const __iconNode$jM = [
    ["path", { d: "M2 12a10 10 0 1 1 10 10", key: "1yn6ov" }],
    ["path", { d: "m2 22 10-10", key: "28ilpk" }],
    ["path", { d: "M8 22H2v-6", key: "sulq54" }]
  ];
  const CircleArrowOutDownLeft = createLucideIcon("circle-arrow-out-down-left", __iconNode$jM);

  const __iconNode$jL = [
    ["path", { d: "M22 12A10 10 0 1 1 12 2", key: "1fm58d" }],
    ["path", { d: "M22 2 12 12", key: "yg2myt" }],
    ["path", { d: "M16 2h6v6", key: "zan5cs" }]
  ];
  const CircleArrowOutUpRight = createLucideIcon("circle-arrow-out-up-right", __iconNode$jL);

  const __iconNode$jK = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m12 16 4-4-4-4", key: "1i9zcv" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }]
  ];
  const CircleArrowRight = createLucideIcon("circle-arrow-right", __iconNode$jK);

  const __iconNode$jJ = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m16 12-4-4-4 4", key: "177agl" }],
    ["path", { d: "M12 16V8", key: "1sbj14" }]
  ];
  const CircleArrowUp = createLucideIcon("circle-arrow-up", __iconNode$jJ);

  const __iconNode$jI = [
    ["path", { d: "M21.801 10A10 10 0 1 1 17 3.335", key: "yps3ct" }],
    ["path", { d: "m9 11 3 3L22 4", key: "1pflzl" }]
  ];
  const CircleCheckBig = createLucideIcon("circle-check-big", __iconNode$jI);

  const __iconNode$jH = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ];
  const CircleCheck = createLucideIcon("circle-check", __iconNode$jH);

  const __iconNode$jG = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m16 10-4 4-4-4", key: "894hmk" }]
  ];
  const CircleChevronDown = createLucideIcon("circle-chevron-down", __iconNode$jG);

  const __iconNode$jF = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m14 16-4-4 4-4", key: "ojs7w8" }]
  ];
  const CircleChevronLeft = createLucideIcon("circle-chevron-left", __iconNode$jF);

  const __iconNode$jE = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m10 8 4 4-4 4", key: "1wy4r4" }]
  ];
  const CircleChevronRight = createLucideIcon("circle-chevron-right", __iconNode$jE);

  const __iconNode$jD = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m8 14 4-4 4 4", key: "fy2ptz" }]
  ];
  const CircleChevronUp = createLucideIcon("circle-chevron-up", __iconNode$jD);

  const __iconNode$jC = [
    ["path", { d: "M10.1 2.182a10 10 0 0 1 3.8 0", key: "5ilxe3" }],
    ["path", { d: "M13.9 21.818a10 10 0 0 1-3.8 0", key: "11zvb9" }],
    ["path", { d: "M17.609 3.721a10 10 0 0 1 2.69 2.7", key: "1iw5b2" }],
    ["path", { d: "M2.182 13.9a10 10 0 0 1 0-3.8", key: "c0bmvh" }],
    ["path", { d: "M20.279 17.609a10 10 0 0 1-2.7 2.69", key: "1ruxm7" }],
    ["path", { d: "M21.818 10.1a10 10 0 0 1 0 3.8", key: "qkgqxc" }],
    ["path", { d: "M3.721 6.391a10 10 0 0 1 2.7-2.69", key: "1mcia2" }],
    ["path", { d: "M6.391 20.279a10 10 0 0 1-2.69-2.7", key: "1fvljs" }]
  ];
  const CircleDashed = createLucideIcon("circle-dashed", __iconNode$jC);

  const __iconNode$jB = [
    ["line", { x1: "8", x2: "16", y1: "12", y2: "12", key: "1jonct" }],
    ["line", { x1: "12", x2: "12", y1: "16", y2: "16", key: "aqc6ln" }],
    ["line", { x1: "12", x2: "12", y1: "8", y2: "8", key: "1mkcni" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const CircleDivide = createLucideIcon("circle-divide", __iconNode$jB);

  const __iconNode$jA = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8", key: "1h4pet" }],
    ["path", { d: "M12 18V6", key: "zqpxq5" }]
  ];
  const CircleDollarSign = createLucideIcon("circle-dollar-sign", __iconNode$jA);

  const __iconNode$jz = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }]
  ];
  const CircleDot = createLucideIcon("circle-dot", __iconNode$jz);

  const __iconNode$jy = [
    ["path", { d: "M10.1 2.18a9.93 9.93 0 0 1 3.8 0", key: "1qdqn0" }],
    ["path", { d: "M17.6 3.71a9.95 9.95 0 0 1 2.69 2.7", key: "1bq7p6" }],
    ["path", { d: "M21.82 10.1a9.93 9.93 0 0 1 0 3.8", key: "1rlaqf" }],
    ["path", { d: "M20.29 17.6a9.95 9.95 0 0 1-2.7 2.69", key: "1xk03u" }],
    ["path", { d: "M13.9 21.82a9.94 9.94 0 0 1-3.8 0", key: "l7re25" }],
    ["path", { d: "M6.4 20.29a9.95 9.95 0 0 1-2.69-2.7", key: "1v18p6" }],
    ["path", { d: "M2.18 13.9a9.93 9.93 0 0 1 0-3.8", key: "xdo6bj" }],
    ["path", { d: "M3.71 6.4a9.95 9.95 0 0 1 2.7-2.69", key: "1jjmaz" }],
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }]
  ];
  const CircleDotDashed = createLucideIcon("circle-dot-dashed", __iconNode$jy);

  const __iconNode$jx = [
    ["path", { d: "M7 10h10", key: "1101jm" }],
    ["path", { d: "M7 14h10", key: "1mhdw3" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const CircleEqual = createLucideIcon("circle-equal", __iconNode$jx);

  const __iconNode$jw = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M17 12h.01", key: "1m0b6t" }],
    ["path", { d: "M12 12h.01", key: "1mp3jc" }],
    ["path", { d: "M7 12h.01", key: "eqddd0" }]
  ];
  const CircleEllipsis = createLucideIcon("circle-ellipsis", __iconNode$jw);

  const __iconNode$jv = [
    ["path", { d: "M12 2a10 10 0 0 1 7.38 16.75", key: "175t95" }],
    ["path", { d: "m16 12-4-4-4 4", key: "177agl" }],
    ["path", { d: "M12 16V8", key: "1sbj14" }],
    ["path", { d: "M2.5 8.875a10 10 0 0 0-.5 3", key: "1vce0s" }],
    ["path", { d: "M2.83 16a10 10 0 0 0 2.43 3.4", key: "o3fkw4" }],
    ["path", { d: "M4.636 5.235a10 10 0 0 1 .891-.857", key: "1szpfk" }],
    ["path", { d: "M8.644 21.42a10 10 0 0 0 7.631-.38", key: "9yhvd4" }]
  ];
  const CircleFadingArrowUp = createLucideIcon("circle-fading-arrow-up", __iconNode$jv);

  const __iconNode$ju = [
    ["path", { d: "M12 2a10 10 0 0 1 7.38 16.75", key: "175t95" }],
    ["path", { d: "M12 8v8", key: "napkw2" }],
    ["path", { d: "M16 12H8", key: "1fr5h0" }],
    ["path", { d: "M2.5 8.875a10 10 0 0 0-.5 3", key: "1vce0s" }],
    ["path", { d: "M2.83 16a10 10 0 0 0 2.43 3.4", key: "o3fkw4" }],
    ["path", { d: "M4.636 5.235a10 10 0 0 1 .891-.857", key: "1szpfk" }],
    ["path", { d: "M8.644 21.42a10 10 0 0 0 7.631-.38", key: "9yhvd4" }]
  ];
  const CircleFadingPlus = createLucideIcon("circle-fading-plus", __iconNode$ju);

  const __iconNode$jt = [
    ["path", { d: "M15.6 2.7a10 10 0 1 0 5.7 5.7", key: "1e0p6d" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }],
    ["path", { d: "M13.4 10.6 19 5", key: "1kr7tw" }]
  ];
  const CircleGauge = createLucideIcon("circle-gauge", __iconNode$jt);

  const __iconNode$js = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }]
  ];
  const CircleMinus = createLucideIcon("circle-minus", __iconNode$js);

  const __iconNode$jr = [
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M8.35 2.69A10 10 0 0 1 21.3 15.65", key: "1pfsoa" }],
    ["path", { d: "M19.08 19.08A10 10 0 1 1 4.92 4.92", key: "1ablyi" }]
  ];
  const CircleOff = createLucideIcon("circle-off", __iconNode$jr);

  const __iconNode$jq = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m5 5 14 14", key: "11anup" }],
    ["path", { d: "M13 13a3 3 0 1 0 0-6H9v2", key: "uoagbd" }],
    ["path", { d: "M9 17v-2.34", key: "a9qo08" }]
  ];
  const CircleParkingOff = createLucideIcon("circle-parking-off", __iconNode$jq);

  const __iconNode$jp = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M9 17V7h4a3 3 0 0 1 0 6H9", key: "1dfk2c" }]
  ];
  const CircleParking = createLucideIcon("circle-parking", __iconNode$jp);

  const __iconNode$jo = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["line", { x1: "10", x2: "10", y1: "15", y2: "9", key: "c1nkhi" }],
    ["line", { x1: "14", x2: "14", y1: "15", y2: "9", key: "h65svq" }]
  ];
  const CirclePause = createLucideIcon("circle-pause", __iconNode$jo);

  const __iconNode$jn = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    ["path", { d: "M9 9h.01", key: "1q5me6" }],
    ["path", { d: "M15 15h.01", key: "lqbp3k" }]
  ];
  const CirclePercent = createLucideIcon("circle-percent", __iconNode$jn);

  const __iconNode$jm = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polygon", { points: "10 8 16 12 10 16 10 8", key: "1cimsy" }]
  ];
  const CirclePlay = createLucideIcon("circle-play", __iconNode$jm);

  const __iconNode$jl = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
    ["path", { d: "M12 8v8", key: "napkw2" }]
  ];
  const CirclePlus = createLucideIcon("circle-plus", __iconNode$jl);

  const __iconNode$jk = [
    ["path", { d: "M10 16V9.5a1 1 0 0 1 5 0", key: "1i1are" }],
    ["path", { d: "M8 12h4", key: "qz6y1c" }],
    ["path", { d: "M8 16h7", key: "sbedsn" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const CirclePoundSterling = createLucideIcon("circle-pound-sterling", __iconNode$jk);

  const __iconNode$jj = [
    ["path", { d: "M12 7v4", key: "xawao1" }],
    ["path", { d: "M7.998 9.003a5 5 0 1 0 8-.005", key: "1pek45" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const CirclePower = createLucideIcon("circle-power", __iconNode$jj);

  const __iconNode$ji = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ];
  const CircleQuestionMark = createLucideIcon("circle-question-mark", __iconNode$ji);

  const __iconNode$jh = [
    ["path", { d: "M22 2 2 22", key: "y4kqgn" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const CircleSlash2 = createLucideIcon("circle-slash-2", __iconNode$jh);

  const __iconNode$jg = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["line", { x1: "9", x2: "15", y1: "15", y2: "9", key: "1dfufj" }]
  ];
  const CircleSlash = createLucideIcon("circle-slash", __iconNode$jg);

  const __iconNode$jf = [["circle", { cx: "12", cy: "12", r: "6", key: "1vlfrh" }]];
  const CircleSmall = createLucideIcon("circle-small", __iconNode$jf);

  const __iconNode$je = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["rect", { x: "9", y: "9", width: "6", height: "6", rx: "1", key: "1ssd4o" }]
  ];
  const CircleStop = createLucideIcon("circle-stop", __iconNode$je);

  const __iconNode$jd = [
    ["path", { d: "M18 20a6 6 0 0 0-12 0", key: "1qehca" }],
    ["circle", { cx: "12", cy: "10", r: "4", key: "1h16sb" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const CircleUserRound = createLucideIcon("circle-user-round", __iconNode$jd);

  const __iconNode$jc = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }],
    ["path", { d: "M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662", key: "154egf" }]
  ];
  const CircleUser = createLucideIcon("circle-user", __iconNode$jc);

  const __iconNode$jb = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    ["path", { d: "m9 9 6 6", key: "z0biqf" }]
  ];
  const CircleX = createLucideIcon("circle-x", __iconNode$jb);

  const __iconNode$ja = [["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]];
  const Circle = createLucideIcon("circle", __iconNode$ja);

  const __iconNode$j9 = [
    [
      "path",
      {
        d: "M21.66 17.67a1.08 1.08 0 0 1-.04 1.6A12 12 0 0 1 4.73 2.38a1.1 1.1 0 0 1 1.61-.04z",
        key: "4ite01"
      }
    ],
    ["path", { d: "M19.65 15.66A8 8 0 0 1 8.35 4.34", key: "1gxipu" }],
    ["path", { d: "m14 10-5.5 5.5", key: "92pfem" }],
    ["path", { d: "M14 17.85V10H6.15", key: "xqmtsk" }]
  ];
  const Citrus = createLucideIcon("citrus", __iconNode$j9);

  const __iconNode$j8 = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M11 9h4a2 2 0 0 0 2-2V3", key: "1ve2rv" }],
    ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }],
    ["path", { d: "M7 21v-4a2 2 0 0 1 2-2h4", key: "1fwkro" }],
    ["circle", { cx: "15", cy: "15", r: "2", key: "3i40o0" }]
  ];
  const CircuitBoard = createLucideIcon("circuit-board", __iconNode$j8);

  const __iconNode$j7 = [
    [
      "path",
      { d: "M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z", key: "1tn4o7" }
    ],
    ["path", { d: "m6.2 5.3 3.1 3.9", key: "iuk76l" }],
    ["path", { d: "m12.4 3.4 3.1 4", key: "6hsd6n" }],
    ["path", { d: "M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z", key: "ltgou9" }]
  ];
  const Clapperboard = createLucideIcon("clapperboard", __iconNode$j7);

  const __iconNode$j6 = [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1", key: "tgr4d6" }],
    [
      "path",
      {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
        key: "116196"
      }
    ],
    ["path", { d: "m9 14 2 2 4-4", key: "df797q" }]
  ];
  const ClipboardCheck = createLucideIcon("clipboard-check", __iconNode$j6);

  const __iconNode$j5 = [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1", key: "tgr4d6" }],
    ["path", { d: "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2", key: "4jdomd" }],
    ["path", { d: "M16 4h2a2 2 0 0 1 2 2v4", key: "3hqy98" }],
    ["path", { d: "M21 14H11", key: "1bme5i" }],
    ["path", { d: "m15 10-4 4 4 4", key: "5dvupr" }]
  ];
  const ClipboardCopy = createLucideIcon("clipboard-copy", __iconNode$j5);

  const __iconNode$j4 = [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1", key: "tgr4d6" }],
    [
      "path",
      {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
        key: "116196"
      }
    ],
    ["path", { d: "M12 11h4", key: "1jrz19" }],
    ["path", { d: "M12 16h4", key: "n85exb" }],
    ["path", { d: "M8 11h.01", key: "1dfujw" }],
    ["path", { d: "M8 16h.01", key: "18s6g9" }]
  ];
  const ClipboardList = createLucideIcon("clipboard-list", __iconNode$j4);

  const __iconNode$j3 = [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1", key: "tgr4d6" }],
    [
      "path",
      {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
        key: "116196"
      }
    ],
    ["path", { d: "M9 14h6", key: "159ibu" }]
  ];
  const ClipboardMinus = createLucideIcon("clipboard-minus", __iconNode$j3);

  const __iconNode$j2 = [
    ["path", { d: "M11 14h10", key: "1w8e9d" }],
    ["path", { d: "M16 4h2a2 2 0 0 1 2 2v1.344", key: "1e62lh" }],
    ["path", { d: "m17 18 4-4-4-4", key: "z2g111" }],
    ["path", { d: "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113", key: "bjbb7m" }],
    ["rect", { x: "8", y: "2", width: "8", height: "4", rx: "1", key: "ublpy" }]
  ];
  const ClipboardPaste = createLucideIcon("clipboard-paste", __iconNode$j2);

  const __iconNode$j1 = [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", key: "1oijnt" }],
    ["path", { d: "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.5", key: "1but9f" }],
    ["path", { d: "M16 4h2a2 2 0 0 1 1.73 1", key: "1p8n7l" }],
    ["path", { d: "M8 18h1", key: "13wk12" }],
    [
      "path",
      {
        d: "M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
        key: "2t3380"
      }
    ]
  ];
  const ClipboardPenLine = createLucideIcon("clipboard-pen-line", __iconNode$j1);

  const __iconNode$j0 = [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", key: "1oijnt" }],
    ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5.5", key: "cereej" }],
    ["path", { d: "M4 13.5V6a2 2 0 0 1 2-2h2", key: "5ua5vh" }],
    [
      "path",
      {
        d: "M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
        key: "1y4qbx"
      }
    ]
  ];
  const ClipboardPen = createLucideIcon("clipboard-pen", __iconNode$j0);

  const __iconNode$i$ = [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1", key: "tgr4d6" }],
    [
      "path",
      {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
        key: "116196"
      }
    ],
    ["path", { d: "M9 14h6", key: "159ibu" }],
    ["path", { d: "M12 17v-6", key: "1y8rbf" }]
  ];
  const ClipboardPlus = createLucideIcon("clipboard-plus", __iconNode$i$);

  const __iconNode$i_ = [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1", key: "tgr4d6" }],
    [
      "path",
      {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
        key: "116196"
      }
    ],
    ["path", { d: "M9 12v-1h6v1", key: "iehl6m" }],
    ["path", { d: "M11 17h2", key: "12w5me" }],
    ["path", { d: "M12 11v6", key: "1bwqyc" }]
  ];
  const ClipboardType = createLucideIcon("clipboard-type", __iconNode$i_);

  const __iconNode$iZ = [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1", key: "tgr4d6" }],
    [
      "path",
      {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
        key: "116196"
      }
    ],
    ["path", { d: "m15 11-6 6", key: "1toa9n" }],
    ["path", { d: "m9 11 6 6", key: "wlibny" }]
  ];
  const ClipboardX = createLucideIcon("clipboard-x", __iconNode$iZ);

  const __iconNode$iY = [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1", key: "tgr4d6" }],
    [
      "path",
      {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
        key: "116196"
      }
    ]
  ];
  const Clipboard = createLucideIcon("clipboard", __iconNode$iY);

  const __iconNode$iX = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 8 10", key: "atfzqc" }]
  ];
  const Clock10 = createLucideIcon("clock-10", __iconNode$iX);

  const __iconNode$iW = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 14.5 8", key: "12zbmj" }]
  ];
  const Clock1 = createLucideIcon("clock-1", __iconNode$iW);

  const __iconNode$iV = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12", key: "1fub01" }]
  ];
  const Clock12 = createLucideIcon("clock-12", __iconNode$iV);

  const __iconNode$iU = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 9.5 8", key: "l5bg6f" }]
  ];
  const Clock11 = createLucideIcon("clock-11", __iconNode$iU);

  const __iconNode$iT = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 16 10", key: "1g230d" }]
  ];
  const Clock2 = createLucideIcon("clock-2", __iconNode$iT);

  const __iconNode$iS = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 16.5 12", key: "1aq6pp" }]
  ];
  const Clock3 = createLucideIcon("clock-3", __iconNode$iS);

  const __iconNode$iR = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 16 14", key: "68esgv" }]
  ];
  const Clock4 = createLucideIcon("clock-4", __iconNode$iR);

  const __iconNode$iQ = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 14.5 16", key: "1pcbox" }]
  ];
  const Clock5 = createLucideIcon("clock-5", __iconNode$iQ);

  const __iconNode$iP = [
    ["path", { d: "M12 16.5V6", key: "1a6ag5" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const Clock6 = createLucideIcon("clock-6", __iconNode$iP);

  const __iconNode$iO = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 9.5 16", key: "ka3394" }]
  ];
  const Clock7 = createLucideIcon("clock-7", __iconNode$iO);

  const __iconNode$iN = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 8 14", key: "tmc9b4" }]
  ];
  const Clock8 = createLucideIcon("clock-8", __iconNode$iN);

  const __iconNode$iM = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 7.5 12", key: "1k60p0" }]
  ];
  const Clock9 = createLucideIcon("clock-9", __iconNode$iM);

  const __iconNode$iL = [
    ["path", { d: "M12 6v6l4 2", key: "mmk7yg" }],
    ["path", { d: "M16 21.16a10 10 0 1 1 5-13.516", key: "cxo92l" }],
    ["path", { d: "M20 11.5v6", key: "2ei3xq" }],
    ["path", { d: "M20 21.5h.01", key: "1r2dzp" }]
  ];
  const ClockAlert = createLucideIcon("clock-alert", __iconNode$iL);

  const __iconNode$iK = [
    ["path", { d: "M12.338 21.994A10 10 0 1 1 21.925 13.227", key: "1i7shu" }],
    ["path", { d: "M12 6v6l2 1", key: "19cm8n" }],
    ["path", { d: "m14 18 4 4 4-4", key: "1waygx" }],
    ["path", { d: "M18 14v8", key: "irew45" }]
  ];
  const ClockArrowDown = createLucideIcon("clock-arrow-down", __iconNode$iK);

  const __iconNode$iJ = [
    ["path", { d: "M13.228 21.925A10 10 0 1 1 21.994 12.338", key: "1fzlyi" }],
    ["path", { d: "M12 6v6l1.562.781", key: "1ujuk9" }],
    ["path", { d: "m14 18 4-4 4 4", key: "ftkppy" }],
    ["path", { d: "M18 22v-8", key: "su0gjh" }]
  ];
  const ClockArrowUp = createLucideIcon("clock-arrow-up", __iconNode$iJ);

  const __iconNode$iI = [
    ["path", { d: "M12 2a10 10 0 0 1 7.38 16.75", key: "175t95" }],
    ["path", { d: "M12 6v6l4 2", key: "mmk7yg" }],
    ["path", { d: "M2.5 8.875a10 10 0 0 0-.5 3", key: "1vce0s" }],
    ["path", { d: "M2.83 16a10 10 0 0 0 2.43 3.4", key: "o3fkw4" }],
    ["path", { d: "M4.636 5.235a10 10 0 0 1 .891-.857", key: "1szpfk" }],
    ["path", { d: "M8.644 21.42a10 10 0 0 0 7.631-.38", key: "9yhvd4" }]
  ];
  const ClockFading = createLucideIcon("clock-fading", __iconNode$iI);

  const __iconNode$iH = [
    ["path", { d: "M12 6v6l3.644 1.822", key: "1jmett" }],
    ["path", { d: "M16 19h6", key: "xwg31i" }],
    ["path", { d: "M19 16v6", key: "tddt3s" }],
    ["path", { d: "M21.92 13.267a10 10 0 1 0-8.653 8.653", key: "1u0osk" }]
  ];
  const ClockPlus = createLucideIcon("clock-plus", __iconNode$iH);

  const __iconNode$iG = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["polyline", { points: "12 6 12 12 16 14", key: "68esgv" }]
  ];
  const Clock = createLucideIcon("clock", __iconNode$iG);

  const __iconNode$iF = [
    ["path", { d: "M12 12v4", key: "tww15h" }],
    ["path", { d: "M12 20h.01", key: "zekei9" }],
    ["path", { d: "M17 18h.5a1 1 0 0 0 0-9h-1.79A7 7 0 1 0 7 17.708", key: "xsb5ju" }]
  ];
  const CloudAlert = createLucideIcon("cloud-alert", __iconNode$iF);

  const __iconNode$iE = [
    ["path", { d: "m17 15-5.5 5.5L9 18", key: "15q87x" }],
    ["path", { d: "M5 17.743A7 7 0 1 1 15.71 10h1.79a4.5 4.5 0 0 1 1.5 8.742", key: "9ho6ki" }]
  ];
  const CloudCheck = createLucideIcon("cloud-check", __iconNode$iE);

  const __iconNode$iD = [
    ["path", { d: "m10.852 19.772-.383.924", key: "r7sl7d" }],
    ["path", { d: "m13.148 14.228.383-.923", key: "1d5zpm" }],
    ["path", { d: "M13.148 19.772a3 3 0 1 0-2.296-5.544l-.383-.923", key: "1ydik7" }],
    ["path", { d: "m13.53 20.696-.382-.924a3 3 0 1 1-2.296-5.544", key: "1m1vsf" }],
    ["path", { d: "m14.772 15.852.923-.383", key: "660p6e" }],
    ["path", { d: "m14.772 18.148.923.383", key: "hrcpis" }],
    [
      "path",
      {
        d: "M4.2 15.1a7 7 0 1 1 9.93-9.858A7 7 0 0 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.2",
        key: "j2q98n"
      }
    ],
    ["path", { d: "m9.228 15.852-.923-.383", key: "1p9ong" }],
    ["path", { d: "m9.228 18.148-.923.383", key: "6558rz" }]
  ];
  const CloudCog = createLucideIcon("cloud-cog", __iconNode$iD);

  const __iconNode$iC = [
    ["path", { d: "M12 13v8l-4-4", key: "1f5nwf" }],
    ["path", { d: "m12 21 4-4", key: "1lfcce" }],
    ["path", { d: "M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284", key: "ui1hmy" }]
  ];
  const CloudDownload = createLucideIcon("cloud-download", __iconNode$iC);

  const __iconNode$iB = [
    ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
    ["path", { d: "M8 19v1", key: "1dk2by" }],
    ["path", { d: "M8 14v1", key: "84yxot" }],
    ["path", { d: "M16 19v1", key: "v220m7" }],
    ["path", { d: "M16 14v1", key: "g12gj6" }],
    ["path", { d: "M12 21v1", key: "q8vafk" }],
    ["path", { d: "M12 16v1", key: "1mx6rx" }]
  ];
  const CloudDrizzle = createLucideIcon("cloud-drizzle", __iconNode$iB);

  const __iconNode$iA = [
    ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
    ["path", { d: "M16 17H7", key: "pygtm1" }],
    ["path", { d: "M17 21H9", key: "1u2q02" }]
  ];
  const CloudFog = createLucideIcon("cloud-fog", __iconNode$iA);

  const __iconNode$iz = [
    ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
    ["path", { d: "M16 14v2", key: "a1is7l" }],
    ["path", { d: "M8 14v2", key: "1e9m6t" }],
    ["path", { d: "M16 20h.01", key: "xwek51" }],
    ["path", { d: "M8 20h.01", key: "1vjney" }],
    ["path", { d: "M12 16v2", key: "z66u1j" }],
    ["path", { d: "M12 22h.01", key: "1urd7a" }]
  ];
  const CloudHail = createLucideIcon("cloud-hail", __iconNode$iz);

  const __iconNode$iy = [
    ["path", { d: "M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973", key: "1cez44" }],
    ["path", { d: "m13 12-3 5h4l-3 5", key: "1t22er" }]
  ];
  const CloudLightning = createLucideIcon("cloud-lightning", __iconNode$iy);

  const __iconNode$ix = [
    ["path", { d: "M10.188 8.5A6 6 0 0 1 16 4a1 1 0 0 0 6 6 6 6 0 0 1-3 5.197", key: "erj67n" }],
    ["path", { d: "M11 20v2", key: "174qtz" }],
    ["path", { d: "M3 20a5 5 0 1 1 8.9-4H13a3 3 0 0 1 2 5.24", key: "1qmrp3" }],
    ["path", { d: "M7 19v2", key: "12npes" }]
  ];
  const CloudMoonRain = createLucideIcon("cloud-moon-rain", __iconNode$ix);

  const __iconNode$iw = [
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193", key: "yfwify" }],
    [
      "path",
      { d: "M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07", key: "jlfiyv" }
    ]
  ];
  const CloudOff = createLucideIcon("cloud-off", __iconNode$iw);

  const __iconNode$iv = [
    ["path", { d: "M10.188 8.5A6 6 0 0 1 16 4a1 1 0 0 0 6 6 6 6 0 0 1-3 5.197", key: "erj67n" }],
    ["path", { d: "M13 16a3 3 0 1 1 0 6H7a5 5 0 1 1 4.9-6Z", key: "p44pc9" }]
  ];
  const CloudMoon = createLucideIcon("cloud-moon", __iconNode$iv);

  const __iconNode$iu = [
    ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
    ["path", { d: "m9.2 22 3-7", key: "sb5f6j" }],
    ["path", { d: "m9 13-3 7", key: "500co5" }],
    ["path", { d: "m17 13-3 7", key: "8t2fiy" }]
  ];
  const CloudRainWind = createLucideIcon("cloud-rain-wind", __iconNode$iu);

  const __iconNode$it = [
    ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
    ["path", { d: "M8 15h.01", key: "a7atzg" }],
    ["path", { d: "M8 19h.01", key: "puxtts" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }],
    ["path", { d: "M12 21h.01", key: "h35vbk" }],
    ["path", { d: "M16 15h.01", key: "rnfrdf" }],
    ["path", { d: "M16 19h.01", key: "1vcnzz" }]
  ];
  const CloudSnow = createLucideIcon("cloud-snow", __iconNode$it);

  const __iconNode$is = [
    ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
    ["path", { d: "M16 14v6", key: "1j4efv" }],
    ["path", { d: "M8 14v6", key: "17c4r9" }],
    ["path", { d: "M12 16v6", key: "c8a4gj" }]
  ];
  const CloudRain = createLucideIcon("cloud-rain", __iconNode$is);

  const __iconNode$ir = [
    ["path", { d: "M12 2v2", key: "tus03m" }],
    ["path", { d: "m4.93 4.93 1.41 1.41", key: "149t6j" }],
    ["path", { d: "M20 12h2", key: "1q8mjw" }],
    ["path", { d: "m19.07 4.93-1.41 1.41", key: "1shlcs" }],
    ["path", { d: "M15.947 12.65a4 4 0 0 0-5.925-4.128", key: "dpwdj0" }],
    ["path", { d: "M3 20a5 5 0 1 1 8.9-4H13a3 3 0 0 1 2 5.24", key: "1qmrp3" }],
    ["path", { d: "M11 20v2", key: "174qtz" }],
    ["path", { d: "M7 19v2", key: "12npes" }]
  ];
  const CloudSunRain = createLucideIcon("cloud-sun-rain", __iconNode$ir);

  const __iconNode$iq = [
    ["path", { d: "M12 2v2", key: "tus03m" }],
    ["path", { d: "m4.93 4.93 1.41 1.41", key: "149t6j" }],
    ["path", { d: "M20 12h2", key: "1q8mjw" }],
    ["path", { d: "m19.07 4.93-1.41 1.41", key: "1shlcs" }],
    ["path", { d: "M15.947 12.65a4 4 0 0 0-5.925-4.128", key: "dpwdj0" }],
    ["path", { d: "M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z", key: "s09mg5" }]
  ];
  const CloudSun = createLucideIcon("cloud-sun", __iconNode$iq);

  const __iconNode$ip = [
    ["path", { d: "M12 13v8", key: "1l5pq0" }],
    ["path", { d: "M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242", key: "1pljnt" }],
    ["path", { d: "m8 17 4-4 4 4", key: "1quai1" }]
  ];
  const CloudUpload = createLucideIcon("cloud-upload", __iconNode$ip);

  const __iconNode$io = [
    ["path", { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z", key: "p7xjir" }]
  ];
  const Cloud = createLucideIcon("cloud", __iconNode$io);

  const __iconNode$in = [
    ["path", { d: "M17.5 21H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z", key: "gqqjvc" }],
    ["path", { d: "M22 10a3 3 0 0 0-3-3h-2.207a5.502 5.502 0 0 0-10.702.5", key: "1p2s76" }]
  ];
  const Cloudy = createLucideIcon("cloudy", __iconNode$in);

  const __iconNode$im = [
    ["path", { d: "M16.17 7.83 2 22", key: "t58vo8" }],
    [
      "path",
      {
        d: "M4.02 12a2.827 2.827 0 1 1 3.81-4.17A2.827 2.827 0 1 1 12 4.02a2.827 2.827 0 1 1 4.17 3.81A2.827 2.827 0 1 1 19.98 12a2.827 2.827 0 1 1-3.81 4.17A2.827 2.827 0 1 1 12 19.98a2.827 2.827 0 1 1-4.17-3.81A1 1 0 1 1 4 12",
        key: "17k36q"
      }
    ],
    ["path", { d: "m7.83 7.83 8.34 8.34", key: "1d7sxk" }]
  ];
  const Clover = createLucideIcon("clover", __iconNode$im);

  const __iconNode$il = [
    [
      "path",
      {
        d: "M17.28 9.05a5.5 5.5 0 1 0-10.56 0A5.5 5.5 0 1 0 12 17.66a5.5 5.5 0 1 0 5.28-8.6Z",
        key: "27yuqz"
      }
    ],
    ["path", { d: "M12 17.66L12 22", key: "ogfahf" }]
  ];
  const Club = createLucideIcon("club", __iconNode$il);

  const __iconNode$ik = [
    ["path", { d: "m18 16 4-4-4-4", key: "1inbqp" }],
    ["path", { d: "m6 8-4 4 4 4", key: "15zrgr" }],
    ["path", { d: "m14.5 4-5 16", key: "e7oirm" }]
  ];
  const CodeXml = createLucideIcon("code-xml", __iconNode$ik);

  const __iconNode$ij = [
    ["path", { d: "m16 18 6-6-6-6", key: "eg8j8" }],
    ["path", { d: "m8 6-6 6 6 6", key: "ppft3o" }]
  ];
  const Code = createLucideIcon("code", __iconNode$ij);

  const __iconNode$ii = [
    ["polygon", { points: "12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2", key: "srzb37" }],
    ["line", { x1: "12", x2: "12", y1: "22", y2: "15.5", key: "1t73f2" }],
    ["polyline", { points: "22 8.5 12 15.5 2 8.5", key: "ajlxae" }],
    ["polyline", { points: "2 15.5 12 8.5 22 15.5", key: "susrui" }],
    ["line", { x1: "12", x2: "12", y1: "2", y2: "8.5", key: "2cldga" }]
  ];
  const Codepen = createLucideIcon("codepen", __iconNode$ii);

  const __iconNode$ih = [
    ["path", { d: "M10 2v2", key: "7u0qdc" }],
    ["path", { d: "M14 2v2", key: "6buw04" }],
    [
      "path",
      {
        d: "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",
        key: "pwadti"
      }
    ],
    ["path", { d: "M6 2v2", key: "colzsn" }]
  ];
  const Coffee = createLucideIcon("coffee", __iconNode$ih);

  const __iconNode$ig = [
    [
      "path",
      {
        d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
        key: "yt0hxn"
      }
    ],
    ["polyline", { points: "7.5 4.21 12 6.81 16.5 4.21", key: "fabo96" }],
    ["polyline", { points: "7.5 19.79 7.5 14.6 3 12", key: "z377f1" }],
    ["polyline", { points: "21 12 16.5 14.6 16.5 19.79", key: "9nrev1" }],
    ["polyline", { points: "3.27 6.96 12 12.01 20.73 6.96", key: "1180pa" }],
    ["line", { x1: "12", x2: "12", y1: "22.08", y2: "12", key: "3z3uq6" }]
  ];
  const Codesandbox = createLucideIcon("codesandbox", __iconNode$ig);

  const __iconNode$if = [
    ["path", { d: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", key: "sobvz5" }],
    ["path", { d: "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", key: "11i496" }],
    ["path", { d: "M12 2v2", key: "tus03m" }],
    ["path", { d: "M12 22v-2", key: "1osdcq" }],
    ["path", { d: "m17 20.66-1-1.73", key: "eq3orb" }],
    ["path", { d: "M11 10.27 7 3.34", key: "16pf9h" }],
    ["path", { d: "m20.66 17-1.73-1", key: "sg0v6f" }],
    ["path", { d: "m3.34 7 1.73 1", key: "1ulond" }],
    ["path", { d: "M14 12h8", key: "4f43i9" }],
    ["path", { d: "M2 12h2", key: "1t8f8n" }],
    ["path", { d: "m20.66 7-1.73 1", key: "1ow05n" }],
    ["path", { d: "m3.34 17 1.73-1", key: "nuk764" }],
    ["path", { d: "m17 3.34-1 1.73", key: "2wel8s" }],
    ["path", { d: "m11 13.73-4 6.93", key: "794ttg" }]
  ];
  const Cog = createLucideIcon("cog", __iconNode$if);

  const __iconNode$ie = [
    ["circle", { cx: "8", cy: "8", r: "6", key: "3yglwk" }],
    ["path", { d: "M18.09 10.37A6 6 0 1 1 10.34 18", key: "t5s6rm" }],
    ["path", { d: "M7 6h1v4", key: "1obek4" }],
    ["path", { d: "m16.71 13.88.7.71-2.82 2.82", key: "1rbuyh" }]
  ];
  const Coins = createLucideIcon("coins", __iconNode$ie);

  const __iconNode$id = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M12 3v18", key: "108xh3" }]
  ];
  const Columns2 = createLucideIcon("columns-2", __iconNode$id);

  const __iconNode$ic = [
    ["path", { d: "M10.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5.5", key: "1g2yzs" }],
    ["path", { d: "m14.3 19.6 1-.4", key: "11sv9r" }],
    ["path", { d: "M15 3v7.5", key: "7lm50a" }],
    ["path", { d: "m15.2 16.9-.9-.3", key: "1t7mvx" }],
    ["path", { d: "m16.6 21.7.3-.9", key: "1j67ps" }],
    ["path", { d: "m16.8 15.3-.4-1", key: "1ei7r6" }],
    ["path", { d: "m19.1 15.2.3-.9", key: "18r7jp" }],
    ["path", { d: "m19.6 21.7-.4-1", key: "z2vh2" }],
    ["path", { d: "m20.7 16.8 1-.4", key: "19m87a" }],
    ["path", { d: "m21.7 19.4-.9-.3", key: "1qgwi9" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }]
  ];
  const Columns3Cog = createLucideIcon("columns-3-cog", __iconNode$ic);

  const __iconNode$ib = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
    ["path", { d: "M15 3v18", key: "14nvp0" }]
  ];
  const Columns3 = createLucideIcon("columns-3", __iconNode$ib);

  const __iconNode$ia = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M7.5 3v18", key: "w0wo6v" }],
    ["path", { d: "M12 3v18", key: "108xh3" }],
    ["path", { d: "M16.5 3v18", key: "10tjh1" }]
  ];
  const Columns4 = createLucideIcon("columns-4", __iconNode$ia);

  const __iconNode$i9 = [
    ["path", { d: "M10 18H5a3 3 0 0 1-3-3v-1", key: "ru65g8" }],
    ["path", { d: "M14 2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2", key: "e30een" }],
    ["path", { d: "M20 2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2", key: "2ahx8o" }],
    ["path", { d: "m7 21 3-3-3-3", key: "127cv2" }],
    ["rect", { x: "14", y: "14", width: "8", height: "8", rx: "2", key: "1b0bso" }],
    ["rect", { x: "2", y: "2", width: "8", height: "8", rx: "2", key: "1x09vl" }]
  ];
  const Combine = createLucideIcon("combine", __iconNode$i9);

  const __iconNode$i8 = [
    [
      "path",
      { d: "M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3", key: "11bfej" }
    ]
  ];
  const Command = createLucideIcon("command", __iconNode$i8);

  const __iconNode$i7 = [
    [
      "path",
      {
        d: "M15.536 11.293a1 1 0 0 0 0 1.414l2.376 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z",
        key: "1uwlt4"
      }
    ],
    [
      "path",
      {
        d: "M2.297 11.293a1 1 0 0 0 0 1.414l2.377 2.377a1 1 0 0 0 1.414 0l2.377-2.377a1 1 0 0 0 0-1.414L6.088 8.916a1 1 0 0 0-1.414 0z",
        key: "10291m"
      }
    ],
    [
      "path",
      {
        d: "M8.916 17.912a1 1 0 0 0 0 1.415l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.415l-2.377-2.376a1 1 0 0 0-1.414 0z",
        key: "1tqoq1"
      }
    ],
    [
      "path",
      {
        d: "M8.916 4.674a1 1 0 0 0 0 1.414l2.377 2.376a1 1 0 0 0 1.414 0l2.377-2.376a1 1 0 0 0 0-1.414l-2.377-2.377a1 1 0 0 0-1.414 0z",
        key: "1x6lto"
      }
    ]
  ];
  const Component = createLucideIcon("component", __iconNode$i7);

  const __iconNode$i6 = [
    [
      "path",
      {
        d: "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z",
        key: "9ktpf1"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const Compass = createLucideIcon("compass", __iconNode$i6);

  const __iconNode$i5 = [
    ["rect", { width: "14", height: "8", x: "5", y: "2", rx: "2", key: "wc9tft" }],
    ["rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", key: "w68u3i" }],
    ["path", { d: "M6 18h2", key: "rwmk9e" }],
    ["path", { d: "M12 18h6", key: "aqd8w3" }]
  ];
  const Computer = createLucideIcon("computer", __iconNode$i5);

  const __iconNode$i4 = [
    [
      "path",
      { d: "M3 20a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1Z", key: "1pvr1r" }
    ],
    ["path", { d: "M20 16a8 8 0 1 0-16 0", key: "1pa543" }],
    ["path", { d: "M12 4v4", key: "1bq03y" }],
    ["path", { d: "M10 4h4", key: "1xpv9s" }]
  ];
  const ConciergeBell = createLucideIcon("concierge-bell", __iconNode$i4);

  const __iconNode$i3 = [
    ["rect", { x: "2", y: "6", width: "20", height: "8", rx: "1", key: "1estib" }],
    ["path", { d: "M17 14v7", key: "7m2elx" }],
    ["path", { d: "M7 14v7", key: "1cm7wv" }],
    ["path", { d: "M17 3v3", key: "1v4jwn" }],
    ["path", { d: "M7 3v3", key: "7o6guu" }],
    ["path", { d: "M10 14 2.3 6.3", key: "1023jk" }],
    ["path", { d: "m14 6 7.7 7.7", key: "1s8pl2" }],
    ["path", { d: "m8 6 8 8", key: "hl96qh" }]
  ];
  const Construction = createLucideIcon("construction", __iconNode$i3);

  const __iconNode$i2 = [
    ["path", { d: "m20.9 18.55-8-15.98a1 1 0 0 0-1.8 0l-8 15.98", key: "53pte7" }],
    ["ellipse", { cx: "12", cy: "19", rx: "9", ry: "3", key: "1ji25f" }]
  ];
  const Cone = createLucideIcon("cone", __iconNode$i2);

  const __iconNode$i1 = [
    ["path", { d: "M16 2v2", key: "scm5qe" }],
    ["path", { d: "M17.915 22a6 6 0 0 0-12 0", key: "suqz9p" }],
    ["path", { d: "M8 2v2", key: "pbkmx" }],
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
    ["rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", key: "12vinp" }]
  ];
  const ContactRound = createLucideIcon("contact-round", __iconNode$i1);

  const __iconNode$i0 = [
    ["path", { d: "M16 2v2", key: "scm5qe" }],
    ["path", { d: "M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2", key: "1waht3" }],
    ["path", { d: "M8 2v2", key: "pbkmx" }],
    ["circle", { cx: "12", cy: "11", r: "3", key: "itu57m" }],
    ["rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", key: "12vinp" }]
  ];
  const Contact = createLucideIcon("contact", __iconNode$i0);

  const __iconNode$h$ = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M12 18a6 6 0 0 0 0-12v12z", key: "j4l70d" }]
  ];
  const Contrast = createLucideIcon("contrast", __iconNode$h$);

  const __iconNode$h_ = [
    ["path", { d: "M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5", key: "laymnq" }],
    ["path", { d: "M8.5 8.5v.01", key: "ue8clq" }],
    ["path", { d: "M16 15.5v.01", key: "14dtrp" }],
    ["path", { d: "M12 12v.01", key: "u5ubse" }],
    ["path", { d: "M11 17v.01", key: "1hyl5a" }],
    ["path", { d: "M7 14v.01", key: "uct60s" }]
  ];
  const Cookie = createLucideIcon("cookie", __iconNode$h_);

  const __iconNode$hZ = [
    [
      "path",
      {
        d: "M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z",
        key: "1t2lqe"
      }
    ],
    ["path", { d: "M10 21.9V14L2.1 9.1", key: "o7czzq" }],
    ["path", { d: "m10 14 11.9-6.9", key: "zm5e20" }],
    ["path", { d: "M14 19.8v-8.1", key: "159ecu" }],
    ["path", { d: "M18 17.5V9.4", key: "11uown" }]
  ];
  const Container = createLucideIcon("container", __iconNode$hZ);

  const __iconNode$hY = [
    ["path", { d: "M2 12h20", key: "9i4pu4" }],
    ["path", { d: "M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8", key: "u0tga0" }],
    ["path", { d: "m4 8 16-4", key: "16g0ng" }],
    [
      "path",
      {
        d: "m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.48a2 2 0 0 1 2.43 1.46l.45 1.8",
        key: "12cejc"
      }
    ]
  ];
  const CookingPot = createLucideIcon("cooking-pot", __iconNode$hY);

  const __iconNode$hX = [
    ["path", { d: "m12 15 2 2 4-4", key: "2c609p" }],
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ];
  const CopyCheck = createLucideIcon("copy-check", __iconNode$hX);

  const __iconNode$hW = [
    ["line", { x1: "12", x2: "18", y1: "15", y2: "15", key: "1nscbv" }],
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ];
  const CopyMinus = createLucideIcon("copy-minus", __iconNode$hW);

  const __iconNode$hV = [
    ["line", { x1: "15", x2: "15", y1: "12", y2: "18", key: "1p7wdc" }],
    ["line", { x1: "12", x2: "18", y1: "15", y2: "15", key: "1nscbv" }],
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ];
  const CopyPlus = createLucideIcon("copy-plus", __iconNode$hV);

  const __iconNode$hU = [
    ["line", { x1: "12", x2: "18", y1: "18", y2: "12", key: "ebkxgr" }],
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ];
  const CopySlash = createLucideIcon("copy-slash", __iconNode$hU);

  const __iconNode$hT = [
    ["line", { x1: "12", x2: "18", y1: "12", y2: "18", key: "1rg63v" }],
    ["line", { x1: "12", x2: "18", y1: "18", y2: "12", key: "ebkxgr" }],
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ];
  const CopyX = createLucideIcon("copy-x", __iconNode$hT);

  const __iconNode$hS = [
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
  ];
  const Copy = createLucideIcon("copy", __iconNode$hS);

  const __iconNode$hR = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M9.17 14.83a4 4 0 1 0 0-5.66", key: "1sveal" }]
  ];
  const Copyleft = createLucideIcon("copyleft", __iconNode$hR);

  const __iconNode$hQ = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M14.83 14.83a4 4 0 1 1 0-5.66", key: "1i56pz" }]
  ];
  const Copyright = createLucideIcon("copyright", __iconNode$hQ);

  const __iconNode$hP = [
    ["path", { d: "M20 4v7a4 4 0 0 1-4 4H4", key: "6o5b7l" }],
    ["path", { d: "m9 10-5 5 5 5", key: "1kshq7" }]
  ];
  const CornerDownLeft = createLucideIcon("corner-down-left", __iconNode$hP);

  const __iconNode$hO = [
    ["path", { d: "m15 10 5 5-5 5", key: "qqa56n" }],
    ["path", { d: "M4 4v7a4 4 0 0 0 4 4h12", key: "z08zvw" }]
  ];
  const CornerDownRight = createLucideIcon("corner-down-right", __iconNode$hO);

  const __iconNode$hN = [
    ["path", { d: "m14 15-5 5-5-5", key: "1eia93" }],
    ["path", { d: "M20 4h-7a4 4 0 0 0-4 4v12", key: "nbpdq2" }]
  ];
  const CornerLeftDown = createLucideIcon("corner-left-down", __iconNode$hN);

  const __iconNode$hM = [
    ["path", { d: "M14 9 9 4 4 9", key: "1af5af" }],
    ["path", { d: "M20 20h-7a4 4 0 0 1-4-4V4", key: "1blwi3" }]
  ];
  const CornerLeftUp = createLucideIcon("corner-left-up", __iconNode$hM);

  const __iconNode$hL = [
    ["path", { d: "m10 15 5 5 5-5", key: "1hpjnr" }],
    ["path", { d: "M4 4h7a4 4 0 0 1 4 4v12", key: "wcbgct" }]
  ];
  const CornerRightDown = createLucideIcon("corner-right-down", __iconNode$hL);

  const __iconNode$hK = [
    ["path", { d: "m10 9 5-5 5 5", key: "9ctzwi" }],
    ["path", { d: "M4 20h7a4 4 0 0 0 4-4V4", key: "1plgdj" }]
  ];
  const CornerRightUp = createLucideIcon("corner-right-up", __iconNode$hK);

  const __iconNode$hJ = [
    ["path", { d: "M20 20v-7a4 4 0 0 0-4-4H4", key: "1nkjon" }],
    ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }]
  ];
  const CornerUpLeft = createLucideIcon("corner-up-left", __iconNode$hJ);

  const __iconNode$hI = [
    ["path", { d: "m15 14 5-5-5-5", key: "12vg1m" }],
    ["path", { d: "M4 20v-7a4 4 0 0 1 4-4h12", key: "1lu4f8" }]
  ];
  const CornerUpRight = createLucideIcon("corner-up-right", __iconNode$hI);

  const __iconNode$hH = [
    ["path", { d: "M12 20v2", key: "1lh1kg" }],
    ["path", { d: "M12 2v2", key: "tus03m" }],
    ["path", { d: "M17 20v2", key: "1rnc9c" }],
    ["path", { d: "M17 2v2", key: "11trls" }],
    ["path", { d: "M2 12h2", key: "1t8f8n" }],
    ["path", { d: "M2 17h2", key: "7oei6x" }],
    ["path", { d: "M2 7h2", key: "asdhe0" }],
    ["path", { d: "M20 12h2", key: "1q8mjw" }],
    ["path", { d: "M20 17h2", key: "1fpfkl" }],
    ["path", { d: "M20 7h2", key: "1o8tra" }],
    ["path", { d: "M7 20v2", key: "4gnj0m" }],
    ["path", { d: "M7 2v2", key: "1i4yhu" }],
    ["rect", { x: "4", y: "4", width: "16", height: "16", rx: "2", key: "1vbyd7" }],
    ["rect", { x: "8", y: "8", width: "8", height: "8", rx: "1", key: "z9xiuo" }]
  ];
  const Cpu = createLucideIcon("cpu", __iconNode$hH);

  const __iconNode$hG = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    [
      "path",
      { d: "M10 9.3a2.8 2.8 0 0 0-3.5 1 3.1 3.1 0 0 0 0 3.4 2.7 2.7 0 0 0 3.5 1", key: "1ss3eq" }
    ],
    [
      "path",
      { d: "M17 9.3a2.8 2.8 0 0 0-3.5 1 3.1 3.1 0 0 0 0 3.4 2.7 2.7 0 0 0 3.5 1", key: "1od56t" }
    ]
  ];
  const CreativeCommons = createLucideIcon("creative-commons", __iconNode$hG);

  const __iconNode$hF = [
    ["rect", { width: "20", height: "14", x: "2", y: "5", rx: "2", key: "ynyp8z" }],
    ["line", { x1: "2", x2: "22", y1: "10", y2: "10", key: "1b3vmo" }]
  ];
  const CreditCard = createLucideIcon("credit-card", __iconNode$hF);

  const __iconNode$hE = [
    [
      "path",
      {
        d: "m4.6 13.11 5.79-3.21c1.89-1.05 4.79 1.78 3.71 3.71l-3.22 5.81C8.8 23.16.79 15.23 4.6 13.11Z",
        key: "1ozxlb"
      }
    ],
    [
      "path",
      {
        d: "m10.5 9.5-1-2.29C9.2 6.48 8.8 6 8 6H4.5C2.79 6 2 6.5 2 8.5a7.71 7.71 0 0 0 2 4.83",
        key: "ffuyb5"
      }
    ],
    ["path", { d: "M8 6c0-1.55.24-4-2-4-2 0-2.5 2.17-2.5 4", key: "osnpzi" }],
    [
      "path",
      {
        d: "m14.5 13.5 2.29 1c.73.3 1.21.7 1.21 1.5v3.5c0 1.71-.5 2.5-2.5 2.5a7.71 7.71 0 0 1-4.83-2",
        key: "1vubaw"
      }
    ],
    ["path", { d: "M18 16c1.55 0 4-.24 4 2 0 2-2.17 2.5-4 2.5", key: "wxr772" }]
  ];
  const Croissant = createLucideIcon("croissant", __iconNode$hE);

  const __iconNode$hD = [
    ["path", { d: "M6 2v14a2 2 0 0 0 2 2h14", key: "ron5a4" }],
    ["path", { d: "M18 22V8a2 2 0 0 0-2-2H2", key: "7s9ehn" }]
  ];
  const Crop = createLucideIcon("crop", __iconNode$hD);

  const __iconNode$hC = [
    [
      "path",
      {
        d: "M4 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a1 1 0 0 1 1 1v4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4a1 1 0 0 1 1-1h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-4a1 1 0 0 1-1-1V4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4a1 1 0 0 1-1 1z",
        key: "1xbrqy"
      }
    ]
  ];
  const Cross = createLucideIcon("cross", __iconNode$hC);

  const __iconNode$hB = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["line", { x1: "22", x2: "18", y1: "12", y2: "12", key: "l9bcsi" }],
    ["line", { x1: "6", x2: "2", y1: "12", y2: "12", key: "13hhkx" }],
    ["line", { x1: "12", x2: "12", y1: "6", y2: "2", key: "10w3f3" }],
    ["line", { x1: "12", x2: "12", y1: "22", y2: "18", key: "15g9kq" }]
  ];
  const Crosshair = createLucideIcon("crosshair", __iconNode$hB);

  const __iconNode$hA = [
    [
      "path",
      {
        d: "m21.12 6.4-6.05-4.06a2 2 0 0 0-2.17-.05L2.95 8.41a2 2 0 0 0-.95 1.7v5.82a2 2 0 0 0 .88 1.66l6.05 4.07a2 2 0 0 0 2.17.05l9.95-6.12a2 2 0 0 0 .95-1.7V8.06a2 2 0 0 0-.88-1.66Z",
        key: "1u2ovd"
      }
    ],
    ["path", { d: "M10 22v-8L2.25 9.15", key: "11pn4q" }],
    ["path", { d: "m10 14 11.77-6.87", key: "1kt1wh" }]
  ];
  const Cuboid = createLucideIcon("cuboid", __iconNode$hA);

  const __iconNode$hz = [
    ["path", { d: "m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8", key: "8166m8" }],
    ["path", { d: "M5 8h14", key: "pcz4l3" }],
    ["path", { d: "M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0", key: "yjz344" }],
    ["path", { d: "m12 8 1-6h2", key: "3ybfa4" }]
  ];
  const CupSoda = createLucideIcon("cup-soda", __iconNode$hz);

  const __iconNode$hy = [
    ["circle", { cx: "12", cy: "12", r: "8", key: "46899m" }],
    ["line", { x1: "3", x2: "6", y1: "3", y2: "6", key: "1jkytn" }],
    ["line", { x1: "21", x2: "18", y1: "3", y2: "6", key: "14zfjt" }],
    ["line", { x1: "3", x2: "6", y1: "21", y2: "18", key: "iusuec" }],
    ["line", { x1: "21", x2: "18", y1: "21", y2: "18", key: "yj2dd7" }]
  ];
  const Currency = createLucideIcon("currency", __iconNode$hy);

  const __iconNode$hx = [
    [
      "path",
      {
        d: "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z",
        key: "1vdc57"
      }
    ],
    ["path", { d: "M5 21h14", key: "11awu3" }]
  ];
  const Crown = createLucideIcon("crown", __iconNode$hx);

  const __iconNode$hw = [
    ["ellipse", { cx: "12", cy: "5", rx: "9", ry: "3", key: "msslwz" }],
    ["path", { d: "M3 5v14a9 3 0 0 0 18 0V5", key: "aqi0yr" }]
  ];
  const Cylinder = createLucideIcon("cylinder", __iconNode$hw);

  const __iconNode$hv = [
    [
      "path",
      { d: "M11 11.31c1.17.56 1.54 1.69 3.5 1.69 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1", key: "157kva" }
    ],
    ["path", { d: "M11.75 18c.35.5 1.45 1 2.75 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1", key: "d7q6m6" }],
    ["path", { d: "M2 10h4", key: "l0bgd4" }],
    ["path", { d: "M2 14h4", key: "1gsvsf" }],
    ["path", { d: "M2 18h4", key: "1bu2t1" }],
    ["path", { d: "M2 6h4", key: "aawbzj" }],
    [
      "path",
      { d: "M7 3a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1L10 4a1 1 0 0 0-1-1z", key: "pr6s65" }
    ]
  ];
  const Dam = createLucideIcon("dam", __iconNode$hv);

  const __iconNode$hu = [
    ["ellipse", { cx: "12", cy: "5", rx: "9", ry: "3", key: "msslwz" }],
    ["path", { d: "M3 12a9 3 0 0 0 5 2.69", key: "1ui2ym" }],
    ["path", { d: "M21 9.3V5", key: "6k6cib" }],
    ["path", { d: "M3 5v14a9 3 0 0 0 6.47 2.88", key: "i62tjy" }],
    ["path", { d: "M12 12v4h4", key: "1bxaet" }],
    [
      "path",
      {
        d: "M13 20a5 5 0 0 0 9-3 4.5 4.5 0 0 0-4.5-4.5c-1.33 0-2.54.54-3.41 1.41L12 16",
        key: "1f4ei9"
      }
    ]
  ];
  const DatabaseBackup = createLucideIcon("database-backup", __iconNode$hu);

  const __iconNode$ht = [
    ["ellipse", { cx: "12", cy: "5", rx: "9", ry: "3", key: "msslwz" }],
    ["path", { d: "M3 5V19A9 3 0 0 0 15 21.84", key: "14ibmq" }],
    ["path", { d: "M21 5V8", key: "1marbg" }],
    ["path", { d: "M21 12L18 17H22L19 22", key: "zafso" }],
    ["path", { d: "M3 12A9 3 0 0 0 14.59 14.87", key: "1y4wr8" }]
  ];
  const DatabaseZap = createLucideIcon("database-zap", __iconNode$ht);

  const __iconNode$hs = [
    ["ellipse", { cx: "12", cy: "5", rx: "9", ry: "3", key: "msslwz" }],
    ["path", { d: "M3 5V19A9 3 0 0 0 21 19V5", key: "1wlel7" }],
    ["path", { d: "M3 12A9 3 0 0 0 21 12", key: "mv7ke4" }]
  ];
  const Database = createLucideIcon("database", __iconNode$hs);

  const __iconNode$hr = [
    ["path", { d: "m13 21-3-3 3-3", key: "s3o1nf" }],
    ["path", { d: "M20 18H10", key: "14r3mt" }],
    ["path", { d: "M3 11h.01", key: "1eifu7" }],
    ["rect", { x: "6", y: "3", width: "5", height: "8", rx: "2.5", key: "v9paqo" }]
  ];
  const DecimalsArrowLeft = createLucideIcon("decimals-arrow-left", __iconNode$hr);

  const __iconNode$hq = [
    ["path", { d: "M10 18h10", key: "1y5s8o" }],
    ["path", { d: "m17 21 3-3-3-3", key: "1ammt0" }],
    ["path", { d: "M3 11h.01", key: "1eifu7" }],
    ["rect", { x: "15", y: "3", width: "5", height: "8", rx: "2.5", key: "76md6a" }],
    ["rect", { x: "6", y: "3", width: "5", height: "8", rx: "2.5", key: "v9paqo" }]
  ];
  const DecimalsArrowRight = createLucideIcon("decimals-arrow-right", __iconNode$hq);

  const __iconNode$hp = [
    [
      "path",
      {
        d: "M10 5a2 2 0 0 0-1.344.519l-6.328 5.74a1 1 0 0 0 0 1.481l6.328 5.741A2 2 0 0 0 10 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",
        key: "1yo7s0"
      }
    ],
    ["path", { d: "m12 9 6 6", key: "anjzzh" }],
    ["path", { d: "m18 9-6 6", key: "1fp51s" }]
  ];
  const Delete = createLucideIcon("delete", __iconNode$hp);

  const __iconNode$ho = [
    ["circle", { cx: "12", cy: "4", r: "2", key: "muu5ef" }],
    [
      "path",
      {
        d: "M10.2 3.2C5.5 4 2 8.1 2 13a2 2 0 0 0 4 0v-1a2 2 0 0 1 4 0v4a2 2 0 0 0 4 0v-4a2 2 0 0 1 4 0v1a2 2 0 0 0 4 0c0-4.9-3.5-9-8.2-9.8",
        key: "lfo06j"
      }
    ],
    ["path", { d: "M3.2 14.8a9 9 0 0 0 17.6 0", key: "12xarc" }]
  ];
  const Dessert = createLucideIcon("dessert", __iconNode$ho);

  const __iconNode$hn = [
    ["circle", { cx: "19", cy: "19", r: "2", key: "17f5cg" }],
    ["circle", { cx: "5", cy: "5", r: "2", key: "1gwv83" }],
    ["path", { d: "M6.48 3.66a10 10 0 0 1 13.86 13.86", key: "xr8kdq" }],
    ["path", { d: "m6.41 6.41 11.18 11.18", key: "uhpjw7" }],
    ["path", { d: "M3.66 6.48a10 10 0 0 0 13.86 13.86", key: "cldpwv" }]
  ];
  const Diameter = createLucideIcon("diameter", __iconNode$hn);

  const __iconNode$hm = [
    [
      "path",
      {
        d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z",
        key: "1tpxz2"
      }
    ],
    ["path", { d: "M9.2 9.2h.01", key: "1b7bvt" }],
    ["path", { d: "m14.5 9.5-5 5", key: "17q4r4" }],
    ["path", { d: "M14.7 14.8h.01", key: "17nsh4" }]
  ];
  const DiamondPercent = createLucideIcon("diamond-percent", __iconNode$hm);

  const __iconNode$hl = [
    [
      "path",
      {
        d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z",
        key: "1ey20j"
      }
    ],
    ["path", { d: "M8 12h8", key: "1wcyev" }]
  ];
  const DiamondMinus = createLucideIcon("diamond-minus", __iconNode$hl);

  const __iconNode$hk = [
    ["path", { d: "M12 8v8", key: "napkw2" }],
    [
      "path",
      {
        d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z",
        key: "1ey20j"
      }
    ],
    ["path", { d: "M8 12h8", key: "1wcyev" }]
  ];
  const DiamondPlus = createLucideIcon("diamond-plus", __iconNode$hk);

  const __iconNode$hj = [
    [
      "path",
      {
        d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z",
        key: "1f1r0c"
      }
    ]
  ];
  const Diamond = createLucideIcon("diamond", __iconNode$hj);

  const __iconNode$hi = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["path", { d: "M12 12h.01", key: "1mp3jc" }]
  ];
  const Dice1 = createLucideIcon("dice-1", __iconNode$hi);

  const __iconNode$hh = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["path", { d: "M15 9h.01", key: "x1ddxp" }],
    ["path", { d: "M9 15h.01", key: "fzyn71" }]
  ];
  const Dice2 = createLucideIcon("dice-2", __iconNode$hh);

  const __iconNode$hg = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["path", { d: "M16 8h.01", key: "cr5u4v" }],
    ["path", { d: "M12 12h.01", key: "1mp3jc" }],
    ["path", { d: "M8 16h.01", key: "18s6g9" }]
  ];
  const Dice3 = createLucideIcon("dice-3", __iconNode$hg);

  const __iconNode$hf = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["path", { d: "M16 8h.01", key: "cr5u4v" }],
    ["path", { d: "M8 8h.01", key: "1e4136" }],
    ["path", { d: "M8 16h.01", key: "18s6g9" }],
    ["path", { d: "M16 16h.01", key: "1f9h7w" }]
  ];
  const Dice4 = createLucideIcon("dice-4", __iconNode$hf);

  const __iconNode$he = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["path", { d: "M16 8h.01", key: "cr5u4v" }],
    ["path", { d: "M8 8h.01", key: "1e4136" }],
    ["path", { d: "M8 16h.01", key: "18s6g9" }],
    ["path", { d: "M16 16h.01", key: "1f9h7w" }],
    ["path", { d: "M12 12h.01", key: "1mp3jc" }]
  ];
  const Dice5 = createLucideIcon("dice-5", __iconNode$he);

  const __iconNode$hd = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["path", { d: "M16 8h.01", key: "cr5u4v" }],
    ["path", { d: "M16 12h.01", key: "1l6xoz" }],
    ["path", { d: "M16 16h.01", key: "1f9h7w" }],
    ["path", { d: "M8 8h.01", key: "1e4136" }],
    ["path", { d: "M8 12h.01", key: "czm47f" }],
    ["path", { d: "M8 16h.01", key: "18s6g9" }]
  ];
  const Dice6 = createLucideIcon("dice-6", __iconNode$hd);

  const __iconNode$hc = [
    ["rect", { width: "12", height: "12", x: "2", y: "10", rx: "2", ry: "2", key: "6agr2n" }],
    [
      "path",
      { d: "m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6", key: "1o487t" }
    ],
    ["path", { d: "M6 18h.01", key: "uhywen" }],
    ["path", { d: "M10 14h.01", key: "ssrbsk" }],
    ["path", { d: "M15 6h.01", key: "cblpky" }],
    ["path", { d: "M18 9h.01", key: "2061c0" }]
  ];
  const Dices = createLucideIcon("dices", __iconNode$hc);

  const __iconNode$hb = [
    ["path", { d: "M12 3v14", key: "7cf3v8" }],
    ["path", { d: "M5 10h14", key: "elsbfy" }],
    ["path", { d: "M5 21h14", key: "11awu3" }]
  ];
  const Diff = createLucideIcon("diff", __iconNode$hb);

  const __iconNode$ha = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
    ["path", { d: "M12 12h.01", key: "1mp3jc" }]
  ];
  const Disc2 = createLucideIcon("disc-2", __iconNode$ha);

  const __iconNode$h9 = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M6 12c0-1.7.7-3.2 1.8-4.2", key: "oqkarx" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }],
    ["path", { d: "M18 12c0 1.7-.7 3.2-1.8 4.2", key: "1eah9h" }]
  ];
  const Disc3 = createLucideIcon("disc-3", __iconNode$h9);

  const __iconNode$h8 = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]
  ];
  const Disc = createLucideIcon("disc", __iconNode$h8);

  const __iconNode$h7 = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["circle", { cx: "12", cy: "12", r: "5", key: "nd82uf" }],
    ["path", { d: "M12 12h.01", key: "1mp3jc" }]
  ];
  const DiscAlbum = createLucideIcon("disc-album", __iconNode$h7);

  const __iconNode$h6 = [
    ["circle", { cx: "12", cy: "6", r: "1", key: "1bh7o1" }],
    ["line", { x1: "5", x2: "19", y1: "12", y2: "12", key: "13b5wn" }],
    ["circle", { cx: "12", cy: "18", r: "1", key: "lqb9t5" }]
  ];
  const Divide = createLucideIcon("divide", __iconNode$h6);

  const __iconNode$h5 = [
    ["path", { d: "M15 2c-1.35 1.5-2.092 3-2.5 4.5L14 8", key: "1bivrr" }],
    ["path", { d: "m17 6-2.891-2.891", key: "xu6p2f" }],
    ["path", { d: "M2 15c3.333-3 6.667-3 10-3", key: "nxix30" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "m20 9 .891.891", key: "3xwk7g" }],
    ["path", { d: "M22 9c-1.5 1.35-3 2.092-4.5 2.5l-1-1", key: "18cutr" }],
    ["path", { d: "M3.109 14.109 4 15", key: "q76aoh" }],
    ["path", { d: "m6.5 12.5 1 1", key: "cs35ky" }],
    ["path", { d: "m7 18 2.891 2.891", key: "1sisit" }],
    ["path", { d: "M9 22c1.35-1.5 2.092-3 2.5-4.5L10 16", key: "rlvei3" }]
  ];
  const DnaOff = createLucideIcon("dna-off", __iconNode$h5);

  const __iconNode$h4 = [
    ["path", { d: "m10 16 1.5 1.5", key: "11lckj" }],
    ["path", { d: "m14 8-1.5-1.5", key: "1ohn8i" }],
    ["path", { d: "M15 2c-1.798 1.998-2.518 3.995-2.807 5.993", key: "80uv8i" }],
    ["path", { d: "m16.5 10.5 1 1", key: "696xn5" }],
    ["path", { d: "m17 6-2.891-2.891", key: "xu6p2f" }],
    ["path", { d: "M2 15c6.667-6 13.333 0 20-6", key: "1pyr53" }],
    ["path", { d: "m20 9 .891.891", key: "3xwk7g" }],
    ["path", { d: "M3.109 14.109 4 15", key: "q76aoh" }],
    ["path", { d: "m6.5 12.5 1 1", key: "cs35ky" }],
    ["path", { d: "m7 18 2.891 2.891", key: "1sisit" }],
    ["path", { d: "M9 22c1.798-1.998 2.518-3.995 2.807-5.993", key: "q3hbxp" }]
  ];
  const Dna = createLucideIcon("dna", __iconNode$h4);

  const __iconNode$h3 = [
    ["path", { d: "M11.25 16.25h1.5L12 17z", key: "w7jh35" }],
    ["path", { d: "M16 14v.5", key: "1lajdz" }],
    [
      "path",
      {
        d: "M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444a11.702 11.702 0 0 0-.493-3.309",
        key: "u7s9ue"
      }
    ],
    ["path", { d: "M8 14v.5", key: "1nzgdb" }],
    [
      "path",
      {
        d: "M8.5 8.5c-.384 1.05-1.083 2.028-2.344 2.5-1.931.722-3.576-.297-3.656-1-.113-.994 1.177-6.53 4-7 1.923-.321 3.651.845 3.651 2.235A7.497 7.497 0 0 1 14 5.277c0-1.39 1.844-2.598 3.767-2.277 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5",
        key: "v8hric"
      }
    ]
  ];
  const Dog = createLucideIcon("dog", __iconNode$h3);

  const __iconNode$h2 = [
    ["path", { d: "M2 8h20", key: "d11cs7" }],
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
    ["path", { d: "M6 16h12", key: "u522kt" }]
  ];
  const Dock = createLucideIcon("dock", __iconNode$h2);

  const __iconNode$h1 = [
    ["line", { x1: "12", x2: "12", y1: "2", y2: "22", key: "7eqyqh" }],
    ["path", { d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", key: "1b0p4s" }]
  ];
  const DollarSign = createLucideIcon("dollar-sign", __iconNode$h1);

  const __iconNode$h0 = [
    [
      "path",
      {
        d: "M20.5 10a2.5 2.5 0 0 1-2.4-3H18a2.95 2.95 0 0 1-2.6-4.4 10 10 0 1 0 6.3 7.1c-.3.2-.8.3-1.2.3",
        key: "19sr3x"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
  ];
  const Donut = createLucideIcon("donut", __iconNode$h0);

  const __iconNode$g$ = [
    ["path", { d: "M10 12h.01", key: "1kxr2c" }],
    ["path", { d: "M18 9V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14", key: "1bnhmg" }],
    ["path", { d: "M2 20h8", key: "10ntw1" }],
    ["path", { d: "M20 17v-2a2 2 0 1 0-4 0v2", key: "pwaxnr" }],
    ["rect", { x: "14", y: "17", width: "8", height: "5", rx: "1", key: "15pjcy" }]
  ];
  const DoorClosedLocked = createLucideIcon("door-closed-locked", __iconNode$g$);

  const __iconNode$g_ = [
    ["path", { d: "M10 12h.01", key: "1kxr2c" }],
    ["path", { d: "M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14", key: "36qu9e" }],
    ["path", { d: "M2 20h20", key: "owomy5" }]
  ];
  const DoorClosed = createLucideIcon("door-closed", __iconNode$g_);

  const __iconNode$gZ = [
    ["path", { d: "M11 20H2", key: "nlcfvz" }],
    [
      "path",
      {
        d: "M11 4.562v16.157a1 1 0 0 0 1.242.97L19 20V5.562a2 2 0 0 0-1.515-1.94l-4-1A2 2 0 0 0 11 4.561z",
        key: "au4z13"
      }
    ],
    ["path", { d: "M11 4H8a2 2 0 0 0-2 2v14", key: "74r1mk" }],
    ["path", { d: "M14 12h.01", key: "1jfl7z" }],
    ["path", { d: "M22 20h-3", key: "vhrsz" }]
  ];
  const DoorOpen = createLucideIcon("door-open", __iconNode$gZ);

  const __iconNode$gY = [["circle", { cx: "12.1", cy: "12.1", r: "1", key: "18d7e5" }]];
  const Dot = createLucideIcon("dot", __iconNode$gY);

  const __iconNode$gX = [
    ["path", { d: "M12 15V3", key: "m9g1x1" }],
    ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
    ["path", { d: "m7 10 5 5 5-5", key: "brsn70" }]
  ];
  const Download = createLucideIcon("download", __iconNode$gX);

  const __iconNode$gW = [
    ["path", { d: "m12.99 6.74 1.93 3.44", key: "iwagvd" }],
    ["path", { d: "M19.136 12a10 10 0 0 1-14.271 0", key: "ppmlo4" }],
    ["path", { d: "m21 21-2.16-3.84", key: "vylbct" }],
    ["path", { d: "m3 21 8.02-14.26", key: "1ssaw4" }],
    ["circle", { cx: "12", cy: "5", r: "2", key: "f1ur92" }]
  ];
  const DraftingCompass = createLucideIcon("drafting-compass", __iconNode$gW);

  const __iconNode$gV = [
    ["path", { d: "M10 11h.01", key: "d2at3l" }],
    ["path", { d: "M14 6h.01", key: "k028ub" }],
    ["path", { d: "M18 6h.01", key: "1v4wsw" }],
    ["path", { d: "M6.5 13.1h.01", key: "1748ia" }],
    ["path", { d: "M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3", key: "172yzv" }],
    ["path", { d: "M17.4 9.9c-.8.8-2 .8-2.8 0", key: "1obv0w" }],
    [
      "path",
      {
        d: "M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7",
        key: "rqjl8i"
      }
    ],
    ["path", { d: "M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4", key: "1mr6wy" }]
  ];
  const Drama = createLucideIcon("drama", __iconNode$gV);

  const __iconNode$gU = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94", key: "hpej1" }],
    ["path", { d: "M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32", key: "1tr44o" }],
    ["path", { d: "M8.56 2.75c4.37 6 6 9.42 8 17.72", key: "kbh691" }]
  ];
  const Dribbble = createLucideIcon("dribbble", __iconNode$gU);

  const __iconNode$gT = [
    [
      "path",
      { d: "M10 18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a3 3 0 0 1-3-3 1 1 0 0 1 1-1z", key: "ioqxb1" }
    ],
    [
      "path",
      {
        d: "M13 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1l-.81 3.242a1 1 0 0 1-.97.758H8",
        key: "1rs59n"
      }
    ],
    ["path", { d: "M14 4h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3", key: "105ega" }],
    ["path", { d: "M18 6h4", key: "66u95g" }],
    ["path", { d: "m5 10-2 8", key: "xt2lic" }],
    ["path", { d: "m7 18 2-8", key: "1bzku2" }]
  ];
  const Drill = createLucideIcon("drill", __iconNode$gT);

  const __iconNode$gS = [
    ["path", { d: "M10 10 7 7", key: "zp14k7" }],
    ["path", { d: "m10 14-3 3", key: "1jrpxk" }],
    ["path", { d: "m14 10 3-3", key: "7tigam" }],
    ["path", { d: "m14 14 3 3", key: "vm23p3" }],
    ["path", { d: "M14.205 4.139a4 4 0 1 1 5.439 5.863", key: "1tm5p2" }],
    ["path", { d: "M19.637 14a4 4 0 1 1-5.432 5.868", key: "16egi2" }],
    ["path", { d: "M4.367 10a4 4 0 1 1 5.438-5.862", key: "1wta6a" }],
    ["path", { d: "M9.795 19.862a4 4 0 1 1-5.429-5.873", key: "q39hpv" }],
    ["rect", { x: "10", y: "8", width: "4", height: "8", rx: "1", key: "phrjt1" }]
  ];
  const Drone = createLucideIcon("drone", __iconNode$gS);

  const __iconNode$gR = [
    [
      "path",
      {
        d: "M18.715 13.186C18.29 11.858 17.384 10.607 16 9.5c-2-1.6-3.5-4-4-6.5a10.7 10.7 0 0 1-.884 2.586",
        key: "8suz2t"
      }
    ],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    [
      "path",
      { d: "M8.795 8.797A11 11 0 0 1 8 9.5C6 11.1 5 13 5 15a7 7 0 0 0 13.222 3.208", key: "19dw9m" }
    ]
  ];
  const DropletOff = createLucideIcon("droplet-off", __iconNode$gR);

  const __iconNode$gQ = [
    [
      "path",
      {
        d: "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
        key: "c7niix"
      }
    ]
  ];
  const Droplet = createLucideIcon("droplet", __iconNode$gQ);

  const __iconNode$gP = [
    [
      "path",
      {
        d: "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z",
        key: "1ptgy4"
      }
    ],
    [
      "path",
      {
        d: "M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97",
        key: "1sl1rz"
      }
    ]
  ];
  const Droplets = createLucideIcon("droplets", __iconNode$gP);

  const __iconNode$gO = [
    ["path", { d: "m2 2 8 8", key: "1v6059" }],
    ["path", { d: "m22 2-8 8", key: "173r8a" }],
    ["ellipse", { cx: "12", cy: "9", rx: "10", ry: "5", key: "liohsx" }],
    ["path", { d: "M7 13.4v7.9", key: "1yi6u9" }],
    ["path", { d: "M12 14v8", key: "1tn2tj" }],
    ["path", { d: "M17 13.4v7.9", key: "eqz2v3" }],
    ["path", { d: "M2 9v8a10 5 0 0 0 20 0V9", key: "1750ul" }]
  ];
  const Drum = createLucideIcon("drum", __iconNode$gO);

  const __iconNode$gN = [
    [
      "path",
      { d: "M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23", key: "1dtqwm" }
    ],
    [
      "path",
      {
        d: "m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59",
        key: "1oq1fw"
      }
    ]
  ];
  const Drumstick = createLucideIcon("drumstick", __iconNode$gN);

  const __iconNode$gM = [
    [
      "path",
      {
        d: "M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z",
        key: "9m4mmf"
      }
    ],
    ["path", { d: "m2.5 21.5 1.4-1.4", key: "17g3f0" }],
    ["path", { d: "m20.1 3.9 1.4-1.4", key: "1qn309" }],
    [
      "path",
      {
        d: "M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z",
        key: "1t2c92"
      }
    ],
    ["path", { d: "m9.6 14.4 4.8-4.8", key: "6umqxw" }]
  ];
  const Dumbbell = createLucideIcon("dumbbell", __iconNode$gM);

  const __iconNode$gL = [
    ["path", { d: "M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0", key: "1dfaln" }],
    ["path", { d: "M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4", key: "1qnva7" }]
  ];
  const Ear = createLucideIcon("ear", __iconNode$gL);

  const __iconNode$gK = [
    ["path", { d: "M6 18.5a3.5 3.5 0 1 0 7 0c0-1.57.92-2.52 2.04-3.46", key: "1qngmn" }],
    ["path", { d: "M6 8.5c0-.75.13-1.47.36-2.14", key: "b06bma" }],
    ["path", { d: "M8.8 3.15A6.5 6.5 0 0 1 19 8.5c0 1.63-.44 2.81-1.09 3.76", key: "g10hsz" }],
    ["path", { d: "M12.5 6A2.5 2.5 0 0 1 15 8.5M10 13a2 2 0 0 0 1.82-1.18", key: "ygzou7" }],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const EarOff = createLucideIcon("ear-off", __iconNode$gK);

  const __iconNode$gJ = [
    ["path", { d: "M7 3.34V5a3 3 0 0 0 3 3", key: "w732o8" }],
    ["path", { d: "M11 21.95V18a2 2 0 0 0-2-2 2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05", key: "f02343" }],
    ["path", { d: "M21.54 15H17a2 2 0 0 0-2 2v4.54", key: "1djwo0" }],
    ["path", { d: "M12 2a10 10 0 1 0 9.54 13", key: "zjsr6q" }],
    ["path", { d: "M20 6V4a2 2 0 1 0-4 0v2", key: "1of5e8" }],
    ["rect", { width: "8", height: "5", x: "14", y: "6", rx: "1", key: "1fmf51" }]
  ];
  const EarthLock = createLucideIcon("earth-lock", __iconNode$gJ);

  const __iconNode$gI = [
    ["path", { d: "M21.54 15H17a2 2 0 0 0-2 2v4.54", key: "1djwo0" }],
    [
      "path",
      {
        d: "M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17",
        key: "1tzkfa"
      }
    ],
    ["path", { d: "M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05", key: "14pb5j" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const Earth = createLucideIcon("earth", __iconNode$gI);

  const __iconNode$gH = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M12 2a7 7 0 1 0 10 10", key: "1yuj32" }]
  ];
  const Eclipse = createLucideIcon("eclipse", __iconNode$gH);

  const __iconNode$gG = [
    ["circle", { cx: "11.5", cy: "12.5", r: "3.5", key: "1cl1mi" }],
    [
      "path",
      {
        d: "M3 8c0-3.5 2.5-6 6.5-6 5 0 4.83 3 7.5 5s5 2 5 6c0 4.5-2.5 6.5-7 6.5-2.5 0-2.5 2.5-6 2.5s-7-2-7-5.5c0-3 1.5-3 1.5-5C3.5 10 3 9 3 8Z",
        key: "165ef9"
      }
    ]
  ];
  const EggFried = createLucideIcon("egg-fried", __iconNode$gG);

  const __iconNode$gF = [
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M20 14.347V14c0-6-4-12-8-12-1.078 0-2.157.436-3.157 1.19", key: "13g2jy" }],
    ["path", { d: "M6.206 6.21C4.871 8.4 4 11.2 4 14a8 8 0 0 0 14.568 4.568", key: "1581id" }]
  ];
  const EggOff = createLucideIcon("egg-off", __iconNode$gF);

  const __iconNode$gE = [
    ["path", { d: "M12 2C8 2 4 8 4 14a8 8 0 0 0 16 0c0-6-4-12-8-12", key: "1le142" }]
  ];
  const Egg = createLucideIcon("egg", __iconNode$gE);

  const __iconNode$gD = [
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
    ["circle", { cx: "12", cy: "5", r: "1", key: "gxeob9" }],
    ["circle", { cx: "12", cy: "19", r: "1", key: "lyex9k" }]
  ];
  const EllipsisVertical = createLucideIcon("ellipsis-vertical", __iconNode$gD);

  const __iconNode$gC = [
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
    ["circle", { cx: "19", cy: "12", r: "1", key: "1wjl8i" }],
    ["circle", { cx: "5", cy: "12", r: "1", key: "1pcz8c" }]
  ];
  const Ellipsis = createLucideIcon("ellipsis", __iconNode$gC);

  const __iconNode$gB = [
    ["line", { x1: "5", x2: "19", y1: "9", y2: "9", key: "1nwqeh" }],
    ["line", { x1: "5", x2: "19", y1: "15", y2: "15", key: "g8yjpy" }],
    ["line", { x1: "19", x2: "5", y1: "5", y2: "19", key: "1x9vlm" }]
  ];
  const EqualNot = createLucideIcon("equal-not", __iconNode$gB);

  const __iconNode$gA = [
    ["path", { d: "M5 15a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0", key: "yrdkhy" }],
    ["path", { d: "M5 9a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0", key: "gzkvyz" }]
  ];
  const EqualApproximately = createLucideIcon("equal-approximately", __iconNode$gA);

  const __iconNode$gz = [
    ["line", { x1: "5", x2: "19", y1: "9", y2: "9", key: "1nwqeh" }],
    ["line", { x1: "5", x2: "19", y1: "15", y2: "15", key: "g8yjpy" }]
  ];
  const Equal = createLucideIcon("equal", __iconNode$gz);

  const __iconNode$gy = [
    [
      "path",
      {
        d: "M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21",
        key: "g5wo59"
      }
    ],
    ["path", { d: "m5.082 11.09 8.828 8.828", key: "1wx5vj" }]
  ];
  const Eraser = createLucideIcon("eraser", __iconNode$gy);

  const __iconNode$gx = [
    [
      "path",
      {
        d: "m15 20 3-3h2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2l3 3z",
        key: "rbahqx"
      }
    ],
    ["path", { d: "M6 8v1", key: "1636ez" }],
    ["path", { d: "M10 8v1", key: "1talb4" }],
    ["path", { d: "M14 8v1", key: "1rsfgr" }],
    ["path", { d: "M18 8v1", key: "gnkwox" }]
  ];
  const EthernetPort = createLucideIcon("ethernet-port", __iconNode$gx);

  const __iconNode$gw = [
    ["path", { d: "M4 10h12", key: "1y6xl8" }],
    ["path", { d: "M4 14h9", key: "1loblj" }],
    [
      "path",
      {
        d: "M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2",
        key: "1j6lzo"
      }
    ]
  ];
  const Euro = createLucideIcon("euro", __iconNode$gw);

  const __iconNode$gv = [
    ["path", { d: "m15 15 6 6", key: "1s409w" }],
    ["path", { d: "m15 9 6-6", key: "ko1vev" }],
    ["path", { d: "M21 16v5h-5", key: "1ck2sf" }],
    ["path", { d: "M21 8V3h-5", key: "1qoq8a" }],
    ["path", { d: "M3 16v5h5", key: "1t08am" }],
    ["path", { d: "m3 21 6-6", key: "wwnumi" }],
    ["path", { d: "M3 8V3h5", key: "1ln10m" }],
    ["path", { d: "M9 9 3 3", key: "v551iv" }]
  ];
  const Expand = createLucideIcon("expand", __iconNode$gv);

  const __iconNode$gu = [
    ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
    ["path", { d: "M10 14 21 3", key: "gplh6r" }],
    ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6", key: "a6xqqp" }]
  ];
  const ExternalLink = createLucideIcon("external-link", __iconNode$gu);

  const __iconNode$gt = [
    ["path", { d: "m15 18-.722-3.25", key: "1j64jw" }],
    ["path", { d: "M2 8a10.645 10.645 0 0 0 20 0", key: "1e7gxb" }],
    ["path", { d: "m20 15-1.726-2.05", key: "1cnuld" }],
    ["path", { d: "m4 15 1.726-2.05", key: "1dsqqd" }],
    ["path", { d: "m9 18 .722-3.25", key: "ypw2yx" }]
  ];
  const EyeClosed = createLucideIcon("eye-closed", __iconNode$gt);

  const __iconNode$gs = [
    [
      "path",
      {
        d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
        key: "ct8e1f"
      }
    ],
    ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242", key: "151rxh" }],
    [
      "path",
      {
        d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
        key: "13bj9a"
      }
    ],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const EyeOff = createLucideIcon("eye-off", __iconNode$gs);

  const __iconNode$gr = [
    [
      "path",
      {
        d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
        key: "1nclc0"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
  ];
  const Eye = createLucideIcon("eye", __iconNode$gr);

  const __iconNode$gq = [
    [
      "path",
      { d: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z", key: "1jg4f8" }
    ]
  ];
  const Facebook = createLucideIcon("facebook", __iconNode$gq);

  const __iconNode$gp = [
    [
      "path",
      {
        d: "M10.827 16.379a6.082 6.082 0 0 1-8.618-7.002l5.412 1.45a6.082 6.082 0 0 1 7.002-8.618l-1.45 5.412a6.082 6.082 0 0 1 8.618 7.002l-5.412-1.45a6.082 6.082 0 0 1-7.002 8.618l1.45-5.412Z",
        key: "484a7f"
      }
    ],
    ["path", { d: "M12 12v.01", key: "u5ubse" }]
  ];
  const Fan = createLucideIcon("fan", __iconNode$gp);

  const __iconNode$go = [
    ["path", { d: "M12 16h.01", key: "1drbdi" }],
    ["path", { d: "M16 16h.01", key: "1f9h7w" }],
    [
      "path",
      {
        d: "M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z",
        key: "1iv0i2"
      }
    ],
    ["path", { d: "M8 16h.01", key: "18s6g9" }]
  ];
  const Factory = createLucideIcon("factory", __iconNode$go);

  const __iconNode$gn = [
    ["polygon", { points: "13 19 22 12 13 5 13 19", key: "587y9g" }],
    ["polygon", { points: "2 19 11 12 2 5 2 19", key: "3pweh0" }]
  ];
  const FastForward = createLucideIcon("fast-forward", __iconNode$gn);

  const __iconNode$gm = [
    [
      "path",
      {
        d: "M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z",
        key: "18jl4k"
      }
    ],
    ["path", { d: "M16 8 2 22", key: "vp34q" }],
    ["path", { d: "M17.5 15H9", key: "1oz8nu" }]
  ];
  const Feather = createLucideIcon("feather", __iconNode$gm);

  const __iconNode$gl = [
    ["path", { d: "M4 3 2 5v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z", key: "1n2rgs" }],
    ["path", { d: "M6 8h4", key: "utf9t1" }],
    ["path", { d: "M6 18h4", key: "12yh4b" }],
    ["path", { d: "m12 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z", key: "3ha7mj" }],
    ["path", { d: "M14 8h4", key: "1r8wg2" }],
    ["path", { d: "M14 18h4", key: "1t3kbu" }],
    ["path", { d: "m20 3-2 2v15c0 .6.4 1 1 1h2c.6 0 1-.4 1-1V5Z", key: "dfd4e2" }]
  ];
  const Fence = createLucideIcon("fence", __iconNode$gl);

  const __iconNode$gk = [
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }],
    ["path", { d: "M12 2v4", key: "3427ic" }],
    ["path", { d: "m6.8 15-3.5 2", key: "hjy98k" }],
    ["path", { d: "m20.7 7-3.5 2", key: "f08gto" }],
    ["path", { d: "M6.8 9 3.3 7", key: "1aevh4" }],
    ["path", { d: "m20.7 17-3.5-2", key: "1liqo3" }],
    ["path", { d: "m9 22 3-8 3 8", key: "wees03" }],
    ["path", { d: "M8 22h8", key: "rmew8v" }],
    ["path", { d: "M18 18.7a9 9 0 1 0-12 0", key: "dhzg4g" }]
  ];
  const FerrisWheel = createLucideIcon("ferris-wheel", __iconNode$gk);

  const __iconNode$gj = [
    ["path", { d: "M10 12v-1", key: "v7bkov" }],
    ["path", { d: "M10 18v-2", key: "1cjy8d" }],
    ["path", { d: "M10 7V6", key: "dljcrl" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      { d: "M15.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v16a2 2 0 0 0 .274 1.01", key: "gkbcor" }
    ],
    ["circle", { cx: "10", cy: "20", r: "2", key: "1xzdoj" }]
  ];
  const FileArchive = createLucideIcon("file-archive", __iconNode$gj);

  const __iconNode$gi = [
    ["path", { d: "M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z", key: "1340ok" }],
    ["path", { d: "M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z", key: "1hz3m3" }],
    ["path", { d: "M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z", key: "1oz8n2" }],
    ["path", { d: "M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z", key: "1ff65i" }],
    ["path", { d: "M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z", key: "pdip6e" }]
  ];
  const Figma = createLucideIcon("figma", __iconNode$gi);

  const __iconNode$gh = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v2", key: "17k7jt" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["circle", { cx: "3", cy: "17", r: "1", key: "vo6nti" }],
    ["path", { d: "M2 17v-3a4 4 0 0 1 8 0v3", key: "1ggdre" }],
    ["circle", { cx: "9", cy: "17", r: "1", key: "bc1fq4" }]
  ];
  const FileAudio2 = createLucideIcon("file-audio-2", __iconNode$gh);

  const __iconNode$gg = [
    ["path", { d: "M17.5 22h.5a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3", key: "rslqgf" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      {
        d: "M2 19a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0v-4a6 6 0 0 1 12 0v4a2 2 0 1 1-4 0v-1a2 2 0 1 1 4 0",
        key: "9f7x3i"
      }
    ]
  ];
  const FileAudio = createLucideIcon("file-audio", __iconNode$gg);

  const __iconNode$gf = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "m8 18 4-4", key: "12zab0" }],
    ["path", { d: "M8 10v8h8", key: "tlaukw" }]
  ];
  const FileAxis3d = createLucideIcon("file-axis-3d", __iconNode$gf);

  const __iconNode$ge = [
    [
      "path",
      {
        d: "m13.69 12.479 1.29 4.88a.5.5 0 0 1-.697.591l-1.844-.849a1 1 0 0 0-.88.001l-1.846.85a.5.5 0 0 1-.693-.593l1.29-4.88",
        key: "7a4gmr"
      }
    ],
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z", key: "1mlx9k" }],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }]
  ];
  const FileBadge2 = createLucideIcon("file-badge-2", __iconNode$ge);

  const __iconNode$gd = [
    ["path", { d: "M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3.072", key: "n6s66f" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      {
        d: "m6.69 16.479 1.29 4.88a.5.5 0 0 1-.698.591l-1.843-.849a1 1 0 0 0-.88.001l-1.846.85a.5.5 0 0 1-.693-.593l1.29-4.88",
        key: "1e6yvx"
      }
    ],
    ["circle", { cx: "5", cy: "14", r: "3", key: "ufru5t" }]
  ];
  const FileBadge = createLucideIcon("file-badge", __iconNode$gd);

  const __iconNode$gc = [
    ["path", { d: "M14.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "16lz6z" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      {
        d: "M3 13.1a2 2 0 0 0-1 1.76v3.24a2 2 0 0 0 .97 1.78L6 21.7a2 2 0 0 0 2.03.01L11 19.9a2 2 0 0 0 1-1.76V14.9a2 2 0 0 0-.97-1.78L8 11.3a2 2 0 0 0-2.03-.01Z",
        key: "99pj1s"
      }
    ],
    ["path", { d: "M7 17v5", key: "1yj1jh" }],
    ["path", { d: "M11.7 14.2 7 17l-4.7-2.8", key: "1yk8tc" }]
  ];
  const FileBox = createLucideIcon("file-box", __iconNode$gc);

  const __iconNode$gb = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M8 18v-2", key: "qcmpov" }],
    ["path", { d: "M12 18v-4", key: "q1q25u" }],
    ["path", { d: "M16 18v-6", key: "15y0np" }]
  ];
  const FileChartColumnIncreasing = createLucideIcon("file-chart-column-increasing", __iconNode$gb);

  const __iconNode$ga = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M8 18v-1", key: "zg0ygc" }],
    ["path", { d: "M12 18v-6", key: "17g6i2" }],
    ["path", { d: "M16 18v-3", key: "j5jt4h" }]
  ];
  const FileChartColumn = createLucideIcon("file-chart-column", __iconNode$ga);

  const __iconNode$g9 = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "m16 13-3.5 3.5-2-2L8 17", key: "zz7yod" }]
  ];
  const FileChartLine = createLucideIcon("file-chart-line", __iconNode$g9);

  const __iconNode$g8 = [
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M16 22h2a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3.5", key: "13ddob" }],
    ["path", { d: "M4.017 11.512a6 6 0 1 0 8.466 8.475", key: "s6vs5t" }],
    [
      "path",
      {
        d: "M9 16a1 1 0 0 1-1-1v-4c0-.552.45-1.008.995-.917a6 6 0 0 1 4.922 4.922c.091.544-.365.995-.917.995z",
        key: "1dl6s6"
      }
    ]
  ];
  const FileChartPie = createLucideIcon("file-chart-pie", __iconNode$g8);

  const __iconNode$g7 = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "1pf5j1" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "m3 15 2 2 4-4", key: "1lhrkk" }]
  ];
  const FileCheck2 = createLucideIcon("file-check-2", __iconNode$g7);

  const __iconNode$g6 = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "m9 15 2 2 4-4", key: "1grp1n" }]
  ];
  const FileCheck = createLucideIcon("file-check", __iconNode$g6);

  const __iconNode$g5 = [
    ["path", { d: "M16 22h2a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3", key: "37hlfg" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["circle", { cx: "8", cy: "16", r: "6", key: "10v15b" }],
    ["path", { d: "M9.5 17.5 8 16.25V14", key: "1o80t2" }]
  ];
  const FileClock = createLucideIcon("file-clock", __iconNode$g5);

  const __iconNode$g4 = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "1pf5j1" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "m5 12-3 3 3 3", key: "oke12k" }],
    ["path", { d: "m9 18 3-3-3-3", key: "112psh" }]
  ];
  const FileCode2 = createLucideIcon("file-code-2", __iconNode$g4);

  const __iconNode$g3 = [
    ["path", { d: "M10 12.5 8 15l2 2.5", key: "1tg20x" }],
    ["path", { d: "m14 12.5 2 2.5-2 2.5", key: "yinavb" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z", key: "1mlx9k" }]
  ];
  const FileCode = createLucideIcon("file-code", __iconNode$g3);

  const __iconNode$g2 = [
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "m2.305 15.53.923-.382", key: "yfp9st" }],
    ["path", { d: "m3.228 12.852-.924-.383", key: "bckynb" }],
    [
      "path",
      {
        d: "M4.677 21.5a2 2 0 0 0 1.313.5H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v2.5",
        key: "1yo3oz"
      }
    ],
    ["path", { d: "m4.852 11.228-.383-.923", key: "1j88i9" }],
    ["path", { d: "m4.852 16.772-.383.924", key: "sag1dv" }],
    ["path", { d: "m7.148 11.228.383-.923", key: "rj39hk" }],
    ["path", { d: "m7.53 17.696-.382-.924", key: "1uu5cs" }],
    ["path", { d: "m8.772 12.852.923-.383", key: "13811l" }],
    ["path", { d: "m8.772 15.148.923.383", key: "z1a5l0" }],
    ["circle", { cx: "6", cy: "14", r: "3", key: "a1xfv6" }]
  ];
  const FileCog = createLucideIcon("file-cog", __iconNode$g2);

  const __iconNode$g1 = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M9 10h6", key: "9gxzsh" }],
    ["path", { d: "M12 13V7", key: "h0r20n" }],
    ["path", { d: "M9 17h6", key: "r8uit2" }]
  ];
  const FileDiff = createLucideIcon("file-diff", __iconNode$g1);

  const __iconNode$g0 = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "1pf5j1" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["rect", { width: "4", height: "6", x: "2", y: "12", rx: "2", key: "jm304g" }],
    ["path", { d: "M10 12h2v6", key: "12zw74" }],
    ["path", { d: "M10 18h4", key: "1ulq68" }]
  ];
  const FileDigit = createLucideIcon("file-digit", __iconNode$g0);

  const __iconNode$f$ = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M12 18v-6", key: "17g6i2" }],
    ["path", { d: "m9 15 3 3 3-3", key: "1npd3o" }]
  ];
  const FileDown = createLucideIcon("file-down", __iconNode$f$);

  const __iconNode$f_ = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v2", key: "17k7jt" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      {
        d: "M10.29 10.7a2.43 2.43 0 0 0-2.66-.52c-.29.12-.56.3-.78.53l-.35.34-.35-.34a2.43 2.43 0 0 0-2.65-.53c-.3.12-.56.3-.79.53-.95.94-1 2.53.2 3.74L6.5 18l3.6-3.55c1.2-1.21 1.14-2.8.19-3.74Z",
        key: "1c1fso"
      }
    ]
  ];
  const FileHeart = createLucideIcon("file-heart", __iconNode$f_);

  const __iconNode$fZ = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["circle", { cx: "10", cy: "12", r: "2", key: "737tya" }],
    ["path", { d: "m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22", key: "wt3hpn" }]
  ];
  const FileImage = createLucideIcon("file-image", __iconNode$fZ);

  const __iconNode$fY = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "1pf5j1" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M2 15h10", key: "jfw4w8" }],
    ["path", { d: "m9 18 3-3-3-3", key: "112psh" }]
  ];
  const FileInput = createLucideIcon("file-input", __iconNode$fY);

  const __iconNode$fX = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      { d: "M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1", key: "1oajmo" }
    ],
    [
      "path",
      { d: "M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1", key: "mpwhp6" }
    ]
  ];
  const FileJson = createLucideIcon("file-json", __iconNode$fX);

  const __iconNode$fW = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "1pf5j1" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      { d: "M4 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1", key: "fq0c9t" }
    ],
    [
      "path",
      { d: "M8 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1", key: "4gibmv" }
    ]
  ];
  const FileJson2 = createLucideIcon("file-json-2", __iconNode$fW);

  const __iconNode$fV = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v6", key: "rc0qvx" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["circle", { cx: "4", cy: "16", r: "2", key: "1ehqvc" }],
    ["path", { d: "m10 10-4.5 4.5", key: "7fwrp6" }],
    ["path", { d: "m9 11 1 1", key: "wa6s5q" }]
  ];
  const FileKey2 = createLucideIcon("file-key-2", __iconNode$fV);

  const __iconNode$fU = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["circle", { cx: "10", cy: "16", r: "2", key: "4ckbqe" }],
    ["path", { d: "m16 10-4.5 4.5", key: "7p3ebg" }],
    ["path", { d: "m15 11 1 1", key: "1bsyx3" }]
  ];
  const FileKey = createLucideIcon("file-key", __iconNode$fU);

  const __iconNode$fT = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v1", key: "jmtmu2" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["rect", { width: "8", height: "5", x: "2", y: "13", rx: "1", key: "10y5wo" }],
    ["path", { d: "M8 13v-2a2 2 0 1 0-4 0v2", key: "1pdxzg" }]
  ];
  const FileLock2 = createLucideIcon("file-lock-2", __iconNode$fT);

  const __iconNode$fS = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["rect", { width: "8", height: "6", x: "8", y: "12", rx: "1", key: "3yr8at" }],
    ["path", { d: "M10 12v-2a2 2 0 1 1 4 0v2", key: "j4i8d" }]
  ];
  const FileLock = createLucideIcon("file-lock", __iconNode$fS);

  const __iconNode$fR = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "1pf5j1" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M3 15h6", key: "4e2qda" }]
  ];
  const FileMinus2 = createLucideIcon("file-minus-2", __iconNode$fR);

  const __iconNode$fQ = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M9 15h6", key: "cctwl0" }]
  ];
  const FileMinus = createLucideIcon("file-minus", __iconNode$fQ);

  const __iconNode$fP = [
    ["path", { d: "M10.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v8.4", key: "1d3kfm" }],
    ["path", { d: "M8 18v-7.7L16 9v7", key: "1oie6o" }],
    ["circle", { cx: "14", cy: "16", r: "2", key: "1bzzi3" }],
    ["circle", { cx: "6", cy: "18", r: "2", key: "1fncim" }]
  ];
  const FileMusic = createLucideIcon("file-music", __iconNode$fP);

  const __iconNode$fO = [
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M4 7V4a2 2 0 0 1 2-2 2 2 0 0 0-2 2", key: "1vk7w2" }],
    ["path", { d: "M4.063 20.999a2 2 0 0 0 2 1L18 22a2 2 0 0 0 2-2V7l-5-5H6", key: "1jink5" }],
    ["path", { d: "m5 11-3 3", key: "1dgrs4" }],
    ["path", { d: "m5 17-3-3h10", key: "1mvvaf" }]
  ];
  const FileOutput = createLucideIcon("file-output", __iconNode$fO);

  const __iconNode$fN = [
    [
      "path",
      {
        d: "m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2",
        key: "142zxg"
      }
    ],
    [
      "path",
      {
        d: "M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
        key: "2t3380"
      }
    ],
    ["path", { d: "M8 18h1", key: "13wk12" }]
  ];
  const FilePenLine = createLucideIcon("file-pen-line", __iconNode$fN);

  const __iconNode$fM = [
    ["path", { d: "M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5", key: "1couwa" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      {
        d: "M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
        key: "1y4qbx"
      }
    ]
  ];
  const FilePen = createLucideIcon("file-pen", __iconNode$fM);

  const __iconNode$fL = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "1pf5j1" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M3 15h6", key: "4e2qda" }],
    ["path", { d: "M6 12v6", key: "1u72j0" }]
  ];
  const FilePlus2 = createLucideIcon("file-plus-2", __iconNode$fL);

  const __iconNode$fK = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M9 15h6", key: "cctwl0" }],
    ["path", { d: "M12 18v-6", key: "17g6i2" }]
  ];
  const FilePlus = createLucideIcon("file-plus", __iconNode$fK);

  const __iconNode$fJ = [
    ["path", { d: "M12 17h.01", key: "p32p05" }],
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z", key: "1mlx9k" }],
    ["path", { d: "M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3", key: "mhlwft" }]
  ];
  const FileQuestionMark = createLucideIcon("file-question-mark", __iconNode$fJ);

  const __iconNode$fI = [
    ["path", { d: "M20 10V7l-5-5H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h4", key: "1rdf37" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M16 14a2 2 0 0 0-2 2", key: "ceaadl" }],
    ["path", { d: "M20 14a2 2 0 0 1 2 2", key: "1ny6zw" }],
    ["path", { d: "M20 22a2 2 0 0 0 2-2", key: "1l9q4k" }],
    ["path", { d: "M16 22a2 2 0 0 1-2-2", key: "1wqh5n" }]
  ];
  const FileScan = createLucideIcon("file-scan", __iconNode$fI);

  const __iconNode$fH = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["circle", { cx: "11.5", cy: "14.5", r: "2.5", key: "1bq0ko" }],
    ["path", { d: "M13.3 16.3 15 18", key: "2quom7" }]
  ];
  const FileSearch2 = createLucideIcon("file-search-2", __iconNode$fH);

  const __iconNode$fG = [
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      { d: "M4.268 21a2 2 0 0 0 1.727 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3", key: "ms7g94" }
    ],
    ["path", { d: "m9 18-1.5-1.5", key: "1j6qii" }],
    ["circle", { cx: "5", cy: "14", r: "3", key: "ufru5t" }]
  ];
  const FileSearch = createLucideIcon("file-search", __iconNode$fG);

  const __iconNode$fF = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
    ["path", { d: "M10 11v2", key: "1s651w" }],
    ["path", { d: "M8 17h8", key: "wh5c61" }],
    ["path", { d: "M14 16v2", key: "12fp5e" }]
  ];
  const FileSliders = createLucideIcon("file-sliders", __iconNode$fF);

  const __iconNode$fE = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M8 13h2", key: "yr2amv" }],
    ["path", { d: "M14 13h2", key: "un5t4a" }],
    ["path", { d: "M8 17h2", key: "2yhykz" }],
    ["path", { d: "M14 17h2", key: "10kma7" }]
  ];
  const FileSpreadsheet = createLucideIcon("file-spreadsheet", __iconNode$fE);

  const __iconNode$fD = [
    ["path", { d: "M21 7h-3a2 2 0 0 1-2-2V2", key: "9rb54x" }],
    [
      "path",
      {
        d: "M21 6v6.5c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5v-9c0-.8.7-1.5 1.5-1.5H17Z",
        key: "1059l0"
      }
    ],
    ["path", { d: "M7 8v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H15", key: "16874u" }],
    ["path", { d: "M3 12v8.8c0 .3.2.6.4.8.2.2.5.4.8.4H11", key: "k2ox98" }]
  ];
  const FileStack = createLucideIcon("file-stack", __iconNode$fD);

  const __iconNode$fC = [
    ["path", { d: "m10 18 3-3-3-3", key: "18f6ys" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      {
        d: "M4 11V4a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7",
        key: "50q2rw"
      }
    ]
  ];
  const FileSymlink = createLucideIcon("file-symlink", __iconNode$fC);

  const __iconNode$fB = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "m8 16 2-2-2-2", key: "10vzyd" }],
    ["path", { d: "M12 18h4", key: "1wd2n7" }]
  ];
  const FileTerminal = createLucideIcon("file-terminal", __iconNode$fB);

  const __iconNode$fA = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M10 9H8", key: "b1mrlr" }],
    ["path", { d: "M16 13H8", key: "t4e002" }],
    ["path", { d: "M16 17H8", key: "z1uh3a" }]
  ];
  const FileText = createLucideIcon("file-text", __iconNode$fA);

  const __iconNode$fz = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "1pf5j1" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M2 13v-1h6v1", key: "1dh9dg" }],
    ["path", { d: "M5 12v6", key: "150t9c" }],
    ["path", { d: "M4 18h2", key: "1xrofg" }]
  ];
  const FileType2 = createLucideIcon("file-type-2", __iconNode$fz);

  const __iconNode$fy = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M9 13v-1h6v1", key: "1bb014" }],
    ["path", { d: "M12 12v6", key: "3ahymv" }],
    ["path", { d: "M11 18h2", key: "12mj7e" }]
  ];
  const FileType = createLucideIcon("file-type", __iconNode$fy);

  const __iconNode$fx = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M12 12v6", key: "3ahymv" }],
    ["path", { d: "m15 15-3-3-3 3", key: "15xj92" }]
  ];
  const FileUp = createLucideIcon("file-up", __iconNode$fx);

  const __iconNode$fw = [
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M15 18a3 3 0 1 0-6 0", key: "16awa0" }],
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z", key: "1mlx9k" }],
    ["circle", { cx: "12", cy: "13", r: "2", key: "1c1ljs" }]
  ];
  const FileUser = createLucideIcon("file-user", __iconNode$fw);

  const __iconNode$fv = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "1pf5j1" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["rect", { width: "8", height: "6", x: "2", y: "12", rx: "1", key: "1a6c1e" }],
    ["path", { d: "m10 15.5 4 2.5v-6l-4 2.5", key: "t7cp39" }]
  ];
  const FileVideo2 = createLucideIcon("file-video-2", __iconNode$fv);

  const __iconNode$fu = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "m10 11 5 3-5 3v-6Z", key: "7ntvm4" }]
  ];
  const FileVideo = createLucideIcon("file-video", __iconNode$fu);

  const __iconNode$ft = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M8 15h.01", key: "a7atzg" }],
    ["path", { d: "M11.5 13.5a2.5 2.5 0 0 1 0 3", key: "1fccat" }],
    ["path", { d: "M15 12a5 5 0 0 1 0 6", key: "ps46cm" }]
  ];
  const FileVolume2 = createLucideIcon("file-volume-2", __iconNode$ft);

  const __iconNode$fs = [
    ["path", { d: "M11 11a5 5 0 0 1 0 6", key: "193qb2" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    [
      "path",
      { d: "M4 6.765V4a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-.93-.23", key: "ifyjnl" }
    ],
    [
      "path",
      {
        d: "M7 10.51a.5.5 0 0 0-.826-.38l-1.893 1.628A1 1 0 0 1 3.63 12H2.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h1.129a1 1 0 0 1 .652.242l1.893 1.63a.5.5 0 0 0 .826-.38z",
        key: "mk8rxu"
      }
    ]
  ];
  const FileVolume = createLucideIcon("file-volume", __iconNode$fs);

  const __iconNode$fr = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M12 9v4", key: "juzpu7" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ];
  const FileWarning = createLucideIcon("file-warning", __iconNode$fr);

  const __iconNode$fq = [
    ["path", { d: "M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4", key: "1pf5j1" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "m8 12.5-5 5", key: "b853mi" }],
    ["path", { d: "m3 12.5 5 5", key: "1qls4r" }]
  ];
  const FileX2 = createLucideIcon("file-x-2", __iconNode$fq);

  const __iconNode$fp = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "m14.5 12.5-5 5", key: "b62r18" }],
    ["path", { d: "m9.5 12.5 5 5", key: "1rk7el" }]
  ];
  const FileX = createLucideIcon("file-x", __iconNode$fp);

  const __iconNode$fo = [
    ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }]
  ];
  const File = createLucideIcon("file", __iconNode$fo);

  const __iconNode$fn = [
    ["path", { d: "M20 7h-3a2 2 0 0 1-2-2V2", key: "x099mo" }],
    ["path", { d: "M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z", key: "18t6ie" }],
    ["path", { d: "M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8", key: "1nja0z" }]
  ];
  const Files = createLucideIcon("files", __iconNode$fn);

  const __iconNode$fm = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M7 3v18", key: "bbkbws" }],
    ["path", { d: "M3 7.5h4", key: "zfgn84" }],
    ["path", { d: "M3 12h18", key: "1i2n21" }],
    ["path", { d: "M3 16.5h4", key: "1230mu" }],
    ["path", { d: "M17 3v18", key: "in4fa5" }],
    ["path", { d: "M17 7.5h4", key: "myr1c1" }],
    ["path", { d: "M17 16.5h4", key: "go4c1d" }]
  ];
  const Film = createLucideIcon("film", __iconNode$fm);

  const __iconNode$fl = [
    ["path", { d: "M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4", key: "1nerag" }],
    ["path", { d: "M14 13.12c0 2.38 0 6.38-1 8.88", key: "o46ks0" }],
    ["path", { d: "M17.29 21.02c.12-.6.43-2.3.5-3.02", key: "ptglia" }],
    ["path", { d: "M2 12a10 10 0 0 1 18-6", key: "ydlgp0" }],
    ["path", { d: "M2 16h.01", key: "1gqxmh" }],
    ["path", { d: "M21.8 16c.2-2 .131-5.354 0-6", key: "drycrb" }],
    ["path", { d: "M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2", key: "1tidbn" }],
    ["path", { d: "M8.65 22c.21-.66.45-1.32.57-2", key: "13wd9y" }],
    ["path", { d: "M9 6.8a6 6 0 0 1 9 5.2v2", key: "1fr1j5" }]
  ];
  const Fingerprint = createLucideIcon("fingerprint", __iconNode$fl);

  const __iconNode$fk = [
    ["path", { d: "M15 6.5V3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3.5", key: "sqyvz" }],
    ["path", { d: "M9 18h8", key: "i7pszb" }],
    ["path", { d: "M18 3h-3", key: "7idoqj" }],
    ["path", { d: "M11 3a6 6 0 0 0-6 6v11", key: "1v5je3" }],
    ["path", { d: "M5 13h4", key: "svpcxo" }],
    ["path", { d: "M17 10a4 4 0 0 0-8 0v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2Z", key: "vsjego" }]
  ];
  const FireExtinguisher = createLucideIcon("fire-extinguisher", __iconNode$fk);

  const __iconNode$fj = [
    [
      "path",
      {
        d: "M18 12.47v.03m0-.5v.47m-.475 5.056A6.744 6.744 0 0 1 15 18c-3.56 0-7.56-2.53-8.5-6 .348-1.28 1.114-2.433 2.121-3.38m3.444-2.088A8.802 8.802 0 0 1 15 6c3.56 0 6.06 2.54 7 6-.309 1.14-.786 2.177-1.413 3.058",
        key: "1j1hse"
      }
    ],
    [
      "path",
      {
        d: "M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33m7.48-4.372A9.77 9.77 0 0 1 16 6.07m0 11.86a9.77 9.77 0 0 1-1.728-3.618",
        key: "1q46z8"
      }
    ],
    [
      "path",
      {
        d: "m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98M8.53 3h5.27a2 2 0 0 1 1.98 1.67l.23 1.4M2 2l20 20",
        key: "1407gh"
      }
    ]
  ];
  const FishOff = createLucideIcon("fish-off", __iconNode$fj);

  const __iconNode$fi = [
    ["path", { d: "M2 16s9-15 20-4C11 23 2 8 2 8", key: "h4oh4o" }]
  ];
  const FishSymbol = createLucideIcon("fish-symbol", __iconNode$fi);

  const __iconNode$fh = [
    [
      "path",
      {
        d: "M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z",
        key: "15baut"
      }
    ],
    ["path", { d: "M18 12v.5", key: "18hhni" }],
    ["path", { d: "M16 17.93a9.77 9.77 0 0 1 0-11.86", key: "16dt7o" }],
    [
      "path",
      {
        d: "M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33",
        key: "l9di03"
      }
    ],
    [
      "path",
      { d: "M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4", key: "1kjonw" }
    ],
    [
      "path",
      { d: "m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98", key: "1zlm23" }
    ]
  ];
  const Fish = createLucideIcon("fish", __iconNode$fh);

  const __iconNode$fg = [
    ["path", { d: "M8 2c3 0 5 2 8 2s4-1 4-1v11", key: "9rwyz9" }],
    ["path", { d: "M4 22V4", key: "1plyxx" }],
    ["path", { d: "M4 15s1-1 4-1 5 2 8 2", key: "1myooe" }],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const FlagOff = createLucideIcon("flag-off", __iconNode$fg);

  const __iconNode$ff = [["path", { d: "M17 22V2L7 7l10 5", key: "1rmf0r" }]];
  const FlagTriangleLeft = createLucideIcon("flag-triangle-left", __iconNode$ff);

  const __iconNode$fe = [["path", { d: "M7 22V2l10 5-10 5", key: "17n18y" }]];
  const FlagTriangleRight = createLucideIcon("flag-triangle-right", __iconNode$fe);

  const __iconNode$fd = [
    [
      "path",
      {
        d: "M12 2c1 3 2.5 3.5 3.5 4.5A5 5 0 0 1 17 10a5 5 0 1 1-10 0c0-.3 0-.6.1-.9a2 2 0 1 0 3.3-2C8 4.5 11 2 12 2Z",
        key: "1ir223"
      }
    ],
    ["path", { d: "m5 22 14-4", key: "1brv4h" }],
    ["path", { d: "m5 18 14 4", key: "lgyyje" }]
  ];
  const FlameKindling = createLucideIcon("flame-kindling", __iconNode$fd);

  const __iconNode$fc = [
    ["path", { d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z", key: "i9b6wo" }],
    ["line", { x1: "4", x2: "4", y1: "22", y2: "15", key: "1cm3nv" }]
  ];
  const Flag = createLucideIcon("flag", __iconNode$fc);

  const __iconNode$fb = [
    [
      "path",
      {
        d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z",
        key: "96xj49"
      }
    ]
  ];
  const Flame = createLucideIcon("flame", __iconNode$fb);

  const __iconNode$fa = [
    ["path", { d: "M16 16v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4", key: "1r120k" }],
    ["path", { d: "M7 2h11v4c0 2-2 2-2 4v1", key: "dz1920" }],
    ["line", { x1: "11", x2: "18", y1: "6", y2: "6", key: "bi1vpe" }],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const FlashlightOff = createLucideIcon("flashlight-off", __iconNode$fa);

  const __iconNode$f9 = [
    [
      "path",
      {
        d: "M18 6c0 2-2 2-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10c0-2-2-2-2-4V2h12z",
        key: "1orkel"
      }
    ],
    ["line", { x1: "6", x2: "18", y1: "6", y2: "6", key: "1z11jq" }],
    ["line", { x1: "12", x2: "12", y1: "12", y2: "12", key: "1f4yc1" }]
  ];
  const Flashlight = createLucideIcon("flashlight", __iconNode$f9);

  const __iconNode$f8 = [
    ["path", { d: "M10 2v2.343", key: "15t272" }],
    ["path", { d: "M14 2v6.343", key: "sxr80q" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M20 20a2 2 0 0 1-2 2H6a2 2 0 0 1-1.755-2.96l5.227-9.563", key: "k0duyd" }],
    ["path", { d: "M6.453 15H15", key: "1f0z33" }],
    ["path", { d: "M8.5 2h7", key: "csnxdl" }]
  ];
  const FlaskConicalOff = createLucideIcon("flask-conical-off", __iconNode$f8);

  const __iconNode$f7 = [
    [
      "path",
      {
        d: "M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2",
        key: "18mbvz"
      }
    ],
    ["path", { d: "M6.453 15h11.094", key: "3shlmq" }],
    ["path", { d: "M8.5 2h7", key: "csnxdl" }]
  ];
  const FlaskConical = createLucideIcon("flask-conical", __iconNode$f7);

  const __iconNode$f6 = [
    ["path", { d: "M10 2v6.292a7 7 0 1 0 4 0V2", key: "1s42pc" }],
    ["path", { d: "M5 15h14", key: "m0yey3" }],
    ["path", { d: "M8.5 2h7", key: "csnxdl" }]
  ];
  const FlaskRound = createLucideIcon("flask-round", __iconNode$f6);

  const __iconNode$f5 = [
    ["path", { d: "m3 7 5 5-5 5V7", key: "couhi7" }],
    ["path", { d: "m21 7-5 5 5 5V7", key: "6ouia7" }],
    ["path", { d: "M12 20v2", key: "1lh1kg" }],
    ["path", { d: "M12 14v2", key: "8jcxud" }],
    ["path", { d: "M12 8v2", key: "1woqiv" }],
    ["path", { d: "M12 2v2", key: "tus03m" }]
  ];
  const FlipHorizontal2 = createLucideIcon("flip-horizontal-2", __iconNode$f5);

  const __iconNode$f4 = [
    ["path", { d: "M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3", key: "1i73f7" }],
    ["path", { d: "M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3", key: "saxlbk" }],
    ["path", { d: "M12 20v2", key: "1lh1kg" }],
    ["path", { d: "M12 14v2", key: "8jcxud" }],
    ["path", { d: "M12 8v2", key: "1woqiv" }],
    ["path", { d: "M12 2v2", key: "tus03m" }]
  ];
  const FlipHorizontal = createLucideIcon("flip-horizontal", __iconNode$f4);

  const __iconNode$f3 = [
    ["path", { d: "m17 3-5 5-5-5h10", key: "1ftt6x" }],
    ["path", { d: "m17 21-5-5-5 5h10", key: "1m0wmu" }],
    ["path", { d: "M4 12H2", key: "rhcxmi" }],
    ["path", { d: "M10 12H8", key: "s88cx1" }],
    ["path", { d: "M16 12h-2", key: "10asgb" }],
    ["path", { d: "M22 12h-2", key: "14jgyd" }]
  ];
  const FlipVertical2 = createLucideIcon("flip-vertical-2", __iconNode$f3);

  const __iconNode$f2 = [
    ["path", { d: "M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3", key: "14bfxa" }],
    ["path", { d: "M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3", key: "14rx03" }],
    ["path", { d: "M4 12H2", key: "rhcxmi" }],
    ["path", { d: "M10 12H8", key: "s88cx1" }],
    ["path", { d: "M16 12h-2", key: "10asgb" }],
    ["path", { d: "M22 12h-2", key: "14jgyd" }]
  ];
  const FlipVertical = createLucideIcon("flip-vertical", __iconNode$f2);

  const __iconNode$f1 = [
    [
      "path",
      {
        d: "M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1",
        key: "3pnvol"
      }
    ],
    ["circle", { cx: "12", cy: "8", r: "2", key: "1822b1" }],
    ["path", { d: "M12 10v12", key: "6ubwww" }],
    ["path", { d: "M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z", key: "9hd38g" }],
    ["path", { d: "M12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z", key: "ufn41s" }]
  ];
  const Flower2 = createLucideIcon("flower-2", __iconNode$f1);

  const __iconNode$f0 = [
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
    [
      "path",
      {
        d: "M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5",
        key: "14wa3c"
      }
    ],
    ["path", { d: "M12 7.5V9", key: "1oy5b0" }],
    ["path", { d: "M7.5 12H9", key: "eltsq1" }],
    ["path", { d: "M16.5 12H15", key: "vk5kw4" }],
    ["path", { d: "M12 16.5V15", key: "k7eayi" }],
    ["path", { d: "m8 8 1.88 1.88", key: "nxy4qf" }],
    ["path", { d: "M14.12 9.88 16 8", key: "1lst6k" }],
    ["path", { d: "m8 16 1.88-1.88", key: "h2eex1" }],
    ["path", { d: "M14.12 14.12 16 16", key: "uqkrx3" }]
  ];
  const Flower = createLucideIcon("flower", __iconNode$f0);

  const __iconNode$e$ = [
    ["path", { d: "M2 12h6", key: "1wqiqv" }],
    ["path", { d: "M22 12h-6", key: "1eg9hc" }],
    ["path", { d: "M12 2v2", key: "tus03m" }],
    ["path", { d: "M12 8v2", key: "1woqiv" }],
    ["path", { d: "M12 14v2", key: "8jcxud" }],
    ["path", { d: "M12 20v2", key: "1lh1kg" }],
    ["path", { d: "m19 9-3 3 3 3", key: "12ol22" }],
    ["path", { d: "m5 15 3-3-3-3", key: "1kdhjc" }]
  ];
  const FoldHorizontal = createLucideIcon("fold-horizontal", __iconNode$e$);

  const __iconNode$e_ = [
    ["path", { d: "M12 22v-6", key: "6o8u61" }],
    ["path", { d: "M12 8V2", key: "1wkif3" }],
    ["path", { d: "M4 12H2", key: "rhcxmi" }],
    ["path", { d: "M10 12H8", key: "s88cx1" }],
    ["path", { d: "M16 12h-2", key: "10asgb" }],
    ["path", { d: "M22 12h-2", key: "14jgyd" }],
    ["path", { d: "m15 19-3-3-3 3", key: "e37ymu" }],
    ["path", { d: "m15 5-3 3-3-3", key: "19d6lf" }]
  ];
  const FoldVertical = createLucideIcon("fold-vertical", __iconNode$e_);

  const __iconNode$eZ = [
    ["circle", { cx: "15", cy: "19", r: "2", key: "u2pros" }],
    [
      "path",
      {
        d: "M20.9 19.8A2 2 0 0 0 22 18V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h5.1",
        key: "1jj40k"
      }
    ],
    ["path", { d: "M15 11v-1", key: "cntcp" }],
    ["path", { d: "M15 17v-2", key: "1279jj" }]
  ];
  const FolderArchive = createLucideIcon("folder-archive", __iconNode$eZ);

  const __iconNode$eY = [
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }]
  ];
  const Focus = createLucideIcon("focus", __iconNode$eY);

  const __iconNode$eX = [
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ],
    ["path", { d: "m9 13 2 2 4-4", key: "6343dt" }]
  ];
  const FolderCheck = createLucideIcon("folder-check", __iconNode$eX);

  const __iconNode$eW = [
    ["circle", { cx: "16", cy: "16", r: "6", key: "qoo3c4" }],
    [
      "path",
      {
        d: "M7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2",
        key: "1urifu"
      }
    ],
    ["path", { d: "M16 14v2l1 1", key: "xth2jh" }]
  ];
  const FolderClock = createLucideIcon("folder-clock", __iconNode$eW);

  const __iconNode$eV = [
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ],
    ["path", { d: "M2 10h20", key: "1ir3d8" }]
  ];
  const FolderClosed = createLucideIcon("folder-closed", __iconNode$eV);

  const __iconNode$eU = [
    ["path", { d: "M10 10.5 8 13l2 2.5", key: "m4t9c1" }],
    ["path", { d: "m14 10.5 2 2.5-2 2.5", key: "14w2eb" }],
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z",
        key: "1u1bxd"
      }
    ]
  ];
  const FolderCode = createLucideIcon("folder-code", __iconNode$eU);

  const __iconNode$eT = [
    [
      "path",
      {
        d: "M10.3 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.98a2 2 0 0 1 1.69.9l.66 1.2A2 2 0 0 0 12 6h8a2 2 0 0 1 2 2v3.3",
        key: "128dxu"
      }
    ],
    ["path", { d: "m14.305 19.53.923-.382", key: "3m78fa" }],
    ["path", { d: "m15.228 16.852-.923-.383", key: "npixar" }],
    ["path", { d: "m16.852 15.228-.383-.923", key: "5xggr7" }],
    ["path", { d: "m16.852 20.772-.383.924", key: "dpfhf9" }],
    ["path", { d: "m19.148 15.228.383-.923", key: "1reyyz" }],
    ["path", { d: "m19.53 21.696-.382-.924", key: "1goivc" }],
    ["path", { d: "m20.772 16.852.924-.383", key: "htqkph" }],
    ["path", { d: "m20.772 19.148.924.383", key: "9w9pjp" }],
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }]
  ];
  const FolderCog = createLucideIcon("folder-cog", __iconNode$eT);

  const __iconNode$eS = [
    [
      "path",
      {
        d: "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z",
        key: "1fr9dc"
      }
    ],
    ["circle", { cx: "12", cy: "13", r: "1", key: "49l61u" }]
  ];
  const FolderDot = createLucideIcon("folder-dot", __iconNode$eS);

  const __iconNode$eR = [
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ],
    ["path", { d: "M12 10v6", key: "1bos4e" }],
    ["path", { d: "m15 13-3 3-3-3", key: "6j2sf0" }]
  ];
  const FolderDown = createLucideIcon("folder-down", __iconNode$eR);

  const __iconNode$eQ = [
    [
      "path",
      {
        d: "M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5",
        key: "1w6njk"
      }
    ],
    ["circle", { cx: "13", cy: "12", r: "2", key: "1j92g6" }],
    ["path", { d: "M18 19c-2.8 0-5-2.2-5-5v8", key: "pkpw2h" }],
    ["circle", { cx: "20", cy: "19", r: "2", key: "1obnsp" }]
  ];
  const FolderGit2 = createLucideIcon("folder-git-2", __iconNode$eQ);

  const __iconNode$eP = [
    ["circle", { cx: "12", cy: "13", r: "2", key: "1c1ljs" }],
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ],
    ["path", { d: "M14 13h3", key: "1dgedf" }],
    ["path", { d: "M7 13h3", key: "1pygq7" }]
  ];
  const FolderGit = createLucideIcon("folder-git", __iconNode$eP);

  const __iconNode$eO = [
    [
      "path",
      {
        d: "M11 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v1.5",
        key: "6hud8k"
      }
    ],
    [
      "path",
      {
        d: "M13.9 17.45c-1.2-1.2-1.14-2.8-.2-3.73a2.43 2.43 0 0 1 3.44 0l.36.34.34-.34a2.43 2.43 0 0 1 3.45-.01c.95.95 1 2.53-.2 3.74L17.5 21Z",
        key: "wpff58"
      }
    ]
  ];
  const FolderHeart = createLucideIcon("folder-heart", __iconNode$eO);

  const __iconNode$eN = [
    [
      "path",
      {
        d: "M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1",
        key: "fm4g5t"
      }
    ],
    ["path", { d: "M2 13h10", key: "pgb2dq" }],
    ["path", { d: "m9 16 3-3-3-3", key: "6m91ic" }]
  ];
  const FolderInput = createLucideIcon("folder-input", __iconNode$eN);

  const __iconNode$eM = [
    [
      "path",
      {
        d: "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z",
        key: "1fr9dc"
      }
    ],
    ["path", { d: "M8 10v4", key: "tgpxqk" }],
    ["path", { d: "M12 10v2", key: "hh53o1" }],
    ["path", { d: "M16 10v6", key: "1d6xys" }]
  ];
  const FolderKanban = createLucideIcon("folder-kanban", __iconNode$eM);

  const __iconNode$eL = [
    ["circle", { cx: "16", cy: "20", r: "2", key: "1vifvg" }],
    [
      "path",
      {
        d: "M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v2",
        key: "3hgo9p"
      }
    ],
    ["path", { d: "m22 14-4.5 4.5", key: "1ef6z8" }],
    ["path", { d: "m21 15 1 1", key: "1ejcpy" }]
  ];
  const FolderKey = createLucideIcon("folder-key", __iconNode$eL);

  const __iconNode$eK = [
    ["rect", { width: "8", height: "5", x: "14", y: "17", rx: "1", key: "19aais" }],
    [
      "path",
      {
        d: "M10 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v2.5",
        key: "1w6v7t"
      }
    ],
    ["path", { d: "M20 17v-2a2 2 0 1 0-4 0v2", key: "pwaxnr" }]
  ];
  const FolderLock = createLucideIcon("folder-lock", __iconNode$eK);

  const __iconNode$eJ = [
    ["path", { d: "M9 13h6", key: "1uhe8q" }],
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ]
  ];
  const FolderMinus = createLucideIcon("folder-minus", __iconNode$eJ);

  const __iconNode$eI = [
    [
      "path",
      {
        d: "m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2",
        key: "1nmvlm"
      }
    ],
    ["circle", { cx: "14", cy: "15", r: "1", key: "1gm4qj" }]
  ];
  const FolderOpenDot = createLucideIcon("folder-open-dot", __iconNode$eI);

  const __iconNode$eH = [
    [
      "path",
      {
        d: "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
        key: "usdka0"
      }
    ]
  ];
  const FolderOpen = createLucideIcon("folder-open", __iconNode$eH);

  const __iconNode$eG = [
    [
      "path",
      {
        d: "M2 7.5V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-1.5",
        key: "1yk7aj"
      }
    ],
    ["path", { d: "M2 13h10", key: "pgb2dq" }],
    ["path", { d: "m5 10-3 3 3 3", key: "1r8ie0" }]
  ];
  const FolderOutput = createLucideIcon("folder-output", __iconNode$eG);

  const __iconNode$eF = [
    [
      "path",
      {
        d: "M2 11.5V5a2 2 0 0 1 2-2h3.9c.7 0 1.3.3 1.7.9l.8 1.2c.4.6 1 .9 1.7.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9.5",
        key: "a8xqs0"
      }
    ],
    [
      "path",
      {
        d: "M11.378 13.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
        key: "1saktj"
      }
    ]
  ];
  const FolderPen = createLucideIcon("folder-pen", __iconNode$eF);

  const __iconNode$eE = [
    ["path", { d: "M12 10v6", key: "1bos4e" }],
    ["path", { d: "M9 13h6", key: "1uhe8q" }],
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ]
  ];
  const FolderPlus = createLucideIcon("folder-plus", __iconNode$eE);

  const __iconNode$eD = [
    [
      "path",
      {
        d: "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z",
        key: "1fr9dc"
      }
    ],
    ["circle", { cx: "12", cy: "13", r: "2", key: "1c1ljs" }],
    ["path", { d: "M12 15v5", key: "11xva1" }]
  ];
  const FolderRoot = createLucideIcon("folder-root", __iconNode$eD);

  const __iconNode$eC = [
    ["circle", { cx: "11.5", cy: "12.5", r: "2.5", key: "1ea5ju" }],
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ],
    ["path", { d: "M13.3 14.3 15 16", key: "1y4v1n" }]
  ];
  const FolderSearch2 = createLucideIcon("folder-search-2", __iconNode$eC);

  const __iconNode$eB = [
    [
      "path",
      {
        d: "M10.7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v4.1",
        key: "1bw5m7"
      }
    ],
    ["path", { d: "m21 21-1.9-1.9", key: "1g2n9r" }],
    ["circle", { cx: "17", cy: "17", r: "3", key: "18b49y" }]
  ];
  const FolderSearch = createLucideIcon("folder-search", __iconNode$eB);

  const __iconNode$eA = [
    [
      "path",
      {
        d: "M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7",
        key: "x1c07l"
      }
    ],
    ["path", { d: "m8 16 3-3-3-3", key: "rlqrt1" }]
  ];
  const FolderSymlink = createLucideIcon("folder-symlink", __iconNode$eA);

  const __iconNode$ez = [
    [
      "path",
      {
        d: "M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v.5",
        key: "1dkoa9"
      }
    ],
    ["path", { d: "M12 10v4h4", key: "1czhmt" }],
    ["path", { d: "m12 14 1.535-1.605a5 5 0 0 1 8 1.5", key: "lvuxfi" }],
    ["path", { d: "M22 22v-4h-4", key: "1ewp4q" }],
    ["path", { d: "m22 18-1.535 1.605a5 5 0 0 1-8-1.5", key: "14ync0" }]
  ];
  const FolderSync = createLucideIcon("folder-sync", __iconNode$ez);

  const __iconNode$ey = [
    [
      "path",
      {
        d: "M20 10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2.5a1 1 0 0 1-.8-.4l-.9-1.2A1 1 0 0 0 15 3h-2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z",
        key: "hod4my"
      }
    ],
    [
      "path",
      {
        d: "M20 21a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-2.9a1 1 0 0 1-.88-.55l-.42-.85a1 1 0 0 0-.92-.6H13a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1Z",
        key: "w4yl2u"
      }
    ],
    ["path", { d: "M3 5a2 2 0 0 0 2 2h3", key: "f2jnh7" }],
    ["path", { d: "M3 3v13a2 2 0 0 0 2 2h3", key: "k8epm1" }]
  ];
  const FolderTree = createLucideIcon("folder-tree", __iconNode$ey);

  const __iconNode$ex = [
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ],
    ["path", { d: "M12 10v6", key: "1bos4e" }],
    ["path", { d: "m9 13 3-3 3 3", key: "1pxg3c" }]
  ];
  const FolderUp = createLucideIcon("folder-up", __iconNode$ex);

  const __iconNode$ew = [
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ],
    ["path", { d: "m9.5 10.5 5 5", key: "ra9qjz" }],
    ["path", { d: "m14.5 10.5-5 5", key: "l2rkpq" }]
  ];
  const FolderX = createLucideIcon("folder-x", __iconNode$ew);

  const __iconNode$ev = [
    [
      "path",
      {
        d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
        key: "1kt360"
      }
    ]
  ];
  const Folder = createLucideIcon("folder", __iconNode$ev);

  const __iconNode$eu = [
    [
      "path",
      {
        d: "M20 17a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.9a2 2 0 0 1-1.69-.9l-.81-1.2a2 2 0 0 0-1.67-.9H8a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z",
        key: "4u7rpt"
      }
    ],
    ["path", { d: "M2 8v11a2 2 0 0 0 2 2h14", key: "1eicx1" }]
  ];
  const Folders = createLucideIcon("folders", __iconNode$eu);

  const __iconNode$et = [
    ["path", { d: "M12 12H5a2 2 0 0 0-2 2v5", key: "7zsz91" }],
    ["circle", { cx: "13", cy: "19", r: "2", key: "wjnkru" }],
    ["circle", { cx: "5", cy: "19", r: "2", key: "v8kfzx" }],
    ["path", { d: "M8 19h3m5-17v17h6M6 12V7c0-1.1.9-2 2-2h3l5 5", key: "13bk1p" }]
  ];
  const Forklift = createLucideIcon("forklift", __iconNode$et);

  const __iconNode$es = [
    [
      "path",
      {
        d: "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z",
        key: "1dudjm"
      }
    ],
    [
      "path",
      {
        d: "M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z",
        key: "l2t8xc"
      }
    ],
    ["path", { d: "M16 17h4", key: "1dejxt" }],
    ["path", { d: "M4 13h4", key: "1bwh8b" }]
  ];
  const Footprints = createLucideIcon("footprints", __iconNode$es);

  const __iconNode$er = [
    ["path", { d: "m15 17 5-5-5-5", key: "nf172w" }],
    ["path", { d: "M4 18v-2a4 4 0 0 1 4-4h12", key: "jmiej9" }]
  ];
  const Forward = createLucideIcon("forward", __iconNode$er);

  const __iconNode$eq = [
    ["line", { x1: "22", x2: "2", y1: "6", y2: "6", key: "15w7dq" }],
    ["line", { x1: "22", x2: "2", y1: "18", y2: "18", key: "1ip48p" }],
    ["line", { x1: "6", x2: "6", y1: "2", y2: "22", key: "a2lnyx" }],
    ["line", { x1: "18", x2: "18", y1: "2", y2: "22", key: "8vb6jd" }]
  ];
  const Frame = createLucideIcon("frame", __iconNode$eq);

  const __iconNode$ep = [
    ["path", { d: "M5 16V9h14V2H5l14 14h-7m-7 0 7 7v-7m-7 0h7", key: "1a2nng" }]
  ];
  const Framer = createLucideIcon("framer", __iconNode$ep);

  const __iconNode$eo = [
    ["line", { x1: "3", x2: "15", y1: "22", y2: "22", key: "xegly4" }],
    ["line", { x1: "4", x2: "14", y1: "9", y2: "9", key: "xcnuvu" }],
    ["path", { d: "M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18", key: "16j0yd" }],
    [
      "path",
      {
        d: "M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5",
        key: "7cu91f"
      }
    ]
  ];
  const Fuel = createLucideIcon("fuel", __iconNode$eo);

  const __iconNode$en = [
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
    ["rect", { width: "10", height: "8", x: "7", y: "8", rx: "1", key: "vys8me" }]
  ];
  const Fullscreen = createLucideIcon("fullscreen", __iconNode$en);

  const __iconNode$em = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M16 16s-1.5-2-4-2-4 2-4 2", key: "epbg0q" }],
    ["line", { x1: "9", x2: "9.01", y1: "9", y2: "9", key: "yxxnd0" }],
    ["line", { x1: "15", x2: "15.01", y1: "9", y2: "9", key: "1p4y9e" }]
  ];
  const Frown = createLucideIcon("frown", __iconNode$em);

  const __iconNode$el = [
    [
      "path",
      {
        d: "M13.354 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14v6a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341l1.218-1.348",
        key: "8mvsmf"
      }
    ],
    ["path", { d: "M16 6h6", key: "1dogtp" }],
    ["path", { d: "M19 3v6", key: "1ytpjt" }]
  ];
  const FunnelPlus = createLucideIcon("funnel-plus", __iconNode$el);

  const __iconNode$ek = [
    [
      "path",
      {
        d: "M12.531 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14v6a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341l.427-.473",
        key: "ol2ft2"
      }
    ],
    ["path", { d: "m16.5 3.5 5 5", key: "15e6fa" }],
    ["path", { d: "m21.5 3.5-5 5", key: "m0lwru" }]
  ];
  const FunnelX = createLucideIcon("funnel-x", __iconNode$ek);

  const __iconNode$ej = [
    [
      "path",
      {
        d: "M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",
        key: "sc7q7i"
      }
    ]
  ];
  const Funnel = createLucideIcon("funnel", __iconNode$ej);

  const __iconNode$ei = [
    ["path", { d: "M2 7v10", key: "a2pl2d" }],
    ["path", { d: "M6 5v14", key: "1kq3d7" }],
    ["rect", { width: "12", height: "18", x: "10", y: "3", rx: "2", key: "13i7bc" }]
  ];
  const GalleryHorizontalEnd = createLucideIcon("gallery-horizontal-end", __iconNode$ei);

  const __iconNode$eh = [
    ["path", { d: "M2 3v18", key: "pzttux" }],
    ["rect", { width: "12", height: "18", x: "6", y: "3", rx: "2", key: "btr8bg" }],
    ["path", { d: "M22 3v18", key: "6jf3v" }]
  ];
  const GalleryHorizontal = createLucideIcon("gallery-horizontal", __iconNode$eh);

  const __iconNode$eg = [
    ["rect", { width: "18", height: "14", x: "3", y: "3", rx: "2", key: "74y24f" }],
    ["path", { d: "M4 21h1", key: "16zlid" }],
    ["path", { d: "M9 21h1", key: "15o7lz" }],
    ["path", { d: "M14 21h1", key: "v9vybs" }],
    ["path", { d: "M19 21h1", key: "edywat" }]
  ];
  const GalleryThumbnails = createLucideIcon("gallery-thumbnails", __iconNode$eg);

  const __iconNode$ef = [
    ["path", { d: "M7 2h10", key: "nczekb" }],
    ["path", { d: "M5 6h14", key: "u2x4p" }],
    ["rect", { width: "18", height: "12", x: "3", y: "10", rx: "2", key: "l0tzu3" }]
  ];
  const GalleryVerticalEnd = createLucideIcon("gallery-vertical-end", __iconNode$ef);

  const __iconNode$ee = [
    ["path", { d: "M3 2h18", key: "15qxfx" }],
    ["rect", { width: "18", height: "12", x: "3", y: "6", rx: "2", key: "1439r6" }],
    ["path", { d: "M3 22h18", key: "8prr45" }]
  ];
  const GalleryVertical = createLucideIcon("gallery-vertical", __iconNode$ee);

  const __iconNode$ed = [
    ["line", { x1: "6", x2: "10", y1: "11", y2: "11", key: "1gktln" }],
    ["line", { x1: "8", x2: "8", y1: "9", y2: "13", key: "qnk9ow" }],
    ["line", { x1: "15", x2: "15.01", y1: "12", y2: "12", key: "krot7o" }],
    ["line", { x1: "18", x2: "18.01", y1: "10", y2: "10", key: "1lcuu1" }],
    [
      "path",
      {
        d: "M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z",
        key: "mfqc10"
      }
    ]
  ];
  const Gamepad2 = createLucideIcon("gamepad-2", __iconNode$ed);

  const __iconNode$ec = [
    ["line", { x1: "6", x2: "10", y1: "12", y2: "12", key: "161bw2" }],
    ["line", { x1: "8", x2: "8", y1: "10", y2: "14", key: "1i6ji0" }],
    ["line", { x1: "15", x2: "15.01", y1: "13", y2: "13", key: "dqpgro" }],
    ["line", { x1: "18", x2: "18.01", y1: "11", y2: "11", key: "meh2c" }],
    ["rect", { width: "20", height: "12", x: "2", y: "6", rx: "2", key: "9lu3g6" }]
  ];
  const Gamepad = createLucideIcon("gamepad", __iconNode$ec);

  const __iconNode$eb = [
    ["path", { d: "m12 14 4-4", key: "9kzdfg" }],
    ["path", { d: "M3.34 19a10 10 0 1 1 17.32 0", key: "19p75a" }]
  ];
  const Gauge = createLucideIcon("gauge", __iconNode$eb);

  const __iconNode$ea = [
    ["path", { d: "m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8", key: "15492f" }],
    ["path", { d: "m16 16 6-6", key: "vzrcl6" }],
    ["path", { d: "m8 8 6-6", key: "18bi4p" }],
    ["path", { d: "m9 7 8 8", key: "5jnvq1" }],
    ["path", { d: "m21 11-8-8", key: "z4y7zo" }]
  ];
  const Gavel = createLucideIcon("gavel", __iconNode$ea);

  const __iconNode$e9 = [
    ["path", { d: "M6 3h12l4 6-10 13L2 9Z", key: "1pcd5k" }],
    ["path", { d: "M11 3 8 9l4 13 4-13-3-6", key: "1fcu3u" }],
    ["path", { d: "M2 9h20", key: "16fsjt" }]
  ];
  const Gem = createLucideIcon("gem", __iconNode$e9);

  const __iconNode$e8 = [
    ["path", { d: "M11.5 21a7.5 7.5 0 1 1 7.35-9", key: "1gyj8k" }],
    ["path", { d: "M13 12V3", key: "18om2a" }],
    ["path", { d: "M4 21h16", key: "1h09gz" }],
    ["path", { d: "M9 12V3", key: "geutu0" }]
  ];
  const GeorgianLari = createLucideIcon("georgian-lari", __iconNode$e8);

  const __iconNode$e7 = [
    ["path", { d: "M9 10h.01", key: "qbtxuw" }],
    ["path", { d: "M15 10h.01", key: "1qmjsl" }],
    [
      "path",
      {
        d: "M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z",
        key: "uwwb07"
      }
    ]
  ];
  const Ghost = createLucideIcon("ghost", __iconNode$e7);

  const __iconNode$e6 = [
    ["rect", { x: "3", y: "8", width: "18", height: "4", rx: "1", key: "bkv52" }],
    ["path", { d: "M12 8v13", key: "1c76mn" }],
    ["path", { d: "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7", key: "6wjy6b" }],
    [
      "path",
      {
        d: "M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5",
        key: "1ihvrl"
      }
    ]
  ];
  const Gift = createLucideIcon("gift", __iconNode$e6);

  const __iconNode$e5 = [
    ["path", { d: "M6 3v12", key: "qpgusn" }],
    ["path", { d: "M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", key: "1d02ji" }],
    ["path", { d: "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", key: "chk6ph" }],
    ["path", { d: "M15 6a9 9 0 0 0-9 9", key: "or332x" }],
    ["path", { d: "M18 15v6", key: "9wciyi" }],
    ["path", { d: "M21 18h-6", key: "139f0c" }]
  ];
  const GitBranchPlus = createLucideIcon("git-branch-plus", __iconNode$e5);

  const __iconNode$e4 = [
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
    ["line", { x1: "3", x2: "9", y1: "12", y2: "12", key: "1dyftd" }],
    ["line", { x1: "15", x2: "21", y1: "12", y2: "12", key: "oup4p8" }]
  ];
  const GitCommitHorizontal = createLucideIcon("git-commit-horizontal", __iconNode$e4);

  const __iconNode$e3 = [
    ["path", { d: "M12 3v6", key: "1holv5" }],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
    ["path", { d: "M12 15v6", key: "a9ows0" }]
  ];
  const GitCommitVertical = createLucideIcon("git-commit-vertical", __iconNode$e3);

  const __iconNode$e2 = [
    ["line", { x1: "6", x2: "6", y1: "3", y2: "15", key: "17qcm7" }],
    ["circle", { cx: "18", cy: "6", r: "3", key: "1h7g24" }],
    ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }],
    ["path", { d: "M18 9a9 9 0 0 1-9 9", key: "n2h4wq" }]
  ];
  const GitBranch = createLucideIcon("git-branch", __iconNode$e2);

  const __iconNode$e1 = [
    ["circle", { cx: "5", cy: "6", r: "3", key: "1qnov2" }],
    ["path", { d: "M12 6h5a2 2 0 0 1 2 2v7", key: "1yj91y" }],
    ["path", { d: "m15 9-3-3 3-3", key: "1lwv8l" }],
    ["circle", { cx: "19", cy: "18", r: "3", key: "1qljk2" }],
    ["path", { d: "M12 18H7a2 2 0 0 1-2-2V9", key: "16sdep" }],
    ["path", { d: "m9 15 3 3-3 3", key: "1m3kbl" }]
  ];
  const GitCompareArrows = createLucideIcon("git-compare-arrows", __iconNode$e1);

  const __iconNode$e0 = [
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }],
    ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
    ["path", { d: "M13 6h3a2 2 0 0 1 2 2v7", key: "1yeb86" }],
    ["path", { d: "M11 18H8a2 2 0 0 1-2-2V9", key: "19pyzm" }]
  ];
  const GitCompare = createLucideIcon("git-compare", __iconNode$e0);

  const __iconNode$d$ = [
    ["circle", { cx: "12", cy: "18", r: "3", key: "1mpf1b" }],
    ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
    ["circle", { cx: "18", cy: "6", r: "3", key: "1h7g24" }],
    ["path", { d: "M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9", key: "1uq4wg" }],
    ["path", { d: "M12 12v3", key: "158kv8" }]
  ];
  const GitFork = createLucideIcon("git-fork", __iconNode$d$);

  const __iconNode$d_ = [
    ["circle", { cx: "5", cy: "6", r: "3", key: "1qnov2" }],
    ["path", { d: "M5 9v6", key: "158jrl" }],
    ["circle", { cx: "5", cy: "18", r: "3", key: "104gr9" }],
    ["path", { d: "M12 3v18", key: "108xh3" }],
    ["circle", { cx: "19", cy: "6", r: "3", key: "108a5v" }],
    ["path", { d: "M16 15.7A9 9 0 0 0 19 9", key: "1e3vqb" }]
  ];
  const GitGraph = createLucideIcon("git-graph", __iconNode$d_);

  const __iconNode$dZ = [
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }],
    ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
    ["path", { d: "M6 21V9a9 9 0 0 0 9 9", key: "7kw0sc" }]
  ];
  const GitMerge = createLucideIcon("git-merge", __iconNode$dZ);

  const __iconNode$dY = [
    ["circle", { cx: "5", cy: "6", r: "3", key: "1qnov2" }],
    ["path", { d: "M5 9v12", key: "ih889a" }],
    ["circle", { cx: "19", cy: "18", r: "3", key: "1qljk2" }],
    ["path", { d: "m15 9-3-3 3-3", key: "1lwv8l" }],
    ["path", { d: "M12 6h5a2 2 0 0 1 2 2v7", key: "1yj91y" }]
  ];
  const GitPullRequestArrow = createLucideIcon("git-pull-request-arrow", __iconNode$dY);

  const __iconNode$dX = [
    ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
    ["path", { d: "M6 9v12", key: "1sc30k" }],
    ["path", { d: "m21 3-6 6", key: "16nqsk" }],
    ["path", { d: "m21 9-6-6", key: "9j17rh" }],
    ["path", { d: "M18 11.5V15", key: "65xf6f" }],
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }]
  ];
  const GitPullRequestClosed = createLucideIcon("git-pull-request-closed", __iconNode$dX);

  const __iconNode$dW = [
    ["circle", { cx: "5", cy: "6", r: "3", key: "1qnov2" }],
    ["path", { d: "M5 9v12", key: "ih889a" }],
    ["path", { d: "m15 9-3-3 3-3", key: "1lwv8l" }],
    ["path", { d: "M12 6h5a2 2 0 0 1 2 2v3", key: "1rbwk6" }],
    ["path", { d: "M19 15v6", key: "10aioa" }],
    ["path", { d: "M22 18h-6", key: "1d5gi5" }]
  ];
  const GitPullRequestCreateArrow = createLucideIcon("git-pull-request-create-arrow", __iconNode$dW);

  const __iconNode$dV = [
    ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
    ["path", { d: "M6 9v12", key: "1sc30k" }],
    ["path", { d: "M13 6h3a2 2 0 0 1 2 2v3", key: "1jb6z3" }],
    ["path", { d: "M18 15v6", key: "9wciyi" }],
    ["path", { d: "M21 18h-6", key: "139f0c" }]
  ];
  const GitPullRequestCreate = createLucideIcon("git-pull-request-create", __iconNode$dV);

  const __iconNode$dU = [
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }],
    ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
    ["path", { d: "M18 6V5", key: "1oao2s" }],
    ["path", { d: "M18 11v-1", key: "11c8tz" }],
    ["line", { x1: "6", x2: "6", y1: "9", y2: "21", key: "rroup" }]
  ];
  const GitPullRequestDraft = createLucideIcon("git-pull-request-draft", __iconNode$dU);

  const __iconNode$dT = [
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }],
    ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
    ["path", { d: "M13 6h3a2 2 0 0 1 2 2v7", key: "1yeb86" }],
    ["line", { x1: "6", x2: "6", y1: "9", y2: "21", key: "rroup" }]
  ];
  const GitPullRequest = createLucideIcon("git-pull-request", __iconNode$dT);

  const __iconNode$dS = [
    [
      "path",
      {
        d: "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",
        key: "tonef"
      }
    ],
    ["path", { d: "M9 18c-4.51 2-5-2-7-2", key: "9comsn" }]
  ];
  const Github = createLucideIcon("github", __iconNode$dS);

  const __iconNode$dR = [
    [
      "path",
      {
        d: "M5.116 4.104A1 1 0 0 1 6.11 3h11.78a1 1 0 0 1 .994 1.105L17.19 20.21A2 2 0 0 1 15.2 22H8.8a2 2 0 0 1-2-1.79z",
        key: "p55z4y"
      }
    ],
    ["path", { d: "M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0", key: "mjntcy" }]
  ];
  const GlassWater = createLucideIcon("glass-water", __iconNode$dR);

  const __iconNode$dQ = [
    [
      "path",
      {
        d: "m22 13.29-3.33-10a.42.42 0 0 0-.14-.18.38.38 0 0 0-.22-.11.39.39 0 0 0-.23.07.42.42 0 0 0-.14.18l-2.26 6.67H8.32L6.1 3.26a.42.42 0 0 0-.1-.18.38.38 0 0 0-.26-.08.39.39 0 0 0-.23.07.42.42 0 0 0-.14.18L2 13.29a.74.74 0 0 0 .27.83L12 21l9.69-6.88a.71.71 0 0 0 .31-.83Z",
        key: "148pdi"
      }
    ]
  ];
  const Gitlab = createLucideIcon("gitlab", __iconNode$dQ);

  const __iconNode$dP = [
    ["circle", { cx: "6", cy: "15", r: "4", key: "vux9w4" }],
    ["circle", { cx: "18", cy: "15", r: "4", key: "18o8ve" }],
    ["path", { d: "M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2", key: "1ag4bs" }],
    ["path", { d: "M2.5 13 5 7c.7-1.3 1.4-2 3-2", key: "1hm1gs" }],
    ["path", { d: "M21.5 13 19 7c-.7-1.3-1.5-2-3-2", key: "1r31ai" }]
  ];
  const Glasses = createLucideIcon("glasses", __iconNode$dP);

  const __iconNode$dO = [
    [
      "path",
      {
        d: "M15.686 15A14.5 14.5 0 0 1 12 22a14.5 14.5 0 0 1 0-20 10 10 0 1 0 9.542 13",
        key: "qkt0x6"
      }
    ],
    ["path", { d: "M2 12h8.5", key: "ovaggd" }],
    ["path", { d: "M20 6V4a2 2 0 1 0-4 0v2", key: "1of5e8" }],
    ["rect", { width: "8", height: "5", x: "14", y: "6", rx: "1", key: "1fmf51" }]
  ];
  const GlobeLock = createLucideIcon("globe-lock", __iconNode$dO);

  const __iconNode$dN = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20", key: "13o1zl" }],
    ["path", { d: "M2 12h20", key: "9i4pu4" }]
  ];
  const Globe = createLucideIcon("globe", __iconNode$dN);

  const __iconNode$dM = [
    ["path", { d: "M12 13V2l8 4-8 4", key: "5wlwwj" }],
    ["path", { d: "M20.561 10.222a9 9 0 1 1-12.55-5.29", key: "1c0wjv" }],
    ["path", { d: "M8.002 9.997a5 5 0 1 0 8.9 2.02", key: "gb1g7m" }]
  ];
  const Goal = createLucideIcon("goal", __iconNode$dM);

  const __iconNode$dL = [
    ["path", { d: "M2 21V3", key: "1bzk4w" }],
    ["path", { d: "M2 5h18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2.26", key: "1d64pi" }],
    ["path", { d: "M7 17v3a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-3", key: "5hbqbf" }],
    ["circle", { cx: "16", cy: "11", r: "2", key: "qt15rb" }],
    ["circle", { cx: "8", cy: "11", r: "2", key: "ssideg" }]
  ];
  const Gpu = createLucideIcon("gpu", __iconNode$dL);

  const __iconNode$dK = [
    ["path", { d: "M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4", key: "edstyy" }],
    ["path", { d: "M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2", key: "19wdwo" }],
    ["path", { d: "M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5", key: "1lugqo" }],
    ["path", { d: "M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2", key: "1hbeus" }],
    [
      "path",
      { d: "M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0", key: "1etffm" }
    ]
  ];
  const Grab = createLucideIcon("grab", __iconNode$dK);

  const __iconNode$dJ = [
    [
      "path",
      {
        d: "M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z",
        key: "j76jl0"
      }
    ],
    ["path", { d: "M22 10v6", key: "1lu8f3" }],
    ["path", { d: "M6 12.5V16a6 3 0 0 0 12 0v-3.5", key: "1r8lef" }]
  ];
  const GraduationCap = createLucideIcon("graduation-cap", __iconNode$dJ);

  const __iconNode$dI = [
    ["path", { d: "M22 5V2l-5.89 5.89", key: "1eenpo" }],
    ["circle", { cx: "16.6", cy: "15.89", r: "3", key: "xjtalx" }],
    ["circle", { cx: "8.11", cy: "7.4", r: "3", key: "u2fv6i" }],
    ["circle", { cx: "12.35", cy: "11.65", r: "3", key: "i6i8g7" }],
    ["circle", { cx: "13.91", cy: "5.85", r: "3", key: "6ye0dv" }],
    ["circle", { cx: "18.15", cy: "10.09", r: "3", key: "snx9no" }],
    ["circle", { cx: "6.56", cy: "13.2", r: "3", key: "17x4xg" }],
    ["circle", { cx: "10.8", cy: "17.44", r: "3", key: "1hogw9" }],
    ["circle", { cx: "5", cy: "19", r: "3", key: "1sn6vo" }]
  ];
  const Grape = createLucideIcon("grape", __iconNode$dI);

  const __iconNode$dH = [
    [
      "path",
      {
        d: "M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3",
        key: "11za1p"
      }
    ],
    ["path", { d: "m16 19 2 2 4-4", key: "1b14m6" }]
  ];
  const Grid2x2Check = createLucideIcon("grid-2x2-check", __iconNode$dH);

  const __iconNode$dG = [
    [
      "path",
      {
        d: "M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3",
        key: "11za1p"
      }
    ],
    ["path", { d: "M16 19h6", key: "xwg31i" }],
    ["path", { d: "M19 22v-6", key: "qhmiwi" }]
  ];
  const Grid2x2Plus = createLucideIcon("grid-2x2-plus", __iconNode$dG);

  const __iconNode$dF = [
    [
      "path",
      {
        d: "M12 3v17a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3",
        key: "11za1p"
      }
    ],
    ["path", { d: "m16 16 5 5", key: "8tpb07" }],
    ["path", { d: "m16 21 5-5", key: "193jll" }]
  ];
  const Grid2x2X = createLucideIcon("grid-2x2-x", __iconNode$dF);

  const __iconNode$dE = [
    ["path", { d: "M15 3v18", key: "14nvp0" }],
    ["path", { d: "M3 12h18", key: "1i2n21" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", key: "h1oib" }]
  ];
  const Grid3x2 = createLucideIcon("grid-3x2", __iconNode$dE);

  const __iconNode$dD = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["path", { d: "M3 15h18", key: "5xshup" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
    ["path", { d: "M15 3v18", key: "14nvp0" }]
  ];
  const Grid3x3 = createLucideIcon("grid-3x3", __iconNode$dD);

  const __iconNode$dC = [
    ["path", { d: "M12 3v18", key: "108xh3" }],
    ["path", { d: "M3 12h18", key: "1i2n21" }],
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", key: "h1oib" }]
  ];
  const Grid2x2 = createLucideIcon("grid-2x2", __iconNode$dC);

  const __iconNode$dB = [
    ["circle", { cx: "12", cy: "9", r: "1", key: "124mty" }],
    ["circle", { cx: "19", cy: "9", r: "1", key: "1ruzo2" }],
    ["circle", { cx: "5", cy: "9", r: "1", key: "1a8b28" }],
    ["circle", { cx: "12", cy: "15", r: "1", key: "1e56xg" }],
    ["circle", { cx: "19", cy: "15", r: "1", key: "1a92ep" }],
    ["circle", { cx: "5", cy: "15", r: "1", key: "5r1jwy" }]
  ];
  const GripHorizontal = createLucideIcon("grip-horizontal", __iconNode$dB);

  const __iconNode$dA = [
    ["circle", { cx: "9", cy: "12", r: "1", key: "1vctgf" }],
    ["circle", { cx: "9", cy: "5", r: "1", key: "hp0tcf" }],
    ["circle", { cx: "9", cy: "19", r: "1", key: "fkjjf6" }],
    ["circle", { cx: "15", cy: "12", r: "1", key: "1tmaij" }],
    ["circle", { cx: "15", cy: "5", r: "1", key: "19l28e" }],
    ["circle", { cx: "15", cy: "19", r: "1", key: "f4zoj3" }]
  ];
  const GripVertical = createLucideIcon("grip-vertical", __iconNode$dA);

  const __iconNode$dz = [
    ["circle", { cx: "12", cy: "5", r: "1", key: "gxeob9" }],
    ["circle", { cx: "19", cy: "5", r: "1", key: "w8mnmm" }],
    ["circle", { cx: "5", cy: "5", r: "1", key: "lttvr7" }],
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
    ["circle", { cx: "19", cy: "12", r: "1", key: "1wjl8i" }],
    ["circle", { cx: "5", cy: "12", r: "1", key: "1pcz8c" }],
    ["circle", { cx: "12", cy: "19", r: "1", key: "lyex9k" }],
    ["circle", { cx: "19", cy: "19", r: "1", key: "shf9b7" }],
    ["circle", { cx: "5", cy: "19", r: "1", key: "bfqh0e" }]
  ];
  const Grip = createLucideIcon("grip", __iconNode$dz);

  const __iconNode$dy = [
    ["path", { d: "M3 7V5c0-1.1.9-2 2-2h2", key: "adw53z" }],
    ["path", { d: "M17 3h2c1.1 0 2 .9 2 2v2", key: "an4l38" }],
    ["path", { d: "M21 17v2c0 1.1-.9 2-2 2h-2", key: "144t0e" }],
    ["path", { d: "M7 21H5c-1.1 0-2-.9-2-2v-2", key: "rtnfgi" }],
    ["rect", { width: "7", height: "5", x: "7", y: "7", rx: "1", key: "1eyiv7" }],
    ["rect", { width: "7", height: "5", x: "10", y: "12", rx: "1", key: "1qlmkx" }]
  ];
  const Group = createLucideIcon("group", __iconNode$dy);

  const __iconNode$dx = [
    ["path", { d: "m11.9 12.1 4.514-4.514", key: "109xqo" }],
    [
      "path",
      {
        d: "M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.3a1 1 0 0 0 0-1.4z",
        key: "txyc8t"
      }
    ],
    ["path", { d: "m6 16 2 2", key: "16qmzd" }],
    [
      "path",
      {
        d: "M8.23 9.85A3 3 0 0 1 11 8a5 5 0 0 1 5 5 3 3 0 0 1-1.85 2.77l-.92.38A2 2 0 0 0 12 18a4 4 0 0 1-4 4 6 6 0 0 1-6-6 4 4 0 0 1 4-4 2 2 0 0 0 1.85-1.23z",
        key: "1de1vg"
      }
    ]
  ];
  const Guitar = createLucideIcon("guitar", __iconNode$dx);

  const __iconNode$dw = [
    ["path", { d: "M13.144 21.144A7.274 10.445 45 1 0 2.856 10.856", key: "1k1t7q" }],
    [
      "path",
      {
        d: "M13.144 21.144A7.274 4.365 45 0 0 2.856 10.856a7.274 4.365 45 0 0 10.288 10.288",
        key: "153t1g"
      }
    ],
    [
      "path",
      {
        d: "M16.565 10.435 18.6 8.4a2.501 2.501 0 1 0 1.65-4.65 2.5 2.5 0 1 0-4.66 1.66l-2.024 2.025",
        key: "gzrt0n"
      }
    ],
    ["path", { d: "m8.5 16.5-1-1", key: "otr954" }]
  ];
  const Ham = createLucideIcon("ham", __iconNode$dw);

  const __iconNode$dv = [
    ["path", { d: "M12 16H4a2 2 0 1 1 0-4h16a2 2 0 1 1 0 4h-4.25", key: "5dloqd" }],
    ["path", { d: "M5 12a2 2 0 0 1-2-2 9 7 0 0 1 18 0 2 2 0 0 1-2 2", key: "1vl3my" }],
    [
      "path",
      {
        d: "M5 16a2 2 0 0 0-2 2 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 2 2 0 0 0-2-2q0 0 0 0",
        key: "1us75o"
      }
    ],
    ["path", { d: "m6.67 12 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2", key: "qqzweh" }]
  ];
  const Hamburger = createLucideIcon("hamburger", __iconNode$dv);

  const __iconNode$du = [
    ["path", { d: "m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9", key: "eefl8a" }],
    ["path", { d: "m18 15 4-4", key: "16gjal" }],
    [
      "path",
      {
        d: "m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5",
        key: "b7pghm"
      }
    ]
  ];
  const Hammer = createLucideIcon("hammer", __iconNode$du);

  const __iconNode$dt = [
    ["path", { d: "M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17", key: "geh8rc" }],
    [
      "path",
      {
        d: "m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9",
        key: "1fto5m"
      }
    ],
    ["path", { d: "m2 16 6 6", key: "1pfhp9" }],
    ["circle", { cx: "16", cy: "9", r: "2.9", key: "1n0dlu" }],
    ["circle", { cx: "6", cy: "5", r: "3", key: "151irh" }]
  ];
  const HandCoins = createLucideIcon("hand-coins", __iconNode$dt);

  const __iconNode$ds = [
    ["path", { d: "M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16", key: "1ifwr1" }],
    [
      "path",
      {
        d: "m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9",
        key: "17abbs"
      }
    ],
    ["path", { d: "m2 15 6 6", key: "10dquu" }],
    [
      "path",
      {
        d: "M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z",
        key: "1h3036"
      }
    ]
  ];
  const HandHeart = createLucideIcon("hand-heart", __iconNode$ds);

  const __iconNode$dr = [
    ["path", { d: "M11 12h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 14", key: "1j4xps" }],
    [
      "path",
      {
        d: "m7 18 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9",
        key: "uospg8"
      }
    ],
    ["path", { d: "m2 13 6 6", key: "16e5sb" }]
  ];
  const HandHelping = createLucideIcon("hand-helping", __iconNode$dr);

  const __iconNode$dq = [
    ["path", { d: "M18 12.5V10a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4", key: "wc6myp" }],
    ["path", { d: "M14 11V9a2 2 0 1 0-4 0v2", key: "94qvcw" }],
    ["path", { d: "M10 10.5V5a2 2 0 1 0-4 0v9", key: "m1ah89" }],
    [
      "path",
      {
        d: "m7 15-1.76-1.76a2 2 0 0 0-2.83 2.82l3.6 3.6C7.5 21.14 9.2 22 12 22h2a8 8 0 0 0 8-8V7a2 2 0 1 0-4 0v5",
        key: "t1skq1"
      }
    ]
  ];
  const HandMetal = createLucideIcon("hand-metal", __iconNode$dq);

  const __iconNode$dp = [
    ["path", { d: "M12 3V2", key: "ar7q03" }],
    [
      "path",
      {
        d: "m15.4 17.4 3.2-2.8a2 2 0 1 1 2.8 2.9l-3.6 3.3c-.7.8-1.7 1.2-2.8 1.2h-4c-1.1 0-2.1-.4-2.8-1.2l-1.302-1.464A1 1 0 0 0 6.151 19H5",
        key: "n2g93r"
      }
    ],
    ["path", { d: "M2 14h12a2 2 0 0 1 0 4h-2", key: "1o2jem" }],
    ["path", { d: "M4 10h16", key: "img6z1" }],
    ["path", { d: "M5 10a7 7 0 0 1 14 0", key: "1ega1o" }],
    ["path", { d: "M5 14v6a1 1 0 0 1-1 1H2", key: "1hescx" }]
  ];
  const HandPlatter = createLucideIcon("hand-platter", __iconNode$dp);

  const __iconNode$do = [
    ["path", { d: "m11 17 2 2a1 1 0 1 0 3-3", key: "efffak" }],
    [
      "path",
      {
        d: "m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4",
        key: "9pr0kb"
      }
    ],
    ["path", { d: "m21 3 1 11h-2", key: "1tisrp" }],
    ["path", { d: "M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3", key: "1uvwmv" }],
    ["path", { d: "M3 4h8", key: "1ep09j" }]
  ];
  const Handshake = createLucideIcon("handshake", __iconNode$do);

  const __iconNode$dn = [
    ["path", { d: "M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2", key: "1fvzgz" }],
    ["path", { d: "M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2", key: "1kc0my" }],
    ["path", { d: "M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8", key: "10h0bg" }],
    [
      "path",
      {
        d: "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
        key: "1s1gnw"
      }
    ]
  ];
  const Hand = createLucideIcon("hand", __iconNode$dn);

  const __iconNode$dm = [
    ["path", { d: "M12 2v8", key: "1q4o3n" }],
    ["path", { d: "m16 6-4 4-4-4", key: "6wukr" }],
    ["rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", key: "w68u3i" }],
    ["path", { d: "M6 18h.01", key: "uhywen" }],
    ["path", { d: "M10 18h.01", key: "h775k" }]
  ];
  const HardDriveDownload = createLucideIcon("hard-drive-download", __iconNode$dm);

  const __iconNode$dl = [
    ["path", { d: "m16 6-4-4-4 4", key: "13yo43" }],
    ["path", { d: "M12 2v8", key: "1q4o3n" }],
    ["rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", key: "w68u3i" }],
    ["path", { d: "M6 18h.01", key: "uhywen" }],
    ["path", { d: "M10 18h.01", key: "h775k" }]
  ];
  const HardDriveUpload = createLucideIcon("hard-drive-upload", __iconNode$dl);

  const __iconNode$dk = [
    ["line", { x1: "22", x2: "2", y1: "12", y2: "12", key: "1y58io" }],
    [
      "path",
      {
        d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
        key: "oot6mr"
      }
    ],
    ["line", { x1: "6", x2: "6.01", y1: "16", y2: "16", key: "sgf278" }],
    ["line", { x1: "10", x2: "10.01", y1: "16", y2: "16", key: "1l4acy" }]
  ];
  const HardDrive = createLucideIcon("hard-drive", __iconNode$dk);

  const __iconNode$dj = [
    ["path", { d: "M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5", key: "1p9q5i" }],
    ["path", { d: "M14 6a6 6 0 0 1 6 6v3", key: "1hnv84" }],
    ["path", { d: "M4 15v-3a6 6 0 0 1 6-6", key: "9ciidu" }],
    ["rect", { x: "2", y: "15", width: "20", height: "4", rx: "1", key: "g3x8cw" }]
  ];
  const HardHat = createLucideIcon("hard-hat", __iconNode$dj);

  const __iconNode$di = [
    ["line", { x1: "4", x2: "20", y1: "9", y2: "9", key: "4lhtct" }],
    ["line", { x1: "4", x2: "20", y1: "15", y2: "15", key: "vyu0kd" }],
    ["line", { x1: "10", x2: "8", y1: "3", y2: "21", key: "1ggp8o" }],
    ["line", { x1: "16", x2: "14", y1: "3", y2: "21", key: "weycgp" }]
  ];
  const Hash = createLucideIcon("hash", __iconNode$di);

  const __iconNode$dh = [
    ["path", { d: "m5.2 6.2 1.4 1.4", key: "17imol" }],
    ["path", { d: "M2 13h2", key: "13gyu8" }],
    ["path", { d: "M20 13h2", key: "16rner" }],
    ["path", { d: "m17.4 7.6 1.4-1.4", key: "t4xlah" }],
    ["path", { d: "M22 17H2", key: "1gtaj3" }],
    ["path", { d: "M22 21H2", key: "1gy6en" }],
    ["path", { d: "M16 13a4 4 0 0 0-8 0", key: "1dyczq" }],
    ["path", { d: "M12 5V2.5", key: "1vytko" }]
  ];
  const Haze = createLucideIcon("haze", __iconNode$dh);

  const __iconNode$dg = [
    [
      "path",
      {
        d: "M22 9a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1l2 2h12l2-2h1a1 1 0 0 0 1-1Z",
        key: "2128wb"
      }
    ],
    ["path", { d: "M7.5 12h9", key: "1t0ckc" }]
  ];
  const HdmiPort = createLucideIcon("hdmi-port", __iconNode$dg);

  const __iconNode$df = [
    ["path", { d: "M4 12h8", key: "17cfdx" }],
    ["path", { d: "M4 18V6", key: "1rz3zl" }],
    ["path", { d: "M12 18V6", key: "zqpxq5" }],
    ["path", { d: "m17 12 3-2v8", key: "1hhhft" }]
  ];
  const Heading1 = createLucideIcon("heading-1", __iconNode$df);

  const __iconNode$de = [
    ["path", { d: "M4 12h8", key: "17cfdx" }],
    ["path", { d: "M4 18V6", key: "1rz3zl" }],
    ["path", { d: "M12 18V6", key: "zqpxq5" }],
    ["path", { d: "M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1", key: "9jr5yi" }]
  ];
  const Heading2 = createLucideIcon("heading-2", __iconNode$de);

  const __iconNode$dd = [
    ["path", { d: "M4 12h8", key: "17cfdx" }],
    ["path", { d: "M4 18V6", key: "1rz3zl" }],
    ["path", { d: "M12 18V6", key: "zqpxq5" }],
    ["path", { d: "M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2", key: "68ncm8" }],
    ["path", { d: "M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2", key: "1ejuhz" }]
  ];
  const Heading3 = createLucideIcon("heading-3", __iconNode$dd);

  const __iconNode$dc = [
    ["path", { d: "M12 18V6", key: "zqpxq5" }],
    ["path", { d: "M17 10v3a1 1 0 0 0 1 1h3", key: "tj5zdr" }],
    ["path", { d: "M21 10v8", key: "1kdml4" }],
    ["path", { d: "M4 12h8", key: "17cfdx" }],
    ["path", { d: "M4 18V6", key: "1rz3zl" }]
  ];
  const Heading4 = createLucideIcon("heading-4", __iconNode$dc);

  const __iconNode$db = [
    ["path", { d: "M4 12h8", key: "17cfdx" }],
    ["path", { d: "M4 18V6", key: "1rz3zl" }],
    ["path", { d: "M12 18V6", key: "zqpxq5" }],
    ["path", { d: "M17 13v-3h4", key: "1nvgqp" }],
    [
      "path",
      { d: "M17 17.7c.4.2.8.3 1.3.3 1.5 0 2.7-1.1 2.7-2.5S19.8 13 18.3 13H17", key: "2nebdn" }
    ]
  ];
  const Heading5 = createLucideIcon("heading-5", __iconNode$db);

  const __iconNode$da = [
    ["path", { d: "M4 12h8", key: "17cfdx" }],
    ["path", { d: "M4 18V6", key: "1rz3zl" }],
    ["path", { d: "M12 18V6", key: "zqpxq5" }],
    ["circle", { cx: "19", cy: "16", r: "2", key: "15mx69" }],
    ["path", { d: "M20 10c-2 2-3 3.5-3 6", key: "f35dl0" }]
  ];
  const Heading6 = createLucideIcon("heading-6", __iconNode$da);

  const __iconNode$d9 = [
    ["path", { d: "M6 12h12", key: "8npq4p" }],
    ["path", { d: "M6 20V4", key: "1w1bmo" }],
    ["path", { d: "M18 20V4", key: "o2hl4u" }]
  ];
  const Heading = createLucideIcon("heading", __iconNode$d9);

  const __iconNode$d8 = [
    ["path", { d: "M21 14h-1.343", key: "1jdnxi" }],
    ["path", { d: "M9.128 3.47A9 9 0 0 1 21 12v3.343", key: "6kipu2" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M20.414 20.414A2 2 0 0 1 19 21h-1a2 2 0 0 1-2-2v-3", key: "9x50f4" }],
    [
      "path",
      {
        d: "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 2.636-6.364",
        key: "1bkxnm"
      }
    ]
  ];
  const HeadphoneOff = createLucideIcon("headphone-off", __iconNode$d8);

  const __iconNode$d7 = [
    [
      "path",
      {
        d: "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3",
        key: "1xhozi"
      }
    ]
  ];
  const Headphones = createLucideIcon("headphones", __iconNode$d7);

  const __iconNode$d6 = [
    [
      "path",
      {
        d: "M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z",
        key: "12oyoe"
      }
    ],
    ["path", { d: "M21 16v2a4 4 0 0 1-4 4h-5", key: "1x7m43" }]
  ];
  const Headset = createLucideIcon("headset", __iconNode$d6);

  const __iconNode$d5 = [
    [
      "path",
      {
        d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
        key: "c3ymky"
      }
    ],
    ["path", { d: "m12 13-1-1 2-2-3-3 2-2", key: "xjdxli" }]
  ];
  const HeartCrack = createLucideIcon("heart-crack", __iconNode$d5);

  const __iconNode$d4 = [
    [
      "path",
      {
        d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
        key: "c3ymky"
      }
    ],
    [
      "path",
      {
        d: "M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66",
        key: "4oyue0"
      }
    ],
    ["path", { d: "m18 15-2-2", key: "60u0ii" }],
    ["path", { d: "m15 18-2-2", key: "6p76be" }]
  ];
  const HeartHandshake = createLucideIcon("heart-handshake", __iconNode$d4);

  const __iconNode$d3 = [
    [
      "path",
      {
        d: "M13.5 19.5 12 21l-7-7c-1.5-1.45-3-3.2-3-5.5A5.5 5.5 0 0 1 7.5 3c1.76 0 3 .5 4.5 2 1.5-1.5 2.74-2 4.5-2a5.5 5.5 0 0 1 5.402 6.5",
        key: "vd0vy5"
      }
    ],
    ["path", { d: "M15 15h6", key: "1u4692" }]
  ];
  const HeartMinus = createLucideIcon("heart-minus", __iconNode$d3);

  const __iconNode$d2 = [
    ["line", { x1: "2", y1: "2", x2: "22", y2: "22", key: "1w4vcy" }],
    [
      "path",
      { d: "M16.5 16.5 12 21l-7-7c-1.5-1.45-3-3.2-3-5.5a5.5 5.5 0 0 1 2.14-4.35", key: "3mpagl" }
    ],
    [
      "path",
      {
        d: "M8.76 3.1c1.15.22 2.13.78 3.24 1.9 1.5-1.5 2.74-2 4.5-2A5.5 5.5 0 0 1 22 8.5c0 2.12-1.3 3.78-2.67 5.17",
        key: "1gh3v3"
      }
    ]
  ];
  const HeartOff = createLucideIcon("heart-off", __iconNode$d2);

  const __iconNode$d1 = [
    [
      "path",
      {
        d: "M13.5 19.5 12 21l-7-7c-1.5-1.45-3-3.2-3-5.5A5.5 5.5 0 0 1 7.5 3c1.76 0 3 .5 4.5 2 1.5-1.5 2.74-2 4.5-2a5.5 5.5 0 0 1 5.402 6.5",
        key: "vd0vy5"
      }
    ],
    ["path", { d: "M15 15h6", key: "1u4692" }],
    ["path", { d: "M18 12v6", key: "1houu1" }]
  ];
  const HeartPlus = createLucideIcon("heart-plus", __iconNode$d1);

  const __iconNode$d0 = [
    [
      "path",
      {
        d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
        key: "c3ymky"
      }
    ],
    ["path", { d: "M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27", key: "1uw2ng" }]
  ];
  const HeartPulse = createLucideIcon("heart-pulse", __iconNode$d0);

  const __iconNode$c$ = [
    [
      "path",
      {
        d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
        key: "c3ymky"
      }
    ]
  ];
  const Heart = createLucideIcon("heart", __iconNode$c$);

  const __iconNode$c_ = [
    ["path", { d: "M11 8c2-3-2-3 0-6", key: "1ldv5m" }],
    ["path", { d: "M15.5 8c2-3-2-3 0-6", key: "1otqoz" }],
    ["path", { d: "M6 10h.01", key: "1lbq93" }],
    ["path", { d: "M6 14h.01", key: "zudwn7" }],
    ["path", { d: "M10 16v-4", key: "1c25yv" }],
    ["path", { d: "M14 16v-4", key: "1dkbt8" }],
    ["path", { d: "M18 16v-4", key: "1yg9me" }],
    [
      "path",
      { d: "M20 6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3", key: "1ubg90" }
    ],
    ["path", { d: "M5 20v2", key: "1abpe8" }],
    ["path", { d: "M19 20v2", key: "kqn6ft" }]
  ];
  const Heater = createLucideIcon("heater", __iconNode$c_);

  const __iconNode$cZ = [
    ["path", { d: "m9 11-6 6v3h9l3-3", key: "1a3l36" }],
    ["path", { d: "m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4", key: "14a9rk" }]
  ];
  const Highlighter = createLucideIcon("highlighter", __iconNode$cZ);

  const __iconNode$cY = [
    [
      "path",
      {
        d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
        key: "yt0hxn"
      }
    ]
  ];
  const Hexagon = createLucideIcon("hexagon", __iconNode$cY);

  const __iconNode$cX = [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" }],
    ["path", { d: "M3 3v5h5", key: "1xhq8a" }],
    ["path", { d: "M12 7v5l4 2", key: "1fdv2h" }]
  ];
  const History = createLucideIcon("history", __iconNode$cX);

  const __iconNode$cW = [
    ["path", { d: "M10.82 16.12c1.69.6 3.91.79 5.18.85.28.01.53-.09.7-.27", key: "qyzcap" }],
    [
      "path",
      {
        d: "M11.14 20.57c.52.24 2.44 1.12 4.08 1.37.46.06.86-.25.9-.71.12-1.52-.3-3.43-.5-4.28",
        key: "y078lb"
      }
    ],
    ["path", { d: "M16.13 21.05c1.65.63 3.68.84 4.87.91a.9.9 0 0 0 .7-.26", key: "1utre3" }],
    [
      "path",
      {
        d: "M17.99 5.52a20.83 20.83 0 0 1 3.15 4.5.8.8 0 0 1-.68 1.13c-1.17.1-2.5.02-3.9-.25",
        key: "17o9hm"
      }
    ],
    ["path", { d: "M20.57 11.14c.24.52 1.12 2.44 1.37 4.08.04.3-.08.59-.31.75", key: "1d1n4p" }],
    [
      "path",
      {
        d: "M4.93 4.93a10 10 0 0 0-.67 13.4c.35.43.96.4 1.17-.12.69-1.71 1.07-5.07 1.07-6.71 1.34.45 3.1.9 4.88.62a.85.85 0 0 0 .48-.24",
        key: "9uv3tt"
      }
    ],
    [
      "path",
      {
        d: "M5.52 17.99c1.05.95 2.91 2.42 4.5 3.15a.8.8 0 0 0 1.13-.68c.2-2.34-.33-5.3-1.57-8.28",
        key: "1292wz"
      }
    ],
    [
      "path",
      {
        d: "M8.35 2.68a10 10 0 0 1 9.98 1.58c.43.35.4.96-.12 1.17-1.5.6-4.3.98-6.07 1.05",
        key: "7ozu9p"
      }
    ],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const HopOff = createLucideIcon("hop-off", __iconNode$cW);

  const __iconNode$cV = [
    [
      "path",
      {
        d: "M10.82 16.12c1.69.6 3.91.79 5.18.85.55.03 1-.42.97-.97-.06-1.27-.26-3.5-.85-5.18",
        key: "18lxf1"
      }
    ],
    [
      "path",
      {
        d: "M11.5 6.5c1.64 0 5-.38 6.71-1.07.52-.2.55-.82.12-1.17A10 10 0 0 0 4.26 18.33c.35.43.96.4 1.17-.12.69-1.71 1.07-5.07 1.07-6.71 1.34.45 3.1.9 4.88.62a.88.88 0 0 0 .73-.74c.3-2.14-.15-3.5-.61-4.88",
        key: "vtfxrw"
      }
    ],
    [
      "path",
      {
        d: "M15.62 16.95c.2.85.62 2.76.5 4.28a.77.77 0 0 1-.9.7 16.64 16.64 0 0 1-4.08-1.36",
        key: "13hl71"
      }
    ],
    [
      "path",
      {
        d: "M16.13 21.05c1.65.63 3.68.84 4.87.91a.9.9 0 0 0 .96-.96 17.68 17.68 0 0 0-.9-4.87",
        key: "1sl8oj"
      }
    ],
    [
      "path",
      {
        d: "M16.94 15.62c.86.2 2.77.62 4.29.5a.77.77 0 0 0 .7-.9 16.64 16.64 0 0 0-1.36-4.08",
        key: "19c6kt"
      }
    ],
    [
      "path",
      {
        d: "M17.99 5.52a20.82 20.82 0 0 1 3.15 4.5.8.8 0 0 1-.68 1.13c-2.33.2-5.3-.32-8.27-1.57",
        key: "85ghs3"
      }
    ],
    ["path", { d: "M4.93 4.93 3 3a.7.7 0 0 1 0-1", key: "x087yj" }],
    [
      "path",
      {
        d: "M9.58 12.18c1.24 2.98 1.77 5.95 1.57 8.28a.8.8 0 0 1-1.13.68 20.82 20.82 0 0 1-4.5-3.15",
        key: "11xdqo"
      }
    ]
  ];
  const Hop = createLucideIcon("hop", __iconNode$cV);

  const __iconNode$cU = [
    ["path", { d: "M12 6v4", key: "16clxf" }],
    ["path", { d: "M14 14h-4", key: "esezmu" }],
    ["path", { d: "M14 18h-4", key: "16mqa2" }],
    ["path", { d: "M14 8h-4", key: "z8ypaz" }],
    [
      "path",
      {
        d: "M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2",
        key: "b1k337"
      }
    ],
    ["path", { d: "M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18", key: "16g51d" }]
  ];
  const Hospital = createLucideIcon("hospital", __iconNode$cU);

  const __iconNode$cT = [
    ["path", { d: "M10 22v-6.57", key: "1wmca3" }],
    ["path", { d: "M12 11h.01", key: "z322tv" }],
    ["path", { d: "M12 7h.01", key: "1ivr5q" }],
    ["path", { d: "M14 15.43V22", key: "1q2vjd" }],
    ["path", { d: "M15 16a5 5 0 0 0-6 0", key: "o9wqvi" }],
    ["path", { d: "M16 11h.01", key: "xkw8gn" }],
    ["path", { d: "M16 7h.01", key: "1kdx03" }],
    ["path", { d: "M8 11h.01", key: "1dfujw" }],
    ["path", { d: "M8 7h.01", key: "1vti4s" }],
    ["rect", { x: "4", y: "2", width: "16", height: "20", rx: "2", key: "1uxh74" }]
  ];
  const Hotel = createLucideIcon("hotel", __iconNode$cT);

  const __iconNode$cS = [
    ["path", { d: "M5 22h14", key: "ehvnwv" }],
    ["path", { d: "M5 2h14", key: "pdyrp9" }],
    [
      "path",
      {
        d: "M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22",
        key: "1d314k"
      }
    ],
    [
      "path",
      { d: "M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2", key: "1vvvr6" }
    ]
  ];
  const Hourglass = createLucideIcon("hourglass", __iconNode$cS);

  const __iconNode$cR = [
    ["path", { d: "M10 12V8.964", key: "1vll13" }],
    ["path", { d: "M14 12V8.964", key: "1x3qvg" }],
    [
      "path",
      { d: "M15 12a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2a1 1 0 0 1 1-1z", key: "ppykja" }
    ],
    [
      "path",
      {
        d: "M8.5 21H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-2",
        key: "1gvg2z"
      }
    ]
  ];
  const HousePlug = createLucideIcon("house-plug", __iconNode$cR);

  const __iconNode$cQ = [
    [
      "path",
      {
        d: "M12.662 21H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v2.475",
        key: "uubd2h"
      }
    ],
    ["path", { d: "M14.959 12.717A1 1 0 0 0 14 12h-4a1 1 0 0 0-1 1v8", key: "p7f341" }],
    ["path", { d: "M15 18h6", key: "3b3c90" }],
    ["path", { d: "M18 15v6", key: "9wciyi" }]
  ];
  const HousePlus = createLucideIcon("house-plus", __iconNode$cQ);

  const __iconNode$cP = [
    ["path", { d: "M9.5 13.866a4 4 0 0 1 5 .01", key: "1wy54i" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }],
    [
      "path",
      {
        d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        key: "1d0kgt"
      }
    ],
    ["path", { d: "M7 10.754a8 8 0 0 1 10 0", key: "exoy2g" }]
  ];
  const HouseWifi = createLucideIcon("house-wifi", __iconNode$cP);

  const __iconNode$cO = [
    ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8", key: "5wwlr5" }],
    [
      "path",
      {
        d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
        key: "1d0kgt"
      }
    ]
  ];
  const House = createLucideIcon("house", __iconNode$cO);

  const __iconNode$cN = [
    [
      "path",
      {
        d: "M12 17c5 0 8-2.69 8-6H4c0 3.31 3 6 8 6m-4 4h8m-4-3v3M5.14 11a3.5 3.5 0 1 1 6.71 0",
        key: "1uxfcu"
      }
    ],
    ["path", { d: "M12.14 11a3.5 3.5 0 1 1 6.71 0", key: "4k3m1s" }],
    ["path", { d: "M15.5 6.5a3.5 3.5 0 1 0-7 0", key: "zmuahr" }]
  ];
  const IceCreamBowl = createLucideIcon("ice-cream-bowl", __iconNode$cN);

  const __iconNode$cM = [
    ["path", { d: "m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11", key: "1v6356" }],
    ["path", { d: "M17 7A5 5 0 0 0 7 7", key: "151p3v" }],
    ["path", { d: "M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4", key: "1sdaij" }]
  ];
  const IceCreamCone = createLucideIcon("ice-cream-cone", __iconNode$cM);

  const __iconNode$cL = [
    ["path", { d: "M13.5 8h-3", key: "xvov4w" }],
    [
      "path",
      {
        d: "m15 2-1 2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3",
        key: "16uttc"
      }
    ],
    ["path", { d: "M16.899 22A5 5 0 0 0 7.1 22", key: "1d0ppr" }],
    ["path", { d: "m9 2 3 6", key: "1o7bd9" }],
    ["circle", { cx: "12", cy: "15", r: "3", key: "g36mzq" }]
  ];
  const IdCardLanyard = createLucideIcon("id-card-lanyard", __iconNode$cL);

  const __iconNode$cK = [
    ["path", { d: "M16 10h2", key: "8sgtl7" }],
    ["path", { d: "M16 14h2", key: "epxaof" }],
    ["path", { d: "M6.17 15a3 3 0 0 1 5.66 0", key: "n6f512" }],
    ["circle", { cx: "9", cy: "11", r: "2", key: "yxgjnd" }],
    ["rect", { x: "2", y: "5", width: "20", height: "14", rx: "2", key: "qneu4z" }]
  ];
  const IdCard = createLucideIcon("id-card", __iconNode$cK);

  const __iconNode$cJ = [
    [
      "path",
      {
        d: "M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21",
        key: "9csbqa"
      }
    ],
    ["path", { d: "m14 19 3 3v-5.5", key: "9ldu5r" }],
    ["path", { d: "m17 22 3-3", key: "1nkfve" }],
    ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }]
  ];
  const ImageDown = createLucideIcon("image-down", __iconNode$cJ);

  const __iconNode$cI = [
    ["path", { d: "M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7", key: "m87ecr" }],
    ["line", { x1: "16", x2: "22", y1: "5", y2: "5", key: "ez7e4s" }],
    ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }],
    ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21", key: "1xmnt7" }]
  ];
  const ImageMinus = createLucideIcon("image-minus", __iconNode$cI);

  const __iconNode$cH = [
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }],
    ["path", { d: "M10.41 10.41a2 2 0 1 1-2.83-2.83", key: "1bzlo9" }],
    ["line", { x1: "13.5", x2: "6", y1: "13.5", y2: "21", key: "1q0aeu" }],
    ["line", { x1: "18", x2: "21", y1: "12", y2: "15", key: "5mozeu" }],
    [
      "path",
      {
        d: "M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59",
        key: "mmje98"
      }
    ],
    ["path", { d: "M21 15V5a2 2 0 0 0-2-2H9", key: "43el77" }]
  ];
  const ImageOff = createLucideIcon("image-off", __iconNode$cH);

  const __iconNode$cG = [
    ["path", { d: "m11 16-5 5", key: "j5f7ct" }],
    ["path", { d: "M11 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6.5", key: "7s81lt" }],
    [
      "path",
      {
        d: "M15.765 22a.5.5 0 0 1-.765-.424V13.38a.5.5 0 0 1 .765-.424l5.878 3.674a1 1 0 0 1 0 1.696z",
        key: "1omb6s"
      }
    ],
    ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }]
  ];
  const ImagePlay = createLucideIcon("image-play", __iconNode$cG);

  const __iconNode$cF = [
    ["path", { d: "M16 5h6", key: "1vod17" }],
    ["path", { d: "M19 2v6", key: "4bpg5p" }],
    ["path", { d: "M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5", key: "1ue2ih" }],
    ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21", key: "1xmnt7" }],
    ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }]
  ];
  const ImagePlus = createLucideIcon("image-plus", __iconNode$cF);

  const __iconNode$cE = [
    [
      "path",
      {
        d: "M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21",
        key: "9csbqa"
      }
    ],
    ["path", { d: "m14 19.5 3-3 3 3", key: "9vmjn0" }],
    ["path", { d: "M17 22v-5.5", key: "1aa6fl" }],
    ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }]
  ];
  const ImageUp = createLucideIcon("image-up", __iconNode$cE);

  const __iconNode$cD = [
    ["path", { d: "M16 3h5v5", key: "1806ms" }],
    ["path", { d: "M17 21h2a2 2 0 0 0 2-2", key: "130fy9" }],
    ["path", { d: "M21 12v3", key: "1wzk3p" }],
    ["path", { d: "m21 3-5 5", key: "1g5oa7" }],
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2", key: "kk3yz1" }],
    ["path", { d: "m5 21 4.144-4.144a1.21 1.21 0 0 1 1.712 0L13 19", key: "fyekpt" }],
    ["path", { d: "M9 3h3", key: "d52fa" }],
    ["rect", { x: "3", y: "11", width: "10", height: "10", rx: "1", key: "1wpmix" }]
  ];
  const ImageUpscale = createLucideIcon("image-upscale", __iconNode$cD);

  const __iconNode$cC = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }],
    ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21", key: "1xmnt7" }]
  ];
  const Image = createLucideIcon("image", __iconNode$cC);

  const __iconNode$cB = [
    ["path", { d: "M18 22H4a2 2 0 0 1-2-2V6", key: "pblm9e" }],
    ["path", { d: "m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18", key: "nf6bnh" }],
    ["circle", { cx: "12", cy: "8", r: "2", key: "1822b1" }],
    ["rect", { width: "16", height: "16", x: "6", y: "2", rx: "2", key: "12espp" }]
  ];
  const Images = createLucideIcon("images", __iconNode$cB);

  const __iconNode$cA = [
    ["path", { d: "M12 3v12", key: "1x0j5s" }],
    ["path", { d: "m8 11 4 4 4-4", key: "1dohi6" }],
    [
      "path",
      {
        d: "M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4",
        key: "1ywtjm"
      }
    ]
  ];
  const Import = createLucideIcon("import", __iconNode$cA);

  const __iconNode$cz = [
    ["polyline", { points: "22 12 16 12 14 15 10 15 8 12 2 12", key: "o97t9d" }],
    [
      "path",
      {
        d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
        key: "oot6mr"
      }
    ]
  ];
  const Inbox = createLucideIcon("inbox", __iconNode$cz);

  const __iconNode$cy = [
    ["path", { d: "M21 12H11", key: "wd7e0v" }],
    ["path", { d: "M21 18H11", key: "4wu86t" }],
    ["path", { d: "M21 6H11", key: "6dy1d6" }],
    ["path", { d: "m7 8-4 4 4 4", key: "o5hrat" }]
  ];
  const IndentDecrease = createLucideIcon("indent-decrease", __iconNode$cy);

  const __iconNode$cx = [
    ["path", { d: "M21 12H11", key: "wd7e0v" }],
    ["path", { d: "M21 18H11", key: "4wu86t" }],
    ["path", { d: "M21 6H11", key: "6dy1d6" }],
    ["path", { d: "m3 8 4 4-4 4", key: "1a3j6y" }]
  ];
  const IndentIncrease = createLucideIcon("indent-increase", __iconNode$cx);

  const __iconNode$cw = [
    ["path", { d: "M6 3h12", key: "ggurg9" }],
    ["path", { d: "M6 8h12", key: "6g4wlu" }],
    ["path", { d: "m6 13 8.5 8", key: "u1kupk" }],
    ["path", { d: "M6 13h3", key: "wdp6ag" }],
    ["path", { d: "M9 13c6.667 0 6.667-10 0-10", key: "1nkvk2" }]
  ];
  const IndianRupee = createLucideIcon("indian-rupee", __iconNode$cw);

  const __iconNode$cv = [
    ["path", { d: "M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8", key: "18ogeb" }]
  ];
  const Infinity = createLucideIcon("infinity", __iconNode$cv);

  const __iconNode$cu = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M12 16v-4", key: "1dtifu" }],
    ["path", { d: "M12 8h.01", key: "e9boi3" }]
  ];
  const Info = createLucideIcon("info", __iconNode$cu);

  const __iconNode$ct = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M7 7h.01", key: "7u93v4" }],
    ["path", { d: "M17 7h.01", key: "14a9sn" }],
    ["path", { d: "M7 17h.01", key: "19xn7k" }],
    ["path", { d: "M17 17h.01", key: "1sd3ek" }]
  ];
  const InspectionPanel = createLucideIcon("inspection-panel", __iconNode$ct);

  const __iconNode$cs = [
    ["line", { x1: "19", x2: "10", y1: "4", y2: "4", key: "15jd3p" }],
    ["line", { x1: "14", x2: "5", y1: "20", y2: "20", key: "bu0au3" }],
    ["line", { x1: "15", x2: "9", y1: "4", y2: "20", key: "uljnxc" }]
  ];
  const Italic = createLucideIcon("italic", __iconNode$cs);

  const __iconNode$cr = [
    ["rect", { width: "20", height: "20", x: "2", y: "2", rx: "5", ry: "5", key: "2e1cvw" }],
    ["path", { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z", key: "9exkf1" }],
    ["line", { x1: "17.5", x2: "17.51", y1: "6.5", y2: "6.5", key: "r4j83e" }]
  ];
  const Instagram = createLucideIcon("instagram", __iconNode$cr);

  const __iconNode$cq = [
    ["path", { d: "m16 14 4 4-4 4", key: "hkso8o" }],
    ["path", { d: "M20 10a8 8 0 1 0-8 8h8", key: "1bik7b" }]
  ];
  const IterationCcw = createLucideIcon("iteration-ccw", __iconNode$cq);

  const __iconNode$cp = [
    ["path", { d: "M4 10a8 8 0 1 1 8 8H4", key: "svv66n" }],
    ["path", { d: "m8 22-4-4 4-4", key: "6g7gki" }]
  ];
  const IterationCw = createLucideIcon("iteration-cw", __iconNode$cp);

  const __iconNode$co = [
    ["path", { d: "M12 9.5V21m0-11.5L6 3m6 6.5L18 3", key: "2ej80x" }],
    ["path", { d: "M6 15h12", key: "1hwgt5" }],
    ["path", { d: "M6 11h12", key: "wf4gp6" }]
  ];
  const JapaneseYen = createLucideIcon("japanese-yen", __iconNode$co);

  const __iconNode$cn = [
    [
      "path",
      {
        d: "M21 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2Z",
        key: "jg2n2t"
      }
    ],
    ["path", { d: "M6 15v-2", key: "gd6mvg" }],
    ["path", { d: "M12 15V9", key: "8c7uyn" }],
    ["circle", { cx: "12", cy: "6", r: "3", key: "1gm2ql" }]
  ];
  const Joystick = createLucideIcon("joystick", __iconNode$cn);

  const __iconNode$cm = [
    ["path", { d: "M6 5v11", key: "mdvv1e" }],
    ["path", { d: "M12 5v6", key: "14ar3b" }],
    ["path", { d: "M18 5v14", key: "7ji314" }]
  ];
  const Kanban = createLucideIcon("kanban", __iconNode$cm);

  const __iconNode$cl = [
    [
      "path",
      {
        d: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",
        key: "1s6t7t"
      }
    ],
    ["circle", { cx: "16.5", cy: "7.5", r: ".5", fill: "currentColor", key: "w0ekpg" }]
  ];
  const KeyRound = createLucideIcon("key-round", __iconNode$cl);

  const __iconNode$ck = [
    [
      "path",
      {
        d: "M12.4 2.7a2.5 2.5 0 0 1 3.4 0l5.5 5.5a2.5 2.5 0 0 1 0 3.4l-3.7 3.7a2.5 2.5 0 0 1-3.4 0L8.7 9.8a2.5 2.5 0 0 1 0-3.4z",
        key: "165ttr"
      }
    ],
    ["path", { d: "m14 7 3 3", key: "1r5n42" }],
    [
      "path",
      {
        d: "m9.4 10.6-6.814 6.814A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814",
        key: "1ubxi2"
      }
    ]
  ];
  const KeySquare = createLucideIcon("key-square", __iconNode$ck);

  const __iconNode$cj = [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
    ["path", { d: "M6 8h4", key: "utf9t1" }],
    ["path", { d: "M14 8h.01", key: "1primd" }],
    ["path", { d: "M18 8h.01", key: "emo2bl" }],
    ["path", { d: "M2 12h20", key: "9i4pu4" }],
    ["path", { d: "M6 12v4", key: "dy92yo" }],
    ["path", { d: "M10 12v4", key: "1fxnav" }],
    ["path", { d: "M14 12v4", key: "1hft58" }],
    ["path", { d: "M18 12v4", key: "tjjnbz" }]
  ];
  const KeyboardMusic = createLucideIcon("keyboard-music", __iconNode$cj);

  const __iconNode$ci = [
    ["path", { d: "m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4", key: "g0fldk" }],
    ["path", { d: "m21 2-9.6 9.6", key: "1j0ho8" }],
    ["circle", { cx: "7.5", cy: "15.5", r: "5.5", key: "yqb3hr" }]
  ];
  const Key = createLucideIcon("key", __iconNode$ci);

  const __iconNode$ch = [
    ["path", { d: "M 20 4 A2 2 0 0 1 22 6", key: "1g1fkt" }],
    ["path", { d: "M 22 6 L 22 16.41", key: "1qjg3w" }],
    ["path", { d: "M 7 16 L 16 16", key: "n0yqwb" }],
    ["path", { d: "M 9.69 4 L 20 4", key: "kbpcgx" }],
    ["path", { d: "M14 8h.01", key: "1primd" }],
    ["path", { d: "M18 8h.01", key: "emo2bl" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2", key: "s23sx2" }],
    ["path", { d: "M6 8h.01", key: "x9i8wu" }],
    ["path", { d: "M8 12h.01", key: "czm47f" }]
  ];
  const KeyboardOff = createLucideIcon("keyboard-off", __iconNode$ch);

  const __iconNode$cg = [
    ["path", { d: "M10 8h.01", key: "1r9ogq" }],
    ["path", { d: "M12 12h.01", key: "1mp3jc" }],
    ["path", { d: "M14 8h.01", key: "1primd" }],
    ["path", { d: "M16 12h.01", key: "1l6xoz" }],
    ["path", { d: "M18 8h.01", key: "emo2bl" }],
    ["path", { d: "M6 8h.01", key: "x9i8wu" }],
    ["path", { d: "M7 16h10", key: "wp8him" }],
    ["path", { d: "M8 12h.01", key: "czm47f" }],
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }]
  ];
  const Keyboard = createLucideIcon("keyboard", __iconNode$cg);

  const __iconNode$cf = [
    ["path", { d: "M12 2v5", key: "nd4vlx" }],
    ["path", { d: "M14.829 15.998a3 3 0 1 1-5.658 0", key: "1pybiy" }],
    [
      "path",
      {
        d: "M20.92 14.606A1 1 0 0 1 20 16H4a1 1 0 0 1-.92-1.394l3-7A1 1 0 0 1 7 7h10a1 1 0 0 1 .92.606z",
        key: "ma1wor"
      }
    ]
  ];
  const LampCeiling = createLucideIcon("lamp-ceiling", __iconNode$cf);

  const __iconNode$ce = [
    [
      "path",
      {
        d: "M10.293 2.293a1 1 0 0 1 1.414 0l2.5 2.5 5.994 1.227a1 1 0 0 1 .506 1.687l-7 7a1 1 0 0 1-1.687-.506l-1.227-5.994-2.5-2.5a1 1 0 0 1 0-1.414z",
        key: "sb8slu"
      }
    ],
    ["path", { d: "m14.207 4.793-3.414 3.414", key: "m2x3oj" }],
    [
      "path",
      { d: "M3 20a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z", key: "8b3myj" }
    ],
    ["path", { d: "m9.086 6.5-4.793 4.793a1 1 0 0 0-.18 1.17L7 18", key: "43s6cu" }]
  ];
  const LampDesk = createLucideIcon("lamp-desk", __iconNode$ce);

  const __iconNode$cd = [
    ["path", { d: "M12 10v12", key: "6ubwww" }],
    [
      "path",
      {
        d: "M17.929 7.629A1 1 0 0 1 17 9H7a1 1 0 0 1-.928-1.371l2-5A1 1 0 0 1 9 2h6a1 1 0 0 1 .928.629z",
        key: "1o95gh"
      }
    ],
    ["path", { d: "M9 22h6", key: "1rlq3v" }]
  ];
  const LampFloor = createLucideIcon("lamp-floor", __iconNode$cd);

  const __iconNode$cc = [
    [
      "path",
      {
        d: "M19.929 18.629A1 1 0 0 1 19 20H9a1 1 0 0 1-.928-1.371l2-5A1 1 0 0 1 11 13h6a1 1 0 0 1 .928.629z",
        key: "u4w2d7"
      }
    ],
    [
      "path",
      { d: "M6 3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", key: "15356w" }
    ],
    ["path", { d: "M8 6h4a2 2 0 0 1 2 2v5", key: "1m6m7x" }]
  ];
  const LampWallDown = createLucideIcon("lamp-wall-down", __iconNode$cc);

  const __iconNode$cb = [
    [
      "path",
      {
        d: "M19.929 9.629A1 1 0 0 1 19 11H9a1 1 0 0 1-.928-1.371l2-5A1 1 0 0 1 11 4h6a1 1 0 0 1 .928.629z",
        key: "1uvrbf"
      }
    ],
    [
      "path",
      { d: "M6 15a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z", key: "154r2a" }
    ],
    ["path", { d: "M8 18h4a2 2 0 0 0 2-2v-5", key: "z9mbu0" }]
  ];
  const LampWallUp = createLucideIcon("lamp-wall-up", __iconNode$cb);

  const __iconNode$ca = [
    ["path", { d: "M12 12v6", key: "3ahymv" }],
    [
      "path",
      {
        d: "M4.077 10.615A1 1 0 0 0 5 12h14a1 1 0 0 0 .923-1.385l-3.077-7.384A2 2 0 0 0 15 2H9a2 2 0 0 0-1.846 1.23Z",
        key: "1l7kg2"
      }
    ],
    [
      "path",
      { d: "M8 20a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z", key: "1mmzpi" }
    ]
  ];
  const Lamp = createLucideIcon("lamp", __iconNode$ca);

  const __iconNode$c9 = [
    ["path", { d: "m12 8 6-3-6-3v10", key: "mvpnpy" }],
    [
      "path",
      {
        d: "m8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16 12",
        key: "ek95tt"
      }
    ],
    ["path", { d: "m6.49 12.85 11.02 6.3", key: "1kt42w" }],
    ["path", { d: "M17.51 12.85 6.5 19.15", key: "v55bdg" }]
  ];
  const LandPlot = createLucideIcon("land-plot", __iconNode$c9);

  const __iconNode$c8 = [
    ["path", { d: "M10 18v-7", key: "wt116b" }],
    [
      "path",
      {
        d: "M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z",
        key: "1m329m"
      }
    ],
    ["path", { d: "M14 18v-7", key: "vav6t3" }],
    ["path", { d: "M18 18v-7", key: "aexdmj" }],
    ["path", { d: "M3 22h18", key: "8prr45" }],
    ["path", { d: "M6 18v-7", key: "1ivflk" }]
  ];
  const Landmark = createLucideIcon("landmark", __iconNode$c8);

  const __iconNode$c7 = [
    ["path", { d: "m5 8 6 6", key: "1wu5hv" }],
    ["path", { d: "m4 14 6-6 2-3", key: "1k1g8d" }],
    ["path", { d: "M2 5h12", key: "or177f" }],
    ["path", { d: "M7 2h1", key: "1t2jsx" }],
    ["path", { d: "m22 22-5-10-5 10", key: "don7ne" }],
    ["path", { d: "M14 18h6", key: "1m8k6r" }]
  ];
  const Languages = createLucideIcon("languages", __iconNode$c7);

  const __iconNode$c6 = [
    ["path", { d: "M2 20h20", key: "owomy5" }],
    ["path", { d: "m9 10 2 2 4-4", key: "1gnqz4" }],
    ["rect", { x: "3", y: "4", width: "18", height: "12", rx: "2", key: "8ur36m" }]
  ];
  const LaptopMinimalCheck = createLucideIcon("laptop-minimal-check", __iconNode$c6);

  const __iconNode$c5 = [
    ["rect", { width: "18", height: "12", x: "3", y: "4", rx: "2", ry: "2", key: "1qhy41" }],
    ["line", { x1: "2", x2: "22", y1: "20", y2: "20", key: "ni3hll" }]
  ];
  const LaptopMinimal = createLucideIcon("laptop-minimal", __iconNode$c5);

  const __iconNode$c4 = [
    [
      "path",
      {
        d: "M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z",
        key: "1pdavp"
      }
    ],
    ["path", { d: "M20.054 15.987H3.946", key: "14rxg9" }]
  ];
  const Laptop = createLucideIcon("laptop", __iconNode$c4);

  const __iconNode$c3 = [
    ["path", { d: "M7 22a5 5 0 0 1-2-4", key: "umushi" }],
    ["path", { d: "M7 16.93c.96.43 1.96.74 2.99.91", key: "ybbtv3" }],
    [
      "path",
      {
        d: "M3.34 14A6.8 6.8 0 0 1 2 10c0-4.42 4.48-8 10-8s10 3.58 10 8a7.19 7.19 0 0 1-.33 2",
        key: "gt5e1w"
      }
    ],
    ["path", { d: "M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", key: "bq3ynw" }],
    [
      "path",
      {
        d: "M14.33 22h-.09a.35.35 0 0 1-.24-.32v-10a.34.34 0 0 1 .33-.34c.08 0 .15.03.21.08l7.34 6a.33.33 0 0 1-.21.59h-4.49l-2.57 3.85a.35.35 0 0 1-.28.14z",
        key: "72q637"
      }
    ]
  ];
  const LassoSelect = createLucideIcon("lasso-select", __iconNode$c3);

  const __iconNode$c2 = [
    ["path", { d: "M7 22a5 5 0 0 1-2-4", key: "umushi" }],
    [
      "path",
      {
        d: "M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1",
        key: "146dds"
      }
    ],
    ["path", { d: "M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", key: "bq3ynw" }]
  ];
  const Lasso = createLucideIcon("lasso", __iconNode$c2);

  const __iconNode$c1 = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z", key: "b2q4dd" }],
    ["line", { x1: "9", x2: "9.01", y1: "9", y2: "9", key: "yxxnd0" }],
    ["line", { x1: "15", x2: "15.01", y1: "9", y2: "9", key: "1p4y9e" }]
  ];
  const Laugh = createLucideIcon("laugh", __iconNode$c1);

  const __iconNode$c0 = [
    [
      "path",
      {
        d: "M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z",
        key: "15q6uc"
      }
    ],
    [
      "path",
      {
        d: "m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845",
        key: "byia6g"
      }
    ]
  ];
  const Layers2 = createLucideIcon("layers-2", __iconNode$c0);

  const __iconNode$b$ = [
    [
      "path",
      {
        d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",
        key: "zw3jo"
      }
    ],
    [
      "path",
      {
        d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12",
        key: "1wduqc"
      }
    ],
    [
      "path",
      {
        d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17",
        key: "kqbvx6"
      }
    ]
  ];
  const Layers = createLucideIcon("layers", __iconNode$b$);

  const __iconNode$b_ = [
    ["rect", { width: "7", height: "9", x: "3", y: "3", rx: "1", key: "10lvy0" }],
    ["rect", { width: "7", height: "5", x: "14", y: "3", rx: "1", key: "16une8" }],
    ["rect", { width: "7", height: "9", x: "14", y: "12", rx: "1", key: "1hutg5" }],
    ["rect", { width: "7", height: "5", x: "3", y: "16", rx: "1", key: "ldoo1y" }]
  ];
  const LayoutDashboard = createLucideIcon("layout-dashboard", __iconNode$b_);

  const __iconNode$bZ = [
    ["rect", { width: "7", height: "7", x: "3", y: "3", rx: "1", key: "1g98yp" }],
    ["rect", { width: "7", height: "7", x: "14", y: "3", rx: "1", key: "6d4xhi" }],
    ["rect", { width: "7", height: "7", x: "14", y: "14", rx: "1", key: "nxv5o0" }],
    ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1", key: "1bb6yr" }]
  ];
  const LayoutGrid = createLucideIcon("layout-grid", __iconNode$bZ);

  const __iconNode$bY = [
    ["rect", { width: "7", height: "7", x: "3", y: "3", rx: "1", key: "1g98yp" }],
    ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1", key: "1bb6yr" }],
    ["path", { d: "M14 4h7", key: "3xa0d5" }],
    ["path", { d: "M14 9h7", key: "1icrd9" }],
    ["path", { d: "M14 15h7", key: "1mj8o2" }],
    ["path", { d: "M14 20h7", key: "11slyb" }]
  ];
  const LayoutList = createLucideIcon("layout-list", __iconNode$bY);

  const __iconNode$bX = [
    ["rect", { width: "7", height: "18", x: "3", y: "3", rx: "1", key: "2obqm" }],
    ["rect", { width: "7", height: "7", x: "14", y: "3", rx: "1", key: "6d4xhi" }],
    ["rect", { width: "7", height: "7", x: "14", y: "14", rx: "1", key: "nxv5o0" }]
  ];
  const LayoutPanelLeft = createLucideIcon("layout-panel-left", __iconNode$bX);

  const __iconNode$bW = [
    ["rect", { width: "18", height: "7", x: "3", y: "3", rx: "1", key: "f1a2em" }],
    ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1", key: "1bb6yr" }],
    ["rect", { width: "7", height: "7", x: "14", y: "14", rx: "1", key: "nxv5o0" }]
  ];
  const LayoutPanelTop = createLucideIcon("layout-panel-top", __iconNode$bW);

  const __iconNode$bV = [
    ["rect", { width: "18", height: "7", x: "3", y: "3", rx: "1", key: "f1a2em" }],
    ["rect", { width: "9", height: "7", x: "3", y: "14", rx: "1", key: "jqznyg" }],
    ["rect", { width: "5", height: "7", x: "16", y: "14", rx: "1", key: "q5h2i8" }]
  ];
  const LayoutTemplate = createLucideIcon("layout-template", __iconNode$bV);

  const __iconNode$bU = [
    [
      "path",
      {
        d: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z",
        key: "nnexq3"
      }
    ],
    ["path", { d: "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12", key: "mt58a7" }]
  ];
  const Leaf = createLucideIcon("leaf", __iconNode$bU);

  const __iconNode$bT = [
    [
      "path",
      {
        d: "M2 22c1.25-.987 2.27-1.975 3.9-2.2a5.56 5.56 0 0 1 3.8 1.5 4 4 0 0 0 6.187-2.353 3.5 3.5 0 0 0 3.69-5.116A3.5 3.5 0 0 0 20.95 8 3.5 3.5 0 1 0 16 3.05a3.5 3.5 0 0 0-5.831 1.373 3.5 3.5 0 0 0-5.116 3.69 4 4 0 0 0-2.348 6.155C3.499 15.42 4.409 16.712 4.2 18.1 3.926 19.743 3.014 20.732 2 22",
        key: "1134nt"
      }
    ],
    ["path", { d: "M2 22 17 7", key: "1q7jp2" }]
  ];
  const LeafyGreen = createLucideIcon("leafy-green", __iconNode$bT);

  const __iconNode$bS = [
    [
      "path",
      {
        d: "M16 12h3a2 2 0 0 0 1.902-1.38l1.056-3.333A1 1 0 0 0 21 6H3a1 1 0 0 0-.958 1.287l1.056 3.334A2 2 0 0 0 5 12h3",
        key: "13jjxg"
      }
    ],
    ["path", { d: "M18 6V3a1 1 0 0 0-1-1h-3", key: "1550fe" }],
    ["rect", { width: "8", height: "12", x: "8", y: "10", rx: "1", key: "qmu8b6" }]
  ];
  const Lectern = createLucideIcon("lectern", __iconNode$bS);

  const __iconNode$bR = [
    ["path", { d: "M15 12h6", key: "upa0zy" }],
    ["path", { d: "M15 6h6", key: "1jlkvy" }],
    ["path", { d: "m3 13 3.553-7.724a.5.5 0 0 1 .894 0L11 13", key: "blevx4" }],
    ["path", { d: "M3 18h18", key: "1h113x" }],
    ["path", { d: "M3.92 11h6.16", key: "1bqo8m" }]
  ];
  const LetterText = createLucideIcon("letter-text", __iconNode$bR);

  const __iconNode$bQ = [
    ["rect", { width: "8", height: "18", x: "3", y: "3", rx: "1", key: "oynpb5" }],
    ["path", { d: "M7 3v18", key: "bbkbws" }],
    [
      "path",
      {
        d: "M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z",
        key: "1qboyk"
      }
    ]
  ];
  const LibraryBig = createLucideIcon("library-big", __iconNode$bQ);

  const __iconNode$bP = [
    ["path", { d: "m16 6 4 14", key: "ji33uf" }],
    ["path", { d: "M12 6v14", key: "1n7gus" }],
    ["path", { d: "M8 8v12", key: "1gg7y9" }],
    ["path", { d: "M4 4v16", key: "6qkkli" }]
  ];
  const Library = createLucideIcon("library", __iconNode$bP);

  const __iconNode$bO = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m4.93 4.93 4.24 4.24", key: "1ymg45" }],
    ["path", { d: "m14.83 9.17 4.24-4.24", key: "1cb5xl" }],
    ["path", { d: "m14.83 14.83 4.24 4.24", key: "q42g0n" }],
    ["path", { d: "m9.17 14.83-4.24 4.24", key: "bqpfvv" }],
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }]
  ];
  const LifeBuoy = createLucideIcon("life-buoy", __iconNode$bO);

  const __iconNode$bN = [
    ["path", { d: "M8 20V8c0-2.2 1.8-4 4-4 1.5 0 2.8.8 3.5 2", key: "1rtphz" }],
    ["path", { d: "M6 12h4", key: "a4o3ry" }],
    ["path", { d: "M14 12h2v8", key: "c1fccl" }],
    ["path", { d: "M6 20h4", key: "1i6q5t" }],
    ["path", { d: "M14 20h4", key: "lzx1xo" }]
  ];
  const Ligature = createLucideIcon("ligature", __iconNode$bN);

  const __iconNode$bM = [
    ["path", { d: "M16.8 11.2c.8-.9 1.2-2 1.2-3.2a6 6 0 0 0-9.3-5", key: "1fkcox" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M6.3 6.3a4.67 4.67 0 0 0 1.2 5.2c.7.7 1.3 1.5 1.5 2.5", key: "10m8kw" }],
    ["path", { d: "M9 18h6", key: "x1upvd" }],
    ["path", { d: "M10 22h4", key: "ceow96" }]
  ];
  const LightbulbOff = createLucideIcon("lightbulb-off", __iconNode$bM);

  const __iconNode$bL = [
    [
      "path",
      {
        d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
        key: "1gvzjb"
      }
    ],
    ["path", { d: "M9 18h6", key: "x1upvd" }],
    ["path", { d: "M10 22h4", key: "ceow96" }]
  ];
  const Lightbulb = createLucideIcon("lightbulb", __iconNode$bL);

  const __iconNode$bK = [
    [
      "path",
      {
        d: "M7 3.5c5-2 7 2.5 3 4C1.5 10 2 15 5 16c5 2 9-10 14-7s.5 13.5-4 12c-5-2.5.5-11 6-2",
        key: "1lrphd"
      }
    ]
  ];
  const LineSquiggle = createLucideIcon("line-squiggle", __iconNode$bK);

  const __iconNode$bJ = [
    ["path", { d: "M9 17H7A5 5 0 0 1 7 7", key: "10o201" }],
    ["path", { d: "M15 7h2a5 5 0 0 1 4 8", key: "1d3206" }],
    ["line", { x1: "8", x2: "12", y1: "12", y2: "12", key: "rvw6j4" }],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const Link2Off = createLucideIcon("link-2-off", __iconNode$bJ);

  const __iconNode$bI = [
    ["path", { d: "M9 17H7A5 5 0 0 1 7 7h2", key: "8i5ue5" }],
    ["path", { d: "M15 7h2a5 5 0 1 1 0 10h-2", key: "1b9ql8" }],
    ["line", { x1: "8", x2: "16", y1: "12", y2: "12", key: "1jonct" }]
  ];
  const Link2 = createLucideIcon("link-2", __iconNode$bI);

  const __iconNode$bH = [
    ["path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", key: "1cjeqo" }],
    ["path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71", key: "19qd67" }]
  ];
  const Link = createLucideIcon("link", __iconNode$bH);

  const __iconNode$bG = [
    [
      "path",
      {
        d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z",
        key: "c2jq9f"
      }
    ],
    ["rect", { width: "4", height: "12", x: "2", y: "9", key: "mk3on5" }],
    ["circle", { cx: "4", cy: "4", r: "2", key: "bt5ra8" }]
  ];
  const Linkedin = createLucideIcon("linkedin", __iconNode$bG);

  const __iconNode$bF = [
    ["path", { d: "M11 18H3", key: "n3j2dh" }],
    ["path", { d: "m15 18 2 2 4-4", key: "1szwhi" }],
    ["path", { d: "M16 12H3", key: "1a2rj7" }],
    ["path", { d: "M16 6H3", key: "1wxfjs" }]
  ];
  const ListCheck = createLucideIcon("list-check", __iconNode$bF);

  const __iconNode$bE = [
    ["path", { d: "m3 17 2 2 4-4", key: "1jhpwq" }],
    ["path", { d: "m3 7 2 2 4-4", key: "1obspn" }],
    ["path", { d: "M13 6h8", key: "15sg57" }],
    ["path", { d: "M13 12h8", key: "h98zly" }],
    ["path", { d: "M13 18h8", key: "oe0vm4" }]
  ];
  const ListChecks = createLucideIcon("list-checks", __iconNode$bE);

  const __iconNode$bD = [
    ["path", { d: "M10 12h11", key: "6m4ad9" }],
    ["path", { d: "M10 18h11", key: "11hvi2" }],
    ["path", { d: "M10 6h11", key: "c7qv1k" }],
    ["path", { d: "m3 10 3-3-3-3", key: "i7pm08" }],
    ["path", { d: "m3 20 3-3-3-3", key: "20gx1n" }]
  ];
  const ListCollapse = createLucideIcon("list-collapse", __iconNode$bD);

  const __iconNode$bC = [
    ["path", { d: "M16 12H3", key: "1a2rj7" }],
    ["path", { d: "M16 6H3", key: "1wxfjs" }],
    ["path", { d: "M10 18H3", key: "13769t" }],
    ["path", { d: "M21 6v10a2 2 0 0 1-2 2h-5", key: "ilrcs8" }],
    ["path", { d: "m16 16-2 2 2 2", key: "kkc6pm" }]
  ];
  const ListEnd = createLucideIcon("list-end", __iconNode$bC);

  const __iconNode$bB = [
    ["path", { d: "M10 18h4", key: "1ulq68" }],
    ["path", { d: "M11 6H3", key: "1u26ik" }],
    ["path", { d: "M15 6h6", key: "1jlkvy" }],
    ["path", { d: "M18 9V3", key: "xwwp7m" }],
    ["path", { d: "M7 12h8", key: "7a1bxv" }]
  ];
  const ListFilterPlus = createLucideIcon("list-filter-plus", __iconNode$bB);

  const __iconNode$bA = [
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M7 12h10", key: "b7w52i" }],
    ["path", { d: "M10 18h4", key: "1ulq68" }]
  ];
  const ListFilter = createLucideIcon("list-filter", __iconNode$bA);

  const __iconNode$bz = [
    ["path", { d: "M11 12H3", key: "51ecnj" }],
    ["path", { d: "M16 6H3", key: "1wxfjs" }],
    ["path", { d: "M16 18H3", key: "12xzn7" }],
    ["path", { d: "M21 12h-6", key: "bt1uis" }]
  ];
  const ListMinus = createLucideIcon("list-minus", __iconNode$bz);

  const __iconNode$by = [
    ["path", { d: "M21 15V6", key: "h1cx4g" }],
    ["path", { d: "M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", key: "8saifv" }],
    ["path", { d: "M12 12H3", key: "18klou" }],
    ["path", { d: "M16 6H3", key: "1wxfjs" }],
    ["path", { d: "M12 18H3", key: "11ftsu" }]
  ];
  const ListMusic = createLucideIcon("list-music", __iconNode$by);

  const __iconNode$bx = [
    ["path", { d: "M10 12h11", key: "6m4ad9" }],
    ["path", { d: "M10 18h11", key: "11hvi2" }],
    ["path", { d: "M10 6h11", key: "c7qv1k" }],
    ["path", { d: "M4 10h2", key: "16xx2s" }],
    ["path", { d: "M4 6h1v4", key: "cnovpq" }],
    ["path", { d: "M6 18H4c0-1 2-2 2-3s-1-1.5-2-1", key: "m9a95d" }]
  ];
  const ListOrdered = createLucideIcon("list-ordered", __iconNode$bx);

  const __iconNode$bw = [
    ["path", { d: "M11 12H3", key: "51ecnj" }],
    ["path", { d: "M16 6H3", key: "1wxfjs" }],
    ["path", { d: "M16 18H3", key: "12xzn7" }],
    ["path", { d: "M18 9v6", key: "1twb98" }],
    ["path", { d: "M21 12h-6", key: "bt1uis" }]
  ];
  const ListPlus = createLucideIcon("list-plus", __iconNode$bw);

  const __iconNode$bv = [
    ["path", { d: "M21 6H3", key: "1jwq7v" }],
    ["path", { d: "M7 12H3", key: "13ou7f" }],
    ["path", { d: "M7 18H3", key: "1sijw9" }],
    [
      "path",
      {
        d: "M12 18a5 5 0 0 0 9-3 4.5 4.5 0 0 0-4.5-4.5c-1.33 0-2.54.54-3.41 1.41L11 14",
        key: "qth677"
      }
    ],
    ["path", { d: "M11 10v4h4", key: "172dkj" }]
  ];
  const ListRestart = createLucideIcon("list-restart", __iconNode$bv);

  const __iconNode$bu = [
    ["path", { d: "M16 12H3", key: "1a2rj7" }],
    ["path", { d: "M16 18H3", key: "12xzn7" }],
    ["path", { d: "M10 6H3", key: "lf8lx7" }],
    ["path", { d: "M21 18V8a2 2 0 0 0-2-2h-5", key: "1hghli" }],
    ["path", { d: "m16 8-2-2 2-2", key: "160uvd" }]
  ];
  const ListStart = createLucideIcon("list-start", __iconNode$bu);

  const __iconNode$bt = [
    ["rect", { x: "3", y: "5", width: "6", height: "6", rx: "1", key: "1defrl" }],
    ["path", { d: "m3 17 2 2 4-4", key: "1jhpwq" }],
    ["path", { d: "M13 6h8", key: "15sg57" }],
    ["path", { d: "M13 12h8", key: "h98zly" }],
    ["path", { d: "M13 18h8", key: "oe0vm4" }]
  ];
  const ListTodo = createLucideIcon("list-todo", __iconNode$bt);

  const __iconNode$bs = [
    ["path", { d: "M21 12h-8", key: "1bmf0i" }],
    ["path", { d: "M21 6H8", key: "1pqkrb" }],
    ["path", { d: "M21 18h-8", key: "1tm79t" }],
    ["path", { d: "M3 6v4c0 1.1.9 2 2 2h3", key: "1ywdgy" }],
    ["path", { d: "M3 10v6c0 1.1.9 2 2 2h3", key: "2wc746" }]
  ];
  const ListTree = createLucideIcon("list-tree", __iconNode$bs);

  const __iconNode$br = [
    ["path", { d: "M12 12H3", key: "18klou" }],
    ["path", { d: "M16 6H3", key: "1wxfjs" }],
    ["path", { d: "M12 18H3", key: "11ftsu" }],
    ["path", { d: "m16 12 5 3-5 3v-6Z", key: "zpskkp" }]
  ];
  const ListVideo = createLucideIcon("list-video", __iconNode$br);

  const __iconNode$bq = [
    ["path", { d: "M11 12H3", key: "51ecnj" }],
    ["path", { d: "M16 6H3", key: "1wxfjs" }],
    ["path", { d: "M16 18H3", key: "12xzn7" }],
    ["path", { d: "m19 10-4 4", key: "1tz659" }],
    ["path", { d: "m15 10 4 4", key: "1n7nei" }]
  ];
  const ListX = createLucideIcon("list-x", __iconNode$bq);

  const __iconNode$bp = [
    ["path", { d: "M3 12h.01", key: "nlz23k" }],
    ["path", { d: "M3 18h.01", key: "1tta3j" }],
    ["path", { d: "M3 6h.01", key: "1rqtza" }],
    ["path", { d: "M8 12h13", key: "1za7za" }],
    ["path", { d: "M8 18h13", key: "1lx6n3" }],
    ["path", { d: "M8 6h13", key: "ik3vkj" }]
  ];
  const List = createLucideIcon("list", __iconNode$bp);

  const __iconNode$bo = [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]];
  const LoaderCircle = createLucideIcon("loader-circle", __iconNode$bo);

  const __iconNode$bn = [
    ["path", { d: "M12 2v4", key: "3427ic" }],
    ["path", { d: "m16.2 7.8 2.9-2.9", key: "r700ao" }],
    ["path", { d: "M18 12h4", key: "wj9ykh" }],
    ["path", { d: "m16.2 16.2 2.9 2.9", key: "1bxg5t" }],
    ["path", { d: "M12 18v4", key: "jadmvz" }],
    ["path", { d: "m4.9 19.1 2.9-2.9", key: "bwix9q" }],
    ["path", { d: "M2 12h4", key: "j09sii" }],
    ["path", { d: "m4.9 4.9 2.9 2.9", key: "giyufr" }]
  ];
  const Loader = createLucideIcon("loader", __iconNode$bn);

  const __iconNode$bm = [
    ["path", { d: "M22 12a1 1 0 0 1-10 0 1 1 0 0 0-10 0", key: "1lzz15" }],
    ["path", { d: "M7 20.7a1 1 0 1 1 5-8.7 1 1 0 1 0 5-8.6", key: "1gnrpi" }],
    ["path", { d: "M7 3.3a1 1 0 1 1 5 8.6 1 1 0 1 0 5 8.6", key: "u9yy5q" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const LoaderPinwheel = createLucideIcon("loader-pinwheel", __iconNode$bm);

  const __iconNode$bl = [
    ["line", { x1: "2", x2: "5", y1: "12", y2: "12", key: "bvdh0s" }],
    ["line", { x1: "19", x2: "22", y1: "12", y2: "12", key: "1tbv5k" }],
    ["line", { x1: "12", x2: "12", y1: "2", y2: "5", key: "11lu5j" }],
    ["line", { x1: "12", x2: "12", y1: "19", y2: "22", key: "x3vr5v" }],
    ["circle", { cx: "12", cy: "12", r: "7", key: "fim9np" }],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
  ];
  const LocateFixed = createLucideIcon("locate-fixed", __iconNode$bl);

  const __iconNode$bk = [
    ["path", { d: "M12 19v3", key: "npa21l" }],
    ["path", { d: "M12 2v3", key: "qbqxhf" }],
    ["path", { d: "M18.89 13.24a7 7 0 0 0-8.13-8.13", key: "1v9jrh" }],
    ["path", { d: "M19 12h3", key: "osuazr" }],
    ["path", { d: "M2 12h3", key: "1wrr53" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M7.05 7.05a7 7 0 0 0 9.9 9.9", key: "rc5l2e" }]
  ];
  const LocateOff = createLucideIcon("locate-off", __iconNode$bk);

  const __iconNode$bj = [
    ["line", { x1: "2", x2: "5", y1: "12", y2: "12", key: "bvdh0s" }],
    ["line", { x1: "19", x2: "22", y1: "12", y2: "12", key: "1tbv5k" }],
    ["line", { x1: "12", x2: "12", y1: "2", y2: "5", key: "11lu5j" }],
    ["line", { x1: "12", x2: "12", y1: "19", y2: "22", key: "x3vr5v" }],
    ["circle", { cx: "12", cy: "12", r: "7", key: "fim9np" }]
  ];
  const Locate = createLucideIcon("locate", __iconNode$bj);

  const __iconNode$bi = [
    ["path", { d: "M17.97 9.304A8 8 0 0 0 2 10c0 4.69 4.887 9.562 7.022 11.468", key: "1fahp3" }],
    [
      "path",
      {
        d: "M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
        key: "1817ys"
      }
    ],
    ["circle", { cx: "10", cy: "10", r: "3", key: "1ns7v1" }]
  ];
  const LocationEdit = createLucideIcon("location-edit", __iconNode$bi);

  const __iconNode$bh = [
    ["circle", { cx: "12", cy: "16", r: "1", key: "1au0dj" }],
    ["rect", { width: "18", height: "12", x: "3", y: "10", rx: "2", key: "l0tzu3" }],
    ["path", { d: "M7 10V7a5 5 0 0 1 9.33-2.5", key: "car5b7" }]
  ];
  const LockKeyholeOpen = createLucideIcon("lock-keyhole-open", __iconNode$bh);

  const __iconNode$bg = [
    ["circle", { cx: "12", cy: "16", r: "1", key: "1au0dj" }],
    ["rect", { x: "3", y: "10", width: "18", height: "12", rx: "2", key: "6s8ecr" }],
    ["path", { d: "M7 10V7a5 5 0 0 1 10 0v3", key: "1pqi11" }]
  ];
  const LockKeyhole = createLucideIcon("lock-keyhole", __iconNode$bg);

  const __iconNode$bf = [
    ["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2", key: "1w4ew1" }],
    ["path", { d: "M7 11V7a5 5 0 0 1 9.9-1", key: "1mm8w8" }]
  ];
  const LockOpen = createLucideIcon("lock-open", __iconNode$bf);

  const __iconNode$be = [
    ["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2", key: "1w4ew1" }],
    ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4", key: "fwvmzm" }]
  ];
  const Lock = createLucideIcon("lock", __iconNode$be);

  const __iconNode$bd = [
    ["path", { d: "m10 17 5-5-5-5", key: "1bsop3" }],
    ["path", { d: "M15 12H3", key: "6jk70r" }],
    ["path", { d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4", key: "u53s6r" }]
  ];
  const LogIn = createLucideIcon("log-in", __iconNode$bd);

  const __iconNode$bc = [
    ["path", { d: "M13 12h8", key: "h98zly" }],
    ["path", { d: "M13 18h8", key: "oe0vm4" }],
    ["path", { d: "M13 6h8", key: "15sg57" }],
    ["path", { d: "M3 12h1", key: "lp3yf2" }],
    ["path", { d: "M3 18h1", key: "1eiwyy" }],
    ["path", { d: "M3 6h1", key: "rgxa97" }],
    ["path", { d: "M8 12h1", key: "1con00" }],
    ["path", { d: "M8 18h1", key: "13wk12" }],
    ["path", { d: "M8 6h1", key: "tn6mkg" }]
  ];
  const Logs = createLucideIcon("logs", __iconNode$bc);

  const __iconNode$bb = [
    ["path", { d: "m16 17 5-5-5-5", key: "1bji2h" }],
    ["path", { d: "M21 12H9", key: "dn1m92" }],
    ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", key: "1uf3rs" }]
  ];
  const LogOut = createLucideIcon("log-out", __iconNode$bb);

  const __iconNode$ba = [
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
    ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }],
    ["path", { d: "M11 11a2 2 0 0 0 4 0 4 4 0 0 0-8 0 6 6 0 0 0 12 0", key: "107gwy" }]
  ];
  const Lollipop = createLucideIcon("lollipop", __iconNode$ba);

  const __iconNode$b9 = [
    [
      "path",
      { d: "M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2", key: "1m57jg" }
    ],
    ["path", { d: "M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14", key: "1l99gc" }],
    ["path", { d: "M10 20h4", key: "ni2waw" }],
    ["circle", { cx: "16", cy: "20", r: "2", key: "1vifvg" }],
    ["circle", { cx: "8", cy: "20", r: "2", key: "ckkr5m" }]
  ];
  const Luggage = createLucideIcon("luggage", __iconNode$b9);

  const __iconNode$b8 = [
    [
      "path",
      {
        d: "m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15",
        key: "1i3lhw"
      }
    ],
    ["path", { d: "m5 8 4 4", key: "j6kj7e" }],
    ["path", { d: "m12 15 4 4", key: "lnac28" }]
  ];
  const Magnet = createLucideIcon("magnet", __iconNode$b8);

  const __iconNode$b7 = [
    ["path", { d: "M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8", key: "12jkf8" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }],
    ["path", { d: "m16 19 2 2 4-4", key: "1b14m6" }]
  ];
  const MailCheck = createLucideIcon("mail-check", __iconNode$b7);

  const __iconNode$b6 = [
    ["path", { d: "M22 15V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8", key: "fuxbkv" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }],
    ["path", { d: "M16 19h6", key: "xwg31i" }]
  ];
  const MailMinus = createLucideIcon("mail-minus", __iconNode$b6);

  const __iconNode$b5 = [
    [
      "path",
      {
        d: "M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z",
        key: "1jhwl8"
      }
    ],
    ["path", { d: "m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10", key: "1qfld7" }]
  ];
  const MailOpen = createLucideIcon("mail-open", __iconNode$b5);

  const __iconNode$b4 = [
    ["path", { d: "M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8", key: "12jkf8" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }],
    ["path", { d: "M19 16v6", key: "tddt3s" }],
    ["path", { d: "M16 19h6", key: "xwg31i" }]
  ];
  const MailPlus = createLucideIcon("mail-plus", __iconNode$b4);

  const __iconNode$b3 = [
    ["path", { d: "M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h12.5", key: "e61zoh" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }],
    [
      "path",
      {
        d: "M18 15.28c.2-.4.5-.8.9-1a2.1 2.1 0 0 1 2.6.4c.3.4.5.8.5 1.3 0 1.3-2 2-2 2",
        key: "7z9rxb"
      }
    ],
    ["path", { d: "M20 22v.01", key: "12bgn6" }]
  ];
  const MailQuestionMark = createLucideIcon("mail-question-mark", __iconNode$b3);

  const __iconNode$b2 = [
    ["path", { d: "M22 12.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h7.5", key: "w80f2v" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }],
    ["path", { d: "M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", key: "8lzu5m" }],
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }],
    ["path", { d: "m22 22-1.5-1.5", key: "1x83k4" }]
  ];
  const MailSearch = createLucideIcon("mail-search", __iconNode$b2);

  const __iconNode$b1 = [
    ["path", { d: "M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h12.5", key: "e61zoh" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }],
    ["path", { d: "M20 14v4", key: "1hm744" }],
    ["path", { d: "M20 22v.01", key: "12bgn6" }]
  ];
  const MailWarning = createLucideIcon("mail-warning", __iconNode$b1);

  const __iconNode$b0 = [
    ["path", { d: "M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9", key: "1j9vog" }],
    ["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }],
    ["path", { d: "m17 17 4 4", key: "1b3523" }],
    ["path", { d: "m21 17-4 4", key: "uinynz" }]
  ];
  const MailX = createLucideIcon("mail-x", __iconNode$b0);

  const __iconNode$a$ = [
    ["path", { d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7", key: "132q7q" }],
    ["rect", { x: "2", y: "4", width: "20", height: "16", rx: "2", key: "izxlao" }]
  ];
  const Mail = createLucideIcon("mail", __iconNode$a$);

  const __iconNode$a_ = [
    [
      "path",
      {
        d: "M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5C2 7 4 5 6.5 5H18c2.2 0 4 1.8 4 4v8Z",
        key: "1lbycx"
      }
    ],
    ["polyline", { points: "15,9 18,9 18,11", key: "1pm9c0" }],
    ["path", { d: "M6.5 5C9 5 11 7 11 9.5V17a2 2 0 0 1-2 2", key: "15i455" }],
    ["line", { x1: "6", x2: "7", y1: "10", y2: "10", key: "1e2scm" }]
  ];
  const Mailbox = createLucideIcon("mailbox", __iconNode$a_);

  const __iconNode$aZ = [
    ["rect", { width: "16", height: "13", x: "6", y: "4", rx: "2", key: "1drq3f" }],
    ["path", { d: "m22 7-7.1 3.78c-.57.3-1.23.3-1.8 0L6 7", key: "xn252p" }],
    ["path", { d: "M2 8v11c0 1.1.9 2 2 2h14", key: "n13cji" }]
  ];
  const Mails = createLucideIcon("mails", __iconNode$aZ);

  const __iconNode$aY = [
    [
      "path",
      {
        d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
        key: "1r0f0z"
      }
    ],
    ["path", { d: "m9 10 2 2 4-4", key: "1gnqz4" }]
  ];
  const MapPinCheckInside = createLucideIcon("map-pin-check-inside", __iconNode$aY);

  const __iconNode$aX = [
    [
      "path",
      {
        d: "M19.43 12.935c.357-.967.57-1.955.57-2.935a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32.197 32.197 0 0 0 .813-.728",
        key: "1dq61d"
      }
    ],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }],
    ["path", { d: "m16 18 2 2 4-4", key: "1mkfmb" }]
  ];
  const MapPinCheck = createLucideIcon("map-pin-check", __iconNode$aX);

  const __iconNode$aW = [
    [
      "path",
      {
        d: "M15 22a1 1 0 0 1-1-1v-4a1 1 0 0 1 .445-.832l3-2a1 1 0 0 1 1.11 0l3 2A1 1 0 0 1 22 17v4a1 1 0 0 1-1 1z",
        key: "1p1rcz"
      }
    ],
    [
      "path",
      {
        d: "M18 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 .601.2",
        key: "mcbcs9"
      }
    ],
    ["path", { d: "M18 22v-3", key: "1t1ugv" }],
    ["circle", { cx: "10", cy: "10", r: "3", key: "1ns7v1" }]
  ];
  const MapPinHouse = createLucideIcon("map-pin-house", __iconNode$aW);

  const __iconNode$aV = [
    [
      "path",
      {
        d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
        key: "1r0f0z"
      }
    ],
    ["path", { d: "M9 10h6", key: "9gxzsh" }]
  ];
  const MapPinMinusInside = createLucideIcon("map-pin-minus-inside", __iconNode$aV);

  const __iconNode$aU = [
    [
      "path",
      {
        d: "M18.977 14C19.6 12.701 20 11.343 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738",
        key: "11uxia"
      }
    ],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }],
    ["path", { d: "M16 18h6", key: "987eiv" }]
  ];
  const MapPinMinus = createLucideIcon("map-pin-minus", __iconNode$aU);

  const __iconNode$aT = [
    ["path", { d: "M12.75 7.09a3 3 0 0 1 2.16 2.16", key: "1d4wjd" }],
    [
      "path",
      {
        d: "M17.072 17.072c-1.634 2.17-3.527 3.912-4.471 4.727a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 1.432-4.568",
        key: "12yil7"
      }
    ],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M8.475 2.818A8 8 0 0 1 20 10c0 1.183-.31 2.377-.81 3.533", key: "lhrkcz" }],
    ["path", { d: "M9.13 9.13a3 3 0 0 0 3.74 3.74", key: "13wojd" }]
  ];
  const MapPinOff = createLucideIcon("map-pin-off", __iconNode$aT);

  const __iconNode$aS = [
    [
      "path",
      {
        d: "M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738",
        key: "fcdtly"
      }
    ],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }],
    ["path", { d: "M16 18h6", key: "987eiv" }],
    ["path", { d: "M19 15v6", key: "10aioa" }]
  ];
  const MapPinPlus = createLucideIcon("map-pin-plus", __iconNode$aS);

  const __iconNode$aR = [
    [
      "path",
      {
        d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
        key: "1r0f0z"
      }
    ],
    ["path", { d: "M12 7v6", key: "lw1j43" }],
    ["path", { d: "M9 10h6", key: "9gxzsh" }]
  ];
  const MapPinPlusInside = createLucideIcon("map-pin-plus-inside", __iconNode$aR);

  const __iconNode$aQ = [
    [
      "path",
      {
        d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
        key: "1r0f0z"
      }
    ],
    ["path", { d: "m14.5 7.5-5 5", key: "3lb6iw" }],
    ["path", { d: "m9.5 7.5 5 5", key: "ko136h" }]
  ];
  const MapPinXInside = createLucideIcon("map-pin-x-inside", __iconNode$aQ);

  const __iconNode$aP = [
    [
      "path",
      {
        d: "M19.752 11.901A7.78 7.78 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 19 19 0 0 0 .09-.077",
        key: "y0ewhp"
      }
    ],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }],
    ["path", { d: "m21.5 15.5-5 5", key: "11iqnx" }],
    ["path", { d: "m21.5 20.5-5-5", key: "1bylgx" }]
  ];
  const MapPinX = createLucideIcon("map-pin-x", __iconNode$aP);

  const __iconNode$aO = [
    [
      "path",
      {
        d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
        key: "1r0f0z"
      }
    ],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }]
  ];
  const MapPin = createLucideIcon("map-pin", __iconNode$aO);

  const __iconNode$aN = [
    [
      "path",
      {
        d: "M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0",
        key: "11u0oz"
      }
    ],
    ["circle", { cx: "12", cy: "8", r: "2", key: "1822b1" }],
    [
      "path",
      {
        d: "M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712",
        key: "q8zwxj"
      }
    ]
  ];
  const MapPinned = createLucideIcon("map-pinned", __iconNode$aN);

  const __iconNode$aM = [
    [
      "path",
      {
        d: "m11 19-1.106-.552a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0l4.212 2.106a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619V12",
        key: "svfegj"
      }
    ],
    ["path", { d: "M15 5.764V12", key: "1ocw4k" }],
    ["path", { d: "M18 15v6", key: "9wciyi" }],
    ["path", { d: "M21 18h-6", key: "139f0c" }],
    ["path", { d: "M9 3.236v15", key: "1uimfh" }]
  ];
  const MapPlus = createLucideIcon("map-plus", __iconNode$aM);

  const __iconNode$aL = [
    [
      "path",
      {
        d: "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",
        key: "169xi5"
      }
    ],
    ["path", { d: "M15 5.764v15", key: "1pn4in" }],
    ["path", { d: "M9 3.236v15", key: "1uimfh" }]
  ];
  const Map = createLucideIcon("map", __iconNode$aL);

  const __iconNode$aK = [
    ["path", { d: "m14 6 4 4", key: "1q72g9" }],
    ["path", { d: "M17 3h4v4", key: "19p9u1" }],
    ["path", { d: "m21 3-7.75 7.75", key: "1cjbfd" }],
    ["circle", { cx: "9", cy: "15", r: "6", key: "bx5svt" }]
  ];
  const MarsStroke = createLucideIcon("mars-stroke", __iconNode$aK);

  const __iconNode$aJ = [
    ["path", { d: "M16 3h5v5", key: "1806ms" }],
    ["path", { d: "m21 3-6.75 6.75", key: "pv0uzu" }],
    ["circle", { cx: "10", cy: "14", r: "6", key: "1qwbdc" }]
  ];
  const Mars = createLucideIcon("mars", __iconNode$aJ);

  const __iconNode$aI = [
    ["path", { d: "M8 22h8", key: "rmew8v" }],
    ["path", { d: "M12 11v11", key: "ur9y6a" }],
    ["path", { d: "m19 3-7 8-7-8Z", key: "1sgpiw" }]
  ];
  const Martini = createLucideIcon("martini", __iconNode$aI);

  const __iconNode$aH = [
    ["path", { d: "M8 3H5a2 2 0 0 0-2 2v3", key: "1dcmit" }],
    ["path", { d: "M21 8V5a2 2 0 0 0-2-2h-3", key: "1e4gt3" }],
    ["path", { d: "M3 16v3a2 2 0 0 0 2 2h3", key: "wsl5sc" }],
    ["path", { d: "M16 21h3a2 2 0 0 0 2-2v-3", key: "18trek" }]
  ];
  const Maximize = createLucideIcon("maximize", __iconNode$aH);

  const __iconNode$aG = [
    ["path", { d: "M15 3h6v6", key: "1q9fwt" }],
    ["path", { d: "m21 3-7 7", key: "1l2asr" }],
    ["path", { d: "m3 21 7-7", key: "tjx5ai" }],
    ["path", { d: "M9 21H3v-6", key: "wtvkvv" }]
  ];
  const Maximize2 = createLucideIcon("maximize-2", __iconNode$aG);

  const __iconNode$aF = [
    [
      "path",
      {
        d: "M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15",
        key: "143lza"
      }
    ],
    ["path", { d: "M11 12 5.12 2.2", key: "qhuxz6" }],
    ["path", { d: "m13 12 5.88-9.8", key: "hbye0f" }],
    ["path", { d: "M8 7h8", key: "i86dvs" }],
    ["circle", { cx: "12", cy: "17", r: "5", key: "qbz8iq" }],
    ["path", { d: "M12 18v-2h-.5", key: "fawc4q" }]
  ];
  const Medal = createLucideIcon("medal", __iconNode$aF);

  const __iconNode$aE = [
    ["path", { d: "M9.26 9.26 3 11v3l14.14 3.14", key: "3429n" }],
    ["path", { d: "M21 15.34V6l-7.31 2.03", key: "4o1dh8" }],
    ["path", { d: "M11.6 16.8a3 3 0 1 1-5.8-1.6", key: "1yl0tm" }],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const MegaphoneOff = createLucideIcon("megaphone-off", __iconNode$aE);

  const __iconNode$aD = [
    ["path", { d: "m3 11 18-5v12L3 14v-3z", key: "n962bs" }],
    ["path", { d: "M11.6 16.8a3 3 0 1 1-5.8-1.6", key: "1yl0tm" }]
  ];
  const Megaphone = createLucideIcon("megaphone", __iconNode$aD);

  const __iconNode$aC = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["line", { x1: "8", x2: "16", y1: "15", y2: "15", key: "1xb1d9" }],
    ["line", { x1: "9", x2: "9.01", y1: "9", y2: "9", key: "yxxnd0" }],
    ["line", { x1: "15", x2: "15.01", y1: "9", y2: "9", key: "1p4y9e" }]
  ];
  const Meh = createLucideIcon("meh", __iconNode$aC);

  const __iconNode$aB = [
    ["path", { d: "M4 12h16", key: "1lakjw" }],
    ["path", { d: "M4 18h16", key: "19g7jn" }],
    ["path", { d: "M4 6h16", key: "1o0s65" }]
  ];
  const Menu = createLucideIcon("menu", __iconNode$aB);

  const __iconNode$aA = [
    ["path", { d: "m8 6 4-4 4 4", key: "ybng9g" }],
    ["path", { d: "M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22", key: "1hyw0i" }],
    ["path", { d: "m20 22-5-5", key: "1m27yz" }]
  ];
  const Merge = createLucideIcon("merge", __iconNode$aA);

  const __iconNode$az = [
    ["path", { d: "M6 19v-3", key: "1nvgqn" }],
    ["path", { d: "M10 19v-3", key: "iu8nkm" }],
    ["path", { d: "M14 19v-3", key: "kcehxu" }],
    ["path", { d: "M18 19v-3", key: "1vh91z" }],
    ["path", { d: "M8 11V9", key: "63erz4" }],
    ["path", { d: "M16 11V9", key: "fru6f3" }],
    ["path", { d: "M12 11V9", key: "ha00sb" }],
    ["path", { d: "M2 15h20", key: "16ne18" }],
    [
      "path",
      {
        d: "M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1.1a2 2 0 0 0 0 3.837V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.1a2 2 0 0 0 0-3.837Z",
        key: "lhddv3"
      }
    ]
  ];
  const MemoryStick = createLucideIcon("memory-stick", __iconNode$az);

  const __iconNode$ay = [
    ["path", { d: "M10 9.5 8 12l2 2.5", key: "3mjy60" }],
    ["path", { d: "m14 9.5 2 2.5-2 2.5", key: "1bir2l" }],
    ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22z", key: "k85zhp" }]
  ];
  const MessageCircleCode = createLucideIcon("message-circle-code", __iconNode$ay);

  const __iconNode$ax = [
    ["path", { d: "M13.5 3.1c-.5 0-1-.1-1.5-.1s-1 .1-1.5.1", key: "16ll65" }],
    ["path", { d: "M19.3 6.8a10.45 10.45 0 0 0-2.1-2.1", key: "1nq77a" }],
    ["path", { d: "M20.9 13.5c.1-.5.1-1 .1-1.5s-.1-1-.1-1.5", key: "1sf7wn" }],
    ["path", { d: "M17.2 19.3a10.45 10.45 0 0 0 2.1-2.1", key: "x1hs5g" }],
    ["path", { d: "M10.5 20.9c.5.1 1 .1 1.5.1s1-.1 1.5-.1", key: "19m18z" }],
    ["path", { d: "M3.5 17.5 2 22l4.5-1.5", key: "1f36qi" }],
    ["path", { d: "M3.1 10.5c0 .5-.1 1-.1 1.5s.1 1 .1 1.5", key: "1vz3ju" }],
    ["path", { d: "M6.8 4.7a10.45 10.45 0 0 0-2.1 2.1", key: "19f9do" }]
  ];
  const MessageCircleDashed = createLucideIcon("message-circle-dashed", __iconNode$ax);

  const __iconNode$aw = [
    ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
    [
      "path",
      {
        d: "M15.8 9.2a2.5 2.5 0 0 0-3.5 0l-.3.4-.35-.3a2.42 2.42 0 1 0-3.2 3.6l3.6 3.5 3.6-3.5c1.2-1.2 1.1-2.7.2-3.7",
        key: "43lnbm"
      }
    ]
  ];
  const MessageCircleHeart = createLucideIcon("message-circle-heart", __iconNode$aw);

  const __iconNode$av = [
    ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
    ["path", { d: "M8 12h.01", key: "czm47f" }],
    ["path", { d: "M12 12h.01", key: "1mp3jc" }],
    ["path", { d: "M16 12h.01", key: "1l6xoz" }]
  ];
  const MessageCircleMore = createLucideIcon("message-circle-more", __iconNode$av);

  const __iconNode$au = [
    ["path", { d: "M20.5 14.9A9 9 0 0 0 9.1 3.5", key: "1iebmn" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M5.6 5.6C3 8.3 2.2 12.5 4 16l-2 6 6-2c3.4 1.8 7.6 1.1 10.3-1.7", key: "1ov8ce" }]
  ];
  const MessageCircleOff = createLucideIcon("message-circle-off", __iconNode$au);

  const __iconNode$at = [
    ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
    ["path", { d: "M12 8v8", key: "napkw2" }]
  ];
  const MessageCirclePlus = createLucideIcon("message-circle-plus", __iconNode$at);

  const __iconNode$as = [
    ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ];
  const MessageCircleQuestionMark = createLucideIcon("message-circle-question-mark", __iconNode$as);

  const __iconNode$ar = [
    ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
    ["path", { d: "m10 15-3-3 3-3", key: "1pgupc" }],
    ["path", { d: "M7 12h7a2 2 0 0 1 2 2v1", key: "1gheu4" }]
  ];
  const MessageCircleReply = createLucideIcon("message-circle-reply", __iconNode$ar);

  const __iconNode$aq = [
    ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
    ["path", { d: "M12 8v4", key: "1got3b" }],
    ["path", { d: "M12 16h.01", key: "1drbdi" }]
  ];
  const MessageCircleWarning = createLucideIcon("message-circle-warning", __iconNode$aq);

  const __iconNode$ap = [
    ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    ["path", { d: "m9 9 6 6", key: "z0biqf" }]
  ];
  const MessageCircleX = createLucideIcon("message-circle-x", __iconNode$ap);

  const __iconNode$ao = [
    ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }]
  ];
  const MessageCircle = createLucideIcon("message-circle", __iconNode$ao);

  const __iconNode$an = [
    ["path", { d: "M10 7.5 8 10l2 2.5", key: "xb17xw" }],
    ["path", { d: "m14 7.5 2 2.5-2 2.5", key: "5rap1v" }],
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }]
  ];
  const MessageSquareCode = createLucideIcon("message-square-code", __iconNode$an);

  const __iconNode$am = [
    ["path", { d: "M10 17H7l-4 4v-7", key: "1r71xu" }],
    ["path", { d: "M14 17h1", key: "nufu4t" }],
    ["path", { d: "M14 3h1", key: "1ec4yj" }],
    ["path", { d: "M19 3a2 2 0 0 1 2 2", key: "18rm91" }],
    ["path", { d: "M21 14v1a2 2 0 0 1-2 2", key: "29akq3" }],
    ["path", { d: "M21 9v1", key: "mxsmne" }],
    ["path", { d: "M3 9v1", key: "1r0deq" }],
    ["path", { d: "M5 3a2 2 0 0 0-2 2", key: "y57alp" }],
    ["path", { d: "M9 3h1", key: "1yesri" }]
  ];
  const MessageSquareDashed = createLucideIcon("message-square-dashed", __iconNode$am);

  const __iconNode$al = [
    ["path", { d: "m5 19-2 2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2", key: "1xuzuj" }],
    ["path", { d: "M9 10h6", key: "9gxzsh" }],
    ["path", { d: "M12 7v6", key: "lw1j43" }],
    ["path", { d: "M9 17h6", key: "r8uit2" }]
  ];
  const MessageSquareDiff = createLucideIcon("message-square-diff", __iconNode$al);

  const __iconNode$ak = [
    ["path", { d: "M11.7 3H5a2 2 0 0 0-2 2v16l4-4h12a2 2 0 0 0 2-2v-2.7", key: "uodpkb" }],
    ["circle", { cx: "18", cy: "6", r: "3", key: "1h7g24" }]
  ];
  const MessageSquareDot = createLucideIcon("message-square-dot", __iconNode$ak);

  const __iconNode$aj = [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }],
    [
      "path",
      {
        d: "M14.8 7.5a1.84 1.84 0 0 0-2.6 0l-.2.3-.3-.3a1.84 1.84 0 1 0-2.4 2.8L12 13l2.7-2.7c.9-.9.8-2.1.1-2.8",
        key: "1blaws"
      }
    ]
  ];
  const MessageSquareHeart = createLucideIcon("message-square-heart", __iconNode$aj);

  const __iconNode$ai = [
    ["path", { d: "M19 15v-2a2 2 0 1 0-4 0v2", key: "h3d1vz" }],
    ["path", { d: "M9 17H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3.5", key: "xsnnhn" }],
    ["rect", { x: "13", y: "15", width: "8", height: "5", rx: "1", key: "1ccwuk" }]
  ];
  const MessageSquareLock = createLucideIcon("message-square-lock", __iconNode$ai);

  const __iconNode$ah = [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }],
    ["path", { d: "M8 10h.01", key: "19clt8" }],
    ["path", { d: "M12 10h.01", key: "1nrarc" }],
    ["path", { d: "M16 10h.01", key: "1m94wz" }]
  ];
  const MessageSquareMore = createLucideIcon("message-square-more", __iconNode$ah);

  const __iconNode$ag = [
    ["path", { d: "M21 15V5a2 2 0 0 0-2-2H9", key: "43el77" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M3.6 3.6c-.4.3-.6.8-.6 1.4v16l4-4h10", key: "pwpm4a" }]
  ];
  const MessageSquareOff = createLucideIcon("message-square-off", __iconNode$ag);

  const __iconNode$af = [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }],
    ["path", { d: "M12 7v6", key: "lw1j43" }],
    ["path", { d: "M9 10h6", key: "9gxzsh" }]
  ];
  const MessageSquarePlus = createLucideIcon("message-square-plus", __iconNode$af);

  const __iconNode$ae = [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }],
    ["path", { d: "M8 12a2 2 0 0 0 2-2V8H8", key: "1jfesj" }],
    ["path", { d: "M14 12a2 2 0 0 0 2-2V8h-2", key: "1dq9mh" }]
  ];
  const MessageSquareQuote = createLucideIcon("message-square-quote", __iconNode$ae);

  const __iconNode$ad = [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }],
    ["path", { d: "m10 7-3 3 3 3", key: "1eugdv" }],
    ["path", { d: "M17 13v-1a2 2 0 0 0-2-2H7", key: "ernfh3" }]
  ];
  const MessageSquareReply = createLucideIcon("message-square-reply", __iconNode$ad);

  const __iconNode$ac = [
    ["path", { d: "M21 12v3a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h7", key: "tqtdkg" }],
    ["path", { d: "M16 3h5v5", key: "1806ms" }],
    ["path", { d: "m16 8 5-5", key: "15mbrl" }]
  ];
  const MessageSquareShare = createLucideIcon("message-square-share", __iconNode$ac);

  const __iconNode$ab = [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }],
    ["path", { d: "M13 8H7", key: "14i4kc" }],
    ["path", { d: "M17 12H7", key: "16if0g" }]
  ];
  const MessageSquareText = createLucideIcon("message-square-text", __iconNode$ab);

  const __iconNode$aa = [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }],
    ["path", { d: "M12 7v2", key: "stiyo7" }],
    ["path", { d: "M12 13h.01", key: "y0uutt" }]
  ];
  const MessageSquareWarning = createLucideIcon("message-square-warning", __iconNode$aa);

  const __iconNode$a9 = [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }],
    ["path", { d: "m14.5 7.5-5 5", key: "3lb6iw" }],
    ["path", { d: "m9.5 7.5 5 5", key: "ko136h" }]
  ];
  const MessageSquareX = createLucideIcon("message-square-x", __iconNode$a9);

  const __iconNode$a8 = [
    ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", key: "1lielz" }]
  ];
  const MessageSquare = createLucideIcon("message-square", __iconNode$a8);

  const __iconNode$a7 = [
    ["path", { d: "M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z", key: "p1xzt8" }],
    ["path", { d: "M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1", key: "1cx29u" }]
  ];
  const MessagesSquare = createLucideIcon("messages-square", __iconNode$a7);

  const __iconNode$a6 = [
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }],
    ["path", { d: "M18.89 13.23A7.12 7.12 0 0 0 19 12v-2", key: "80xlxr" }],
    ["path", { d: "M5 10v2a7 7 0 0 0 12 5", key: "p2k8kg" }],
    ["path", { d: "M15 9.34V5a3 3 0 0 0-5.68-1.33", key: "1gzdoj" }],
    ["path", { d: "M9 9v3a3 3 0 0 0 5.12 2.12", key: "r2i35w" }],
    ["line", { x1: "12", x2: "12", y1: "19", y2: "22", key: "x3vr5v" }]
  ];
  const MicOff = createLucideIcon("mic-off", __iconNode$a6);

  const __iconNode$a5 = [
    [
      "path",
      {
        d: "m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12",
        key: "80a601"
      }
    ],
    [
      "path",
      {
        d: "M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5",
        key: "j0ngtp"
      }
    ],
    ["circle", { cx: "16", cy: "7", r: "5", key: "d08jfb" }]
  ];
  const MicVocal = createLucideIcon("mic-vocal", __iconNode$a5);

  const __iconNode$a4 = [
    ["path", { d: "M12 19v3", key: "npa21l" }],
    ["path", { d: "M19 10v2a7 7 0 0 1-14 0v-2", key: "1vc78b" }],
    ["rect", { x: "9", y: "2", width: "6", height: "13", rx: "3", key: "s6n7sd" }]
  ];
  const Mic = createLucideIcon("mic", __iconNode$a4);

  const __iconNode$a3 = [
    ["path", { d: "M18 12h2", key: "quuxs7" }],
    ["path", { d: "M18 16h2", key: "zsn3lv" }],
    ["path", { d: "M18 20h2", key: "9x5y9y" }],
    ["path", { d: "M18 4h2", key: "1luxfb" }],
    ["path", { d: "M18 8h2", key: "nxqzg" }],
    ["path", { d: "M4 12h2", key: "1ltxp0" }],
    ["path", { d: "M4 16h2", key: "8a5zha" }],
    ["path", { d: "M4 20h2", key: "27dk57" }],
    ["path", { d: "M4 4h2", key: "10groj" }],
    ["path", { d: "M4 8h2", key: "18vq6w" }],
    [
      "path",
      {
        d: "M8 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-1.5c-.276 0-.494.227-.562.495a2 2 0 0 1-3.876 0C9.994 2.227 9.776 2 9.5 2z",
        key: "1681fp"
      }
    ]
  ];
  const Microchip = createLucideIcon("microchip", __iconNode$a3);

  const __iconNode$a2 = [
    ["path", { d: "M6 18h8", key: "1borvv" }],
    ["path", { d: "M3 22h18", key: "8prr45" }],
    ["path", { d: "M14 22a7 7 0 1 0 0-14h-1", key: "1jwaiy" }],
    ["path", { d: "M9 14h2", key: "197e7h" }],
    ["path", { d: "M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z", key: "1bmzmy" }],
    ["path", { d: "M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3", key: "1drr47" }]
  ];
  const Microscope = createLucideIcon("microscope", __iconNode$a2);

  const __iconNode$a1 = [
    ["rect", { width: "20", height: "15", x: "2", y: "4", rx: "2", key: "2no95f" }],
    ["rect", { width: "8", height: "7", x: "6", y: "8", rx: "1", key: "zh9wx" }],
    ["path", { d: "M18 8v7", key: "o5zi4n" }],
    ["path", { d: "M6 19v2", key: "1loha6" }],
    ["path", { d: "M18 19v2", key: "1dawf0" }]
  ];
  const Microwave = createLucideIcon("microwave", __iconNode$a1);

  const __iconNode$a0 = [
    ["path", { d: "M12 13v8", key: "1l5pq0" }],
    ["path", { d: "M12 3v3", key: "1n5kay" }],
    [
      "path",
      {
        d: "M4 6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h13a2 2 0 0 0 1.152-.365l3.424-2.317a1 1 0 0 0 0-1.635l-3.424-2.318A2 2 0 0 0 17 6z",
        key: "1btarq"
      }
    ]
  ];
  const Milestone = createLucideIcon("milestone", __iconNode$a0);

  const __iconNode$9$ = [
    ["path", { d: "M8 2h8", key: "1ssgc1" }],
    [
      "path",
      {
        d: "M9 2v1.343M15 2v2.789a4 4 0 0 0 .672 2.219l.656.984a4 4 0 0 1 .672 2.22v1.131M7.8 7.8l-.128.192A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3",
        key: "y0ejgx"
      }
    ],
    ["path", { d: "M7 15a6.47 6.47 0 0 1 5 0 6.472 6.472 0 0 0 3.435.435", key: "iaxqsy" }],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const MilkOff = createLucideIcon("milk-off", __iconNode$9$);

  const __iconNode$9_ = [
    ["path", { d: "M8 2h8", key: "1ssgc1" }],
    [
      "path",
      {
        d: "M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2",
        key: "qtp12x"
      }
    ],
    ["path", { d: "M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0", key: "ygeh44" }]
  ];
  const Milk = createLucideIcon("milk", __iconNode$9_);

  const __iconNode$9Z = [
    ["path", { d: "m14 10 7-7", key: "oa77jy" }],
    ["path", { d: "M20 10h-6V4", key: "mjg0md" }],
    ["path", { d: "m3 21 7-7", key: "tjx5ai" }],
    ["path", { d: "M4 14h6v6", key: "rmj7iw" }]
  ];
  const Minimize2 = createLucideIcon("minimize-2", __iconNode$9Z);

  const __iconNode$9Y = [
    ["path", { d: "M8 3v3a2 2 0 0 1-2 2H3", key: "hohbtr" }],
    ["path", { d: "M21 8h-3a2 2 0 0 1-2-2V3", key: "5jw1f3" }],
    ["path", { d: "M3 16h3a2 2 0 0 1 2 2v3", key: "198tvr" }],
    ["path", { d: "M16 21v-3a2 2 0 0 1 2-2h3", key: "ph8mxp" }]
  ];
  const Minimize = createLucideIcon("minimize", __iconNode$9Y);

  const __iconNode$9X = [["path", { d: "M5 12h14", key: "1ays0h" }]];
  const Minus = createLucideIcon("minus", __iconNode$9X);

  const __iconNode$9W = [
    ["path", { d: "m9 10 2 2 4-4", key: "1gnqz4" }],
    ["rect", { width: "20", height: "14", x: "2", y: "3", rx: "2", key: "48i651" }],
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }]
  ];
  const MonitorCheck = createLucideIcon("monitor-check", __iconNode$9W);

  const __iconNode$9V = [
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "m14.305 7.53.923-.382", key: "1mlnsw" }],
    ["path", { d: "m15.228 4.852-.923-.383", key: "82mpwg" }],
    ["path", { d: "m16.852 3.228-.383-.924", key: "ln4sir" }],
    ["path", { d: "m16.852 8.772-.383.923", key: "1dejw0" }],
    ["path", { d: "m19.148 3.228.383-.924", key: "192kgf" }],
    ["path", { d: "m19.53 9.696-.382-.924", key: "fiavlr" }],
    ["path", { d: "m20.772 4.852.924-.383", key: "1j8mgp" }],
    ["path", { d: "m20.772 7.148.924.383", key: "zix9be" }],
    ["path", { d: "M22 13v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7", key: "1tnzv8" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }],
    ["circle", { cx: "18", cy: "6", r: "3", key: "1h7g24" }]
  ];
  const MonitorCog = createLucideIcon("monitor-cog", __iconNode$9V);

  const __iconNode$9U = [
    ["circle", { cx: "19", cy: "6", r: "3", key: "108a5v" }],
    ["path", { d: "M22 12v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9", key: "1fet9y" }],
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }]
  ];
  const MonitorDot = createLucideIcon("monitor-dot", __iconNode$9U);

  const __iconNode$9T = [
    ["path", { d: "M12 13V7", key: "h0r20n" }],
    ["path", { d: "m15 10-3 3-3-3", key: "lzhmyn" }],
    ["rect", { width: "20", height: "14", x: "2", y: "3", rx: "2", key: "48i651" }],
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }]
  ];
  const MonitorDown = createLucideIcon("monitor-down", __iconNode$9T);

  const __iconNode$9S = [
    ["path", { d: "M17 17H4a2 2 0 0 1-2-2V5c0-1.5 1-2 1-2", key: "k0q8oc" }],
    ["path", { d: "M22 15V5a2 2 0 0 0-2-2H9", key: "cp1ac0" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }],
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const MonitorOff = createLucideIcon("monitor-off", __iconNode$9S);

  const __iconNode$9R = [
    ["path", { d: "M10 13V7", key: "1u13u9" }],
    ["path", { d: "M14 13V7", key: "1vj9om" }],
    ["rect", { width: "20", height: "14", x: "2", y: "3", rx: "2", key: "48i651" }],
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }]
  ];
  const MonitorPause = createLucideIcon("monitor-pause", __iconNode$9R);

  const __iconNode$9Q = [
    [
      "path",
      {
        d: "M10 7.75a.75.75 0 0 1 1.142-.638l3.664 2.249a.75.75 0 0 1 0 1.278l-3.664 2.25a.75.75 0 0 1-1.142-.64z",
        key: "1pctta"
      }
    ],
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }],
    ["rect", { x: "2", y: "3", width: "20", height: "14", rx: "2", key: "x3v2xh" }]
  ];
  const MonitorPlay = createLucideIcon("monitor-play", __iconNode$9Q);

  const __iconNode$9P = [
    ["path", { d: "M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8", key: "10dyio" }],
    ["path", { d: "M10 19v-3.96 3.15", key: "1irgej" }],
    ["path", { d: "M7 19h5", key: "qswx4l" }],
    ["rect", { width: "6", height: "10", x: "16", y: "12", rx: "2", key: "1egngj" }]
  ];
  const MonitorSmartphone = createLucideIcon("monitor-smartphone", __iconNode$9P);

  const __iconNode$9O = [
    ["path", { d: "M5.5 20H8", key: "1k40s5" }],
    ["path", { d: "M17 9h.01", key: "1j24nn" }],
    ["rect", { width: "10", height: "16", x: "12", y: "4", rx: "2", key: "ixliua" }],
    ["path", { d: "M8 6H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4", key: "1mp6e1" }],
    ["circle", { cx: "17", cy: "15", r: "1", key: "tqvash" }]
  ];
  const MonitorSpeaker = createLucideIcon("monitor-speaker", __iconNode$9O);

  const __iconNode$9N = [
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }],
    ["rect", { x: "2", y: "3", width: "20", height: "14", rx: "2", key: "x3v2xh" }],
    ["rect", { x: "9", y: "7", width: "6", height: "6", rx: "1", key: "5m2oou" }]
  ];
  const MonitorStop = createLucideIcon("monitor-stop", __iconNode$9N);

  const __iconNode$9M = [
    ["path", { d: "m9 10 3-3 3 3", key: "11gsxs" }],
    ["path", { d: "M12 13V7", key: "h0r20n" }],
    ["rect", { width: "20", height: "14", x: "2", y: "3", rx: "2", key: "48i651" }],
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }]
  ];
  const MonitorUp = createLucideIcon("monitor-up", __iconNode$9M);

  const __iconNode$9L = [
    ["path", { d: "m14.5 12.5-5-5", key: "1jahn5" }],
    ["path", { d: "m9.5 12.5 5-5", key: "1k2t7b" }],
    ["rect", { width: "20", height: "14", x: "2", y: "3", rx: "2", key: "48i651" }],
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }]
  ];
  const MonitorX = createLucideIcon("monitor-x", __iconNode$9L);

  const __iconNode$9K = [
    ["rect", { width: "20", height: "14", x: "2", y: "3", rx: "2", key: "48i651" }],
    ["line", { x1: "8", x2: "16", y1: "21", y2: "21", key: "1svkeh" }],
    ["line", { x1: "12", x2: "12", y1: "17", y2: "21", key: "vw1qmm" }]
  ];
  const Monitor = createLucideIcon("monitor", __iconNode$9K);

  const __iconNode$9J = [
    ["path", { d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9", key: "4ay0iu" }],
    ["path", { d: "M20 3v4", key: "1olli1" }],
    ["path", { d: "M22 5h-4", key: "1gvqau" }]
  ];
  const MoonStar = createLucideIcon("moon-star", __iconNode$9J);

  const __iconNode$9I = [
    ["path", { d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z", key: "a7tn18" }]
  ];
  const Moon = createLucideIcon("moon", __iconNode$9I);

  const __iconNode$9H = [
    ["path", { d: "m8 3 4 8 5-5 5 15H2L8 3z", key: "otkl63" }],
    [
      "path",
      { d: "M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19", key: "1pvmmp" }
    ]
  ];
  const MountainSnow = createLucideIcon("mountain-snow", __iconNode$9H);

  const __iconNode$9G = [["path", { d: "m8 3 4 8 5-5 5 15H2L8 3z", key: "otkl63" }]];
  const Mountain = createLucideIcon("mountain", __iconNode$9G);

  const __iconNode$9F = [
    ["path", { d: "M12 6v.343", key: "1gyhex" }],
    ["path", { d: "M18.218 18.218A7 7 0 0 1 5 15V9a7 7 0 0 1 .782-3.218", key: "ukzz01" }],
    ["path", { d: "M19 13.343V9A7 7 0 0 0 8.56 2.902", key: "104jy9" }],
    ["path", { d: "M22 22 2 2", key: "1r8tn9" }]
  ];
  const MouseOff = createLucideIcon("mouse-off", __iconNode$9F);

  const __iconNode$9E = [
    [
      "path",
      {
        d: "M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z",
        key: "edeuup"
      }
    ]
  ];
  const MousePointer2 = createLucideIcon("mouse-pointer-2", __iconNode$9E);

  const __iconNode$9D = [
    [
      "path",
      {
        d: "M2.034 2.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.944L8.204 7.545a1 1 0 0 0-.66.66l-1.066 3.443a.5.5 0 0 1-.944.033z",
        key: "11pp1i"
      }
    ],
    ["circle", { cx: "16", cy: "16", r: "6", key: "qoo3c4" }],
    ["path", { d: "m11.8 11.8 8.4 8.4", key: "oogvdj" }]
  ];
  const MousePointerBan = createLucideIcon("mouse-pointer-ban", __iconNode$9D);

  const __iconNode$9C = [
    ["path", { d: "M14 4.1 12 6", key: "ita8i4" }],
    ["path", { d: "m5.1 8-2.9-.8", key: "1go3kf" }],
    ["path", { d: "m6 12-1.9 2", key: "mnht97" }],
    ["path", { d: "M7.2 2.2 8 5.1", key: "1cfko1" }],
    [
      "path",
      {
        d: "M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z",
        key: "s0h3yz"
      }
    ]
  ];
  const MousePointerClick = createLucideIcon("mouse-pointer-click", __iconNode$9C);

  const __iconNode$9B = [
    ["path", { d: "M12.586 12.586 19 19", key: "ea5xo7" }],
    [
      "path",
      {
        d: "M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z",
        key: "277e5u"
      }
    ]
  ];
  const MousePointer = createLucideIcon("mouse-pointer", __iconNode$9B);

  const __iconNode$9A = [
    ["rect", { x: "5", y: "2", width: "14", height: "20", rx: "7", key: "11ol66" }],
    ["path", { d: "M12 6v4", key: "16clxf" }]
  ];
  const Mouse = createLucideIcon("mouse", __iconNode$9A);

  const __iconNode$9z = [
    ["path", { d: "M5 3v16h16", key: "1mqmf9" }],
    ["path", { d: "m5 19 6-6", key: "jh6hbb" }],
    ["path", { d: "m2 6 3-3 3 3", key: "tkyvxa" }],
    ["path", { d: "m18 16 3 3-3 3", key: "1d4glt" }]
  ];
  const Move3d = createLucideIcon("move-3d", __iconNode$9z);

  const __iconNode$9y = [
    ["path", { d: "M19 13v6h-6", key: "1hxl6d" }],
    ["path", { d: "M5 11V5h6", key: "12e2xe" }],
    ["path", { d: "m5 5 14 14", key: "11anup" }]
  ];
  const MoveDiagonal2 = createLucideIcon("move-diagonal-2", __iconNode$9y);

  const __iconNode$9x = [
    ["path", { d: "M11 19H5v-6", key: "8awifj" }],
    ["path", { d: "M13 5h6v6", key: "7voy1q" }],
    ["path", { d: "M19 5 5 19", key: "wwaj1z" }]
  ];
  const MoveDiagonal = createLucideIcon("move-diagonal", __iconNode$9x);

  const __iconNode$9w = [
    ["path", { d: "M11 19H5V13", key: "1akmht" }],
    ["path", { d: "M19 5L5 19", key: "72u4yj" }]
  ];
  const MoveDownLeft = createLucideIcon("move-down-left", __iconNode$9w);

  const __iconNode$9v = [
    ["path", { d: "M8 18L12 22L16 18", key: "cskvfv" }],
    ["path", { d: "M12 2V22", key: "r89rzk" }]
  ];
  const MoveDown = createLucideIcon("move-down", __iconNode$9v);

  const __iconNode$9u = [
    ["path", { d: "M19 13V19H13", key: "10vkzq" }],
    ["path", { d: "M5 5L19 19", key: "5zm2fv" }]
  ];
  const MoveDownRight = createLucideIcon("move-down-right", __iconNode$9u);

  const __iconNode$9t = [
    ["path", { d: "m18 8 4 4-4 4", key: "1ak13k" }],
    ["path", { d: "M2 12h20", key: "9i4pu4" }],
    ["path", { d: "m6 8-4 4 4 4", key: "15zrgr" }]
  ];
  const MoveHorizontal = createLucideIcon("move-horizontal", __iconNode$9t);

  const __iconNode$9s = [
    ["path", { d: "M6 8L2 12L6 16", key: "kyvwex" }],
    ["path", { d: "M2 12H22", key: "1m8cig" }]
  ];
  const MoveLeft = createLucideIcon("move-left", __iconNode$9s);

  const __iconNode$9r = [
    ["path", { d: "M18 8L22 12L18 16", key: "1r0oui" }],
    ["path", { d: "M2 12H22", key: "1m8cig" }]
  ];
  const MoveRight = createLucideIcon("move-right", __iconNode$9r);

  const __iconNode$9q = [
    ["path", { d: "M5 11V5H11", key: "3q78g9" }],
    ["path", { d: "M5 5L19 19", key: "5zm2fv" }]
  ];
  const MoveUpLeft = createLucideIcon("move-up-left", __iconNode$9q);

  const __iconNode$9p = [
    ["path", { d: "M13 5H19V11", key: "1n1gyv" }],
    ["path", { d: "M19 5L5 19", key: "72u4yj" }]
  ];
  const MoveUpRight = createLucideIcon("move-up-right", __iconNode$9p);

  const __iconNode$9o = [
    ["path", { d: "M8 6L12 2L16 6", key: "1yvkyx" }],
    ["path", { d: "M12 2V22", key: "r89rzk" }]
  ];
  const MoveUp = createLucideIcon("move-up", __iconNode$9o);

  const __iconNode$9n = [
    ["path", { d: "M12 2v20", key: "t6zp3m" }],
    ["path", { d: "m8 18 4 4 4-4", key: "bh5tu3" }],
    ["path", { d: "m8 6 4-4 4 4", key: "ybng9g" }]
  ];
  const MoveVertical = createLucideIcon("move-vertical", __iconNode$9n);

  const __iconNode$9m = [
    ["path", { d: "M12 2v20", key: "t6zp3m" }],
    ["path", { d: "m15 19-3 3-3-3", key: "11eu04" }],
    ["path", { d: "m19 9 3 3-3 3", key: "1mg7y2" }],
    ["path", { d: "M2 12h20", key: "9i4pu4" }],
    ["path", { d: "m5 9-3 3 3 3", key: "j64kie" }],
    ["path", { d: "m9 5 3-3 3 3", key: "l8vdw6" }]
  ];
  const Move = createLucideIcon("move", __iconNode$9m);

  const __iconNode$9l = [
    ["circle", { cx: "8", cy: "18", r: "4", key: "1fc0mg" }],
    ["path", { d: "M12 18V2l7 4", key: "g04rme" }]
  ];
  const Music2 = createLucideIcon("music-2", __iconNode$9l);

  const __iconNode$9k = [
    ["circle", { cx: "12", cy: "18", r: "4", key: "m3r9ws" }],
    ["path", { d: "M16 18V2", key: "40x2m5" }]
  ];
  const Music3 = createLucideIcon("music-3", __iconNode$9k);

  const __iconNode$9j = [
    ["path", { d: "M9 18V5l12-2v13", key: "1jmyc2" }],
    ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }],
    ["circle", { cx: "18", cy: "16", r: "3", key: "1hluhg" }]
  ];
  const Music = createLucideIcon("music", __iconNode$9j);

  const __iconNode$9i = [
    ["path", { d: "M9 18V5l12-2v13", key: "1jmyc2" }],
    ["path", { d: "m9 9 12-2", key: "1e64n2" }],
    ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }],
    ["circle", { cx: "18", cy: "16", r: "3", key: "1hluhg" }]
  ];
  const Music4 = createLucideIcon("music-4", __iconNode$9i);

  const __iconNode$9h = [
    ["path", { d: "M9.31 9.31 5 21l7-4 7 4-1.17-3.17", key: "qoq2o2" }],
    ["path", { d: "M14.53 8.88 12 2l-1.17 3.17", key: "k3sjzy" }],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const Navigation2Off = createLucideIcon("navigation-2-off", __iconNode$9h);

  const __iconNode$9g = [
    ["polygon", { points: "12 2 19 21 12 17 5 21 12 2", key: "x8c0qg" }]
  ];
  const Navigation2 = createLucideIcon("navigation-2", __iconNode$9g);

  const __iconNode$9f = [
    ["path", { d: "M8.43 8.43 3 11l8 2 2 8 2.57-5.43", key: "1vdtb7" }],
    ["path", { d: "M17.39 11.73 22 2l-9.73 4.61", key: "tya3r6" }],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const NavigationOff = createLucideIcon("navigation-off", __iconNode$9f);

  const __iconNode$9e = [
    ["polygon", { points: "3 11 22 2 13 21 11 13 3 11", key: "1ltx0t" }]
  ];
  const Navigation = createLucideIcon("navigation", __iconNode$9e);

  const __iconNode$9d = [
    ["rect", { x: "16", y: "16", width: "6", height: "6", rx: "1", key: "4q2zg0" }],
    ["rect", { x: "2", y: "16", width: "6", height: "6", rx: "1", key: "8cvhb9" }],
    ["rect", { x: "9", y: "2", width: "6", height: "6", rx: "1", key: "1egb70" }],
    ["path", { d: "M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3", key: "1jsf9p" }],
    ["path", { d: "M12 12V8", key: "2874zd" }]
  ];
  const Network = createLucideIcon("network", __iconNode$9d);

  const __iconNode$9c = [
    ["path", { d: "M15 18h-5", key: "95g1m2" }],
    ["path", { d: "M18 14h-8", key: "sponae" }],
    [
      "path",
      {
        d: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2",
        key: "39pd36"
      }
    ],
    ["rect", { width: "8", height: "4", x: "10", y: "6", rx: "1", key: "aywv1n" }]
  ];
  const Newspaper = createLucideIcon("newspaper", __iconNode$9c);

  const __iconNode$9b = [
    ["path", { d: "M6 8.32a7.43 7.43 0 0 1 0 7.36", key: "9iaqei" }],
    ["path", { d: "M9.46 6.21a11.76 11.76 0 0 1 0 11.58", key: "1yha7l" }],
    ["path", { d: "M12.91 4.1a15.91 15.91 0 0 1 .01 15.8", key: "4iu2gk" }],
    ["path", { d: "M16.37 2a20.16 20.16 0 0 1 0 20", key: "sap9u2" }]
  ];
  const Nfc = createLucideIcon("nfc", __iconNode$9b);

  const __iconNode$9a = [
    ["path", { d: "M12 2v10", key: "mnfbl" }],
    ["path", { d: "m8.5 4 7 4", key: "m1xjk3" }],
    ["path", { d: "m8.5 8 7-4", key: "t0m5j6" }],
    ["circle", { cx: "12", cy: "17", r: "5", key: "qbz8iq" }]
  ];
  const NonBinary = createLucideIcon("non-binary", __iconNode$9a);

  const __iconNode$99 = [
    ["path", { d: "M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4", key: "re6nr2" }],
    ["path", { d: "M2 6h4", key: "aawbzj" }],
    ["path", { d: "M2 10h4", key: "l0bgd4" }],
    ["path", { d: "M2 14h4", key: "1gsvsf" }],
    ["path", { d: "M2 18h4", key: "1bu2t1" }],
    [
      "path",
      {
        d: "M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
        key: "pqwjuv"
      }
    ]
  ];
  const NotebookPen = createLucideIcon("notebook-pen", __iconNode$99);

  const __iconNode$98 = [
    ["path", { d: "M2 6h4", key: "aawbzj" }],
    ["path", { d: "M2 10h4", key: "l0bgd4" }],
    ["path", { d: "M2 14h4", key: "1gsvsf" }],
    ["path", { d: "M2 18h4", key: "1bu2t1" }],
    ["rect", { width: "16", height: "20", x: "4", y: "2", rx: "2", key: "1nb95v" }],
    ["path", { d: "M15 2v20", key: "dcj49h" }],
    ["path", { d: "M15 7h5", key: "1xj5lc" }],
    ["path", { d: "M15 12h5", key: "w5shd9" }],
    ["path", { d: "M15 17h5", key: "1qaofu" }]
  ];
  const NotebookTabs = createLucideIcon("notebook-tabs", __iconNode$98);

  const __iconNode$97 = [
    ["path", { d: "M2 6h4", key: "aawbzj" }],
    ["path", { d: "M2 10h4", key: "l0bgd4" }],
    ["path", { d: "M2 14h4", key: "1gsvsf" }],
    ["path", { d: "M2 18h4", key: "1bu2t1" }],
    ["rect", { width: "16", height: "20", x: "4", y: "2", rx: "2", key: "1nb95v" }],
    ["path", { d: "M9.5 8h5", key: "11mslq" }],
    ["path", { d: "M9.5 12H16", key: "ktog6x" }],
    ["path", { d: "M9.5 16H14", key: "p1seyn" }]
  ];
  const NotebookText = createLucideIcon("notebook-text", __iconNode$97);

  const __iconNode$96 = [
    ["path", { d: "M2 6h4", key: "aawbzj" }],
    ["path", { d: "M2 10h4", key: "l0bgd4" }],
    ["path", { d: "M2 14h4", key: "1gsvsf" }],
    ["path", { d: "M2 18h4", key: "1bu2t1" }],
    ["rect", { width: "16", height: "20", x: "4", y: "2", rx: "2", key: "1nb95v" }],
    ["path", { d: "M16 2v20", key: "rotuqe" }]
  ];
  const Notebook = createLucideIcon("notebook", __iconNode$96);

  const __iconNode$95 = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M12 2v4", key: "3427ic" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["path", { d: "M16 4h2a2 2 0 0 1 2 2v2", key: "j91f56" }],
    ["path", { d: "M20 12v2", key: "w8o0tu" }],
    ["path", { d: "M20 18v2a2 2 0 0 1-2 2h-1", key: "1c9ggx" }],
    ["path", { d: "M13 22h-2", key: "191ugt" }],
    ["path", { d: "M7 22H6a2 2 0 0 1-2-2v-2", key: "1rt9px" }],
    ["path", { d: "M4 14v-2", key: "1v0sqh" }],
    ["path", { d: "M4 8V6a2 2 0 0 1 2-2h2", key: "1mwabg" }],
    ["path", { d: "M8 10h6", key: "3oa6kw" }],
    ["path", { d: "M8 14h8", key: "1fgep2" }],
    ["path", { d: "M8 18h5", key: "17enja" }]
  ];
  const NotepadTextDashed = createLucideIcon("notepad-text-dashed", __iconNode$95);

  const __iconNode$94 = [
    ["path", { d: "M12 4V2", key: "1k5q1u" }],
    [
      "path",
      {
        d: "M5 10v4a7.004 7.004 0 0 0 5.277 6.787c.412.104.802.292 1.102.592L12 22l.621-.621c.3-.3.69-.488 1.102-.592a7.01 7.01 0 0 0 4.125-2.939",
        key: "1xcvy9"
      }
    ],
    ["path", { d: "M19 10v3.343", key: "163tfc" }],
    [
      "path",
      {
        d: "M12 12c-1.349-.573-1.905-1.005-2.5-2-.546.902-1.048 1.353-2.5 2-1.018-.644-1.46-1.08-2-2-1.028.71-1.69.918-3 1 1.081-1.048 1.757-2.03 2-3 .194-.776.84-1.551 1.79-2.21m11.654 5.997c.887-.457 1.28-.891 1.556-1.787 1.032.916 1.683 1.157 3 1-1.297-1.036-1.758-2.03-2-3-.5-2-4-4-8-4-.74 0-1.461.068-2.15.192",
        key: "17914v"
      }
    ],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const NutOff = createLucideIcon("nut-off", __iconNode$94);

  const __iconNode$93 = [
    ["path", { d: "M12 4V2", key: "1k5q1u" }],
    [
      "path",
      {
        d: "M5 10v4a7.004 7.004 0 0 0 5.277 6.787c.412.104.802.292 1.102.592L12 22l.621-.621c.3-.3.69-.488 1.102-.592A7.003 7.003 0 0 0 19 14v-4",
        key: "1tgyif"
      }
    ],
    [
      "path",
      {
        d: "M12 4C8 4 4.5 6 4 8c-.243.97-.919 1.952-2 3 1.31-.082 1.972-.29 3-1 .54.92.982 1.356 2 2 1.452-.647 1.954-1.098 2.5-2 .595.995 1.151 1.427 2.5 2 1.31-.621 1.862-1.058 2.5-2 .629.977 1.162 1.423 2.5 2 1.209-.548 1.68-.967 2-2 1.032.916 1.683 1.157 3 1-1.297-1.036-1.758-2.03-2-3-.5-2-4-4-8-4Z",
        key: "tnsqj"
      }
    ]
  ];
  const Nut = createLucideIcon("nut", __iconNode$93);

  const __iconNode$92 = [
    ["path", { d: "M12 16h.01", key: "1drbdi" }],
    ["path", { d: "M12 8v4", key: "1got3b" }],
    [
      "path",
      {
        d: "M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z",
        key: "1fd625"
      }
    ]
  ];
  const OctagonAlert = createLucideIcon("octagon-alert", __iconNode$92);

  const __iconNode$91 = [
    ["path", { d: "M8 2v4", key: "1cmpym" }],
    ["path", { d: "M12 2v4", key: "3427ic" }],
    ["path", { d: "M16 2v4", key: "4m81vk" }],
    ["rect", { width: "16", height: "18", x: "4", y: "4", rx: "2", key: "1u9h20" }],
    ["path", { d: "M8 10h6", key: "3oa6kw" }],
    ["path", { d: "M8 14h8", key: "1fgep2" }],
    ["path", { d: "M8 18h5", key: "17enja" }]
  ];
  const NotepadText = createLucideIcon("notepad-text", __iconNode$91);

  const __iconNode$90 = [
    [
      "path",
      {
        d: "M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z",
        key: "2d38gg"
      }
    ],
    ["path", { d: "M8 12h8", key: "1wcyev" }]
  ];
  const OctagonMinus = createLucideIcon("octagon-minus", __iconNode$90);

  const __iconNode$8$ = [
    ["path", { d: "M10 15V9", key: "1lckn7" }],
    ["path", { d: "M14 15V9", key: "1muqhk" }],
    [
      "path",
      {
        d: "M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z",
        key: "2d38gg"
      }
    ]
  ];
  const OctagonPause = createLucideIcon("octagon-pause", __iconNode$8$);

  const __iconNode$8_ = [
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    [
      "path",
      {
        d: "M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z",
        key: "2d38gg"
      }
    ],
    ["path", { d: "m9 9 6 6", key: "z0biqf" }]
  ];
  const OctagonX = createLucideIcon("octagon-x", __iconNode$8_);

  const __iconNode$8Z = [
    [
      "path",
      {
        d: "M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z",
        key: "2d38gg"
      }
    ]
  ];
  const Octagon = createLucideIcon("octagon", __iconNode$8Z);

  const __iconNode$8Y = [
    [
      "path",
      {
        d: "M3 20h4.5a.5.5 0 0 0 .5-.5v-.282a.52.52 0 0 0-.247-.437 8 8 0 1 1 8.494-.001.52.52 0 0 0-.247.438v.282a.5.5 0 0 0 .5.5H21",
        key: "1x94xo"
      }
    ]
  ];
  const Omega = createLucideIcon("omega", __iconNode$8Y);

  const __iconNode$8X = [
    ["path", { d: "M3 3h6l6 18h6", key: "ph9rgk" }],
    ["path", { d: "M14 3h7", key: "16f0ms" }]
  ];
  const Option = createLucideIcon("option", __iconNode$8X);

  const __iconNode$8W = [
    ["path", { d: "M20.341 6.484A10 10 0 0 1 10.266 21.85", key: "1enhxb" }],
    ["path", { d: "M3.659 17.516A10 10 0 0 1 13.74 2.152", key: "1crzgf" }],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
    ["circle", { cx: "19", cy: "5", r: "2", key: "mhkx31" }],
    ["circle", { cx: "5", cy: "19", r: "2", key: "v8kfzx" }]
  ];
  const Orbit = createLucideIcon("orbit", __iconNode$8W);

  const __iconNode$8V = [
    ["path", { d: "M12 12V4a1 1 0 0 1 1-1h6.297a1 1 0 0 1 .651 1.759l-4.696 4.025", key: "1bx4vc" }],
    [
      "path",
      {
        d: "m12 21-7.414-7.414A2 2 0 0 1 4 12.172V6.415a1.002 1.002 0 0 1 1.707-.707L20 20.009",
        key: "1h3km6"
      }
    ],
    [
      "path",
      {
        d: "m12.214 3.381 8.414 14.966a1 1 0 0 1-.167 1.199l-1.168 1.163a1 1 0 0 1-.706.291H6.351a1 1 0 0 1-.625-.219L3.25 18.8a1 1 0 0 1 .631-1.781l4.165.027",
        key: "1hj4wg"
      }
    ]
  ];
  const Origami = createLucideIcon("origami", __iconNode$8V);

  const __iconNode$8U = [
    ["path", { d: "M12 3v6", key: "1holv5" }],
    [
      "path",
      {
        d: "M16.76 3a2 2 0 0 1 1.8 1.1l2.23 4.479a2 2 0 0 1 .21.891V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.472a2 2 0 0 1 .211-.894L5.45 4.1A2 2 0 0 1 7.24 3z",
        key: "187q7i"
      }
    ],
    ["path", { d: "M3.054 9.013h17.893", key: "grwhos" }]
  ];
  const Package2 = createLucideIcon("package-2", __iconNode$8U);

  const __iconNode$8T = [
    ["path", { d: "m16 16 2 2 4-4", key: "gfu2re" }],
    [
      "path",
      {
        d: "M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14",
        key: "e7tb2h"
      }
    ],
    ["path", { d: "m7.5 4.27 9 5.15", key: "1c824w" }],
    ["polyline", { points: "3.29 7 12 12 20.71 7", key: "ousv84" }],
    ["line", { x1: "12", x2: "12", y1: "22", y2: "12", key: "a4e8g8" }]
  ];
  const PackageCheck = createLucideIcon("package-check", __iconNode$8T);

  const __iconNode$8S = [
    ["path", { d: "M16 16h6", key: "100bgy" }],
    [
      "path",
      {
        d: "M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14",
        key: "e7tb2h"
      }
    ],
    ["path", { d: "m7.5 4.27 9 5.15", key: "1c824w" }],
    ["polyline", { points: "3.29 7 12 12 20.71 7", key: "ousv84" }],
    ["line", { x1: "12", x2: "12", y1: "22", y2: "12", key: "a4e8g8" }]
  ];
  const PackageMinus = createLucideIcon("package-minus", __iconNode$8S);

  const __iconNode$8R = [
    ["path", { d: "M12 22v-9", key: "x3hkom" }],
    [
      "path",
      {
        d: "M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z",
        key: "2ntwy6"
      }
    ],
    [
      "path",
      {
        d: "M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13",
        key: "1pmm1c"
      }
    ],
    [
      "path",
      {
        d: "M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z",
        key: "12ttoo"
      }
    ]
  ];
  const PackageOpen = createLucideIcon("package-open", __iconNode$8R);

  const __iconNode$8Q = [
    ["path", { d: "M16 16h6", key: "100bgy" }],
    ["path", { d: "M19 13v6", key: "85cyf1" }],
    [
      "path",
      {
        d: "M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14",
        key: "e7tb2h"
      }
    ],
    ["path", { d: "m7.5 4.27 9 5.15", key: "1c824w" }],
    ["polyline", { points: "3.29 7 12 12 20.71 7", key: "ousv84" }],
    ["line", { x1: "12", x2: "12", y1: "22", y2: "12", key: "a4e8g8" }]
  ];
  const PackagePlus = createLucideIcon("package-plus", __iconNode$8Q);

  const __iconNode$8P = [
    [
      "path",
      {
        d: "M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14",
        key: "e7tb2h"
      }
    ],
    ["path", { d: "m7.5 4.27 9 5.15", key: "1c824w" }],
    ["polyline", { points: "3.29 7 12 12 20.71 7", key: "ousv84" }],
    ["line", { x1: "12", x2: "12", y1: "22", y2: "12", key: "a4e8g8" }],
    ["circle", { cx: "18.5", cy: "15.5", r: "2.5", key: "b5zd12" }],
    ["path", { d: "M20.27 17.27 22 19", key: "1l4muz" }]
  ];
  const PackageSearch = createLucideIcon("package-search", __iconNode$8P);

  const __iconNode$8O = [
    [
      "path",
      {
        d: "M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14",
        key: "e7tb2h"
      }
    ],
    ["path", { d: "m7.5 4.27 9 5.15", key: "1c824w" }],
    ["polyline", { points: "3.29 7 12 12 20.71 7", key: "ousv84" }],
    ["line", { x1: "12", x2: "12", y1: "22", y2: "12", key: "a4e8g8" }],
    ["path", { d: "m17 13 5 5m-5 0 5-5", key: "im3w4b" }]
  ];
  const PackageX = createLucideIcon("package-x", __iconNode$8O);

  const __iconNode$8N = [
    [
      "path",
      {
        d: "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",
        key: "1a0edw"
      }
    ],
    ["path", { d: "M12 22V12", key: "d0xqtd" }],
    ["polyline", { points: "3.29 7 12 12 20.71 7", key: "ousv84" }],
    ["path", { d: "m7.5 4.27 9 5.15", key: "1c824w" }]
  ];
  const Package = createLucideIcon("package", __iconNode$8N);

  const __iconNode$8M = [
    [
      "path",
      { d: "m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z", key: "irua1i" }
    ],
    ["path", { d: "m5 2 5 5", key: "1lls2c" }],
    ["path", { d: "M2 13h15", key: "1hkzvu" }],
    ["path", { d: "M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z", key: "xk76lq" }]
  ];
  const PaintBucket = createLucideIcon("paint-bucket", __iconNode$8M);

  const __iconNode$8L = [
    ["rect", { width: "16", height: "6", x: "2", y: "2", rx: "2", key: "jcyz7m" }],
    ["path", { d: "M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2", key: "1b9h7c" }],
    ["rect", { width: "4", height: "6", x: "8", y: "16", rx: "1", key: "d6e7yl" }]
  ];
  const PaintRoller = createLucideIcon("paint-roller", __iconNode$8L);

  const __iconNode$8K = [
    ["path", { d: "M10 2v2", key: "7u0qdc" }],
    ["path", { d: "M14 2v4", key: "qmzblu" }],
    ["path", { d: "M17 2a1 1 0 0 1 1 1v9H6V3a1 1 0 0 1 1-1z", key: "ycvu00" }],
    [
      "path",
      {
        d: "M6 12a1 1 0 0 0-1 1v1a2 2 0 0 0 2 2h2a1 1 0 0 1 1 1v2.9a2 2 0 1 0 4 0V17a1 1 0 0 1 1-1h2a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1",
        key: "iw4wnp"
      }
    ]
  ];
  const PaintbrushVertical = createLucideIcon("paintbrush-vertical", __iconNode$8K);

  const __iconNode$8J = [
    ["path", { d: "m14.622 17.897-10.68-2.913", key: "vj2p1u" }],
    [
      "path",
      {
        d: "M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z",
        key: "18tc5c"
      }
    ],
    [
      "path",
      {
        d: "M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15",
        key: "ytzfxy"
      }
    ]
  ];
  const Paintbrush = createLucideIcon("paintbrush", __iconNode$8J);

  const __iconNode$8I = [
    [
      "path",
      {
        d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
        key: "e79jfc"
      }
    ],
    ["circle", { cx: "13.5", cy: "6.5", r: ".5", fill: "currentColor", key: "1okk4w" }],
    ["circle", { cx: "17.5", cy: "10.5", r: ".5", fill: "currentColor", key: "f64h9f" }],
    ["circle", { cx: "6.5", cy: "12.5", r: ".5", fill: "currentColor", key: "qy21gx" }],
    ["circle", { cx: "8.5", cy: "7.5", r: ".5", fill: "currentColor", key: "fotxhn" }]
  ];
  const Palette = createLucideIcon("palette", __iconNode$8I);

  const __iconNode$8H = [
    ["path", { d: "M11.25 17.25h1.5L12 18z", key: "1wmwwj" }],
    ["path", { d: "m15 12 2 2", key: "k60wz4" }],
    ["path", { d: "M18 6.5a.5.5 0 0 0-.5-.5", key: "1ch4h4" }],
    [
      "path",
      {
        d: "M20.69 9.67a4.5 4.5 0 1 0-7.04-5.5 8.35 8.35 0 0 0-3.3 0 4.5 4.5 0 1 0-7.04 5.5C2.49 11.2 2 12.88 2 14.5 2 19.47 6.48 22 12 22s10-2.53 10-7.5c0-1.62-.48-3.3-1.3-4.83",
        key: "1c660l"
      }
    ],
    ["path", { d: "M6 6.5a.495.495 0 0 1 .5-.5", key: "eviuep" }],
    ["path", { d: "m9 12-2 2", key: "326nkw" }]
  ];
  const Panda = createLucideIcon("panda", __iconNode$8H);

  const __iconNode$8G = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 15h18", key: "5xshup" }],
    ["path", { d: "m15 8-3 3-3-3", key: "1oxy1z" }]
  ];
  const PanelBottomClose = createLucideIcon("panel-bottom-close", __iconNode$8G);

  const __iconNode$8F = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M14 15h1", key: "171nev" }],
    ["path", { d: "M19 15h2", key: "1vnucp" }],
    ["path", { d: "M3 15h2", key: "8bym0q" }],
    ["path", { d: "M9 15h1", key: "1tg3ks" }]
  ];
  const PanelBottomDashed = createLucideIcon("panel-bottom-dashed", __iconNode$8F);

  const __iconNode$8E = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 15h18", key: "5xshup" }],
    ["path", { d: "m9 10 3-3 3 3", key: "11gsxs" }]
  ];
  const PanelBottomOpen = createLucideIcon("panel-bottom-open", __iconNode$8E);

  const __iconNode$8D = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 15h18", key: "5xshup" }]
  ];
  const PanelBottom = createLucideIcon("panel-bottom", __iconNode$8D);

  const __iconNode$8C = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
    ["path", { d: "m16 15-3-3 3-3", key: "14y99z" }]
  ];
  const PanelLeftClose = createLucideIcon("panel-left-close", __iconNode$8C);

  const __iconNode$8B = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
    ["path", { d: "m14 9 3 3-3 3", key: "8010ee" }]
  ];
  const PanelLeftOpen = createLucideIcon("panel-left-open", __iconNode$8B);

  const __iconNode$8A = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M9 14v1", key: "askpd8" }],
    ["path", { d: "M9 19v2", key: "16tejx" }],
    ["path", { d: "M9 3v2", key: "1noubl" }],
    ["path", { d: "M9 9v1", key: "19ebxg" }]
  ];
  const PanelLeftDashed = createLucideIcon("panel-left-dashed", __iconNode$8A);

  const __iconNode$8z = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }]
  ];
  const PanelLeft = createLucideIcon("panel-left", __iconNode$8z);

  const __iconNode$8y = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M15 3v18", key: "14nvp0" }],
    ["path", { d: "m8 9 3 3-3 3", key: "12hl5m" }]
  ];
  const PanelRightClose = createLucideIcon("panel-right-close", __iconNode$8y);

  const __iconNode$8x = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M15 14v1", key: "ilsfch" }],
    ["path", { d: "M15 19v2", key: "1fst2f" }],
    ["path", { d: "M15 3v2", key: "z204g4" }],
    ["path", { d: "M15 9v1", key: "z2a8b1" }]
  ];
  const PanelRightDashed = createLucideIcon("panel-right-dashed", __iconNode$8x);

  const __iconNode$8w = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M15 3v18", key: "14nvp0" }],
    ["path", { d: "m10 15-3-3 3-3", key: "1pgupc" }]
  ];
  const PanelRightOpen = createLucideIcon("panel-right-open", __iconNode$8w);

  const __iconNode$8v = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M15 3v18", key: "14nvp0" }]
  ];
  const PanelRight = createLucideIcon("panel-right", __iconNode$8v);

  const __iconNode$8u = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["path", { d: "m9 16 3-3 3 3", key: "1idcnm" }]
  ];
  const PanelTopClose = createLucideIcon("panel-top-close", __iconNode$8u);

  const __iconNode$8t = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M14 9h1", key: "l0svgy" }],
    ["path", { d: "M19 9h2", key: "te2zfg" }],
    ["path", { d: "M3 9h2", key: "1h4ldw" }],
    ["path", { d: "M9 9h1", key: "15jzuz" }]
  ];
  const PanelTopDashed = createLucideIcon("panel-top-dashed", __iconNode$8t);

  const __iconNode$8s = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["path", { d: "m15 14-3 3-3-3", key: "g215vf" }]
  ];
  const PanelTopOpen = createLucideIcon("panel-top-open", __iconNode$8s);

  const __iconNode$8r = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9h18", key: "1pudct" }]
  ];
  const PanelTop = createLucideIcon("panel-top", __iconNode$8r);

  const __iconNode$8q = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 15h12", key: "1wkqb3" }],
    ["path", { d: "M15 3v18", key: "14nvp0" }]
  ];
  const PanelsRightBottom = createLucideIcon("panels-right-bottom", __iconNode$8q);

  const __iconNode$8p = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
    ["path", { d: "M9 15h12", key: "5ijen5" }]
  ];
  const PanelsLeftBottom = createLucideIcon("panels-left-bottom", __iconNode$8p);

  const __iconNode$8o = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["path", { d: "M9 21V9", key: "1oto5p" }]
  ];
  const PanelsTopLeft = createLucideIcon("panels-top-left", __iconNode$8o);

  const __iconNode$8n = [
    [
      "path",
      {
        d: "m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551",
        key: "1miecu"
      }
    ]
  ];
  const Paperclip = createLucideIcon("paperclip", __iconNode$8n);

  const __iconNode$8m = [
    ["path", { d: "M8 21s-4-3-4-9 4-9 4-9", key: "uto9ud" }],
    ["path", { d: "M16 3s4 3 4 9-4 9-4 9", key: "4w2vsq" }]
  ];
  const Parentheses = createLucideIcon("parentheses", __iconNode$8m);

  const __iconNode$8l = [
    ["path", { d: "M11 15h2", key: "199qp6" }],
    ["path", { d: "M12 12v3", key: "158kv8" }],
    ["path", { d: "M12 19v3", key: "npa21l" }],
    [
      "path",
      {
        d: "M15.282 19a1 1 0 0 0 .948-.68l2.37-6.988a7 7 0 1 0-13.2 0l2.37 6.988a1 1 0 0 0 .948.68z",
        key: "1jofit"
      }
    ],
    ["path", { d: "M9 9a3 3 0 1 1 6 0", key: "jdoeu8" }]
  ];
  const ParkingMeter = createLucideIcon("parking-meter", __iconNode$8l);

  const __iconNode$8k = [
    ["path", { d: "M5.8 11.3 2 22l10.7-3.79", key: "gwxi1d" }],
    ["path", { d: "M4 3h.01", key: "1vcuye" }],
    ["path", { d: "M22 8h.01", key: "1mrtc2" }],
    ["path", { d: "M15 2h.01", key: "1cjtqr" }],
    ["path", { d: "M22 20h.01", key: "1mrys2" }],
    [
      "path",
      {
        d: "m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10",
        key: "hbicv8"
      }
    ],
    [
      "path",
      { d: "m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17", key: "1i94pl" }
    ],
    ["path", { d: "m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7", key: "1cofks" }],
    [
      "path",
      {
        d: "M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z",
        key: "4kbmks"
      }
    ]
  ];
  const PartyPopper = createLucideIcon("party-popper", __iconNode$8k);

  const __iconNode$8j = [
    ["rect", { x: "14", y: "4", width: "4", height: "16", rx: "1", key: "zuxfzm" }],
    ["rect", { x: "6", y: "4", width: "4", height: "16", rx: "1", key: "1okwgv" }]
  ];
  const Pause = createLucideIcon("pause", __iconNode$8j);

  const __iconNode$8i = [
    ["circle", { cx: "11", cy: "4", r: "2", key: "vol9p0" }],
    ["circle", { cx: "18", cy: "8", r: "2", key: "17gozi" }],
    ["circle", { cx: "20", cy: "16", r: "2", key: "1v9bxh" }],
    [
      "path",
      {
        d: "M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z",
        key: "1ydw1z"
      }
    ]
  ];
  const PawPrint = createLucideIcon("paw-print", __iconNode$8i);

  const __iconNode$8h = [
    ["rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", key: "1uq1d7" }],
    ["path", { d: "M15 14h.01", key: "1kp3bh" }],
    ["path", { d: "M9 6h6", key: "dgm16u" }],
    ["path", { d: "M9 10h6", key: "9gxzsh" }]
  ];
  const PcCase = createLucideIcon("pc-case", __iconNode$8h);

  const __iconNode$8g = [
    ["path", { d: "M12 20h9", key: "t2du7b" }],
    [
      "path",
      {
        d: "M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",
        key: "1ykcvy"
      }
    ]
  ];
  const PenLine = createLucideIcon("pen-line", __iconNode$8g);

  const __iconNode$8f = [
    [
      "path",
      {
        d: "m10 10-6.157 6.162a2 2 0 0 0-.5.833l-1.322 4.36a.5.5 0 0 0 .622.624l4.358-1.323a2 2 0 0 0 .83-.5L14 13.982",
        key: "bjo8r8"
      }
    ],
    ["path", { d: "m12.829 7.172 4.359-4.346a1 1 0 1 1 3.986 3.986l-4.353 4.353", key: "16h5ne" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const PenOff = createLucideIcon("pen-off", __iconNode$8f);

  const __iconNode$8e = [
    [
      "path",
      {
        d: "M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z",
        key: "nt11vn"
      }
    ],
    [
      "path",
      {
        d: "m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18",
        key: "15qc1e"
      }
    ],
    ["path", { d: "m2.3 2.3 7.286 7.286", key: "1wuzzi" }],
    ["circle", { cx: "11", cy: "11", r: "2", key: "xmgehs" }]
  ];
  const PenTool = createLucideIcon("pen-tool", __iconNode$8e);

  const __iconNode$8d = [
    [
      "path",
      {
        d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
        key: "1a8usu"
      }
    ]
  ];
  const Pen = createLucideIcon("pen", __iconNode$8d);

  const __iconNode$8c = [
    ["path", { d: "M12 20h9", key: "t2du7b" }],
    [
      "path",
      {
        d: "M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",
        key: "1ykcvy"
      }
    ],
    ["path", { d: "m15 5 3 3", key: "1w25hb" }]
  ];
  const PencilLine = createLucideIcon("pencil-line", __iconNode$8c);

  const __iconNode$8b = [
    [
      "path",
      {
        d: "m10 10-6.157 6.162a2 2 0 0 0-.5.833l-1.322 4.36a.5.5 0 0 0 .622.624l4.358-1.323a2 2 0 0 0 .83-.5L14 13.982",
        key: "bjo8r8"
      }
    ],
    ["path", { d: "m12.829 7.172 4.359-4.346a1 1 0 1 1 3.986 3.986l-4.353 4.353", key: "16h5ne" }],
    ["path", { d: "m15 5 4 4", key: "1mk7zo" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const PencilOff = createLucideIcon("pencil-off", __iconNode$8b);

  const __iconNode$8a = [
    [
      "path",
      { d: "M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13", key: "orapub" }
    ],
    ["path", { d: "m8 6 2-2", key: "115y1s" }],
    ["path", { d: "m18 16 2-2", key: "ee94s4" }],
    [
      "path",
      {
        d: "m17 11 4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17",
        key: "cfq27r"
      }
    ],
    [
      "path",
      {
        d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
        key: "1a8usu"
      }
    ],
    ["path", { d: "m15 5 4 4", key: "1mk7zo" }]
  ];
  const PencilRuler = createLucideIcon("pencil-ruler", __iconNode$8a);

  const __iconNode$89 = [
    [
      "path",
      {
        d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
        key: "1a8usu"
      }
    ],
    ["path", { d: "m15 5 4 4", key: "1mk7zo" }]
  ];
  const Pencil = createLucideIcon("pencil", __iconNode$89);

  const __iconNode$88 = [
    [
      "path",
      {
        d: "M10.83 2.38a2 2 0 0 1 2.34 0l8 5.74a2 2 0 0 1 .73 2.25l-3.04 9.26a2 2 0 0 1-1.9 1.37H7.04a2 2 0 0 1-1.9-1.37L2.1 10.37a2 2 0 0 1 .73-2.25z",
        key: "2hea0t"
      }
    ]
  ];
  const Pentagon = createLucideIcon("pentagon", __iconNode$88);

  const __iconNode$87 = [
    ["line", { x1: "19", x2: "5", y1: "5", y2: "19", key: "1x9vlm" }],
    ["circle", { cx: "6.5", cy: "6.5", r: "2.5", key: "4mh3h7" }],
    ["circle", { cx: "17.5", cy: "17.5", r: "2.5", key: "1mdrzq" }]
  ];
  const Percent = createLucideIcon("percent", __iconNode$87);

  const __iconNode$86 = [
    ["circle", { cx: "12", cy: "5", r: "1", key: "gxeob9" }],
    ["path", { d: "m9 20 3-6 3 6", key: "se2kox" }],
    ["path", { d: "m6 8 6 2 6-2", key: "4o3us4" }],
    ["path", { d: "M12 10v4", key: "1kjpxc" }]
  ];
  const PersonStanding = createLucideIcon("person-standing", __iconNode$86);

  const __iconNode$85 = [
    ["path", { d: "M13 2a9 9 0 0 1 9 9", key: "1itnx2" }],
    ["path", { d: "M13 6a5 5 0 0 1 5 5", key: "11nki7" }],
    [
      "path",
      {
        d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",
        key: "9njp5v"
      }
    ]
  ];
  const PhoneCall = createLucideIcon("phone-call", __iconNode$85);

  const __iconNode$84 = [
    ["path", { d: "M20 11H4", key: "6ut86h" }],
    ["path", { d: "M20 7H4", key: "zbl0bi" }],
    ["path", { d: "M7 21V4a1 1 0 0 1 1-1h4a1 1 0 0 1 0 12H7", key: "1ana5r" }]
  ];
  const PhilippinePeso = createLucideIcon("philippine-peso", __iconNode$84);

  const __iconNode$83 = [
    ["path", { d: "M14 6h8", key: "yd68k4" }],
    ["path", { d: "m18 2 4 4-4 4", key: "pucp1d" }],
    [
      "path",
      {
        d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",
        key: "9njp5v"
      }
    ]
  ];
  const PhoneForwarded = createLucideIcon("phone-forwarded", __iconNode$83);

  const __iconNode$82 = [
    ["path", { d: "M16 2v6h6", key: "1mfrl5" }],
    ["path", { d: "m22 2-6 6", key: "6f0sa0" }],
    [
      "path",
      {
        d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",
        key: "9njp5v"
      }
    ]
  ];
  const PhoneIncoming = createLucideIcon("phone-incoming", __iconNode$82);

  const __iconNode$81 = [
    ["path", { d: "m16 2 6 6", key: "1gw87d" }],
    ["path", { d: "m22 2-6 6", key: "6f0sa0" }],
    [
      "path",
      {
        d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",
        key: "9njp5v"
      }
    ]
  ];
  const PhoneMissed = createLucideIcon("phone-missed", __iconNode$81);

  const __iconNode$80 = [
    [
      "path",
      {
        d: "M10.1 13.9a14 14 0 0 0 3.732 2.668 1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2 18 18 0 0 1-12.728-5.272",
        key: "1wngk7"
      }
    ],
    ["path", { d: "M22 2 2 22", key: "y4kqgn" }],
    [
      "path",
      {
        d: "M4.76 13.582A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 .244.473",
        key: "10hv5p"
      }
    ]
  ];
  const PhoneOff = createLucideIcon("phone-off", __iconNode$80);

  const __iconNode$7$ = [
    ["path", { d: "m16 8 6-6", key: "oawc05" }],
    ["path", { d: "M22 8V2h-6", key: "oqy2zc" }],
    [
      "path",
      {
        d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",
        key: "9njp5v"
      }
    ]
  ];
  const PhoneOutgoing = createLucideIcon("phone-outgoing", __iconNode$7$);

  const __iconNode$7_ = [
    [
      "path",
      {
        d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",
        key: "9njp5v"
      }
    ]
  ];
  const Phone = createLucideIcon("phone", __iconNode$7_);

  const __iconNode$7Z = [
    ["line", { x1: "9", x2: "9", y1: "4", y2: "20", key: "ovs5a5" }],
    ["path", { d: "M4 7c0-1.7 1.3-3 3-3h13", key: "10pag4" }],
    ["path", { d: "M18 20c-1.7 0-3-1.3-3-3V4", key: "1gaosr" }]
  ];
  const Pi = createLucideIcon("pi", __iconNode$7Z);

  const __iconNode$7Y = [
    [
      "path",
      {
        d: "M18.5 8c-1.4 0-2.6-.8-3.2-2A6.87 6.87 0 0 0 2 9v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8.5C22 9.6 20.4 8 18.5 8",
        key: "lag0yf"
      }
    ],
    ["path", { d: "M2 14h20", key: "myj16y" }],
    ["path", { d: "M6 14v4", key: "9ng0ue" }],
    ["path", { d: "M10 14v4", key: "1v8uk5" }],
    ["path", { d: "M14 14v4", key: "1tqops" }],
    ["path", { d: "M18 14v4", key: "18uqwm" }]
  ];
  const Piano = createLucideIcon("piano", __iconNode$7Y);

  const __iconNode$7X = [
    ["path", { d: "M14.531 12.469 6.619 20.38a1 1 0 1 1-3-3l7.912-7.912", key: "we99rg" }],
    [
      "path",
      {
        d: "M15.686 4.314A12.5 12.5 0 0 0 5.461 2.958 1 1 0 0 0 5.58 4.71a22 22 0 0 1 6.318 3.393",
        key: "1w6hck"
      }
    ],
    [
      "path",
      {
        d: "M17.7 3.7a1 1 0 0 0-1.4 0l-4.6 4.6a1 1 0 0 0 0 1.4l2.6 2.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4z",
        key: "15hgfx"
      }
    ],
    [
      "path",
      {
        d: "M19.686 8.314a12.501 12.501 0 0 1 1.356 10.225 1 1 0 0 1-1.751-.119 22 22 0 0 0-3.393-6.319",
        key: "452b4h"
      }
    ]
  ];
  const Pickaxe = createLucideIcon("pickaxe", __iconNode$7X);

  const __iconNode$7W = [
    ["path", { d: "M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4", key: "daa4of" }],
    ["rect", { width: "10", height: "7", x: "12", y: "13", rx: "2", key: "1nb8gs" }]
  ];
  const PictureInPicture2 = createLucideIcon("picture-in-picture-2", __iconNode$7W);

  const __iconNode$7V = [
    ["path", { d: "M2 10h6V4", key: "zwrco" }],
    ["path", { d: "m2 4 6 6", key: "ug085t" }],
    ["path", { d: "M21 10V7a2 2 0 0 0-2-2h-7", key: "git5jr" }],
    ["path", { d: "M3 14v2a2 2 0 0 0 2 2h3", key: "1f7fh3" }],
    ["rect", { x: "12", y: "14", width: "10", height: "7", rx: "1", key: "1wjs3o" }]
  ];
  const PictureInPicture = createLucideIcon("picture-in-picture", __iconNode$7V);

  const __iconNode$7U = [
    [
      "path",
      {
        d: "M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z",
        key: "1piglc"
      }
    ],
    ["path", { d: "M16 10h.01", key: "1m94wz" }],
    ["path", { d: "M2 8v1a2 2 0 0 0 2 2h1", key: "1env43" }]
  ];
  const PiggyBank = createLucideIcon("piggy-bank", __iconNode$7U);

  const __iconNode$7T = [
    ["path", { d: "M14 3v11", key: "mlfb7b" }],
    ["path", { d: "M14 9h-3a3 3 0 0 1 0-6h9", key: "1ulc19" }],
    ["path", { d: "M18 3v11", key: "1phi0r" }],
    ["path", { d: "M22 18H2l4-4", key: "yt65j9" }],
    ["path", { d: "m6 22-4-4", key: "6jgyf5" }]
  ];
  const PilcrowLeft = createLucideIcon("pilcrow-left", __iconNode$7T);

  const __iconNode$7S = [
    ["path", { d: "M10 3v11", key: "o3l5kj" }],
    ["path", { d: "M10 9H7a1 1 0 0 1 0-6h8", key: "1wb1nc" }],
    ["path", { d: "M14 3v11", key: "mlfb7b" }],
    ["path", { d: "m18 14 4 4H2", key: "4r8io1" }],
    ["path", { d: "m22 18-4 4", key: "1hjjrd" }]
  ];
  const PilcrowRight = createLucideIcon("pilcrow-right", __iconNode$7S);

  const __iconNode$7R = [
    ["path", { d: "M13 4v16", key: "8vvj80" }],
    ["path", { d: "M17 4v16", key: "7dpous" }],
    ["path", { d: "M19 4H9.5a4.5 4.5 0 0 0 0 9H13", key: "sh4n9v" }]
  ];
  const Pilcrow = createLucideIcon("pilcrow", __iconNode$7R);

  const __iconNode$7Q = [
    ["path", { d: "M18 11h-4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h4", key: "17ldeb" }],
    ["path", { d: "M6 7v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7", key: "nc37y6" }],
    ["rect", { width: "16", height: "5", x: "4", y: "2", rx: "1", key: "3jeezo" }]
  ];
  const PillBottle = createLucideIcon("pill-bottle", __iconNode$7Q);

  const __iconNode$7P = [
    [
      "path",
      { d: "m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z", key: "wa1lgi" }
    ],
    ["path", { d: "m8.5 8.5 7 7", key: "rvfmvr" }]
  ];
  const Pill = createLucideIcon("pill", __iconNode$7P);

  const __iconNode$7O = [
    ["path", { d: "M12 17v5", key: "bb1du9" }],
    ["path", { d: "M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89", key: "znwnzq" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    [
      "path",
      {
        d: "M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11",
        key: "c9qhm2"
      }
    ]
  ];
  const PinOff = createLucideIcon("pin-off", __iconNode$7O);

  const __iconNode$7N = [
    ["path", { d: "M12 17v5", key: "bb1du9" }],
    [
      "path",
      {
        d: "M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z",
        key: "1nkz8b"
      }
    ]
  ];
  const Pin = createLucideIcon("pin", __iconNode$7N);

  const __iconNode$7M = [
    [
      "path",
      {
        d: "m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12",
        key: "1y3wsu"
      }
    ],
    [
      "path",
      {
        d: "m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z",
        key: "110lr1"
      }
    ],
    ["path", { d: "m2 22 .414-.414", key: "jhxm08" }]
  ];
  const Pipette = createLucideIcon("pipette", __iconNode$7M);

  const __iconNode$7L = [
    ["path", { d: "m12 14-1 1", key: "11onhr" }],
    ["path", { d: "m13.75 18.25-1.25 1.42", key: "1yisr3" }],
    ["path", { d: "M17.775 5.654a15.68 15.68 0 0 0-12.121 12.12", key: "1qtqk6" }],
    ["path", { d: "M18.8 9.3a1 1 0 0 0 2.1 7.7", key: "fbbbr2" }],
    [
      "path",
      {
        d: "M21.964 20.732a1 1 0 0 1-1.232 1.232l-18-5a1 1 0 0 1-.695-1.232A19.68 19.68 0 0 1 15.732 2.037a1 1 0 0 1 1.232.695z",
        key: "1hyfdd"
      }
    ]
  ];
  const Pizza = createLucideIcon("pizza", __iconNode$7L);

  const __iconNode$7K = [
    ["path", { d: "M2 22h20", key: "272qi7" }],
    [
      "path",
      {
        d: "M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z",
        key: "1ma21e"
      }
    ]
  ];
  const PlaneLanding = createLucideIcon("plane-landing", __iconNode$7K);

  const __iconNode$7J = [
    ["path", { d: "M2 22h20", key: "272qi7" }],
    [
      "path",
      {
        d: "M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z",
        key: "fkigj9"
      }
    ]
  ];
  const PlaneTakeoff = createLucideIcon("plane-takeoff", __iconNode$7J);

  const __iconNode$7I = [
    [
      "path",
      {
        d: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
        key: "1v9wt8"
      }
    ]
  ];
  const Plane = createLucideIcon("plane", __iconNode$7I);

  const __iconNode$7H = [["polygon", { points: "6 3 20 12 6 21 6 3", key: "1oa8hb" }]];
  const Play = createLucideIcon("play", __iconNode$7H);

  const __iconNode$7G = [
    ["path", { d: "M9 2v6", key: "17ngun" }],
    ["path", { d: "M15 2v6", key: "s7yy2p" }],
    ["path", { d: "M12 17v5", key: "bb1du9" }],
    ["path", { d: "M5 8h14", key: "pcz4l3" }],
    ["path", { d: "M6 11V8h12v3a6 6 0 1 1-12 0Z", key: "wtfw2c" }]
  ];
  const Plug2 = createLucideIcon("plug-2", __iconNode$7G);

  const __iconNode$7F = [
    ["path", { d: "M12 22v-5", key: "1ega77" }],
    ["path", { d: "M9 8V2", key: "14iosj" }],
    ["path", { d: "M15 8V2", key: "18g5xt" }],
    ["path", { d: "M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z", key: "osxo6l" }]
  ];
  const Plug = createLucideIcon("plug", __iconNode$7F);

  const __iconNode$7E = [
    [
      "path",
      { d: "M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z", key: "goz73y" }
    ],
    ["path", { d: "m2 22 3-3", key: "19mgm9" }],
    ["path", { d: "M7.5 13.5 10 11", key: "7xgeeb" }],
    ["path", { d: "M10.5 16.5 13 14", key: "10btkg" }],
    ["path", { d: "m18 3-4 4h6l-4 4", key: "16psg9" }]
  ];
  const PlugZap = createLucideIcon("plug-zap", __iconNode$7E);

  const __iconNode$7D = [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "M12 5v14", key: "s699le" }]
  ];
  const Plus = createLucideIcon("plus", __iconNode$7D);

  const __iconNode$7C = [
    ["path", { d: "M3 2v1c0 1 2 1 2 2S3 6 3 7s2 1 2 2-2 1-2 2 2 1 2 2", key: "19w3oe" }],
    ["path", { d: "M18 6h.01", key: "1v4wsw" }],
    ["path", { d: "M6 18h.01", key: "uhywen" }],
    ["path", { d: "M20.83 8.83a4 4 0 0 0-5.66-5.66l-12 12a4 4 0 1 0 5.66 5.66Z", key: "6fykxj" }],
    ["path", { d: "M18 11.66V22a4 4 0 0 0 4-4V6", key: "1utzek" }]
  ];
  const PocketKnife = createLucideIcon("pocket-knife", __iconNode$7C);

  const __iconNode$7B = [
    ["path", { d: "M20 3a2 2 0 0 1 2 2v6a1 1 0 0 1-20 0V5a2 2 0 0 1 2-2z", key: "1uodqw" }],
    ["path", { d: "m8 10 4 4 4-4", key: "1mxd5q" }]
  ];
  const Pocket = createLucideIcon("pocket", __iconNode$7B);

  const __iconNode$7A = [
    ["path", { d: "M16.85 18.58a9 9 0 1 0-9.7 0", key: "d71mpg" }],
    ["path", { d: "M8 14a5 5 0 1 1 8 0", key: "fc81rn" }],
    ["circle", { cx: "12", cy: "11", r: "1", key: "1gvufo" }],
    ["path", { d: "M13 17a1 1 0 1 0-2 0l.5 4.5a.5.5 0 1 0 1 0Z", key: "za5kbj" }]
  ];
  const Podcast = createLucideIcon("podcast", __iconNode$7A);

  const __iconNode$7z = [
    ["path", { d: "M10 4.5V4a2 2 0 0 0-2.41-1.957", key: "jsi14n" }],
    ["path", { d: "M13.9 8.4a2 2 0 0 0-1.26-1.295", key: "hirc7f" }],
    [
      "path",
      { d: "M21.7 16.2A8 8 0 0 0 22 14v-3a2 2 0 1 0-4 0v-1a2 2 0 0 0-3.63-1.158", key: "1jxb2e" }
    ],
    [
      "path",
      {
        d: "m7 15-1.8-1.8a2 2 0 0 0-2.79 2.86L6 19.7a7.74 7.74 0 0 0 6 2.3h2a8 8 0 0 0 5.657-2.343",
        key: "10r7hm"
      }
    ],
    ["path", { d: "M6 6v8", key: "tv5xkp" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const PointerOff = createLucideIcon("pointer-off", __iconNode$7z);

  const __iconNode$7y = [
    ["path", { d: "M22 14a8 8 0 0 1-8 8", key: "56vcr3" }],
    ["path", { d: "M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2", key: "1agjmk" }],
    ["path", { d: "M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1", key: "wdbh2u" }],
    ["path", { d: "M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10", key: "1ibuk9" }],
    [
      "path",
      {
        d: "M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
        key: "g6ys72"
      }
    ]
  ];
  const Pointer = createLucideIcon("pointer", __iconNode$7y);

  const __iconNode$7x = [
    [
      "path",
      {
        d: "M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4",
        key: "10td1f"
      }
    ],
    ["path", { d: "M10 22 9 8", key: "yjptiv" }],
    ["path", { d: "m14 22 1-14", key: "8jwc8b" }],
    [
      "path",
      {
        d: "M20 8c.5 0 .9.4.8 1l-2.6 12c-.1.5-.7 1-1.2 1H7c-.6 0-1.1-.4-1.2-1L3.2 9c-.1-.6.3-1 .8-1Z",
        key: "1qo33t"
      }
    ]
  ];
  const Popcorn = createLucideIcon("popcorn", __iconNode$7x);

  const __iconNode$7w = [
    [
      "path",
      {
        d: "M18.6 14.4c.8-.8.8-2 0-2.8l-8.1-8.1a4.95 4.95 0 1 0-7.1 7.1l8.1 8.1c.9.7 2.1.7 2.9-.1Z",
        key: "1o68ps"
      }
    ],
    ["path", { d: "m22 22-5.5-5.5", key: "17o70y" }]
  ];
  const Popsicle = createLucideIcon("popsicle", __iconNode$7w);

  const __iconNode$7v = [
    ["path", { d: "M18 7c0-5.333-8-5.333-8 0", key: "1prm2n" }],
    ["path", { d: "M10 7v14", key: "18tmcs" }],
    ["path", { d: "M6 21h12", key: "4dkmi1" }],
    ["path", { d: "M6 13h10", key: "ybwr4a" }]
  ];
  const PoundSterling = createLucideIcon("pound-sterling", __iconNode$7v);

  const __iconNode$7u = [
    ["path", { d: "M18.36 6.64A9 9 0 0 1 20.77 15", key: "dxknvb" }],
    ["path", { d: "M6.16 6.16a9 9 0 1 0 12.68 12.68", key: "1x7qb5" }],
    ["path", { d: "M12 2v4", key: "3427ic" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const PowerOff = createLucideIcon("power-off", __iconNode$7u);

  const __iconNode$7t = [
    ["path", { d: "M12 2v10", key: "mnfbl" }],
    ["path", { d: "M18.4 6.6a9 9 0 1 1-12.77.04", key: "obofu9" }]
  ];
  const Power = createLucideIcon("power", __iconNode$7t);

  const __iconNode$7s = [
    ["path", { d: "M2 3h20", key: "91anmk" }],
    ["path", { d: "M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3", key: "2k9sn8" }],
    ["path", { d: "m7 21 5-5 5 5", key: "bip4we" }]
  ];
  const Presentation = createLucideIcon("presentation", __iconNode$7s);

  const __iconNode$7r = [
    ["path", { d: "M13.5 22H7a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v.5", key: "qeb09x" }],
    ["path", { d: "m16 19 2 2 4-4", key: "1b14m6" }],
    ["path", { d: "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2", key: "1md90i" }],
    ["path", { d: "M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6", key: "1itne7" }]
  ];
  const PrinterCheck = createLucideIcon("printer-check", __iconNode$7r);

  const __iconNode$7q = [
    [
      "path",
      {
        d: "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2",
        key: "143wyd"
      }
    ],
    ["path", { d: "M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6", key: "1itne7" }],
    ["rect", { x: "6", y: "14", width: "12", height: "8", rx: "1", key: "1ue0tg" }]
  ];
  const Printer = createLucideIcon("printer", __iconNode$7q);

  const __iconNode$7p = [
    ["path", { d: "M5 7 3 5", key: "1yys58" }],
    ["path", { d: "M9 6V3", key: "1ptz9u" }],
    ["path", { d: "m13 7 2-2", key: "1w3vmq" }],
    ["circle", { cx: "9", cy: "13", r: "3", key: "1mma13" }],
    [
      "path",
      {
        d: "M11.83 12H20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h2.17",
        key: "2frwzc"
      }
    ],
    ["path", { d: "M16 16h2", key: "dnq2od" }]
  ];
  const Projector = createLucideIcon("projector", __iconNode$7p);

  const __iconNode$7o = [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
    ["path", { d: "M12 9v11", key: "1fnkrn" }],
    ["path", { d: "M2 9h13a2 2 0 0 1 2 2v9", key: "11z3ex" }]
  ];
  const Proportions = createLucideIcon("proportions", __iconNode$7o);

  const __iconNode$7n = [
    [
      "path",
      {
        d: "M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z",
        key: "w46dr5"
      }
    ]
  ];
  const Puzzle = createLucideIcon("puzzle", __iconNode$7n);

  const __iconNode$7m = [
    [
      "path",
      {
        d: "M2.5 16.88a1 1 0 0 1-.32-1.43l9-13.02a1 1 0 0 1 1.64 0l9 13.01a1 1 0 0 1-.32 1.44l-8.51 4.86a2 2 0 0 1-1.98 0Z",
        key: "aenxs0"
      }
    ],
    ["path", { d: "M12 2v20", key: "t6zp3m" }]
  ];
  const Pyramid = createLucideIcon("pyramid", __iconNode$7m);

  const __iconNode$7l = [
    ["rect", { width: "5", height: "5", x: "3", y: "3", rx: "1", key: "1tu5fj" }],
    ["rect", { width: "5", height: "5", x: "16", y: "3", rx: "1", key: "1v8r4q" }],
    ["rect", { width: "5", height: "5", x: "3", y: "16", rx: "1", key: "1x03jg" }],
    ["path", { d: "M21 16h-3a2 2 0 0 0-2 2v3", key: "177gqh" }],
    ["path", { d: "M21 21v.01", key: "ents32" }],
    ["path", { d: "M12 7v3a2 2 0 0 1-2 2H7", key: "8crl2c" }],
    ["path", { d: "M3 12h.01", key: "nlz23k" }],
    ["path", { d: "M12 3h.01", key: "n36tog" }],
    ["path", { d: "M12 16v.01", key: "133mhm" }],
    ["path", { d: "M16 12h1", key: "1slzba" }],
    ["path", { d: "M21 12v.01", key: "1lwtk9" }],
    ["path", { d: "M12 21v-1", key: "1880an" }]
  ];
  const QrCode = createLucideIcon("qr-code", __iconNode$7l);

  const __iconNode$7k = [
    [
      "path",
      {
        d: "M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",
        key: "rib7q0"
      }
    ],
    [
      "path",
      {
        d: "M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z",
        key: "1ymkrd"
      }
    ]
  ];
  const Quote = createLucideIcon("quote", __iconNode$7k);

  const __iconNode$7j = [
    ["path", { d: "M13 16a3 3 0 0 1 2.24 5", key: "1epib5" }],
    ["path", { d: "M18 12h.01", key: "yjnet6" }],
    [
      "path",
      {
        d: "M18 21h-8a4 4 0 0 1-4-4 7 7 0 0 1 7-7h.2L9.6 6.4a1 1 0 1 1 2.8-2.8L15.8 7h.2c3.3 0 6 2.7 6 6v1a2 2 0 0 1-2 2h-1a3 3 0 0 0-3 3",
        key: "ue9ozu"
      }
    ],
    ["path", { d: "M20 8.54V4a2 2 0 1 0-4 0v3", key: "49iql8" }],
    ["path", { d: "M7.612 12.524a3 3 0 1 0-1.6 4.3", key: "1e33i0" }]
  ];
  const Rabbit = createLucideIcon("rabbit", __iconNode$7j);

  const __iconNode$7i = [
    ["path", { d: "M19.07 4.93A10 10 0 0 0 6.99 3.34", key: "z3du51" }],
    ["path", { d: "M4 6h.01", key: "oypzma" }],
    ["path", { d: "M2.29 9.62A10 10 0 1 0 21.31 8.35", key: "qzzz0" }],
    ["path", { d: "M16.24 7.76A6 6 0 1 0 8.23 16.67", key: "1yjesh" }],
    ["path", { d: "M12 18h.01", key: "mhygvu" }],
    ["path", { d: "M17.99 11.66A6 6 0 0 1 15.77 16.67", key: "1u2y91" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }],
    ["path", { d: "m13.41 10.59 5.66-5.66", key: "mhq4k0" }]
  ];
  const Radar = createLucideIcon("radar", __iconNode$7i);

  const __iconNode$7h = [
    ["path", { d: "M12 12h.01", key: "1mp3jc" }],
    [
      "path",
      {
        d: "M14 15.4641a4 4 0 0 1-4 0L7.52786 19.74597 A 1 1 0 0 0 7.99303 21.16211 10 10 0 0 0 16.00697 21.16211 1 1 0 0 0 16.47214 19.74597z",
        key: "1y4lzb"
      }
    ],
    [
      "path",
      {
        d: "M16 12a4 4 0 0 0-2-3.464l2.472-4.282a1 1 0 0 1 1.46-.305 10 10 0 0 1 4.006 6.94A1 1 0 0 1 21 12z",
        key: "163ggk"
      }
    ],
    [
      "path",
      {
        d: "M8 12a4 4 0 0 1 2-3.464L7.528 4.254a1 1 0 0 0-1.46-.305 10 10 0 0 0-4.006 6.94A1 1 0 0 0 3 12z",
        key: "1l9i0b"
      }
    ]
  ];
  const Radiation = createLucideIcon("radiation", __iconNode$7h);

  const __iconNode$7g = [
    [
      "path",
      {
        d: "M3 12h3.28a1 1 0 0 1 .948.684l2.298 7.934a.5.5 0 0 0 .96-.044L13.82 4.771A1 1 0 0 1 14.792 4H21",
        key: "1mqj8i"
      }
    ]
  ];
  const Radical = createLucideIcon("radical", __iconNode$7g);

  const __iconNode$7f = [
    ["path", { d: "M5 16v2", key: "g5qcv5" }],
    ["path", { d: "M19 16v2", key: "1gbaio" }],
    ["rect", { width: "20", height: "8", x: "2", y: "8", rx: "2", key: "vjsjur" }],
    ["path", { d: "M18 12h.01", key: "yjnet6" }]
  ];
  const RadioReceiver = createLucideIcon("radio-receiver", __iconNode$7f);

  const __iconNode$7e = [
    ["path", { d: "M4.9 16.1C1 12.2 1 5.8 4.9 1.9", key: "s0qx1y" }],
    ["path", { d: "M7.8 4.7a6.14 6.14 0 0 0-.8 7.5", key: "1idnkw" }],
    ["circle", { cx: "12", cy: "9", r: "2", key: "1092wv" }],
    ["path", { d: "M16.2 4.8c2 2 2.26 5.11.8 7.47", key: "ojru2q" }],
    ["path", { d: "M19.1 1.9a9.96 9.96 0 0 1 0 14.1", key: "rhi7fg" }],
    ["path", { d: "M9.5 18h5", key: "mfy3pd" }],
    ["path", { d: "m8 22 4-11 4 11", key: "25yftu" }]
  ];
  const RadioTower = createLucideIcon("radio-tower", __iconNode$7e);

  const __iconNode$7d = [
    ["path", { d: "M16.247 7.761a6 6 0 0 1 0 8.478", key: "1fwjs5" }],
    ["path", { d: "M19.075 4.933a10 10 0 0 1 0 14.134", key: "ehdyv1" }],
    ["path", { d: "M4.925 19.067a10 10 0 0 1 0-14.134", key: "1q22gi" }],
    ["path", { d: "M7.753 16.239a6 6 0 0 1 0-8.478", key: "r2q7qm" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]
  ];
  const Radio = createLucideIcon("radio", __iconNode$7d);

  const __iconNode$7c = [
    ["path", { d: "M20.34 17.52a10 10 0 1 0-2.82 2.82", key: "fydyku" }],
    ["circle", { cx: "19", cy: "19", r: "2", key: "17f5cg" }],
    ["path", { d: "m13.41 13.41 4.18 4.18", key: "1gqbwc" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]
  ];
  const Radius = createLucideIcon("radius", __iconNode$7c);

  const __iconNode$7b = [
    ["path", { d: "M5 15h14", key: "m0yey3" }],
    ["path", { d: "M5 9h14", key: "7tsvo6" }],
    ["path", { d: "m14 20-5-5 6-6-5-5", key: "1jo42i" }]
  ];
  const RailSymbol = createLucideIcon("rail-symbol", __iconNode$7b);

  const __iconNode$7a = [
    ["path", { d: "M22 17a10 10 0 0 0-20 0", key: "ozegv" }],
    ["path", { d: "M6 17a6 6 0 0 1 12 0", key: "5giftw" }],
    ["path", { d: "M10 17a2 2 0 0 1 4 0", key: "gnsikk" }]
  ];
  const Rainbow = createLucideIcon("rainbow", __iconNode$7a);

  const __iconNode$79 = [
    ["path", { d: "M13 22H4a2 2 0 0 1 0-4h12", key: "bt3f23" }],
    ["path", { d: "M13.236 18a3 3 0 0 0-2.2-5", key: "1tbvmo" }],
    ["path", { d: "M16 9h.01", key: "1bdo4e" }],
    [
      "path",
      {
        d: "M16.82 3.94a3 3 0 1 1 3.237 4.868l1.815 2.587a1.5 1.5 0 0 1-1.5 2.1l-2.872-.453a3 3 0 0 0-3.5 3",
        key: "9ch7kn"
      }
    ],
    ["path", { d: "M17 4.988a3 3 0 1 0-5.2 2.052A7 7 0 0 0 4 14.015 4 4 0 0 0 8 18", key: "3s7e9i" }]
  ];
  const Rat = createLucideIcon("rat", __iconNode$79);

  const __iconNode$78 = [
    ["rect", { width: "12", height: "20", x: "6", y: "2", rx: "2", key: "1oxtiu" }],
    ["rect", { width: "20", height: "12", x: "2", y: "6", rx: "2", key: "9lu3g6" }]
  ];
  const Ratio = createLucideIcon("ratio", __iconNode$78);

  const __iconNode$77 = [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "M12 6.5v11", key: "ecfhkf" }],
    ["path", { d: "M15 9.4a4 4 0 1 0 0 5.2", key: "1makmb" }]
  ];
  const ReceiptCent = createLucideIcon("receipt-cent", __iconNode$77);

  const __iconNode$76 = [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "M8 12h5", key: "1g6qi8" }],
    ["path", { d: "M16 9.5a4 4 0 1 0 0 5.2", key: "b2px4r" }]
  ];
  const ReceiptEuro = createLucideIcon("receipt-euro", __iconNode$76);

  const __iconNode$75 = [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "M8 7h8", key: "i86dvs" }],
    ["path", { d: "M12 17.5 8 15h1a4 4 0 0 0 0-8", key: "grpkl4" }],
    ["path", { d: "M8 11h8", key: "vwpz6n" }]
  ];
  const ReceiptIndianRupee = createLucideIcon("receipt-indian-rupee", __iconNode$75);

  const __iconNode$74 = [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "m12 10 3-3", key: "1mc12w" }],
    ["path", { d: "m9 7 3 3v7.5", key: "39i0xv" }],
    ["path", { d: "M9 11h6", key: "1fldmi" }],
    ["path", { d: "M9 15h6", key: "cctwl0" }]
  ];
  const ReceiptJapaneseYen = createLucideIcon("receipt-japanese-yen", __iconNode$74);

  const __iconNode$73 = [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "M8 13h5", key: "1k9z8w" }],
    ["path", { d: "M10 17V9.5a2.5 2.5 0 0 1 5 0", key: "1dzgp0" }],
    ["path", { d: "M8 17h7", key: "8mjdqu" }]
  ];
  const ReceiptPoundSterling = createLucideIcon("receipt-pound-sterling", __iconNode$73);

  const __iconNode$72 = [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "M8 15h5", key: "vxg57a" }],
    ["path", { d: "M8 11h5a2 2 0 1 0 0-4h-3v10", key: "1usi5u" }]
  ];
  const ReceiptRussianRuble = createLucideIcon("receipt-russian-ruble", __iconNode$72);

  const __iconNode$71 = [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "M10 17V7h5", key: "k7jq18" }],
    ["path", { d: "M10 11h4", key: "1i0mka" }],
    ["path", { d: "M8 15h5", key: "vxg57a" }]
  ];
  const ReceiptSwissFranc = createLucideIcon("receipt-swiss-franc", __iconNode$71);

  const __iconNode$70 = [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "M14 8H8", key: "1l3xfs" }],
    ["path", { d: "M16 12H8", key: "1fr5h0" }],
    ["path", { d: "M13 16H8", key: "wsln4y" }]
  ];
  const ReceiptText = createLucideIcon("receipt-text", __iconNode$70);

  const __iconNode$6$ = [
    [
      "path",
      { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z", key: "q3az6g" }
    ],
    ["path", { d: "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8", key: "1h4pet" }],
    ["path", { d: "M12 17.5v-11", key: "1jc1ny" }]
  ];
  const Receipt = createLucideIcon("receipt", __iconNode$6$);

  const __iconNode$6_ = [
    ["path", { d: "M14 4v16H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z", key: "1m5n7q" }],
    ["circle", { cx: "14", cy: "12", r: "8", key: "1pag6k" }]
  ];
  const RectangleCircle = createLucideIcon("rectangle-circle", __iconNode$6_);

  const __iconNode$6Z = [
    ["rect", { width: "20", height: "12", x: "2", y: "6", rx: "2", key: "9lu3g6" }],
    ["path", { d: "M12 12h.01", key: "1mp3jc" }],
    ["path", { d: "M17 12h.01", key: "1m0b6t" }],
    ["path", { d: "M7 12h.01", key: "eqddd0" }]
  ];
  const RectangleEllipsis = createLucideIcon("rectangle-ellipsis", __iconNode$6Z);

  const __iconNode$6Y = [
    [
      "path",
      {
        d: "M20 6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4a2 2 0 0 1-1.6-.8l-1.6-2.13a1 1 0 0 0-1.6 0L9.6 17.2A2 2 0 0 1 8 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
        key: "d5y1f"
      }
    ]
  ];
  const RectangleGoggles = createLucideIcon("rectangle-goggles", __iconNode$6Y);

  const __iconNode$6X = [
    ["rect", { width: "20", height: "12", x: "2", y: "6", rx: "2", key: "9lu3g6" }]
  ];
  const RectangleHorizontal = createLucideIcon("rectangle-horizontal", __iconNode$6X);

  const __iconNode$6W = [
    ["rect", { width: "12", height: "20", x: "6", y: "2", rx: "2", key: "1oxtiu" }]
  ];
  const RectangleVertical = createLucideIcon("rectangle-vertical", __iconNode$6W);

  const __iconNode$6V = [
    [
      "path",
      {
        d: "M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5",
        key: "x6z5xu"
      }
    ],
    [
      "path",
      {
        d: "M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12",
        key: "1x4zh5"
      }
    ],
    ["path", { d: "m14 16-3 3 3 3", key: "f6jyew" }],
    ["path", { d: "M8.293 13.596 7.196 9.5 3.1 10.598", key: "wf1obh" }],
    [
      "path",
      {
        d: "m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843",
        key: "9tzpgr"
      }
    ],
    ["path", { d: "m13.378 9.633 4.096 1.098 1.097-4.096", key: "1oe83g" }]
  ];
  const Recycle = createLucideIcon("recycle", __iconNode$6V);

  const __iconNode$6U = [
    ["path", { d: "m15 14 5-5-5-5", key: "12vg1m" }],
    ["path", { d: "M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13", key: "6uklza" }]
  ];
  const Redo2 = createLucideIcon("redo-2", __iconNode$6U);

  const __iconNode$6T = [
    ["circle", { cx: "12", cy: "17", r: "1", key: "1ixnty" }],
    ["path", { d: "M21 7v6h-6", key: "3ptur4" }],
    ["path", { d: "M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7", key: "1kgawr" }]
  ];
  const RedoDot = createLucideIcon("redo-dot", __iconNode$6T);

  const __iconNode$6S = [
    ["path", { d: "M21 7v6h-6", key: "3ptur4" }],
    ["path", { d: "M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7", key: "1kgawr" }]
  ];
  const Redo = createLucideIcon("redo", __iconNode$6S);

  const __iconNode$6R = [
    ["path", { d: "M3 2v6h6", key: "18ldww" }],
    ["path", { d: "M21 12A9 9 0 0 0 6 5.3L3 8", key: "1pbrqz" }],
    ["path", { d: "M21 22v-6h-6", key: "usdfbe" }],
    ["path", { d: "M3 12a9 9 0 0 0 15 6.7l3-2.7", key: "1hosoe" }],
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }]
  ];
  const RefreshCcwDot = createLucideIcon("refresh-ccw-dot", __iconNode$6R);

  const __iconNode$6Q = [
    ["path", { d: "M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "14sxne" }],
    ["path", { d: "M3 3v5h5", key: "1xhq8a" }],
    ["path", { d: "M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16", key: "1hlbsb" }],
    ["path", { d: "M16 16h5v5", key: "ccwih5" }]
  ];
  const RefreshCcw = createLucideIcon("refresh-ccw", __iconNode$6Q);

  const __iconNode$6P = [
    ["path", { d: "M21 8L18.74 5.74A9.75 9.75 0 0 0 12 3C11 3 10.03 3.16 9.13 3.47", key: "1krf6h" }],
    ["path", { d: "M8 16H3v5", key: "1cv678" }],
    ["path", { d: "M3 12C3 9.51 4 7.26 5.64 5.64", key: "ruvoct" }],
    ["path", { d: "m3 16 2.26 2.26A9.75 9.75 0 0 0 12 21c2.49 0 4.74-1 6.36-2.64", key: "19q130" }],
    ["path", { d: "M21 12c0 1-.16 1.97-.47 2.87", key: "4w8emr" }],
    ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
    ["path", { d: "M22 22 2 2", key: "1r8tn9" }]
  ];
  const RefreshCwOff = createLucideIcon("refresh-cw-off", __iconNode$6P);

  const __iconNode$6O = [
    [
      "path",
      { d: "M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z", key: "fpq118" }
    ],
    ["path", { d: "M5 10h14", key: "elsbfy" }],
    ["path", { d: "M15 7v6", key: "1nx30x" }]
  ];
  const Refrigerator = createLucideIcon("refrigerator", __iconNode$6O);

  const __iconNode$6N = [
    ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
    ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
    ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
    ["path", { d: "M8 16H3v5", key: "1cv678" }]
  ];
  const RefreshCw = createLucideIcon("refresh-cw", __iconNode$6N);

  const __iconNode$6M = [
    ["path", { d: "M17 3v10", key: "15fgeh" }],
    ["path", { d: "m12.67 5.5 8.66 5", key: "1gpheq" }],
    ["path", { d: "m12.67 10.5 8.66-5", key: "1dkfa6" }],
    [
      "path",
      { d: "M9 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2z", key: "swwfx4" }
    ]
  ];
  const Regex = createLucideIcon("regex", __iconNode$6M);

  const __iconNode$6L = [
    ["path", { d: "M4 7V4h16v3", key: "9msm58" }],
    ["path", { d: "M5 20h6", key: "1h6pxn" }],
    ["path", { d: "M13 4 8 20", key: "kqq6aj" }],
    ["path", { d: "m15 15 5 5", key: "me55sn" }],
    ["path", { d: "m20 15-5 5", key: "11p7ol" }]
  ];
  const RemoveFormatting = createLucideIcon("remove-formatting", __iconNode$6L);

  const __iconNode$6K = [
    ["path", { d: "m17 2 4 4-4 4", key: "nntrym" }],
    ["path", { d: "M3 11v-1a4 4 0 0 1 4-4h14", key: "84bu3i" }],
    ["path", { d: "m7 22-4-4 4-4", key: "1wqhfi" }],
    ["path", { d: "M21 13v1a4 4 0 0 1-4 4H3", key: "1rx37r" }],
    ["path", { d: "M11 10h1v4", key: "70cz1p" }]
  ];
  const Repeat1 = createLucideIcon("repeat-1", __iconNode$6K);

  const __iconNode$6J = [
    ["path", { d: "m17 2 4 4-4 4", key: "nntrym" }],
    ["path", { d: "M3 11v-1a4 4 0 0 1 4-4h14", key: "84bu3i" }],
    ["path", { d: "m7 22-4-4 4-4", key: "1wqhfi" }],
    ["path", { d: "M21 13v1a4 4 0 0 1-4 4H3", key: "1rx37r" }]
  ];
  const Repeat = createLucideIcon("repeat", __iconNode$6J);

  const __iconNode$6I = [
    ["path", { d: "m2 9 3-3 3 3", key: "1ltn5i" }],
    ["path", { d: "M13 18H7a2 2 0 0 1-2-2V6", key: "1r6tfw" }],
    ["path", { d: "m22 15-3 3-3-3", key: "4rnwn2" }],
    ["path", { d: "M11 6h6a2 2 0 0 1 2 2v10", key: "2f72bc" }]
  ];
  const Repeat2 = createLucideIcon("repeat-2", __iconNode$6I);

  const __iconNode$6H = [
    ["path", { d: "M14 14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2", key: "1yyzbs" }],
    ["path", { d: "M14 4a2 2 0 0 1 2-2", key: "1w2hp7" }],
    ["path", { d: "M16 10a2 2 0 0 1-2-2", key: "shjach" }],
    ["path", { d: "M20 14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2", key: "zfj4xr" }],
    ["path", { d: "M20 2a2 2 0 0 1 2 2", key: "188mtx" }],
    ["path", { d: "M22 8a2 2 0 0 1-2 2", key: "ddf4tu" }],
    ["path", { d: "m3 7 3 3 3-3", key: "x25e72" }],
    ["path", { d: "M6 10V5a 3 3 0 0 1 3-3h1", key: "1ageje" }],
    ["rect", { x: "2", y: "14", width: "8", height: "8", rx: "2", key: "4rksxw" }]
  ];
  const ReplaceAll = createLucideIcon("replace-all", __iconNode$6H);

  const __iconNode$6G = [
    ["path", { d: "M14 4a2 2 0 0 1 2-2", key: "1w2hp7" }],
    ["path", { d: "M16 10a2 2 0 0 1-2-2", key: "shjach" }],
    ["path", { d: "M20 2a2 2 0 0 1 2 2", key: "188mtx" }],
    ["path", { d: "M22 8a2 2 0 0 1-2 2", key: "ddf4tu" }],
    ["path", { d: "m3 7 3 3 3-3", key: "x25e72" }],
    ["path", { d: "M6 10V5a3 3 0 0 1 3-3h1", key: "3y3t5z" }],
    ["rect", { x: "2", y: "14", width: "8", height: "8", rx: "2", key: "4rksxw" }]
  ];
  const Replace = createLucideIcon("replace", __iconNode$6G);

  const __iconNode$6F = [
    ["path", { d: "m12 17-5-5 5-5", key: "1s3y5u" }],
    ["path", { d: "M22 18v-2a4 4 0 0 0-4-4H7", key: "1fcyog" }],
    ["path", { d: "m7 17-5-5 5-5", key: "1ed8i2" }]
  ];
  const ReplyAll = createLucideIcon("reply-all", __iconNode$6F);

  const __iconNode$6E = [
    ["path", { d: "M20 18v-2a4 4 0 0 0-4-4H4", key: "5vmcpk" }],
    ["path", { d: "m9 17-5-5 5-5", key: "nvlc11" }]
  ];
  const Reply = createLucideIcon("reply", __iconNode$6E);

  const __iconNode$6D = [
    ["polygon", { points: "11 19 2 12 11 5 11 19", key: "14yba5" }],
    ["polygon", { points: "22 19 13 12 22 5 22 19", key: "1pi1cj" }]
  ];
  const Rewind = createLucideIcon("rewind", __iconNode$6D);

  const __iconNode$6C = [
    [
      "path",
      { d: "M12 11.22C11 9.997 10 9 10 8a2 2 0 0 1 4 0c0 1-.998 2.002-2.01 3.22", key: "1rnhq3" }
    ],
    ["path", { d: "m12 18 2.57-3.5", key: "116vt7" }],
    ["path", { d: "M6.243 9.016a7 7 0 0 1 11.507-.009", key: "10dq0b" }],
    ["path", { d: "M9.35 14.53 12 11.22", key: "tdsyp2" }],
    [
      "path",
      {
        d: "M9.35 14.53C7.728 12.246 6 10.221 6 7a6 5 0 0 1 12 0c-.005 3.22-1.778 5.235-3.43 7.5l3.557 4.527a1 1 0 0 1-.203 1.43l-1.894 1.36a1 1 0 0 1-1.384-.215L12 18l-2.679 3.593a1 1 0 0 1-1.39.213l-1.865-1.353a1 1 0 0 1-.203-1.422z",
        key: "nmifey"
      }
    ]
  ];
  const Ribbon = createLucideIcon("ribbon", __iconNode$6C);

  const __iconNode$6B = [
    [
      "path",
      {
        d: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z",
        key: "m3kijz"
      }
    ],
    [
      "path",
      {
        d: "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",
        key: "1fmvmk"
      }
    ],
    ["path", { d: "M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0", key: "1f8sc4" }],
    ["path", { d: "M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5", key: "qeys4" }]
  ];
  const Rocket = createLucideIcon("rocket", __iconNode$6B);

  const __iconNode$6A = [
    ["polyline", { points: "3.5 2 6.5 12.5 18 12.5", key: "y3iy52" }],
    ["line", { x1: "9.5", x2: "5.5", y1: "12.5", y2: "20", key: "19vg5i" }],
    ["line", { x1: "15", x2: "18.5", y1: "12.5", y2: "20", key: "1inpmv" }],
    ["path", { d: "M2.75 18a13 13 0 0 0 18.5 0", key: "1nquas" }]
  ];
  const RockingChair = createLucideIcon("rocking-chair", __iconNode$6A);

  const __iconNode$6z = [
    ["path", { d: "M6 19V5", key: "1r845m" }],
    ["path", { d: "M10 19V6.8", key: "9j2tfs" }],
    ["path", { d: "M14 19v-7.8", key: "10s8qv" }],
    ["path", { d: "M18 5v4", key: "1tajlv" }],
    ["path", { d: "M18 19v-6", key: "ielfq3" }],
    ["path", { d: "M22 19V9", key: "158nzp" }],
    ["path", { d: "M2 19V9a4 4 0 0 1 4-4c2 0 4 1.33 6 4s4 4 6 4a4 4 0 1 0-3-6.65", key: "1930oh" }]
  ];
  const RollerCoaster = createLucideIcon("roller-coaster", __iconNode$6z);

  const __iconNode$6y = [
    [
      "path",
      {
        d: "M16.466 7.5C15.643 4.237 13.952 2 12 2 9.239 2 7 6.477 7 12s2.239 10 5 10c.342 0 .677-.069 1-.2",
        key: "10n0gc"
      }
    ],
    ["path", { d: "m15.194 13.707 3.814 1.86-1.86 3.814", key: "16shm9" }],
    [
      "path",
      {
        d: "M19 15.57c-1.804.885-4.274 1.43-7 1.43-5.523 0-10-2.239-10-5s4.477-5 10-5c4.838 0 8.873 1.718 9.8 4",
        key: "1lxi77"
      }
    ]
  ];
  const Rotate3d = createLucideIcon("rotate-3d", __iconNode$6y);

  const __iconNode$6x = [
    ["path", { d: "m14.5 9.5 1 1", key: "159eiq" }],
    ["path", { d: "m15.5 8.5-4 4", key: "iirg3q" }],
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.74 9.74 0 0 0-6.74 2.74L3 8", key: "g2jlw" }],
    ["path", { d: "M3 3v5h5", key: "1xhq8a" }],
    ["circle", { cx: "10", cy: "14", r: "2", key: "1239so" }]
  ];
  const RotateCcwKey = createLucideIcon("rotate-ccw-key", __iconNode$6x);

  const __iconNode$6w = [
    ["path", { d: "M20 9V7a2 2 0 0 0-2-2h-6", key: "19z8uc" }],
    ["path", { d: "m15 2-3 3 3 3", key: "177bxs" }],
    ["path", { d: "M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2", key: "d36hnl" }]
  ];
  const RotateCcwSquare = createLucideIcon("rotate-ccw-square", __iconNode$6w);

  const __iconNode$6v = [
    ["path", { d: "M12 5H6a2 2 0 0 0-2 2v3", key: "l96uqu" }],
    ["path", { d: "m9 8 3-3-3-3", key: "1gzgc3" }],
    ["path", { d: "M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2", key: "1w2k5h" }]
  ];
  const RotateCwSquare = createLucideIcon("rotate-cw-square", __iconNode$6v);

  const __iconNode$6u = [
    ["path", { d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8", key: "1p45f6" }],
    ["path", { d: "M21 3v5h-5", key: "1q7to0" }]
  ];
  const RotateCw = createLucideIcon("rotate-cw", __iconNode$6u);

  const __iconNode$6t = [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" }],
    ["path", { d: "M3 3v5h5", key: "1xhq8a" }]
  ];
  const RotateCcw = createLucideIcon("rotate-ccw", __iconNode$6t);

  const __iconNode$6s = [
    ["circle", { cx: "6", cy: "19", r: "3", key: "1kj8tv" }],
    ["path", { d: "M9 19h8.5c.4 0 .9-.1 1.3-.2", key: "1effex" }],
    ["path", { d: "M5.2 5.2A3.5 3.53 0 0 0 6.5 12H12", key: "k9y2ds" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M21 15.3a3.5 3.5 0 0 0-3.3-3.3", key: "11nlu2" }],
    ["path", { d: "M15 5h-4.3", key: "6537je" }],
    ["circle", { cx: "18", cy: "5", r: "3", key: "gq8acd" }]
  ];
  const RouteOff = createLucideIcon("route-off", __iconNode$6s);

  const __iconNode$6r = [
    ["circle", { cx: "6", cy: "19", r: "3", key: "1kj8tv" }],
    ["path", { d: "M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15", key: "1d8sl" }],
    ["circle", { cx: "18", cy: "5", r: "3", key: "gq8acd" }]
  ];
  const Route = createLucideIcon("route", __iconNode$6r);

  const __iconNode$6q = [
    ["rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", key: "w68u3i" }],
    ["path", { d: "M6.01 18H6", key: "19vcac" }],
    ["path", { d: "M10.01 18H10", key: "uamcmx" }],
    ["path", { d: "M15 10v4", key: "qjz1xs" }],
    ["path", { d: "M17.84 7.17a4 4 0 0 0-5.66 0", key: "1rif40" }],
    ["path", { d: "M20.66 4.34a8 8 0 0 0-11.31 0", key: "6a5xfq" }]
  ];
  const Router = createLucideIcon("router", __iconNode$6q);

  const __iconNode$6p = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 12h18", key: "1i2n21" }]
  ];
  const Rows2 = createLucideIcon("rows-2", __iconNode$6p);

  const __iconNode$6o = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M21 9H3", key: "1338ky" }],
    ["path", { d: "M21 15H3", key: "9uk58r" }]
  ];
  const Rows3 = createLucideIcon("rows-3", __iconNode$6o);

  const __iconNode$6n = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M21 7.5H3", key: "1hm9pq" }],
    ["path", { d: "M21 12H3", key: "2avoz0" }],
    ["path", { d: "M21 16.5H3", key: "n7jzkj" }]
  ];
  const Rows4 = createLucideIcon("rows-4", __iconNode$6n);

  const __iconNode$6m = [
    ["path", { d: "M4 11a9 9 0 0 1 9 9", key: "pv89mb" }],
    ["path", { d: "M4 4a16 16 0 0 1 16 16", key: "k0647b" }],
    ["circle", { cx: "5", cy: "19", r: "1", key: "bfqh0e" }]
  ];
  const Rss = createLucideIcon("rss", __iconNode$6m);

  const __iconNode$6l = [
    ["path", { d: "M12 15v-3.014", key: "aw6ppf" }],
    ["path", { d: "M16 15v-3.014", key: "9e0vc7" }],
    ["path", { d: "M20 6H4", key: "1lfz86" }],
    ["path", { d: "M20 8V4", key: "1l2g47" }],
    ["path", { d: "M4 8V4", key: "sppxzt" }],
    ["path", { d: "M8 15v-3.014", key: "when08" }],
    ["rect", { x: "3", y: "12", width: "18", height: "7", rx: "1", key: "1ucwdz" }]
  ];
  const RulerDimensionLine = createLucideIcon("ruler-dimension-line", __iconNode$6l);

  const __iconNode$6k = [
    [
      "path",
      {
        d: "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z",
        key: "icamh8"
      }
    ],
    ["path", { d: "m14.5 12.5 2-2", key: "inckbg" }],
    ["path", { d: "m11.5 9.5 2-2", key: "fmmyf7" }],
    ["path", { d: "m8.5 6.5 2-2", key: "vc6u1g" }],
    ["path", { d: "m17.5 15.5 2-2", key: "wo5hmg" }]
  ];
  const Ruler = createLucideIcon("ruler", __iconNode$6k);

  const __iconNode$6j = [
    ["path", { d: "M6 11h8a4 4 0 0 0 0-8H9v18", key: "18ai8t" }],
    ["path", { d: "M6 15h8", key: "1y8f6l" }]
  ];
  const RussianRuble = createLucideIcon("russian-ruble", __iconNode$6j);

  const __iconNode$6i = [
    ["path", { d: "M22 18H2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4Z", key: "1404fh" }],
    ["path", { d: "M21 14 10 2 3 14h18Z", key: "1nzg7v" }],
    ["path", { d: "M10 2v16", key: "1labyt" }]
  ];
  const Sailboat = createLucideIcon("sailboat", __iconNode$6i);

  const __iconNode$6h = [
    ["path", { d: "M7 21h10", key: "1b0cd5" }],
    ["path", { d: "M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z", key: "4rw317" }],
    [
      "path",
      {
        d: "M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1",
        key: "10xrj0"
      }
    ],
    ["path", { d: "m13 12 4-4", key: "1hckqy" }],
    ["path", { d: "M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2", key: "1p4srx" }]
  ];
  const Salad = createLucideIcon("salad", __iconNode$6h);

  const __iconNode$6g = [
    ["path", { d: "m2.37 11.223 8.372-6.777a2 2 0 0 1 2.516 0l8.371 6.777", key: "f1wd0e" }],
    ["path", { d: "M21 15a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.25", key: "1pfu07" }],
    ["path", { d: "M3 15a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h9", key: "1oq9qw" }],
    ["path", { d: "m6.67 15 6.13 4.6a2 2 0 0 0 2.8-.4l3.15-4.2", key: "1fnwu5" }],
    ["rect", { width: "20", height: "4", x: "2", y: "11", rx: "1", key: "itshg" }]
  ];
  const Sandwich = createLucideIcon("sandwich", __iconNode$6g);

  const __iconNode$6f = [
    ["path", { d: "M4 10a7.31 7.31 0 0 0 10 10Z", key: "1fzpp3" }],
    ["path", { d: "m9 15 3-3", key: "88sc13" }],
    ["path", { d: "M17 13a6 6 0 0 0-6-6", key: "15cc6u" }],
    ["path", { d: "M21 13A10 10 0 0 0 11 3", key: "11nf8s" }]
  ];
  const SatelliteDish = createLucideIcon("satellite-dish", __iconNode$6f);

  const __iconNode$6e = [
    [
      "path",
      {
        d: "m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5",
        key: "dzhfyz"
      }
    ],
    ["path", { d: "M16.5 7.5 19 5", key: "1ltcjm" }],
    [
      "path",
      {
        d: "m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5",
        key: "nfoymv"
      }
    ],
    ["path", { d: "M9 21a6 6 0 0 0-6-6", key: "1iajcf" }],
    [
      "path",
      {
        d: "M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z",
        key: "nv9zqy"
      }
    ]
  ];
  const Satellite = createLucideIcon("satellite", __iconNode$6e);

  const __iconNode$6d = [
    ["path", { d: "m20 19.5-5.5 1.2", key: "1aenhr" }],
    ["path", { d: "M14.5 4v11.22a1 1 0 0 0 1.242.97L20 15.2", key: "2rtezt" }],
    ["path", { d: "m2.978 19.351 5.549-1.363A2 2 0 0 0 10 16V2", key: "1kbm92" }],
    ["path", { d: "M20 10 4 13.5", key: "8nums9" }]
  ];
  const SaudiRiyal = createLucideIcon("saudi-riyal", __iconNode$6d);

  const __iconNode$6c = [
    ["path", { d: "M10 2v3a1 1 0 0 0 1 1h5", key: "1xspal" }],
    ["path", { d: "M18 18v-6a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6", key: "1ra60u" }],
    ["path", { d: "M18 22H4a2 2 0 0 1-2-2V6", key: "pblm9e" }],
    [
      "path",
      {
        d: "M8 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9.172a2 2 0 0 1 1.414.586l2.828 2.828A2 2 0 0 1 22 6.828V16a2 2 0 0 1-2.01 2z",
        key: "1yve0x"
      }
    ]
  ];
  const SaveAll = createLucideIcon("save-all", __iconNode$6c);

  const __iconNode$6b = [
    ["path", { d: "M13 13H8a1 1 0 0 0-1 1v7", key: "h8g396" }],
    ["path", { d: "M14 8h1", key: "1lfen6" }],
    ["path", { d: "M17 21v-4", key: "1yknxs" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    [
      "path",
      { d: "M20.41 20.41A2 2 0 0 1 19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 .59-1.41", key: "1t4vdl" }
    ],
    ["path", { d: "M29.5 11.5s5 5 4 5", key: "zzn4i6" }],
    ["path", { d: "M9 3h6.2a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V15", key: "24cby9" }]
  ];
  const SaveOff = createLucideIcon("save-off", __iconNode$6b);

  const __iconNode$6a = [
    [
      "path",
      {
        d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
        key: "1c8476"
      }
    ],
    ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7", key: "1ydtos" }],
    ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7", key: "t51u73" }]
  ];
  const Save = createLucideIcon("save", __iconNode$6a);

  const __iconNode$69 = [
    ["path", { d: "M5 7v11a1 1 0 0 0 1 1h11", key: "13dt1j" }],
    ["path", { d: "M5.293 18.707 11 13", key: "ezgbsx" }],
    ["circle", { cx: "19", cy: "19", r: "2", key: "17f5cg" }],
    ["circle", { cx: "5", cy: "5", r: "2", key: "1gwv83" }]
  ];
  const Scale3d = createLucideIcon("scale-3d", __iconNode$69);

  const __iconNode$68 = [
    ["path", { d: "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z", key: "7g6ntu" }],
    ["path", { d: "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z", key: "ijws7r" }],
    ["path", { d: "M7 21h10", key: "1b0cd5" }],
    ["path", { d: "M12 3v18", key: "108xh3" }],
    ["path", { d: "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2", key: "3gwbw2" }]
  ];
  const Scale = createLucideIcon("scale", __iconNode$68);

  const __iconNode$67 = [
    ["path", { d: "M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", key: "1m0v6g" }],
    ["path", { d: "M14 15H9v-5", key: "pi4jk9" }],
    ["path", { d: "M16 3h5v5", key: "1806ms" }],
    ["path", { d: "M21 3 9 15", key: "15kdhq" }]
  ];
  const Scaling = createLucideIcon("scaling", __iconNode$67);

  const __iconNode$66 = [
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
    ["path", { d: "M8 7v10", key: "23sfjj" }],
    ["path", { d: "M12 7v10", key: "jspqdw" }],
    ["path", { d: "M17 7v10", key: "578dap" }]
  ];
  const ScanBarcode = createLucideIcon("scan-barcode", __iconNode$66);

  const __iconNode$65 = [
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
    [
      "path",
      {
        d: "M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0",
        key: "11ak4c"
      }
    ]
  ];
  const ScanEye = createLucideIcon("scan-eye", __iconNode$65);

  const __iconNode$64 = [
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
    ["path", { d: "M8 14s1.5 2 4 2 4-2 4-2", key: "1y1vjs" }],
    ["path", { d: "M9 9h.01", key: "1q5me6" }],
    ["path", { d: "M15 9h.01", key: "x1ddxp" }]
  ];
  const ScanFace = createLucideIcon("scan-face", __iconNode$64);

  const __iconNode$63 = [
    [
      "path",
      {
        d: "M11.246 16.657a1 1 0 0 0 1.508 0l3.57-4.101A2.75 2.75 0 1 0 12 9.168a2.75 2.75 0 1 0-4.324 3.388z",
        key: "1algrk"
      }
    ],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }]
  ];
  const ScanHeart = createLucideIcon("scan-heart", __iconNode$63);

  const __iconNode$62 = [
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
    ["path", { d: "M7 12h10", key: "b7w52i" }]
  ];
  const ScanLine = createLucideIcon("scan-line", __iconNode$62);

  const __iconNode$61 = [
    ["path", { d: "M17 12v4a1 1 0 0 1-1 1h-4", key: "uk4fdo" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M17 8V7", key: "q2g9wo" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M7 17h.01", key: "19xn7k" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
    ["rect", { x: "7", y: "7", width: "5", height: "5", rx: "1", key: "m9kyts" }]
  ];
  const ScanQrCode = createLucideIcon("scan-qr-code", __iconNode$61);

  const __iconNode$60 = [
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
    ["path", { d: "M7 8h8", key: "1jbsf9" }],
    ["path", { d: "M7 12h10", key: "b7w52i" }],
    ["path", { d: "M7 16h6", key: "1vyc9m" }]
  ];
  const ScanText = createLucideIcon("scan-text", __iconNode$60);

  const __iconNode$5$ = [
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
    ["path", { d: "m16 16-1.9-1.9", key: "1dq9hf" }]
  ];
  const ScanSearch = createLucideIcon("scan-search", __iconNode$5$);

  const __iconNode$5_ = [
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }]
  ];
  const Scan = createLucideIcon("scan", __iconNode$5_);

  const __iconNode$5Z = [
    ["path", { d: "M14 22v-4a2 2 0 1 0-4 0v4", key: "hhkicm" }],
    [
      "path",
      {
        d: "m18 10 3.447 1.724a1 1 0 0 1 .553.894V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.382a1 1 0 0 1 .553-.894L6 10",
        key: "1xqip1"
      }
    ],
    ["path", { d: "M18 5v17", key: "1sw6gf" }],
    ["path", { d: "m4 6 7.106-3.553a2 2 0 0 1 1.788 0L20 6", key: "9d2mlk" }],
    ["path", { d: "M6 5v17", key: "1xfsm0" }],
    ["circle", { cx: "12", cy: "9", r: "2", key: "1092wv" }]
  ];
  const School = createLucideIcon("school", __iconNode$5Z);

  const __iconNode$5Y = [
    ["path", { d: "M5.42 9.42 8 12", key: "12pkuq" }],
    ["circle", { cx: "4", cy: "8", r: "2", key: "107mxr" }],
    ["path", { d: "m14 6-8.58 8.58", key: "gvzu5l" }],
    ["circle", { cx: "4", cy: "16", r: "2", key: "1ehqvc" }],
    ["path", { d: "M10.8 14.8 14 18", key: "ax7m9r" }],
    ["path", { d: "M16 12h-2", key: "10asgb" }],
    ["path", { d: "M22 12h-2", key: "14jgyd" }]
  ];
  const ScissorsLineDashed = createLucideIcon("scissors-line-dashed", __iconNode$5Y);

  const __iconNode$5X = [
    ["circle", { cx: "6", cy: "6", r: "3", key: "1lh9wr" }],
    ["path", { d: "M8.12 8.12 12 12", key: "1alkpv" }],
    ["path", { d: "M20 4 8.12 15.88", key: "xgtan2" }],
    ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }],
    ["path", { d: "M14.8 14.8 20 20", key: "ptml3r" }]
  ];
  const Scissors = createLucideIcon("scissors", __iconNode$5X);

  const __iconNode$5W = [
    ["path", { d: "M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3", key: "i8wdob" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }],
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "m22 3-5 5", key: "12jva0" }],
    ["path", { d: "m17 3 5 5", key: "k36vhe" }]
  ];
  const ScreenShareOff = createLucideIcon("screen-share-off", __iconNode$5W);

  const __iconNode$5V = [
    ["path", { d: "M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3", key: "i8wdob" }],
    ["path", { d: "M8 21h8", key: "1ev6f3" }],
    ["path", { d: "M12 17v4", key: "1riwvh" }],
    ["path", { d: "m17 8 5-5", key: "fqif7o" }],
    ["path", { d: "M17 3h5v5", key: "1o3tu8" }]
  ];
  const ScreenShare = createLucideIcon("screen-share", __iconNode$5V);

  const __iconNode$5U = [
    ["path", { d: "M15 12h-5", key: "r7krc0" }],
    ["path", { d: "M15 8h-5", key: "1khuty" }],
    ["path", { d: "M19 17V5a2 2 0 0 0-2-2H4", key: "zz82l3" }],
    [
      "path",
      {
        d: "M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3",
        key: "1ph1d7"
      }
    ]
  ];
  const ScrollText = createLucideIcon("scroll-text", __iconNode$5U);

  const __iconNode$5T = [
    ["path", { d: "M19 17V5a2 2 0 0 0-2-2H4", key: "zz82l3" }],
    [
      "path",
      {
        d: "M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3",
        key: "1ph1d7"
      }
    ]
  ];
  const Scroll = createLucideIcon("scroll", __iconNode$5T);

  const __iconNode$5S = [
    ["path", { d: "m8 11 2 2 4-4", key: "1sed1v" }],
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
    ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }]
  ];
  const SearchCheck = createLucideIcon("search-check", __iconNode$5S);

  const __iconNode$5R = [
    ["path", { d: "m13 13.5 2-2.5-2-2.5", key: "1rvxrh" }],
    ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }],
    ["path", { d: "M9 8.5 7 11l2 2.5", key: "6ffwbx" }],
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]
  ];
  const SearchCode = createLucideIcon("search-code", __iconNode$5R);

  const __iconNode$5Q = [
    ["path", { d: "m13.5 8.5-5 5", key: "1cs55j" }],
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
    ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }]
  ];
  const SearchSlash = createLucideIcon("search-slash", __iconNode$5Q);

  const __iconNode$5P = [
    ["path", { d: "m21 21-4.34-4.34", key: "14j7rj" }],
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]
  ];
  const Search = createLucideIcon("search", __iconNode$5P);

  const __iconNode$5O = [
    ["path", { d: "m13.5 8.5-5 5", key: "1cs55j" }],
    ["path", { d: "m8.5 8.5 5 5", key: "a8mexj" }],
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
    ["path", { d: "m21 21-4.3-4.3", key: "1qie3q" }]
  ];
  const SearchX = createLucideIcon("search-x", __iconNode$5O);

  const __iconNode$5N = [
    ["path", { d: "M16 5a4 3 0 0 0-8 0c0 4 8 3 8 7a4 3 0 0 1-8 0", key: "vqan6v" }],
    ["path", { d: "M8 19a4 3 0 0 0 8 0c0-4-8-3-8-7a4 3 0 0 1 8 0", key: "wdjd8o" }]
  ];
  const Section = createLucideIcon("section", __iconNode$5N);

  const __iconNode$5M = [
    [
      "path",
      {
        d: "M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z",
        key: "117uat"
      }
    ],
    ["path", { d: "M6 12h16", key: "s4cdu5" }]
  ];
  const SendHorizontal = createLucideIcon("send-horizontal", __iconNode$5M);

  const __iconNode$5L = [
    ["rect", { x: "14", y: "14", width: "8", height: "8", rx: "2", key: "1b0bso" }],
    ["rect", { x: "2", y: "2", width: "8", height: "8", rx: "2", key: "1x09vl" }],
    ["path", { d: "M7 14v1a2 2 0 0 0 2 2h1", key: "pao6x6" }],
    ["path", { d: "M14 7h1a2 2 0 0 1 2 2v1", key: "19tdru" }]
  ];
  const SendToBack = createLucideIcon("send-to-back", __iconNode$5L);

  const __iconNode$5K = [
    [
      "path",
      {
        d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
        key: "1ffxy3"
      }
    ],
    ["path", { d: "m21.854 2.147-10.94 10.939", key: "12cjpa" }]
  ];
  const Send = createLucideIcon("send", __iconNode$5K);

  const __iconNode$5J = [
    ["path", { d: "m16 16-4 4-4-4", key: "3dv8je" }],
    ["path", { d: "M3 12h18", key: "1i2n21" }],
    ["path", { d: "m8 8 4-4 4 4", key: "2bscm2" }]
  ];
  const SeparatorHorizontal = createLucideIcon("separator-horizontal", __iconNode$5J);

  const __iconNode$5I = [
    ["path", { d: "M12 3v18", key: "108xh3" }],
    ["path", { d: "m16 16 4-4-4-4", key: "1js579" }],
    ["path", { d: "m8 8-4 4 4 4", key: "1whems" }]
  ];
  const SeparatorVertical = createLucideIcon("separator-vertical", __iconNode$5I);

  const __iconNode$5H = [
    ["path", { d: "m10.852 14.772-.383.923", key: "11vil6" }],
    ["path", { d: "M13.148 14.772a3 3 0 1 0-2.296-5.544l-.383-.923", key: "1v3clb" }],
    ["path", { d: "m13.148 9.228.383-.923", key: "t2zzyc" }],
    ["path", { d: "m13.53 15.696-.382-.924a3 3 0 1 1-2.296-5.544", key: "1bxfiv" }],
    ["path", { d: "m14.772 10.852.923-.383", key: "k9m8cz" }],
    ["path", { d: "m14.772 13.148.923.383", key: "1xvhww" }],
    [
      "path",
      {
        d: "M4.5 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-.5",
        key: "tn8das"
      }
    ],
    [
      "path",
      {
        d: "M4.5 14H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-.5",
        key: "1g2pve"
      }
    ],
    ["path", { d: "M6 18h.01", key: "uhywen" }],
    ["path", { d: "M6 6h.01", key: "1utrut" }],
    ["path", { d: "m9.228 10.852-.923-.383", key: "1wtb30" }],
    ["path", { d: "m9.228 13.148-.923.383", key: "1a830x" }]
  ];
  const ServerCog = createLucideIcon("server-cog", __iconNode$5H);

  const __iconNode$5G = [
    [
      "path",
      {
        d: "M6 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2",
        key: "4b9dqc"
      }
    ],
    [
      "path",
      {
        d: "M6 14H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2",
        key: "22nnkd"
      }
    ],
    ["path", { d: "M6 6h.01", key: "1utrut" }],
    ["path", { d: "M6 18h.01", key: "uhywen" }],
    ["path", { d: "m13 6-4 6h6l-4 6", key: "14hqih" }]
  ];
  const ServerCrash = createLucideIcon("server-crash", __iconNode$5G);

  const __iconNode$5F = [
    ["rect", { width: "20", height: "8", x: "2", y: "2", rx: "2", ry: "2", key: "ngkwjq" }],
    ["rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", ry: "2", key: "iecqi9" }],
    ["line", { x1: "6", x2: "6.01", y1: "6", y2: "6", key: "16zg32" }],
    ["line", { x1: "6", x2: "6.01", y1: "18", y2: "18", key: "nzw8ys" }]
  ];
  const Server = createLucideIcon("server", __iconNode$5F);

  const __iconNode$5E = [
    ["path", { d: "M7 2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-5", key: "bt2siv" }],
    ["path", { d: "M10 10 2.5 2.5C2 2 2 2.5 2 5v3a2 2 0 0 0 2 2h6z", key: "1hjrv1" }],
    ["path", { d: "M22 17v-1a2 2 0 0 0-2-2h-1", key: "1iynyr" }],
    ["path", { d: "M4 14a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16.5l1-.5.5.5-8-8H4z", key: "161ggg" }],
    ["path", { d: "M6 18h.01", key: "uhywen" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const ServerOff = createLucideIcon("server-off", __iconNode$5E);

  const __iconNode$5D = [
    ["path", { d: "M14 17H5", key: "gfn3mx" }],
    ["path", { d: "M19 7h-9", key: "6i9tg" }],
    ["circle", { cx: "17", cy: "17", r: "3", key: "18b49y" }],
    ["circle", { cx: "7", cy: "7", r: "3", key: "dfmy0x" }]
  ];
  const Settings2 = createLucideIcon("settings-2", __iconNode$5D);

  const __iconNode$5C = [
    [
      "path",
      {
        d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
        key: "1qme2f"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
  ];
  const Settings = createLucideIcon("settings", __iconNode$5C);

  const __iconNode$5B = [
    [
      "path",
      {
        d: "M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z",
        key: "1bo67w"
      }
    ],
    ["rect", { x: "3", y: "14", width: "7", height: "7", rx: "1", key: "1bkyp8" }],
    ["circle", { cx: "17.5", cy: "17.5", r: "3.5", key: "w3z12y" }]
  ];
  const Shapes = createLucideIcon("shapes", __iconNode$5B);

  const __iconNode$5A = [
    ["circle", { cx: "18", cy: "5", r: "3", key: "gq8acd" }],
    ["circle", { cx: "6", cy: "12", r: "3", key: "w7nqdw" }],
    ["circle", { cx: "18", cy: "19", r: "3", key: "1xt0gg" }],
    ["line", { x1: "8.59", x2: "15.42", y1: "13.51", y2: "17.49", key: "47mynk" }],
    ["line", { x1: "15.41", x2: "8.59", y1: "6.51", y2: "10.49", key: "1n3mei" }]
  ];
  const Share2 = createLucideIcon("share-2", __iconNode$5A);

  const __iconNode$5z = [
    ["path", { d: "M12 2v13", key: "1km8f5" }],
    ["path", { d: "m16 6-4-4-4 4", key: "13yo43" }],
    ["path", { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", key: "1b2hhj" }]
  ];
  const Share = createLucideIcon("share", __iconNode$5z);

  const __iconNode$5y = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["line", { x1: "3", x2: "21", y1: "9", y2: "9", key: "1vqk6q" }],
    ["line", { x1: "3", x2: "21", y1: "15", y2: "15", key: "o2sbyz" }],
    ["line", { x1: "9", x2: "9", y1: "9", y2: "21", key: "1ib60c" }],
    ["line", { x1: "15", x2: "15", y1: "9", y2: "21", key: "1n26ft" }]
  ];
  const Sheet = createLucideIcon("sheet", __iconNode$5y);

  const __iconNode$5x = [
    [
      "path",
      {
        d: "M14 11a2 2 0 1 1-4 0 4 4 0 0 1 8 0 6 6 0 0 1-12 0 8 8 0 0 1 16 0 10 10 0 1 1-20 0 11.93 11.93 0 0 1 2.42-7.22 2 2 0 1 1 3.16 2.44",
        key: "1cn552"
      }
    ]
  ];
  const Shell = createLucideIcon("shell", __iconNode$5x);

  const __iconNode$5w = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "M12 8v4", key: "1got3b" }],
    ["path", { d: "M12 16h.01", key: "1drbdi" }]
  ];
  const ShieldAlert = createLucideIcon("shield-alert", __iconNode$5w);

  const __iconNode$5v = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "m4.243 5.21 14.39 12.472", key: "1c9a7c" }]
  ];
  const ShieldBan = createLucideIcon("shield-ban", __iconNode$5v);

  const __iconNode$5u = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ];
  const ShieldCheck = createLucideIcon("shield-check", __iconNode$5u);

  const __iconNode$5t = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "M8 12h.01", key: "czm47f" }],
    ["path", { d: "M12 12h.01", key: "1mp3jc" }],
    ["path", { d: "M16 12h.01", key: "1l6xoz" }]
  ];
  const ShieldEllipsis = createLucideIcon("shield-ellipsis", __iconNode$5t);

  const __iconNode$5s = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "M12 22V2", key: "zs6s6o" }]
  ];
  const ShieldHalf = createLucideIcon("shield-half", __iconNode$5s);

  const __iconNode$5r = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "M9 12h6", key: "1c52cq" }]
  ];
  const ShieldMinus = createLucideIcon("shield-minus", __iconNode$5r);

  const __iconNode$5q = [
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    [
      "path",
      {
        d: "M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71",
        key: "1jlk70"
      }
    ],
    [
      "path",
      {
        d: "M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264",
        key: "18rp1v"
      }
    ]
  ];
  const ShieldOff = createLucideIcon("shield-off", __iconNode$5q);

  const __iconNode$5p = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "M9 12h6", key: "1c52cq" }],
    ["path", { d: "M12 9v6", key: "199k2o" }]
  ];
  const ShieldPlus = createLucideIcon("shield-plus", __iconNode$5p);

  const __iconNode$5o = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3", key: "mhlwft" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ];
  const ShieldQuestionMark = createLucideIcon("shield-question-mark", __iconNode$5o);

  const __iconNode$5n = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "M6.376 18.91a6 6 0 0 1 11.249.003", key: "hnjrf2" }],
    ["circle", { cx: "12", cy: "11", r: "4", key: "1gt34v" }]
  ];
  const ShieldUser = createLucideIcon("shield-user", __iconNode$5n);

  const __iconNode$5m = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ],
    ["path", { d: "m14.5 9.5-5 5", key: "17q4r4" }],
    ["path", { d: "m9.5 9.5 5 5", key: "18nt4w" }]
  ];
  const ShieldX = createLucideIcon("shield-x", __iconNode$5m);

  const __iconNode$5l = [
    [
      "path",
      {
        d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
        key: "oel41y"
      }
    ]
  ];
  const Shield = createLucideIcon("shield", __iconNode$5l);

  const __iconNode$5k = [
    ["circle", { cx: "12", cy: "12", r: "8", key: "46899m" }],
    ["path", { d: "M12 2v7.5", key: "1e5rl5" }],
    ["path", { d: "m19 5-5.23 5.23", key: "1ezxxf" }],
    ["path", { d: "M22 12h-7.5", key: "le1719" }],
    ["path", { d: "m19 19-5.23-5.23", key: "p3fmgn" }],
    ["path", { d: "M12 14.5V22", key: "dgcmos" }],
    ["path", { d: "M10.23 13.77 5 19", key: "qwopd4" }],
    ["path", { d: "M9.5 12H2", key: "r7bup8" }],
    ["path", { d: "M10.23 10.23 5 5", key: "k2y7lj" }],
    ["circle", { cx: "12", cy: "12", r: "2.5", key: "ix0uyj" }]
  ];
  const ShipWheel = createLucideIcon("ship-wheel", __iconNode$5k);

  const __iconNode$5j = [
    ["path", { d: "M12 10.189V14", key: "1p8cqu" }],
    ["path", { d: "M12 2v3", key: "qbqxhf" }],
    ["path", { d: "M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6", key: "qpkstq" }],
    [
      "path",
      {
        d: "M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76",
        key: "7tigtc"
      }
    ],
    [
      "path",
      {
        d: "M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
        key: "1924j5"
      }
    ]
  ];
  const Ship = createLucideIcon("ship", __iconNode$5j);

  const __iconNode$5i = [
    [
      "path",
      {
        d: "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z",
        key: "1wgbhj"
      }
    ]
  ];
  const Shirt = createLucideIcon("shirt", __iconNode$5i);

  const __iconNode$5h = [
    ["path", { d: "M16 10a4 4 0 0 1-8 0", key: "1ltviw" }],
    ["path", { d: "M3.103 6.034h17.794", key: "awc11p" }],
    [
      "path",
      {
        d: "M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z",
        key: "o988cm"
      }
    ]
  ];
  const ShoppingBag = createLucideIcon("shopping-bag", __iconNode$5h);

  const __iconNode$5g = [
    ["path", { d: "m15 11-1 9", key: "5wnq3a" }],
    ["path", { d: "m19 11-4-7", key: "cnml18" }],
    ["path", { d: "M2 11h20", key: "3eubbj" }],
    ["path", { d: "m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4", key: "yiazzp" }],
    ["path", { d: "M4.5 15.5h15", key: "13mye1" }],
    ["path", { d: "m5 11 4-7", key: "116ra9" }],
    ["path", { d: "m9 11 1 9", key: "1ojof7" }]
  ];
  const ShoppingBasket = createLucideIcon("shopping-basket", __iconNode$5g);

  const __iconNode$5f = [
    ["circle", { cx: "8", cy: "21", r: "1", key: "jimo8o" }],
    ["circle", { cx: "19", cy: "21", r: "1", key: "13723u" }],
    [
      "path",
      {
        d: "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",
        key: "9zh506"
      }
    ]
  ];
  const ShoppingCart = createLucideIcon("shopping-cart", __iconNode$5f);

  const __iconNode$5e = [
    ["path", { d: "M2 22v-5l5-5 5 5-5 5z", key: "1fh25c" }],
    ["path", { d: "M9.5 14.5 16 8", key: "1smz5x" }],
    [
      "path",
      { d: "m17 2 5 5-.5.5a3.53 3.53 0 0 1-5 0s0 0 0 0a3.53 3.53 0 0 1 0-5L17 2", key: "1q8uv5" }
    ]
  ];
  const Shovel = createLucideIcon("shovel", __iconNode$5e);

  const __iconNode$5d = [
    ["path", { d: "m4 4 2.5 2.5", key: "uv2vmf" }],
    ["path", { d: "M13.5 6.5a4.95 4.95 0 0 0-7 7", key: "frdkwv" }],
    ["path", { d: "M15 5 5 15", key: "1ag8rq" }],
    ["path", { d: "M14 17v.01", key: "eokfpp" }],
    ["path", { d: "M10 16v.01", key: "14uyyl" }],
    ["path", { d: "M13 13v.01", key: "1v1k97" }],
    ["path", { d: "M16 10v.01", key: "5169yg" }],
    ["path", { d: "M11 20v.01", key: "cj92p8" }],
    ["path", { d: "M17 14v.01", key: "11cswd" }],
    ["path", { d: "M20 11v.01", key: "19e0od" }]
  ];
  const ShowerHead = createLucideIcon("shower-head", __iconNode$5d);

  const __iconNode$5c = [
    ["path", { d: "M10 22v-5", key: "sfixh4" }],
    ["path", { d: "M14 19v-2", key: "pdve8j" }],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
    ["path", { d: "M18 20v-3", key: "uox2gk" }],
    ["path", { d: "M2 13h20", key: "5evz65" }],
    ["path", { d: "M20 13V7l-5-5H6a2 2 0 0 0-2 2v9", key: "1rnpe2" }],
    ["path", { d: "M6 20v-3", key: "c6pdcb" }]
  ];
  const Shredder = createLucideIcon("shredder", __iconNode$5c);

  const __iconNode$5b = [
    ["path", { d: "M11 12h.01", key: "1lr4k6" }],
    ["path", { d: "M13 22c.5-.5 1.12-1 2.5-1-1.38 0-2-.5-2.5-1", key: "fatpdi" }],
    [
      "path",
      {
        d: "M14 2a3.28 3.28 0 0 1-3.227 1.798l-6.17-.561A2.387 2.387 0 1 0 4.387 8H15.5a1 1 0 0 1 0 13 1 1 0 0 0 0-5H12a7 7 0 0 1-7-7V8",
        key: "kehrqe"
      }
    ],
    ["path", { d: "M14 8a8.5 8.5 0 0 1 0 8", key: "1imjx2" }],
    ["path", { d: "M16 16c2 0 4.5-4 4-6", key: "z0nejz" }]
  ];
  const Shrimp = createLucideIcon("shrimp", __iconNode$5b);

  const __iconNode$5a = [
    ["path", { d: "m15 15 6 6m-6-6v4.8m0-4.8h4.8", key: "17vawe" }],
    ["path", { d: "M9 19.8V15m0 0H4.2M9 15l-6 6", key: "chjx8e" }],
    ["path", { d: "M15 4.2V9m0 0h4.8M15 9l6-6", key: "lav6yq" }],
    ["path", { d: "M9 4.2V9m0 0H4.2M9 9 3 3", key: "1pxi2q" }]
  ];
  const Shrink = createLucideIcon("shrink", __iconNode$5a);

  const __iconNode$59 = [
    ["path", { d: "M12 22v-7l-2-2", key: "eqv9mc" }],
    ["path", { d: "M17 8v.8A6 6 0 0 1 13.8 20H10A6.5 6.5 0 0 1 7 8a5 5 0 0 1 10 0Z", key: "ubcgy" }],
    ["path", { d: "m14 14-2 2", key: "847xa2" }]
  ];
  const Shrub = createLucideIcon("shrub", __iconNode$59);

  const __iconNode$58 = [
    ["path", { d: "m18 14 4 4-4 4", key: "10pe0f" }],
    ["path", { d: "m18 2 4 4-4 4", key: "pucp1d" }],
    ["path", { d: "M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22", key: "1ailkh" }],
    ["path", { d: "M2 6h1.972a4 4 0 0 1 3.6 2.2", key: "km57vx" }],
    ["path", { d: "M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45", key: "os18l9" }]
  ];
  const Shuffle = createLucideIcon("shuffle", __iconNode$58);

  const __iconNode$57 = [
    [
      "path",
      {
        d: "M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2",
        key: "wuwx1p"
      }
    ]
  ];
  const Sigma = createLucideIcon("sigma", __iconNode$57);

  const __iconNode$56 = [
    ["path", { d: "M2 20h.01", key: "4haj6o" }],
    ["path", { d: "M7 20v-4", key: "j294jx" }],
    ["path", { d: "M12 20v-8", key: "i3yub9" }],
    ["path", { d: "M17 20V8", key: "1tkaf5" }]
  ];
  const SignalHigh = createLucideIcon("signal-high", __iconNode$56);

  const __iconNode$55 = [
    ["path", { d: "M2 20h.01", key: "4haj6o" }],
    ["path", { d: "M7 20v-4", key: "j294jx" }]
  ];
  const SignalLow = createLucideIcon("signal-low", __iconNode$55);

  const __iconNode$54 = [
    ["path", { d: "M2 20h.01", key: "4haj6o" }],
    ["path", { d: "M7 20v-4", key: "j294jx" }],
    ["path", { d: "M12 20v-8", key: "i3yub9" }]
  ];
  const SignalMedium = createLucideIcon("signal-medium", __iconNode$54);

  const __iconNode$53 = [["path", { d: "M2 20h.01", key: "4haj6o" }]];
  const SignalZero = createLucideIcon("signal-zero", __iconNode$53);

  const __iconNode$52 = [
    ["path", { d: "M2 20h.01", key: "4haj6o" }],
    ["path", { d: "M7 20v-4", key: "j294jx" }],
    ["path", { d: "M12 20v-8", key: "i3yub9" }],
    ["path", { d: "M17 20V8", key: "1tkaf5" }],
    ["path", { d: "M22 4v16", key: "sih9yq" }]
  ];
  const Signal = createLucideIcon("signal", __iconNode$52);

  const __iconNode$51 = [
    [
      "path",
      {
        d: "m21 17-2.156-1.868A.5.5 0 0 0 18 15.5v.5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1c0-2.545-3.991-3.97-8.5-4a1 1 0 0 0 0 5c4.153 0 4.745-11.295 5.708-13.5a2.5 2.5 0 1 1 3.31 3.284",
        key: "y32ogt"
      }
    ],
    ["path", { d: "M3 21h18", key: "itz85i" }]
  ];
  const Signature = createLucideIcon("signature", __iconNode$51);

  const __iconNode$50 = [
    ["path", { d: "M10 9H4L2 7l2-2h6", key: "1hq7x2" }],
    ["path", { d: "M14 5h6l2 2-2 2h-6", key: "bv62ej" }],
    ["path", { d: "M10 22V4a2 2 0 1 1 4 0v18", key: "eqpcf2" }],
    ["path", { d: "M8 22h8", key: "rmew8v" }]
  ];
  const SignpostBig = createLucideIcon("signpost-big", __iconNode$50);

  const __iconNode$4$ = [
    ["path", { d: "M12 13v8", key: "1l5pq0" }],
    ["path", { d: "M12 3v3", key: "1n5kay" }],
    [
      "path",
      {
        d: "M18 6a2 2 0 0 1 1.387.56l2.307 2.22a1 1 0 0 1 0 1.44l-2.307 2.22A2 2 0 0 1 18 13H6a2 2 0 0 1-1.387-.56l-2.306-2.22a1 1 0 0 1 0-1.44l2.306-2.22A2 2 0 0 1 6 6z",
        key: "gqqp9m"
      }
    ]
  ];
  const Signpost = createLucideIcon("signpost", __iconNode$4$);

  const __iconNode$4_ = [
    ["path", { d: "M7 18v-6a5 5 0 1 1 10 0v6", key: "pcx96s" }],
    [
      "path",
      { d: "M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z", key: "1b4s83" }
    ],
    ["path", { d: "M21 12h1", key: "jtio3y" }],
    ["path", { d: "M18.5 4.5 18 5", key: "g5sp9y" }],
    ["path", { d: "M2 12h1", key: "1uaihz" }],
    ["path", { d: "M12 2v1", key: "11qlp1" }],
    ["path", { d: "m4.929 4.929.707.707", key: "1i51kw" }],
    ["path", { d: "M12 12v6", key: "3ahymv" }]
  ];
  const Siren = createLucideIcon("siren", __iconNode$4_);

  const __iconNode$4Z = [
    ["polygon", { points: "19 20 9 12 19 4 19 20", key: "o2sva" }],
    ["line", { x1: "5", x2: "5", y1: "19", y2: "5", key: "1ocqjk" }]
  ];
  const SkipBack = createLucideIcon("skip-back", __iconNode$4Z);

  const __iconNode$4Y = [
    ["polygon", { points: "5 4 15 12 5 20 5 4", key: "16p6eg" }],
    ["line", { x1: "19", x2: "19", y1: "5", y2: "19", key: "futhcm" }]
  ];
  const SkipForward = createLucideIcon("skip-forward", __iconNode$4Y);

  const __iconNode$4X = [
    ["path", { d: "m12.5 17-.5-1-.5 1h1z", key: "3me087" }],
    [
      "path",
      {
        d: "M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z",
        key: "1o5pge"
      }
    ],
    ["circle", { cx: "15", cy: "12", r: "1", key: "1tmaij" }],
    ["circle", { cx: "9", cy: "12", r: "1", key: "1vctgf" }]
  ];
  const Skull = createLucideIcon("skull", __iconNode$4X);

  const __iconNode$4W = [
    ["rect", { width: "3", height: "8", x: "13", y: "2", rx: "1.5", key: "diqz80" }],
    ["path", { d: "M19 8.5V10h1.5A1.5 1.5 0 1 0 19 8.5", key: "183iwg" }],
    ["rect", { width: "3", height: "8", x: "8", y: "14", rx: "1.5", key: "hqg7r1" }],
    ["path", { d: "M5 15.5V14H3.5A1.5 1.5 0 1 0 5 15.5", key: "76g71w" }],
    ["rect", { width: "8", height: "3", x: "14", y: "13", rx: "1.5", key: "1kmz0a" }],
    ["path", { d: "M15.5 19H14v1.5a1.5 1.5 0 1 0 1.5-1.5", key: "jc4sz0" }],
    ["rect", { width: "8", height: "3", x: "2", y: "8", rx: "1.5", key: "1omvl4" }],
    ["path", { d: "M8.5 5H10V3.5A1.5 1.5 0 1 0 8.5 5", key: "16f3cl" }]
  ];
  const Slack = createLucideIcon("slack", __iconNode$4W);

  const __iconNode$4V = [["path", { d: "M22 2 2 22", key: "y4kqgn" }]];
  const Slash = createLucideIcon("slash", __iconNode$4V);

  const __iconNode$4U = [
    [
      "path",
      {
        d: "M11 16.586V19a1 1 0 0 1-1 1H2L18.37 3.63a1 1 0 1 1 3 3l-9.663 9.663a1 1 0 0 1-1.414 0L8 14",
        key: "1sllp5"
      }
    ]
  ];
  const Slice = createLucideIcon("slice", __iconNode$4U);

  const __iconNode$4T = [
    ["line", { x1: "21", x2: "14", y1: "4", y2: "4", key: "obuewd" }],
    ["line", { x1: "10", x2: "3", y1: "4", y2: "4", key: "1q6298" }],
    ["line", { x1: "21", x2: "12", y1: "12", y2: "12", key: "1iu8h1" }],
    ["line", { x1: "8", x2: "3", y1: "12", y2: "12", key: "ntss68" }],
    ["line", { x1: "21", x2: "16", y1: "20", y2: "20", key: "14d8ph" }],
    ["line", { x1: "12", x2: "3", y1: "20", y2: "20", key: "m0wm8r" }],
    ["line", { x1: "14", x2: "14", y1: "2", y2: "6", key: "14e1ph" }],
    ["line", { x1: "8", x2: "8", y1: "10", y2: "14", key: "1i6ji0" }],
    ["line", { x1: "16", x2: "16", y1: "18", y2: "22", key: "1lctlv" }]
  ];
  const SlidersHorizontal = createLucideIcon("sliders-horizontal", __iconNode$4T);

  const __iconNode$4S = [
    ["line", { x1: "4", x2: "4", y1: "21", y2: "14", key: "1p332r" }],
    ["line", { x1: "4", x2: "4", y1: "10", y2: "3", key: "gb41h5" }],
    ["line", { x1: "12", x2: "12", y1: "21", y2: "12", key: "hf2csr" }],
    ["line", { x1: "12", x2: "12", y1: "8", y2: "3", key: "1kfi7u" }],
    ["line", { x1: "20", x2: "20", y1: "21", y2: "16", key: "1lhrwl" }],
    ["line", { x1: "20", x2: "20", y1: "12", y2: "3", key: "16vvfq" }],
    ["line", { x1: "2", x2: "6", y1: "14", y2: "14", key: "1uebub" }],
    ["line", { x1: "10", x2: "14", y1: "8", y2: "8", key: "1yglbp" }],
    ["line", { x1: "18", x2: "22", y1: "16", y2: "16", key: "1jxqpz" }]
  ];
  const SlidersVertical = createLucideIcon("sliders-vertical", __iconNode$4S);

  const __iconNode$4R = [
    ["rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", ry: "2", key: "1yt0o3" }],
    ["path", { d: "M12.667 8 10 12h4l-2.667 4", key: "h9lk2d" }]
  ];
  const SmartphoneCharging = createLucideIcon("smartphone-charging", __iconNode$4R);

  const __iconNode$4Q = [
    ["rect", { width: "7", height: "12", x: "2", y: "6", rx: "1", key: "5nje8w" }],
    ["path", { d: "M13 8.32a7.43 7.43 0 0 1 0 7.36", key: "1g306n" }],
    ["path", { d: "M16.46 6.21a11.76 11.76 0 0 1 0 11.58", key: "uqvjvo" }],
    ["path", { d: "M19.91 4.1a15.91 15.91 0 0 1 .01 15.8", key: "ujntz3" }]
  ];
  const SmartphoneNfc = createLucideIcon("smartphone-nfc", __iconNode$4Q);

  const __iconNode$4P = [
    ["rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", ry: "2", key: "1yt0o3" }],
    ["path", { d: "M12 18h.01", key: "mhygvu" }]
  ];
  const Smartphone = createLucideIcon("smartphone", __iconNode$4P);

  const __iconNode$4O = [
    ["path", { d: "M22 11v1a10 10 0 1 1-9-10", key: "ew0xw9" }],
    ["path", { d: "M8 14s1.5 2 4 2 4-2 4-2", key: "1y1vjs" }],
    ["line", { x1: "9", x2: "9.01", y1: "9", y2: "9", key: "yxxnd0" }],
    ["line", { x1: "15", x2: "15.01", y1: "9", y2: "9", key: "1p4y9e" }],
    ["path", { d: "M16 5h6", key: "1vod17" }],
    ["path", { d: "M19 2v6", key: "4bpg5p" }]
  ];
  const SmilePlus = createLucideIcon("smile-plus", __iconNode$4O);

  const __iconNode$4N = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M8 14s1.5 2 4 2 4-2 4-2", key: "1y1vjs" }],
    ["line", { x1: "9", x2: "9.01", y1: "9", y2: "9", key: "yxxnd0" }],
    ["line", { x1: "15", x2: "15.01", y1: "9", y2: "9", key: "1p4y9e" }]
  ];
  const Smile = createLucideIcon("smile", __iconNode$4N);

  const __iconNode$4M = [
    ["path", { d: "M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0", key: "hneq2s" }],
    ["circle", { cx: "10", cy: "13", r: "8", key: "194lz3" }],
    ["path", { d: "M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6", key: "ixqyt7" }],
    ["path", { d: "M18 3 19.1 5.2", key: "9tjm43" }],
    ["path", { d: "M22 3 20.9 5.2", key: "j3odrs" }]
  ];
  const Snail = createLucideIcon("snail", __iconNode$4M);

  const __iconNode$4L = [
    ["path", { d: "m10 20-1.25-2.5L6 18", key: "18frcb" }],
    ["path", { d: "M10 4 8.75 6.5 6 6", key: "7mghy3" }],
    ["path", { d: "m14 20 1.25-2.5L18 18", key: "1chtki" }],
    ["path", { d: "m14 4 1.25 2.5L18 6", key: "1b4wsy" }],
    ["path", { d: "m17 21-3-6h-4", key: "15hhxa" }],
    ["path", { d: "m17 3-3 6 1.5 3", key: "11697g" }],
    ["path", { d: "M2 12h6.5L10 9", key: "kv9z4n" }],
    ["path", { d: "m20 10-1.5 2 1.5 2", key: "1swlpi" }],
    ["path", { d: "M22 12h-6.5L14 15", key: "1mxi28" }],
    ["path", { d: "m4 10 1.5 2L4 14", key: "k9enpj" }],
    ["path", { d: "m7 21 3-6-1.5-3", key: "j8hb9u" }],
    ["path", { d: "m7 3 3 6h4", key: "1otusx" }]
  ];
  const Snowflake = createLucideIcon("snowflake", __iconNode$4L);

  const __iconNode$4K = [
    ["path", { d: "M10.5 2v4", key: "1xt6in" }],
    ["path", { d: "M14 2H7a2 2 0 0 0-2 2", key: "e6xig3" }],
    [
      "path",
      {
        d: "M19.29 14.76A6.67 6.67 0 0 1 17 11a6.6 6.6 0 0 1-2.29 3.76c-1.15.92-1.71 2.04-1.71 3.19 0 2.22 1.8 4.05 4 4.05s4-1.83 4-4.05c0-1.16-.57-2.26-1.71-3.19",
        key: "adq7uc"
      }
    ],
    [
      "path",
      {
        d: "M9.607 21H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h7V7a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3",
        key: "t9hm96"
      }
    ]
  ];
  const SoapDispenserDroplet = createLucideIcon("soap-dispenser-droplet", __iconNode$4K);

  const __iconNode$4J = [
    ["path", { d: "M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3", key: "1dgpiv" }],
    [
      "path",
      {
        d: "M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z",
        key: "xacw8m"
      }
    ],
    ["path", { d: "M4 18v2", key: "jwo5n2" }],
    ["path", { d: "M20 18v2", key: "1ar1qi" }],
    ["path", { d: "M12 4v9", key: "oqhhn3" }]
  ];
  const Sofa = createLucideIcon("sofa", __iconNode$4J);

  const __iconNode$4I = [
    ["path", { d: "M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z", key: "4rw317" }],
    ["path", { d: "M7 21h10", key: "1b0cd5" }],
    ["path", { d: "M19.5 12 22 6", key: "shfsr5" }],
    [
      "path",
      {
        d: "M16.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.73 1.62",
        key: "rpc6vp"
      }
    ],
    [
      "path",
      {
        d: "M11.25 3c.27.1.8.53.74 1.36-.05.83-.93 1.2-.98 2.02-.06.78.33 1.24.72 1.62",
        key: "1lf63m"
      }
    ],
    [
      "path",
      { d: "M6.25 3c.27.1.8.53.75 1.36-.06.83-.93 1.2-1 2.02-.05.78.34 1.24.74 1.62", key: "97tijn" }
    ]
  ];
  const Soup = createLucideIcon("soup", __iconNode$4I);

  const __iconNode$4H = [
    ["path", { d: "M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1", key: "lt2kga" }]
  ];
  const Space = createLucideIcon("space", __iconNode$4H);

  const __iconNode$4G = [
    [
      "path",
      {
        d: "M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z",
        key: "40bo9n"
      }
    ],
    ["path", { d: "M12 18v4", key: "jadmvz" }]
  ];
  const Spade = createLucideIcon("spade", __iconNode$4G);

  const __iconNode$4F = [
    [
      "path",
      {
        d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
        key: "4pj2yx"
      }
    ]
  ];
  const Sparkle = createLucideIcon("sparkle", __iconNode$4F);

  const __iconNode$4E = [
    [
      "path",
      {
        d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
        key: "4pj2yx"
      }
    ],
    ["path", { d: "M20 3v4", key: "1olli1" }],
    ["path", { d: "M22 5h-4", key: "1gvqau" }],
    ["path", { d: "M4 17v2", key: "vumght" }],
    ["path", { d: "M5 18H3", key: "zchphs" }]
  ];
  const Sparkles = createLucideIcon("sparkles", __iconNode$4E);

  const __iconNode$4D = [
    ["rect", { width: "16", height: "20", x: "4", y: "2", rx: "2", key: "1nb95v" }],
    ["path", { d: "M12 6h.01", key: "1vi96p" }],
    ["circle", { cx: "12", cy: "14", r: "4", key: "1jruaj" }],
    ["path", { d: "M12 14h.01", key: "1etili" }]
  ];
  const Speaker = createLucideIcon("speaker", __iconNode$4D);

  const __iconNode$4C = [
    [
      "path",
      {
        d: "M8.8 20v-4.1l1.9.2a2.3 2.3 0 0 0 2.164-2.1V8.3A5.37 5.37 0 0 0 2 8.25c0 2.8.656 3.054 1 4.55a5.77 5.77 0 0 1 .029 2.758L2 20",
        key: "11atix"
      }
    ],
    ["path", { d: "M19.8 17.8a7.5 7.5 0 0 0 .003-10.603", key: "yol142" }],
    ["path", { d: "M17 15a3.5 3.5 0 0 0-.025-4.975", key: "ssbmkc" }]
  ];
  const Speech = createLucideIcon("speech", __iconNode$4C);

  const __iconNode$4B = [
    ["path", { d: "m6 16 6-12 6 12", key: "1b4byz" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
    [
      "path",
      {
        d: "M4 21c1.1 0 1.1-1 2.3-1s1.1 1 2.3 1c1.1 0 1.1-1 2.3-1 1.1 0 1.1 1 2.3 1 1.1 0 1.1-1 2.3-1 1.1 0 1.1 1 2.3 1 1.1 0 1.1-1 2.3-1",
        key: "8mdmtu"
      }
    ]
  ];
  const SpellCheck2 = createLucideIcon("spell-check-2", __iconNode$4B);

  const __iconNode$4A = [
    ["path", { d: "m6 16 6-12 6 12", key: "1b4byz" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
    ["path", { d: "m16 20 2 2 4-4", key: "13tcca" }]
  ];
  const SpellCheck = createLucideIcon("spell-check", __iconNode$4A);

  const __iconNode$4z = [
    [
      "path",
      {
        d: "M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z",
        key: "xwnzip"
      }
    ],
    ["path", { d: "M5 17A12 12 0 0 1 17 5", key: "1okkup" }],
    ["circle", { cx: "19", cy: "5", r: "2", key: "mhkx31" }],
    ["circle", { cx: "5", cy: "19", r: "2", key: "v8kfzx" }]
  ];
  const SplinePointer = createLucideIcon("spline-pointer", __iconNode$4z);

  const __iconNode$4y = [
    ["circle", { cx: "19", cy: "5", r: "2", key: "mhkx31" }],
    ["circle", { cx: "5", cy: "19", r: "2", key: "v8kfzx" }],
    ["path", { d: "M5 17A12 12 0 0 1 17 5", key: "1okkup" }]
  ];
  const Spline = createLucideIcon("spline", __iconNode$4y);

  const __iconNode$4x = [
    ["path", { d: "M16 3h5v5", key: "1806ms" }],
    ["path", { d: "M8 3H3v5", key: "15dfkv" }],
    ["path", { d: "M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3", key: "1qrqzj" }],
    ["path", { d: "m15 9 6-6", key: "ko1vev" }]
  ];
  const Split = createLucideIcon("split", __iconNode$4x);

  const __iconNode$4w = [
    [
      "path",
      {
        d: "M17 13.44 4.442 17.082A2 2 0 0 0 4.982 21H19a2 2 0 0 0 .558-3.921l-1.115-.32A2 2 0 0 1 17 14.837V7.66",
        key: "13vns8"
      }
    ],
    [
      "path",
      {
        d: "m7 10.56 12.558-3.642A2 2 0 0 0 19.018 3H5a2 2 0 0 0-.558 3.921l1.115.32A2 2 0 0 1 7 9.163v7.178",
        key: "s8x3u0"
      }
    ]
  ];
  const Spool = createLucideIcon("spool", __iconNode$4w);

  const __iconNode$4v = [
    ["path", { d: "M3 3h.01", key: "159qn6" }],
    ["path", { d: "M7 5h.01", key: "1hq22a" }],
    ["path", { d: "M11 7h.01", key: "1osv80" }],
    ["path", { d: "M3 7h.01", key: "1xzrh3" }],
    ["path", { d: "M7 9h.01", key: "19b3jx" }],
    ["path", { d: "M3 11h.01", key: "1eifu7" }],
    ["rect", { width: "4", height: "4", x: "15", y: "5", key: "mri9e4" }],
    ["path", { d: "m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2", key: "aib6hk" }],
    ["path", { d: "m13 14 8-2", key: "1d7bmk" }],
    ["path", { d: "m13 19 8-2", key: "1y2vml" }]
  ];
  const SprayCan = createLucideIcon("spray-can", __iconNode$4v);

  const __iconNode$4u = [
    ["path", { d: "M7 20h10", key: "e6iznv" }],
    ["path", { d: "M10 20c5.5-2.5.8-6.4 3-10", key: "161w41" }],
    [
      "path",
      {
        d: "M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z",
        key: "9gtqwd"
      }
    ],
    [
      "path",
      {
        d: "M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z",
        key: "bkxnd2"
      }
    ]
  ];
  const Sprout = createLucideIcon("sprout", __iconNode$4u);

  const __iconNode$4t = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M17 12h-2l-2 5-2-10-2 5H7", key: "15hlnc" }]
  ];
  const SquareActivity = createLucideIcon("square-activity", __iconNode$4t);

  const __iconNode$4s = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m16 8-8 8", key: "166keh" }],
    ["path", { d: "M16 16H8V8", key: "1w2ppm" }]
  ];
  const SquareArrowDownLeft = createLucideIcon("square-arrow-down-left", __iconNode$4s);

  const __iconNode$4r = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m8 8 8 8", key: "1imecy" }],
    ["path", { d: "M16 8v8H8", key: "1lbpgo" }]
  ];
  const SquareArrowDownRight = createLucideIcon("square-arrow-down-right", __iconNode$4r);

  const __iconNode$4q = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M12 8v8", key: "napkw2" }],
    ["path", { d: "m8 12 4 4 4-4", key: "k98ssh" }]
  ];
  const SquareArrowDown = createLucideIcon("square-arrow-down", __iconNode$4q);

  const __iconNode$4p = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m12 8-4 4 4 4", key: "15vm53" }],
    ["path", { d: "M16 12H8", key: "1fr5h0" }]
  ];
  const SquareArrowLeft = createLucideIcon("square-arrow-left", __iconNode$4p);

  const __iconNode$4o = [
    ["path", { d: "M13 21h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6", key: "14qz4y" }],
    ["path", { d: "m3 21 9-9", key: "1jfql5" }],
    ["path", { d: "M9 21H3v-6", key: "wtvkvv" }]
  ];
  const SquareArrowOutDownLeft = createLucideIcon("square-arrow-out-down-left", __iconNode$4o);

  const __iconNode$4n = [
    ["path", { d: "M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6", key: "14rsvq" }],
    ["path", { d: "m21 21-9-9", key: "1et2py" }],
    ["path", { d: "M21 15v6h-6", key: "1jko0i" }]
  ];
  const SquareArrowOutDownRight = createLucideIcon("square-arrow-out-down-right", __iconNode$4n);

  const __iconNode$4m = [
    ["path", { d: "M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6", key: "14mv1t" }],
    ["path", { d: "m3 3 9 9", key: "rks13r" }],
    ["path", { d: "M3 9V3h6", key: "ira0h2" }]
  ];
  const SquareArrowOutUpLeft = createLucideIcon("square-arrow-out-up-left", __iconNode$4m);

  const __iconNode$4l = [
    ["path", { d: "M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6", key: "y09zxi" }],
    ["path", { d: "m21 3-9 9", key: "mpx6sq" }],
    ["path", { d: "M15 3h6v6", key: "1q9fwt" }]
  ];
  const SquareArrowOutUpRight = createLucideIcon("square-arrow-out-up-right", __iconNode$4l);

  const __iconNode$4k = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
    ["path", { d: "m12 16 4-4-4-4", key: "1i9zcv" }]
  ];
  const SquareArrowRight = createLucideIcon("square-arrow-right", __iconNode$4k);

  const __iconNode$4j = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M8 16V8h8", key: "19xb1h" }],
    ["path", { d: "M16 16 8 8", key: "1qdy8n" }]
  ];
  const SquareArrowUpLeft = createLucideIcon("square-arrow-up-left", __iconNode$4j);

  const __iconNode$4i = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M8 8h8v8", key: "b65dnt" }],
    ["path", { d: "m8 16 8-8", key: "13b9ih" }]
  ];
  const SquareArrowUpRight = createLucideIcon("square-arrow-up-right", __iconNode$4i);

  const __iconNode$4h = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m16 12-4-4-4 4", key: "177agl" }],
    ["path", { d: "M12 16V8", key: "1sbj14" }]
  ];
  const SquareArrowUp = createLucideIcon("square-arrow-up", __iconNode$4h);

  const __iconNode$4g = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M12 8v8", key: "napkw2" }],
    ["path", { d: "m8.5 14 7-4", key: "12hpby" }],
    ["path", { d: "m8.5 10 7 4", key: "wwy2dy" }]
  ];
  const SquareAsterisk = createLucideIcon("square-asterisk", __iconNode$4g);

  const __iconNode$4f = [
    [
      "path",
      { d: "M4 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2", key: "1vzg26" }
    ],
    ["path", { d: "M10 22H8", key: "euku7a" }],
    ["path", { d: "M16 22h-2", key: "18d249" }],
    ["circle", { cx: "8", cy: "8", r: "2", key: "14cg06" }],
    ["path", { d: "M9.414 9.414 12 12", key: "qz4lzr" }],
    ["path", { d: "M14.8 14.8 18 18", key: "11flf1" }],
    ["circle", { cx: "8", cy: "16", r: "2", key: "1acxsx" }],
    ["path", { d: "m18 6-8.586 8.586", key: "11kzk1" }]
  ];
  const SquareBottomDashedScissors = createLucideIcon("square-bottom-dashed-scissors", __iconNode$4f);

  const __iconNode$4e = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M9 8h7", key: "kbo1nt" }],
    ["path", { d: "M8 12h6", key: "ikassy" }],
    ["path", { d: "M11 16h5", key: "oq65wt" }]
  ];
  const SquareChartGantt = createLucideIcon("square-chart-gantt", __iconNode$4e);

  const __iconNode$4d = [
    [
      "path",
      { d: "M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344", key: "2acyp4" }
    ],
    ["path", { d: "m9 11 3 3L22 4", key: "1pflzl" }]
  ];
  const SquareCheckBig = createLucideIcon("square-check-big", __iconNode$4d);

  const __iconNode$4c = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ];
  const SquareCheck = createLucideIcon("square-check", __iconNode$4c);

  const __iconNode$4b = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m16 10-4 4-4-4", key: "894hmk" }]
  ];
  const SquareChevronDown = createLucideIcon("square-chevron-down", __iconNode$4b);

  const __iconNode$4a = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m14 16-4-4 4-4", key: "ojs7w8" }]
  ];
  const SquareChevronLeft = createLucideIcon("square-chevron-left", __iconNode$4a);

  const __iconNode$49 = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m10 8 4 4-4 4", key: "1wy4r4" }]
  ];
  const SquareChevronRight = createLucideIcon("square-chevron-right", __iconNode$49);

  const __iconNode$48 = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m8 14 4-4 4 4", key: "fy2ptz" }]
  ];
  const SquareChevronUp = createLucideIcon("square-chevron-up", __iconNode$48);

  const __iconNode$47 = [
    ["path", { d: "m10 9-3 3 3 3", key: "1oro0q" }],
    ["path", { d: "m14 15 3-3-3-3", key: "bz13h7" }],
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", key: "h1oib" }]
  ];
  const SquareCode = createLucideIcon("square-code", __iconNode$47);

  const __iconNode$46 = [
    ["path", { d: "M10 9.5 8 12l2 2.5", key: "3mjy60" }],
    ["path", { d: "M14 21h1", key: "v9vybs" }],
    ["path", { d: "m14 9.5 2 2.5-2 2.5", key: "1bir2l" }],
    [
      "path",
      { d: "M5 21a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2", key: "as5y1o" }
    ],
    ["path", { d: "M9 21h1", key: "15o7lz" }]
  ];
  const SquareDashedBottomCode = createLucideIcon("square-dashed-bottom-code", __iconNode$46);

  const __iconNode$45 = [
    [
      "path",
      { d: "M5 21a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2", key: "as5y1o" }
    ],
    ["path", { d: "M9 21h1", key: "15o7lz" }],
    ["path", { d: "M14 21h1", key: "v9vybs" }]
  ];
  const SquareDashedBottom = createLucideIcon("square-dashed-bottom", __iconNode$45);

  const __iconNode$44 = [
    ["path", { d: "M8 7v7", key: "1x2jlm" }],
    ["path", { d: "M12 7v4", key: "xawao1" }],
    ["path", { d: "M16 7v9", key: "1hp2iy" }],
    ["path", { d: "M5 3a2 2 0 0 0-2 2", key: "y57alp" }],
    ["path", { d: "M9 3h1", key: "1yesri" }],
    ["path", { d: "M14 3h1", key: "1ec4yj" }],
    ["path", { d: "M19 3a2 2 0 0 1 2 2", key: "18rm91" }],
    ["path", { d: "M21 9v1", key: "mxsmne" }],
    ["path", { d: "M21 14v1", key: "169vum" }],
    ["path", { d: "M21 19a2 2 0 0 1-2 2", key: "1j7049" }],
    ["path", { d: "M14 21h1", key: "v9vybs" }],
    ["path", { d: "M9 21h1", key: "15o7lz" }],
    ["path", { d: "M5 21a2 2 0 0 1-2-2", key: "sbafld" }],
    ["path", { d: "M3 14v1", key: "vnatye" }],
    ["path", { d: "M3 9v1", key: "1r0deq" }]
  ];
  const SquareDashedKanban = createLucideIcon("square-dashed-kanban", __iconNode$44);

  const __iconNode$43 = [
    [
      "path",
      {
        d: "M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z",
        key: "xwnzip"
      }
    ],
    ["path", { d: "M5 3a2 2 0 0 0-2 2", key: "y57alp" }],
    ["path", { d: "M19 3a2 2 0 0 1 2 2", key: "18rm91" }],
    ["path", { d: "M5 21a2 2 0 0 1-2-2", key: "sbafld" }],
    ["path", { d: "M9 3h1", key: "1yesri" }],
    ["path", { d: "M9 21h2", key: "1qve2z" }],
    ["path", { d: "M14 3h1", key: "1ec4yj" }],
    ["path", { d: "M3 9v1", key: "1r0deq" }],
    ["path", { d: "M21 9v2", key: "p14lih" }],
    ["path", { d: "M3 14v1", key: "vnatye" }]
  ];
  const SquareDashedMousePointer = createLucideIcon("square-dashed-mouse-pointer", __iconNode$43);

  const __iconNode$42 = [
    ["path", { d: "M14 21h1", key: "v9vybs" }],
    ["path", { d: "M21 14v1", key: "169vum" }],
    ["path", { d: "M21 19a2 2 0 0 1-2 2", key: "1j7049" }],
    ["path", { d: "M21 9v1", key: "mxsmne" }],
    ["path", { d: "M3 14v1", key: "vnatye" }],
    ["path", { d: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2", key: "89voep" }],
    ["path", { d: "M3 9v1", key: "1r0deq" }],
    ["path", { d: "M5 21a2 2 0 0 1-2-2", key: "sbafld" }],
    ["path", { d: "M9 21h1", key: "15o7lz" }]
  ];
  const SquareDashedTopSolid = createLucideIcon("square-dashed-top-solid", __iconNode$42);

  const __iconNode$41 = [
    ["path", { d: "M5 3a2 2 0 0 0-2 2", key: "y57alp" }],
    ["path", { d: "M19 3a2 2 0 0 1 2 2", key: "18rm91" }],
    ["path", { d: "M21 19a2 2 0 0 1-2 2", key: "1j7049" }],
    ["path", { d: "M5 21a2 2 0 0 1-2-2", key: "sbafld" }],
    ["path", { d: "M9 3h1", key: "1yesri" }],
    ["path", { d: "M9 21h1", key: "15o7lz" }],
    ["path", { d: "M14 3h1", key: "1ec4yj" }],
    ["path", { d: "M14 21h1", key: "v9vybs" }],
    ["path", { d: "M3 9v1", key: "1r0deq" }],
    ["path", { d: "M21 9v1", key: "mxsmne" }],
    ["path", { d: "M3 14v1", key: "vnatye" }],
    ["path", { d: "M21 14v1", key: "169vum" }]
  ];
  const SquareDashed = createLucideIcon("square-dashed", __iconNode$41);

  const __iconNode$40 = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["line", { x1: "8", x2: "16", y1: "12", y2: "12", key: "1jonct" }],
    ["line", { x1: "12", x2: "12", y1: "16", y2: "16", key: "aqc6ln" }],
    ["line", { x1: "12", x2: "12", y1: "8", y2: "8", key: "1mkcni" }]
  ];
  const SquareDivide = createLucideIcon("square-divide", __iconNode$40);

  const __iconNode$3$ = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }]
  ];
  const SquareDot = createLucideIcon("square-dot", __iconNode$3$);

  const __iconNode$3_ = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M7 10h10", key: "1101jm" }],
    ["path", { d: "M7 14h10", key: "1mhdw3" }]
  ];
  const SquareEqual = createLucideIcon("square-equal", __iconNode$3_);

  const __iconNode$3Z = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["path", { d: "M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3", key: "m1af9g" }],
    ["path", { d: "M9 11.2h5.7", key: "3zgcl2" }]
  ];
  const SquareFunction = createLucideIcon("square-function", __iconNode$3Z);

  const __iconNode$3Y = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M8 7v7", key: "1x2jlm" }],
    ["path", { d: "M12 7v4", key: "xawao1" }],
    ["path", { d: "M16 7v9", key: "1hp2iy" }]
  ];
  const SquareKanban = createLucideIcon("square-kanban", __iconNode$3Y);

  const __iconNode$3X = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M7 7v10", key: "d5nglc" }],
    ["path", { d: "M11 7v10", key: "pptsnr" }],
    ["path", { d: "m15 7 2 10", key: "1m7qm5" }]
  ];
  const SquareLibrary = createLucideIcon("square-library", __iconNode$3X);

  const __iconNode$3W = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M8 16V8l4 4 4-4v8", key: "141u4e" }]
  ];
  const SquareM = createLucideIcon("square-m", __iconNode$3W);

  const __iconNode$3V = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }]
  ];
  const SquareMinus = createLucideIcon("square-minus", __iconNode$3V);

  const __iconNode$3U = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M7 8h10", key: "1jw688" }],
    ["path", { d: "M7 12h10", key: "b7w52i" }],
    ["path", { d: "M7 16h10", key: "wp8him" }]
  ];
  const SquareMenu = createLucideIcon("square-menu", __iconNode$3U);

  const __iconNode$3T = [
    [
      "path",
      {
        d: "M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z",
        key: "xwnzip"
      }
    ],
    ["path", { d: "M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6", key: "14rsvq" }]
  ];
  const SquareMousePointer = createLucideIcon("square-mouse-pointer", __iconNode$3T);

  const __iconNode$3S = [
    ["path", { d: "M3.6 3.6A2 2 0 0 1 5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-.59 1.41", key: "9l1ft6" }],
    ["path", { d: "M3 8.7V19a2 2 0 0 0 2 2h10.3", key: "17knke" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M13 13a3 3 0 1 0 0-6H9v2", key: "uoagbd" }],
    ["path", { d: "M9 17v-2.3", key: "1jxgo2" }]
  ];
  const SquareParkingOff = createLucideIcon("square-parking-off", __iconNode$3S);

  const __iconNode$3R = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M9 17V7h4a3 3 0 0 1 0 6H9", key: "1dfk2c" }]
  ];
  const SquareParking = createLucideIcon("square-parking", __iconNode$3R);

  const __iconNode$3Q = [
    ["path", { d: "M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", key: "1m0v6g" }],
    [
      "path",
      {
        d: "M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z",
        key: "ohrbg2"
      }
    ]
  ];
  const SquarePen = createLucideIcon("square-pen", __iconNode$3Q);

  const __iconNode$3P = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    ["path", { d: "M9 9h.01", key: "1q5me6" }],
    ["path", { d: "M15 15h.01", key: "lqbp3k" }]
  ];
  const SquarePercent = createLucideIcon("square-percent", __iconNode$3P);

  const __iconNode$3O = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M7 7h10", key: "udp07y" }],
    ["path", { d: "M10 7v10", key: "i1d9ee" }],
    ["path", { d: "M16 17a2 2 0 0 1-2-2V7", key: "ftwdc7" }]
  ];
  const SquarePi = createLucideIcon("square-pi", __iconNode$3O);

  const __iconNode$3N = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "m9 8 6 4-6 4Z", key: "f1r3lt" }]
  ];
  const SquarePlay = createLucideIcon("square-play", __iconNode$3N);

  const __iconNode$3M = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M12 12H9.5a2.5 2.5 0 0 1 0-5H17", key: "1l9586" }],
    ["path", { d: "M12 7v10", key: "jspqdw" }],
    ["path", { d: "M16 7v10", key: "lavkr4" }]
  ];
  const SquarePilcrow = createLucideIcon("square-pilcrow", __iconNode$3M);

  const __iconNode$3L = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
    ["path", { d: "M12 8v8", key: "napkw2" }]
  ];
  const SquarePlus = createLucideIcon("square-plus", __iconNode$3L);

  const __iconNode$3K = [
    ["path", { d: "M12 7v4", key: "xawao1" }],
    ["path", { d: "M7.998 9.003a5 5 0 1 0 8-.005", key: "1pek45" }],
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", key: "h1oib" }]
  ];
  const SquarePower = createLucideIcon("square-power", __iconNode$3K);

  const __iconNode$3J = [
    ["path", { d: "M7 12h2l2 5 2-10h4", key: "1fxv6h" }],
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", key: "h1oib" }]
  ];
  const SquareRadical = createLucideIcon("square-radical", __iconNode$3J);

  const __iconNode$3I = [
    ["path", { d: "M21 11a8 8 0 0 0-8-8", key: "1lxwo5" }],
    ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", key: "1dv2y5" }]
  ];
  const SquareRoundCorner = createLucideIcon("square-round-corner", __iconNode$3I);

  const __iconNode$3H = [
    ["rect", { width: "20", height: "20", x: "2", y: "2", rx: "2", key: "1btzen" }],
    ["circle", { cx: "8", cy: "8", r: "2", key: "14cg06" }],
    ["path", { d: "M9.414 9.414 12 12", key: "qz4lzr" }],
    ["path", { d: "M14.8 14.8 18 18", key: "11flf1" }],
    ["circle", { cx: "8", cy: "16", r: "2", key: "1acxsx" }],
    ["path", { d: "m18 6-8.586 8.586", key: "11kzk1" }]
  ];
  const SquareScissors = createLucideIcon("square-scissors", __iconNode$3H);

  const __iconNode$3G = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M16 8.9V7H8l4 5-4 5h8v-1.9", key: "9nih0i" }]
  ];
  const SquareSigma = createLucideIcon("square-sigma", __iconNode$3G);

  const __iconNode$3F = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["line", { x1: "9", x2: "15", y1: "15", y2: "9", key: "1dfufj" }]
  ];
  const SquareSlash = createLucideIcon("square-slash", __iconNode$3F);

  const __iconNode$3E = [
    ["path", { d: "M8 19H5c-1 0-2-1-2-2V7c0-1 1-2 2-2h3", key: "lubmu8" }],
    ["path", { d: "M16 5h3c1 0 2 1 2 2v10c0 1-1 2-2 2h-3", key: "1ag34g" }],
    ["line", { x1: "12", x2: "12", y1: "4", y2: "20", key: "1tx1rr" }]
  ];
  const SquareSplitHorizontal = createLucideIcon("square-split-horizontal", __iconNode$3E);

  const __iconNode$3D = [
    ["path", { d: "M5 8V5c0-1 1-2 2-2h10c1 0 2 1 2 2v3", key: "1pi83i" }],
    ["path", { d: "M19 16v3c0 1-1 2-2 2H7c-1 0-2-1-2-2v-3", key: "ido5k7" }],
    ["line", { x1: "4", x2: "20", y1: "12", y2: "12", key: "1e0a9i" }]
  ];
  const SquareSplitVertical = createLucideIcon("square-split-vertical", __iconNode$3D);

  const __iconNode$3C = [
    ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", key: "h1oib" }],
    ["rect", { x: "8", y: "8", width: "8", height: "8", rx: "1", key: "z9xiuo" }]
  ];
  const SquareSquare = createLucideIcon("square-square", __iconNode$3C);

  const __iconNode$3B = [
    ["path", { d: "M4 10c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2", key: "4i38lg" }],
    ["path", { d: "M10 16c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2", key: "mlte4a" }],
    ["rect", { width: "8", height: "8", x: "14", y: "14", rx: "2", key: "1fa9i4" }]
  ];
  const SquareStack = createLucideIcon("square-stack", __iconNode$3B);

  const __iconNode$3A = [
    ["path", { d: "m7 11 2-2-2-2", key: "1lz0vl" }],
    ["path", { d: "M11 13h4", key: "1p7l4v" }],
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }]
  ];
  const SquareTerminal = createLucideIcon("square-terminal", __iconNode$3A);

  const __iconNode$3z = [
    ["path", { d: "M18 21a6 6 0 0 0-12 0", key: "kaz2du" }],
    ["circle", { cx: "12", cy: "11", r: "4", key: "1gt34v" }],
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }]
  ];
  const SquareUserRound = createLucideIcon("square-user-round", __iconNode$3z);

  const __iconNode$3y = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }],
    ["path", { d: "M7 21v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2", key: "1m6ac2" }]
  ];
  const SquareUser = createLucideIcon("square-user", __iconNode$3y);

  const __iconNode$3x = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    ["path", { d: "m9 9 6 6", key: "z0biqf" }]
  ];
  const SquareX = createLucideIcon("square-x", __iconNode$3x);

  const __iconNode$3w = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }]
  ];
  const Square = createLucideIcon("square", __iconNode$3w);

  const __iconNode$3v = [
    [
      "path",
      {
        d: "M16 12v2a2 2 0 0 1-2 2H9a1 1 0 0 0-1 1v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h0",
        key: "1mcohs"
      }
    ],
    [
      "path",
      {
        d: "M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1h-5a2 2 0 0 0-2 2v2",
        key: "1r1efp"
      }
    ]
  ];
  const SquaresExclude = createLucideIcon("squares-exclude", __iconNode$3v);

  const __iconNode$3u = [
    ["path", { d: "M10 22a2 2 0 0 1-2-2", key: "i7yj1i" }],
    ["path", { d: "M14 2a2 2 0 0 1 2 2", key: "170a0m" }],
    ["path", { d: "M16 22h-2", key: "18d249" }],
    ["path", { d: "M2 10V8", key: "7yj4fe" }],
    ["path", { d: "M2 4a2 2 0 0 1 2-2", key: "ddgnws" }],
    ["path", { d: "M20 8a2 2 0 0 1 2 2", key: "1770vt" }],
    ["path", { d: "M22 14v2", key: "iot8ja" }],
    ["path", { d: "M22 20a2 2 0 0 1-2 2", key: "qj8q6g" }],
    ["path", { d: "M4 16a2 2 0 0 1-2-2", key: "1dnafg" }],
    [
      "path",
      { d: "M8 10a2 2 0 0 1 2-2h5a1 1 0 0 1 1 1v5a2 2 0 0 1-2 2H9a1 1 0 0 1-1-1z", key: "ci6f0b" }
    ],
    ["path", { d: "M8 2h2", key: "1gmkwm" }]
  ];
  const SquaresIntersect = createLucideIcon("squares-intersect", __iconNode$3u);

  const __iconNode$3t = [
    ["path", { d: "M10 22a2 2 0 0 1-2-2", key: "i7yj1i" }],
    ["path", { d: "M16 22h-2", key: "18d249" }],
    [
      "path",
      {
        d: "M16 4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3a1 1 0 0 0 1-1v-5a2 2 0 0 1 2-2h5a1 1 0 0 0 1-1z",
        key: "1njgbb"
      }
    ],
    ["path", { d: "M20 8a2 2 0 0 1 2 2", key: "1770vt" }],
    ["path", { d: "M22 14v2", key: "iot8ja" }],
    ["path", { d: "M22 20a2 2 0 0 1-2 2", key: "qj8q6g" }]
  ];
  const SquaresSubtract = createLucideIcon("squares-subtract", __iconNode$3t);

  const __iconNode$3s = [
    [
      "path",
      {
        d: "M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3a1 1 0 0 0 1 1h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-3a1 1 0 0 0-1-1z",
        key: "17jnth"
      }
    ]
  ];
  const SquaresUnite = createLucideIcon("squares-unite", __iconNode$3s);

  const __iconNode$3r = [
    ["path", { d: "M13.77 3.043a34 34 0 0 0-3.54 0", key: "1oaobr" }],
    ["path", { d: "M13.771 20.956a33 33 0 0 1-3.541.001", key: "95iq0j" }],
    ["path", { d: "M20.18 17.74c-.51 1.15-1.29 1.93-2.439 2.44", key: "1u6qty" }],
    ["path", { d: "M20.18 6.259c-.51-1.148-1.291-1.929-2.44-2.438", key: "1ew6g6" }],
    ["path", { d: "M20.957 10.23a33 33 0 0 1 0 3.54", key: "1l9npr" }],
    ["path", { d: "M3.043 10.23a34 34 0 0 0 .001 3.541", key: "1it6jm" }],
    ["path", { d: "M6.26 20.179c-1.15-.508-1.93-1.29-2.44-2.438", key: "14uchd" }],
    ["path", { d: "M6.26 3.82c-1.149.51-1.93 1.291-2.44 2.44", key: "8k4agb" }]
  ];
  const SquircleDashed = createLucideIcon("squircle-dashed", __iconNode$3r);

  const __iconNode$3q = [
    ["path", { d: "M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9", key: "garfkc" }]
  ];
  const Squircle = createLucideIcon("squircle", __iconNode$3q);

  const __iconNode$3p = [
    ["path", { d: "M15.236 22a3 3 0 0 0-2.2-5", key: "21bitc" }],
    ["path", { d: "M16 20a3 3 0 0 1 3-3h1a2 2 0 0 0 2-2v-2a4 4 0 0 0-4-4V4", key: "oh0fg0" }],
    ["path", { d: "M18 13h.01", key: "9veqaj" }],
    [
      "path",
      {
        d: "M18 6a4 4 0 0 0-4 4 7 7 0 0 0-7 7c0-5 4-5 4-10.5a4.5 4.5 0 1 0-9 0 2.5 2.5 0 0 0 5 0C7 10 3 11 3 17c0 2.8 2.2 5 5 5h10",
        key: "980v8a"
      }
    ]
  ];
  const Squirrel = createLucideIcon("squirrel", __iconNode$3p);

  const __iconNode$3o = [
    ["path", { d: "M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13", key: "i9gjdv" }],
    [
      "path",
      {
        d: "M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z",
        key: "1vzg3v"
      }
    ],
    ["path", { d: "M5 22h14", key: "ehvnwv" }]
  ];
  const Stamp = createLucideIcon("stamp", __iconNode$3o);

  const __iconNode$3n = [
    [
      "path",
      {
        d: "M12 18.338a2.1 2.1 0 0 0-.987.244L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16l2.309-4.679A.53.53 0 0 1 12 2",
        key: "2ksp49"
      }
    ]
  ];
  const StarHalf = createLucideIcon("star-half", __iconNode$3n);

  const __iconNode$3m = [
    ["path", { d: "M8.34 8.34 2 9.27l5 4.87L5.82 21 12 17.77 18.18 21l-.59-3.43", key: "16m0ql" }],
    ["path", { d: "M18.42 12.76 22 9.27l-6.91-1L12 2l-1.44 2.91", key: "1vt8nq" }],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const StarOff = createLucideIcon("star-off", __iconNode$3m);

  const __iconNode$3l = [
    [
      "path",
      {
        d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
        key: "r04s7s"
      }
    ]
  ];
  const Star = createLucideIcon("star", __iconNode$3l);

  const __iconNode$3k = [
    ["line", { x1: "18", x2: "18", y1: "20", y2: "4", key: "cun8e5" }],
    ["polygon", { points: "14,20 4,12 14,4", key: "ypakod" }]
  ];
  const StepBack = createLucideIcon("step-back", __iconNode$3k);

  const __iconNode$3j = [
    ["line", { x1: "6", x2: "6", y1: "4", y2: "20", key: "fy8qot" }],
    ["polygon", { points: "10,4 20,12 10,20", key: "1mc1pf" }]
  ];
  const StepForward = createLucideIcon("step-forward", __iconNode$3j);

  const __iconNode$3i = [
    ["path", { d: "M11 2v2", key: "1539x4" }],
    ["path", { d: "M5 2v2", key: "1yf1q8" }],
    ["path", { d: "M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1", key: "rb5t3r" }],
    ["path", { d: "M8 15a6 6 0 0 0 12 0v-3", key: "x18d4x" }],
    ["circle", { cx: "20", cy: "10", r: "2", key: "ts1r5v" }]
  ];
  const Stethoscope = createLucideIcon("stethoscope", __iconNode$3i);

  const __iconNode$3h = [
    [
      "path",
      { d: "M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z", key: "1wis1t" }
    ],
    ["path", { d: "M14 3v4a2 2 0 0 0 2 2h4", key: "36rjfy" }],
    ["path", { d: "M8 13h.01", key: "1sbv64" }],
    ["path", { d: "M16 13h.01", key: "wip0gl" }],
    ["path", { d: "M10 16s.8 1 2 1c1.3 0 2-1 2-1", key: "1vvgv3" }]
  ];
  const Sticker = createLucideIcon("sticker", __iconNode$3h);

  const __iconNode$3g = [
    ["path", { d: "M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z", key: "qazsjp" }],
    ["path", { d: "M15 3v4a2 2 0 0 0 2 2h4", key: "40519r" }]
  ];
  const StickyNote = createLucideIcon("sticky-note", __iconNode$3g);

  const __iconNode$3f = [
    ["path", { d: "m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7", key: "ztvudi" }],
    ["path", { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", key: "1b2hhj" }],
    ["path", { d: "M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4", key: "2ebpfo" }],
    ["path", { d: "M2 7h20", key: "1fcdvo" }],
    [
      "path",
      {
        d: "M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7",
        key: "6c3vgh"
      }
    ]
  ];
  const Store = createLucideIcon("store", __iconNode$3f);

  const __iconNode$3e = [
    ["rect", { width: "20", height: "6", x: "2", y: "4", rx: "2", key: "qdearl" }],
    ["rect", { width: "20", height: "6", x: "2", y: "14", rx: "2", key: "1xrn6j" }]
  ];
  const StretchHorizontal = createLucideIcon("stretch-horizontal", __iconNode$3e);

  const __iconNode$3d = [
    ["rect", { width: "6", height: "20", x: "4", y: "2", rx: "2", key: "19qu7m" }],
    ["rect", { width: "6", height: "20", x: "14", y: "2", rx: "2", key: "24v0nk" }]
  ];
  const StretchVertical = createLucideIcon("stretch-vertical", __iconNode$3d);

  const __iconNode$3c = [
    ["path", { d: "M16 4H9a3 3 0 0 0-2.83 4", key: "43sutm" }],
    ["path", { d: "M14 12a4 4 0 0 1 0 8H6", key: "nlfj13" }],
    ["line", { x1: "4", x2: "20", y1: "12", y2: "12", key: "1e0a9i" }]
  ];
  const Strikethrough = createLucideIcon("strikethrough", __iconNode$3c);

  const __iconNode$3b = [
    ["path", { d: "m4 5 8 8", key: "1eunvl" }],
    ["path", { d: "m12 5-8 8", key: "1ah0jp" }],
    [
      "path",
      {
        d: "M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.33 20 14c0-.47-.17-.93-.48-1.29a2.11 2.11 0 0 0-2.62-.44c-.42.24-.74.62-.9 1.07",
        key: "e8ta8j"
      }
    ]
  ];
  const Subscript = createLucideIcon("subscript", __iconNode$3b);

  const __iconNode$3a = [
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
    ["path", { d: "M12 4h.01", key: "1ujb9j" }],
    ["path", { d: "M20 12h.01", key: "1ykeid" }],
    ["path", { d: "M12 20h.01", key: "zekei9" }],
    ["path", { d: "M4 12h.01", key: "158zrr" }],
    ["path", { d: "M17.657 6.343h.01", key: "31pqzk" }],
    ["path", { d: "M17.657 17.657h.01", key: "jehnf4" }],
    ["path", { d: "M6.343 17.657h.01", key: "gdk6ow" }],
    ["path", { d: "M6.343 6.343h.01", key: "1uurf0" }]
  ];
  const SunDim = createLucideIcon("sun-dim", __iconNode$3a);

  const __iconNode$39 = [
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
    ["path", { d: "M12 3v1", key: "1asbbs" }],
    ["path", { d: "M12 20v1", key: "1wcdkc" }],
    ["path", { d: "M3 12h1", key: "lp3yf2" }],
    ["path", { d: "M20 12h1", key: "1vloll" }],
    ["path", { d: "m18.364 5.636-.707.707", key: "1hakh0" }],
    ["path", { d: "m6.343 17.657-.707.707", key: "18m9nf" }],
    ["path", { d: "m5.636 5.636.707.707", key: "1xv1c5" }],
    ["path", { d: "m17.657 17.657.707.707", key: "vl76zb" }]
  ];
  const SunMedium = createLucideIcon("sun-medium", __iconNode$39);

  const __iconNode$38 = [
    ["path", { d: "M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4", key: "1fu5g2" }],
    ["path", { d: "M12 2v2", key: "tus03m" }],
    ["path", { d: "M12 20v2", key: "1lh1kg" }],
    ["path", { d: "m4.9 4.9 1.4 1.4", key: "b9915j" }],
    ["path", { d: "m17.7 17.7 1.4 1.4", key: "qc3ed3" }],
    ["path", { d: "M2 12h2", key: "1t8f8n" }],
    ["path", { d: "M20 12h2", key: "1q8mjw" }],
    ["path", { d: "m6.3 17.7-1.4 1.4", key: "5gca6" }],
    ["path", { d: "m19.1 4.9-1.4 1.4", key: "wpu9u6" }]
  ];
  const SunMoon = createLucideIcon("sun-moon", __iconNode$38);

  const __iconNode$37 = [
    ["path", { d: "M10 21v-1", key: "1u8rkd" }],
    ["path", { d: "M10 4V3", key: "pkzwkn" }],
    ["path", { d: "M10 9a3 3 0 0 0 0 6", key: "gv75dk" }],
    ["path", { d: "m14 20 1.25-2.5L18 18", key: "1chtki" }],
    ["path", { d: "m14 4 1.25 2.5L18 6", key: "1b4wsy" }],
    ["path", { d: "m17 21-3-6 1.5-3H22", key: "o5qa3v" }],
    ["path", { d: "m17 3-3 6 1.5 3", key: "11697g" }],
    ["path", { d: "M2 12h1", key: "1uaihz" }],
    ["path", { d: "m20 10-1.5 2 1.5 2", key: "1swlpi" }],
    ["path", { d: "m3.64 18.36.7-.7", key: "105rm9" }],
    ["path", { d: "m4.34 6.34-.7-.7", key: "d3unjp" }]
  ];
  const SunSnow = createLucideIcon("sun-snow", __iconNode$37);

  const __iconNode$36 = [
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
    ["path", { d: "M12 2v2", key: "tus03m" }],
    ["path", { d: "M12 20v2", key: "1lh1kg" }],
    ["path", { d: "m4.93 4.93 1.41 1.41", key: "149t6j" }],
    ["path", { d: "m17.66 17.66 1.41 1.41", key: "ptbguv" }],
    ["path", { d: "M2 12h2", key: "1t8f8n" }],
    ["path", { d: "M20 12h2", key: "1q8mjw" }],
    ["path", { d: "m6.34 17.66-1.41 1.41", key: "1m8zz5" }],
    ["path", { d: "m19.07 4.93-1.41 1.41", key: "1shlcs" }]
  ];
  const Sun = createLucideIcon("sun", __iconNode$36);

  const __iconNode$35 = [
    ["path", { d: "M12 10V2", key: "16sf7g" }],
    ["path", { d: "m4.93 10.93 1.41 1.41", key: "2a7f42" }],
    ["path", { d: "M2 18h2", key: "j10viu" }],
    ["path", { d: "M20 18h2", key: "wocana" }],
    ["path", { d: "m19.07 10.93-1.41 1.41", key: "15zs5n" }],
    ["path", { d: "M22 22H2", key: "19qnx5" }],
    ["path", { d: "m16 6-4 4-4-4", key: "6wukr" }],
    ["path", { d: "M16 18a4 4 0 0 0-8 0", key: "1lzouq" }]
  ];
  const Sunset = createLucideIcon("sunset", __iconNode$35);

  const __iconNode$34 = [
    ["path", { d: "M12 2v8", key: "1q4o3n" }],
    ["path", { d: "m4.93 10.93 1.41 1.41", key: "2a7f42" }],
    ["path", { d: "M2 18h2", key: "j10viu" }],
    ["path", { d: "M20 18h2", key: "wocana" }],
    ["path", { d: "m19.07 10.93-1.41 1.41", key: "15zs5n" }],
    ["path", { d: "M22 22H2", key: "19qnx5" }],
    ["path", { d: "m8 6 4-4 4 4", key: "ybng9g" }],
    ["path", { d: "M16 18a4 4 0 0 0-8 0", key: "1lzouq" }]
  ];
  const Sunrise = createLucideIcon("sunrise", __iconNode$34);

  const __iconNode$33 = [
    ["path", { d: "m4 19 8-8", key: "hr47gm" }],
    ["path", { d: "m12 19-8-8", key: "1dhhmo" }],
    [
      "path",
      {
        d: "M20 12h-4c0-1.5.442-2 1.5-2.5S20 8.334 20 7.002c0-.472-.17-.93-.484-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.899 1.06",
        key: "1dfcux"
      }
    ]
  ];
  const Superscript = createLucideIcon("superscript", __iconNode$33);

  const __iconNode$32 = [
    ["path", { d: "M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z", key: "1ldrpk" }],
    ["path", { d: "M16.7 13H19a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7", key: "11i5po" }],
    ["path", { d: "M 7 17h.01", key: "1euzgo" }],
    [
      "path",
      {
        d: "m11 8 2.3-2.3a2.4 2.4 0 0 1 3.404.004L18.6 7.6a2.4 2.4 0 0 1 .026 3.434L9.9 19.8",
        key: "o2gii7"
      }
    ]
  ];
  const SwatchBook = createLucideIcon("swatch-book", __iconNode$32);

  const __iconNode$31 = [
    ["path", { d: "M10 21V3h8", key: "br2l0g" }],
    ["path", { d: "M6 16h9", key: "2py0wn" }],
    ["path", { d: "M10 9.5h7", key: "13dmhz" }]
  ];
  const SwissFranc = createLucideIcon("swiss-franc", __iconNode$31);

  const __iconNode$30 = [
    ["path", { d: "M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5", key: "mtk2lu" }],
    ["path", { d: "M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5", key: "120jsl" }],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
    ["path", { d: "m18 22-3-3 3-3", key: "kgdoj7" }],
    ["path", { d: "m6 2 3 3-3 3", key: "1fnbkv" }]
  ];
  const SwitchCamera = createLucideIcon("switch-camera", __iconNode$30);

  const __iconNode$2$ = [
    ["polyline", { points: "14.5 17.5 3 6 3 3 6 3 17.5 14.5", key: "1hfsw2" }],
    ["line", { x1: "13", x2: "19", y1: "19", y2: "13", key: "1vrmhu" }],
    ["line", { x1: "16", x2: "20", y1: "16", y2: "20", key: "1bron3" }],
    ["line", { x1: "19", x2: "21", y1: "21", y2: "19", key: "13pww6" }]
  ];
  const Sword = createLucideIcon("sword", __iconNode$2$);

  const __iconNode$2_ = [
    ["polyline", { points: "14.5 17.5 3 6 3 3 6 3 17.5 14.5", key: "1hfsw2" }],
    ["line", { x1: "13", x2: "19", y1: "19", y2: "13", key: "1vrmhu" }],
    ["line", { x1: "16", x2: "20", y1: "16", y2: "20", key: "1bron3" }],
    ["line", { x1: "19", x2: "21", y1: "21", y2: "19", key: "13pww6" }],
    ["polyline", { points: "14.5 6.5 18 3 21 3 21 6 17.5 9.5", key: "hbey2j" }],
    ["line", { x1: "5", x2: "9", y1: "14", y2: "18", key: "1hf58s" }],
    ["line", { x1: "7", x2: "4", y1: "17", y2: "20", key: "pidxm4" }],
    ["line", { x1: "3", x2: "5", y1: "19", y2: "21", key: "1pehsh" }]
  ];
  const Swords = createLucideIcon("swords", __iconNode$2_);

  const __iconNode$2Z = [
    ["path", { d: "m18 2 4 4", key: "22kx64" }],
    ["path", { d: "m17 7 3-3", key: "1w1zoj" }],
    ["path", { d: "M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5", key: "1exhtz" }],
    ["path", { d: "m9 11 4 4", key: "rovt3i" }],
    ["path", { d: "m5 19-3 3", key: "59f2uf" }],
    ["path", { d: "m14 4 6 6", key: "yqp9t2" }]
  ];
  const Syringe = createLucideIcon("syringe", __iconNode$2Z);

  const __iconNode$2Y = [
    [
      "path",
      {
        d: "M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18",
        key: "gugj83"
      }
    ]
  ];
  const Table2 = createLucideIcon("table-2", __iconNode$2Y);

  const __iconNode$2X = [
    ["path", { d: "M12 21v-6", key: "lihzve" }],
    ["path", { d: "M12 9V3", key: "da5inc" }],
    ["path", { d: "M3 15h18", key: "5xshup" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }]
  ];
  const TableCellsMerge = createLucideIcon("table-cells-merge", __iconNode$2X);

  const __iconNode$2W = [
    ["path", { d: "M12 15V9", key: "8c7uyn" }],
    ["path", { d: "M3 15h18", key: "5xshup" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }]
  ];
  const TableCellsSplit = createLucideIcon("table-cells-split", __iconNode$2W);

  const __iconNode$2V = [
    ["path", { d: "M14 14v2", key: "w2a1xv" }],
    ["path", { d: "M14 20v2", key: "1lq872" }],
    ["path", { d: "M14 2v2", key: "6buw04" }],
    ["path", { d: "M14 8v2", key: "i67w9a" }],
    ["path", { d: "M2 15h8", key: "82wtch" }],
    ["path", { d: "M2 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H2", key: "up0l64" }],
    ["path", { d: "M2 9h8", key: "yelfik" }],
    ["path", { d: "M22 15h-4", key: "1es58f" }],
    ["path", { d: "M22 3h-2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2", key: "pdjoqf" }],
    ["path", { d: "M22 9h-4", key: "1luja7" }],
    ["path", { d: "M5 3v18", key: "14hmio" }]
  ];
  const TableColumnsSplit = createLucideIcon("table-columns-split", __iconNode$2V);

  const __iconNode$2U = [
    ["path", { d: "M16 12H3", key: "1a2rj7" }],
    ["path", { d: "M16 18H3", key: "12xzn7" }],
    ["path", { d: "M16 6H3", key: "1wxfjs" }],
    ["path", { d: "M21 12h.01", key: "msek7k" }],
    ["path", { d: "M21 18h.01", key: "1e8rq1" }],
    ["path", { d: "M21 6h.01", key: "1koanj" }]
  ];
  const TableOfContents = createLucideIcon("table-of-contents", __iconNode$2U);

  const __iconNode$2T = [
    ["path", { d: "M15 3v18", key: "14nvp0" }],
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M21 9H3", key: "1338ky" }],
    ["path", { d: "M21 15H3", key: "9uk58r" }]
  ];
  const TableProperties = createLucideIcon("table-properties", __iconNode$2T);

  const __iconNode$2S = [
    ["path", { d: "M14 10h2", key: "1lstlu" }],
    ["path", { d: "M15 22v-8", key: "1fwwgm" }],
    ["path", { d: "M15 2v4", key: "1044rn" }],
    ["path", { d: "M2 10h2", key: "1r8dkt" }],
    ["path", { d: "M20 10h2", key: "1ug425" }],
    ["path", { d: "M3 19h18", key: "awlh7x" }],
    ["path", { d: "M3 22v-6a2 2 135 0 1 2-2h14a2 2 45 0 1 2 2v6", key: "ibqhof" }],
    ["path", { d: "M3 2v2a2 2 45 0 0 2 2h14a2 2 135 0 0 2-2V2", key: "1uenja" }],
    ["path", { d: "M8 10h2", key: "66od0" }],
    ["path", { d: "M9 22v-8", key: "fmnu31" }],
    ["path", { d: "M9 2v4", key: "j1yeou" }]
  ];
  const TableRowsSplit = createLucideIcon("table-rows-split", __iconNode$2S);

  const __iconNode$2R = [
    ["path", { d: "M12 3v18", key: "108xh3" }],
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9h18", key: "1pudct" }],
    ["path", { d: "M3 15h18", key: "5xshup" }]
  ];
  const Table = createLucideIcon("table", __iconNode$2R);

  const __iconNode$2Q = [
    ["rect", { width: "10", height: "14", x: "3", y: "8", rx: "2", key: "1vrsiq" }],
    ["path", { d: "M5 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-2.4", key: "1j4zmg" }],
    ["path", { d: "M8 18h.01", key: "lrp35t" }]
  ];
  const TabletSmartphone = createLucideIcon("tablet-smartphone", __iconNode$2Q);

  const __iconNode$2P = [
    ["rect", { width: "16", height: "20", x: "4", y: "2", rx: "2", ry: "2", key: "76otgf" }],
    ["line", { x1: "12", x2: "12.01", y1: "18", y2: "18", key: "1dp563" }]
  ];
  const Tablet = createLucideIcon("tablet", __iconNode$2P);

  const __iconNode$2O = [
    [
      "path",
      {
        d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",
        key: "vktsd0"
      }
    ],
    ["circle", { cx: "7.5", cy: "7.5", r: ".5", fill: "currentColor", key: "kqv944" }]
  ];
  const Tag = createLucideIcon("tag", __iconNode$2O);

  const __iconNode$2N = [
    ["circle", { cx: "7", cy: "7", r: "5", key: "x29byf" }],
    ["circle", { cx: "17", cy: "17", r: "5", key: "1op1d2" }],
    ["path", { d: "M12 17h10", key: "ls21zv" }],
    ["path", { d: "m3.46 10.54 7.08-7.08", key: "1rehiu" }]
  ];
  const Tablets = createLucideIcon("tablets", __iconNode$2N);

  const __iconNode$2M = [
    ["path", { d: "m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19", key: "1cbfv1" }],
    [
      "path",
      {
        d: "M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z",
        key: "135mg7"
      }
    ],
    ["circle", { cx: "6.5", cy: "9.5", r: ".5", fill: "currentColor", key: "5pm5xn" }]
  ];
  const Tags = createLucideIcon("tags", __iconNode$2M);

  const __iconNode$2L = [["path", { d: "M4 4v16", key: "6qkkli" }]];
  const Tally1 = createLucideIcon("tally-1", __iconNode$2L);

  const __iconNode$2K = [
    ["path", { d: "M4 4v16", key: "6qkkli" }],
    ["path", { d: "M9 4v16", key: "81ygyz" }]
  ];
  const Tally2 = createLucideIcon("tally-2", __iconNode$2K);

  const __iconNode$2J = [
    ["path", { d: "M4 4v16", key: "6qkkli" }],
    ["path", { d: "M9 4v16", key: "81ygyz" }],
    ["path", { d: "M14 4v16", key: "12vmem" }]
  ];
  const Tally3 = createLucideIcon("tally-3", __iconNode$2J);

  const __iconNode$2I = [
    ["path", { d: "M4 4v16", key: "6qkkli" }],
    ["path", { d: "M9 4v16", key: "81ygyz" }],
    ["path", { d: "M14 4v16", key: "12vmem" }],
    ["path", { d: "M19 4v16", key: "8ij5ei" }]
  ];
  const Tally4 = createLucideIcon("tally-4", __iconNode$2I);

  const __iconNode$2H = [
    ["path", { d: "M4 4v16", key: "6qkkli" }],
    ["path", { d: "M9 4v16", key: "81ygyz" }],
    ["path", { d: "M14 4v16", key: "12vmem" }],
    ["path", { d: "M19 4v16", key: "8ij5ei" }],
    ["path", { d: "M22 6 2 18", key: "h9moai" }]
  ];
  const Tally5 = createLucideIcon("tally-5", __iconNode$2H);

  const __iconNode$2G = [
    ["circle", { cx: "17", cy: "4", r: "2", key: "y5j2s2" }],
    ["path", { d: "M15.59 5.41 5.41 15.59", key: "l0vprr" }],
    ["circle", { cx: "4", cy: "17", r: "2", key: "9p4efm" }],
    ["path", { d: "M12 22s-4-9-1.5-11.5S22 12 22 12", key: "1twk4o" }]
  ];
  const Tangent = createLucideIcon("tangent", __iconNode$2G);

  const __iconNode$2F = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["circle", { cx: "12", cy: "12", r: "6", key: "1vlfrh" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]
  ];
  const Target = createLucideIcon("target", __iconNode$2F);

  const __iconNode$2E = [
    [
      "path",
      {
        d: "m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44",
        key: "k4qptu"
      }
    ],
    ["path", { d: "m13.56 11.747 4.332-.924", key: "19l80z" }],
    ["path", { d: "m16 21-3.105-6.21", key: "7oh9d" }],
    [
      "path",
      {
        d: "M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z",
        key: "m7xp4m"
      }
    ],
    ["path", { d: "m6.158 8.633 1.114 4.456", key: "74o979" }],
    ["path", { d: "m8 21 3.105-6.21", key: "1fvxut" }],
    ["circle", { cx: "12", cy: "13", r: "2", key: "1c1ljs" }]
  ];
  const Telescope = createLucideIcon("telescope", __iconNode$2E);

  const __iconNode$2D = [
    ["circle", { cx: "4", cy: "4", r: "2", key: "bt5ra8" }],
    ["path", { d: "m14 5 3-3 3 3", key: "1sorif" }],
    ["path", { d: "m14 10 3-3 3 3", key: "1jyi9h" }],
    ["path", { d: "M17 14V2", key: "8ymqnk" }],
    ["path", { d: "M17 14H7l-5 8h20Z", key: "13ar7p" }],
    ["path", { d: "M8 14v8", key: "1ghmqk" }],
    ["path", { d: "m9 14 5 8", key: "13pgi6" }]
  ];
  const TentTree = createLucideIcon("tent-tree", __iconNode$2D);

  const __iconNode$2C = [
    ["path", { d: "M12 19h8", key: "baeox8" }],
    ["path", { d: "m4 17 6-6-6-6", key: "1yngyt" }]
  ];
  const Terminal = createLucideIcon("terminal", __iconNode$2C);

  const __iconNode$2B = [
    ["path", { d: "M3.5 21 14 3", key: "1szst5" }],
    ["path", { d: "M20.5 21 10 3", key: "1310c3" }],
    ["path", { d: "M15.5 21 12 15l-3.5 6", key: "1ddtfw" }],
    ["path", { d: "M2 21h20", key: "1nyx9w" }]
  ];
  const Tent = createLucideIcon("tent", __iconNode$2B);

  const __iconNode$2A = [
    [
      "path",
      { d: "M21 7 6.82 21.18a2.83 2.83 0 0 1-3.99-.01a2.83 2.83 0 0 1 0-4L17 3", key: "1ub6xw" }
    ],
    ["path", { d: "m16 2 6 6", key: "1gw87d" }],
    ["path", { d: "M12 16H4", key: "1cjfip" }]
  ];
  const TestTubeDiagonal = createLucideIcon("test-tube-diagonal", __iconNode$2A);

  const __iconNode$2z = [
    ["path", { d: "M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5c-1.4 0-2.5-1.1-2.5-2.5V2", key: "125lnx" }],
    ["path", { d: "M8.5 2h7", key: "csnxdl" }],
    ["path", { d: "M14.5 16h-5", key: "1ox875" }]
  ];
  const TestTube = createLucideIcon("test-tube", __iconNode$2z);

  const __iconNode$2y = [
    ["path", { d: "M12 20h-1a2 2 0 0 1-2-2 2 2 0 0 1-2 2H6", key: "1528k5" }],
    ["path", { d: "M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7", key: "13ksps" }],
    ["path", { d: "M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1", key: "1n9rhb" }],
    ["path", { d: "M6 4h1a2 2 0 0 1 2 2 2 2 0 0 1 2-2h1", key: "1mj8rg" }],
    ["path", { d: "M9 6v12", key: "velyjx" }]
  ];
  const TextCursorInput = createLucideIcon("text-cursor-input", __iconNode$2y);

  const __iconNode$2x = [
    ["path", { d: "M9 2v17.5A2.5 2.5 0 0 1 6.5 22A2.5 2.5 0 0 1 4 19.5V2", key: "1hjrqt" }],
    ["path", { d: "M20 2v17.5a2.5 2.5 0 0 1-2.5 2.5a2.5 2.5 0 0 1-2.5-2.5V2", key: "16lc8n" }],
    ["path", { d: "M3 2h7", key: "7s29d5" }],
    ["path", { d: "M14 2h7", key: "7sicin" }],
    ["path", { d: "M9 16H4", key: "1bfye3" }],
    ["path", { d: "M20 16h-5", key: "ddnjpe" }]
  ];
  const TestTubes = createLucideIcon("test-tubes", __iconNode$2x);

  const __iconNode$2w = [
    ["path", { d: "M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1", key: "uvaxm9" }],
    ["path", { d: "M7 22h1a4 4 0 0 0 4-4v-1", key: "11xy8d" }],
    ["path", { d: "M7 2h1a4 4 0 0 1 4 4v1", key: "1uw06m" }]
  ];
  const TextCursor = createLucideIcon("text-cursor", __iconNode$2w);

  const __iconNode$2v = [
    ["path", { d: "M17 6H3", key: "16j9eg" }],
    ["path", { d: "M21 12H8", key: "scolzb" }],
    ["path", { d: "M21 18H8", key: "1wfozv" }],
    ["path", { d: "M3 12v6", key: "fv4c87" }]
  ];
  const TextQuote = createLucideIcon("text-quote", __iconNode$2v);

  const __iconNode$2u = [
    ["path", { d: "M21 6H3", key: "1jwq7v" }],
    ["path", { d: "M10 12H3", key: "1ulcyk" }],
    ["path", { d: "M10 18H3", key: "13769t" }],
    ["circle", { cx: "17", cy: "15", r: "3", key: "1upz2a" }],
    ["path", { d: "m21 19-1.9-1.9", key: "dwi7p8" }]
  ];
  const TextSearch = createLucideIcon("text-search", __iconNode$2u);

  const __iconNode$2t = [
    ["path", { d: "M14 21h1", key: "v9vybs" }],
    ["path", { d: "M14 3h1", key: "1ec4yj" }],
    ["path", { d: "M19 3a2 2 0 0 1 2 2", key: "18rm91" }],
    ["path", { d: "M21 14v1", key: "169vum" }],
    ["path", { d: "M21 19a2 2 0 0 1-2 2", key: "1j7049" }],
    ["path", { d: "M21 9v1", key: "mxsmne" }],
    ["path", { d: "M3 14v1", key: "vnatye" }],
    ["path", { d: "M3 9v1", key: "1r0deq" }],
    ["path", { d: "M5 21a2 2 0 0 1-2-2", key: "sbafld" }],
    ["path", { d: "M5 3a2 2 0 0 0-2 2", key: "y57alp" }],
    ["path", { d: "M7 12h10", key: "b7w52i" }],
    ["path", { d: "M7 16h6", key: "1vyc9m" }],
    ["path", { d: "M7 8h8", key: "1jbsf9" }],
    ["path", { d: "M9 21h1", key: "15o7lz" }],
    ["path", { d: "M9 3h1", key: "1yesri" }]
  ];
  const TextSelect = createLucideIcon("text-select", __iconNode$2t);

  const __iconNode$2s = [
    ["path", { d: "M15 18H3", key: "olowqp" }],
    ["path", { d: "M17 6H3", key: "16j9eg" }],
    ["path", { d: "M21 12H3", key: "2avoz0" }]
  ];
  const Text = createLucideIcon("text", __iconNode$2s);

  const __iconNode$2r = [
    ["path", { d: "M2 10s3-3 3-8", key: "3xiif0" }],
    ["path", { d: "M22 10s-3-3-3-8", key: "ioaa5q" }],
    ["path", { d: "M10 2c0 4.4-3.6 8-8 8", key: "16fkpi" }],
    ["path", { d: "M14 2c0 4.4 3.6 8 8 8", key: "b9eulq" }],
    ["path", { d: "M2 10s2 2 2 5", key: "1au1lb" }],
    ["path", { d: "M22 10s-2 2-2 5", key: "qi2y5e" }],
    ["path", { d: "M8 15h8", key: "45n4r" }],
    ["path", { d: "M2 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1", key: "1vsc2m" }],
    ["path", { d: "M14 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1", key: "hrha4u" }]
  ];
  const Theater = createLucideIcon("theater", __iconNode$2r);

  const __iconNode$2q = [
    ["path", { d: "m10 20-1.25-2.5L6 18", key: "18frcb" }],
    ["path", { d: "M10 4 8.75 6.5 6 6", key: "7mghy3" }],
    ["path", { d: "M10.585 15H10", key: "4nqulp" }],
    ["path", { d: "M2 12h6.5L10 9", key: "kv9z4n" }],
    ["path", { d: "M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z", key: "yu0u2z" }],
    ["path", { d: "m4 10 1.5 2L4 14", key: "k9enpj" }],
    ["path", { d: "m7 21 3-6-1.5-3", key: "j8hb9u" }],
    ["path", { d: "m7 3 3 6h2", key: "1bbqgq" }]
  ];
  const ThermometerSnowflake = createLucideIcon("thermometer-snowflake", __iconNode$2q);

  const __iconNode$2p = [
    ["path", { d: "M12 9a4 4 0 0 0-2 7.5", key: "1jvsq6" }],
    ["path", { d: "M12 3v2", key: "1w22ol" }],
    ["path", { d: "m6.6 18.4-1.4 1.4", key: "w2yidj" }],
    ["path", { d: "M20 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z", key: "iof6y5" }],
    ["path", { d: "M4 13H2", key: "118le4" }],
    ["path", { d: "M6.34 7.34 4.93 5.93", key: "1brd51" }]
  ];
  const ThermometerSun = createLucideIcon("thermometer-sun", __iconNode$2p);

  const __iconNode$2o = [
    ["path", { d: "M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z", key: "17jzev" }]
  ];
  const Thermometer = createLucideIcon("thermometer", __iconNode$2o);

  const __iconNode$2n = [
    ["path", { d: "M17 14V2", key: "8ymqnk" }],
    [
      "path",
      {
        d: "M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z",
        key: "m61m77"
      }
    ]
  ];
  const ThumbsDown = createLucideIcon("thumbs-down", __iconNode$2n);

  const __iconNode$2m = [
    ["path", { d: "M7 10v12", key: "1qc93n" }],
    [
      "path",
      {
        d: "M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",
        key: "emmmcr"
      }
    ]
  ];
  const ThumbsUp = createLucideIcon("thumbs-up", __iconNode$2m);

  const __iconNode$2l = [
    [
      "path",
      {
        d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
        key: "qn84l0"
      }
    ],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
  ];
  const TicketCheck = createLucideIcon("ticket-check", __iconNode$2l);

  const __iconNode$2k = [
    [
      "path",
      {
        d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
        key: "qn84l0"
      }
    ],
    ["path", { d: "M9 12h6", key: "1c52cq" }]
  ];
  const TicketMinus = createLucideIcon("ticket-minus", __iconNode$2k);

  const __iconNode$2j = [
    [
      "path",
      {
        d: "M2 9a3 3 0 1 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
        key: "1l48ns"
      }
    ],
    ["path", { d: "M9 9h.01", key: "1q5me6" }],
    ["path", { d: "m15 9-6 6", key: "1uzhvr" }],
    ["path", { d: "M15 15h.01", key: "lqbp3k" }]
  ];
  const TicketPercent = createLucideIcon("ticket-percent", __iconNode$2j);

  const __iconNode$2i = [
    [
      "path",
      {
        d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
        key: "qn84l0"
      }
    ],
    ["path", { d: "M9 12h6", key: "1c52cq" }],
    ["path", { d: "M12 9v6", key: "199k2o" }]
  ];
  const TicketPlus = createLucideIcon("ticket-plus", __iconNode$2i);

  const __iconNode$2h = [
    [
      "path",
      {
        d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
        key: "qn84l0"
      }
    ],
    ["path", { d: "m9.5 14.5 5-5", key: "qviqfa" }]
  ];
  const TicketSlash = createLucideIcon("ticket-slash", __iconNode$2h);

  const __iconNode$2g = [
    [
      "path",
      {
        d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
        key: "qn84l0"
      }
    ],
    ["path", { d: "m9.5 14.5 5-5", key: "qviqfa" }],
    ["path", { d: "m9.5 9.5 5 5", key: "18nt4w" }]
  ];
  const TicketX = createLucideIcon("ticket-x", __iconNode$2g);

  const __iconNode$2f = [
    [
      "path",
      {
        d: "M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z",
        key: "qn84l0"
      }
    ],
    ["path", { d: "M13 5v2", key: "dyzc3o" }],
    ["path", { d: "M13 17v2", key: "1ont0d" }],
    ["path", { d: "M13 11v2", key: "1wjjxi" }]
  ];
  const Ticket = createLucideIcon("ticket", __iconNode$2f);

  const __iconNode$2e = [
    ["path", { d: "M10.5 17h1.227a2 2 0 0 0 1.345-.52L18 12", key: "16muxl" }],
    ["path", { d: "m12 13.5 3.75.5", key: "1i9qhk" }],
    ["path", { d: "m4.5 8 10.58-5.06a1 1 0 0 1 1.342.488L18.5 8", key: "12lg5p" }],
    ["path", { d: "M6 10V8", key: "1y41hn" }],
    ["path", { d: "M6 14v1", key: "cao2tf" }],
    ["path", { d: "M6 19v2", key: "1loha6" }],
    ["rect", { x: "2", y: "8", width: "20", height: "13", rx: "2", key: "p3bz5l" }]
  ];
  const TicketsPlane = createLucideIcon("tickets-plane", __iconNode$2e);

  const __iconNode$2d = [
    ["path", { d: "m4.5 8 10.58-5.06a1 1 0 0 1 1.342.488L18.5 8", key: "12lg5p" }],
    ["path", { d: "M6 10V8", key: "1y41hn" }],
    ["path", { d: "M6 14v1", key: "cao2tf" }],
    ["path", { d: "M6 19v2", key: "1loha6" }],
    ["rect", { x: "2", y: "8", width: "20", height: "13", rx: "2", key: "p3bz5l" }]
  ];
  const Tickets = createLucideIcon("tickets", __iconNode$2d);

  const __iconNode$2c = [
    ["path", { d: "M10 2h4", key: "n1abiw" }],
    ["path", { d: "M4.6 11a8 8 0 0 0 1.7 8.7 8 8 0 0 0 8.7 1.7", key: "10he05" }],
    ["path", { d: "M7.4 7.4a8 8 0 0 1 10.3 1 8 8 0 0 1 .9 10.2", key: "15f7sh" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M12 12v-2", key: "fwoke6" }]
  ];
  const TimerOff = createLucideIcon("timer-off", __iconNode$2c);

  const __iconNode$2b = [
    ["path", { d: "M10 2h4", key: "n1abiw" }],
    ["path", { d: "M12 14v-4", key: "1evpnu" }],
    ["path", { d: "M4 13a8 8 0 0 1 8-7 8 8 0 1 1-5.3 14L4 17.6", key: "1ts96g" }],
    ["path", { d: "M9 17H4v5", key: "8t5av" }]
  ];
  const TimerReset = createLucideIcon("timer-reset", __iconNode$2b);

  const __iconNode$2a = [
    ["line", { x1: "10", x2: "14", y1: "2", y2: "2", key: "14vaq8" }],
    ["line", { x1: "12", x2: "15", y1: "14", y2: "11", key: "17fdiu" }],
    ["circle", { cx: "12", cy: "14", r: "8", key: "1e1u0o" }]
  ];
  const Timer = createLucideIcon("timer", __iconNode$2a);

  const __iconNode$29 = [
    ["circle", { cx: "9", cy: "12", r: "3", key: "u3jwor" }],
    ["rect", { width: "20", height: "14", x: "2", y: "5", rx: "7", key: "g7kal2" }]
  ];
  const ToggleLeft = createLucideIcon("toggle-left", __iconNode$29);

  const __iconNode$28 = [
    ["circle", { cx: "15", cy: "12", r: "3", key: "1afu0r" }],
    ["rect", { width: "20", height: "14", x: "2", y: "5", rx: "7", key: "g7kal2" }]
  ];
  const ToggleRight = createLucideIcon("toggle-right", __iconNode$28);

  const __iconNode$27 = [
    [
      "path",
      {
        d: "M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18",
        key: "kc4kqr"
      }
    ],
    ["path", { d: "M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8", key: "1tqs57" }]
  ];
  const Toilet = createLucideIcon("toilet", __iconNode$27);

  const __iconNode$26 = [
    ["path", { d: "M21 4H3", key: "1hwok0" }],
    ["path", { d: "M18 8H6", key: "41n648" }],
    ["path", { d: "M19 12H9", key: "1g4lpz" }],
    ["path", { d: "M16 16h-6", key: "1j5d54" }],
    ["path", { d: "M11 20H9", key: "39obr8" }]
  ];
  const Tornado = createLucideIcon("tornado", __iconNode$26);

  const __iconNode$25 = [
    ["ellipse", { cx: "12", cy: "11", rx: "3", ry: "2", key: "1b2qxu" }],
    ["ellipse", { cx: "12", cy: "12.5", rx: "10", ry: "8.5", key: "h8emeu" }]
  ];
  const Torus = createLucideIcon("torus", __iconNode$25);

  const __iconNode$24 = [
    ["path", { d: "M12 20v-6", key: "1rm09r" }],
    ["path", { d: "M19.656 14H22", key: "170xzr" }],
    ["path", { d: "M2 14h12", key: "d8icqz" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    ["path", { d: "M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2", key: "s23sx2" }],
    ["path", { d: "M9.656 4H20a2 2 0 0 1 2 2v10.344", key: "ovjcvl" }]
  ];
  const TouchpadOff = createLucideIcon("touchpad-off", __iconNode$24);

  const __iconNode$23 = [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
    ["path", { d: "M2 14h20", key: "myj16y" }],
    ["path", { d: "M12 20v-6", key: "1rm09r" }]
  ];
  const Touchpad = createLucideIcon("touchpad", __iconNode$23);

  const __iconNode$22 = [
    [
      "path",
      { d: "M18.2 12.27 20 6H4l1.8 6.27a1 1 0 0 0 .95.73h10.5a1 1 0 0 0 .96-.73Z", key: "1pledb" }
    ],
    ["path", { d: "M8 13v9", key: "hmv0ci" }],
    ["path", { d: "M16 22v-9", key: "ylnf1u" }],
    ["path", { d: "m9 6 1 7", key: "dpdgam" }],
    ["path", { d: "m15 6-1 7", key: "ls7zgu" }],
    ["path", { d: "M12 6V2", key: "1pj48d" }],
    ["path", { d: "M13 2h-2", key: "mj6ths" }]
  ];
  const TowerControl = createLucideIcon("tower-control", __iconNode$22);

  const __iconNode$21 = [
    ["rect", { width: "18", height: "12", x: "3", y: "8", rx: "1", key: "158fvp" }],
    ["path", { d: "M10 8V5c0-.6-.4-1-1-1H6a1 1 0 0 0-1 1v3", key: "s0042v" }],
    ["path", { d: "M19 8V5c0-.6-.4-1-1-1h-3a1 1 0 0 0-1 1v3", key: "9wmeh2" }]
  ];
  const ToyBrick = createLucideIcon("toy-brick", __iconNode$21);

  const __iconNode$20 = [
    ["path", { d: "m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20", key: "she1j9" }],
    ["path", { d: "M16 18h-5", key: "bq60fd" }],
    ["path", { d: "M18 5a1 1 0 0 0-1 1v5.573", key: "1kv8ia" }],
    ["path", { d: "M3 4h8.129a1 1 0 0 1 .99.863L13 11.246", key: "1q1ert" }],
    ["path", { d: "M4 11V4", key: "9ft8pt" }],
    ["path", { d: "M7 15h.01", key: "k5ht0j" }],
    ["path", { d: "M8 10.1V4", key: "1jgyzo" }],
    ["circle", { cx: "18", cy: "18", r: "2", key: "1emm8v" }],
    ["circle", { cx: "7", cy: "15", r: "5", key: "ddtuc" }]
  ];
  const Tractor = createLucideIcon("tractor", __iconNode$20);

  const __iconNode$1$ = [
    ["path", { d: "M16.05 10.966a5 2.5 0 0 1-8.1 0", key: "m5jpwb" }],
    [
      "path",
      {
        d: "m16.923 14.049 4.48 2.04a1 1 0 0 1 .001 1.831l-8.574 3.9a2 2 0 0 1-1.66 0l-8.574-3.91a1 1 0 0 1 0-1.83l4.484-2.04",
        key: "rbg3g8"
      }
    ],
    ["path", { d: "M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z", key: "vap8c8" }],
    ["path", { d: "M9.194 6.57a5 2.5 0 0 0 5.61 0", key: "15hn5c" }]
  ];
  const TrafficCone = createLucideIcon("traffic-cone", __iconNode$1$);

  const __iconNode$1_ = [
    ["path", { d: "M2 22V12a10 10 0 1 1 20 0v10", key: "o0fyp0" }],
    ["path", { d: "M15 6.8v1.4a3 2.8 0 1 1-6 0V6.8", key: "m8q3n9" }],
    ["path", { d: "M10 15h.01", key: "44in9x" }],
    ["path", { d: "M14 15h.01", key: "5mohn5" }],
    ["path", { d: "M10 19a4 4 0 0 1-4-4v-3a6 6 0 1 1 12 0v3a4 4 0 0 1-4 4Z", key: "hckbmu" }],
    ["path", { d: "m9 19-2 3", key: "iij7hm" }],
    ["path", { d: "m15 19 2 3", key: "npx8sa" }]
  ];
  const TrainFrontTunnel = createLucideIcon("train-front-tunnel", __iconNode$1_);

  const __iconNode$1Z = [
    ["path", { d: "M8 3.1V7a4 4 0 0 0 8 0V3.1", key: "1v71zp" }],
    ["path", { d: "m9 15-1-1", key: "1yrq24" }],
    ["path", { d: "m15 15 1-1", key: "1t0d6s" }],
    ["path", { d: "M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z", key: "1p0hjs" }],
    ["path", { d: "m8 19-2 3", key: "13i0xs" }],
    ["path", { d: "m16 19 2 3", key: "xo31yx" }]
  ];
  const TrainFront = createLucideIcon("train-front", __iconNode$1Z);

  const __iconNode$1Y = [
    ["path", { d: "M2 17 17 2", key: "18b09t" }],
    ["path", { d: "m2 14 8 8", key: "1gv9hu" }],
    ["path", { d: "m5 11 8 8", key: "189pqp" }],
    ["path", { d: "m8 8 8 8", key: "1imecy" }],
    ["path", { d: "m11 5 8 8", key: "ummqn6" }],
    ["path", { d: "m14 2 8 8", key: "1vk7dn" }],
    ["path", { d: "M7 22 22 7", key: "15mb1i" }]
  ];
  const TrainTrack = createLucideIcon("train-track", __iconNode$1Y);

  const __iconNode$1X = [
    ["rect", { width: "16", height: "16", x: "4", y: "3", rx: "2", key: "1wxw4b" }],
    ["path", { d: "M4 11h16", key: "mpoxn0" }],
    ["path", { d: "M12 3v8", key: "1h2ygw" }],
    ["path", { d: "m8 19-2 3", key: "13i0xs" }],
    ["path", { d: "m18 22-2-3", key: "1p0ohu" }],
    ["path", { d: "M8 15h.01", key: "a7atzg" }],
    ["path", { d: "M16 15h.01", key: "rnfrdf" }]
  ];
  const TramFront = createLucideIcon("tram-front", __iconNode$1X);

  const __iconNode$1W = [
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", key: "4alrt4" }],
    ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", key: "v07s0e" }],
    ["line", { x1: "10", x2: "10", y1: "11", y2: "17", key: "1uufr5" }],
    ["line", { x1: "14", x2: "14", y1: "11", y2: "17", key: "xtxkd" }]
  ];
  const Trash2 = createLucideIcon("trash-2", __iconNode$1W);

  const __iconNode$1V = [
    ["path", { d: "M12 16v6", key: "c8a4gj" }],
    ["path", { d: "M14 20h-4", key: "m8m19d" }],
    ["path", { d: "M18 2h4v4", key: "1341mj" }],
    ["path", { d: "m2 2 7.17 7.17", key: "13q8l2" }],
    ["path", { d: "M2 5.355V2h3.357", key: "18136r" }],
    ["path", { d: "m22 2-7.17 7.17", key: "1epvy4" }],
    ["path", { d: "M8 5 5 8", key: "mgbjhz" }],
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }]
  ];
  const Transgender = createLucideIcon("transgender", __iconNode$1V);

  const __iconNode$1U = [
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", key: "4alrt4" }],
    ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", key: "v07s0e" }]
  ];
  const Trash = createLucideIcon("trash", __iconNode$1U);

  const __iconNode$1T = [
    [
      "path",
      {
        d: "M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z",
        key: "oadzkq"
      }
    ],
    ["path", { d: "M12 19v3", key: "npa21l" }]
  ];
  const TreeDeciduous = createLucideIcon("tree-deciduous", __iconNode$1T);

  const __iconNode$1S = [
    ["path", { d: "M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4", key: "foxbe7" }],
    [
      "path",
      { d: "M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3", key: "18arnh" }
    ],
    [
      "path",
      {
        d: "M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35",
        key: "ywahnh"
      }
    ],
    ["path", { d: "M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14", key: "ft0feo" }]
  ];
  const TreePalm = createLucideIcon("tree-palm", __iconNode$1S);

  const __iconNode$1R = [
    [
      "path",
      {
        d: "m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z",
        key: "cpyugq"
      }
    ],
    ["path", { d: "M12 22v-3", key: "kmzjlo" }]
  ];
  const TreePine = createLucideIcon("tree-pine", __iconNode$1R);

  const __iconNode$1Q = [
    ["path", { d: "M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z", key: "1l6gj6" }],
    ["path", { d: "M7 16v6", key: "1a82de" }],
    ["path", { d: "M13 19v3", key: "13sx9i" }],
    [
      "path",
      {
        d: "M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5",
        key: "1sj9kv"
      }
    ]
  ];
  const Trees = createLucideIcon("trees", __iconNode$1Q);

  const __iconNode$1P = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
    ["rect", { width: "3", height: "9", x: "7", y: "7", key: "14n3xi" }],
    ["rect", { width: "3", height: "5", x: "14", y: "7", key: "s4azjd" }]
  ];
  const Trello = createLucideIcon("trello", __iconNode$1P);

  const __iconNode$1O = [
    ["path", { d: "M16 17h6v-6", key: "t6n2it" }],
    ["path", { d: "m22 17-8.5-8.5-5 5L2 7", key: "x473p" }]
  ];
  const TrendingDown = createLucideIcon("trending-down", __iconNode$1O);

  const __iconNode$1N = [
    ["path", { d: "M14.828 14.828 21 21", key: "ar5fw7" }],
    ["path", { d: "M21 16v5h-5", key: "1ck2sf" }],
    ["path", { d: "m21 3-9 9-4-4-6 6", key: "1h02xo" }],
    ["path", { d: "M21 8V3h-5", key: "1qoq8a" }]
  ];
  const TrendingUpDown = createLucideIcon("trending-up-down", __iconNode$1N);

  const __iconNode$1M = [
    ["path", { d: "M16 7h6v6", key: "box55l" }],
    ["path", { d: "m22 7-8.5 8.5-5-5L2 17", key: "1t1m79" }]
  ];
  const TrendingUp = createLucideIcon("trending-up", __iconNode$1M);

  const __iconNode$1L = [
    [
      "path",
      {
        d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
        key: "wmoenq"
      }
    ],
    ["path", { d: "M12 9v4", key: "juzpu7" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }]
  ];
  const TriangleAlert = createLucideIcon("triangle-alert", __iconNode$1L);

  const __iconNode$1K = [
    ["path", { d: "M10.17 4.193a2 2 0 0 1 3.666.013", key: "pltmmw" }],
    ["path", { d: "M14 21h2", key: "v4qezv" }],
    ["path", { d: "m15.874 7.743 1 1.732", key: "10m0iw" }],
    ["path", { d: "m18.849 12.952 1 1.732", key: "zadnam" }],
    ["path", { d: "M21.824 18.18a2 2 0 0 1-1.835 2.824", key: "fvwuk4" }],
    ["path", { d: "M4.024 21a2 2 0 0 1-1.839-2.839", key: "1e1kah" }],
    ["path", { d: "m5.136 12.952-1 1.732", key: "1u4ldi" }],
    ["path", { d: "M8 21h2", key: "i9zjee" }],
    ["path", { d: "m8.102 7.743-1 1.732", key: "1zzo4u" }]
  ];
  const TriangleDashed = createLucideIcon("triangle-dashed", __iconNode$1K);

  const __iconNode$1J = [
    [
      "path",
      {
        d: "M22 18a2 2 0 0 1-2 2H3c-1.1 0-1.3-.6-.4-1.3L20.4 4.3c.9-.7 1.6-.4 1.6.7Z",
        key: "183wce"
      }
    ]
  ];
  const TriangleRight = createLucideIcon("triangle-right", __iconNode$1J);

  const __iconNode$1I = [
    [
      "path",
      { d: "M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z", key: "14u9p9" }
    ]
  ];
  const Triangle = createLucideIcon("triangle", __iconNode$1I);

  const __iconNode$1H = [
    ["path", { d: "M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978", key: "1n3hpd" }],
    ["path", { d: "M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978", key: "rfe1zi" }],
    ["path", { d: "M18 9h1.5a1 1 0 0 0 0-5H18", key: "7xy6bh" }],
    ["path", { d: "M4 22h16", key: "57wxv0" }],
    ["path", { d: "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z", key: "1mhfuq" }],
    ["path", { d: "M6 9H4.5a1 1 0 0 1 0-5H6", key: "tex48p" }]
  ];
  const Trophy = createLucideIcon("trophy", __iconNode$1H);

  const __iconNode$1G = [
    ["path", { d: "M14 19V7a2 2 0 0 0-2-2H9", key: "15peso" }],
    ["path", { d: "M15 19H9", key: "18q6dt" }],
    [
      "path",
      {
        d: "M19 19h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62L18.3 9.38a1 1 0 0 0-.78-.38H14",
        key: "1dkp3j"
      }
    ],
    ["path", { d: "M2 13v5a1 1 0 0 0 1 1h2", key: "pkmmzz" }],
    [
      "path",
      { d: "M4 3 2.15 5.15a.495.495 0 0 0 .35.86h2.15a.47.47 0 0 1 .35.86L3 9.02", key: "1n26pd" }
    ],
    ["circle", { cx: "17", cy: "19", r: "2", key: "1nxcgd" }],
    ["circle", { cx: "7", cy: "19", r: "2", key: "gzo7y7" }]
  ];
  const TruckElectric = createLucideIcon("truck-electric", __iconNode$1G);

  const __iconNode$1F = [
    [
      "path",
      {
        d: "m12 10 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a8 8 0 1 0-16 0v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3l2-4h4Z",
        key: "1lbbv7"
      }
    ],
    ["path", { d: "M4.82 7.9 8 10", key: "m9wose" }],
    ["path", { d: "M15.18 7.9 12 10", key: "p8dp2u" }],
    ["path", { d: "M16.93 10H20a2 2 0 0 1 0 4H2", key: "12nsm7" }]
  ];
  const Turtle = createLucideIcon("turtle", __iconNode$1F);

  const __iconNode$1E = [
    [
      "path",
      {
        d: "M10 7.75a.75.75 0 0 1 1.142-.638l3.664 2.249a.75.75 0 0 1 0 1.278l-3.664 2.25a.75.75 0 0 1-1.142-.64z",
        key: "1pctta"
      }
    ],
    ["path", { d: "M7 21h10", key: "1b0cd5" }],
    ["rect", { width: "20", height: "14", x: "2", y: "3", rx: "2", key: "48i651" }]
  ];
  const TvMinimalPlay = createLucideIcon("tv-minimal-play", __iconNode$1E);

  const __iconNode$1D = [
    ["path", { d: "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2", key: "wrbu53" }],
    ["path", { d: "M15 18H9", key: "1lyqi6" }],
    [
      "path",
      {
        d: "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14",
        key: "lysw3i"
      }
    ],
    ["circle", { cx: "17", cy: "18", r: "2", key: "332jqn" }],
    ["circle", { cx: "7", cy: "18", r: "2", key: "19iecd" }]
  ];
  const Truck = createLucideIcon("truck", __iconNode$1D);

  const __iconNode$1C = [
    ["path", { d: "M7 21h10", key: "1b0cd5" }],
    ["rect", { width: "20", height: "14", x: "2", y: "3", rx: "2", key: "48i651" }]
  ];
  const TvMinimal = createLucideIcon("tv-minimal", __iconNode$1C);

  const __iconNode$1B = [
    ["path", { d: "m17 2-5 5-5-5", key: "16satq" }],
    ["rect", { width: "20", height: "15", x: "2", y: "7", rx: "2", key: "1e6viu" }]
  ];
  const Tv = createLucideIcon("tv", __iconNode$1B);

  const __iconNode$1A = [
    ["path", { d: "M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7", key: "c0yzno" }]
  ];
  const Twitch = createLucideIcon("twitch", __iconNode$1A);

  const __iconNode$1z = [
    [
      "path",
      {
        d: "M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z",
        key: "pff0z6"
      }
    ]
  ];
  const Twitter = createLucideIcon("twitter", __iconNode$1z);

  const __iconNode$1y = [
    [
      "path",
      {
        d: "M14 16.5a.5.5 0 0 0 .5.5h.5a2 2 0 0 1 0 4H9a2 2 0 0 1 0-4h.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V8a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z",
        key: "1reda3"
      }
    ]
  ];
  const TypeOutline = createLucideIcon("type-outline", __iconNode$1y);

  const __iconNode$1x = [
    ["path", { d: "M12 4v16", key: "1654pz" }],
    ["path", { d: "M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2", key: "e0r10z" }],
    ["path", { d: "M9 20h6", key: "s66wpe" }]
  ];
  const Type = createLucideIcon("type", __iconNode$1x);

  const __iconNode$1w = [
    ["path", { d: "M12 2v1", key: "11qlp1" }],
    ["path", { d: "M15.5 21a1.85 1.85 0 0 1-3.5-1v-8H2a10 10 0 0 1 3.428-6.575", key: "eki10q" }],
    ["path", { d: "M17.5 12H22A10 10 0 0 0 9.004 3.455", key: "n2ayka" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const UmbrellaOff = createLucideIcon("umbrella-off", __iconNode$1w);

  const __iconNode$1v = [
    ["path", { d: "M22 12a10.06 10.06 1 0 0-20 0Z", key: "1teyop" }],
    ["path", { d: "M12 12v8a2 2 0 0 0 4 0", key: "ulpmoc" }],
    ["path", { d: "M12 2v1", key: "11qlp1" }]
  ];
  const Umbrella = createLucideIcon("umbrella", __iconNode$1v);

  const __iconNode$1u = [
    ["path", { d: "M6 4v6a6 6 0 0 0 12 0V4", key: "9kb039" }],
    ["line", { x1: "4", x2: "20", y1: "20", y2: "20", key: "nun2al" }]
  ];
  const Underline = createLucideIcon("underline", __iconNode$1u);

  const __iconNode$1t = [
    ["path", { d: "M9 14 4 9l5-5", key: "102s5s" }],
    ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11", key: "f3b9sd" }]
  ];
  const Undo2 = createLucideIcon("undo-2", __iconNode$1t);

  const __iconNode$1s = [
    ["path", { d: "M21 17a9 9 0 0 0-15-6.7L3 13", key: "8mp6z9" }],
    ["path", { d: "M3 7v6h6", key: "1v2h90" }],
    ["circle", { cx: "12", cy: "17", r: "1", key: "1ixnty" }]
  ];
  const UndoDot = createLucideIcon("undo-dot", __iconNode$1s);

  const __iconNode$1r = [
    ["path", { d: "M3 7v6h6", key: "1v2h90" }],
    ["path", { d: "M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13", key: "1r6uu6" }]
  ];
  const Undo = createLucideIcon("undo", __iconNode$1r);

  const __iconNode$1q = [
    ["path", { d: "M16 12h6", key: "15xry1" }],
    ["path", { d: "M8 12H2", key: "1jqql6" }],
    ["path", { d: "M12 2v2", key: "tus03m" }],
    ["path", { d: "M12 8v2", key: "1woqiv" }],
    ["path", { d: "M12 14v2", key: "8jcxud" }],
    ["path", { d: "M12 20v2", key: "1lh1kg" }],
    ["path", { d: "m19 15 3-3-3-3", key: "wjy7rq" }],
    ["path", { d: "m5 9-3 3 3 3", key: "j64kie" }]
  ];
  const UnfoldHorizontal = createLucideIcon("unfold-horizontal", __iconNode$1q);

  const __iconNode$1p = [
    ["path", { d: "M12 22v-6", key: "6o8u61" }],
    ["path", { d: "M12 8V2", key: "1wkif3" }],
    ["path", { d: "M4 12H2", key: "rhcxmi" }],
    ["path", { d: "M10 12H8", key: "s88cx1" }],
    ["path", { d: "M16 12h-2", key: "10asgb" }],
    ["path", { d: "M22 12h-2", key: "14jgyd" }],
    ["path", { d: "m15 19-3 3-3-3", key: "11eu04" }],
    ["path", { d: "m15 5-3-3-3 3", key: "itvq4r" }]
  ];
  const UnfoldVertical = createLucideIcon("unfold-vertical", __iconNode$1p);

  const __iconNode$1o = [
    ["rect", { width: "8", height: "6", x: "5", y: "4", rx: "1", key: "nzclkv" }],
    ["rect", { width: "8", height: "6", x: "11", y: "14", rx: "1", key: "4tytwb" }]
  ];
  const Ungroup = createLucideIcon("ungroup", __iconNode$1o);

  const __iconNode$1n = [
    ["path", { d: "M14 21v-3a2 2 0 0 0-4 0v3", key: "1rgiei" }],
    ["path", { d: "M18 12h.01", key: "yjnet6" }],
    ["path", { d: "M18 16h.01", key: "plv8zi" }],
    [
      "path",
      {
        d: "M22 7a1 1 0 0 0-1-1h-2a2 2 0 0 1-1.143-.359L13.143 2.36a2 2 0 0 0-2.286-.001L6.143 5.64A2 2 0 0 1 5 6H3a1 1 0 0 0-1 1v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z",
        key: "1ogmi3"
      }
    ],
    ["path", { d: "M6 12h.01", key: "c2rlol" }],
    ["path", { d: "M6 16h.01", key: "1pmjb7" }],
    ["circle", { cx: "12", cy: "10", r: "2", key: "1yojzk" }]
  ];
  const University = createLucideIcon("university", __iconNode$1n);

  const __iconNode$1m = [
    ["path", { d: "M15 7h2a5 5 0 0 1 0 10h-2m-6 0H7A5 5 0 0 1 7 7h2", key: "1re2ne" }]
  ];
  const Unlink2 = createLucideIcon("unlink-2", __iconNode$1m);

  const __iconNode$1l = [
    [
      "path",
      {
        d: "m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71",
        key: "yqzxt4"
      }
    ],
    [
      "path",
      {
        d: "m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71",
        key: "4qinb0"
      }
    ],
    ["line", { x1: "8", x2: "8", y1: "2", y2: "5", key: "1041cp" }],
    ["line", { x1: "2", x2: "5", y1: "8", y2: "8", key: "14m1p5" }],
    ["line", { x1: "16", x2: "16", y1: "19", y2: "22", key: "rzdirn" }],
    ["line", { x1: "19", x2: "22", y1: "16", y2: "16", key: "ox905f" }]
  ];
  const Unlink = createLucideIcon("unlink", __iconNode$1l);

  const __iconNode$1k = [
    ["path", { d: "m19 5 3-3", key: "yk6iyv" }],
    ["path", { d: "m2 22 3-3", key: "19mgm9" }],
    [
      "path",
      { d: "M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z", key: "goz73y" }
    ],
    ["path", { d: "M7.5 13.5 10 11", key: "7xgeeb" }],
    ["path", { d: "M10.5 16.5 13 14", key: "10btkg" }],
    [
      "path",
      { d: "m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z", key: "1snsnr" }
    ]
  ];
  const Unplug = createLucideIcon("unplug", __iconNode$1k);

  const __iconNode$1j = [
    ["path", { d: "M12 3v12", key: "1x0j5s" }],
    ["path", { d: "m17 8-5-5-5 5", key: "7q97r8" }],
    ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }]
  ];
  const Upload = createLucideIcon("upload", __iconNode$1j);

  const __iconNode$1i = [
    ["circle", { cx: "10", cy: "7", r: "1", key: "dypaad" }],
    ["circle", { cx: "4", cy: "20", r: "1", key: "22iqad" }],
    ["path", { d: "M4.7 19.3 19 5", key: "1enqfc" }],
    ["path", { d: "m21 3-3 1 2 2Z", key: "d3ov82" }],
    ["path", { d: "M9.26 7.68 5 12l2 5", key: "1esawj" }],
    ["path", { d: "m10 14 5 2 3.5-3.5", key: "v8oal5" }],
    ["path", { d: "m18 12 1-1 1 1-1 1Z", key: "1bh22v" }]
  ];
  const Usb = createLucideIcon("usb", __iconNode$1i);

  const __iconNode$1h = [
    ["path", { d: "m16 11 2 2 4-4", key: "9rsbq5" }],
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }]
  ];
  const UserCheck = createLucideIcon("user-check", __iconNode$1h);

  const __iconNode$1g = [
    ["path", { d: "M10 15H6a4 4 0 0 0-4 4v2", key: "1nfge6" }],
    ["path", { d: "m14.305 16.53.923-.382", key: "1itpsq" }],
    ["path", { d: "m15.228 13.852-.923-.383", key: "eplpkm" }],
    ["path", { d: "m16.852 12.228-.383-.923", key: "13v3q0" }],
    ["path", { d: "m16.852 17.772-.383.924", key: "1i8mnm" }],
    ["path", { d: "m19.148 12.228.383-.923", key: "1q8j1v" }],
    ["path", { d: "m19.53 18.696-.382-.924", key: "vk1qj3" }],
    ["path", { d: "m20.772 13.852.924-.383", key: "n880s0" }],
    ["path", { d: "m20.772 16.148.924.383", key: "1g6xey" }],
    ["circle", { cx: "18", cy: "15", r: "3", key: "gjjjvw" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }]
  ];
  const UserCog = createLucideIcon("user-cog", __iconNode$1g);

  const __iconNode$1f = [
    ["circle", { cx: "10", cy: "7", r: "4", key: "e45bow" }],
    ["path", { d: "M10.3 15H7a4 4 0 0 0-4 4v2", key: "3bnktk" }],
    ["path", { d: "M15 15.5V14a2 2 0 0 1 4 0v1.5", key: "12ym5i" }],
    ["rect", { width: "8", height: "5", x: "13", y: "16", rx: ".899", key: "4p176n" }]
  ];
  const UserLock = createLucideIcon("user-lock", __iconNode$1f);

  const __iconNode$1e = [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
    ["line", { x1: "22", x2: "16", y1: "11", y2: "11", key: "1shjgl" }]
  ];
  const UserMinus = createLucideIcon("user-minus", __iconNode$1e);

  const __iconNode$1d = [
    ["path", { d: "M11.5 15H7a4 4 0 0 0-4 4v2", key: "15lzij" }],
    [
      "path",
      {
        d: "M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
        key: "1817ys"
      }
    ],
    ["circle", { cx: "10", cy: "7", r: "4", key: "e45bow" }]
  ];
  const UserPen = createLucideIcon("user-pen", __iconNode$1d);

  const __iconNode$1c = [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
    ["line", { x1: "19", x2: "19", y1: "8", y2: "14", key: "1bvyxn" }],
    ["line", { x1: "22", x2: "16", y1: "11", y2: "11", key: "1shjgl" }]
  ];
  const UserPlus = createLucideIcon("user-plus", __iconNode$1c);

  const __iconNode$1b = [
    ["path", { d: "M2 21a8 8 0 0 1 13.292-6", key: "bjp14o" }],
    ["circle", { cx: "10", cy: "8", r: "5", key: "o932ke" }],
    ["path", { d: "m16 19 2 2 4-4", key: "1b14m6" }]
  ];
  const UserRoundCheck = createLucideIcon("user-round-check", __iconNode$1b);

  const __iconNode$1a = [
    ["path", { d: "m14.305 19.53.923-.382", key: "3m78fa" }],
    ["path", { d: "m15.228 16.852-.923-.383", key: "npixar" }],
    ["path", { d: "m16.852 15.228-.383-.923", key: "5xggr7" }],
    ["path", { d: "m16.852 20.772-.383.924", key: "dpfhf9" }],
    ["path", { d: "m19.148 15.228.383-.923", key: "1reyyz" }],
    ["path", { d: "m19.53 21.696-.382-.924", key: "1goivc" }],
    ["path", { d: "M2 21a8 8 0 0 1 10.434-7.62", key: "1yezr2" }],
    ["path", { d: "m20.772 16.852.924-.383", key: "htqkph" }],
    ["path", { d: "m20.772 19.148.924.383", key: "9w9pjp" }],
    ["circle", { cx: "10", cy: "8", r: "5", key: "o932ke" }],
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }]
  ];
  const UserRoundCog = createLucideIcon("user-round-cog", __iconNode$1a);

  const __iconNode$19 = [
    ["path", { d: "M2 21a8 8 0 0 1 13.292-6", key: "bjp14o" }],
    ["circle", { cx: "10", cy: "8", r: "5", key: "o932ke" }],
    ["path", { d: "M22 19h-6", key: "vcuq98" }]
  ];
  const UserRoundMinus = createLucideIcon("user-round-minus", __iconNode$19);

  const __iconNode$18 = [
    ["path", { d: "M2 21a8 8 0 0 1 10.821-7.487", key: "1c8h7z" }],
    [
      "path",
      {
        d: "M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
        key: "1817ys"
      }
    ],
    ["circle", { cx: "10", cy: "8", r: "5", key: "o932ke" }]
  ];
  const UserRoundPen = createLucideIcon("user-round-pen", __iconNode$18);

  const __iconNode$17 = [
    ["path", { d: "M2 21a8 8 0 0 1 13.292-6", key: "bjp14o" }],
    ["circle", { cx: "10", cy: "8", r: "5", key: "o932ke" }],
    ["path", { d: "M19 16v6", key: "tddt3s" }],
    ["path", { d: "M22 19h-6", key: "vcuq98" }]
  ];
  const UserRoundPlus = createLucideIcon("user-round-plus", __iconNode$17);

  const __iconNode$16 = [
    ["circle", { cx: "10", cy: "8", r: "5", key: "o932ke" }],
    ["path", { d: "M2 21a8 8 0 0 1 10.434-7.62", key: "1yezr2" }],
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }],
    ["path", { d: "m22 22-1.9-1.9", key: "1e5ubv" }]
  ];
  const UserRoundSearch = createLucideIcon("user-round-search", __iconNode$16);

  const __iconNode$15 = [
    ["path", { d: "M2 21a8 8 0 0 1 11.873-7", key: "74fkxq" }],
    ["circle", { cx: "10", cy: "8", r: "5", key: "o932ke" }],
    ["path", { d: "m17 17 5 5", key: "p7ous7" }],
    ["path", { d: "m22 17-5 5", key: "gqnmv0" }]
  ];
  const UserRoundX = createLucideIcon("user-round-x", __iconNode$15);

  const __iconNode$14 = [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
    ["line", { x1: "17", x2: "22", y1: "8", y2: "13", key: "3nzzx3" }],
    ["line", { x1: "22", x2: "17", y1: "8", y2: "13", key: "1swrse" }]
  ];
  const UserX = createLucideIcon("user-x", __iconNode$14);

  const __iconNode$13 = [
    ["circle", { cx: "12", cy: "8", r: "5", key: "1hypcn" }],
    ["path", { d: "M20 21a8 8 0 0 0-16 0", key: "rfgkzh" }]
  ];
  const UserRound = createLucideIcon("user-round", __iconNode$13);

  const __iconNode$12 = [
    ["circle", { cx: "10", cy: "7", r: "4", key: "e45bow" }],
    ["path", { d: "M10.3 15H7a4 4 0 0 0-4 4v2", key: "3bnktk" }],
    ["circle", { cx: "17", cy: "17", r: "3", key: "18b49y" }],
    ["path", { d: "m21 21-1.9-1.9", key: "1g2n9r" }]
  ];
  const UserSearch = createLucideIcon("user-search", __iconNode$12);

  const __iconNode$11 = [
    ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", key: "975kel" }],
    ["circle", { cx: "12", cy: "7", r: "4", key: "17ys0d" }]
  ];
  const User = createLucideIcon("user", __iconNode$11);

  const __iconNode$10 = [
    ["path", { d: "M18 21a8 8 0 0 0-16 0", key: "3ypg7q" }],
    ["circle", { cx: "10", cy: "8", r: "5", key: "o932ke" }],
    ["path", { d: "M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3", key: "10s06x" }]
  ];
  const UsersRound = createLucideIcon("users-round", __iconNode$10);

  const __iconNode$$ = [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
    ["path", { d: "M16 3.128a4 4 0 0 1 0 7.744", key: "16gr8j" }],
    ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
    ["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }]
  ];
  const Users = createLucideIcon("users", __iconNode$$);

  const __iconNode$_ = [
    ["path", { d: "m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8", key: "n7qcjb" }],
    [
      "path",
      { d: "M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7", key: "d0u48b" }
    ],
    ["path", { d: "m2.1 21.8 6.4-6.3", key: "yn04lh" }],
    ["path", { d: "m19 5-7 7", key: "194lzd" }]
  ];
  const UtensilsCrossed = createLucideIcon("utensils-crossed", __iconNode$_);

  const __iconNode$Z = [
    ["path", { d: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2", key: "cjf0a3" }],
    ["path", { d: "M7 2v20", key: "1473qp" }],
    ["path", { d: "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7", key: "j28e5" }]
  ];
  const Utensils = createLucideIcon("utensils", __iconNode$Z);

  const __iconNode$Y = [
    ["path", { d: "M12 2v20", key: "t6zp3m" }],
    ["path", { d: "M2 5h20", key: "1fs1ex" }],
    ["path", { d: "M3 3v2", key: "9imdir" }],
    ["path", { d: "M7 3v2", key: "n0os7" }],
    ["path", { d: "M17 3v2", key: "1l2re6" }],
    ["path", { d: "M21 3v2", key: "1duuac" }],
    ["path", { d: "m19 5-7 7-7-7", key: "133zxf" }]
  ];
  const UtilityPole = createLucideIcon("utility-pole", __iconNode$Y);

  const __iconNode$X = [
    ["path", { d: "M8 21s-4-3-4-9 4-9 4-9", key: "uto9ud" }],
    ["path", { d: "M16 3s4 3 4 9-4 9-4 9", key: "4w2vsq" }],
    ["line", { x1: "15", x2: "9", y1: "9", y2: "15", key: "f7djnv" }],
    ["line", { x1: "9", x2: "15", y1: "9", y2: "15", key: "1shsy8" }]
  ];
  const Variable = createLucideIcon("variable", __iconNode$X);

  const __iconNode$W = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["circle", { cx: "7.5", cy: "7.5", r: ".5", fill: "currentColor", key: "kqv944" }],
    ["path", { d: "m7.9 7.9 2.7 2.7", key: "hpeyl3" }],
    ["circle", { cx: "16.5", cy: "7.5", r: ".5", fill: "currentColor", key: "w0ekpg" }],
    ["path", { d: "m13.4 10.6 2.7-2.7", key: "264c1n" }],
    ["circle", { cx: "7.5", cy: "16.5", r: ".5", fill: "currentColor", key: "nkw3mc" }],
    ["path", { d: "m7.9 16.1 2.7-2.7", key: "p81g5e" }],
    ["circle", { cx: "16.5", cy: "16.5", r: ".5", fill: "currentColor", key: "fubopw" }],
    ["path", { d: "m13.4 13.4 2.7 2.7", key: "abhel3" }],
    ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]
  ];
  const Vault = createLucideIcon("vault", __iconNode$W);

  const __iconNode$V = [
    ["path", { d: "M16 8q6 0 6-6-6 0-6 6", key: "qsyyc4" }],
    ["path", { d: "M17.41 3.59a10 10 0 1 0 3 3", key: "41m9h7" }],
    ["path", { d: "M2 2a26.6 26.6 0 0 1 10 20c.9-6.82 1.5-9.5 4-14", key: "qiv7li" }]
  ];
  const Vegan = createLucideIcon("vegan", __iconNode$V);

  const __iconNode$U = [
    ["path", { d: "M18 11c-1.5 0-2.5.5-3 2", key: "1fod00" }],
    [
      "path",
      {
        d: "M4 6a2 2 0 0 0-2 2v4a5 5 0 0 0 5 5 8 8 0 0 1 5 2 8 8 0 0 1 5-2 5 5 0 0 0 5-5V8a2 2 0 0 0-2-2h-3a8 8 0 0 0-5 2 8 8 0 0 0-5-2z",
        key: "d70hit"
      }
    ],
    ["path", { d: "M6 11c1.5 0 2.5.5 3 2", key: "136fht" }]
  ];
  const VenetianMask = createLucideIcon("venetian-mask", __iconNode$U);

  const __iconNode$T = [
    ["path", { d: "M10 20h4", key: "ni2waw" }],
    ["path", { d: "M12 16v6", key: "c8a4gj" }],
    ["path", { d: "M17 2h4v4", key: "vhe59" }],
    ["path", { d: "m21 2-5.46 5.46", key: "19kypf" }],
    ["circle", { cx: "12", cy: "11", r: "5", key: "16gxyc" }]
  ];
  const VenusAndMars = createLucideIcon("venus-and-mars", __iconNode$T);

  const __iconNode$S = [
    ["path", { d: "M12 15v7", key: "t2xh3l" }],
    ["path", { d: "M9 19h6", key: "456am0" }],
    ["circle", { cx: "12", cy: "9", r: "6", key: "1nw4tq" }]
  ];
  const Venus = createLucideIcon("venus", __iconNode$S);

  const __iconNode$R = [
    ["path", { d: "m2 8 2 2-2 2 2 2-2 2", key: "sv1b1" }],
    ["path", { d: "m22 8-2 2 2 2-2 2 2 2", key: "101i4y" }],
    ["path", { d: "M8 8v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2", key: "1hbad5" }],
    ["path", { d: "M16 10.34V6c0-.55-.45-1-1-1h-4.34", key: "1x5tf0" }],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const VibrateOff = createLucideIcon("vibrate-off", __iconNode$R);

  const __iconNode$Q = [
    ["path", { d: "m2 8 2 2-2 2 2 2-2 2", key: "sv1b1" }],
    ["path", { d: "m22 8-2 2 2 2-2 2 2 2", key: "101i4y" }],
    ["rect", { width: "8", height: "14", x: "8", y: "5", rx: "1", key: "1oyrl4" }]
  ];
  const Vibrate = createLucideIcon("vibrate", __iconNode$Q);

  const __iconNode$P = [
    [
      "path",
      { d: "M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196", key: "w8jjjt" }
    ],
    ["path", { d: "M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2", key: "1xawa7" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const VideoOff = createLucideIcon("video-off", __iconNode$P);

  const __iconNode$O = [
    [
      "path",
      {
        d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",
        key: "ftymec"
      }
    ],
    ["rect", { x: "2", y: "6", width: "14", height: "12", rx: "2", key: "158x01" }]
  ];
  const Video = createLucideIcon("video", __iconNode$O);

  const __iconNode$N = [
    ["rect", { width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" }],
    ["path", { d: "M2 8h20", key: "d11cs7" }],
    ["circle", { cx: "8", cy: "14", r: "2", key: "1k2qr5" }],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
    ["circle", { cx: "16", cy: "14", r: "2", key: "14k7lr" }]
  ];
  const Videotape = createLucideIcon("videotape", __iconNode$N);

  const __iconNode$M = [
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2", key: "mrq65r" }],
    ["path", { d: "M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2", key: "be3xqs" }],
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
    [
      "path",
      {
        d: "M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0",
        key: "11ak4c"
      }
    ]
  ];
  const View = createLucideIcon("view", __iconNode$M);

  const __iconNode$L = [
    ["circle", { cx: "6", cy: "12", r: "4", key: "1ehtga" }],
    ["circle", { cx: "18", cy: "12", r: "4", key: "4vafl8" }],
    ["line", { x1: "6", x2: "18", y1: "16", y2: "16", key: "pmt8us" }]
  ];
  const Voicemail = createLucideIcon("voicemail", __iconNode$L);

  const __iconNode$K = [
    ["path", { d: "M11.1 7.1a16.55 16.55 0 0 1 10.9 4", key: "2880wi" }],
    ["path", { d: "M12 12a12.6 12.6 0 0 1-8.7 5", key: "113sja" }],
    ["path", { d: "M16.8 13.6a16.55 16.55 0 0 1-9 7.5", key: "1qmsgl" }],
    ["path", { d: "M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10", key: "1bmeqp" }],
    ["path", { d: "M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5", key: "iekzv9" }],
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]
  ];
  const Volleyball = createLucideIcon("volleyball", __iconNode$K);

  const __iconNode$J = [
    [
      "path",
      {
        d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
        key: "uqj9uw"
      }
    ],
    ["path", { d: "M16 9a5 5 0 0 1 0 6", key: "1q6k2b" }]
  ];
  const Volume1 = createLucideIcon("volume-1", __iconNode$J);

  const __iconNode$I = [
    [
      "path",
      {
        d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
        key: "uqj9uw"
      }
    ],
    ["path", { d: "M16 9a5 5 0 0 1 0 6", key: "1q6k2b" }],
    ["path", { d: "M19.364 18.364a9 9 0 0 0 0-12.728", key: "ijwkga" }]
  ];
  const Volume2 = createLucideIcon("volume-2", __iconNode$I);

  const __iconNode$H = [
    ["path", { d: "M16 9a5 5 0 0 1 .95 2.293", key: "1fgyg8" }],
    ["path", { d: "M19.364 5.636a9 9 0 0 1 1.889 9.96", key: "l3zxae" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
    [
      "path",
      {
        d: "m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11",
        key: "1gbwow"
      }
    ],
    ["path", { d: "M9.828 4.172A.686.686 0 0 1 11 4.657v.686", key: "s2je0y" }]
  ];
  const VolumeOff = createLucideIcon("volume-off", __iconNode$H);

  const __iconNode$G = [
    [
      "path",
      {
        d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
        key: "uqj9uw"
      }
    ],
    ["line", { x1: "22", x2: "16", y1: "9", y2: "15", key: "1ewh16" }],
    ["line", { x1: "16", x2: "22", y1: "9", y2: "15", key: "5ykzw1" }]
  ];
  const VolumeX = createLucideIcon("volume-x", __iconNode$G);

  const __iconNode$F = [
    [
      "path",
      {
        d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
        key: "uqj9uw"
      }
    ]
  ];
  const Volume = createLucideIcon("volume", __iconNode$F);

  const __iconNode$E = [
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }],
    ["path", { d: "M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z", key: "1ezoue" }],
    ["path", { d: "M22 19H2", key: "nuriw5" }]
  ];
  const Vote = createLucideIcon("vote", __iconNode$E);

  const __iconNode$D = [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }],
    ["path", { d: "M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2", key: "4125el" }],
    [
      "path",
      {
        d: "M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21",
        key: "1dpki6"
      }
    ]
  ];
  const WalletCards = createLucideIcon("wallet-cards", __iconNode$D);

  const __iconNode$C = [
    ["path", { d: "M17 14h.01", key: "7oqj8z" }],
    [
      "path",
      {
        d: "M7 7h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14",
        key: "u1rqew"
      }
    ]
  ];
  const WalletMinimal = createLucideIcon("wallet-minimal", __iconNode$C);

  const __iconNode$B = [
    [
      "path",
      {
        d: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
        key: "18etb6"
      }
    ],
    ["path", { d: "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4", key: "xoc0q4" }]
  ];
  const Wallet = createLucideIcon("wallet", __iconNode$B);

  const __iconNode$A = [
    ["circle", { cx: "8", cy: "9", r: "2", key: "gjzl9d" }],
    [
      "path",
      {
        d: "m9 17 6.1-6.1a2 2 0 0 1 2.81.01L22 15V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2",
        key: "69xh40"
      }
    ],
    ["path", { d: "M8 21h8", key: "1ev6f3" }],
    ["path", { d: "M12 17v4", key: "1riwvh" }]
  ];
  const Wallpaper = createLucideIcon("wallpaper", __iconNode$A);

  const __iconNode$z = [
    [
      "path",
      {
        d: "m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72",
        key: "ul74o6"
      }
    ],
    ["path", { d: "m14 7 3 3", key: "1r5n42" }],
    ["path", { d: "M5 6v4", key: "ilb8ba" }],
    ["path", { d: "M19 14v4", key: "blhpug" }],
    ["path", { d: "M10 2v2", key: "7u0qdc" }],
    ["path", { d: "M7 8H3", key: "zfb6yr" }],
    ["path", { d: "M21 16h-4", key: "1cnmox" }],
    ["path", { d: "M11 3H9", key: "1obp7u" }]
  ];
  const WandSparkles = createLucideIcon("wand-sparkles", __iconNode$z);

  const __iconNode$y = [
    ["path", { d: "M15 4V2", key: "z1p9b7" }],
    ["path", { d: "M15 16v-2", key: "px0unx" }],
    ["path", { d: "M8 9h2", key: "1g203m" }],
    ["path", { d: "M20 9h2", key: "19tzq7" }],
    ["path", { d: "M17.8 11.8 19 13", key: "yihg8r" }],
    ["path", { d: "M15 9h.01", key: "x1ddxp" }],
    ["path", { d: "M17.8 6.2 19 5", key: "fd4us0" }],
    ["path", { d: "m3 21 9-9", key: "1jfql5" }],
    ["path", { d: "M12.2 6.2 11 5", key: "i3da3b" }]
  ];
  const Wand = createLucideIcon("wand", __iconNode$y);

  const __iconNode$x = [
    ["path", { d: "M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11", key: "pb2vm6" }],
    [
      "path",
      {
        d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z",
        key: "doq5xv"
      }
    ],
    ["path", { d: "M6 13h12", key: "yf64js" }],
    ["path", { d: "M6 17h12", key: "1jwigz" }]
  ];
  const Warehouse = createLucideIcon("warehouse", __iconNode$x);

  const __iconNode$w = [
    ["path", { d: "M3 6h3", key: "155dbl" }],
    ["path", { d: "M17 6h.01", key: "e2y6kg" }],
    ["rect", { width: "18", height: "20", x: "3", y: "2", rx: "2", key: "od3kk9" }],
    ["circle", { cx: "12", cy: "13", r: "5", key: "nlbqau" }],
    ["path", { d: "M12 18a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 1 0-5", key: "17lach" }]
  ];
  const WashingMachine = createLucideIcon("washing-machine", __iconNode$w);

  const __iconNode$v = [
    ["circle", { cx: "12", cy: "12", r: "6", key: "1vlfrh" }],
    ["polyline", { points: "12 10 12 12 13 13", key: "19dquz" }],
    [
      "path",
      { d: "m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05", key: "18k57s" }
    ],
    ["path", { d: "m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05", key: "16ny36" }]
  ];
  const Watch = createLucideIcon("watch", __iconNode$v);

  const __iconNode$u = [
    ["path", { d: "M19 5a2 2 0 0 0-2 2v11", key: "s41o68" }],
    [
      "path",
      {
        d: "M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
        key: "rd2r6e"
      }
    ],
    ["path", { d: "M7 13h10", key: "1rwob1" }],
    ["path", { d: "M7 9h10", key: "12czzb" }],
    ["path", { d: "M9 5a2 2 0 0 0-2 2v11", key: "x0q4gh" }]
  ];
  const WavesLadder = createLucideIcon("waves-ladder", __iconNode$u);

  const __iconNode$t = [
    [
      "path",
      {
        d: "M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
        key: "knzxuh"
      }
    ],
    [
      "path",
      {
        d: "M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
        key: "2jd2cc"
      }
    ],
    [
      "path",
      {
        d: "M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1",
        key: "rd2r6e"
      }
    ]
  ];
  const Waves = createLucideIcon("waves", __iconNode$t);

  const __iconNode$s = [
    ["circle", { cx: "12", cy: "4.5", r: "2.5", key: "r5ysbb" }],
    ["path", { d: "m10.2 6.3-3.9 3.9", key: "1nzqf6" }],
    ["circle", { cx: "4.5", cy: "12", r: "2.5", key: "jydg6v" }],
    ["path", { d: "M7 12h10", key: "b7w52i" }],
    ["circle", { cx: "19.5", cy: "12", r: "2.5", key: "1piiel" }],
    ["path", { d: "m13.8 17.7 3.9-3.9", key: "1wyg1y" }],
    ["circle", { cx: "12", cy: "19.5", r: "2.5", key: "13o1pw" }]
  ];
  const Waypoints = createLucideIcon("waypoints", __iconNode$s);

  const __iconNode$r = [
    ["circle", { cx: "12", cy: "10", r: "8", key: "1gshiw" }],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }],
    ["path", { d: "M7 22h10", key: "10w4w3" }],
    ["path", { d: "M12 22v-4", key: "1utk9m" }]
  ];
  const Webcam = createLucideIcon("webcam", __iconNode$r);

  const __iconNode$q = [
    ["path", { d: "M17 17h-5c-1.09-.02-1.94.92-2.5 1.9A3 3 0 1 1 2.57 15", key: "1tvl6x" }],
    ["path", { d: "M9 3.4a4 4 0 0 1 6.52.66", key: "q04jfq" }],
    ["path", { d: "m6 17 3.1-5.8a2.5 2.5 0 0 0 .057-2.05", key: "azowf0" }],
    ["path", { d: "M20.3 20.3a4 4 0 0 1-2.3.7", key: "5joiws" }],
    ["path", { d: "M18.6 13a4 4 0 0 1 3.357 3.414", key: "cangb8" }],
    ["path", { d: "m12 6 .6 1", key: "tpjl1n" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const WebhookOff = createLucideIcon("webhook-off", __iconNode$q);

  const __iconNode$p = [
    [
      "path",
      {
        d: "M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2",
        key: "q3hayz"
      }
    ],
    ["path", { d: "m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06", key: "1go1hn" }],
    ["path", { d: "m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8", key: "qlwsc0" }]
  ];
  const Webhook = createLucideIcon("webhook", __iconNode$p);

  const __iconNode$o = [
    ["circle", { cx: "12", cy: "5", r: "3", key: "rqqgnr" }],
    [
      "path",
      {
        d: "M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8Z",
        key: "56o5sh"
      }
    ]
  ];
  const Weight = createLucideIcon("weight", __iconNode$o);

  const __iconNode$n = [
    ["path", { d: "m2 22 10-10", key: "28ilpk" }],
    ["path", { d: "m16 8-1.17 1.17", key: "1qqm82" }],
    [
      "path",
      {
        d: "M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
        key: "1rdhi6"
      }
    ],
    [
      "path",
      { d: "m8 8-.53.53a3.5 3.5 0 0 0 0 4.94L9 15l1.53-1.53c.55-.55.88-1.25.98-1.97", key: "4wz8re" }
    ],
    [
      "path",
      { d: "M10.91 5.26c.15-.26.34-.51.56-.73L13 3l1.53 1.53a3.5 3.5 0 0 1 .28 4.62", key: "rves66" }
    ],
    ["path", { d: "M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z", key: "19rau1" }],
    [
      "path",
      {
        d: "M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
        key: "tc8ph9"
      }
    ],
    [
      "path",
      {
        d: "m16 16-.53.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.49 3.49 0 0 1 1.97-.98",
        key: "ak46r"
      }
    ],
    [
      "path",
      {
        d: "M18.74 13.09c.26-.15.51-.34.73-.56L21 11l-1.53-1.53a3.5 3.5 0 0 0-4.62-.28",
        key: "1tw520"
      }
    ],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const WheatOff = createLucideIcon("wheat-off", __iconNode$n);

  const __iconNode$m = [
    ["path", { d: "M2 22 16 8", key: "60hf96" }],
    [
      "path",
      {
        d: "M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
        key: "1rdhi6"
      }
    ],
    [
      "path",
      {
        d: "M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
        key: "1sdzmb"
      }
    ],
    [
      "path",
      {
        d: "M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z",
        key: "eoatbi"
      }
    ],
    ["path", { d: "M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z", key: "19rau1" }],
    [
      "path",
      {
        d: "M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
        key: "tc8ph9"
      }
    ],
    [
      "path",
      {
        d: "M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
        key: "2m8kc5"
      }
    ],
    [
      "path",
      {
        d: "M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z",
        key: "vex3ng"
      }
    ]
  ];
  const Wheat = createLucideIcon("wheat", __iconNode$m);

  const __iconNode$l = [
    ["circle", { cx: "7", cy: "12", r: "3", key: "12clwm" }],
    ["path", { d: "M10 9v6", key: "17i7lo" }],
    ["circle", { cx: "17", cy: "12", r: "3", key: "gl7c2s" }],
    ["path", { d: "M14 7v8", key: "dl84cr" }],
    ["path", { d: "M22 17v1c0 .5-.5 1-1 1H3c-.5 0-1-.5-1-1v-1", key: "lt2kga" }]
  ];
  const WholeWord = createLucideIcon("whole-word", __iconNode$l);

  const __iconNode$k = [
    ["path", { d: "m14.305 19.53.923-.382", key: "3m78fa" }],
    ["path", { d: "m15.228 16.852-.923-.383", key: "npixar" }],
    ["path", { d: "m16.852 15.228-.383-.923", key: "5xggr7" }],
    ["path", { d: "m16.852 20.772-.383.924", key: "dpfhf9" }],
    ["path", { d: "m19.148 15.228.383-.923", key: "1reyyz" }],
    ["path", { d: "m19.53 21.696-.382-.924", key: "1goivc" }],
    ["path", { d: "M2 7.82a15 15 0 0 1 20 0", key: "1ovjuk" }],
    ["path", { d: "m20.772 16.852.924-.383", key: "htqkph" }],
    ["path", { d: "m20.772 19.148.924.383", key: "9w9pjp" }],
    ["path", { d: "M5 11.858a10 10 0 0 1 11.5-1.785", key: "3sn16i" }],
    ["path", { d: "M8.5 15.429a5 5 0 0 1 2.413-1.31", key: "1pxovh" }],
    ["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }]
  ];
  const WifiCog = createLucideIcon("wifi-cog", __iconNode$k);

  const __iconNode$j = [
    ["path", { d: "M12 20h.01", key: "zekei9" }],
    ["path", { d: "M5 12.859a10 10 0 0 1 14 0", key: "1x1e6c" }],
    ["path", { d: "M8.5 16.429a5 5 0 0 1 7 0", key: "1bycff" }]
  ];
  const WifiHigh = createLucideIcon("wifi-high", __iconNode$j);

  const __iconNode$i = [
    ["path", { d: "M12 20h.01", key: "zekei9" }],
    ["path", { d: "M8.5 16.429a5 5 0 0 1 7 0", key: "1bycff" }]
  ];
  const WifiLow = createLucideIcon("wifi-low", __iconNode$i);

  const __iconNode$h = [
    ["path", { d: "M12 20h.01", key: "zekei9" }],
    ["path", { d: "M8.5 16.429a5 5 0 0 1 7 0", key: "1bycff" }],
    ["path", { d: "M5 12.859a10 10 0 0 1 5.17-2.69", key: "1dl1wf" }],
    ["path", { d: "M19 12.859a10 10 0 0 0-2.007-1.523", key: "4k23kn" }],
    ["path", { d: "M2 8.82a15 15 0 0 1 4.177-2.643", key: "1grhjp" }],
    ["path", { d: "M22 8.82a15 15 0 0 0-11.288-3.764", key: "z3jwby" }],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const WifiOff = createLucideIcon("wifi-off", __iconNode$h);

  const __iconNode$g = [
    ["path", { d: "M2 8.82a15 15 0 0 1 20 0", key: "dnpr2z" }],
    [
      "path",
      {
        d: "M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
        key: "1817ys"
      }
    ],
    ["path", { d: "M5 12.859a10 10 0 0 1 10.5-2.222", key: "rpb7oy" }],
    ["path", { d: "M8.5 16.429a5 5 0 0 1 3-1.406", key: "r8bmzl" }]
  ];
  const WifiPen = createLucideIcon("wifi-pen", __iconNode$g);

  const __iconNode$f = [["path", { d: "M12 20h.01", key: "zekei9" }]];
  const WifiZero = createLucideIcon("wifi-zero", __iconNode$f);

  const __iconNode$e = [
    ["path", { d: "M12 20h.01", key: "zekei9" }],
    ["path", { d: "M2 8.82a15 15 0 0 1 20 0", key: "dnpr2z" }],
    ["path", { d: "M5 12.859a10 10 0 0 1 14 0", key: "1x1e6c" }],
    ["path", { d: "M8.5 16.429a5 5 0 0 1 7 0", key: "1bycff" }]
  ];
  const Wifi = createLucideIcon("wifi", __iconNode$e);

  const __iconNode$d = [
    ["path", { d: "M10 2v8", key: "d4bbey" }],
    ["path", { d: "M12.8 21.6A2 2 0 1 0 14 18H2", key: "19kp1d" }],
    ["path", { d: "M17.5 10a2.5 2.5 0 1 1 2 4H2", key: "19kpjc" }],
    ["path", { d: "m6 6 4 4 4-4", key: "k13n16" }]
  ];
  const WindArrowDown = createLucideIcon("wind-arrow-down", __iconNode$d);

  const __iconNode$c = [
    ["path", { d: "M12.8 19.6A2 2 0 1 0 14 16H2", key: "148xed" }],
    ["path", { d: "M17.5 8a2.5 2.5 0 1 1 2 4H2", key: "1u4tom" }],
    ["path", { d: "M9.8 4.4A2 2 0 1 1 11 8H2", key: "75valh" }]
  ];
  const Wind = createLucideIcon("wind", __iconNode$c);

  const __iconNode$b = [
    ["path", { d: "M8 22h8", key: "rmew8v" }],
    ["path", { d: "M7 10h3m7 0h-1.343", key: "v48bem" }],
    ["path", { d: "M12 15v7", key: "t2xh3l" }],
    [
      "path",
      {
        d: "M7.307 7.307A12.33 12.33 0 0 0 7 10a5 5 0 0 0 7.391 4.391M8.638 2.981C8.75 2.668 8.872 2.34 9 2h6c1.5 4 2 6 2 8 0 .407-.05.809-.145 1.198",
        key: "1ymjlu"
      }
    ],
    ["line", { x1: "2", x2: "22", y1: "2", y2: "22", key: "a6p6uj" }]
  ];
  const WineOff = createLucideIcon("wine-off", __iconNode$b);

  const __iconNode$a = [
    ["path", { d: "M8 22h8", key: "rmew8v" }],
    ["path", { d: "M7 10h10", key: "1101jm" }],
    ["path", { d: "M12 15v7", key: "t2xh3l" }],
    [
      "path",
      { d: "M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z", key: "10ffi3" }
    ]
  ];
  const Wine = createLucideIcon("wine", __iconNode$a);

  const __iconNode$9 = [
    ["rect", { width: "8", height: "8", x: "3", y: "3", rx: "2", key: "by2w9f" }],
    ["path", { d: "M7 11v4a2 2 0 0 0 2 2h4", key: "xkn7yn" }],
    ["rect", { width: "8", height: "8", x: "13", y: "13", rx: "2", key: "1cgmvn" }]
  ];
  const Workflow = createLucideIcon("workflow", __iconNode$9);

  const __iconNode$8 = [
    ["path", { d: "m19 12-1.5 3", key: "9bcu4o" }],
    ["path", { d: "M19.63 18.81 22 20", key: "121v98" }],
    [
      "path",
      {
        d: "M6.47 8.23a1.68 1.68 0 0 1 2.44 1.93l-.64 2.08a6.76 6.76 0 0 0 10.16 7.67l.42-.27a1 1 0 1 0-2.73-4.21l-.42.27a1.76 1.76 0 0 1-2.63-1.99l.64-2.08A6.66 6.66 0 0 0 3.94 3.9l-.7.4a1 1 0 1 0 2.55 4.34z",
        key: "1tij6q"
      }
    ]
  ];
  const Worm = createLucideIcon("worm", __iconNode$8);

  const __iconNode$7 = [
    ["path", { d: "m16 16-2 2 2 2", key: "kkc6pm" }],
    ["path", { d: "M3 12h15a3 3 0 1 1 0 6h-4", key: "1cl7v7" }],
    ["path", { d: "M3 18h7", key: "sq21v6" }],
    ["path", { d: "M3 6h18", key: "d0wm0j" }]
  ];
  const WrapText = createLucideIcon("wrap-text", __iconNode$7);

  const __iconNode$6 = [
    [
      "path",
      {
        d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
        key: "cbrjhi"
      }
    ]
  ];
  const Wrench = createLucideIcon("wrench", __iconNode$6);

  const __iconNode$5 = [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
  ];
  const X = createLucideIcon("x", __iconNode$5);

  const __iconNode$4 = [
    [
      "path",
      {
        d: "M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17",
        key: "1q2vi4"
      }
    ],
    ["path", { d: "m10 15 5-3-5-3z", key: "1jp15x" }]
  ];
  const Youtube = createLucideIcon("youtube", __iconNode$4);

  const __iconNode$3 = [
    ["path", { d: "M10.513 4.856 13.12 2.17a.5.5 0 0 1 .86.46l-1.377 4.317", key: "193nxd" }],
    ["path", { d: "M15.656 10H20a1 1 0 0 1 .78 1.63l-1.72 1.773", key: "27a7lr" }],
    [
      "path",
      {
        d: "M16.273 16.273 10.88 21.83a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14H4a1 1 0 0 1-.78-1.63l4.507-4.643",
        key: "1e0qe9"
      }
    ],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }]
  ];
  const ZapOff = createLucideIcon("zap-off", __iconNode$3);

  const __iconNode$2 = [
    [
      "path",
      {
        d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
        key: "1xq2db"
      }
    ]
  ];
  const Zap = createLucideIcon("zap", __iconNode$2);

  const __iconNode$1 = [
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
    ["line", { x1: "21", x2: "16.65", y1: "21", y2: "16.65", key: "13gj7c" }],
    ["line", { x1: "8", x2: "14", y1: "11", y2: "11", key: "durymu" }]
  ];
  const ZoomOut = createLucideIcon("zoom-out", __iconNode$1);

  const __iconNode = [
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
    ["line", { x1: "21", x2: "16.65", y1: "21", y2: "16.65", key: "13gj7c" }],
    ["line", { x1: "11", x2: "11", y1: "8", y2: "14", key: "1vmskp" }],
    ["line", { x1: "8", x2: "14", y1: "11", y2: "11", key: "durymu" }]
  ];
  const ZoomIn = createLucideIcon("zoom-in", __iconNode);

  var index = /*#__PURE__*/Object.freeze({
    __proto__: null,
    AArrowDown: AArrowDown,
    AArrowUp: AArrowUp,
    ALargeSmall: ALargeSmall,
    Accessibility: Accessibility,
    Activity: Activity,
    AirVent: AirVent,
    Airplay: Airplay,
    AlarmClock: AlarmClock,
    AlarmClockCheck: AlarmClockCheck,
    AlarmClockMinus: AlarmClockMinus,
    AlarmClockOff: AlarmClockOff,
    AlarmClockPlus: AlarmClockPlus,
    AlarmSmoke: AlarmSmoke,
    Album: Album,
    AlignCenter: AlignCenter,
    AlignCenterHorizontal: AlignCenterHorizontal,
    AlignCenterVertical: AlignCenterVertical,
    AlignEndHorizontal: AlignEndHorizontal,
    AlignEndVertical: AlignEndVertical,
    AlignHorizontalDistributeCenter: AlignHorizontalDistributeCenter,
    AlignHorizontalDistributeEnd: AlignHorizontalDistributeEnd,
    AlignHorizontalDistributeStart: AlignHorizontalDistributeStart,
    AlignHorizontalJustifyCenter: AlignHorizontalJustifyCenter,
    AlignHorizontalJustifyEnd: AlignHorizontalJustifyEnd,
    AlignHorizontalJustifyStart: AlignHorizontalJustifyStart,
    AlignHorizontalSpaceAround: AlignHorizontalSpaceAround,
    AlignHorizontalSpaceBetween: AlignHorizontalSpaceBetween,
    AlignJustify: AlignJustify,
    AlignLeft: AlignLeft,
    AlignRight: AlignRight,
    AlignStartHorizontal: AlignStartHorizontal,
    AlignStartVertical: AlignStartVertical,
    AlignVerticalDistributeCenter: AlignVerticalDistributeCenter,
    AlignVerticalDistributeEnd: AlignVerticalDistributeEnd,
    AlignVerticalDistributeStart: AlignVerticalDistributeStart,
    AlignVerticalJustifyCenter: AlignVerticalJustifyCenter,
    AlignVerticalJustifyEnd: AlignVerticalJustifyEnd,
    AlignVerticalJustifyStart: AlignVerticalJustifyStart,
    AlignVerticalSpaceAround: AlignVerticalSpaceAround,
    AlignVerticalSpaceBetween: AlignVerticalSpaceBetween,
    Ambulance: Ambulance,
    Ampersand: Ampersand,
    Ampersands: Ampersands,
    Amphora: Amphora,
    Anchor: Anchor,
    Angry: Angry,
    Annoyed: Annoyed,
    Antenna: Antenna,
    Anvil: Anvil,
    Aperture: Aperture,
    AppWindow: AppWindow,
    AppWindowMac: AppWindowMac,
    Apple: Apple,
    Archive: Archive,
    ArchiveRestore: ArchiveRestore,
    ArchiveX: ArchiveX,
    Armchair: Armchair,
    ArrowBigDown: ArrowBigDown,
    ArrowBigDownDash: ArrowBigDownDash,
    ArrowBigLeft: ArrowBigLeft,
    ArrowBigLeftDash: ArrowBigLeftDash,
    ArrowBigRight: ArrowBigRight,
    ArrowBigRightDash: ArrowBigRightDash,
    ArrowBigUp: ArrowBigUp,
    ArrowBigUpDash: ArrowBigUpDash,
    ArrowDown: ArrowDown,
    ArrowDown01: ArrowDown01,
    ArrowDown10: ArrowDown10,
    ArrowDownAZ: ArrowDownAZ,
    ArrowDownFromLine: ArrowDownFromLine,
    ArrowDownLeft: ArrowDownLeft,
    ArrowDownNarrowWide: ArrowDownNarrowWide,
    ArrowDownRight: ArrowDownRight,
    ArrowDownToDot: ArrowDownToDot,
    ArrowDownToLine: ArrowDownToLine,
    ArrowDownUp: ArrowDownUp,
    ArrowDownWideNarrow: ArrowDownWideNarrow,
    ArrowDownZA: ArrowDownZA,
    ArrowLeft: ArrowLeft,
    ArrowLeftFromLine: ArrowLeftFromLine,
    ArrowLeftRight: ArrowLeftRight,
    ArrowLeftToLine: ArrowLeftToLine,
    ArrowRight: ArrowRight,
    ArrowRightFromLine: ArrowRightFromLine,
    ArrowRightLeft: ArrowRightLeft,
    ArrowRightToLine: ArrowRightToLine,
    ArrowUp: ArrowUp,
    ArrowUp01: ArrowUp01,
    ArrowUp10: ArrowUp10,
    ArrowUpAZ: ArrowUpAZ,
    ArrowUpDown: ArrowUpDown,
    ArrowUpFromDot: ArrowUpFromDot,
    ArrowUpFromLine: ArrowUpFromLine,
    ArrowUpLeft: ArrowUpLeft,
    ArrowUpNarrowWide: ArrowUpNarrowWide,
    ArrowUpRight: ArrowUpRight,
    ArrowUpToLine: ArrowUpToLine,
    ArrowUpWideNarrow: ArrowUpWideNarrow,
    ArrowUpZA: ArrowUpZA,
    ArrowsUpFromLine: ArrowsUpFromLine,
    Asterisk: Asterisk,
    AtSign: AtSign,
    Atom: Atom,
    AudioLines: AudioLines,
    AudioWaveform: AudioWaveform,
    Award: Award,
    Axe: Axe,
    Axis3d: Axis3d,
    Baby: Baby,
    Backpack: Backpack,
    Badge: Badge,
    BadgeAlert: BadgeAlert,
    BadgeCent: BadgeCent,
    BadgeCheck: BadgeCheck,
    BadgeDollarSign: BadgeDollarSign,
    BadgeEuro: BadgeEuro,
    BadgeIndianRupee: BadgeIndianRupee,
    BadgeInfo: BadgeInfo,
    BadgeJapaneseYen: BadgeJapaneseYen,
    BadgeMinus: BadgeMinus,
    BadgePercent: BadgePercent,
    BadgePlus: BadgePlus,
    BadgePoundSterling: BadgePoundSterling,
    BadgeQuestionMark: BadgeQuestionMark,
    BadgeRussianRuble: BadgeRussianRuble,
    BadgeSwissFranc: BadgeSwissFranc,
    BadgeX: BadgeX,
    BaggageClaim: BaggageClaim,
    Ban: Ban,
    Banana: Banana,
    Bandage: Bandage,
    Banknote: Banknote,
    BanknoteArrowDown: BanknoteArrowDown,
    BanknoteArrowUp: BanknoteArrowUp,
    BanknoteX: BanknoteX,
    Barcode: Barcode,
    Barrel: Barrel,
    Baseline: Baseline,
    Bath: Bath,
    Battery: Battery,
    BatteryCharging: BatteryCharging,
    BatteryFull: BatteryFull,
    BatteryLow: BatteryLow,
    BatteryMedium: BatteryMedium,
    BatteryPlus: BatteryPlus,
    BatteryWarning: BatteryWarning,
    Beaker: Beaker,
    Bean: Bean,
    BeanOff: BeanOff,
    Bed: Bed,
    BedDouble: BedDouble,
    BedSingle: BedSingle,
    Beef: Beef,
    Beer: Beer,
    BeerOff: BeerOff,
    Bell: Bell,
    BellDot: BellDot,
    BellElectric: BellElectric,
    BellMinus: BellMinus,
    BellOff: BellOff,
    BellPlus: BellPlus,
    BellRing: BellRing,
    BetweenHorizontalEnd: BetweenHorizontalEnd,
    BetweenHorizontalStart: BetweenHorizontalStart,
    BetweenVerticalEnd: BetweenVerticalEnd,
    BetweenVerticalStart: BetweenVerticalStart,
    BicepsFlexed: BicepsFlexed,
    Bike: Bike,
    Binary: Binary,
    Binoculars: Binoculars,
    Biohazard: Biohazard,
    Bird: Bird,
    Bitcoin: Bitcoin,
    Blend: Blend,
    Blinds: Blinds,
    Blocks: Blocks,
    Bluetooth: Bluetooth,
    BluetoothConnected: BluetoothConnected,
    BluetoothOff: BluetoothOff,
    BluetoothSearching: BluetoothSearching,
    Bold: Bold,
    Bolt: Bolt,
    Bomb: Bomb,
    Bone: Bone,
    Book: Book,
    BookA: BookA,
    BookAlert: BookAlert,
    BookAudio: BookAudio,
    BookCheck: BookCheck,
    BookCopy: BookCopy,
    BookDashed: BookDashed,
    BookDown: BookDown,
    BookHeadphones: BookHeadphones,
    BookHeart: BookHeart,
    BookImage: BookImage,
    BookKey: BookKey,
    BookLock: BookLock,
    BookMarked: BookMarked,
    BookMinus: BookMinus,
    BookOpen: BookOpen,
    BookOpenCheck: BookOpenCheck,
    BookOpenText: BookOpenText,
    BookPlus: BookPlus,
    BookText: BookText,
    BookType: BookType,
    BookUp: BookUp,
    BookUp2: BookUp2,
    BookUser: BookUser,
    BookX: BookX,
    Bookmark: Bookmark,
    BookmarkCheck: BookmarkCheck,
    BookmarkMinus: BookmarkMinus,
    BookmarkPlus: BookmarkPlus,
    BookmarkX: BookmarkX,
    BoomBox: BoomBox,
    Bot: Bot,
    BotMessageSquare: BotMessageSquare,
    BotOff: BotOff,
    BowArrow: BowArrow,
    Box: Box,
    Boxes: Boxes,
    Braces: Braces,
    Brackets: Brackets,
    Brain: Brain,
    BrainCircuit: BrainCircuit,
    BrainCog: BrainCog,
    BrickWall: BrickWall,
    BrickWallFire: BrickWallFire,
    Briefcase: Briefcase,
    BriefcaseBusiness: BriefcaseBusiness,
    BriefcaseConveyorBelt: BriefcaseConveyorBelt,
    BriefcaseMedical: BriefcaseMedical,
    BringToFront: BringToFront,
    Brush: Brush,
    BrushCleaning: BrushCleaning,
    Bubbles: Bubbles,
    Bug: Bug,
    BugOff: BugOff,
    BugPlay: BugPlay,
    Building: Building,
    Building2: Building2,
    Bus: Bus,
    BusFront: BusFront,
    Cable: Cable,
    CableCar: CableCar,
    Cake: Cake,
    CakeSlice: CakeSlice,
    Calculator: Calculator,
    Calendar: Calendar,
    Calendar1: Calendar1,
    CalendarArrowDown: CalendarArrowDown,
    CalendarArrowUp: CalendarArrowUp,
    CalendarCheck: CalendarCheck,
    CalendarCheck2: CalendarCheck2,
    CalendarClock: CalendarClock,
    CalendarCog: CalendarCog,
    CalendarDays: CalendarDays,
    CalendarFold: CalendarFold,
    CalendarHeart: CalendarHeart,
    CalendarMinus: CalendarMinus,
    CalendarMinus2: CalendarMinus2,
    CalendarOff: CalendarOff,
    CalendarPlus: CalendarPlus,
    CalendarPlus2: CalendarPlus2,
    CalendarRange: CalendarRange,
    CalendarSearch: CalendarSearch,
    CalendarSync: CalendarSync,
    CalendarX: CalendarX,
    CalendarX2: CalendarX2,
    Camera: Camera,
    CameraOff: CameraOff,
    Candy: Candy,
    CandyCane: CandyCane,
    CandyOff: CandyOff,
    Cannabis: Cannabis,
    Captions: Captions,
    CaptionsOff: CaptionsOff,
    Car: Car,
    CarFront: CarFront,
    CarTaxiFront: CarTaxiFront,
    Caravan: Caravan,
    CardSim: CardSim,
    Carrot: Carrot,
    CaseLower: CaseLower,
    CaseSensitive: CaseSensitive,
    CaseUpper: CaseUpper,
    CassetteTape: CassetteTape,
    Cast: Cast,
    Castle: Castle,
    Cat: Cat,
    Cctv: Cctv,
    ChartArea: ChartArea,
    ChartBar: ChartBar,
    ChartBarBig: ChartBarBig,
    ChartBarDecreasing: ChartBarDecreasing,
    ChartBarIncreasing: ChartBarIncreasing,
    ChartBarStacked: ChartBarStacked,
    ChartCandlestick: ChartCandlestick,
    ChartColumn: ChartColumn,
    ChartColumnBig: ChartColumnBig,
    ChartColumnDecreasing: ChartColumnDecreasing,
    ChartColumnIncreasing: ChartColumnIncreasing,
    ChartColumnStacked: ChartColumnStacked,
    ChartGantt: ChartGantt,
    ChartLine: ChartLine,
    ChartNetwork: ChartNetwork,
    ChartNoAxesColumn: ChartNoAxesColumn,
    ChartNoAxesColumnDecreasing: ChartNoAxesColumnDecreasing,
    ChartNoAxesColumnIncreasing: ChartNoAxesColumnIncreasing,
    ChartNoAxesCombined: ChartNoAxesCombined,
    ChartNoAxesGantt: ChartNoAxesGantt,
    ChartPie: ChartPie,
    ChartScatter: ChartScatter,
    ChartSpline: ChartSpline,
    Check: Check,
    CheckCheck: CheckCheck,
    CheckLine: CheckLine,
    ChefHat: ChefHat,
    Cherry: Cherry,
    ChevronDown: ChevronDown,
    ChevronFirst: ChevronFirst,
    ChevronLast: ChevronLast,
    ChevronLeft: ChevronLeft,
    ChevronRight: ChevronRight,
    ChevronUp: ChevronUp,
    ChevronsDown: ChevronsDown,
    ChevronsDownUp: ChevronsDownUp,
    ChevronsLeft: ChevronsLeft,
    ChevronsLeftRight: ChevronsLeftRight,
    ChevronsLeftRightEllipsis: ChevronsLeftRightEllipsis,
    ChevronsRight: ChevronsRight,
    ChevronsRightLeft: ChevronsRightLeft,
    ChevronsUp: ChevronsUp,
    ChevronsUpDown: ChevronsUpDown,
    Chrome: Chrome,
    Church: Church,
    Cigarette: Cigarette,
    CigaretteOff: CigaretteOff,
    Circle: Circle,
    CircleAlert: CircleAlert,
    CircleArrowDown: CircleArrowDown,
    CircleArrowLeft: CircleArrowLeft,
    CircleArrowOutDownLeft: CircleArrowOutDownLeft,
    CircleArrowOutDownRight: CircleArrowOutDownRight,
    CircleArrowOutUpLeft: CircleArrowOutUpLeft,
    CircleArrowOutUpRight: CircleArrowOutUpRight,
    CircleArrowRight: CircleArrowRight,
    CircleArrowUp: CircleArrowUp,
    CircleCheck: CircleCheck,
    CircleCheckBig: CircleCheckBig,
    CircleChevronDown: CircleChevronDown,
    CircleChevronLeft: CircleChevronLeft,
    CircleChevronRight: CircleChevronRight,
    CircleChevronUp: CircleChevronUp,
    CircleDashed: CircleDashed,
    CircleDivide: CircleDivide,
    CircleDollarSign: CircleDollarSign,
    CircleDot: CircleDot,
    CircleDotDashed: CircleDotDashed,
    CircleEllipsis: CircleEllipsis,
    CircleEqual: CircleEqual,
    CircleFadingArrowUp: CircleFadingArrowUp,
    CircleFadingPlus: CircleFadingPlus,
    CircleGauge: CircleGauge,
    CircleMinus: CircleMinus,
    CircleOff: CircleOff,
    CircleParking: CircleParking,
    CircleParkingOff: CircleParkingOff,
    CirclePause: CirclePause,
    CirclePercent: CirclePercent,
    CirclePlay: CirclePlay,
    CirclePlus: CirclePlus,
    CirclePoundSterling: CirclePoundSterling,
    CirclePower: CirclePower,
    CircleQuestionMark: CircleQuestionMark,
    CircleSlash: CircleSlash,
    CircleSlash2: CircleSlash2,
    CircleSmall: CircleSmall,
    CircleStop: CircleStop,
    CircleUser: CircleUser,
    CircleUserRound: CircleUserRound,
    CircleX: CircleX,
    CircuitBoard: CircuitBoard,
    Citrus: Citrus,
    Clapperboard: Clapperboard,
    Clipboard: Clipboard,
    ClipboardCheck: ClipboardCheck,
    ClipboardCopy: ClipboardCopy,
    ClipboardList: ClipboardList,
    ClipboardMinus: ClipboardMinus,
    ClipboardPaste: ClipboardPaste,
    ClipboardPen: ClipboardPen,
    ClipboardPenLine: ClipboardPenLine,
    ClipboardPlus: ClipboardPlus,
    ClipboardType: ClipboardType,
    ClipboardX: ClipboardX,
    Clock: Clock,
    Clock1: Clock1,
    Clock10: Clock10,
    Clock11: Clock11,
    Clock12: Clock12,
    Clock2: Clock2,
    Clock3: Clock3,
    Clock4: Clock4,
    Clock5: Clock5,
    Clock6: Clock6,
    Clock7: Clock7,
    Clock8: Clock8,
    Clock9: Clock9,
    ClockAlert: ClockAlert,
    ClockArrowDown: ClockArrowDown,
    ClockArrowUp: ClockArrowUp,
    ClockFading: ClockFading,
    ClockPlus: ClockPlus,
    Cloud: Cloud,
    CloudAlert: CloudAlert,
    CloudCheck: CloudCheck,
    CloudCog: CloudCog,
    CloudDownload: CloudDownload,
    CloudDrizzle: CloudDrizzle,
    CloudFog: CloudFog,
    CloudHail: CloudHail,
    CloudLightning: CloudLightning,
    CloudMoon: CloudMoon,
    CloudMoonRain: CloudMoonRain,
    CloudOff: CloudOff,
    CloudRain: CloudRain,
    CloudRainWind: CloudRainWind,
    CloudSnow: CloudSnow,
    CloudSun: CloudSun,
    CloudSunRain: CloudSunRain,
    CloudUpload: CloudUpload,
    Cloudy: Cloudy,
    Clover: Clover,
    Club: Club,
    Code: Code,
    CodeXml: CodeXml,
    Codepen: Codepen,
    Codesandbox: Codesandbox,
    Coffee: Coffee,
    Cog: Cog,
    Coins: Coins,
    Columns2: Columns2,
    Columns3: Columns3,
    Columns3Cog: Columns3Cog,
    Columns4: Columns4,
    Combine: Combine,
    Command: Command,
    Compass: Compass,
    Component: Component,
    Computer: Computer,
    ConciergeBell: ConciergeBell,
    Cone: Cone,
    Construction: Construction,
    Contact: Contact,
    ContactRound: ContactRound,
    Container: Container,
    Contrast: Contrast,
    Cookie: Cookie,
    CookingPot: CookingPot,
    Copy: Copy,
    CopyCheck: CopyCheck,
    CopyMinus: CopyMinus,
    CopyPlus: CopyPlus,
    CopySlash: CopySlash,
    CopyX: CopyX,
    Copyleft: Copyleft,
    Copyright: Copyright,
    CornerDownLeft: CornerDownLeft,
    CornerDownRight: CornerDownRight,
    CornerLeftDown: CornerLeftDown,
    CornerLeftUp: CornerLeftUp,
    CornerRightDown: CornerRightDown,
    CornerRightUp: CornerRightUp,
    CornerUpLeft: CornerUpLeft,
    CornerUpRight: CornerUpRight,
    Cpu: Cpu,
    CreativeCommons: CreativeCommons,
    CreditCard: CreditCard,
    Croissant: Croissant,
    Crop: Crop,
    Cross: Cross,
    Crosshair: Crosshair,
    Crown: Crown,
    Cuboid: Cuboid,
    CupSoda: CupSoda,
    Currency: Currency,
    Cylinder: Cylinder,
    Dam: Dam,
    Database: Database,
    DatabaseBackup: DatabaseBackup,
    DatabaseZap: DatabaseZap,
    DecimalsArrowLeft: DecimalsArrowLeft,
    DecimalsArrowRight: DecimalsArrowRight,
    Delete: Delete,
    Dessert: Dessert,
    Diameter: Diameter,
    Diamond: Diamond,
    DiamondMinus: DiamondMinus,
    DiamondPercent: DiamondPercent,
    DiamondPlus: DiamondPlus,
    Dice1: Dice1,
    Dice2: Dice2,
    Dice3: Dice3,
    Dice4: Dice4,
    Dice5: Dice5,
    Dice6: Dice6,
    Dices: Dices,
    Diff: Diff,
    Disc: Disc,
    Disc2: Disc2,
    Disc3: Disc3,
    DiscAlbum: DiscAlbum,
    Divide: Divide,
    Dna: Dna,
    DnaOff: DnaOff,
    Dock: Dock,
    Dog: Dog,
    DollarSign: DollarSign,
    Donut: Donut,
    DoorClosed: DoorClosed,
    DoorClosedLocked: DoorClosedLocked,
    DoorOpen: DoorOpen,
    Dot: Dot,
    Download: Download,
    DraftingCompass: DraftingCompass,
    Drama: Drama,
    Dribbble: Dribbble,
    Drill: Drill,
    Drone: Drone,
    Droplet: Droplet,
    DropletOff: DropletOff,
    Droplets: Droplets,
    Drum: Drum,
    Drumstick: Drumstick,
    Dumbbell: Dumbbell,
    Ear: Ear,
    EarOff: EarOff,
    Earth: Earth,
    EarthLock: EarthLock,
    Eclipse: Eclipse,
    Egg: Egg,
    EggFried: EggFried,
    EggOff: EggOff,
    Ellipsis: Ellipsis,
    EllipsisVertical: EllipsisVertical,
    Equal: Equal,
    EqualApproximately: EqualApproximately,
    EqualNot: EqualNot,
    Eraser: Eraser,
    EthernetPort: EthernetPort,
    Euro: Euro,
    Expand: Expand,
    ExternalLink: ExternalLink,
    Eye: Eye,
    EyeClosed: EyeClosed,
    EyeOff: EyeOff,
    Facebook: Facebook,
    Factory: Factory,
    Fan: Fan,
    FastForward: FastForward,
    Feather: Feather,
    Fence: Fence,
    FerrisWheel: FerrisWheel,
    Figma: Figma,
    File: File,
    FileArchive: FileArchive,
    FileAudio: FileAudio,
    FileAudio2: FileAudio2,
    FileAxis3d: FileAxis3d,
    FileBadge: FileBadge,
    FileBadge2: FileBadge2,
    FileBox: FileBox,
    FileChartColumn: FileChartColumn,
    FileChartColumnIncreasing: FileChartColumnIncreasing,
    FileChartLine: FileChartLine,
    FileChartPie: FileChartPie,
    FileCheck: FileCheck,
    FileCheck2: FileCheck2,
    FileClock: FileClock,
    FileCode: FileCode,
    FileCode2: FileCode2,
    FileCog: FileCog,
    FileDiff: FileDiff,
    FileDigit: FileDigit,
    FileDown: FileDown,
    FileHeart: FileHeart,
    FileImage: FileImage,
    FileInput: FileInput,
    FileJson: FileJson,
    FileJson2: FileJson2,
    FileKey: FileKey,
    FileKey2: FileKey2,
    FileLock: FileLock,
    FileLock2: FileLock2,
    FileMinus: FileMinus,
    FileMinus2: FileMinus2,
    FileMusic: FileMusic,
    FileOutput: FileOutput,
    FilePen: FilePen,
    FilePenLine: FilePenLine,
    FilePlus: FilePlus,
    FilePlus2: FilePlus2,
    FileQuestionMark: FileQuestionMark,
    FileScan: FileScan,
    FileSearch: FileSearch,
    FileSearch2: FileSearch2,
    FileSliders: FileSliders,
    FileSpreadsheet: FileSpreadsheet,
    FileStack: FileStack,
    FileSymlink: FileSymlink,
    FileTerminal: FileTerminal,
    FileText: FileText,
    FileType: FileType,
    FileType2: FileType2,
    FileUp: FileUp,
    FileUser: FileUser,
    FileVideo: FileVideo,
    FileVideo2: FileVideo2,
    FileVolume: FileVolume,
    FileVolume2: FileVolume2,
    FileWarning: FileWarning,
    FileX: FileX,
    FileX2: FileX2,
    Files: Files,
    Film: Film,
    Fingerprint: Fingerprint,
    FireExtinguisher: FireExtinguisher,
    Fish: Fish,
    FishOff: FishOff,
    FishSymbol: FishSymbol,
    Flag: Flag,
    FlagOff: FlagOff,
    FlagTriangleLeft: FlagTriangleLeft,
    FlagTriangleRight: FlagTriangleRight,
    Flame: Flame,
    FlameKindling: FlameKindling,
    Flashlight: Flashlight,
    FlashlightOff: FlashlightOff,
    FlaskConical: FlaskConical,
    FlaskConicalOff: FlaskConicalOff,
    FlaskRound: FlaskRound,
    FlipHorizontal: FlipHorizontal,
    FlipHorizontal2: FlipHorizontal2,
    FlipVertical: FlipVertical,
    FlipVertical2: FlipVertical2,
    Flower: Flower,
    Flower2: Flower2,
    Focus: Focus,
    FoldHorizontal: FoldHorizontal,
    FoldVertical: FoldVertical,
    Folder: Folder,
    FolderArchive: FolderArchive,
    FolderCheck: FolderCheck,
    FolderClock: FolderClock,
    FolderClosed: FolderClosed,
    FolderCode: FolderCode,
    FolderCog: FolderCog,
    FolderDot: FolderDot,
    FolderDown: FolderDown,
    FolderGit: FolderGit,
    FolderGit2: FolderGit2,
    FolderHeart: FolderHeart,
    FolderInput: FolderInput,
    FolderKanban: FolderKanban,
    FolderKey: FolderKey,
    FolderLock: FolderLock,
    FolderMinus: FolderMinus,
    FolderOpen: FolderOpen,
    FolderOpenDot: FolderOpenDot,
    FolderOutput: FolderOutput,
    FolderPen: FolderPen,
    FolderPlus: FolderPlus,
    FolderRoot: FolderRoot,
    FolderSearch: FolderSearch,
    FolderSearch2: FolderSearch2,
    FolderSymlink: FolderSymlink,
    FolderSync: FolderSync,
    FolderTree: FolderTree,
    FolderUp: FolderUp,
    FolderX: FolderX,
    Folders: Folders,
    Footprints: Footprints,
    Forklift: Forklift,
    Forward: Forward,
    Frame: Frame,
    Framer: Framer,
    Frown: Frown,
    Fuel: Fuel,
    Fullscreen: Fullscreen,
    Funnel: Funnel,
    FunnelPlus: FunnelPlus,
    FunnelX: FunnelX,
    GalleryHorizontal: GalleryHorizontal,
    GalleryHorizontalEnd: GalleryHorizontalEnd,
    GalleryThumbnails: GalleryThumbnails,
    GalleryVertical: GalleryVertical,
    GalleryVerticalEnd: GalleryVerticalEnd,
    Gamepad: Gamepad,
    Gamepad2: Gamepad2,
    Gauge: Gauge,
    Gavel: Gavel,
    Gem: Gem,
    GeorgianLari: GeorgianLari,
    Ghost: Ghost,
    Gift: Gift,
    GitBranch: GitBranch,
    GitBranchPlus: GitBranchPlus,
    GitCommitHorizontal: GitCommitHorizontal,
    GitCommitVertical: GitCommitVertical,
    GitCompare: GitCompare,
    GitCompareArrows: GitCompareArrows,
    GitFork: GitFork,
    GitGraph: GitGraph,
    GitMerge: GitMerge,
    GitPullRequest: GitPullRequest,
    GitPullRequestArrow: GitPullRequestArrow,
    GitPullRequestClosed: GitPullRequestClosed,
    GitPullRequestCreate: GitPullRequestCreate,
    GitPullRequestCreateArrow: GitPullRequestCreateArrow,
    GitPullRequestDraft: GitPullRequestDraft,
    Github: Github,
    Gitlab: Gitlab,
    GlassWater: GlassWater,
    Glasses: Glasses,
    Globe: Globe,
    GlobeLock: GlobeLock,
    Goal: Goal,
    Gpu: Gpu,
    Grab: Grab,
    GraduationCap: GraduationCap,
    Grape: Grape,
    Grid2x2: Grid2x2,
    Grid2x2Check: Grid2x2Check,
    Grid2x2Plus: Grid2x2Plus,
    Grid2x2X: Grid2x2X,
    Grid3x2: Grid3x2,
    Grid3x3: Grid3x3,
    Grip: Grip,
    GripHorizontal: GripHorizontal,
    GripVertical: GripVertical,
    Group: Group,
    Guitar: Guitar,
    Ham: Ham,
    Hamburger: Hamburger,
    Hammer: Hammer,
    Hand: Hand,
    HandCoins: HandCoins,
    HandHeart: HandHeart,
    HandHelping: HandHelping,
    HandMetal: HandMetal,
    HandPlatter: HandPlatter,
    Handshake: Handshake,
    HardDrive: HardDrive,
    HardDriveDownload: HardDriveDownload,
    HardDriveUpload: HardDriveUpload,
    HardHat: HardHat,
    Hash: Hash,
    Haze: Haze,
    HdmiPort: HdmiPort,
    Heading: Heading,
    Heading1: Heading1,
    Heading2: Heading2,
    Heading3: Heading3,
    Heading4: Heading4,
    Heading5: Heading5,
    Heading6: Heading6,
    HeadphoneOff: HeadphoneOff,
    Headphones: Headphones,
    Headset: Headset,
    Heart: Heart,
    HeartCrack: HeartCrack,
    HeartHandshake: HeartHandshake,
    HeartMinus: HeartMinus,
    HeartOff: HeartOff,
    HeartPlus: HeartPlus,
    HeartPulse: HeartPulse,
    Heater: Heater,
    Hexagon: Hexagon,
    Highlighter: Highlighter,
    History: History,
    Hop: Hop,
    HopOff: HopOff,
    Hospital: Hospital,
    Hotel: Hotel,
    Hourglass: Hourglass,
    House: House,
    HousePlug: HousePlug,
    HousePlus: HousePlus,
    HouseWifi: HouseWifi,
    IceCreamBowl: IceCreamBowl,
    IceCreamCone: IceCreamCone,
    IdCard: IdCard,
    IdCardLanyard: IdCardLanyard,
    Image: Image,
    ImageDown: ImageDown,
    ImageMinus: ImageMinus,
    ImageOff: ImageOff,
    ImagePlay: ImagePlay,
    ImagePlus: ImagePlus,
    ImageUp: ImageUp,
    ImageUpscale: ImageUpscale,
    Images: Images,
    Import: Import,
    Inbox: Inbox,
    IndentDecrease: IndentDecrease,
    IndentIncrease: IndentIncrease,
    IndianRupee: IndianRupee,
    Infinity: Infinity,
    Info: Info,
    InspectionPanel: InspectionPanel,
    Instagram: Instagram,
    Italic: Italic,
    IterationCcw: IterationCcw,
    IterationCw: IterationCw,
    JapaneseYen: JapaneseYen,
    Joystick: Joystick,
    Kanban: Kanban,
    Key: Key,
    KeyRound: KeyRound,
    KeySquare: KeySquare,
    Keyboard: Keyboard,
    KeyboardMusic: KeyboardMusic,
    KeyboardOff: KeyboardOff,
    Lamp: Lamp,
    LampCeiling: LampCeiling,
    LampDesk: LampDesk,
    LampFloor: LampFloor,
    LampWallDown: LampWallDown,
    LampWallUp: LampWallUp,
    LandPlot: LandPlot,
    Landmark: Landmark,
    Languages: Languages,
    Laptop: Laptop,
    LaptopMinimal: LaptopMinimal,
    LaptopMinimalCheck: LaptopMinimalCheck,
    Lasso: Lasso,
    LassoSelect: LassoSelect,
    Laugh: Laugh,
    Layers: Layers,
    Layers2: Layers2,
    LayoutDashboard: LayoutDashboard,
    LayoutGrid: LayoutGrid,
    LayoutList: LayoutList,
    LayoutPanelLeft: LayoutPanelLeft,
    LayoutPanelTop: LayoutPanelTop,
    LayoutTemplate: LayoutTemplate,
    Leaf: Leaf,
    LeafyGreen: LeafyGreen,
    Lectern: Lectern,
    LetterText: LetterText,
    Library: Library,
    LibraryBig: LibraryBig,
    LifeBuoy: LifeBuoy,
    Ligature: Ligature,
    Lightbulb: Lightbulb,
    LightbulbOff: LightbulbOff,
    LineSquiggle: LineSquiggle,
    Link: Link,
    Link2: Link2,
    Link2Off: Link2Off,
    Linkedin: Linkedin,
    List: List,
    ListCheck: ListCheck,
    ListChecks: ListChecks,
    ListCollapse: ListCollapse,
    ListEnd: ListEnd,
    ListFilter: ListFilter,
    ListFilterPlus: ListFilterPlus,
    ListMinus: ListMinus,
    ListMusic: ListMusic,
    ListOrdered: ListOrdered,
    ListPlus: ListPlus,
    ListRestart: ListRestart,
    ListStart: ListStart,
    ListTodo: ListTodo,
    ListTree: ListTree,
    ListVideo: ListVideo,
    ListX: ListX,
    Loader: Loader,
    LoaderCircle: LoaderCircle,
    LoaderPinwheel: LoaderPinwheel,
    Locate: Locate,
    LocateFixed: LocateFixed,
    LocateOff: LocateOff,
    LocationEdit: LocationEdit,
    Lock: Lock,
    LockKeyhole: LockKeyhole,
    LockKeyholeOpen: LockKeyholeOpen,
    LockOpen: LockOpen,
    LogIn: LogIn,
    LogOut: LogOut,
    Logs: Logs,
    Lollipop: Lollipop,
    Luggage: Luggage,
    Magnet: Magnet,
    Mail: Mail,
    MailCheck: MailCheck,
    MailMinus: MailMinus,
    MailOpen: MailOpen,
    MailPlus: MailPlus,
    MailQuestionMark: MailQuestionMark,
    MailSearch: MailSearch,
    MailWarning: MailWarning,
    MailX: MailX,
    Mailbox: Mailbox,
    Mails: Mails,
    Map: Map,
    MapPin: MapPin,
    MapPinCheck: MapPinCheck,
    MapPinCheckInside: MapPinCheckInside,
    MapPinHouse: MapPinHouse,
    MapPinMinus: MapPinMinus,
    MapPinMinusInside: MapPinMinusInside,
    MapPinOff: MapPinOff,
    MapPinPlus: MapPinPlus,
    MapPinPlusInside: MapPinPlusInside,
    MapPinX: MapPinX,
    MapPinXInside: MapPinXInside,
    MapPinned: MapPinned,
    MapPlus: MapPlus,
    Mars: Mars,
    MarsStroke: MarsStroke,
    Martini: Martini,
    Maximize: Maximize,
    Maximize2: Maximize2,
    Medal: Medal,
    Megaphone: Megaphone,
    MegaphoneOff: MegaphoneOff,
    Meh: Meh,
    MemoryStick: MemoryStick,
    Menu: Menu,
    Merge: Merge,
    MessageCircle: MessageCircle,
    MessageCircleCode: MessageCircleCode,
    MessageCircleDashed: MessageCircleDashed,
    MessageCircleHeart: MessageCircleHeart,
    MessageCircleMore: MessageCircleMore,
    MessageCircleOff: MessageCircleOff,
    MessageCirclePlus: MessageCirclePlus,
    MessageCircleQuestionMark: MessageCircleQuestionMark,
    MessageCircleReply: MessageCircleReply,
    MessageCircleWarning: MessageCircleWarning,
    MessageCircleX: MessageCircleX,
    MessageSquare: MessageSquare,
    MessageSquareCode: MessageSquareCode,
    MessageSquareDashed: MessageSquareDashed,
    MessageSquareDiff: MessageSquareDiff,
    MessageSquareDot: MessageSquareDot,
    MessageSquareHeart: MessageSquareHeart,
    MessageSquareLock: MessageSquareLock,
    MessageSquareMore: MessageSquareMore,
    MessageSquareOff: MessageSquareOff,
    MessageSquarePlus: MessageSquarePlus,
    MessageSquareQuote: MessageSquareQuote,
    MessageSquareReply: MessageSquareReply,
    MessageSquareShare: MessageSquareShare,
    MessageSquareText: MessageSquareText,
    MessageSquareWarning: MessageSquareWarning,
    MessageSquareX: MessageSquareX,
    MessagesSquare: MessagesSquare,
    Mic: Mic,
    MicOff: MicOff,
    MicVocal: MicVocal,
    Microchip: Microchip,
    Microscope: Microscope,
    Microwave: Microwave,
    Milestone: Milestone,
    Milk: Milk,
    MilkOff: MilkOff,
    Minimize: Minimize,
    Minimize2: Minimize2,
    Minus: Minus,
    Monitor: Monitor,
    MonitorCheck: MonitorCheck,
    MonitorCog: MonitorCog,
    MonitorDot: MonitorDot,
    MonitorDown: MonitorDown,
    MonitorOff: MonitorOff,
    MonitorPause: MonitorPause,
    MonitorPlay: MonitorPlay,
    MonitorSmartphone: MonitorSmartphone,
    MonitorSpeaker: MonitorSpeaker,
    MonitorStop: MonitorStop,
    MonitorUp: MonitorUp,
    MonitorX: MonitorX,
    Moon: Moon,
    MoonStar: MoonStar,
    Mountain: Mountain,
    MountainSnow: MountainSnow,
    Mouse: Mouse,
    MouseOff: MouseOff,
    MousePointer: MousePointer,
    MousePointer2: MousePointer2,
    MousePointerBan: MousePointerBan,
    MousePointerClick: MousePointerClick,
    Move: Move,
    Move3d: Move3d,
    MoveDiagonal: MoveDiagonal,
    MoveDiagonal2: MoveDiagonal2,
    MoveDown: MoveDown,
    MoveDownLeft: MoveDownLeft,
    MoveDownRight: MoveDownRight,
    MoveHorizontal: MoveHorizontal,
    MoveLeft: MoveLeft,
    MoveRight: MoveRight,
    MoveUp: MoveUp,
    MoveUpLeft: MoveUpLeft,
    MoveUpRight: MoveUpRight,
    MoveVertical: MoveVertical,
    Music: Music,
    Music2: Music2,
    Music3: Music3,
    Music4: Music4,
    Navigation: Navigation,
    Navigation2: Navigation2,
    Navigation2Off: Navigation2Off,
    NavigationOff: NavigationOff,
    Network: Network,
    Newspaper: Newspaper,
    Nfc: Nfc,
    NonBinary: NonBinary,
    Notebook: Notebook,
    NotebookPen: NotebookPen,
    NotebookTabs: NotebookTabs,
    NotebookText: NotebookText,
    NotepadText: NotepadText,
    NotepadTextDashed: NotepadTextDashed,
    Nut: Nut,
    NutOff: NutOff,
    Octagon: Octagon,
    OctagonAlert: OctagonAlert,
    OctagonMinus: OctagonMinus,
    OctagonPause: OctagonPause,
    OctagonX: OctagonX,
    Omega: Omega,
    Option: Option,
    Orbit: Orbit,
    Origami: Origami,
    Package: Package,
    Package2: Package2,
    PackageCheck: PackageCheck,
    PackageMinus: PackageMinus,
    PackageOpen: PackageOpen,
    PackagePlus: PackagePlus,
    PackageSearch: PackageSearch,
    PackageX: PackageX,
    PaintBucket: PaintBucket,
    PaintRoller: PaintRoller,
    Paintbrush: Paintbrush,
    PaintbrushVertical: PaintbrushVertical,
    Palette: Palette,
    Panda: Panda,
    PanelBottom: PanelBottom,
    PanelBottomClose: PanelBottomClose,
    PanelBottomDashed: PanelBottomDashed,
    PanelBottomOpen: PanelBottomOpen,
    PanelLeft: PanelLeft,
    PanelLeftClose: PanelLeftClose,
    PanelLeftDashed: PanelLeftDashed,
    PanelLeftOpen: PanelLeftOpen,
    PanelRight: PanelRight,
    PanelRightClose: PanelRightClose,
    PanelRightDashed: PanelRightDashed,
    PanelRightOpen: PanelRightOpen,
    PanelTop: PanelTop,
    PanelTopClose: PanelTopClose,
    PanelTopDashed: PanelTopDashed,
    PanelTopOpen: PanelTopOpen,
    PanelsLeftBottom: PanelsLeftBottom,
    PanelsRightBottom: PanelsRightBottom,
    PanelsTopLeft: PanelsTopLeft,
    Paperclip: Paperclip,
    Parentheses: Parentheses,
    ParkingMeter: ParkingMeter,
    PartyPopper: PartyPopper,
    Pause: Pause,
    PawPrint: PawPrint,
    PcCase: PcCase,
    Pen: Pen,
    PenLine: PenLine,
    PenOff: PenOff,
    PenTool: PenTool,
    Pencil: Pencil,
    PencilLine: PencilLine,
    PencilOff: PencilOff,
    PencilRuler: PencilRuler,
    Pentagon: Pentagon,
    Percent: Percent,
    PersonStanding: PersonStanding,
    PhilippinePeso: PhilippinePeso,
    Phone: Phone,
    PhoneCall: PhoneCall,
    PhoneForwarded: PhoneForwarded,
    PhoneIncoming: PhoneIncoming,
    PhoneMissed: PhoneMissed,
    PhoneOff: PhoneOff,
    PhoneOutgoing: PhoneOutgoing,
    Pi: Pi,
    Piano: Piano,
    Pickaxe: Pickaxe,
    PictureInPicture: PictureInPicture,
    PictureInPicture2: PictureInPicture2,
    PiggyBank: PiggyBank,
    Pilcrow: Pilcrow,
    PilcrowLeft: PilcrowLeft,
    PilcrowRight: PilcrowRight,
    Pill: Pill,
    PillBottle: PillBottle,
    Pin: Pin,
    PinOff: PinOff,
    Pipette: Pipette,
    Pizza: Pizza,
    Plane: Plane,
    PlaneLanding: PlaneLanding,
    PlaneTakeoff: PlaneTakeoff,
    Play: Play,
    Plug: Plug,
    Plug2: Plug2,
    PlugZap: PlugZap,
    Plus: Plus,
    Pocket: Pocket,
    PocketKnife: PocketKnife,
    Podcast: Podcast,
    Pointer: Pointer,
    PointerOff: PointerOff,
    Popcorn: Popcorn,
    Popsicle: Popsicle,
    PoundSterling: PoundSterling,
    Power: Power,
    PowerOff: PowerOff,
    Presentation: Presentation,
    Printer: Printer,
    PrinterCheck: PrinterCheck,
    Projector: Projector,
    Proportions: Proportions,
    Puzzle: Puzzle,
    Pyramid: Pyramid,
    QrCode: QrCode,
    Quote: Quote,
    Rabbit: Rabbit,
    Radar: Radar,
    Radiation: Radiation,
    Radical: Radical,
    Radio: Radio,
    RadioReceiver: RadioReceiver,
    RadioTower: RadioTower,
    Radius: Radius,
    RailSymbol: RailSymbol,
    Rainbow: Rainbow,
    Rat: Rat,
    Ratio: Ratio,
    Receipt: Receipt,
    ReceiptCent: ReceiptCent,
    ReceiptEuro: ReceiptEuro,
    ReceiptIndianRupee: ReceiptIndianRupee,
    ReceiptJapaneseYen: ReceiptJapaneseYen,
    ReceiptPoundSterling: ReceiptPoundSterling,
    ReceiptRussianRuble: ReceiptRussianRuble,
    ReceiptSwissFranc: ReceiptSwissFranc,
    ReceiptText: ReceiptText,
    RectangleCircle: RectangleCircle,
    RectangleEllipsis: RectangleEllipsis,
    RectangleGoggles: RectangleGoggles,
    RectangleHorizontal: RectangleHorizontal,
    RectangleVertical: RectangleVertical,
    Recycle: Recycle,
    Redo: Redo,
    Redo2: Redo2,
    RedoDot: RedoDot,
    RefreshCcw: RefreshCcw,
    RefreshCcwDot: RefreshCcwDot,
    RefreshCw: RefreshCw,
    RefreshCwOff: RefreshCwOff,
    Refrigerator: Refrigerator,
    Regex: Regex,
    RemoveFormatting: RemoveFormatting,
    Repeat: Repeat,
    Repeat1: Repeat1,
    Repeat2: Repeat2,
    Replace: Replace,
    ReplaceAll: ReplaceAll,
    Reply: Reply,
    ReplyAll: ReplyAll,
    Rewind: Rewind,
    Ribbon: Ribbon,
    Rocket: Rocket,
    RockingChair: RockingChair,
    RollerCoaster: RollerCoaster,
    Rotate3d: Rotate3d,
    RotateCcw: RotateCcw,
    RotateCcwKey: RotateCcwKey,
    RotateCcwSquare: RotateCcwSquare,
    RotateCw: RotateCw,
    RotateCwSquare: RotateCwSquare,
    Route: Route,
    RouteOff: RouteOff,
    Router: Router,
    Rows2: Rows2,
    Rows3: Rows3,
    Rows4: Rows4,
    Rss: Rss,
    Ruler: Ruler,
    RulerDimensionLine: RulerDimensionLine,
    RussianRuble: RussianRuble,
    Sailboat: Sailboat,
    Salad: Salad,
    Sandwich: Sandwich,
    Satellite: Satellite,
    SatelliteDish: SatelliteDish,
    SaudiRiyal: SaudiRiyal,
    Save: Save,
    SaveAll: SaveAll,
    SaveOff: SaveOff,
    Scale: Scale,
    Scale3d: Scale3d,
    Scaling: Scaling,
    Scan: Scan,
    ScanBarcode: ScanBarcode,
    ScanEye: ScanEye,
    ScanFace: ScanFace,
    ScanHeart: ScanHeart,
    ScanLine: ScanLine,
    ScanQrCode: ScanQrCode,
    ScanSearch: ScanSearch,
    ScanText: ScanText,
    School: School,
    Scissors: Scissors,
    ScissorsLineDashed: ScissorsLineDashed,
    ScreenShare: ScreenShare,
    ScreenShareOff: ScreenShareOff,
    Scroll: Scroll,
    ScrollText: ScrollText,
    Search: Search,
    SearchCheck: SearchCheck,
    SearchCode: SearchCode,
    SearchSlash: SearchSlash,
    SearchX: SearchX,
    Section: Section,
    Send: Send,
    SendHorizontal: SendHorizontal,
    SendToBack: SendToBack,
    SeparatorHorizontal: SeparatorHorizontal,
    SeparatorVertical: SeparatorVertical,
    Server: Server,
    ServerCog: ServerCog,
    ServerCrash: ServerCrash,
    ServerOff: ServerOff,
    Settings: Settings,
    Settings2: Settings2,
    Shapes: Shapes,
    Share: Share,
    Share2: Share2,
    Sheet: Sheet,
    Shell: Shell,
    Shield: Shield,
    ShieldAlert: ShieldAlert,
    ShieldBan: ShieldBan,
    ShieldCheck: ShieldCheck,
    ShieldEllipsis: ShieldEllipsis,
    ShieldHalf: ShieldHalf,
    ShieldMinus: ShieldMinus,
    ShieldOff: ShieldOff,
    ShieldPlus: ShieldPlus,
    ShieldQuestionMark: ShieldQuestionMark,
    ShieldUser: ShieldUser,
    ShieldX: ShieldX,
    Ship: Ship,
    ShipWheel: ShipWheel,
    Shirt: Shirt,
    ShoppingBag: ShoppingBag,
    ShoppingBasket: ShoppingBasket,
    ShoppingCart: ShoppingCart,
    Shovel: Shovel,
    ShowerHead: ShowerHead,
    Shredder: Shredder,
    Shrimp: Shrimp,
    Shrink: Shrink,
    Shrub: Shrub,
    Shuffle: Shuffle,
    Sigma: Sigma,
    Signal: Signal,
    SignalHigh: SignalHigh,
    SignalLow: SignalLow,
    SignalMedium: SignalMedium,
    SignalZero: SignalZero,
    Signature: Signature,
    Signpost: Signpost,
    SignpostBig: SignpostBig,
    Siren: Siren,
    SkipBack: SkipBack,
    SkipForward: SkipForward,
    Skull: Skull,
    Slack: Slack,
    Slash: Slash,
    Slice: Slice,
    SlidersHorizontal: SlidersHorizontal,
    SlidersVertical: SlidersVertical,
    Smartphone: Smartphone,
    SmartphoneCharging: SmartphoneCharging,
    SmartphoneNfc: SmartphoneNfc,
    Smile: Smile,
    SmilePlus: SmilePlus,
    Snail: Snail,
    Snowflake: Snowflake,
    SoapDispenserDroplet: SoapDispenserDroplet,
    Sofa: Sofa,
    Soup: Soup,
    Space: Space,
    Spade: Spade,
    Sparkle: Sparkle,
    Sparkles: Sparkles,
    Speaker: Speaker,
    Speech: Speech,
    SpellCheck: SpellCheck,
    SpellCheck2: SpellCheck2,
    Spline: Spline,
    SplinePointer: SplinePointer,
    Split: Split,
    Spool: Spool,
    SprayCan: SprayCan,
    Sprout: Sprout,
    Square: Square,
    SquareActivity: SquareActivity,
    SquareArrowDown: SquareArrowDown,
    SquareArrowDownLeft: SquareArrowDownLeft,
    SquareArrowDownRight: SquareArrowDownRight,
    SquareArrowLeft: SquareArrowLeft,
    SquareArrowOutDownLeft: SquareArrowOutDownLeft,
    SquareArrowOutDownRight: SquareArrowOutDownRight,
    SquareArrowOutUpLeft: SquareArrowOutUpLeft,
    SquareArrowOutUpRight: SquareArrowOutUpRight,
    SquareArrowRight: SquareArrowRight,
    SquareArrowUp: SquareArrowUp,
    SquareArrowUpLeft: SquareArrowUpLeft,
    SquareArrowUpRight: SquareArrowUpRight,
    SquareAsterisk: SquareAsterisk,
    SquareBottomDashedScissors: SquareBottomDashedScissors,
    SquareChartGantt: SquareChartGantt,
    SquareCheck: SquareCheck,
    SquareCheckBig: SquareCheckBig,
    SquareChevronDown: SquareChevronDown,
    SquareChevronLeft: SquareChevronLeft,
    SquareChevronRight: SquareChevronRight,
    SquareChevronUp: SquareChevronUp,
    SquareCode: SquareCode,
    SquareDashed: SquareDashed,
    SquareDashedBottom: SquareDashedBottom,
    SquareDashedBottomCode: SquareDashedBottomCode,
    SquareDashedKanban: SquareDashedKanban,
    SquareDashedMousePointer: SquareDashedMousePointer,
    SquareDashedTopSolid: SquareDashedTopSolid,
    SquareDivide: SquareDivide,
    SquareDot: SquareDot,
    SquareEqual: SquareEqual,
    SquareFunction: SquareFunction,
    SquareKanban: SquareKanban,
    SquareLibrary: SquareLibrary,
    SquareM: SquareM,
    SquareMenu: SquareMenu,
    SquareMinus: SquareMinus,
    SquareMousePointer: SquareMousePointer,
    SquareParking: SquareParking,
    SquareParkingOff: SquareParkingOff,
    SquarePen: SquarePen,
    SquarePercent: SquarePercent,
    SquarePi: SquarePi,
    SquarePilcrow: SquarePilcrow,
    SquarePlay: SquarePlay,
    SquarePlus: SquarePlus,
    SquarePower: SquarePower,
    SquareRadical: SquareRadical,
    SquareRoundCorner: SquareRoundCorner,
    SquareScissors: SquareScissors,
    SquareSigma: SquareSigma,
    SquareSlash: SquareSlash,
    SquareSplitHorizontal: SquareSplitHorizontal,
    SquareSplitVertical: SquareSplitVertical,
    SquareSquare: SquareSquare,
    SquareStack: SquareStack,
    SquareTerminal: SquareTerminal,
    SquareUser: SquareUser,
    SquareUserRound: SquareUserRound,
    SquareX: SquareX,
    SquaresExclude: SquaresExclude,
    SquaresIntersect: SquaresIntersect,
    SquaresSubtract: SquaresSubtract,
    SquaresUnite: SquaresUnite,
    Squircle: Squircle,
    SquircleDashed: SquircleDashed,
    Squirrel: Squirrel,
    Stamp: Stamp,
    Star: Star,
    StarHalf: StarHalf,
    StarOff: StarOff,
    StepBack: StepBack,
    StepForward: StepForward,
    Stethoscope: Stethoscope,
    Sticker: Sticker,
    StickyNote: StickyNote,
    Store: Store,
    StretchHorizontal: StretchHorizontal,
    StretchVertical: StretchVertical,
    Strikethrough: Strikethrough,
    Subscript: Subscript,
    Sun: Sun,
    SunDim: SunDim,
    SunMedium: SunMedium,
    SunMoon: SunMoon,
    SunSnow: SunSnow,
    Sunrise: Sunrise,
    Sunset: Sunset,
    Superscript: Superscript,
    SwatchBook: SwatchBook,
    SwissFranc: SwissFranc,
    SwitchCamera: SwitchCamera,
    Sword: Sword,
    Swords: Swords,
    Syringe: Syringe,
    Table: Table,
    Table2: Table2,
    TableCellsMerge: TableCellsMerge,
    TableCellsSplit: TableCellsSplit,
    TableColumnsSplit: TableColumnsSplit,
    TableOfContents: TableOfContents,
    TableProperties: TableProperties,
    TableRowsSplit: TableRowsSplit,
    Tablet: Tablet,
    TabletSmartphone: TabletSmartphone,
    Tablets: Tablets,
    Tag: Tag,
    Tags: Tags,
    Tally1: Tally1,
    Tally2: Tally2,
    Tally3: Tally3,
    Tally4: Tally4,
    Tally5: Tally5,
    Tangent: Tangent,
    Target: Target,
    Telescope: Telescope,
    Tent: Tent,
    TentTree: TentTree,
    Terminal: Terminal,
    TestTube: TestTube,
    TestTubeDiagonal: TestTubeDiagonal,
    TestTubes: TestTubes,
    Text: Text,
    TextCursor: TextCursor,
    TextCursorInput: TextCursorInput,
    TextQuote: TextQuote,
    TextSearch: TextSearch,
    TextSelect: TextSelect,
    Theater: Theater,
    Thermometer: Thermometer,
    ThermometerSnowflake: ThermometerSnowflake,
    ThermometerSun: ThermometerSun,
    ThumbsDown: ThumbsDown,
    ThumbsUp: ThumbsUp,
    Ticket: Ticket,
    TicketCheck: TicketCheck,
    TicketMinus: TicketMinus,
    TicketPercent: TicketPercent,
    TicketPlus: TicketPlus,
    TicketSlash: TicketSlash,
    TicketX: TicketX,
    Tickets: Tickets,
    TicketsPlane: TicketsPlane,
    Timer: Timer,
    TimerOff: TimerOff,
    TimerReset: TimerReset,
    ToggleLeft: ToggleLeft,
    ToggleRight: ToggleRight,
    Toilet: Toilet,
    Tornado: Tornado,
    Torus: Torus,
    Touchpad: Touchpad,
    TouchpadOff: TouchpadOff,
    TowerControl: TowerControl,
    ToyBrick: ToyBrick,
    Tractor: Tractor,
    TrafficCone: TrafficCone,
    TrainFront: TrainFront,
    TrainFrontTunnel: TrainFrontTunnel,
    TrainTrack: TrainTrack,
    TramFront: TramFront,
    Transgender: Transgender,
    Trash: Trash,
    Trash2: Trash2,
    TreeDeciduous: TreeDeciduous,
    TreePalm: TreePalm,
    TreePine: TreePine,
    Trees: Trees,
    Trello: Trello,
    TrendingDown: TrendingDown,
    TrendingUp: TrendingUp,
    TrendingUpDown: TrendingUpDown,
    Triangle: Triangle,
    TriangleAlert: TriangleAlert,
    TriangleDashed: TriangleDashed,
    TriangleRight: TriangleRight,
    Trophy: Trophy,
    Truck: Truck,
    TruckElectric: TruckElectric,
    Turtle: Turtle,
    Tv: Tv,
    TvMinimal: TvMinimal,
    TvMinimalPlay: TvMinimalPlay,
    Twitch: Twitch,
    Twitter: Twitter,
    Type: Type,
    TypeOutline: TypeOutline,
    Umbrella: Umbrella,
    UmbrellaOff: UmbrellaOff,
    Underline: Underline,
    Undo: Undo,
    Undo2: Undo2,
    UndoDot: UndoDot,
    UnfoldHorizontal: UnfoldHorizontal,
    UnfoldVertical: UnfoldVertical,
    Ungroup: Ungroup,
    University: University,
    Unlink: Unlink,
    Unlink2: Unlink2,
    Unplug: Unplug,
    Upload: Upload,
    Usb: Usb,
    User: User,
    UserCheck: UserCheck,
    UserCog: UserCog,
    UserLock: UserLock,
    UserMinus: UserMinus,
    UserPen: UserPen,
    UserPlus: UserPlus,
    UserRound: UserRound,
    UserRoundCheck: UserRoundCheck,
    UserRoundCog: UserRoundCog,
    UserRoundMinus: UserRoundMinus,
    UserRoundPen: UserRoundPen,
    UserRoundPlus: UserRoundPlus,
    UserRoundSearch: UserRoundSearch,
    UserRoundX: UserRoundX,
    UserSearch: UserSearch,
    UserX: UserX,
    Users: Users,
    UsersRound: UsersRound,
    Utensils: Utensils,
    UtensilsCrossed: UtensilsCrossed,
    UtilityPole: UtilityPole,
    Variable: Variable,
    Vault: Vault,
    Vegan: Vegan,
    VenetianMask: VenetianMask,
    Venus: Venus,
    VenusAndMars: VenusAndMars,
    Vibrate: Vibrate,
    VibrateOff: VibrateOff,
    Video: Video,
    VideoOff: VideoOff,
    Videotape: Videotape,
    View: View,
    Voicemail: Voicemail,
    Volleyball: Volleyball,
    Volume: Volume,
    Volume1: Volume1,
    Volume2: Volume2,
    VolumeOff: VolumeOff,
    VolumeX: VolumeX,
    Vote: Vote,
    Wallet: Wallet,
    WalletCards: WalletCards,
    WalletMinimal: WalletMinimal,
    Wallpaper: Wallpaper,
    Wand: Wand,
    WandSparkles: WandSparkles,
    Warehouse: Warehouse,
    WashingMachine: WashingMachine,
    Watch: Watch,
    Waves: Waves,
    WavesLadder: WavesLadder,
    Waypoints: Waypoints,
    Webcam: Webcam,
    Webhook: Webhook,
    WebhookOff: WebhookOff,
    Weight: Weight,
    Wheat: Wheat,
    WheatOff: WheatOff,
    WholeWord: WholeWord,
    Wifi: Wifi,
    WifiCog: WifiCog,
    WifiHigh: WifiHigh,
    WifiLow: WifiLow,
    WifiOff: WifiOff,
    WifiPen: WifiPen,
    WifiZero: WifiZero,
    Wind: Wind,
    WindArrowDown: WindArrowDown,
    Wine: Wine,
    WineOff: WineOff,
    Workflow: Workflow,
    Worm: Worm,
    WrapText: WrapText,
    Wrench: Wrench,
    X: X,
    Youtube: Youtube,
    Zap: Zap,
    ZapOff: ZapOff,
    ZoomIn: ZoomIn,
    ZoomOut: ZoomOut
  });

  exports.AArrowDown = AArrowDown;
  exports.AArrowDownIcon = AArrowDown;
  exports.AArrowUp = AArrowUp;
  exports.AArrowUpIcon = AArrowUp;
  exports.ALargeSmall = ALargeSmall;
  exports.ALargeSmallIcon = ALargeSmall;
  exports.Accessibility = Accessibility;
  exports.AccessibilityIcon = Accessibility;
  exports.Activity = Activity;
  exports.ActivityIcon = Activity;
  exports.ActivitySquare = SquareActivity;
  exports.ActivitySquareIcon = SquareActivity;
  exports.AirVent = AirVent;
  exports.AirVentIcon = AirVent;
  exports.Airplay = Airplay;
  exports.AirplayIcon = Airplay;
  exports.AlarmCheck = AlarmClockCheck;
  exports.AlarmCheckIcon = AlarmClockCheck;
  exports.AlarmClock = AlarmClock;
  exports.AlarmClockCheck = AlarmClockCheck;
  exports.AlarmClockCheckIcon = AlarmClockCheck;
  exports.AlarmClockIcon = AlarmClock;
  exports.AlarmClockMinus = AlarmClockMinus;
  exports.AlarmClockMinusIcon = AlarmClockMinus;
  exports.AlarmClockOff = AlarmClockOff;
  exports.AlarmClockOffIcon = AlarmClockOff;
  exports.AlarmClockPlus = AlarmClockPlus;
  exports.AlarmClockPlusIcon = AlarmClockPlus;
  exports.AlarmMinus = AlarmClockMinus;
  exports.AlarmMinusIcon = AlarmClockMinus;
  exports.AlarmPlus = AlarmClockPlus;
  exports.AlarmPlusIcon = AlarmClockPlus;
  exports.AlarmSmoke = AlarmSmoke;
  exports.AlarmSmokeIcon = AlarmSmoke;
  exports.Album = Album;
  exports.AlbumIcon = Album;
  exports.AlertCircle = CircleAlert;
  exports.AlertCircleIcon = CircleAlert;
  exports.AlertOctagon = OctagonAlert;
  exports.AlertOctagonIcon = OctagonAlert;
  exports.AlertTriangle = TriangleAlert;
  exports.AlertTriangleIcon = TriangleAlert;
  exports.AlignCenter = AlignCenter;
  exports.AlignCenterHorizontal = AlignCenterHorizontal;
  exports.AlignCenterHorizontalIcon = AlignCenterHorizontal;
  exports.AlignCenterIcon = AlignCenter;
  exports.AlignCenterVertical = AlignCenterVertical;
  exports.AlignCenterVerticalIcon = AlignCenterVertical;
  exports.AlignEndHorizontal = AlignEndHorizontal;
  exports.AlignEndHorizontalIcon = AlignEndHorizontal;
  exports.AlignEndVertical = AlignEndVertical;
  exports.AlignEndVerticalIcon = AlignEndVertical;
  exports.AlignHorizontalDistributeCenter = AlignHorizontalDistributeCenter;
  exports.AlignHorizontalDistributeCenterIcon = AlignHorizontalDistributeCenter;
  exports.AlignHorizontalDistributeEnd = AlignHorizontalDistributeEnd;
  exports.AlignHorizontalDistributeEndIcon = AlignHorizontalDistributeEnd;
  exports.AlignHorizontalDistributeStart = AlignHorizontalDistributeStart;
  exports.AlignHorizontalDistributeStartIcon = AlignHorizontalDistributeStart;
  exports.AlignHorizontalJustifyCenter = AlignHorizontalJustifyCenter;
  exports.AlignHorizontalJustifyCenterIcon = AlignHorizontalJustifyCenter;
  exports.AlignHorizontalJustifyEnd = AlignHorizontalJustifyEnd;
  exports.AlignHorizontalJustifyEndIcon = AlignHorizontalJustifyEnd;
  exports.AlignHorizontalJustifyStart = AlignHorizontalJustifyStart;
  exports.AlignHorizontalJustifyStartIcon = AlignHorizontalJustifyStart;
  exports.AlignHorizontalSpaceAround = AlignHorizontalSpaceAround;
  exports.AlignHorizontalSpaceAroundIcon = AlignHorizontalSpaceAround;
  exports.AlignHorizontalSpaceBetween = AlignHorizontalSpaceBetween;
  exports.AlignHorizontalSpaceBetweenIcon = AlignHorizontalSpaceBetween;
  exports.AlignJustify = AlignJustify;
  exports.AlignJustifyIcon = AlignJustify;
  exports.AlignLeft = AlignLeft;
  exports.AlignLeftIcon = AlignLeft;
  exports.AlignRight = AlignRight;
  exports.AlignRightIcon = AlignRight;
  exports.AlignStartHorizontal = AlignStartHorizontal;
  exports.AlignStartHorizontalIcon = AlignStartHorizontal;
  exports.AlignStartVertical = AlignStartVertical;
  exports.AlignStartVerticalIcon = AlignStartVertical;
  exports.AlignVerticalDistributeCenter = AlignVerticalDistributeCenter;
  exports.AlignVerticalDistributeCenterIcon = AlignVerticalDistributeCenter;
  exports.AlignVerticalDistributeEnd = AlignVerticalDistributeEnd;
  exports.AlignVerticalDistributeEndIcon = AlignVerticalDistributeEnd;
  exports.AlignVerticalDistributeStart = AlignVerticalDistributeStart;
  exports.AlignVerticalDistributeStartIcon = AlignVerticalDistributeStart;
  exports.AlignVerticalJustifyCenter = AlignVerticalJustifyCenter;
  exports.AlignVerticalJustifyCenterIcon = AlignVerticalJustifyCenter;
  exports.AlignVerticalJustifyEnd = AlignVerticalJustifyEnd;
  exports.AlignVerticalJustifyEndIcon = AlignVerticalJustifyEnd;
  exports.AlignVerticalJustifyStart = AlignVerticalJustifyStart;
  exports.AlignVerticalJustifyStartIcon = AlignVerticalJustifyStart;
  exports.AlignVerticalSpaceAround = AlignVerticalSpaceAround;
  exports.AlignVerticalSpaceAroundIcon = AlignVerticalSpaceAround;
  exports.AlignVerticalSpaceBetween = AlignVerticalSpaceBetween;
  exports.AlignVerticalSpaceBetweenIcon = AlignVerticalSpaceBetween;
  exports.Ambulance = Ambulance;
  exports.AmbulanceIcon = Ambulance;
  exports.Ampersand = Ampersand;
  exports.AmpersandIcon = Ampersand;
  exports.Ampersands = Ampersands;
  exports.AmpersandsIcon = Ampersands;
  exports.Amphora = Amphora;
  exports.AmphoraIcon = Amphora;
  exports.Anchor = Anchor;
  exports.AnchorIcon = Anchor;
  exports.Angry = Angry;
  exports.AngryIcon = Angry;
  exports.Annoyed = Annoyed;
  exports.AnnoyedIcon = Annoyed;
  exports.Antenna = Antenna;
  exports.AntennaIcon = Antenna;
  exports.Anvil = Anvil;
  exports.AnvilIcon = Anvil;
  exports.Aperture = Aperture;
  exports.ApertureIcon = Aperture;
  exports.AppWindow = AppWindow;
  exports.AppWindowIcon = AppWindow;
  exports.AppWindowMac = AppWindowMac;
  exports.AppWindowMacIcon = AppWindowMac;
  exports.Apple = Apple;
  exports.AppleIcon = Apple;
  exports.Archive = Archive;
  exports.ArchiveIcon = Archive;
  exports.ArchiveRestore = ArchiveRestore;
  exports.ArchiveRestoreIcon = ArchiveRestore;
  exports.ArchiveX = ArchiveX;
  exports.ArchiveXIcon = ArchiveX;
  exports.AreaChart = ChartArea;
  exports.AreaChartIcon = ChartArea;
  exports.Armchair = Armchair;
  exports.ArmchairIcon = Armchair;
  exports.ArrowBigDown = ArrowBigDown;
  exports.ArrowBigDownDash = ArrowBigDownDash;
  exports.ArrowBigDownDashIcon = ArrowBigDownDash;
  exports.ArrowBigDownIcon = ArrowBigDown;
  exports.ArrowBigLeft = ArrowBigLeft;
  exports.ArrowBigLeftDash = ArrowBigLeftDash;
  exports.ArrowBigLeftDashIcon = ArrowBigLeftDash;
  exports.ArrowBigLeftIcon = ArrowBigLeft;
  exports.ArrowBigRight = ArrowBigRight;
  exports.ArrowBigRightDash = ArrowBigRightDash;
  exports.ArrowBigRightDashIcon = ArrowBigRightDash;
  exports.ArrowBigRightIcon = ArrowBigRight;
  exports.ArrowBigUp = ArrowBigUp;
  exports.ArrowBigUpDash = ArrowBigUpDash;
  exports.ArrowBigUpDashIcon = ArrowBigUpDash;
  exports.ArrowBigUpIcon = ArrowBigUp;
  exports.ArrowDown = ArrowDown;
  exports.ArrowDown01 = ArrowDown01;
  exports.ArrowDown01Icon = ArrowDown01;
  exports.ArrowDown10 = ArrowDown10;
  exports.ArrowDown10Icon = ArrowDown10;
  exports.ArrowDownAZ = ArrowDownAZ;
  exports.ArrowDownAZIcon = ArrowDownAZ;
  exports.ArrowDownAz = ArrowDownAZ;
  exports.ArrowDownAzIcon = ArrowDownAZ;
  exports.ArrowDownCircle = CircleArrowDown;
  exports.ArrowDownCircleIcon = CircleArrowDown;
  exports.ArrowDownFromLine = ArrowDownFromLine;
  exports.ArrowDownFromLineIcon = ArrowDownFromLine;
  exports.ArrowDownIcon = ArrowDown;
  exports.ArrowDownLeft = ArrowDownLeft;
  exports.ArrowDownLeftFromCircle = CircleArrowOutDownLeft;
  exports.ArrowDownLeftFromCircleIcon = CircleArrowOutDownLeft;
  exports.ArrowDownLeftFromSquare = SquareArrowOutDownLeft;
  exports.ArrowDownLeftFromSquareIcon = SquareArrowOutDownLeft;
  exports.ArrowDownLeftIcon = ArrowDownLeft;
  exports.ArrowDownLeftSquare = SquareArrowDownLeft;
  exports.ArrowDownLeftSquareIcon = SquareArrowDownLeft;
  exports.ArrowDownNarrowWide = ArrowDownNarrowWide;
  exports.ArrowDownNarrowWideIcon = ArrowDownNarrowWide;
  exports.ArrowDownRight = ArrowDownRight;
  exports.ArrowDownRightFromCircle = CircleArrowOutDownRight;
  exports.ArrowDownRightFromCircleIcon = CircleArrowOutDownRight;
  exports.ArrowDownRightFromSquare = SquareArrowOutDownRight;
  exports.ArrowDownRightFromSquareIcon = SquareArrowOutDownRight;
  exports.ArrowDownRightIcon = ArrowDownRight;
  exports.ArrowDownRightSquare = SquareArrowDownRight;
  exports.ArrowDownRightSquareIcon = SquareArrowDownRight;
  exports.ArrowDownSquare = SquareArrowDown;
  exports.ArrowDownSquareIcon = SquareArrowDown;
  exports.ArrowDownToDot = ArrowDownToDot;
  exports.ArrowDownToDotIcon = ArrowDownToDot;
  exports.ArrowDownToLine = ArrowDownToLine;
  exports.ArrowDownToLineIcon = ArrowDownToLine;
  exports.ArrowDownUp = ArrowDownUp;
  exports.ArrowDownUpIcon = ArrowDownUp;
  exports.ArrowDownWideNarrow = ArrowDownWideNarrow;
  exports.ArrowDownWideNarrowIcon = ArrowDownWideNarrow;
  exports.ArrowDownZA = ArrowDownZA;
  exports.ArrowDownZAIcon = ArrowDownZA;
  exports.ArrowDownZa = ArrowDownZA;
  exports.ArrowDownZaIcon = ArrowDownZA;
  exports.ArrowLeft = ArrowLeft;
  exports.ArrowLeftCircle = CircleArrowLeft;
  exports.ArrowLeftCircleIcon = CircleArrowLeft;
  exports.ArrowLeftFromLine = ArrowLeftFromLine;
  exports.ArrowLeftFromLineIcon = ArrowLeftFromLine;
  exports.ArrowLeftIcon = ArrowLeft;
  exports.ArrowLeftRight = ArrowLeftRight;
  exports.ArrowLeftRightIcon = ArrowLeftRight;
  exports.ArrowLeftSquare = SquareArrowLeft;
  exports.ArrowLeftSquareIcon = SquareArrowLeft;
  exports.ArrowLeftToLine = ArrowLeftToLine;
  exports.ArrowLeftToLineIcon = ArrowLeftToLine;
  exports.ArrowRight = ArrowRight;
  exports.ArrowRightCircle = CircleArrowRight;
  exports.ArrowRightCircleIcon = CircleArrowRight;
  exports.ArrowRightFromLine = ArrowRightFromLine;
  exports.ArrowRightFromLineIcon = ArrowRightFromLine;
  exports.ArrowRightIcon = ArrowRight;
  exports.ArrowRightLeft = ArrowRightLeft;
  exports.ArrowRightLeftIcon = ArrowRightLeft;
  exports.ArrowRightSquare = SquareArrowRight;
  exports.ArrowRightSquareIcon = SquareArrowRight;
  exports.ArrowRightToLine = ArrowRightToLine;
  exports.ArrowRightToLineIcon = ArrowRightToLine;
  exports.ArrowUp = ArrowUp;
  exports.ArrowUp01 = ArrowUp01;
  exports.ArrowUp01Icon = ArrowUp01;
  exports.ArrowUp10 = ArrowUp10;
  exports.ArrowUp10Icon = ArrowUp10;
  exports.ArrowUpAZ = ArrowUpAZ;
  exports.ArrowUpAZIcon = ArrowUpAZ;
  exports.ArrowUpAz = ArrowUpAZ;
  exports.ArrowUpAzIcon = ArrowUpAZ;
  exports.ArrowUpCircle = CircleArrowUp;
  exports.ArrowUpCircleIcon = CircleArrowUp;
  exports.ArrowUpDown = ArrowUpDown;
  exports.ArrowUpDownIcon = ArrowUpDown;
  exports.ArrowUpFromDot = ArrowUpFromDot;
  exports.ArrowUpFromDotIcon = ArrowUpFromDot;
  exports.ArrowUpFromLine = ArrowUpFromLine;
  exports.ArrowUpFromLineIcon = ArrowUpFromLine;
  exports.ArrowUpIcon = ArrowUp;
  exports.ArrowUpLeft = ArrowUpLeft;
  exports.ArrowUpLeftFromCircle = CircleArrowOutUpLeft;
  exports.ArrowUpLeftFromCircleIcon = CircleArrowOutUpLeft;
  exports.ArrowUpLeftFromSquare = SquareArrowOutUpLeft;
  exports.ArrowUpLeftFromSquareIcon = SquareArrowOutUpLeft;
  exports.ArrowUpLeftIcon = ArrowUpLeft;
  exports.ArrowUpLeftSquare = SquareArrowUpLeft;
  exports.ArrowUpLeftSquareIcon = SquareArrowUpLeft;
  exports.ArrowUpNarrowWide = ArrowUpNarrowWide;
  exports.ArrowUpNarrowWideIcon = ArrowUpNarrowWide;
  exports.ArrowUpRight = ArrowUpRight;
  exports.ArrowUpRightFromCircle = CircleArrowOutUpRight;
  exports.ArrowUpRightFromCircleIcon = CircleArrowOutUpRight;
  exports.ArrowUpRightFromSquare = SquareArrowOutUpRight;
  exports.ArrowUpRightFromSquareIcon = SquareArrowOutUpRight;
  exports.ArrowUpRightIcon = ArrowUpRight;
  exports.ArrowUpRightSquare = SquareArrowUpRight;
  exports.ArrowUpRightSquareIcon = SquareArrowUpRight;
  exports.ArrowUpSquare = SquareArrowUp;
  exports.ArrowUpSquareIcon = SquareArrowUp;
  exports.ArrowUpToLine = ArrowUpToLine;
  exports.ArrowUpToLineIcon = ArrowUpToLine;
  exports.ArrowUpWideNarrow = ArrowUpWideNarrow;
  exports.ArrowUpWideNarrowIcon = ArrowUpWideNarrow;
  exports.ArrowUpZA = ArrowUpZA;
  exports.ArrowUpZAIcon = ArrowUpZA;
  exports.ArrowUpZa = ArrowUpZA;
  exports.ArrowUpZaIcon = ArrowUpZA;
  exports.ArrowsUpFromLine = ArrowsUpFromLine;
  exports.ArrowsUpFromLineIcon = ArrowsUpFromLine;
  exports.Asterisk = Asterisk;
  exports.AsteriskIcon = Asterisk;
  exports.AsteriskSquare = SquareAsterisk;
  exports.AsteriskSquareIcon = SquareAsterisk;
  exports.AtSign = AtSign;
  exports.AtSignIcon = AtSign;
  exports.Atom = Atom;
  exports.AtomIcon = Atom;
  exports.AudioLines = AudioLines;
  exports.AudioLinesIcon = AudioLines;
  exports.AudioWaveform = AudioWaveform;
  exports.AudioWaveformIcon = AudioWaveform;
  exports.Award = Award;
  exports.AwardIcon = Award;
  exports.Axe = Axe;
  exports.AxeIcon = Axe;
  exports.Axis3D = Axis3d;
  exports.Axis3DIcon = Axis3d;
  exports.Axis3d = Axis3d;
  exports.Axis3dIcon = Axis3d;
  exports.Baby = Baby;
  exports.BabyIcon = Baby;
  exports.Backpack = Backpack;
  exports.BackpackIcon = Backpack;
  exports.Badge = Badge;
  exports.BadgeAlert = BadgeAlert;
  exports.BadgeAlertIcon = BadgeAlert;
  exports.BadgeCent = BadgeCent;
  exports.BadgeCentIcon = BadgeCent;
  exports.BadgeCheck = BadgeCheck;
  exports.BadgeCheckIcon = BadgeCheck;
  exports.BadgeDollarSign = BadgeDollarSign;
  exports.BadgeDollarSignIcon = BadgeDollarSign;
  exports.BadgeEuro = BadgeEuro;
  exports.BadgeEuroIcon = BadgeEuro;
  exports.BadgeHelp = BadgeQuestionMark;
  exports.BadgeHelpIcon = BadgeQuestionMark;
  exports.BadgeIcon = Badge;
  exports.BadgeIndianRupee = BadgeIndianRupee;
  exports.BadgeIndianRupeeIcon = BadgeIndianRupee;
  exports.BadgeInfo = BadgeInfo;
  exports.BadgeInfoIcon = BadgeInfo;
  exports.BadgeJapaneseYen = BadgeJapaneseYen;
  exports.BadgeJapaneseYenIcon = BadgeJapaneseYen;
  exports.BadgeMinus = BadgeMinus;
  exports.BadgeMinusIcon = BadgeMinus;
  exports.BadgePercent = BadgePercent;
  exports.BadgePercentIcon = BadgePercent;
  exports.BadgePlus = BadgePlus;
  exports.BadgePlusIcon = BadgePlus;
  exports.BadgePoundSterling = BadgePoundSterling;
  exports.BadgePoundSterlingIcon = BadgePoundSterling;
  exports.BadgeQuestionMark = BadgeQuestionMark;
  exports.BadgeQuestionMarkIcon = BadgeQuestionMark;
  exports.BadgeRussianRuble = BadgeRussianRuble;
  exports.BadgeRussianRubleIcon = BadgeRussianRuble;
  exports.BadgeSwissFranc = BadgeSwissFranc;
  exports.BadgeSwissFrancIcon = BadgeSwissFranc;
  exports.BadgeX = BadgeX;
  exports.BadgeXIcon = BadgeX;
  exports.BaggageClaim = BaggageClaim;
  exports.BaggageClaimIcon = BaggageClaim;
  exports.Ban = Ban;
  exports.BanIcon = Ban;
  exports.Banana = Banana;
  exports.BananaIcon = Banana;
  exports.Bandage = Bandage;
  exports.BandageIcon = Bandage;
  exports.Banknote = Banknote;
  exports.BanknoteArrowDown = BanknoteArrowDown;
  exports.BanknoteArrowDownIcon = BanknoteArrowDown;
  exports.BanknoteArrowUp = BanknoteArrowUp;
  exports.BanknoteArrowUpIcon = BanknoteArrowUp;
  exports.BanknoteIcon = Banknote;
  exports.BanknoteX = BanknoteX;
  exports.BanknoteXIcon = BanknoteX;
  exports.BarChart = ChartNoAxesColumnIncreasing;
  exports.BarChart2 = ChartNoAxesColumn;
  exports.BarChart2Icon = ChartNoAxesColumn;
  exports.BarChart3 = ChartColumn;
  exports.BarChart3Icon = ChartColumn;
  exports.BarChart4 = ChartColumnIncreasing;
  exports.BarChart4Icon = ChartColumnIncreasing;
  exports.BarChartBig = ChartColumnBig;
  exports.BarChartBigIcon = ChartColumnBig;
  exports.BarChartHorizontal = ChartBar;
  exports.BarChartHorizontalBig = ChartBarBig;
  exports.BarChartHorizontalBigIcon = ChartBarBig;
  exports.BarChartHorizontalIcon = ChartBar;
  exports.BarChartIcon = ChartNoAxesColumnIncreasing;
  exports.Barcode = Barcode;
  exports.BarcodeIcon = Barcode;
  exports.Barrel = Barrel;
  exports.BarrelIcon = Barrel;
  exports.Baseline = Baseline;
  exports.BaselineIcon = Baseline;
  exports.Bath = Bath;
  exports.BathIcon = Bath;
  exports.Battery = Battery;
  exports.BatteryCharging = BatteryCharging;
  exports.BatteryChargingIcon = BatteryCharging;
  exports.BatteryFull = BatteryFull;
  exports.BatteryFullIcon = BatteryFull;
  exports.BatteryIcon = Battery;
  exports.BatteryLow = BatteryLow;
  exports.BatteryLowIcon = BatteryLow;
  exports.BatteryMedium = BatteryMedium;
  exports.BatteryMediumIcon = BatteryMedium;
  exports.BatteryPlus = BatteryPlus;
  exports.BatteryPlusIcon = BatteryPlus;
  exports.BatteryWarning = BatteryWarning;
  exports.BatteryWarningIcon = BatteryWarning;
  exports.Beaker = Beaker;
  exports.BeakerIcon = Beaker;
  exports.Bean = Bean;
  exports.BeanIcon = Bean;
  exports.BeanOff = BeanOff;
  exports.BeanOffIcon = BeanOff;
  exports.Bed = Bed;
  exports.BedDouble = BedDouble;
  exports.BedDoubleIcon = BedDouble;
  exports.BedIcon = Bed;
  exports.BedSingle = BedSingle;
  exports.BedSingleIcon = BedSingle;
  exports.Beef = Beef;
  exports.BeefIcon = Beef;
  exports.Beer = Beer;
  exports.BeerIcon = Beer;
  exports.BeerOff = BeerOff;
  exports.BeerOffIcon = BeerOff;
  exports.Bell = Bell;
  exports.BellDot = BellDot;
  exports.BellDotIcon = BellDot;
  exports.BellElectric = BellElectric;
  exports.BellElectricIcon = BellElectric;
  exports.BellIcon = Bell;
  exports.BellMinus = BellMinus;
  exports.BellMinusIcon = BellMinus;
  exports.BellOff = BellOff;
  exports.BellOffIcon = BellOff;
  exports.BellPlus = BellPlus;
  exports.BellPlusIcon = BellPlus;
  exports.BellRing = BellRing;
  exports.BellRingIcon = BellRing;
  exports.BetweenHorizonalEnd = BetweenHorizontalEnd;
  exports.BetweenHorizonalEndIcon = BetweenHorizontalEnd;
  exports.BetweenHorizonalStart = BetweenHorizontalStart;
  exports.BetweenHorizonalStartIcon = BetweenHorizontalStart;
  exports.BetweenHorizontalEnd = BetweenHorizontalEnd;
  exports.BetweenHorizontalEndIcon = BetweenHorizontalEnd;
  exports.BetweenHorizontalStart = BetweenHorizontalStart;
  exports.BetweenHorizontalStartIcon = BetweenHorizontalStart;
  exports.BetweenVerticalEnd = BetweenVerticalEnd;
  exports.BetweenVerticalEndIcon = BetweenVerticalEnd;
  exports.BetweenVerticalStart = BetweenVerticalStart;
  exports.BetweenVerticalStartIcon = BetweenVerticalStart;
  exports.BicepsFlexed = BicepsFlexed;
  exports.BicepsFlexedIcon = BicepsFlexed;
  exports.Bike = Bike;
  exports.BikeIcon = Bike;
  exports.Binary = Binary;
  exports.BinaryIcon = Binary;
  exports.Binoculars = Binoculars;
  exports.BinocularsIcon = Binoculars;
  exports.Biohazard = Biohazard;
  exports.BiohazardIcon = Biohazard;
  exports.Bird = Bird;
  exports.BirdIcon = Bird;
  exports.Bitcoin = Bitcoin;
  exports.BitcoinIcon = Bitcoin;
  exports.Blend = Blend;
  exports.BlendIcon = Blend;
  exports.Blinds = Blinds;
  exports.BlindsIcon = Blinds;
  exports.Blocks = Blocks;
  exports.BlocksIcon = Blocks;
  exports.Bluetooth = Bluetooth;
  exports.BluetoothConnected = BluetoothConnected;
  exports.BluetoothConnectedIcon = BluetoothConnected;
  exports.BluetoothIcon = Bluetooth;
  exports.BluetoothOff = BluetoothOff;
  exports.BluetoothOffIcon = BluetoothOff;
  exports.BluetoothSearching = BluetoothSearching;
  exports.BluetoothSearchingIcon = BluetoothSearching;
  exports.Bold = Bold;
  exports.BoldIcon = Bold;
  exports.Bolt = Bolt;
  exports.BoltIcon = Bolt;
  exports.Bomb = Bomb;
  exports.BombIcon = Bomb;
  exports.Bone = Bone;
  exports.BoneIcon = Bone;
  exports.Book = Book;
  exports.BookA = BookA;
  exports.BookAIcon = BookA;
  exports.BookAlert = BookAlert;
  exports.BookAlertIcon = BookAlert;
  exports.BookAudio = BookAudio;
  exports.BookAudioIcon = BookAudio;
  exports.BookCheck = BookCheck;
  exports.BookCheckIcon = BookCheck;
  exports.BookCopy = BookCopy;
  exports.BookCopyIcon = BookCopy;
  exports.BookDashed = BookDashed;
  exports.BookDashedIcon = BookDashed;
  exports.BookDown = BookDown;
  exports.BookDownIcon = BookDown;
  exports.BookHeadphones = BookHeadphones;
  exports.BookHeadphonesIcon = BookHeadphones;
  exports.BookHeart = BookHeart;
  exports.BookHeartIcon = BookHeart;
  exports.BookIcon = Book;
  exports.BookImage = BookImage;
  exports.BookImageIcon = BookImage;
  exports.BookKey = BookKey;
  exports.BookKeyIcon = BookKey;
  exports.BookLock = BookLock;
  exports.BookLockIcon = BookLock;
  exports.BookMarked = BookMarked;
  exports.BookMarkedIcon = BookMarked;
  exports.BookMinus = BookMinus;
  exports.BookMinusIcon = BookMinus;
  exports.BookOpen = BookOpen;
  exports.BookOpenCheck = BookOpenCheck;
  exports.BookOpenCheckIcon = BookOpenCheck;
  exports.BookOpenIcon = BookOpen;
  exports.BookOpenText = BookOpenText;
  exports.BookOpenTextIcon = BookOpenText;
  exports.BookPlus = BookPlus;
  exports.BookPlusIcon = BookPlus;
  exports.BookTemplate = BookDashed;
  exports.BookTemplateIcon = BookDashed;
  exports.BookText = BookText;
  exports.BookTextIcon = BookText;
  exports.BookType = BookType;
  exports.BookTypeIcon = BookType;
  exports.BookUp = BookUp;
  exports.BookUp2 = BookUp2;
  exports.BookUp2Icon = BookUp2;
  exports.BookUpIcon = BookUp;
  exports.BookUser = BookUser;
  exports.BookUserIcon = BookUser;
  exports.BookX = BookX;
  exports.BookXIcon = BookX;
  exports.Bookmark = Bookmark;
  exports.BookmarkCheck = BookmarkCheck;
  exports.BookmarkCheckIcon = BookmarkCheck;
  exports.BookmarkIcon = Bookmark;
  exports.BookmarkMinus = BookmarkMinus;
  exports.BookmarkMinusIcon = BookmarkMinus;
  exports.BookmarkPlus = BookmarkPlus;
  exports.BookmarkPlusIcon = BookmarkPlus;
  exports.BookmarkX = BookmarkX;
  exports.BookmarkXIcon = BookmarkX;
  exports.BoomBox = BoomBox;
  exports.BoomBoxIcon = BoomBox;
  exports.Bot = Bot;
  exports.BotIcon = Bot;
  exports.BotMessageSquare = BotMessageSquare;
  exports.BotMessageSquareIcon = BotMessageSquare;
  exports.BotOff = BotOff;
  exports.BotOffIcon = BotOff;
  exports.BowArrow = BowArrow;
  exports.BowArrowIcon = BowArrow;
  exports.Box = Box;
  exports.BoxIcon = Box;
  exports.BoxSelect = SquareDashed;
  exports.BoxSelectIcon = SquareDashed;
  exports.Boxes = Boxes;
  exports.BoxesIcon = Boxes;
  exports.Braces = Braces;
  exports.BracesIcon = Braces;
  exports.Brackets = Brackets;
  exports.BracketsIcon = Brackets;
  exports.Brain = Brain;
  exports.BrainCircuit = BrainCircuit;
  exports.BrainCircuitIcon = BrainCircuit;
  exports.BrainCog = BrainCog;
  exports.BrainCogIcon = BrainCog;
  exports.BrainIcon = Brain;
  exports.BrickWall = BrickWall;
  exports.BrickWallFire = BrickWallFire;
  exports.BrickWallFireIcon = BrickWallFire;
  exports.BrickWallIcon = BrickWall;
  exports.Briefcase = Briefcase;
  exports.BriefcaseBusiness = BriefcaseBusiness;
  exports.BriefcaseBusinessIcon = BriefcaseBusiness;
  exports.BriefcaseConveyorBelt = BriefcaseConveyorBelt;
  exports.BriefcaseConveyorBeltIcon = BriefcaseConveyorBelt;
  exports.BriefcaseIcon = Briefcase;
  exports.BriefcaseMedical = BriefcaseMedical;
  exports.BriefcaseMedicalIcon = BriefcaseMedical;
  exports.BringToFront = BringToFront;
  exports.BringToFrontIcon = BringToFront;
  exports.Brush = Brush;
  exports.BrushCleaning = BrushCleaning;
  exports.BrushCleaningIcon = BrushCleaning;
  exports.BrushIcon = Brush;
  exports.Bubbles = Bubbles;
  exports.BubblesIcon = Bubbles;
  exports.Bug = Bug;
  exports.BugIcon = Bug;
  exports.BugOff = BugOff;
  exports.BugOffIcon = BugOff;
  exports.BugPlay = BugPlay;
  exports.BugPlayIcon = BugPlay;
  exports.Building = Building;
  exports.Building2 = Building2;
  exports.Building2Icon = Building2;
  exports.BuildingIcon = Building;
  exports.Bus = Bus;
  exports.BusFront = BusFront;
  exports.BusFrontIcon = BusFront;
  exports.BusIcon = Bus;
  exports.Cable = Cable;
  exports.CableCar = CableCar;
  exports.CableCarIcon = CableCar;
  exports.CableIcon = Cable;
  exports.Cake = Cake;
  exports.CakeIcon = Cake;
  exports.CakeSlice = CakeSlice;
  exports.CakeSliceIcon = CakeSlice;
  exports.Calculator = Calculator;
  exports.CalculatorIcon = Calculator;
  exports.Calendar = Calendar;
  exports.Calendar1 = Calendar1;
  exports.Calendar1Icon = Calendar1;
  exports.CalendarArrowDown = CalendarArrowDown;
  exports.CalendarArrowDownIcon = CalendarArrowDown;
  exports.CalendarArrowUp = CalendarArrowUp;
  exports.CalendarArrowUpIcon = CalendarArrowUp;
  exports.CalendarCheck = CalendarCheck;
  exports.CalendarCheck2 = CalendarCheck2;
  exports.CalendarCheck2Icon = CalendarCheck2;
  exports.CalendarCheckIcon = CalendarCheck;
  exports.CalendarClock = CalendarClock;
  exports.CalendarClockIcon = CalendarClock;
  exports.CalendarCog = CalendarCog;
  exports.CalendarCogIcon = CalendarCog;
  exports.CalendarDays = CalendarDays;
  exports.CalendarDaysIcon = CalendarDays;
  exports.CalendarFold = CalendarFold;
  exports.CalendarFoldIcon = CalendarFold;
  exports.CalendarHeart = CalendarHeart;
  exports.CalendarHeartIcon = CalendarHeart;
  exports.CalendarIcon = Calendar;
  exports.CalendarMinus = CalendarMinus;
  exports.CalendarMinus2 = CalendarMinus2;
  exports.CalendarMinus2Icon = CalendarMinus2;
  exports.CalendarMinusIcon = CalendarMinus;
  exports.CalendarOff = CalendarOff;
  exports.CalendarOffIcon = CalendarOff;
  exports.CalendarPlus = CalendarPlus;
  exports.CalendarPlus2 = CalendarPlus2;
  exports.CalendarPlus2Icon = CalendarPlus2;
  exports.CalendarPlusIcon = CalendarPlus;
  exports.CalendarRange = CalendarRange;
  exports.CalendarRangeIcon = CalendarRange;
  exports.CalendarSearch = CalendarSearch;
  exports.CalendarSearchIcon = CalendarSearch;
  exports.CalendarSync = CalendarSync;
  exports.CalendarSyncIcon = CalendarSync;
  exports.CalendarX = CalendarX;
  exports.CalendarX2 = CalendarX2;
  exports.CalendarX2Icon = CalendarX2;
  exports.CalendarXIcon = CalendarX;
  exports.Camera = Camera;
  exports.CameraIcon = Camera;
  exports.CameraOff = CameraOff;
  exports.CameraOffIcon = CameraOff;
  exports.CandlestickChart = ChartCandlestick;
  exports.CandlestickChartIcon = ChartCandlestick;
  exports.Candy = Candy;
  exports.CandyCane = CandyCane;
  exports.CandyCaneIcon = CandyCane;
  exports.CandyIcon = Candy;
  exports.CandyOff = CandyOff;
  exports.CandyOffIcon = CandyOff;
  exports.Cannabis = Cannabis;
  exports.CannabisIcon = Cannabis;
  exports.Captions = Captions;
  exports.CaptionsIcon = Captions;
  exports.CaptionsOff = CaptionsOff;
  exports.CaptionsOffIcon = CaptionsOff;
  exports.Car = Car;
  exports.CarFront = CarFront;
  exports.CarFrontIcon = CarFront;
  exports.CarIcon = Car;
  exports.CarTaxiFront = CarTaxiFront;
  exports.CarTaxiFrontIcon = CarTaxiFront;
  exports.Caravan = Caravan;
  exports.CaravanIcon = Caravan;
  exports.CardSim = CardSim;
  exports.CardSimIcon = CardSim;
  exports.Carrot = Carrot;
  exports.CarrotIcon = Carrot;
  exports.CaseLower = CaseLower;
  exports.CaseLowerIcon = CaseLower;
  exports.CaseSensitive = CaseSensitive;
  exports.CaseSensitiveIcon = CaseSensitive;
  exports.CaseUpper = CaseUpper;
  exports.CaseUpperIcon = CaseUpper;
  exports.CassetteTape = CassetteTape;
  exports.CassetteTapeIcon = CassetteTape;
  exports.Cast = Cast;
  exports.CastIcon = Cast;
  exports.Castle = Castle;
  exports.CastleIcon = Castle;
  exports.Cat = Cat;
  exports.CatIcon = Cat;
  exports.Cctv = Cctv;
  exports.CctvIcon = Cctv;
  exports.ChartArea = ChartArea;
  exports.ChartAreaIcon = ChartArea;
  exports.ChartBar = ChartBar;
  exports.ChartBarBig = ChartBarBig;
  exports.ChartBarBigIcon = ChartBarBig;
  exports.ChartBarDecreasing = ChartBarDecreasing;
  exports.ChartBarDecreasingIcon = ChartBarDecreasing;
  exports.ChartBarIcon = ChartBar;
  exports.ChartBarIncreasing = ChartBarIncreasing;
  exports.ChartBarIncreasingIcon = ChartBarIncreasing;
  exports.ChartBarStacked = ChartBarStacked;
  exports.ChartBarStackedIcon = ChartBarStacked;
  exports.ChartCandlestick = ChartCandlestick;
  exports.ChartCandlestickIcon = ChartCandlestick;
  exports.ChartColumn = ChartColumn;
  exports.ChartColumnBig = ChartColumnBig;
  exports.ChartColumnBigIcon = ChartColumnBig;
  exports.ChartColumnDecreasing = ChartColumnDecreasing;
  exports.ChartColumnDecreasingIcon = ChartColumnDecreasing;
  exports.ChartColumnIcon = ChartColumn;
  exports.ChartColumnIncreasing = ChartColumnIncreasing;
  exports.ChartColumnIncreasingIcon = ChartColumnIncreasing;
  exports.ChartColumnStacked = ChartColumnStacked;
  exports.ChartColumnStackedIcon = ChartColumnStacked;
  exports.ChartGantt = ChartGantt;
  exports.ChartGanttIcon = ChartGantt;
  exports.ChartLine = ChartLine;
  exports.ChartLineIcon = ChartLine;
  exports.ChartNetwork = ChartNetwork;
  exports.ChartNetworkIcon = ChartNetwork;
  exports.ChartNoAxesColumn = ChartNoAxesColumn;
  exports.ChartNoAxesColumnDecreasing = ChartNoAxesColumnDecreasing;
  exports.ChartNoAxesColumnDecreasingIcon = ChartNoAxesColumnDecreasing;
  exports.ChartNoAxesColumnIcon = ChartNoAxesColumn;
  exports.ChartNoAxesColumnIncreasing = ChartNoAxesColumnIncreasing;
  exports.ChartNoAxesColumnIncreasingIcon = ChartNoAxesColumnIncreasing;
  exports.ChartNoAxesCombined = ChartNoAxesCombined;
  exports.ChartNoAxesCombinedIcon = ChartNoAxesCombined;
  exports.ChartNoAxesGantt = ChartNoAxesGantt;
  exports.ChartNoAxesGanttIcon = ChartNoAxesGantt;
  exports.ChartPie = ChartPie;
  exports.ChartPieIcon = ChartPie;
  exports.ChartScatter = ChartScatter;
  exports.ChartScatterIcon = ChartScatter;
  exports.ChartSpline = ChartSpline;
  exports.ChartSplineIcon = ChartSpline;
  exports.Check = Check;
  exports.CheckCheck = CheckCheck;
  exports.CheckCheckIcon = CheckCheck;
  exports.CheckCircle = CircleCheckBig;
  exports.CheckCircle2 = CircleCheck;
  exports.CheckCircle2Icon = CircleCheck;
  exports.CheckCircleIcon = CircleCheckBig;
  exports.CheckIcon = Check;
  exports.CheckLine = CheckLine;
  exports.CheckLineIcon = CheckLine;
  exports.CheckSquare = SquareCheckBig;
  exports.CheckSquare2 = SquareCheck;
  exports.CheckSquare2Icon = SquareCheck;
  exports.CheckSquareIcon = SquareCheckBig;
  exports.ChefHat = ChefHat;
  exports.ChefHatIcon = ChefHat;
  exports.Cherry = Cherry;
  exports.CherryIcon = Cherry;
  exports.ChevronDown = ChevronDown;
  exports.ChevronDownCircle = CircleChevronDown;
  exports.ChevronDownCircleIcon = CircleChevronDown;
  exports.ChevronDownIcon = ChevronDown;
  exports.ChevronDownSquare = SquareChevronDown;
  exports.ChevronDownSquareIcon = SquareChevronDown;
  exports.ChevronFirst = ChevronFirst;
  exports.ChevronFirstIcon = ChevronFirst;
  exports.ChevronLast = ChevronLast;
  exports.ChevronLastIcon = ChevronLast;
  exports.ChevronLeft = ChevronLeft;
  exports.ChevronLeftCircle = CircleChevronLeft;
  exports.ChevronLeftCircleIcon = CircleChevronLeft;
  exports.ChevronLeftIcon = ChevronLeft;
  exports.ChevronLeftSquare = SquareChevronLeft;
  exports.ChevronLeftSquareIcon = SquareChevronLeft;
  exports.ChevronRight = ChevronRight;
  exports.ChevronRightCircle = CircleChevronRight;
  exports.ChevronRightCircleIcon = CircleChevronRight;
  exports.ChevronRightIcon = ChevronRight;
  exports.ChevronRightSquare = SquareChevronRight;
  exports.ChevronRightSquareIcon = SquareChevronRight;
  exports.ChevronUp = ChevronUp;
  exports.ChevronUpCircle = CircleChevronUp;
  exports.ChevronUpCircleIcon = CircleChevronUp;
  exports.ChevronUpIcon = ChevronUp;
  exports.ChevronUpSquare = SquareChevronUp;
  exports.ChevronUpSquareIcon = SquareChevronUp;
  exports.ChevronsDown = ChevronsDown;
  exports.ChevronsDownIcon = ChevronsDown;
  exports.ChevronsDownUp = ChevronsDownUp;
  exports.ChevronsDownUpIcon = ChevronsDownUp;
  exports.ChevronsLeft = ChevronsLeft;
  exports.ChevronsLeftIcon = ChevronsLeft;
  exports.ChevronsLeftRight = ChevronsLeftRight;
  exports.ChevronsLeftRightEllipsis = ChevronsLeftRightEllipsis;
  exports.ChevronsLeftRightEllipsisIcon = ChevronsLeftRightEllipsis;
  exports.ChevronsLeftRightIcon = ChevronsLeftRight;
  exports.ChevronsRight = ChevronsRight;
  exports.ChevronsRightIcon = ChevronsRight;
  exports.ChevronsRightLeft = ChevronsRightLeft;
  exports.ChevronsRightLeftIcon = ChevronsRightLeft;
  exports.ChevronsUp = ChevronsUp;
  exports.ChevronsUpDown = ChevronsUpDown;
  exports.ChevronsUpDownIcon = ChevronsUpDown;
  exports.ChevronsUpIcon = ChevronsUp;
  exports.Chrome = Chrome;
  exports.ChromeIcon = Chrome;
  exports.Church = Church;
  exports.ChurchIcon = Church;
  exports.Cigarette = Cigarette;
  exports.CigaretteIcon = Cigarette;
  exports.CigaretteOff = CigaretteOff;
  exports.CigaretteOffIcon = CigaretteOff;
  exports.Circle = Circle;
  exports.CircleAlert = CircleAlert;
  exports.CircleAlertIcon = CircleAlert;
  exports.CircleArrowDown = CircleArrowDown;
  exports.CircleArrowDownIcon = CircleArrowDown;
  exports.CircleArrowLeft = CircleArrowLeft;
  exports.CircleArrowLeftIcon = CircleArrowLeft;
  exports.CircleArrowOutDownLeft = CircleArrowOutDownLeft;
  exports.CircleArrowOutDownLeftIcon = CircleArrowOutDownLeft;
  exports.CircleArrowOutDownRight = CircleArrowOutDownRight;
  exports.CircleArrowOutDownRightIcon = CircleArrowOutDownRight;
  exports.CircleArrowOutUpLeft = CircleArrowOutUpLeft;
  exports.CircleArrowOutUpLeftIcon = CircleArrowOutUpLeft;
  exports.CircleArrowOutUpRight = CircleArrowOutUpRight;
  exports.CircleArrowOutUpRightIcon = CircleArrowOutUpRight;
  exports.CircleArrowRight = CircleArrowRight;
  exports.CircleArrowRightIcon = CircleArrowRight;
  exports.CircleArrowUp = CircleArrowUp;
  exports.CircleArrowUpIcon = CircleArrowUp;
  exports.CircleCheck = CircleCheck;
  exports.CircleCheckBig = CircleCheckBig;
  exports.CircleCheckBigIcon = CircleCheckBig;
  exports.CircleCheckIcon = CircleCheck;
  exports.CircleChevronDown = CircleChevronDown;
  exports.CircleChevronDownIcon = CircleChevronDown;
  exports.CircleChevronLeft = CircleChevronLeft;
  exports.CircleChevronLeftIcon = CircleChevronLeft;
  exports.CircleChevronRight = CircleChevronRight;
  exports.CircleChevronRightIcon = CircleChevronRight;
  exports.CircleChevronUp = CircleChevronUp;
  exports.CircleChevronUpIcon = CircleChevronUp;
  exports.CircleDashed = CircleDashed;
  exports.CircleDashedIcon = CircleDashed;
  exports.CircleDivide = CircleDivide;
  exports.CircleDivideIcon = CircleDivide;
  exports.CircleDollarSign = CircleDollarSign;
  exports.CircleDollarSignIcon = CircleDollarSign;
  exports.CircleDot = CircleDot;
  exports.CircleDotDashed = CircleDotDashed;
  exports.CircleDotDashedIcon = CircleDotDashed;
  exports.CircleDotIcon = CircleDot;
  exports.CircleEllipsis = CircleEllipsis;
  exports.CircleEllipsisIcon = CircleEllipsis;
  exports.CircleEqual = CircleEqual;
  exports.CircleEqualIcon = CircleEqual;
  exports.CircleFadingArrowUp = CircleFadingArrowUp;
  exports.CircleFadingArrowUpIcon = CircleFadingArrowUp;
  exports.CircleFadingPlus = CircleFadingPlus;
  exports.CircleFadingPlusIcon = CircleFadingPlus;
  exports.CircleGauge = CircleGauge;
  exports.CircleGaugeIcon = CircleGauge;
  exports.CircleHelp = CircleQuestionMark;
  exports.CircleHelpIcon = CircleQuestionMark;
  exports.CircleIcon = Circle;
  exports.CircleMinus = CircleMinus;
  exports.CircleMinusIcon = CircleMinus;
  exports.CircleOff = CircleOff;
  exports.CircleOffIcon = CircleOff;
  exports.CircleParking = CircleParking;
  exports.CircleParkingIcon = CircleParking;
  exports.CircleParkingOff = CircleParkingOff;
  exports.CircleParkingOffIcon = CircleParkingOff;
  exports.CirclePause = CirclePause;
  exports.CirclePauseIcon = CirclePause;
  exports.CirclePercent = CirclePercent;
  exports.CirclePercentIcon = CirclePercent;
  exports.CirclePlay = CirclePlay;
  exports.CirclePlayIcon = CirclePlay;
  exports.CirclePlus = CirclePlus;
  exports.CirclePlusIcon = CirclePlus;
  exports.CirclePoundSterling = CirclePoundSterling;
  exports.CirclePoundSterlingIcon = CirclePoundSterling;
  exports.CirclePower = CirclePower;
  exports.CirclePowerIcon = CirclePower;
  exports.CircleQuestionMark = CircleQuestionMark;
  exports.CircleQuestionMarkIcon = CircleQuestionMark;
  exports.CircleSlash = CircleSlash;
  exports.CircleSlash2 = CircleSlash2;
  exports.CircleSlash2Icon = CircleSlash2;
  exports.CircleSlashIcon = CircleSlash;
  exports.CircleSlashed = CircleSlash2;
  exports.CircleSlashedIcon = CircleSlash2;
  exports.CircleSmall = CircleSmall;
  exports.CircleSmallIcon = CircleSmall;
  exports.CircleStop = CircleStop;
  exports.CircleStopIcon = CircleStop;
  exports.CircleUser = CircleUser;
  exports.CircleUserIcon = CircleUser;
  exports.CircleUserRound = CircleUserRound;
  exports.CircleUserRoundIcon = CircleUserRound;
  exports.CircleX = CircleX;
  exports.CircleXIcon = CircleX;
  exports.CircuitBoard = CircuitBoard;
  exports.CircuitBoardIcon = CircuitBoard;
  exports.Citrus = Citrus;
  exports.CitrusIcon = Citrus;
  exports.Clapperboard = Clapperboard;
  exports.ClapperboardIcon = Clapperboard;
  exports.Clipboard = Clipboard;
  exports.ClipboardCheck = ClipboardCheck;
  exports.ClipboardCheckIcon = ClipboardCheck;
  exports.ClipboardCopy = ClipboardCopy;
  exports.ClipboardCopyIcon = ClipboardCopy;
  exports.ClipboardEdit = ClipboardPen;
  exports.ClipboardEditIcon = ClipboardPen;
  exports.ClipboardIcon = Clipboard;
  exports.ClipboardList = ClipboardList;
  exports.ClipboardListIcon = ClipboardList;
  exports.ClipboardMinus = ClipboardMinus;
  exports.ClipboardMinusIcon = ClipboardMinus;
  exports.ClipboardPaste = ClipboardPaste;
  exports.ClipboardPasteIcon = ClipboardPaste;
  exports.ClipboardPen = ClipboardPen;
  exports.ClipboardPenIcon = ClipboardPen;
  exports.ClipboardPenLine = ClipboardPenLine;
  exports.ClipboardPenLineIcon = ClipboardPenLine;
  exports.ClipboardPlus = ClipboardPlus;
  exports.ClipboardPlusIcon = ClipboardPlus;
  exports.ClipboardSignature = ClipboardPenLine;
  exports.ClipboardSignatureIcon = ClipboardPenLine;
  exports.ClipboardType = ClipboardType;
  exports.ClipboardTypeIcon = ClipboardType;
  exports.ClipboardX = ClipboardX;
  exports.ClipboardXIcon = ClipboardX;
  exports.Clock = Clock;
  exports.Clock1 = Clock1;
  exports.Clock10 = Clock10;
  exports.Clock10Icon = Clock10;
  exports.Clock11 = Clock11;
  exports.Clock11Icon = Clock11;
  exports.Clock12 = Clock12;
  exports.Clock12Icon = Clock12;
  exports.Clock1Icon = Clock1;
  exports.Clock2 = Clock2;
  exports.Clock2Icon = Clock2;
  exports.Clock3 = Clock3;
  exports.Clock3Icon = Clock3;
  exports.Clock4 = Clock4;
  exports.Clock4Icon = Clock4;
  exports.Clock5 = Clock5;
  exports.Clock5Icon = Clock5;
  exports.Clock6 = Clock6;
  exports.Clock6Icon = Clock6;
  exports.Clock7 = Clock7;
  exports.Clock7Icon = Clock7;
  exports.Clock8 = Clock8;
  exports.Clock8Icon = Clock8;
  exports.Clock9 = Clock9;
  exports.Clock9Icon = Clock9;
  exports.ClockAlert = ClockAlert;
  exports.ClockAlertIcon = ClockAlert;
  exports.ClockArrowDown = ClockArrowDown;
  exports.ClockArrowDownIcon = ClockArrowDown;
  exports.ClockArrowUp = ClockArrowUp;
  exports.ClockArrowUpIcon = ClockArrowUp;
  exports.ClockFading = ClockFading;
  exports.ClockFadingIcon = ClockFading;
  exports.ClockIcon = Clock;
  exports.ClockPlus = ClockPlus;
  exports.ClockPlusIcon = ClockPlus;
  exports.Cloud = Cloud;
  exports.CloudAlert = CloudAlert;
  exports.CloudAlertIcon = CloudAlert;
  exports.CloudCheck = CloudCheck;
  exports.CloudCheckIcon = CloudCheck;
  exports.CloudCog = CloudCog;
  exports.CloudCogIcon = CloudCog;
  exports.CloudDownload = CloudDownload;
  exports.CloudDownloadIcon = CloudDownload;
  exports.CloudDrizzle = CloudDrizzle;
  exports.CloudDrizzleIcon = CloudDrizzle;
  exports.CloudFog = CloudFog;
  exports.CloudFogIcon = CloudFog;
  exports.CloudHail = CloudHail;
  exports.CloudHailIcon = CloudHail;
  exports.CloudIcon = Cloud;
  exports.CloudLightning = CloudLightning;
  exports.CloudLightningIcon = CloudLightning;
  exports.CloudMoon = CloudMoon;
  exports.CloudMoonIcon = CloudMoon;
  exports.CloudMoonRain = CloudMoonRain;
  exports.CloudMoonRainIcon = CloudMoonRain;
  exports.CloudOff = CloudOff;
  exports.CloudOffIcon = CloudOff;
  exports.CloudRain = CloudRain;
  exports.CloudRainIcon = CloudRain;
  exports.CloudRainWind = CloudRainWind;
  exports.CloudRainWindIcon = CloudRainWind;
  exports.CloudSnow = CloudSnow;
  exports.CloudSnowIcon = CloudSnow;
  exports.CloudSun = CloudSun;
  exports.CloudSunIcon = CloudSun;
  exports.CloudSunRain = CloudSunRain;
  exports.CloudSunRainIcon = CloudSunRain;
  exports.CloudUpload = CloudUpload;
  exports.CloudUploadIcon = CloudUpload;
  exports.Cloudy = Cloudy;
  exports.CloudyIcon = Cloudy;
  exports.Clover = Clover;
  exports.CloverIcon = Clover;
  exports.Club = Club;
  exports.ClubIcon = Club;
  exports.Code = Code;
  exports.Code2 = CodeXml;
  exports.Code2Icon = CodeXml;
  exports.CodeIcon = Code;
  exports.CodeSquare = SquareCode;
  exports.CodeSquareIcon = SquareCode;
  exports.CodeXml = CodeXml;
  exports.CodeXmlIcon = CodeXml;
  exports.Codepen = Codepen;
  exports.CodepenIcon = Codepen;
  exports.Codesandbox = Codesandbox;
  exports.CodesandboxIcon = Codesandbox;
  exports.Coffee = Coffee;
  exports.CoffeeIcon = Coffee;
  exports.Cog = Cog;
  exports.CogIcon = Cog;
  exports.Coins = Coins;
  exports.CoinsIcon = Coins;
  exports.Columns = Columns2;
  exports.Columns2 = Columns2;
  exports.Columns2Icon = Columns2;
  exports.Columns3 = Columns3;
  exports.Columns3Cog = Columns3Cog;
  exports.Columns3CogIcon = Columns3Cog;
  exports.Columns3Icon = Columns3;
  exports.Columns4 = Columns4;
  exports.Columns4Icon = Columns4;
  exports.ColumnsIcon = Columns2;
  exports.ColumnsSettings = Columns3Cog;
  exports.ColumnsSettingsIcon = Columns3Cog;
  exports.Combine = Combine;
  exports.CombineIcon = Combine;
  exports.Command = Command;
  exports.CommandIcon = Command;
  exports.Compass = Compass;
  exports.CompassIcon = Compass;
  exports.Component = Component;
  exports.ComponentIcon = Component;
  exports.Computer = Computer;
  exports.ComputerIcon = Computer;
  exports.ConciergeBell = ConciergeBell;
  exports.ConciergeBellIcon = ConciergeBell;
  exports.Cone = Cone;
  exports.ConeIcon = Cone;
  exports.Construction = Construction;
  exports.ConstructionIcon = Construction;
  exports.Contact = Contact;
  exports.Contact2 = ContactRound;
  exports.Contact2Icon = ContactRound;
  exports.ContactIcon = Contact;
  exports.ContactRound = ContactRound;
  exports.ContactRoundIcon = ContactRound;
  exports.Container = Container;
  exports.ContainerIcon = Container;
  exports.Contrast = Contrast;
  exports.ContrastIcon = Contrast;
  exports.Cookie = Cookie;
  exports.CookieIcon = Cookie;
  exports.CookingPot = CookingPot;
  exports.CookingPotIcon = CookingPot;
  exports.Copy = Copy;
  exports.CopyCheck = CopyCheck;
  exports.CopyCheckIcon = CopyCheck;
  exports.CopyIcon = Copy;
  exports.CopyMinus = CopyMinus;
  exports.CopyMinusIcon = CopyMinus;
  exports.CopyPlus = CopyPlus;
  exports.CopyPlusIcon = CopyPlus;
  exports.CopySlash = CopySlash;
  exports.CopySlashIcon = CopySlash;
  exports.CopyX = CopyX;
  exports.CopyXIcon = CopyX;
  exports.Copyleft = Copyleft;
  exports.CopyleftIcon = Copyleft;
  exports.Copyright = Copyright;
  exports.CopyrightIcon = Copyright;
  exports.CornerDownLeft = CornerDownLeft;
  exports.CornerDownLeftIcon = CornerDownLeft;
  exports.CornerDownRight = CornerDownRight;
  exports.CornerDownRightIcon = CornerDownRight;
  exports.CornerLeftDown = CornerLeftDown;
  exports.CornerLeftDownIcon = CornerLeftDown;
  exports.CornerLeftUp = CornerLeftUp;
  exports.CornerLeftUpIcon = CornerLeftUp;
  exports.CornerRightDown = CornerRightDown;
  exports.CornerRightDownIcon = CornerRightDown;
  exports.CornerRightUp = CornerRightUp;
  exports.CornerRightUpIcon = CornerRightUp;
  exports.CornerUpLeft = CornerUpLeft;
  exports.CornerUpLeftIcon = CornerUpLeft;
  exports.CornerUpRight = CornerUpRight;
  exports.CornerUpRightIcon = CornerUpRight;
  exports.Cpu = Cpu;
  exports.CpuIcon = Cpu;
  exports.CreativeCommons = CreativeCommons;
  exports.CreativeCommonsIcon = CreativeCommons;
  exports.CreditCard = CreditCard;
  exports.CreditCardIcon = CreditCard;
  exports.Croissant = Croissant;
  exports.CroissantIcon = Croissant;
  exports.Crop = Crop;
  exports.CropIcon = Crop;
  exports.Cross = Cross;
  exports.CrossIcon = Cross;
  exports.Crosshair = Crosshair;
  exports.CrosshairIcon = Crosshair;
  exports.Crown = Crown;
  exports.CrownIcon = Crown;
  exports.Cuboid = Cuboid;
  exports.CuboidIcon = Cuboid;
  exports.CupSoda = CupSoda;
  exports.CupSodaIcon = CupSoda;
  exports.CurlyBraces = Braces;
  exports.CurlyBracesIcon = Braces;
  exports.Currency = Currency;
  exports.CurrencyIcon = Currency;
  exports.Cylinder = Cylinder;
  exports.CylinderIcon = Cylinder;
  exports.Dam = Dam;
  exports.DamIcon = Dam;
  exports.Database = Database;
  exports.DatabaseBackup = DatabaseBackup;
  exports.DatabaseBackupIcon = DatabaseBackup;
  exports.DatabaseIcon = Database;
  exports.DatabaseZap = DatabaseZap;
  exports.DatabaseZapIcon = DatabaseZap;
  exports.DecimalsArrowLeft = DecimalsArrowLeft;
  exports.DecimalsArrowLeftIcon = DecimalsArrowLeft;
  exports.DecimalsArrowRight = DecimalsArrowRight;
  exports.DecimalsArrowRightIcon = DecimalsArrowRight;
  exports.Delete = Delete;
  exports.DeleteIcon = Delete;
  exports.Dessert = Dessert;
  exports.DessertIcon = Dessert;
  exports.Diameter = Diameter;
  exports.DiameterIcon = Diameter;
  exports.Diamond = Diamond;
  exports.DiamondIcon = Diamond;
  exports.DiamondMinus = DiamondMinus;
  exports.DiamondMinusIcon = DiamondMinus;
  exports.DiamondPercent = DiamondPercent;
  exports.DiamondPercentIcon = DiamondPercent;
  exports.DiamondPlus = DiamondPlus;
  exports.DiamondPlusIcon = DiamondPlus;
  exports.Dice1 = Dice1;
  exports.Dice1Icon = Dice1;
  exports.Dice2 = Dice2;
  exports.Dice2Icon = Dice2;
  exports.Dice3 = Dice3;
  exports.Dice3Icon = Dice3;
  exports.Dice4 = Dice4;
  exports.Dice4Icon = Dice4;
  exports.Dice5 = Dice5;
  exports.Dice5Icon = Dice5;
  exports.Dice6 = Dice6;
  exports.Dice6Icon = Dice6;
  exports.Dices = Dices;
  exports.DicesIcon = Dices;
  exports.Diff = Diff;
  exports.DiffIcon = Diff;
  exports.Disc = Disc;
  exports.Disc2 = Disc2;
  exports.Disc2Icon = Disc2;
  exports.Disc3 = Disc3;
  exports.Disc3Icon = Disc3;
  exports.DiscAlbum = DiscAlbum;
  exports.DiscAlbumIcon = DiscAlbum;
  exports.DiscIcon = Disc;
  exports.Divide = Divide;
  exports.DivideCircle = CircleDivide;
  exports.DivideCircleIcon = CircleDivide;
  exports.DivideIcon = Divide;
  exports.DivideSquare = SquareDivide;
  exports.DivideSquareIcon = SquareDivide;
  exports.Dna = Dna;
  exports.DnaIcon = Dna;
  exports.DnaOff = DnaOff;
  exports.DnaOffIcon = DnaOff;
  exports.Dock = Dock;
  exports.DockIcon = Dock;
  exports.Dog = Dog;
  exports.DogIcon = Dog;
  exports.DollarSign = DollarSign;
  exports.DollarSignIcon = DollarSign;
  exports.Donut = Donut;
  exports.DonutIcon = Donut;
  exports.DoorClosed = DoorClosed;
  exports.DoorClosedIcon = DoorClosed;
  exports.DoorClosedLocked = DoorClosedLocked;
  exports.DoorClosedLockedIcon = DoorClosedLocked;
  exports.DoorOpen = DoorOpen;
  exports.DoorOpenIcon = DoorOpen;
  exports.Dot = Dot;
  exports.DotIcon = Dot;
  exports.DotSquare = SquareDot;
  exports.DotSquareIcon = SquareDot;
  exports.Download = Download;
  exports.DownloadCloud = CloudDownload;
  exports.DownloadCloudIcon = CloudDownload;
  exports.DownloadIcon = Download;
  exports.DraftingCompass = DraftingCompass;
  exports.DraftingCompassIcon = DraftingCompass;
  exports.Drama = Drama;
  exports.DramaIcon = Drama;
  exports.Dribbble = Dribbble;
  exports.DribbbleIcon = Dribbble;
  exports.Drill = Drill;
  exports.DrillIcon = Drill;
  exports.Drone = Drone;
  exports.DroneIcon = Drone;
  exports.Droplet = Droplet;
  exports.DropletIcon = Droplet;
  exports.DropletOff = DropletOff;
  exports.DropletOffIcon = DropletOff;
  exports.Droplets = Droplets;
  exports.DropletsIcon = Droplets;
  exports.Drum = Drum;
  exports.DrumIcon = Drum;
  exports.Drumstick = Drumstick;
  exports.DrumstickIcon = Drumstick;
  exports.Dumbbell = Dumbbell;
  exports.DumbbellIcon = Dumbbell;
  exports.Ear = Ear;
  exports.EarIcon = Ear;
  exports.EarOff = EarOff;
  exports.EarOffIcon = EarOff;
  exports.Earth = Earth;
  exports.EarthIcon = Earth;
  exports.EarthLock = EarthLock;
  exports.EarthLockIcon = EarthLock;
  exports.Eclipse = Eclipse;
  exports.EclipseIcon = Eclipse;
  exports.Edit = SquarePen;
  exports.Edit2 = Pen;
  exports.Edit2Icon = Pen;
  exports.Edit3 = PenLine;
  exports.Edit3Icon = PenLine;
  exports.EditIcon = SquarePen;
  exports.Egg = Egg;
  exports.EggFried = EggFried;
  exports.EggFriedIcon = EggFried;
  exports.EggIcon = Egg;
  exports.EggOff = EggOff;
  exports.EggOffIcon = EggOff;
  exports.Ellipsis = Ellipsis;
  exports.EllipsisIcon = Ellipsis;
  exports.EllipsisVertical = EllipsisVertical;
  exports.EllipsisVerticalIcon = EllipsisVertical;
  exports.Equal = Equal;
  exports.EqualApproximately = EqualApproximately;
  exports.EqualApproximatelyIcon = EqualApproximately;
  exports.EqualIcon = Equal;
  exports.EqualNot = EqualNot;
  exports.EqualNotIcon = EqualNot;
  exports.EqualSquare = SquareEqual;
  exports.EqualSquareIcon = SquareEqual;
  exports.Eraser = Eraser;
  exports.EraserIcon = Eraser;
  exports.EthernetPort = EthernetPort;
  exports.EthernetPortIcon = EthernetPort;
  exports.Euro = Euro;
  exports.EuroIcon = Euro;
  exports.Expand = Expand;
  exports.ExpandIcon = Expand;
  exports.ExternalLink = ExternalLink;
  exports.ExternalLinkIcon = ExternalLink;
  exports.Eye = Eye;
  exports.EyeClosed = EyeClosed;
  exports.EyeClosedIcon = EyeClosed;
  exports.EyeIcon = Eye;
  exports.EyeOff = EyeOff;
  exports.EyeOffIcon = EyeOff;
  exports.Facebook = Facebook;
  exports.FacebookIcon = Facebook;
  exports.Factory = Factory;
  exports.FactoryIcon = Factory;
  exports.Fan = Fan;
  exports.FanIcon = Fan;
  exports.FastForward = FastForward;
  exports.FastForwardIcon = FastForward;
  exports.Feather = Feather;
  exports.FeatherIcon = Feather;
  exports.Fence = Fence;
  exports.FenceIcon = Fence;
  exports.FerrisWheel = FerrisWheel;
  exports.FerrisWheelIcon = FerrisWheel;
  exports.Figma = Figma;
  exports.FigmaIcon = Figma;
  exports.File = File;
  exports.FileArchive = FileArchive;
  exports.FileArchiveIcon = FileArchive;
  exports.FileAudio = FileAudio;
  exports.FileAudio2 = FileAudio2;
  exports.FileAudio2Icon = FileAudio2;
  exports.FileAudioIcon = FileAudio;
  exports.FileAxis3D = FileAxis3d;
  exports.FileAxis3DIcon = FileAxis3d;
  exports.FileAxis3d = FileAxis3d;
  exports.FileAxis3dIcon = FileAxis3d;
  exports.FileBadge = FileBadge;
  exports.FileBadge2 = FileBadge2;
  exports.FileBadge2Icon = FileBadge2;
  exports.FileBadgeIcon = FileBadge;
  exports.FileBarChart = FileChartColumnIncreasing;
  exports.FileBarChart2 = FileChartColumn;
  exports.FileBarChart2Icon = FileChartColumn;
  exports.FileBarChartIcon = FileChartColumnIncreasing;
  exports.FileBox = FileBox;
  exports.FileBoxIcon = FileBox;
  exports.FileChartColumn = FileChartColumn;
  exports.FileChartColumnIcon = FileChartColumn;
  exports.FileChartColumnIncreasing = FileChartColumnIncreasing;
  exports.FileChartColumnIncreasingIcon = FileChartColumnIncreasing;
  exports.FileChartLine = FileChartLine;
  exports.FileChartLineIcon = FileChartLine;
  exports.FileChartPie = FileChartPie;
  exports.FileChartPieIcon = FileChartPie;
  exports.FileCheck = FileCheck;
  exports.FileCheck2 = FileCheck2;
  exports.FileCheck2Icon = FileCheck2;
  exports.FileCheckIcon = FileCheck;
  exports.FileClock = FileClock;
  exports.FileClockIcon = FileClock;
  exports.FileCode = FileCode;
  exports.FileCode2 = FileCode2;
  exports.FileCode2Icon = FileCode2;
  exports.FileCodeIcon = FileCode;
  exports.FileCog = FileCog;
  exports.FileCog2 = FileCog;
  exports.FileCog2Icon = FileCog;
  exports.FileCogIcon = FileCog;
  exports.FileDiff = FileDiff;
  exports.FileDiffIcon = FileDiff;
  exports.FileDigit = FileDigit;
  exports.FileDigitIcon = FileDigit;
  exports.FileDown = FileDown;
  exports.FileDownIcon = FileDown;
  exports.FileEdit = FilePen;
  exports.FileEditIcon = FilePen;
  exports.FileHeart = FileHeart;
  exports.FileHeartIcon = FileHeart;
  exports.FileIcon = File;
  exports.FileImage = FileImage;
  exports.FileImageIcon = FileImage;
  exports.FileInput = FileInput;
  exports.FileInputIcon = FileInput;
  exports.FileJson = FileJson;
  exports.FileJson2 = FileJson2;
  exports.FileJson2Icon = FileJson2;
  exports.FileJsonIcon = FileJson;
  exports.FileKey = FileKey;
  exports.FileKey2 = FileKey2;
  exports.FileKey2Icon = FileKey2;
  exports.FileKeyIcon = FileKey;
  exports.FileLineChart = FileChartLine;
  exports.FileLineChartIcon = FileChartLine;
  exports.FileLock = FileLock;
  exports.FileLock2 = FileLock2;
  exports.FileLock2Icon = FileLock2;
  exports.FileLockIcon = FileLock;
  exports.FileMinus = FileMinus;
  exports.FileMinus2 = FileMinus2;
  exports.FileMinus2Icon = FileMinus2;
  exports.FileMinusIcon = FileMinus;
  exports.FileMusic = FileMusic;
  exports.FileMusicIcon = FileMusic;
  exports.FileOutput = FileOutput;
  exports.FileOutputIcon = FileOutput;
  exports.FilePen = FilePen;
  exports.FilePenIcon = FilePen;
  exports.FilePenLine = FilePenLine;
  exports.FilePenLineIcon = FilePenLine;
  exports.FilePieChart = FileChartPie;
  exports.FilePieChartIcon = FileChartPie;
  exports.FilePlus = FilePlus;
  exports.FilePlus2 = FilePlus2;
  exports.FilePlus2Icon = FilePlus2;
  exports.FilePlusIcon = FilePlus;
  exports.FileQuestion = FileQuestionMark;
  exports.FileQuestionIcon = FileQuestionMark;
  exports.FileQuestionMark = FileQuestionMark;
  exports.FileQuestionMarkIcon = FileQuestionMark;
  exports.FileScan = FileScan;
  exports.FileScanIcon = FileScan;
  exports.FileSearch = FileSearch;
  exports.FileSearch2 = FileSearch2;
  exports.FileSearch2Icon = FileSearch2;
  exports.FileSearchIcon = FileSearch;
  exports.FileSignature = FilePenLine;
  exports.FileSignatureIcon = FilePenLine;
  exports.FileSliders = FileSliders;
  exports.FileSlidersIcon = FileSliders;
  exports.FileSpreadsheet = FileSpreadsheet;
  exports.FileSpreadsheetIcon = FileSpreadsheet;
  exports.FileStack = FileStack;
  exports.FileStackIcon = FileStack;
  exports.FileSymlink = FileSymlink;
  exports.FileSymlinkIcon = FileSymlink;
  exports.FileTerminal = FileTerminal;
  exports.FileTerminalIcon = FileTerminal;
  exports.FileText = FileText;
  exports.FileTextIcon = FileText;
  exports.FileType = FileType;
  exports.FileType2 = FileType2;
  exports.FileType2Icon = FileType2;
  exports.FileTypeIcon = FileType;
  exports.FileUp = FileUp;
  exports.FileUpIcon = FileUp;
  exports.FileUser = FileUser;
  exports.FileUserIcon = FileUser;
  exports.FileVideo = FileVideo;
  exports.FileVideo2 = FileVideo2;
  exports.FileVideo2Icon = FileVideo2;
  exports.FileVideoIcon = FileVideo;
  exports.FileVolume = FileVolume;
  exports.FileVolume2 = FileVolume2;
  exports.FileVolume2Icon = FileVolume2;
  exports.FileVolumeIcon = FileVolume;
  exports.FileWarning = FileWarning;
  exports.FileWarningIcon = FileWarning;
  exports.FileX = FileX;
  exports.FileX2 = FileX2;
  exports.FileX2Icon = FileX2;
  exports.FileXIcon = FileX;
  exports.Files = Files;
  exports.FilesIcon = Files;
  exports.Film = Film;
  exports.FilmIcon = Film;
  exports.Filter = Funnel;
  exports.FilterIcon = Funnel;
  exports.FilterX = FunnelX;
  exports.FilterXIcon = FunnelX;
  exports.Fingerprint = Fingerprint;
  exports.FingerprintIcon = Fingerprint;
  exports.FireExtinguisher = FireExtinguisher;
  exports.FireExtinguisherIcon = FireExtinguisher;
  exports.Fish = Fish;
  exports.FishIcon = Fish;
  exports.FishOff = FishOff;
  exports.FishOffIcon = FishOff;
  exports.FishSymbol = FishSymbol;
  exports.FishSymbolIcon = FishSymbol;
  exports.Flag = Flag;
  exports.FlagIcon = Flag;
  exports.FlagOff = FlagOff;
  exports.FlagOffIcon = FlagOff;
  exports.FlagTriangleLeft = FlagTriangleLeft;
  exports.FlagTriangleLeftIcon = FlagTriangleLeft;
  exports.FlagTriangleRight = FlagTriangleRight;
  exports.FlagTriangleRightIcon = FlagTriangleRight;
  exports.Flame = Flame;
  exports.FlameIcon = Flame;
  exports.FlameKindling = FlameKindling;
  exports.FlameKindlingIcon = FlameKindling;
  exports.Flashlight = Flashlight;
  exports.FlashlightIcon = Flashlight;
  exports.FlashlightOff = FlashlightOff;
  exports.FlashlightOffIcon = FlashlightOff;
  exports.FlaskConical = FlaskConical;
  exports.FlaskConicalIcon = FlaskConical;
  exports.FlaskConicalOff = FlaskConicalOff;
  exports.FlaskConicalOffIcon = FlaskConicalOff;
  exports.FlaskRound = FlaskRound;
  exports.FlaskRoundIcon = FlaskRound;
  exports.FlipHorizontal = FlipHorizontal;
  exports.FlipHorizontal2 = FlipHorizontal2;
  exports.FlipHorizontal2Icon = FlipHorizontal2;
  exports.FlipHorizontalIcon = FlipHorizontal;
  exports.FlipVertical = FlipVertical;
  exports.FlipVertical2 = FlipVertical2;
  exports.FlipVertical2Icon = FlipVertical2;
  exports.FlipVerticalIcon = FlipVertical;
  exports.Flower = Flower;
  exports.Flower2 = Flower2;
  exports.Flower2Icon = Flower2;
  exports.FlowerIcon = Flower;
  exports.Focus = Focus;
  exports.FocusIcon = Focus;
  exports.FoldHorizontal = FoldHorizontal;
  exports.FoldHorizontalIcon = FoldHorizontal;
  exports.FoldVertical = FoldVertical;
  exports.FoldVerticalIcon = FoldVertical;
  exports.Folder = Folder;
  exports.FolderArchive = FolderArchive;
  exports.FolderArchiveIcon = FolderArchive;
  exports.FolderCheck = FolderCheck;
  exports.FolderCheckIcon = FolderCheck;
  exports.FolderClock = FolderClock;
  exports.FolderClockIcon = FolderClock;
  exports.FolderClosed = FolderClosed;
  exports.FolderClosedIcon = FolderClosed;
  exports.FolderCode = FolderCode;
  exports.FolderCodeIcon = FolderCode;
  exports.FolderCog = FolderCog;
  exports.FolderCog2 = FolderCog;
  exports.FolderCog2Icon = FolderCog;
  exports.FolderCogIcon = FolderCog;
  exports.FolderDot = FolderDot;
  exports.FolderDotIcon = FolderDot;
  exports.FolderDown = FolderDown;
  exports.FolderDownIcon = FolderDown;
  exports.FolderEdit = FolderPen;
  exports.FolderEditIcon = FolderPen;
  exports.FolderGit = FolderGit;
  exports.FolderGit2 = FolderGit2;
  exports.FolderGit2Icon = FolderGit2;
  exports.FolderGitIcon = FolderGit;
  exports.FolderHeart = FolderHeart;
  exports.FolderHeartIcon = FolderHeart;
  exports.FolderIcon = Folder;
  exports.FolderInput = FolderInput;
  exports.FolderInputIcon = FolderInput;
  exports.FolderKanban = FolderKanban;
  exports.FolderKanbanIcon = FolderKanban;
  exports.FolderKey = FolderKey;
  exports.FolderKeyIcon = FolderKey;
  exports.FolderLock = FolderLock;
  exports.FolderLockIcon = FolderLock;
  exports.FolderMinus = FolderMinus;
  exports.FolderMinusIcon = FolderMinus;
  exports.FolderOpen = FolderOpen;
  exports.FolderOpenDot = FolderOpenDot;
  exports.FolderOpenDotIcon = FolderOpenDot;
  exports.FolderOpenIcon = FolderOpen;
  exports.FolderOutput = FolderOutput;
  exports.FolderOutputIcon = FolderOutput;
  exports.FolderPen = FolderPen;
  exports.FolderPenIcon = FolderPen;
  exports.FolderPlus = FolderPlus;
  exports.FolderPlusIcon = FolderPlus;
  exports.FolderRoot = FolderRoot;
  exports.FolderRootIcon = FolderRoot;
  exports.FolderSearch = FolderSearch;
  exports.FolderSearch2 = FolderSearch2;
  exports.FolderSearch2Icon = FolderSearch2;
  exports.FolderSearchIcon = FolderSearch;
  exports.FolderSymlink = FolderSymlink;
  exports.FolderSymlinkIcon = FolderSymlink;
  exports.FolderSync = FolderSync;
  exports.FolderSyncIcon = FolderSync;
  exports.FolderTree = FolderTree;
  exports.FolderTreeIcon = FolderTree;
  exports.FolderUp = FolderUp;
  exports.FolderUpIcon = FolderUp;
  exports.FolderX = FolderX;
  exports.FolderXIcon = FolderX;
  exports.Folders = Folders;
  exports.FoldersIcon = Folders;
  exports.Footprints = Footprints;
  exports.FootprintsIcon = Footprints;
  exports.ForkKnife = Utensils;
  exports.ForkKnifeCrossed = UtensilsCrossed;
  exports.ForkKnifeCrossedIcon = UtensilsCrossed;
  exports.ForkKnifeIcon = Utensils;
  exports.Forklift = Forklift;
  exports.ForkliftIcon = Forklift;
  exports.FormInput = RectangleEllipsis;
  exports.FormInputIcon = RectangleEllipsis;
  exports.Forward = Forward;
  exports.ForwardIcon = Forward;
  exports.Frame = Frame;
  exports.FrameIcon = Frame;
  exports.Framer = Framer;
  exports.FramerIcon = Framer;
  exports.Frown = Frown;
  exports.FrownIcon = Frown;
  exports.Fuel = Fuel;
  exports.FuelIcon = Fuel;
  exports.Fullscreen = Fullscreen;
  exports.FullscreenIcon = Fullscreen;
  exports.FunctionSquare = SquareFunction;
  exports.FunctionSquareIcon = SquareFunction;
  exports.Funnel = Funnel;
  exports.FunnelIcon = Funnel;
  exports.FunnelPlus = FunnelPlus;
  exports.FunnelPlusIcon = FunnelPlus;
  exports.FunnelX = FunnelX;
  exports.FunnelXIcon = FunnelX;
  exports.GalleryHorizontal = GalleryHorizontal;
  exports.GalleryHorizontalEnd = GalleryHorizontalEnd;
  exports.GalleryHorizontalEndIcon = GalleryHorizontalEnd;
  exports.GalleryHorizontalIcon = GalleryHorizontal;
  exports.GalleryThumbnails = GalleryThumbnails;
  exports.GalleryThumbnailsIcon = GalleryThumbnails;
  exports.GalleryVertical = GalleryVertical;
  exports.GalleryVerticalEnd = GalleryVerticalEnd;
  exports.GalleryVerticalEndIcon = GalleryVerticalEnd;
  exports.GalleryVerticalIcon = GalleryVertical;
  exports.Gamepad = Gamepad;
  exports.Gamepad2 = Gamepad2;
  exports.Gamepad2Icon = Gamepad2;
  exports.GamepadIcon = Gamepad;
  exports.GanttChart = ChartNoAxesGantt;
  exports.GanttChartIcon = ChartNoAxesGantt;
  exports.GanttChartSquare = SquareChartGantt;
  exports.GanttChartSquareIcon = SquareChartGantt;
  exports.Gauge = Gauge;
  exports.GaugeCircle = CircleGauge;
  exports.GaugeCircleIcon = CircleGauge;
  exports.GaugeIcon = Gauge;
  exports.Gavel = Gavel;
  exports.GavelIcon = Gavel;
  exports.Gem = Gem;
  exports.GemIcon = Gem;
  exports.GeorgianLari = GeorgianLari;
  exports.GeorgianLariIcon = GeorgianLari;
  exports.Ghost = Ghost;
  exports.GhostIcon = Ghost;
  exports.Gift = Gift;
  exports.GiftIcon = Gift;
  exports.GitBranch = GitBranch;
  exports.GitBranchIcon = GitBranch;
  exports.GitBranchPlus = GitBranchPlus;
  exports.GitBranchPlusIcon = GitBranchPlus;
  exports.GitCommit = GitCommitHorizontal;
  exports.GitCommitHorizontal = GitCommitHorizontal;
  exports.GitCommitHorizontalIcon = GitCommitHorizontal;
  exports.GitCommitIcon = GitCommitHorizontal;
  exports.GitCommitVertical = GitCommitVertical;
  exports.GitCommitVerticalIcon = GitCommitVertical;
  exports.GitCompare = GitCompare;
  exports.GitCompareArrows = GitCompareArrows;
  exports.GitCompareArrowsIcon = GitCompareArrows;
  exports.GitCompareIcon = GitCompare;
  exports.GitFork = GitFork;
  exports.GitForkIcon = GitFork;
  exports.GitGraph = GitGraph;
  exports.GitGraphIcon = GitGraph;
  exports.GitMerge = GitMerge;
  exports.GitMergeIcon = GitMerge;
  exports.GitPullRequest = GitPullRequest;
  exports.GitPullRequestArrow = GitPullRequestArrow;
  exports.GitPullRequestArrowIcon = GitPullRequestArrow;
  exports.GitPullRequestClosed = GitPullRequestClosed;
  exports.GitPullRequestClosedIcon = GitPullRequestClosed;
  exports.GitPullRequestCreate = GitPullRequestCreate;
  exports.GitPullRequestCreateArrow = GitPullRequestCreateArrow;
  exports.GitPullRequestCreateArrowIcon = GitPullRequestCreateArrow;
  exports.GitPullRequestCreateIcon = GitPullRequestCreate;
  exports.GitPullRequestDraft = GitPullRequestDraft;
  exports.GitPullRequestDraftIcon = GitPullRequestDraft;
  exports.GitPullRequestIcon = GitPullRequest;
  exports.Github = Github;
  exports.GithubIcon = Github;
  exports.Gitlab = Gitlab;
  exports.GitlabIcon = Gitlab;
  exports.GlassWater = GlassWater;
  exports.GlassWaterIcon = GlassWater;
  exports.Glasses = Glasses;
  exports.GlassesIcon = Glasses;
  exports.Globe = Globe;
  exports.Globe2 = Earth;
  exports.Globe2Icon = Earth;
  exports.GlobeIcon = Globe;
  exports.GlobeLock = GlobeLock;
  exports.GlobeLockIcon = GlobeLock;
  exports.Goal = Goal;
  exports.GoalIcon = Goal;
  exports.Gpu = Gpu;
  exports.GpuIcon = Gpu;
  exports.Grab = Grab;
  exports.GrabIcon = Grab;
  exports.GraduationCap = GraduationCap;
  exports.GraduationCapIcon = GraduationCap;
  exports.Grape = Grape;
  exports.GrapeIcon = Grape;
  exports.Grid = Grid3x3;
  exports.Grid2X2 = Grid2x2;
  exports.Grid2X2Check = Grid2x2Check;
  exports.Grid2X2CheckIcon = Grid2x2Check;
  exports.Grid2X2Icon = Grid2x2;
  exports.Grid2X2Plus = Grid2x2Plus;
  exports.Grid2X2PlusIcon = Grid2x2Plus;
  exports.Grid2X2X = Grid2x2X;
  exports.Grid2X2XIcon = Grid2x2X;
  exports.Grid2x2 = Grid2x2;
  exports.Grid2x2Check = Grid2x2Check;
  exports.Grid2x2CheckIcon = Grid2x2Check;
  exports.Grid2x2Icon = Grid2x2;
  exports.Grid2x2Plus = Grid2x2Plus;
  exports.Grid2x2PlusIcon = Grid2x2Plus;
  exports.Grid2x2X = Grid2x2X;
  exports.Grid2x2XIcon = Grid2x2X;
  exports.Grid3X3 = Grid3x3;
  exports.Grid3X3Icon = Grid3x3;
  exports.Grid3x2 = Grid3x2;
  exports.Grid3x2Icon = Grid3x2;
  exports.Grid3x3 = Grid3x3;
  exports.Grid3x3Icon = Grid3x3;
  exports.GridIcon = Grid3x3;
  exports.Grip = Grip;
  exports.GripHorizontal = GripHorizontal;
  exports.GripHorizontalIcon = GripHorizontal;
  exports.GripIcon = Grip;
  exports.GripVertical = GripVertical;
  exports.GripVerticalIcon = GripVertical;
  exports.Group = Group;
  exports.GroupIcon = Group;
  exports.Guitar = Guitar;
  exports.GuitarIcon = Guitar;
  exports.Ham = Ham;
  exports.HamIcon = Ham;
  exports.Hamburger = Hamburger;
  exports.HamburgerIcon = Hamburger;
  exports.Hammer = Hammer;
  exports.HammerIcon = Hammer;
  exports.Hand = Hand;
  exports.HandCoins = HandCoins;
  exports.HandCoinsIcon = HandCoins;
  exports.HandHeart = HandHeart;
  exports.HandHeartIcon = HandHeart;
  exports.HandHelping = HandHelping;
  exports.HandHelpingIcon = HandHelping;
  exports.HandIcon = Hand;
  exports.HandMetal = HandMetal;
  exports.HandMetalIcon = HandMetal;
  exports.HandPlatter = HandPlatter;
  exports.HandPlatterIcon = HandPlatter;
  exports.Handshake = Handshake;
  exports.HandshakeIcon = Handshake;
  exports.HardDrive = HardDrive;
  exports.HardDriveDownload = HardDriveDownload;
  exports.HardDriveDownloadIcon = HardDriveDownload;
  exports.HardDriveIcon = HardDrive;
  exports.HardDriveUpload = HardDriveUpload;
  exports.HardDriveUploadIcon = HardDriveUpload;
  exports.HardHat = HardHat;
  exports.HardHatIcon = HardHat;
  exports.Hash = Hash;
  exports.HashIcon = Hash;
  exports.Haze = Haze;
  exports.HazeIcon = Haze;
  exports.HdmiPort = HdmiPort;
  exports.HdmiPortIcon = HdmiPort;
  exports.Heading = Heading;
  exports.Heading1 = Heading1;
  exports.Heading1Icon = Heading1;
  exports.Heading2 = Heading2;
  exports.Heading2Icon = Heading2;
  exports.Heading3 = Heading3;
  exports.Heading3Icon = Heading3;
  exports.Heading4 = Heading4;
  exports.Heading4Icon = Heading4;
  exports.Heading5 = Heading5;
  exports.Heading5Icon = Heading5;
  exports.Heading6 = Heading6;
  exports.Heading6Icon = Heading6;
  exports.HeadingIcon = Heading;
  exports.HeadphoneOff = HeadphoneOff;
  exports.HeadphoneOffIcon = HeadphoneOff;
  exports.Headphones = Headphones;
  exports.HeadphonesIcon = Headphones;
  exports.Headset = Headset;
  exports.HeadsetIcon = Headset;
  exports.Heart = Heart;
  exports.HeartCrack = HeartCrack;
  exports.HeartCrackIcon = HeartCrack;
  exports.HeartHandshake = HeartHandshake;
  exports.HeartHandshakeIcon = HeartHandshake;
  exports.HeartIcon = Heart;
  exports.HeartMinus = HeartMinus;
  exports.HeartMinusIcon = HeartMinus;
  exports.HeartOff = HeartOff;
  exports.HeartOffIcon = HeartOff;
  exports.HeartPlus = HeartPlus;
  exports.HeartPlusIcon = HeartPlus;
  exports.HeartPulse = HeartPulse;
  exports.HeartPulseIcon = HeartPulse;
  exports.Heater = Heater;
  exports.HeaterIcon = Heater;
  exports.HelpCircle = CircleQuestionMark;
  exports.HelpCircleIcon = CircleQuestionMark;
  exports.HelpingHand = HandHelping;
  exports.HelpingHandIcon = HandHelping;
  exports.Hexagon = Hexagon;
  exports.HexagonIcon = Hexagon;
  exports.Highlighter = Highlighter;
  exports.HighlighterIcon = Highlighter;
  exports.History = History;
  exports.HistoryIcon = History;
  exports.Home = House;
  exports.HomeIcon = House;
  exports.Hop = Hop;
  exports.HopIcon = Hop;
  exports.HopOff = HopOff;
  exports.HopOffIcon = HopOff;
  exports.Hospital = Hospital;
  exports.HospitalIcon = Hospital;
  exports.Hotel = Hotel;
  exports.HotelIcon = Hotel;
  exports.Hourglass = Hourglass;
  exports.HourglassIcon = Hourglass;
  exports.House = House;
  exports.HouseIcon = House;
  exports.HousePlug = HousePlug;
  exports.HousePlugIcon = HousePlug;
  exports.HousePlus = HousePlus;
  exports.HousePlusIcon = HousePlus;
  exports.HouseWifi = HouseWifi;
  exports.HouseWifiIcon = HouseWifi;
  exports.IceCream = IceCreamCone;
  exports.IceCream2 = IceCreamBowl;
  exports.IceCream2Icon = IceCreamBowl;
  exports.IceCreamBowl = IceCreamBowl;
  exports.IceCreamBowlIcon = IceCreamBowl;
  exports.IceCreamCone = IceCreamCone;
  exports.IceCreamConeIcon = IceCreamCone;
  exports.IceCreamIcon = IceCreamCone;
  exports.Icon = Icon;
  exports.IdCard = IdCard;
  exports.IdCardIcon = IdCard;
  exports.IdCardLanyard = IdCardLanyard;
  exports.IdCardLanyardIcon = IdCardLanyard;
  exports.Image = Image;
  exports.ImageDown = ImageDown;
  exports.ImageDownIcon = ImageDown;
  exports.ImageIcon = Image;
  exports.ImageMinus = ImageMinus;
  exports.ImageMinusIcon = ImageMinus;
  exports.ImageOff = ImageOff;
  exports.ImageOffIcon = ImageOff;
  exports.ImagePlay = ImagePlay;
  exports.ImagePlayIcon = ImagePlay;
  exports.ImagePlus = ImagePlus;
  exports.ImagePlusIcon = ImagePlus;
  exports.ImageUp = ImageUp;
  exports.ImageUpIcon = ImageUp;
  exports.ImageUpscale = ImageUpscale;
  exports.ImageUpscaleIcon = ImageUpscale;
  exports.Images = Images;
  exports.ImagesIcon = Images;
  exports.Import = Import;
  exports.ImportIcon = Import;
  exports.Inbox = Inbox;
  exports.InboxIcon = Inbox;
  exports.Indent = IndentIncrease;
  exports.IndentDecrease = IndentDecrease;
  exports.IndentDecreaseIcon = IndentDecrease;
  exports.IndentIcon = IndentIncrease;
  exports.IndentIncrease = IndentIncrease;
  exports.IndentIncreaseIcon = IndentIncrease;
  exports.IndianRupee = IndianRupee;
  exports.IndianRupeeIcon = IndianRupee;
  exports.Infinity = Infinity;
  exports.InfinityIcon = Infinity;
  exports.Info = Info;
  exports.InfoIcon = Info;
  exports.Inspect = SquareMousePointer;
  exports.InspectIcon = SquareMousePointer;
  exports.InspectionPanel = InspectionPanel;
  exports.InspectionPanelIcon = InspectionPanel;
  exports.Instagram = Instagram;
  exports.InstagramIcon = Instagram;
  exports.Italic = Italic;
  exports.ItalicIcon = Italic;
  exports.IterationCcw = IterationCcw;
  exports.IterationCcwIcon = IterationCcw;
  exports.IterationCw = IterationCw;
  exports.IterationCwIcon = IterationCw;
  exports.JapaneseYen = JapaneseYen;
  exports.JapaneseYenIcon = JapaneseYen;
  exports.Joystick = Joystick;
  exports.JoystickIcon = Joystick;
  exports.Kanban = Kanban;
  exports.KanbanIcon = Kanban;
  exports.KanbanSquare = SquareKanban;
  exports.KanbanSquareDashed = SquareDashedKanban;
  exports.KanbanSquareDashedIcon = SquareDashedKanban;
  exports.KanbanSquareIcon = SquareKanban;
  exports.Key = Key;
  exports.KeyIcon = Key;
  exports.KeyRound = KeyRound;
  exports.KeyRoundIcon = KeyRound;
  exports.KeySquare = KeySquare;
  exports.KeySquareIcon = KeySquare;
  exports.Keyboard = Keyboard;
  exports.KeyboardIcon = Keyboard;
  exports.KeyboardMusic = KeyboardMusic;
  exports.KeyboardMusicIcon = KeyboardMusic;
  exports.KeyboardOff = KeyboardOff;
  exports.KeyboardOffIcon = KeyboardOff;
  exports.Lamp = Lamp;
  exports.LampCeiling = LampCeiling;
  exports.LampCeilingIcon = LampCeiling;
  exports.LampDesk = LampDesk;
  exports.LampDeskIcon = LampDesk;
  exports.LampFloor = LampFloor;
  exports.LampFloorIcon = LampFloor;
  exports.LampIcon = Lamp;
  exports.LampWallDown = LampWallDown;
  exports.LampWallDownIcon = LampWallDown;
  exports.LampWallUp = LampWallUp;
  exports.LampWallUpIcon = LampWallUp;
  exports.LandPlot = LandPlot;
  exports.LandPlotIcon = LandPlot;
  exports.Landmark = Landmark;
  exports.LandmarkIcon = Landmark;
  exports.Languages = Languages;
  exports.LanguagesIcon = Languages;
  exports.Laptop = Laptop;
  exports.Laptop2 = LaptopMinimal;
  exports.Laptop2Icon = LaptopMinimal;
  exports.LaptopIcon = Laptop;
  exports.LaptopMinimal = LaptopMinimal;
  exports.LaptopMinimalCheck = LaptopMinimalCheck;
  exports.LaptopMinimalCheckIcon = LaptopMinimalCheck;
  exports.LaptopMinimalIcon = LaptopMinimal;
  exports.Lasso = Lasso;
  exports.LassoIcon = Lasso;
  exports.LassoSelect = LassoSelect;
  exports.LassoSelectIcon = LassoSelect;
  exports.Laugh = Laugh;
  exports.LaughIcon = Laugh;
  exports.Layers = Layers;
  exports.Layers2 = Layers2;
  exports.Layers2Icon = Layers2;
  exports.Layers3 = Layers;
  exports.Layers3Icon = Layers;
  exports.LayersIcon = Layers;
  exports.Layout = PanelsTopLeft;
  exports.LayoutDashboard = LayoutDashboard;
  exports.LayoutDashboardIcon = LayoutDashboard;
  exports.LayoutGrid = LayoutGrid;
  exports.LayoutGridIcon = LayoutGrid;
  exports.LayoutIcon = PanelsTopLeft;
  exports.LayoutList = LayoutList;
  exports.LayoutListIcon = LayoutList;
  exports.LayoutPanelLeft = LayoutPanelLeft;
  exports.LayoutPanelLeftIcon = LayoutPanelLeft;
  exports.LayoutPanelTop = LayoutPanelTop;
  exports.LayoutPanelTopIcon = LayoutPanelTop;
  exports.LayoutTemplate = LayoutTemplate;
  exports.LayoutTemplateIcon = LayoutTemplate;
  exports.Leaf = Leaf;
  exports.LeafIcon = Leaf;
  exports.LeafyGreen = LeafyGreen;
  exports.LeafyGreenIcon = LeafyGreen;
  exports.Lectern = Lectern;
  exports.LecternIcon = Lectern;
  exports.LetterText = LetterText;
  exports.LetterTextIcon = LetterText;
  exports.Library = Library;
  exports.LibraryBig = LibraryBig;
  exports.LibraryBigIcon = LibraryBig;
  exports.LibraryIcon = Library;
  exports.LibrarySquare = SquareLibrary;
  exports.LibrarySquareIcon = SquareLibrary;
  exports.LifeBuoy = LifeBuoy;
  exports.LifeBuoyIcon = LifeBuoy;
  exports.Ligature = Ligature;
  exports.LigatureIcon = Ligature;
  exports.Lightbulb = Lightbulb;
  exports.LightbulbIcon = Lightbulb;
  exports.LightbulbOff = LightbulbOff;
  exports.LightbulbOffIcon = LightbulbOff;
  exports.LineChart = ChartLine;
  exports.LineChartIcon = ChartLine;
  exports.LineSquiggle = LineSquiggle;
  exports.LineSquiggleIcon = LineSquiggle;
  exports.Link = Link;
  exports.Link2 = Link2;
  exports.Link2Icon = Link2;
  exports.Link2Off = Link2Off;
  exports.Link2OffIcon = Link2Off;
  exports.LinkIcon = Link;
  exports.Linkedin = Linkedin;
  exports.LinkedinIcon = Linkedin;
  exports.List = List;
  exports.ListCheck = ListCheck;
  exports.ListCheckIcon = ListCheck;
  exports.ListChecks = ListChecks;
  exports.ListChecksIcon = ListChecks;
  exports.ListCollapse = ListCollapse;
  exports.ListCollapseIcon = ListCollapse;
  exports.ListEnd = ListEnd;
  exports.ListEndIcon = ListEnd;
  exports.ListFilter = ListFilter;
  exports.ListFilterIcon = ListFilter;
  exports.ListFilterPlus = ListFilterPlus;
  exports.ListFilterPlusIcon = ListFilterPlus;
  exports.ListIcon = List;
  exports.ListMinus = ListMinus;
  exports.ListMinusIcon = ListMinus;
  exports.ListMusic = ListMusic;
  exports.ListMusicIcon = ListMusic;
  exports.ListOrdered = ListOrdered;
  exports.ListOrderedIcon = ListOrdered;
  exports.ListPlus = ListPlus;
  exports.ListPlusIcon = ListPlus;
  exports.ListRestart = ListRestart;
  exports.ListRestartIcon = ListRestart;
  exports.ListStart = ListStart;
  exports.ListStartIcon = ListStart;
  exports.ListTodo = ListTodo;
  exports.ListTodoIcon = ListTodo;
  exports.ListTree = ListTree;
  exports.ListTreeIcon = ListTree;
  exports.ListVideo = ListVideo;
  exports.ListVideoIcon = ListVideo;
  exports.ListX = ListX;
  exports.ListXIcon = ListX;
  exports.Loader = Loader;
  exports.Loader2 = LoaderCircle;
  exports.Loader2Icon = LoaderCircle;
  exports.LoaderCircle = LoaderCircle;
  exports.LoaderCircleIcon = LoaderCircle;
  exports.LoaderIcon = Loader;
  exports.LoaderPinwheel = LoaderPinwheel;
  exports.LoaderPinwheelIcon = LoaderPinwheel;
  exports.Locate = Locate;
  exports.LocateFixed = LocateFixed;
  exports.LocateFixedIcon = LocateFixed;
  exports.LocateIcon = Locate;
  exports.LocateOff = LocateOff;
  exports.LocateOffIcon = LocateOff;
  exports.LocationEdit = LocationEdit;
  exports.LocationEditIcon = LocationEdit;
  exports.Lock = Lock;
  exports.LockIcon = Lock;
  exports.LockKeyhole = LockKeyhole;
  exports.LockKeyholeIcon = LockKeyhole;
  exports.LockKeyholeOpen = LockKeyholeOpen;
  exports.LockKeyholeOpenIcon = LockKeyholeOpen;
  exports.LockOpen = LockOpen;
  exports.LockOpenIcon = LockOpen;
  exports.LogIn = LogIn;
  exports.LogInIcon = LogIn;
  exports.LogOut = LogOut;
  exports.LogOutIcon = LogOut;
  exports.Logs = Logs;
  exports.LogsIcon = Logs;
  exports.Lollipop = Lollipop;
  exports.LollipopIcon = Lollipop;
  exports.LucideAArrowDown = AArrowDown;
  exports.LucideAArrowUp = AArrowUp;
  exports.LucideALargeSmall = ALargeSmall;
  exports.LucideAccessibility = Accessibility;
  exports.LucideActivity = Activity;
  exports.LucideActivitySquare = SquareActivity;
  exports.LucideAirVent = AirVent;
  exports.LucideAirplay = Airplay;
  exports.LucideAlarmCheck = AlarmClockCheck;
  exports.LucideAlarmClock = AlarmClock;
  exports.LucideAlarmClockCheck = AlarmClockCheck;
  exports.LucideAlarmClockMinus = AlarmClockMinus;
  exports.LucideAlarmClockOff = AlarmClockOff;
  exports.LucideAlarmClockPlus = AlarmClockPlus;
  exports.LucideAlarmMinus = AlarmClockMinus;
  exports.LucideAlarmPlus = AlarmClockPlus;
  exports.LucideAlarmSmoke = AlarmSmoke;
  exports.LucideAlbum = Album;
  exports.LucideAlertCircle = CircleAlert;
  exports.LucideAlertOctagon = OctagonAlert;
  exports.LucideAlertTriangle = TriangleAlert;
  exports.LucideAlignCenter = AlignCenter;
  exports.LucideAlignCenterHorizontal = AlignCenterHorizontal;
  exports.LucideAlignCenterVertical = AlignCenterVertical;
  exports.LucideAlignEndHorizontal = AlignEndHorizontal;
  exports.LucideAlignEndVertical = AlignEndVertical;
  exports.LucideAlignHorizontalDistributeCenter = AlignHorizontalDistributeCenter;
  exports.LucideAlignHorizontalDistributeEnd = AlignHorizontalDistributeEnd;
  exports.LucideAlignHorizontalDistributeStart = AlignHorizontalDistributeStart;
  exports.LucideAlignHorizontalJustifyCenter = AlignHorizontalJustifyCenter;
  exports.LucideAlignHorizontalJustifyEnd = AlignHorizontalJustifyEnd;
  exports.LucideAlignHorizontalJustifyStart = AlignHorizontalJustifyStart;
  exports.LucideAlignHorizontalSpaceAround = AlignHorizontalSpaceAround;
  exports.LucideAlignHorizontalSpaceBetween = AlignHorizontalSpaceBetween;
  exports.LucideAlignJustify = AlignJustify;
  exports.LucideAlignLeft = AlignLeft;
  exports.LucideAlignRight = AlignRight;
  exports.LucideAlignStartHorizontal = AlignStartHorizontal;
  exports.LucideAlignStartVertical = AlignStartVertical;
  exports.LucideAlignVerticalDistributeCenter = AlignVerticalDistributeCenter;
  exports.LucideAlignVerticalDistributeEnd = AlignVerticalDistributeEnd;
  exports.LucideAlignVerticalDistributeStart = AlignVerticalDistributeStart;
  exports.LucideAlignVerticalJustifyCenter = AlignVerticalJustifyCenter;
  exports.LucideAlignVerticalJustifyEnd = AlignVerticalJustifyEnd;
  exports.LucideAlignVerticalJustifyStart = AlignVerticalJustifyStart;
  exports.LucideAlignVerticalSpaceAround = AlignVerticalSpaceAround;
  exports.LucideAlignVerticalSpaceBetween = AlignVerticalSpaceBetween;
  exports.LucideAmbulance = Ambulance;
  exports.LucideAmpersand = Ampersand;
  exports.LucideAmpersands = Ampersands;
  exports.LucideAmphora = Amphora;
  exports.LucideAnchor = Anchor;
  exports.LucideAngry = Angry;
  exports.LucideAnnoyed = Annoyed;
  exports.LucideAntenna = Antenna;
  exports.LucideAnvil = Anvil;
  exports.LucideAperture = Aperture;
  exports.LucideAppWindow = AppWindow;
  exports.LucideAppWindowMac = AppWindowMac;
  exports.LucideApple = Apple;
  exports.LucideArchive = Archive;
  exports.LucideArchiveRestore = ArchiveRestore;
  exports.LucideArchiveX = ArchiveX;
  exports.LucideAreaChart = ChartArea;
  exports.LucideArmchair = Armchair;
  exports.LucideArrowBigDown = ArrowBigDown;
  exports.LucideArrowBigDownDash = ArrowBigDownDash;
  exports.LucideArrowBigLeft = ArrowBigLeft;
  exports.LucideArrowBigLeftDash = ArrowBigLeftDash;
  exports.LucideArrowBigRight = ArrowBigRight;
  exports.LucideArrowBigRightDash = ArrowBigRightDash;
  exports.LucideArrowBigUp = ArrowBigUp;
  exports.LucideArrowBigUpDash = ArrowBigUpDash;
  exports.LucideArrowDown = ArrowDown;
  exports.LucideArrowDown01 = ArrowDown01;
  exports.LucideArrowDown10 = ArrowDown10;
  exports.LucideArrowDownAZ = ArrowDownAZ;
  exports.LucideArrowDownAz = ArrowDownAZ;
  exports.LucideArrowDownCircle = CircleArrowDown;
  exports.LucideArrowDownFromLine = ArrowDownFromLine;
  exports.LucideArrowDownLeft = ArrowDownLeft;
  exports.LucideArrowDownLeftFromCircle = CircleArrowOutDownLeft;
  exports.LucideArrowDownLeftFromSquare = SquareArrowOutDownLeft;
  exports.LucideArrowDownLeftSquare = SquareArrowDownLeft;
  exports.LucideArrowDownNarrowWide = ArrowDownNarrowWide;
  exports.LucideArrowDownRight = ArrowDownRight;
  exports.LucideArrowDownRightFromCircle = CircleArrowOutDownRight;
  exports.LucideArrowDownRightFromSquare = SquareArrowOutDownRight;
  exports.LucideArrowDownRightSquare = SquareArrowDownRight;
  exports.LucideArrowDownSquare = SquareArrowDown;
  exports.LucideArrowDownToDot = ArrowDownToDot;
  exports.LucideArrowDownToLine = ArrowDownToLine;
  exports.LucideArrowDownUp = ArrowDownUp;
  exports.LucideArrowDownWideNarrow = ArrowDownWideNarrow;
  exports.LucideArrowDownZA = ArrowDownZA;
  exports.LucideArrowDownZa = ArrowDownZA;
  exports.LucideArrowLeft = ArrowLeft;
  exports.LucideArrowLeftCircle = CircleArrowLeft;
  exports.LucideArrowLeftFromLine = ArrowLeftFromLine;
  exports.LucideArrowLeftRight = ArrowLeftRight;
  exports.LucideArrowLeftSquare = SquareArrowLeft;
  exports.LucideArrowLeftToLine = ArrowLeftToLine;
  exports.LucideArrowRight = ArrowRight;
  exports.LucideArrowRightCircle = CircleArrowRight;
  exports.LucideArrowRightFromLine = ArrowRightFromLine;
  exports.LucideArrowRightLeft = ArrowRightLeft;
  exports.LucideArrowRightSquare = SquareArrowRight;
  exports.LucideArrowRightToLine = ArrowRightToLine;
  exports.LucideArrowUp = ArrowUp;
  exports.LucideArrowUp01 = ArrowUp01;
  exports.LucideArrowUp10 = ArrowUp10;
  exports.LucideArrowUpAZ = ArrowUpAZ;
  exports.LucideArrowUpAz = ArrowUpAZ;
  exports.LucideArrowUpCircle = CircleArrowUp;
  exports.LucideArrowUpDown = ArrowUpDown;
  exports.LucideArrowUpFromDot = ArrowUpFromDot;
  exports.LucideArrowUpFromLine = ArrowUpFromLine;
  exports.LucideArrowUpLeft = ArrowUpLeft;
  exports.LucideArrowUpLeftFromCircle = CircleArrowOutUpLeft;
  exports.LucideArrowUpLeftFromSquare = SquareArrowOutUpLeft;
  exports.LucideArrowUpLeftSquare = SquareArrowUpLeft;
  exports.LucideArrowUpNarrowWide = ArrowUpNarrowWide;
  exports.LucideArrowUpRight = ArrowUpRight;
  exports.LucideArrowUpRightFromCircle = CircleArrowOutUpRight;
  exports.LucideArrowUpRightFromSquare = SquareArrowOutUpRight;
  exports.LucideArrowUpRightSquare = SquareArrowUpRight;
  exports.LucideArrowUpSquare = SquareArrowUp;
  exports.LucideArrowUpToLine = ArrowUpToLine;
  exports.LucideArrowUpWideNarrow = ArrowUpWideNarrow;
  exports.LucideArrowUpZA = ArrowUpZA;
  exports.LucideArrowUpZa = ArrowUpZA;
  exports.LucideArrowsUpFromLine = ArrowsUpFromLine;
  exports.LucideAsterisk = Asterisk;
  exports.LucideAsteriskSquare = SquareAsterisk;
  exports.LucideAtSign = AtSign;
  exports.LucideAtom = Atom;
  exports.LucideAudioLines = AudioLines;
  exports.LucideAudioWaveform = AudioWaveform;
  exports.LucideAward = Award;
  exports.LucideAxe = Axe;
  exports.LucideAxis3D = Axis3d;
  exports.LucideAxis3d = Axis3d;
  exports.LucideBaby = Baby;
  exports.LucideBackpack = Backpack;
  exports.LucideBadge = Badge;
  exports.LucideBadgeAlert = BadgeAlert;
  exports.LucideBadgeCent = BadgeCent;
  exports.LucideBadgeCheck = BadgeCheck;
  exports.LucideBadgeDollarSign = BadgeDollarSign;
  exports.LucideBadgeEuro = BadgeEuro;
  exports.LucideBadgeHelp = BadgeQuestionMark;
  exports.LucideBadgeIndianRupee = BadgeIndianRupee;
  exports.LucideBadgeInfo = BadgeInfo;
  exports.LucideBadgeJapaneseYen = BadgeJapaneseYen;
  exports.LucideBadgeMinus = BadgeMinus;
  exports.LucideBadgePercent = BadgePercent;
  exports.LucideBadgePlus = BadgePlus;
  exports.LucideBadgePoundSterling = BadgePoundSterling;
  exports.LucideBadgeQuestionMark = BadgeQuestionMark;
  exports.LucideBadgeRussianRuble = BadgeRussianRuble;
  exports.LucideBadgeSwissFranc = BadgeSwissFranc;
  exports.LucideBadgeX = BadgeX;
  exports.LucideBaggageClaim = BaggageClaim;
  exports.LucideBan = Ban;
  exports.LucideBanana = Banana;
  exports.LucideBandage = Bandage;
  exports.LucideBanknote = Banknote;
  exports.LucideBanknoteArrowDown = BanknoteArrowDown;
  exports.LucideBanknoteArrowUp = BanknoteArrowUp;
  exports.LucideBanknoteX = BanknoteX;
  exports.LucideBarChart = ChartNoAxesColumnIncreasing;
  exports.LucideBarChart2 = ChartNoAxesColumn;
  exports.LucideBarChart3 = ChartColumn;
  exports.LucideBarChart4 = ChartColumnIncreasing;
  exports.LucideBarChartBig = ChartColumnBig;
  exports.LucideBarChartHorizontal = ChartBar;
  exports.LucideBarChartHorizontalBig = ChartBarBig;
  exports.LucideBarcode = Barcode;
  exports.LucideBarrel = Barrel;
  exports.LucideBaseline = Baseline;
  exports.LucideBath = Bath;
  exports.LucideBattery = Battery;
  exports.LucideBatteryCharging = BatteryCharging;
  exports.LucideBatteryFull = BatteryFull;
  exports.LucideBatteryLow = BatteryLow;
  exports.LucideBatteryMedium = BatteryMedium;
  exports.LucideBatteryPlus = BatteryPlus;
  exports.LucideBatteryWarning = BatteryWarning;
  exports.LucideBeaker = Beaker;
  exports.LucideBean = Bean;
  exports.LucideBeanOff = BeanOff;
  exports.LucideBed = Bed;
  exports.LucideBedDouble = BedDouble;
  exports.LucideBedSingle = BedSingle;
  exports.LucideBeef = Beef;
  exports.LucideBeer = Beer;
  exports.LucideBeerOff = BeerOff;
  exports.LucideBell = Bell;
  exports.LucideBellDot = BellDot;
  exports.LucideBellElectric = BellElectric;
  exports.LucideBellMinus = BellMinus;
  exports.LucideBellOff = BellOff;
  exports.LucideBellPlus = BellPlus;
  exports.LucideBellRing = BellRing;
  exports.LucideBetweenHorizonalEnd = BetweenHorizontalEnd;
  exports.LucideBetweenHorizonalStart = BetweenHorizontalStart;
  exports.LucideBetweenHorizontalEnd = BetweenHorizontalEnd;
  exports.LucideBetweenHorizontalStart = BetweenHorizontalStart;
  exports.LucideBetweenVerticalEnd = BetweenVerticalEnd;
  exports.LucideBetweenVerticalStart = BetweenVerticalStart;
  exports.LucideBicepsFlexed = BicepsFlexed;
  exports.LucideBike = Bike;
  exports.LucideBinary = Binary;
  exports.LucideBinoculars = Binoculars;
  exports.LucideBiohazard = Biohazard;
  exports.LucideBird = Bird;
  exports.LucideBitcoin = Bitcoin;
  exports.LucideBlend = Blend;
  exports.LucideBlinds = Blinds;
  exports.LucideBlocks = Blocks;
  exports.LucideBluetooth = Bluetooth;
  exports.LucideBluetoothConnected = BluetoothConnected;
  exports.LucideBluetoothOff = BluetoothOff;
  exports.LucideBluetoothSearching = BluetoothSearching;
  exports.LucideBold = Bold;
  exports.LucideBolt = Bolt;
  exports.LucideBomb = Bomb;
  exports.LucideBone = Bone;
  exports.LucideBook = Book;
  exports.LucideBookA = BookA;
  exports.LucideBookAlert = BookAlert;
  exports.LucideBookAudio = BookAudio;
  exports.LucideBookCheck = BookCheck;
  exports.LucideBookCopy = BookCopy;
  exports.LucideBookDashed = BookDashed;
  exports.LucideBookDown = BookDown;
  exports.LucideBookHeadphones = BookHeadphones;
  exports.LucideBookHeart = BookHeart;
  exports.LucideBookImage = BookImage;
  exports.LucideBookKey = BookKey;
  exports.LucideBookLock = BookLock;
  exports.LucideBookMarked = BookMarked;
  exports.LucideBookMinus = BookMinus;
  exports.LucideBookOpen = BookOpen;
  exports.LucideBookOpenCheck = BookOpenCheck;
  exports.LucideBookOpenText = BookOpenText;
  exports.LucideBookPlus = BookPlus;
  exports.LucideBookTemplate = BookDashed;
  exports.LucideBookText = BookText;
  exports.LucideBookType = BookType;
  exports.LucideBookUp = BookUp;
  exports.LucideBookUp2 = BookUp2;
  exports.LucideBookUser = BookUser;
  exports.LucideBookX = BookX;
  exports.LucideBookmark = Bookmark;
  exports.LucideBookmarkCheck = BookmarkCheck;
  exports.LucideBookmarkMinus = BookmarkMinus;
  exports.LucideBookmarkPlus = BookmarkPlus;
  exports.LucideBookmarkX = BookmarkX;
  exports.LucideBoomBox = BoomBox;
  exports.LucideBot = Bot;
  exports.LucideBotMessageSquare = BotMessageSquare;
  exports.LucideBotOff = BotOff;
  exports.LucideBowArrow = BowArrow;
  exports.LucideBox = Box;
  exports.LucideBoxSelect = SquareDashed;
  exports.LucideBoxes = Boxes;
  exports.LucideBraces = Braces;
  exports.LucideBrackets = Brackets;
  exports.LucideBrain = Brain;
  exports.LucideBrainCircuit = BrainCircuit;
  exports.LucideBrainCog = BrainCog;
  exports.LucideBrickWall = BrickWall;
  exports.LucideBrickWallFire = BrickWallFire;
  exports.LucideBriefcase = Briefcase;
  exports.LucideBriefcaseBusiness = BriefcaseBusiness;
  exports.LucideBriefcaseConveyorBelt = BriefcaseConveyorBelt;
  exports.LucideBriefcaseMedical = BriefcaseMedical;
  exports.LucideBringToFront = BringToFront;
  exports.LucideBrush = Brush;
  exports.LucideBrushCleaning = BrushCleaning;
  exports.LucideBubbles = Bubbles;
  exports.LucideBug = Bug;
  exports.LucideBugOff = BugOff;
  exports.LucideBugPlay = BugPlay;
  exports.LucideBuilding = Building;
  exports.LucideBuilding2 = Building2;
  exports.LucideBus = Bus;
  exports.LucideBusFront = BusFront;
  exports.LucideCable = Cable;
  exports.LucideCableCar = CableCar;
  exports.LucideCake = Cake;
  exports.LucideCakeSlice = CakeSlice;
  exports.LucideCalculator = Calculator;
  exports.LucideCalendar = Calendar;
  exports.LucideCalendar1 = Calendar1;
  exports.LucideCalendarArrowDown = CalendarArrowDown;
  exports.LucideCalendarArrowUp = CalendarArrowUp;
  exports.LucideCalendarCheck = CalendarCheck;
  exports.LucideCalendarCheck2 = CalendarCheck2;
  exports.LucideCalendarClock = CalendarClock;
  exports.LucideCalendarCog = CalendarCog;
  exports.LucideCalendarDays = CalendarDays;
  exports.LucideCalendarFold = CalendarFold;
  exports.LucideCalendarHeart = CalendarHeart;
  exports.LucideCalendarMinus = CalendarMinus;
  exports.LucideCalendarMinus2 = CalendarMinus2;
  exports.LucideCalendarOff = CalendarOff;
  exports.LucideCalendarPlus = CalendarPlus;
  exports.LucideCalendarPlus2 = CalendarPlus2;
  exports.LucideCalendarRange = CalendarRange;
  exports.LucideCalendarSearch = CalendarSearch;
  exports.LucideCalendarSync = CalendarSync;
  exports.LucideCalendarX = CalendarX;
  exports.LucideCalendarX2 = CalendarX2;
  exports.LucideCamera = Camera;
  exports.LucideCameraOff = CameraOff;
  exports.LucideCandlestickChart = ChartCandlestick;
  exports.LucideCandy = Candy;
  exports.LucideCandyCane = CandyCane;
  exports.LucideCandyOff = CandyOff;
  exports.LucideCannabis = Cannabis;
  exports.LucideCaptions = Captions;
  exports.LucideCaptionsOff = CaptionsOff;
  exports.LucideCar = Car;
  exports.LucideCarFront = CarFront;
  exports.LucideCarTaxiFront = CarTaxiFront;
  exports.LucideCaravan = Caravan;
  exports.LucideCardSim = CardSim;
  exports.LucideCarrot = Carrot;
  exports.LucideCaseLower = CaseLower;
  exports.LucideCaseSensitive = CaseSensitive;
  exports.LucideCaseUpper = CaseUpper;
  exports.LucideCassetteTape = CassetteTape;
  exports.LucideCast = Cast;
  exports.LucideCastle = Castle;
  exports.LucideCat = Cat;
  exports.LucideCctv = Cctv;
  exports.LucideChartArea = ChartArea;
  exports.LucideChartBar = ChartBar;
  exports.LucideChartBarBig = ChartBarBig;
  exports.LucideChartBarDecreasing = ChartBarDecreasing;
  exports.LucideChartBarIncreasing = ChartBarIncreasing;
  exports.LucideChartBarStacked = ChartBarStacked;
  exports.LucideChartCandlestick = ChartCandlestick;
  exports.LucideChartColumn = ChartColumn;
  exports.LucideChartColumnBig = ChartColumnBig;
  exports.LucideChartColumnDecreasing = ChartColumnDecreasing;
  exports.LucideChartColumnIncreasing = ChartColumnIncreasing;
  exports.LucideChartColumnStacked = ChartColumnStacked;
  exports.LucideChartGantt = ChartGantt;
  exports.LucideChartLine = ChartLine;
  exports.LucideChartNetwork = ChartNetwork;
  exports.LucideChartNoAxesColumn = ChartNoAxesColumn;
  exports.LucideChartNoAxesColumnDecreasing = ChartNoAxesColumnDecreasing;
  exports.LucideChartNoAxesColumnIncreasing = ChartNoAxesColumnIncreasing;
  exports.LucideChartNoAxesCombined = ChartNoAxesCombined;
  exports.LucideChartNoAxesGantt = ChartNoAxesGantt;
  exports.LucideChartPie = ChartPie;
  exports.LucideChartScatter = ChartScatter;
  exports.LucideChartSpline = ChartSpline;
  exports.LucideCheck = Check;
  exports.LucideCheckCheck = CheckCheck;
  exports.LucideCheckCircle = CircleCheckBig;
  exports.LucideCheckCircle2 = CircleCheck;
  exports.LucideCheckLine = CheckLine;
  exports.LucideCheckSquare = SquareCheckBig;
  exports.LucideCheckSquare2 = SquareCheck;
  exports.LucideChefHat = ChefHat;
  exports.LucideCherry = Cherry;
  exports.LucideChevronDown = ChevronDown;
  exports.LucideChevronDownCircle = CircleChevronDown;
  exports.LucideChevronDownSquare = SquareChevronDown;
  exports.LucideChevronFirst = ChevronFirst;
  exports.LucideChevronLast = ChevronLast;
  exports.LucideChevronLeft = ChevronLeft;
  exports.LucideChevronLeftCircle = CircleChevronLeft;
  exports.LucideChevronLeftSquare = SquareChevronLeft;
  exports.LucideChevronRight = ChevronRight;
  exports.LucideChevronRightCircle = CircleChevronRight;
  exports.LucideChevronRightSquare = SquareChevronRight;
  exports.LucideChevronUp = ChevronUp;
  exports.LucideChevronUpCircle = CircleChevronUp;
  exports.LucideChevronUpSquare = SquareChevronUp;
  exports.LucideChevronsDown = ChevronsDown;
  exports.LucideChevronsDownUp = ChevronsDownUp;
  exports.LucideChevronsLeft = ChevronsLeft;
  exports.LucideChevronsLeftRight = ChevronsLeftRight;
  exports.LucideChevronsLeftRightEllipsis = ChevronsLeftRightEllipsis;
  exports.LucideChevronsRight = ChevronsRight;
  exports.LucideChevronsRightLeft = ChevronsRightLeft;
  exports.LucideChevronsUp = ChevronsUp;
  exports.LucideChevronsUpDown = ChevronsUpDown;
  exports.LucideChrome = Chrome;
  exports.LucideChurch = Church;
  exports.LucideCigarette = Cigarette;
  exports.LucideCigaretteOff = CigaretteOff;
  exports.LucideCircle = Circle;
  exports.LucideCircleAlert = CircleAlert;
  exports.LucideCircleArrowDown = CircleArrowDown;
  exports.LucideCircleArrowLeft = CircleArrowLeft;
  exports.LucideCircleArrowOutDownLeft = CircleArrowOutDownLeft;
  exports.LucideCircleArrowOutDownRight = CircleArrowOutDownRight;
  exports.LucideCircleArrowOutUpLeft = CircleArrowOutUpLeft;
  exports.LucideCircleArrowOutUpRight = CircleArrowOutUpRight;
  exports.LucideCircleArrowRight = CircleArrowRight;
  exports.LucideCircleArrowUp = CircleArrowUp;
  exports.LucideCircleCheck = CircleCheck;
  exports.LucideCircleCheckBig = CircleCheckBig;
  exports.LucideCircleChevronDown = CircleChevronDown;
  exports.LucideCircleChevronLeft = CircleChevronLeft;
  exports.LucideCircleChevronRight = CircleChevronRight;
  exports.LucideCircleChevronUp = CircleChevronUp;
  exports.LucideCircleDashed = CircleDashed;
  exports.LucideCircleDivide = CircleDivide;
  exports.LucideCircleDollarSign = CircleDollarSign;
  exports.LucideCircleDot = CircleDot;
  exports.LucideCircleDotDashed = CircleDotDashed;
  exports.LucideCircleEllipsis = CircleEllipsis;
  exports.LucideCircleEqual = CircleEqual;
  exports.LucideCircleFadingArrowUp = CircleFadingArrowUp;
  exports.LucideCircleFadingPlus = CircleFadingPlus;
  exports.LucideCircleGauge = CircleGauge;
  exports.LucideCircleHelp = CircleQuestionMark;
  exports.LucideCircleMinus = CircleMinus;
  exports.LucideCircleOff = CircleOff;
  exports.LucideCircleParking = CircleParking;
  exports.LucideCircleParkingOff = CircleParkingOff;
  exports.LucideCirclePause = CirclePause;
  exports.LucideCirclePercent = CirclePercent;
  exports.LucideCirclePlay = CirclePlay;
  exports.LucideCirclePlus = CirclePlus;
  exports.LucideCirclePoundSterling = CirclePoundSterling;
  exports.LucideCirclePower = CirclePower;
  exports.LucideCircleQuestionMark = CircleQuestionMark;
  exports.LucideCircleSlash = CircleSlash;
  exports.LucideCircleSlash2 = CircleSlash2;
  exports.LucideCircleSlashed = CircleSlash2;
  exports.LucideCircleSmall = CircleSmall;
  exports.LucideCircleStop = CircleStop;
  exports.LucideCircleUser = CircleUser;
  exports.LucideCircleUserRound = CircleUserRound;
  exports.LucideCircleX = CircleX;
  exports.LucideCircuitBoard = CircuitBoard;
  exports.LucideCitrus = Citrus;
  exports.LucideClapperboard = Clapperboard;
  exports.LucideClipboard = Clipboard;
  exports.LucideClipboardCheck = ClipboardCheck;
  exports.LucideClipboardCopy = ClipboardCopy;
  exports.LucideClipboardEdit = ClipboardPen;
  exports.LucideClipboardList = ClipboardList;
  exports.LucideClipboardMinus = ClipboardMinus;
  exports.LucideClipboardPaste = ClipboardPaste;
  exports.LucideClipboardPen = ClipboardPen;
  exports.LucideClipboardPenLine = ClipboardPenLine;
  exports.LucideClipboardPlus = ClipboardPlus;
  exports.LucideClipboardSignature = ClipboardPenLine;
  exports.LucideClipboardType = ClipboardType;
  exports.LucideClipboardX = ClipboardX;
  exports.LucideClock = Clock;
  exports.LucideClock1 = Clock1;
  exports.LucideClock10 = Clock10;
  exports.LucideClock11 = Clock11;
  exports.LucideClock12 = Clock12;
  exports.LucideClock2 = Clock2;
  exports.LucideClock3 = Clock3;
  exports.LucideClock4 = Clock4;
  exports.LucideClock5 = Clock5;
  exports.LucideClock6 = Clock6;
  exports.LucideClock7 = Clock7;
  exports.LucideClock8 = Clock8;
  exports.LucideClock9 = Clock9;
  exports.LucideClockAlert = ClockAlert;
  exports.LucideClockArrowDown = ClockArrowDown;
  exports.LucideClockArrowUp = ClockArrowUp;
  exports.LucideClockFading = ClockFading;
  exports.LucideClockPlus = ClockPlus;
  exports.LucideCloud = Cloud;
  exports.LucideCloudAlert = CloudAlert;
  exports.LucideCloudCheck = CloudCheck;
  exports.LucideCloudCog = CloudCog;
  exports.LucideCloudDownload = CloudDownload;
  exports.LucideCloudDrizzle = CloudDrizzle;
  exports.LucideCloudFog = CloudFog;
  exports.LucideCloudHail = CloudHail;
  exports.LucideCloudLightning = CloudLightning;
  exports.LucideCloudMoon = CloudMoon;
  exports.LucideCloudMoonRain = CloudMoonRain;
  exports.LucideCloudOff = CloudOff;
  exports.LucideCloudRain = CloudRain;
  exports.LucideCloudRainWind = CloudRainWind;
  exports.LucideCloudSnow = CloudSnow;
  exports.LucideCloudSun = CloudSun;
  exports.LucideCloudSunRain = CloudSunRain;
  exports.LucideCloudUpload = CloudUpload;
  exports.LucideCloudy = Cloudy;
  exports.LucideClover = Clover;
  exports.LucideClub = Club;
  exports.LucideCode = Code;
  exports.LucideCode2 = CodeXml;
  exports.LucideCodeSquare = SquareCode;
  exports.LucideCodeXml = CodeXml;
  exports.LucideCodepen = Codepen;
  exports.LucideCodesandbox = Codesandbox;
  exports.LucideCoffee = Coffee;
  exports.LucideCog = Cog;
  exports.LucideCoins = Coins;
  exports.LucideColumns = Columns2;
  exports.LucideColumns2 = Columns2;
  exports.LucideColumns3 = Columns3;
  exports.LucideColumns3Cog = Columns3Cog;
  exports.LucideColumns4 = Columns4;
  exports.LucideColumnsSettings = Columns3Cog;
  exports.LucideCombine = Combine;
  exports.LucideCommand = Command;
  exports.LucideCompass = Compass;
  exports.LucideComponent = Component;
  exports.LucideComputer = Computer;
  exports.LucideConciergeBell = ConciergeBell;
  exports.LucideCone = Cone;
  exports.LucideConstruction = Construction;
  exports.LucideContact = Contact;
  exports.LucideContact2 = ContactRound;
  exports.LucideContactRound = ContactRound;
  exports.LucideContainer = Container;
  exports.LucideContrast = Contrast;
  exports.LucideCookie = Cookie;
  exports.LucideCookingPot = CookingPot;
  exports.LucideCopy = Copy;
  exports.LucideCopyCheck = CopyCheck;
  exports.LucideCopyMinus = CopyMinus;
  exports.LucideCopyPlus = CopyPlus;
  exports.LucideCopySlash = CopySlash;
  exports.LucideCopyX = CopyX;
  exports.LucideCopyleft = Copyleft;
  exports.LucideCopyright = Copyright;
  exports.LucideCornerDownLeft = CornerDownLeft;
  exports.LucideCornerDownRight = CornerDownRight;
  exports.LucideCornerLeftDown = CornerLeftDown;
  exports.LucideCornerLeftUp = CornerLeftUp;
  exports.LucideCornerRightDown = CornerRightDown;
  exports.LucideCornerRightUp = CornerRightUp;
  exports.LucideCornerUpLeft = CornerUpLeft;
  exports.LucideCornerUpRight = CornerUpRight;
  exports.LucideCpu = Cpu;
  exports.LucideCreativeCommons = CreativeCommons;
  exports.LucideCreditCard = CreditCard;
  exports.LucideCroissant = Croissant;
  exports.LucideCrop = Crop;
  exports.LucideCross = Cross;
  exports.LucideCrosshair = Crosshair;
  exports.LucideCrown = Crown;
  exports.LucideCuboid = Cuboid;
  exports.LucideCupSoda = CupSoda;
  exports.LucideCurlyBraces = Braces;
  exports.LucideCurrency = Currency;
  exports.LucideCylinder = Cylinder;
  exports.LucideDam = Dam;
  exports.LucideDatabase = Database;
  exports.LucideDatabaseBackup = DatabaseBackup;
  exports.LucideDatabaseZap = DatabaseZap;
  exports.LucideDecimalsArrowLeft = DecimalsArrowLeft;
  exports.LucideDecimalsArrowRight = DecimalsArrowRight;
  exports.LucideDelete = Delete;
  exports.LucideDessert = Dessert;
  exports.LucideDiameter = Diameter;
  exports.LucideDiamond = Diamond;
  exports.LucideDiamondMinus = DiamondMinus;
  exports.LucideDiamondPercent = DiamondPercent;
  exports.LucideDiamondPlus = DiamondPlus;
  exports.LucideDice1 = Dice1;
  exports.LucideDice2 = Dice2;
  exports.LucideDice3 = Dice3;
  exports.LucideDice4 = Dice4;
  exports.LucideDice5 = Dice5;
  exports.LucideDice6 = Dice6;
  exports.LucideDices = Dices;
  exports.LucideDiff = Diff;
  exports.LucideDisc = Disc;
  exports.LucideDisc2 = Disc2;
  exports.LucideDisc3 = Disc3;
  exports.LucideDiscAlbum = DiscAlbum;
  exports.LucideDivide = Divide;
  exports.LucideDivideCircle = CircleDivide;
  exports.LucideDivideSquare = SquareDivide;
  exports.LucideDna = Dna;
  exports.LucideDnaOff = DnaOff;
  exports.LucideDock = Dock;
  exports.LucideDog = Dog;
  exports.LucideDollarSign = DollarSign;
  exports.LucideDonut = Donut;
  exports.LucideDoorClosed = DoorClosed;
  exports.LucideDoorClosedLocked = DoorClosedLocked;
  exports.LucideDoorOpen = DoorOpen;
  exports.LucideDot = Dot;
  exports.LucideDotSquare = SquareDot;
  exports.LucideDownload = Download;
  exports.LucideDownloadCloud = CloudDownload;
  exports.LucideDraftingCompass = DraftingCompass;
  exports.LucideDrama = Drama;
  exports.LucideDribbble = Dribbble;
  exports.LucideDrill = Drill;
  exports.LucideDrone = Drone;
  exports.LucideDroplet = Droplet;
  exports.LucideDropletOff = DropletOff;
  exports.LucideDroplets = Droplets;
  exports.LucideDrum = Drum;
  exports.LucideDrumstick = Drumstick;
  exports.LucideDumbbell = Dumbbell;
  exports.LucideEar = Ear;
  exports.LucideEarOff = EarOff;
  exports.LucideEarth = Earth;
  exports.LucideEarthLock = EarthLock;
  exports.LucideEclipse = Eclipse;
  exports.LucideEdit = SquarePen;
  exports.LucideEdit2 = Pen;
  exports.LucideEdit3 = PenLine;
  exports.LucideEgg = Egg;
  exports.LucideEggFried = EggFried;
  exports.LucideEggOff = EggOff;
  exports.LucideEllipsis = Ellipsis;
  exports.LucideEllipsisVertical = EllipsisVertical;
  exports.LucideEqual = Equal;
  exports.LucideEqualApproximately = EqualApproximately;
  exports.LucideEqualNot = EqualNot;
  exports.LucideEqualSquare = SquareEqual;
  exports.LucideEraser = Eraser;
  exports.LucideEthernetPort = EthernetPort;
  exports.LucideEuro = Euro;
  exports.LucideExpand = Expand;
  exports.LucideExternalLink = ExternalLink;
  exports.LucideEye = Eye;
  exports.LucideEyeClosed = EyeClosed;
  exports.LucideEyeOff = EyeOff;
  exports.LucideFacebook = Facebook;
  exports.LucideFactory = Factory;
  exports.LucideFan = Fan;
  exports.LucideFastForward = FastForward;
  exports.LucideFeather = Feather;
  exports.LucideFence = Fence;
  exports.LucideFerrisWheel = FerrisWheel;
  exports.LucideFigma = Figma;
  exports.LucideFile = File;
  exports.LucideFileArchive = FileArchive;
  exports.LucideFileAudio = FileAudio;
  exports.LucideFileAudio2 = FileAudio2;
  exports.LucideFileAxis3D = FileAxis3d;
  exports.LucideFileAxis3d = FileAxis3d;
  exports.LucideFileBadge = FileBadge;
  exports.LucideFileBadge2 = FileBadge2;
  exports.LucideFileBarChart = FileChartColumnIncreasing;
  exports.LucideFileBarChart2 = FileChartColumn;
  exports.LucideFileBox = FileBox;
  exports.LucideFileChartColumn = FileChartColumn;
  exports.LucideFileChartColumnIncreasing = FileChartColumnIncreasing;
  exports.LucideFileChartLine = FileChartLine;
  exports.LucideFileChartPie = FileChartPie;
  exports.LucideFileCheck = FileCheck;
  exports.LucideFileCheck2 = FileCheck2;
  exports.LucideFileClock = FileClock;
  exports.LucideFileCode = FileCode;
  exports.LucideFileCode2 = FileCode2;
  exports.LucideFileCog = FileCog;
  exports.LucideFileCog2 = FileCog;
  exports.LucideFileDiff = FileDiff;
  exports.LucideFileDigit = FileDigit;
  exports.LucideFileDown = FileDown;
  exports.LucideFileEdit = FilePen;
  exports.LucideFileHeart = FileHeart;
  exports.LucideFileImage = FileImage;
  exports.LucideFileInput = FileInput;
  exports.LucideFileJson = FileJson;
  exports.LucideFileJson2 = FileJson2;
  exports.LucideFileKey = FileKey;
  exports.LucideFileKey2 = FileKey2;
  exports.LucideFileLineChart = FileChartLine;
  exports.LucideFileLock = FileLock;
  exports.LucideFileLock2 = FileLock2;
  exports.LucideFileMinus = FileMinus;
  exports.LucideFileMinus2 = FileMinus2;
  exports.LucideFileMusic = FileMusic;
  exports.LucideFileOutput = FileOutput;
  exports.LucideFilePen = FilePen;
  exports.LucideFilePenLine = FilePenLine;
  exports.LucideFilePieChart = FileChartPie;
  exports.LucideFilePlus = FilePlus;
  exports.LucideFilePlus2 = FilePlus2;
  exports.LucideFileQuestion = FileQuestionMark;
  exports.LucideFileQuestionMark = FileQuestionMark;
  exports.LucideFileScan = FileScan;
  exports.LucideFileSearch = FileSearch;
  exports.LucideFileSearch2 = FileSearch2;
  exports.LucideFileSignature = FilePenLine;
  exports.LucideFileSliders = FileSliders;
  exports.LucideFileSpreadsheet = FileSpreadsheet;
  exports.LucideFileStack = FileStack;
  exports.LucideFileSymlink = FileSymlink;
  exports.LucideFileTerminal = FileTerminal;
  exports.LucideFileText = FileText;
  exports.LucideFileType = FileType;
  exports.LucideFileType2 = FileType2;
  exports.LucideFileUp = FileUp;
  exports.LucideFileUser = FileUser;
  exports.LucideFileVideo = FileVideo;
  exports.LucideFileVideo2 = FileVideo2;
  exports.LucideFileVolume = FileVolume;
  exports.LucideFileVolume2 = FileVolume2;
  exports.LucideFileWarning = FileWarning;
  exports.LucideFileX = FileX;
  exports.LucideFileX2 = FileX2;
  exports.LucideFiles = Files;
  exports.LucideFilm = Film;
  exports.LucideFilter = Funnel;
  exports.LucideFilterX = FunnelX;
  exports.LucideFingerprint = Fingerprint;
  exports.LucideFireExtinguisher = FireExtinguisher;
  exports.LucideFish = Fish;
  exports.LucideFishOff = FishOff;
  exports.LucideFishSymbol = FishSymbol;
  exports.LucideFlag = Flag;
  exports.LucideFlagOff = FlagOff;
  exports.LucideFlagTriangleLeft = FlagTriangleLeft;
  exports.LucideFlagTriangleRight = FlagTriangleRight;
  exports.LucideFlame = Flame;
  exports.LucideFlameKindling = FlameKindling;
  exports.LucideFlashlight = Flashlight;
  exports.LucideFlashlightOff = FlashlightOff;
  exports.LucideFlaskConical = FlaskConical;
  exports.LucideFlaskConicalOff = FlaskConicalOff;
  exports.LucideFlaskRound = FlaskRound;
  exports.LucideFlipHorizontal = FlipHorizontal;
  exports.LucideFlipHorizontal2 = FlipHorizontal2;
  exports.LucideFlipVertical = FlipVertical;
  exports.LucideFlipVertical2 = FlipVertical2;
  exports.LucideFlower = Flower;
  exports.LucideFlower2 = Flower2;
  exports.LucideFocus = Focus;
  exports.LucideFoldHorizontal = FoldHorizontal;
  exports.LucideFoldVertical = FoldVertical;
  exports.LucideFolder = Folder;
  exports.LucideFolderArchive = FolderArchive;
  exports.LucideFolderCheck = FolderCheck;
  exports.LucideFolderClock = FolderClock;
  exports.LucideFolderClosed = FolderClosed;
  exports.LucideFolderCode = FolderCode;
  exports.LucideFolderCog = FolderCog;
  exports.LucideFolderCog2 = FolderCog;
  exports.LucideFolderDot = FolderDot;
  exports.LucideFolderDown = FolderDown;
  exports.LucideFolderEdit = FolderPen;
  exports.LucideFolderGit = FolderGit;
  exports.LucideFolderGit2 = FolderGit2;
  exports.LucideFolderHeart = FolderHeart;
  exports.LucideFolderInput = FolderInput;
  exports.LucideFolderKanban = FolderKanban;
  exports.LucideFolderKey = FolderKey;
  exports.LucideFolderLock = FolderLock;
  exports.LucideFolderMinus = FolderMinus;
  exports.LucideFolderOpen = FolderOpen;
  exports.LucideFolderOpenDot = FolderOpenDot;
  exports.LucideFolderOutput = FolderOutput;
  exports.LucideFolderPen = FolderPen;
  exports.LucideFolderPlus = FolderPlus;
  exports.LucideFolderRoot = FolderRoot;
  exports.LucideFolderSearch = FolderSearch;
  exports.LucideFolderSearch2 = FolderSearch2;
  exports.LucideFolderSymlink = FolderSymlink;
  exports.LucideFolderSync = FolderSync;
  exports.LucideFolderTree = FolderTree;
  exports.LucideFolderUp = FolderUp;
  exports.LucideFolderX = FolderX;
  exports.LucideFolders = Folders;
  exports.LucideFootprints = Footprints;
  exports.LucideForkKnife = Utensils;
  exports.LucideForkKnifeCrossed = UtensilsCrossed;
  exports.LucideForklift = Forklift;
  exports.LucideFormInput = RectangleEllipsis;
  exports.LucideForward = Forward;
  exports.LucideFrame = Frame;
  exports.LucideFramer = Framer;
  exports.LucideFrown = Frown;
  exports.LucideFuel = Fuel;
  exports.LucideFullscreen = Fullscreen;
  exports.LucideFunctionSquare = SquareFunction;
  exports.LucideFunnel = Funnel;
  exports.LucideFunnelPlus = FunnelPlus;
  exports.LucideFunnelX = FunnelX;
  exports.LucideGalleryHorizontal = GalleryHorizontal;
  exports.LucideGalleryHorizontalEnd = GalleryHorizontalEnd;
  exports.LucideGalleryThumbnails = GalleryThumbnails;
  exports.LucideGalleryVertical = GalleryVertical;
  exports.LucideGalleryVerticalEnd = GalleryVerticalEnd;
  exports.LucideGamepad = Gamepad;
  exports.LucideGamepad2 = Gamepad2;
  exports.LucideGanttChart = ChartNoAxesGantt;
  exports.LucideGanttChartSquare = SquareChartGantt;
  exports.LucideGauge = Gauge;
  exports.LucideGaugeCircle = CircleGauge;
  exports.LucideGavel = Gavel;
  exports.LucideGem = Gem;
  exports.LucideGeorgianLari = GeorgianLari;
  exports.LucideGhost = Ghost;
  exports.LucideGift = Gift;
  exports.LucideGitBranch = GitBranch;
  exports.LucideGitBranchPlus = GitBranchPlus;
  exports.LucideGitCommit = GitCommitHorizontal;
  exports.LucideGitCommitHorizontal = GitCommitHorizontal;
  exports.LucideGitCommitVertical = GitCommitVertical;
  exports.LucideGitCompare = GitCompare;
  exports.LucideGitCompareArrows = GitCompareArrows;
  exports.LucideGitFork = GitFork;
  exports.LucideGitGraph = GitGraph;
  exports.LucideGitMerge = GitMerge;
  exports.LucideGitPullRequest = GitPullRequest;
  exports.LucideGitPullRequestArrow = GitPullRequestArrow;
  exports.LucideGitPullRequestClosed = GitPullRequestClosed;
  exports.LucideGitPullRequestCreate = GitPullRequestCreate;
  exports.LucideGitPullRequestCreateArrow = GitPullRequestCreateArrow;
  exports.LucideGitPullRequestDraft = GitPullRequestDraft;
  exports.LucideGithub = Github;
  exports.LucideGitlab = Gitlab;
  exports.LucideGlassWater = GlassWater;
  exports.LucideGlasses = Glasses;
  exports.LucideGlobe = Globe;
  exports.LucideGlobe2 = Earth;
  exports.LucideGlobeLock = GlobeLock;
  exports.LucideGoal = Goal;
  exports.LucideGpu = Gpu;
  exports.LucideGrab = Grab;
  exports.LucideGraduationCap = GraduationCap;
  exports.LucideGrape = Grape;
  exports.LucideGrid = Grid3x3;
  exports.LucideGrid2X2 = Grid2x2;
  exports.LucideGrid2X2Check = Grid2x2Check;
  exports.LucideGrid2X2Plus = Grid2x2Plus;
  exports.LucideGrid2X2X = Grid2x2X;
  exports.LucideGrid2x2 = Grid2x2;
  exports.LucideGrid2x2Check = Grid2x2Check;
  exports.LucideGrid2x2Plus = Grid2x2Plus;
  exports.LucideGrid2x2X = Grid2x2X;
  exports.LucideGrid3X3 = Grid3x3;
  exports.LucideGrid3x2 = Grid3x2;
  exports.LucideGrid3x3 = Grid3x3;
  exports.LucideGrip = Grip;
  exports.LucideGripHorizontal = GripHorizontal;
  exports.LucideGripVertical = GripVertical;
  exports.LucideGroup = Group;
  exports.LucideGuitar = Guitar;
  exports.LucideHam = Ham;
  exports.LucideHamburger = Hamburger;
  exports.LucideHammer = Hammer;
  exports.LucideHand = Hand;
  exports.LucideHandCoins = HandCoins;
  exports.LucideHandHeart = HandHeart;
  exports.LucideHandHelping = HandHelping;
  exports.LucideHandMetal = HandMetal;
  exports.LucideHandPlatter = HandPlatter;
  exports.LucideHandshake = Handshake;
  exports.LucideHardDrive = HardDrive;
  exports.LucideHardDriveDownload = HardDriveDownload;
  exports.LucideHardDriveUpload = HardDriveUpload;
  exports.LucideHardHat = HardHat;
  exports.LucideHash = Hash;
  exports.LucideHaze = Haze;
  exports.LucideHdmiPort = HdmiPort;
  exports.LucideHeading = Heading;
  exports.LucideHeading1 = Heading1;
  exports.LucideHeading2 = Heading2;
  exports.LucideHeading3 = Heading3;
  exports.LucideHeading4 = Heading4;
  exports.LucideHeading5 = Heading5;
  exports.LucideHeading6 = Heading6;
  exports.LucideHeadphoneOff = HeadphoneOff;
  exports.LucideHeadphones = Headphones;
  exports.LucideHeadset = Headset;
  exports.LucideHeart = Heart;
  exports.LucideHeartCrack = HeartCrack;
  exports.LucideHeartHandshake = HeartHandshake;
  exports.LucideHeartMinus = HeartMinus;
  exports.LucideHeartOff = HeartOff;
  exports.LucideHeartPlus = HeartPlus;
  exports.LucideHeartPulse = HeartPulse;
  exports.LucideHeater = Heater;
  exports.LucideHelpCircle = CircleQuestionMark;
  exports.LucideHelpingHand = HandHelping;
  exports.LucideHexagon = Hexagon;
  exports.LucideHighlighter = Highlighter;
  exports.LucideHistory = History;
  exports.LucideHome = House;
  exports.LucideHop = Hop;
  exports.LucideHopOff = HopOff;
  exports.LucideHospital = Hospital;
  exports.LucideHotel = Hotel;
  exports.LucideHourglass = Hourglass;
  exports.LucideHouse = House;
  exports.LucideHousePlug = HousePlug;
  exports.LucideHousePlus = HousePlus;
  exports.LucideHouseWifi = HouseWifi;
  exports.LucideIceCream = IceCreamCone;
  exports.LucideIceCream2 = IceCreamBowl;
  exports.LucideIceCreamBowl = IceCreamBowl;
  exports.LucideIceCreamCone = IceCreamCone;
  exports.LucideIdCard = IdCard;
  exports.LucideIdCardLanyard = IdCardLanyard;
  exports.LucideImage = Image;
  exports.LucideImageDown = ImageDown;
  exports.LucideImageMinus = ImageMinus;
  exports.LucideImageOff = ImageOff;
  exports.LucideImagePlay = ImagePlay;
  exports.LucideImagePlus = ImagePlus;
  exports.LucideImageUp = ImageUp;
  exports.LucideImageUpscale = ImageUpscale;
  exports.LucideImages = Images;
  exports.LucideImport = Import;
  exports.LucideInbox = Inbox;
  exports.LucideIndent = IndentIncrease;
  exports.LucideIndentDecrease = IndentDecrease;
  exports.LucideIndentIncrease = IndentIncrease;
  exports.LucideIndianRupee = IndianRupee;
  exports.LucideInfinity = Infinity;
  exports.LucideInfo = Info;
  exports.LucideInspect = SquareMousePointer;
  exports.LucideInspectionPanel = InspectionPanel;
  exports.LucideInstagram = Instagram;
  exports.LucideItalic = Italic;
  exports.LucideIterationCcw = IterationCcw;
  exports.LucideIterationCw = IterationCw;
  exports.LucideJapaneseYen = JapaneseYen;
  exports.LucideJoystick = Joystick;
  exports.LucideKanban = Kanban;
  exports.LucideKanbanSquare = SquareKanban;
  exports.LucideKanbanSquareDashed = SquareDashedKanban;
  exports.LucideKey = Key;
  exports.LucideKeyRound = KeyRound;
  exports.LucideKeySquare = KeySquare;
  exports.LucideKeyboard = Keyboard;
  exports.LucideKeyboardMusic = KeyboardMusic;
  exports.LucideKeyboardOff = KeyboardOff;
  exports.LucideLamp = Lamp;
  exports.LucideLampCeiling = LampCeiling;
  exports.LucideLampDesk = LampDesk;
  exports.LucideLampFloor = LampFloor;
  exports.LucideLampWallDown = LampWallDown;
  exports.LucideLampWallUp = LampWallUp;
  exports.LucideLandPlot = LandPlot;
  exports.LucideLandmark = Landmark;
  exports.LucideLanguages = Languages;
  exports.LucideLaptop = Laptop;
  exports.LucideLaptop2 = LaptopMinimal;
  exports.LucideLaptopMinimal = LaptopMinimal;
  exports.LucideLaptopMinimalCheck = LaptopMinimalCheck;
  exports.LucideLasso = Lasso;
  exports.LucideLassoSelect = LassoSelect;
  exports.LucideLaugh = Laugh;
  exports.LucideLayers = Layers;
  exports.LucideLayers2 = Layers2;
  exports.LucideLayers3 = Layers;
  exports.LucideLayout = PanelsTopLeft;
  exports.LucideLayoutDashboard = LayoutDashboard;
  exports.LucideLayoutGrid = LayoutGrid;
  exports.LucideLayoutList = LayoutList;
  exports.LucideLayoutPanelLeft = LayoutPanelLeft;
  exports.LucideLayoutPanelTop = LayoutPanelTop;
  exports.LucideLayoutTemplate = LayoutTemplate;
  exports.LucideLeaf = Leaf;
  exports.LucideLeafyGreen = LeafyGreen;
  exports.LucideLectern = Lectern;
  exports.LucideLetterText = LetterText;
  exports.LucideLibrary = Library;
  exports.LucideLibraryBig = LibraryBig;
  exports.LucideLibrarySquare = SquareLibrary;
  exports.LucideLifeBuoy = LifeBuoy;
  exports.LucideLigature = Ligature;
  exports.LucideLightbulb = Lightbulb;
  exports.LucideLightbulbOff = LightbulbOff;
  exports.LucideLineChart = ChartLine;
  exports.LucideLineSquiggle = LineSquiggle;
  exports.LucideLink = Link;
  exports.LucideLink2 = Link2;
  exports.LucideLink2Off = Link2Off;
  exports.LucideLinkedin = Linkedin;
  exports.LucideList = List;
  exports.LucideListCheck = ListCheck;
  exports.LucideListChecks = ListChecks;
  exports.LucideListCollapse = ListCollapse;
  exports.LucideListEnd = ListEnd;
  exports.LucideListFilter = ListFilter;
  exports.LucideListFilterPlus = ListFilterPlus;
  exports.LucideListMinus = ListMinus;
  exports.LucideListMusic = ListMusic;
  exports.LucideListOrdered = ListOrdered;
  exports.LucideListPlus = ListPlus;
  exports.LucideListRestart = ListRestart;
  exports.LucideListStart = ListStart;
  exports.LucideListTodo = ListTodo;
  exports.LucideListTree = ListTree;
  exports.LucideListVideo = ListVideo;
  exports.LucideListX = ListX;
  exports.LucideLoader = Loader;
  exports.LucideLoader2 = LoaderCircle;
  exports.LucideLoaderCircle = LoaderCircle;
  exports.LucideLoaderPinwheel = LoaderPinwheel;
  exports.LucideLocate = Locate;
  exports.LucideLocateFixed = LocateFixed;
  exports.LucideLocateOff = LocateOff;
  exports.LucideLocationEdit = LocationEdit;
  exports.LucideLock = Lock;
  exports.LucideLockKeyhole = LockKeyhole;
  exports.LucideLockKeyholeOpen = LockKeyholeOpen;
  exports.LucideLockOpen = LockOpen;
  exports.LucideLogIn = LogIn;
  exports.LucideLogOut = LogOut;
  exports.LucideLogs = Logs;
  exports.LucideLollipop = Lollipop;
  exports.LucideLuggage = Luggage;
  exports.LucideMSquare = SquareM;
  exports.LucideMagnet = Magnet;
  exports.LucideMail = Mail;
  exports.LucideMailCheck = MailCheck;
  exports.LucideMailMinus = MailMinus;
  exports.LucideMailOpen = MailOpen;
  exports.LucideMailPlus = MailPlus;
  exports.LucideMailQuestion = MailQuestionMark;
  exports.LucideMailQuestionMark = MailQuestionMark;
  exports.LucideMailSearch = MailSearch;
  exports.LucideMailWarning = MailWarning;
  exports.LucideMailX = MailX;
  exports.LucideMailbox = Mailbox;
  exports.LucideMails = Mails;
  exports.LucideMap = Map;
  exports.LucideMapPin = MapPin;
  exports.LucideMapPinCheck = MapPinCheck;
  exports.LucideMapPinCheckInside = MapPinCheckInside;
  exports.LucideMapPinHouse = MapPinHouse;
  exports.LucideMapPinMinus = MapPinMinus;
  exports.LucideMapPinMinusInside = MapPinMinusInside;
  exports.LucideMapPinOff = MapPinOff;
  exports.LucideMapPinPlus = MapPinPlus;
  exports.LucideMapPinPlusInside = MapPinPlusInside;
  exports.LucideMapPinX = MapPinX;
  exports.LucideMapPinXInside = MapPinXInside;
  exports.LucideMapPinned = MapPinned;
  exports.LucideMapPlus = MapPlus;
  exports.LucideMars = Mars;
  exports.LucideMarsStroke = MarsStroke;
  exports.LucideMartini = Martini;
  exports.LucideMaximize = Maximize;
  exports.LucideMaximize2 = Maximize2;
  exports.LucideMedal = Medal;
  exports.LucideMegaphone = Megaphone;
  exports.LucideMegaphoneOff = MegaphoneOff;
  exports.LucideMeh = Meh;
  exports.LucideMemoryStick = MemoryStick;
  exports.LucideMenu = Menu;
  exports.LucideMenuSquare = SquareMenu;
  exports.LucideMerge = Merge;
  exports.LucideMessageCircle = MessageCircle;
  exports.LucideMessageCircleCode = MessageCircleCode;
  exports.LucideMessageCircleDashed = MessageCircleDashed;
  exports.LucideMessageCircleHeart = MessageCircleHeart;
  exports.LucideMessageCircleMore = MessageCircleMore;
  exports.LucideMessageCircleOff = MessageCircleOff;
  exports.LucideMessageCirclePlus = MessageCirclePlus;
  exports.LucideMessageCircleQuestion = MessageCircleQuestionMark;
  exports.LucideMessageCircleQuestionMark = MessageCircleQuestionMark;
  exports.LucideMessageCircleReply = MessageCircleReply;
  exports.LucideMessageCircleWarning = MessageCircleWarning;
  exports.LucideMessageCircleX = MessageCircleX;
  exports.LucideMessageSquare = MessageSquare;
  exports.LucideMessageSquareCode = MessageSquareCode;
  exports.LucideMessageSquareDashed = MessageSquareDashed;
  exports.LucideMessageSquareDiff = MessageSquareDiff;
  exports.LucideMessageSquareDot = MessageSquareDot;
  exports.LucideMessageSquareHeart = MessageSquareHeart;
  exports.LucideMessageSquareLock = MessageSquareLock;
  exports.LucideMessageSquareMore = MessageSquareMore;
  exports.LucideMessageSquareOff = MessageSquareOff;
  exports.LucideMessageSquarePlus = MessageSquarePlus;
  exports.LucideMessageSquareQuote = MessageSquareQuote;
  exports.LucideMessageSquareReply = MessageSquareReply;
  exports.LucideMessageSquareShare = MessageSquareShare;
  exports.LucideMessageSquareText = MessageSquareText;
  exports.LucideMessageSquareWarning = MessageSquareWarning;
  exports.LucideMessageSquareX = MessageSquareX;
  exports.LucideMessagesSquare = MessagesSquare;
  exports.LucideMic = Mic;
  exports.LucideMic2 = MicVocal;
  exports.LucideMicOff = MicOff;
  exports.LucideMicVocal = MicVocal;
  exports.LucideMicrochip = Microchip;
  exports.LucideMicroscope = Microscope;
  exports.LucideMicrowave = Microwave;
  exports.LucideMilestone = Milestone;
  exports.LucideMilk = Milk;
  exports.LucideMilkOff = MilkOff;
  exports.LucideMinimize = Minimize;
  exports.LucideMinimize2 = Minimize2;
  exports.LucideMinus = Minus;
  exports.LucideMinusCircle = CircleMinus;
  exports.LucideMinusSquare = SquareMinus;
  exports.LucideMonitor = Monitor;
  exports.LucideMonitorCheck = MonitorCheck;
  exports.LucideMonitorCog = MonitorCog;
  exports.LucideMonitorDot = MonitorDot;
  exports.LucideMonitorDown = MonitorDown;
  exports.LucideMonitorOff = MonitorOff;
  exports.LucideMonitorPause = MonitorPause;
  exports.LucideMonitorPlay = MonitorPlay;
  exports.LucideMonitorSmartphone = MonitorSmartphone;
  exports.LucideMonitorSpeaker = MonitorSpeaker;
  exports.LucideMonitorStop = MonitorStop;
  exports.LucideMonitorUp = MonitorUp;
  exports.LucideMonitorX = MonitorX;
  exports.LucideMoon = Moon;
  exports.LucideMoonStar = MoonStar;
  exports.LucideMoreHorizontal = Ellipsis;
  exports.LucideMoreVertical = EllipsisVertical;
  exports.LucideMountain = Mountain;
  exports.LucideMountainSnow = MountainSnow;
  exports.LucideMouse = Mouse;
  exports.LucideMouseOff = MouseOff;
  exports.LucideMousePointer = MousePointer;
  exports.LucideMousePointer2 = MousePointer2;
  exports.LucideMousePointerBan = MousePointerBan;
  exports.LucideMousePointerClick = MousePointerClick;
  exports.LucideMousePointerSquareDashed = SquareDashedMousePointer;
  exports.LucideMove = Move;
  exports.LucideMove3D = Move3d;
  exports.LucideMove3d = Move3d;
  exports.LucideMoveDiagonal = MoveDiagonal;
  exports.LucideMoveDiagonal2 = MoveDiagonal2;
  exports.LucideMoveDown = MoveDown;
  exports.LucideMoveDownLeft = MoveDownLeft;
  exports.LucideMoveDownRight = MoveDownRight;
  exports.LucideMoveHorizontal = MoveHorizontal;
  exports.LucideMoveLeft = MoveLeft;
  exports.LucideMoveRight = MoveRight;
  exports.LucideMoveUp = MoveUp;
  exports.LucideMoveUpLeft = MoveUpLeft;
  exports.LucideMoveUpRight = MoveUpRight;
  exports.LucideMoveVertical = MoveVertical;
  exports.LucideMusic = Music;
  exports.LucideMusic2 = Music2;
  exports.LucideMusic3 = Music3;
  exports.LucideMusic4 = Music4;
  exports.LucideNavigation = Navigation;
  exports.LucideNavigation2 = Navigation2;
  exports.LucideNavigation2Off = Navigation2Off;
  exports.LucideNavigationOff = NavigationOff;
  exports.LucideNetwork = Network;
  exports.LucideNewspaper = Newspaper;
  exports.LucideNfc = Nfc;
  exports.LucideNonBinary = NonBinary;
  exports.LucideNotebook = Notebook;
  exports.LucideNotebookPen = NotebookPen;
  exports.LucideNotebookTabs = NotebookTabs;
  exports.LucideNotebookText = NotebookText;
  exports.LucideNotepadText = NotepadText;
  exports.LucideNotepadTextDashed = NotepadTextDashed;
  exports.LucideNut = Nut;
  exports.LucideNutOff = NutOff;
  exports.LucideOctagon = Octagon;
  exports.LucideOctagonAlert = OctagonAlert;
  exports.LucideOctagonMinus = OctagonMinus;
  exports.LucideOctagonPause = OctagonPause;
  exports.LucideOctagonX = OctagonX;
  exports.LucideOmega = Omega;
  exports.LucideOption = Option;
  exports.LucideOrbit = Orbit;
  exports.LucideOrigami = Origami;
  exports.LucideOutdent = IndentDecrease;
  exports.LucidePackage = Package;
  exports.LucidePackage2 = Package2;
  exports.LucidePackageCheck = PackageCheck;
  exports.LucidePackageMinus = PackageMinus;
  exports.LucidePackageOpen = PackageOpen;
  exports.LucidePackagePlus = PackagePlus;
  exports.LucidePackageSearch = PackageSearch;
  exports.LucidePackageX = PackageX;
  exports.LucidePaintBucket = PaintBucket;
  exports.LucidePaintRoller = PaintRoller;
  exports.LucidePaintbrush = Paintbrush;
  exports.LucidePaintbrush2 = PaintbrushVertical;
  exports.LucidePaintbrushVertical = PaintbrushVertical;
  exports.LucidePalette = Palette;
  exports.LucidePalmtree = TreePalm;
  exports.LucidePanda = Panda;
  exports.LucidePanelBottom = PanelBottom;
  exports.LucidePanelBottomClose = PanelBottomClose;
  exports.LucidePanelBottomDashed = PanelBottomDashed;
  exports.LucidePanelBottomInactive = PanelBottomDashed;
  exports.LucidePanelBottomOpen = PanelBottomOpen;
  exports.LucidePanelLeft = PanelLeft;
  exports.LucidePanelLeftClose = PanelLeftClose;
  exports.LucidePanelLeftDashed = PanelLeftDashed;
  exports.LucidePanelLeftInactive = PanelLeftDashed;
  exports.LucidePanelLeftOpen = PanelLeftOpen;
  exports.LucidePanelRight = PanelRight;
  exports.LucidePanelRightClose = PanelRightClose;
  exports.LucidePanelRightDashed = PanelRightDashed;
  exports.LucidePanelRightInactive = PanelRightDashed;
  exports.LucidePanelRightOpen = PanelRightOpen;
  exports.LucidePanelTop = PanelTop;
  exports.LucidePanelTopClose = PanelTopClose;
  exports.LucidePanelTopDashed = PanelTopDashed;
  exports.LucidePanelTopInactive = PanelTopDashed;
  exports.LucidePanelTopOpen = PanelTopOpen;
  exports.LucidePanelsLeftBottom = PanelsLeftBottom;
  exports.LucidePanelsLeftRight = Columns3;
  exports.LucidePanelsRightBottom = PanelsRightBottom;
  exports.LucidePanelsTopBottom = Rows3;
  exports.LucidePanelsTopLeft = PanelsTopLeft;
  exports.LucidePaperclip = Paperclip;
  exports.LucideParentheses = Parentheses;
  exports.LucideParkingCircle = CircleParking;
  exports.LucideParkingCircleOff = CircleParkingOff;
  exports.LucideParkingMeter = ParkingMeter;
  exports.LucideParkingSquare = SquareParking;
  exports.LucideParkingSquareOff = SquareParkingOff;
  exports.LucidePartyPopper = PartyPopper;
  exports.LucidePause = Pause;
  exports.LucidePauseCircle = CirclePause;
  exports.LucidePauseOctagon = OctagonPause;
  exports.LucidePawPrint = PawPrint;
  exports.LucidePcCase = PcCase;
  exports.LucidePen = Pen;
  exports.LucidePenBox = SquarePen;
  exports.LucidePenLine = PenLine;
  exports.LucidePenOff = PenOff;
  exports.LucidePenSquare = SquarePen;
  exports.LucidePenTool = PenTool;
  exports.LucidePencil = Pencil;
  exports.LucidePencilLine = PencilLine;
  exports.LucidePencilOff = PencilOff;
  exports.LucidePencilRuler = PencilRuler;
  exports.LucidePentagon = Pentagon;
  exports.LucidePercent = Percent;
  exports.LucidePercentCircle = CirclePercent;
  exports.LucidePercentDiamond = DiamondPercent;
  exports.LucidePercentSquare = SquarePercent;
  exports.LucidePersonStanding = PersonStanding;
  exports.LucidePhilippinePeso = PhilippinePeso;
  exports.LucidePhone = Phone;
  exports.LucidePhoneCall = PhoneCall;
  exports.LucidePhoneForwarded = PhoneForwarded;
  exports.LucidePhoneIncoming = PhoneIncoming;
  exports.LucidePhoneMissed = PhoneMissed;
  exports.LucidePhoneOff = PhoneOff;
  exports.LucidePhoneOutgoing = PhoneOutgoing;
  exports.LucidePi = Pi;
  exports.LucidePiSquare = SquarePi;
  exports.LucidePiano = Piano;
  exports.LucidePickaxe = Pickaxe;
  exports.LucidePictureInPicture = PictureInPicture;
  exports.LucidePictureInPicture2 = PictureInPicture2;
  exports.LucidePieChart = ChartPie;
  exports.LucidePiggyBank = PiggyBank;
  exports.LucidePilcrow = Pilcrow;
  exports.LucidePilcrowLeft = PilcrowLeft;
  exports.LucidePilcrowRight = PilcrowRight;
  exports.LucidePilcrowSquare = SquarePilcrow;
  exports.LucidePill = Pill;
  exports.LucidePillBottle = PillBottle;
  exports.LucidePin = Pin;
  exports.LucidePinOff = PinOff;
  exports.LucidePipette = Pipette;
  exports.LucidePizza = Pizza;
  exports.LucidePlane = Plane;
  exports.LucidePlaneLanding = PlaneLanding;
  exports.LucidePlaneTakeoff = PlaneTakeoff;
  exports.LucidePlay = Play;
  exports.LucidePlayCircle = CirclePlay;
  exports.LucidePlaySquare = SquarePlay;
  exports.LucidePlug = Plug;
  exports.LucidePlug2 = Plug2;
  exports.LucidePlugZap = PlugZap;
  exports.LucidePlugZap2 = PlugZap;
  exports.LucidePlus = Plus;
  exports.LucidePlusCircle = CirclePlus;
  exports.LucidePlusSquare = SquarePlus;
  exports.LucidePocket = Pocket;
  exports.LucidePocketKnife = PocketKnife;
  exports.LucidePodcast = Podcast;
  exports.LucidePointer = Pointer;
  exports.LucidePointerOff = PointerOff;
  exports.LucidePopcorn = Popcorn;
  exports.LucidePopsicle = Popsicle;
  exports.LucidePoundSterling = PoundSterling;
  exports.LucidePower = Power;
  exports.LucidePowerCircle = CirclePower;
  exports.LucidePowerOff = PowerOff;
  exports.LucidePowerSquare = SquarePower;
  exports.LucidePresentation = Presentation;
  exports.LucidePrinter = Printer;
  exports.LucidePrinterCheck = PrinterCheck;
  exports.LucideProjector = Projector;
  exports.LucideProportions = Proportions;
  exports.LucidePuzzle = Puzzle;
  exports.LucidePyramid = Pyramid;
  exports.LucideQrCode = QrCode;
  exports.LucideQuote = Quote;
  exports.LucideRabbit = Rabbit;
  exports.LucideRadar = Radar;
  exports.LucideRadiation = Radiation;
  exports.LucideRadical = Radical;
  exports.LucideRadio = Radio;
  exports.LucideRadioReceiver = RadioReceiver;
  exports.LucideRadioTower = RadioTower;
  exports.LucideRadius = Radius;
  exports.LucideRailSymbol = RailSymbol;
  exports.LucideRainbow = Rainbow;
  exports.LucideRat = Rat;
  exports.LucideRatio = Ratio;
  exports.LucideReceipt = Receipt;
  exports.LucideReceiptCent = ReceiptCent;
  exports.LucideReceiptEuro = ReceiptEuro;
  exports.LucideReceiptIndianRupee = ReceiptIndianRupee;
  exports.LucideReceiptJapaneseYen = ReceiptJapaneseYen;
  exports.LucideReceiptPoundSterling = ReceiptPoundSterling;
  exports.LucideReceiptRussianRuble = ReceiptRussianRuble;
  exports.LucideReceiptSwissFranc = ReceiptSwissFranc;
  exports.LucideReceiptText = ReceiptText;
  exports.LucideRectangleCircle = RectangleCircle;
  exports.LucideRectangleEllipsis = RectangleEllipsis;
  exports.LucideRectangleGoggles = RectangleGoggles;
  exports.LucideRectangleHorizontal = RectangleHorizontal;
  exports.LucideRectangleVertical = RectangleVertical;
  exports.LucideRecycle = Recycle;
  exports.LucideRedo = Redo;
  exports.LucideRedo2 = Redo2;
  exports.LucideRedoDot = RedoDot;
  exports.LucideRefreshCcw = RefreshCcw;
  exports.LucideRefreshCcwDot = RefreshCcwDot;
  exports.LucideRefreshCw = RefreshCw;
  exports.LucideRefreshCwOff = RefreshCwOff;
  exports.LucideRefrigerator = Refrigerator;
  exports.LucideRegex = Regex;
  exports.LucideRemoveFormatting = RemoveFormatting;
  exports.LucideRepeat = Repeat;
  exports.LucideRepeat1 = Repeat1;
  exports.LucideRepeat2 = Repeat2;
  exports.LucideReplace = Replace;
  exports.LucideReplaceAll = ReplaceAll;
  exports.LucideReply = Reply;
  exports.LucideReplyAll = ReplyAll;
  exports.LucideRewind = Rewind;
  exports.LucideRibbon = Ribbon;
  exports.LucideRocket = Rocket;
  exports.LucideRockingChair = RockingChair;
  exports.LucideRollerCoaster = RollerCoaster;
  exports.LucideRotate3D = Rotate3d;
  exports.LucideRotate3d = Rotate3d;
  exports.LucideRotateCcw = RotateCcw;
  exports.LucideRotateCcwKey = RotateCcwKey;
  exports.LucideRotateCcwSquare = RotateCcwSquare;
  exports.LucideRotateCw = RotateCw;
  exports.LucideRotateCwSquare = RotateCwSquare;
  exports.LucideRoute = Route;
  exports.LucideRouteOff = RouteOff;
  exports.LucideRouter = Router;
  exports.LucideRows = Rows2;
  exports.LucideRows2 = Rows2;
  exports.LucideRows3 = Rows3;
  exports.LucideRows4 = Rows4;
  exports.LucideRss = Rss;
  exports.LucideRuler = Ruler;
  exports.LucideRulerDimensionLine = RulerDimensionLine;
  exports.LucideRussianRuble = RussianRuble;
  exports.LucideSailboat = Sailboat;
  exports.LucideSalad = Salad;
  exports.LucideSandwich = Sandwich;
  exports.LucideSatellite = Satellite;
  exports.LucideSatelliteDish = SatelliteDish;
  exports.LucideSaudiRiyal = SaudiRiyal;
  exports.LucideSave = Save;
  exports.LucideSaveAll = SaveAll;
  exports.LucideSaveOff = SaveOff;
  exports.LucideScale = Scale;
  exports.LucideScale3D = Scale3d;
  exports.LucideScale3d = Scale3d;
  exports.LucideScaling = Scaling;
  exports.LucideScan = Scan;
  exports.LucideScanBarcode = ScanBarcode;
  exports.LucideScanEye = ScanEye;
  exports.LucideScanFace = ScanFace;
  exports.LucideScanHeart = ScanHeart;
  exports.LucideScanLine = ScanLine;
  exports.LucideScanQrCode = ScanQrCode;
  exports.LucideScanSearch = ScanSearch;
  exports.LucideScanText = ScanText;
  exports.LucideScatterChart = ChartScatter;
  exports.LucideSchool = School;
  exports.LucideSchool2 = University;
  exports.LucideScissors = Scissors;
  exports.LucideScissorsLineDashed = ScissorsLineDashed;
  exports.LucideScissorsSquare = SquareScissors;
  exports.LucideScissorsSquareDashedBottom = SquareBottomDashedScissors;
  exports.LucideScreenShare = ScreenShare;
  exports.LucideScreenShareOff = ScreenShareOff;
  exports.LucideScroll = Scroll;
  exports.LucideScrollText = ScrollText;
  exports.LucideSearch = Search;
  exports.LucideSearchCheck = SearchCheck;
  exports.LucideSearchCode = SearchCode;
  exports.LucideSearchSlash = SearchSlash;
  exports.LucideSearchX = SearchX;
  exports.LucideSection = Section;
  exports.LucideSend = Send;
  exports.LucideSendHorizonal = SendHorizontal;
  exports.LucideSendHorizontal = SendHorizontal;
  exports.LucideSendToBack = SendToBack;
  exports.LucideSeparatorHorizontal = SeparatorHorizontal;
  exports.LucideSeparatorVertical = SeparatorVertical;
  exports.LucideServer = Server;
  exports.LucideServerCog = ServerCog;
  exports.LucideServerCrash = ServerCrash;
  exports.LucideServerOff = ServerOff;
  exports.LucideSettings = Settings;
  exports.LucideSettings2 = Settings2;
  exports.LucideShapes = Shapes;
  exports.LucideShare = Share;
  exports.LucideShare2 = Share2;
  exports.LucideSheet = Sheet;
  exports.LucideShell = Shell;
  exports.LucideShield = Shield;
  exports.LucideShieldAlert = ShieldAlert;
  exports.LucideShieldBan = ShieldBan;
  exports.LucideShieldCheck = ShieldCheck;
  exports.LucideShieldClose = ShieldX;
  exports.LucideShieldEllipsis = ShieldEllipsis;
  exports.LucideShieldHalf = ShieldHalf;
  exports.LucideShieldMinus = ShieldMinus;
  exports.LucideShieldOff = ShieldOff;
  exports.LucideShieldPlus = ShieldPlus;
  exports.LucideShieldQuestion = ShieldQuestionMark;
  exports.LucideShieldQuestionMark = ShieldQuestionMark;
  exports.LucideShieldUser = ShieldUser;
  exports.LucideShieldX = ShieldX;
  exports.LucideShip = Ship;
  exports.LucideShipWheel = ShipWheel;
  exports.LucideShirt = Shirt;
  exports.LucideShoppingBag = ShoppingBag;
  exports.LucideShoppingBasket = ShoppingBasket;
  exports.LucideShoppingCart = ShoppingCart;
  exports.LucideShovel = Shovel;
  exports.LucideShowerHead = ShowerHead;
  exports.LucideShredder = Shredder;
  exports.LucideShrimp = Shrimp;
  exports.LucideShrink = Shrink;
  exports.LucideShrub = Shrub;
  exports.LucideShuffle = Shuffle;
  exports.LucideSidebar = PanelLeft;
  exports.LucideSidebarClose = PanelLeftClose;
  exports.LucideSidebarOpen = PanelLeftOpen;
  exports.LucideSigma = Sigma;
  exports.LucideSigmaSquare = SquareSigma;
  exports.LucideSignal = Signal;
  exports.LucideSignalHigh = SignalHigh;
  exports.LucideSignalLow = SignalLow;
  exports.LucideSignalMedium = SignalMedium;
  exports.LucideSignalZero = SignalZero;
  exports.LucideSignature = Signature;
  exports.LucideSignpost = Signpost;
  exports.LucideSignpostBig = SignpostBig;
  exports.LucideSiren = Siren;
  exports.LucideSkipBack = SkipBack;
  exports.LucideSkipForward = SkipForward;
  exports.LucideSkull = Skull;
  exports.LucideSlack = Slack;
  exports.LucideSlash = Slash;
  exports.LucideSlashSquare = SquareSlash;
  exports.LucideSlice = Slice;
  exports.LucideSliders = SlidersVertical;
  exports.LucideSlidersHorizontal = SlidersHorizontal;
  exports.LucideSlidersVertical = SlidersVertical;
  exports.LucideSmartphone = Smartphone;
  exports.LucideSmartphoneCharging = SmartphoneCharging;
  exports.LucideSmartphoneNfc = SmartphoneNfc;
  exports.LucideSmile = Smile;
  exports.LucideSmilePlus = SmilePlus;
  exports.LucideSnail = Snail;
  exports.LucideSnowflake = Snowflake;
  exports.LucideSoapDispenserDroplet = SoapDispenserDroplet;
  exports.LucideSofa = Sofa;
  exports.LucideSortAsc = ArrowUpNarrowWide;
  exports.LucideSortDesc = ArrowDownWideNarrow;
  exports.LucideSoup = Soup;
  exports.LucideSpace = Space;
  exports.LucideSpade = Spade;
  exports.LucideSparkle = Sparkle;
  exports.LucideSparkles = Sparkles;
  exports.LucideSpeaker = Speaker;
  exports.LucideSpeech = Speech;
  exports.LucideSpellCheck = SpellCheck;
  exports.LucideSpellCheck2 = SpellCheck2;
  exports.LucideSpline = Spline;
  exports.LucideSplinePointer = SplinePointer;
  exports.LucideSplit = Split;
  exports.LucideSplitSquareHorizontal = SquareSplitHorizontal;
  exports.LucideSplitSquareVertical = SquareSplitVertical;
  exports.LucideSpool = Spool;
  exports.LucideSprayCan = SprayCan;
  exports.LucideSprout = Sprout;
  exports.LucideSquare = Square;
  exports.LucideSquareActivity = SquareActivity;
  exports.LucideSquareArrowDown = SquareArrowDown;
  exports.LucideSquareArrowDownLeft = SquareArrowDownLeft;
  exports.LucideSquareArrowDownRight = SquareArrowDownRight;
  exports.LucideSquareArrowLeft = SquareArrowLeft;
  exports.LucideSquareArrowOutDownLeft = SquareArrowOutDownLeft;
  exports.LucideSquareArrowOutDownRight = SquareArrowOutDownRight;
  exports.LucideSquareArrowOutUpLeft = SquareArrowOutUpLeft;
  exports.LucideSquareArrowOutUpRight = SquareArrowOutUpRight;
  exports.LucideSquareArrowRight = SquareArrowRight;
  exports.LucideSquareArrowUp = SquareArrowUp;
  exports.LucideSquareArrowUpLeft = SquareArrowUpLeft;
  exports.LucideSquareArrowUpRight = SquareArrowUpRight;
  exports.LucideSquareAsterisk = SquareAsterisk;
  exports.LucideSquareBottomDashedScissors = SquareBottomDashedScissors;
  exports.LucideSquareChartGantt = SquareChartGantt;
  exports.LucideSquareCheck = SquareCheck;
  exports.LucideSquareCheckBig = SquareCheckBig;
  exports.LucideSquareChevronDown = SquareChevronDown;
  exports.LucideSquareChevronLeft = SquareChevronLeft;
  exports.LucideSquareChevronRight = SquareChevronRight;
  exports.LucideSquareChevronUp = SquareChevronUp;
  exports.LucideSquareCode = SquareCode;
  exports.LucideSquareDashed = SquareDashed;
  exports.LucideSquareDashedBottom = SquareDashedBottom;
  exports.LucideSquareDashedBottomCode = SquareDashedBottomCode;
  exports.LucideSquareDashedKanban = SquareDashedKanban;
  exports.LucideSquareDashedMousePointer = SquareDashedMousePointer;
  exports.LucideSquareDashedTopSolid = SquareDashedTopSolid;
  exports.LucideSquareDivide = SquareDivide;
  exports.LucideSquareDot = SquareDot;
  exports.LucideSquareEqual = SquareEqual;
  exports.LucideSquareFunction = SquareFunction;
  exports.LucideSquareGanttChart = SquareChartGantt;
  exports.LucideSquareKanban = SquareKanban;
  exports.LucideSquareLibrary = SquareLibrary;
  exports.LucideSquareM = SquareM;
  exports.LucideSquareMenu = SquareMenu;
  exports.LucideSquareMinus = SquareMinus;
  exports.LucideSquareMousePointer = SquareMousePointer;
  exports.LucideSquareParking = SquareParking;
  exports.LucideSquareParkingOff = SquareParkingOff;
  exports.LucideSquarePen = SquarePen;
  exports.LucideSquarePercent = SquarePercent;
  exports.LucideSquarePi = SquarePi;
  exports.LucideSquarePilcrow = SquarePilcrow;
  exports.LucideSquarePlay = SquarePlay;
  exports.LucideSquarePlus = SquarePlus;
  exports.LucideSquarePower = SquarePower;
  exports.LucideSquareRadical = SquareRadical;
  exports.LucideSquareRoundCorner = SquareRoundCorner;
  exports.LucideSquareScissors = SquareScissors;
  exports.LucideSquareSigma = SquareSigma;
  exports.LucideSquareSlash = SquareSlash;
  exports.LucideSquareSplitHorizontal = SquareSplitHorizontal;
  exports.LucideSquareSplitVertical = SquareSplitVertical;
  exports.LucideSquareSquare = SquareSquare;
  exports.LucideSquareStack = SquareStack;
  exports.LucideSquareTerminal = SquareTerminal;
  exports.LucideSquareUser = SquareUser;
  exports.LucideSquareUserRound = SquareUserRound;
  exports.LucideSquareX = SquareX;
  exports.LucideSquaresExclude = SquaresExclude;
  exports.LucideSquaresIntersect = SquaresIntersect;
  exports.LucideSquaresSubtract = SquaresSubtract;
  exports.LucideSquaresUnite = SquaresUnite;
  exports.LucideSquircle = Squircle;
  exports.LucideSquircleDashed = SquircleDashed;
  exports.LucideSquirrel = Squirrel;
  exports.LucideStamp = Stamp;
  exports.LucideStar = Star;
  exports.LucideStarHalf = StarHalf;
  exports.LucideStarOff = StarOff;
  exports.LucideStars = Sparkles;
  exports.LucideStepBack = StepBack;
  exports.LucideStepForward = StepForward;
  exports.LucideStethoscope = Stethoscope;
  exports.LucideSticker = Sticker;
  exports.LucideStickyNote = StickyNote;
  exports.LucideStopCircle = CircleStop;
  exports.LucideStore = Store;
  exports.LucideStretchHorizontal = StretchHorizontal;
  exports.LucideStretchVertical = StretchVertical;
  exports.LucideStrikethrough = Strikethrough;
  exports.LucideSubscript = Subscript;
  exports.LucideSubtitles = Captions;
  exports.LucideSun = Sun;
  exports.LucideSunDim = SunDim;
  exports.LucideSunMedium = SunMedium;
  exports.LucideSunMoon = SunMoon;
  exports.LucideSunSnow = SunSnow;
  exports.LucideSunrise = Sunrise;
  exports.LucideSunset = Sunset;
  exports.LucideSuperscript = Superscript;
  exports.LucideSwatchBook = SwatchBook;
  exports.LucideSwissFranc = SwissFranc;
  exports.LucideSwitchCamera = SwitchCamera;
  exports.LucideSword = Sword;
  exports.LucideSwords = Swords;
  exports.LucideSyringe = Syringe;
  exports.LucideTable = Table;
  exports.LucideTable2 = Table2;
  exports.LucideTableCellsMerge = TableCellsMerge;
  exports.LucideTableCellsSplit = TableCellsSplit;
  exports.LucideTableColumnsSplit = TableColumnsSplit;
  exports.LucideTableConfig = Columns3Cog;
  exports.LucideTableOfContents = TableOfContents;
  exports.LucideTableProperties = TableProperties;
  exports.LucideTableRowsSplit = TableRowsSplit;
  exports.LucideTablet = Tablet;
  exports.LucideTabletSmartphone = TabletSmartphone;
  exports.LucideTablets = Tablets;
  exports.LucideTag = Tag;
  exports.LucideTags = Tags;
  exports.LucideTally1 = Tally1;
  exports.LucideTally2 = Tally2;
  exports.LucideTally3 = Tally3;
  exports.LucideTally4 = Tally4;
  exports.LucideTally5 = Tally5;
  exports.LucideTangent = Tangent;
  exports.LucideTarget = Target;
  exports.LucideTelescope = Telescope;
  exports.LucideTent = Tent;
  exports.LucideTentTree = TentTree;
  exports.LucideTerminal = Terminal;
  exports.LucideTerminalSquare = SquareTerminal;
  exports.LucideTestTube = TestTube;
  exports.LucideTestTube2 = TestTubeDiagonal;
  exports.LucideTestTubeDiagonal = TestTubeDiagonal;
  exports.LucideTestTubes = TestTubes;
  exports.LucideText = Text;
  exports.LucideTextCursor = TextCursor;
  exports.LucideTextCursorInput = TextCursorInput;
  exports.LucideTextQuote = TextQuote;
  exports.LucideTextSearch = TextSearch;
  exports.LucideTextSelect = TextSelect;
  exports.LucideTextSelection = TextSelect;
  exports.LucideTheater = Theater;
  exports.LucideThermometer = Thermometer;
  exports.LucideThermometerSnowflake = ThermometerSnowflake;
  exports.LucideThermometerSun = ThermometerSun;
  exports.LucideThumbsDown = ThumbsDown;
  exports.LucideThumbsUp = ThumbsUp;
  exports.LucideTicket = Ticket;
  exports.LucideTicketCheck = TicketCheck;
  exports.LucideTicketMinus = TicketMinus;
  exports.LucideTicketPercent = TicketPercent;
  exports.LucideTicketPlus = TicketPlus;
  exports.LucideTicketSlash = TicketSlash;
  exports.LucideTicketX = TicketX;
  exports.LucideTickets = Tickets;
  exports.LucideTicketsPlane = TicketsPlane;
  exports.LucideTimer = Timer;
  exports.LucideTimerOff = TimerOff;
  exports.LucideTimerReset = TimerReset;
  exports.LucideToggleLeft = ToggleLeft;
  exports.LucideToggleRight = ToggleRight;
  exports.LucideToilet = Toilet;
  exports.LucideTornado = Tornado;
  exports.LucideTorus = Torus;
  exports.LucideTouchpad = Touchpad;
  exports.LucideTouchpadOff = TouchpadOff;
  exports.LucideTowerControl = TowerControl;
  exports.LucideToyBrick = ToyBrick;
  exports.LucideTractor = Tractor;
  exports.LucideTrafficCone = TrafficCone;
  exports.LucideTrain = TramFront;
  exports.LucideTrainFront = TrainFront;
  exports.LucideTrainFrontTunnel = TrainFrontTunnel;
  exports.LucideTrainTrack = TrainTrack;
  exports.LucideTramFront = TramFront;
  exports.LucideTransgender = Transgender;
  exports.LucideTrash = Trash;
  exports.LucideTrash2 = Trash2;
  exports.LucideTreeDeciduous = TreeDeciduous;
  exports.LucideTreePalm = TreePalm;
  exports.LucideTreePine = TreePine;
  exports.LucideTrees = Trees;
  exports.LucideTrello = Trello;
  exports.LucideTrendingDown = TrendingDown;
  exports.LucideTrendingUp = TrendingUp;
  exports.LucideTrendingUpDown = TrendingUpDown;
  exports.LucideTriangle = Triangle;
  exports.LucideTriangleAlert = TriangleAlert;
  exports.LucideTriangleDashed = TriangleDashed;
  exports.LucideTriangleRight = TriangleRight;
  exports.LucideTrophy = Trophy;
  exports.LucideTruck = Truck;
  exports.LucideTruckElectric = TruckElectric;
  exports.LucideTurtle = Turtle;
  exports.LucideTv = Tv;
  exports.LucideTv2 = TvMinimal;
  exports.LucideTvMinimal = TvMinimal;
  exports.LucideTvMinimalPlay = TvMinimalPlay;
  exports.LucideTwitch = Twitch;
  exports.LucideTwitter = Twitter;
  exports.LucideType = Type;
  exports.LucideTypeOutline = TypeOutline;
  exports.LucideUmbrella = Umbrella;
  exports.LucideUmbrellaOff = UmbrellaOff;
  exports.LucideUnderline = Underline;
  exports.LucideUndo = Undo;
  exports.LucideUndo2 = Undo2;
  exports.LucideUndoDot = UndoDot;
  exports.LucideUnfoldHorizontal = UnfoldHorizontal;
  exports.LucideUnfoldVertical = UnfoldVertical;
  exports.LucideUngroup = Ungroup;
  exports.LucideUniversity = University;
  exports.LucideUnlink = Unlink;
  exports.LucideUnlink2 = Unlink2;
  exports.LucideUnlock = LockOpen;
  exports.LucideUnlockKeyhole = LockKeyholeOpen;
  exports.LucideUnplug = Unplug;
  exports.LucideUpload = Upload;
  exports.LucideUploadCloud = CloudUpload;
  exports.LucideUsb = Usb;
  exports.LucideUser = User;
  exports.LucideUser2 = UserRound;
  exports.LucideUserCheck = UserCheck;
  exports.LucideUserCheck2 = UserRoundCheck;
  exports.LucideUserCircle = CircleUser;
  exports.LucideUserCircle2 = CircleUserRound;
  exports.LucideUserCog = UserCog;
  exports.LucideUserCog2 = UserRoundCog;
  exports.LucideUserLock = UserLock;
  exports.LucideUserMinus = UserMinus;
  exports.LucideUserMinus2 = UserRoundMinus;
  exports.LucideUserPen = UserPen;
  exports.LucideUserPlus = UserPlus;
  exports.LucideUserPlus2 = UserRoundPlus;
  exports.LucideUserRound = UserRound;
  exports.LucideUserRoundCheck = UserRoundCheck;
  exports.LucideUserRoundCog = UserRoundCog;
  exports.LucideUserRoundMinus = UserRoundMinus;
  exports.LucideUserRoundPen = UserRoundPen;
  exports.LucideUserRoundPlus = UserRoundPlus;
  exports.LucideUserRoundSearch = UserRoundSearch;
  exports.LucideUserRoundX = UserRoundX;
  exports.LucideUserSearch = UserSearch;
  exports.LucideUserSquare = SquareUser;
  exports.LucideUserSquare2 = SquareUserRound;
  exports.LucideUserX = UserX;
  exports.LucideUserX2 = UserRoundX;
  exports.LucideUsers = Users;
  exports.LucideUsers2 = UsersRound;
  exports.LucideUsersRound = UsersRound;
  exports.LucideUtensils = Utensils;
  exports.LucideUtensilsCrossed = UtensilsCrossed;
  exports.LucideUtilityPole = UtilityPole;
  exports.LucideVariable = Variable;
  exports.LucideVault = Vault;
  exports.LucideVegan = Vegan;
  exports.LucideVenetianMask = VenetianMask;
  exports.LucideVenus = Venus;
  exports.LucideVenusAndMars = VenusAndMars;
  exports.LucideVerified = BadgeCheck;
  exports.LucideVibrate = Vibrate;
  exports.LucideVibrateOff = VibrateOff;
  exports.LucideVideo = Video;
  exports.LucideVideoOff = VideoOff;
  exports.LucideVideotape = Videotape;
  exports.LucideView = View;
  exports.LucideVoicemail = Voicemail;
  exports.LucideVolleyball = Volleyball;
  exports.LucideVolume = Volume;
  exports.LucideVolume1 = Volume1;
  exports.LucideVolume2 = Volume2;
  exports.LucideVolumeOff = VolumeOff;
  exports.LucideVolumeX = VolumeX;
  exports.LucideVote = Vote;
  exports.LucideWallet = Wallet;
  exports.LucideWallet2 = WalletMinimal;
  exports.LucideWalletCards = WalletCards;
  exports.LucideWalletMinimal = WalletMinimal;
  exports.LucideWallpaper = Wallpaper;
  exports.LucideWand = Wand;
  exports.LucideWand2 = WandSparkles;
  exports.LucideWandSparkles = WandSparkles;
  exports.LucideWarehouse = Warehouse;
  exports.LucideWashingMachine = WashingMachine;
  exports.LucideWatch = Watch;
  exports.LucideWaves = Waves;
  exports.LucideWavesLadder = WavesLadder;
  exports.LucideWaypoints = Waypoints;
  exports.LucideWebcam = Webcam;
  exports.LucideWebhook = Webhook;
  exports.LucideWebhookOff = WebhookOff;
  exports.LucideWeight = Weight;
  exports.LucideWheat = Wheat;
  exports.LucideWheatOff = WheatOff;
  exports.LucideWholeWord = WholeWord;
  exports.LucideWifi = Wifi;
  exports.LucideWifiCog = WifiCog;
  exports.LucideWifiHigh = WifiHigh;
  exports.LucideWifiLow = WifiLow;
  exports.LucideWifiOff = WifiOff;
  exports.LucideWifiPen = WifiPen;
  exports.LucideWifiZero = WifiZero;
  exports.LucideWind = Wind;
  exports.LucideWindArrowDown = WindArrowDown;
  exports.LucideWine = Wine;
  exports.LucideWineOff = WineOff;
  exports.LucideWorkflow = Workflow;
  exports.LucideWorm = Worm;
  exports.LucideWrapText = WrapText;
  exports.LucideWrench = Wrench;
  exports.LucideX = X;
  exports.LucideXCircle = CircleX;
  exports.LucideXOctagon = OctagonX;
  exports.LucideXSquare = SquareX;
  exports.LucideYoutube = Youtube;
  exports.LucideZap = Zap;
  exports.LucideZapOff = ZapOff;
  exports.LucideZoomIn = ZoomIn;
  exports.LucideZoomOut = ZoomOut;
  exports.Luggage = Luggage;
  exports.LuggageIcon = Luggage;
  exports.MSquare = SquareM;
  exports.MSquareIcon = SquareM;
  exports.Magnet = Magnet;
  exports.MagnetIcon = Magnet;
  exports.Mail = Mail;
  exports.MailCheck = MailCheck;
  exports.MailCheckIcon = MailCheck;
  exports.MailIcon = Mail;
  exports.MailMinus = MailMinus;
  exports.MailMinusIcon = MailMinus;
  exports.MailOpen = MailOpen;
  exports.MailOpenIcon = MailOpen;
  exports.MailPlus = MailPlus;
  exports.MailPlusIcon = MailPlus;
  exports.MailQuestion = MailQuestionMark;
  exports.MailQuestionIcon = MailQuestionMark;
  exports.MailQuestionMark = MailQuestionMark;
  exports.MailQuestionMarkIcon = MailQuestionMark;
  exports.MailSearch = MailSearch;
  exports.MailSearchIcon = MailSearch;
  exports.MailWarning = MailWarning;
  exports.MailWarningIcon = MailWarning;
  exports.MailX = MailX;
  exports.MailXIcon = MailX;
  exports.Mailbox = Mailbox;
  exports.MailboxIcon = Mailbox;
  exports.Mails = Mails;
  exports.MailsIcon = Mails;
  exports.Map = Map;
  exports.MapIcon = Map;
  exports.MapPin = MapPin;
  exports.MapPinCheck = MapPinCheck;
  exports.MapPinCheckIcon = MapPinCheck;
  exports.MapPinCheckInside = MapPinCheckInside;
  exports.MapPinCheckInsideIcon = MapPinCheckInside;
  exports.MapPinHouse = MapPinHouse;
  exports.MapPinHouseIcon = MapPinHouse;
  exports.MapPinIcon = MapPin;
  exports.MapPinMinus = MapPinMinus;
  exports.MapPinMinusIcon = MapPinMinus;
  exports.MapPinMinusInside = MapPinMinusInside;
  exports.MapPinMinusInsideIcon = MapPinMinusInside;
  exports.MapPinOff = MapPinOff;
  exports.MapPinOffIcon = MapPinOff;
  exports.MapPinPlus = MapPinPlus;
  exports.MapPinPlusIcon = MapPinPlus;
  exports.MapPinPlusInside = MapPinPlusInside;
  exports.MapPinPlusInsideIcon = MapPinPlusInside;
  exports.MapPinX = MapPinX;
  exports.MapPinXIcon = MapPinX;
  exports.MapPinXInside = MapPinXInside;
  exports.MapPinXInsideIcon = MapPinXInside;
  exports.MapPinned = MapPinned;
  exports.MapPinnedIcon = MapPinned;
  exports.MapPlus = MapPlus;
  exports.MapPlusIcon = MapPlus;
  exports.Mars = Mars;
  exports.MarsIcon = Mars;
  exports.MarsStroke = MarsStroke;
  exports.MarsStrokeIcon = MarsStroke;
  exports.Martini = Martini;
  exports.MartiniIcon = Martini;
  exports.Maximize = Maximize;
  exports.Maximize2 = Maximize2;
  exports.Maximize2Icon = Maximize2;
  exports.MaximizeIcon = Maximize;
  exports.Medal = Medal;
  exports.MedalIcon = Medal;
  exports.Megaphone = Megaphone;
  exports.MegaphoneIcon = Megaphone;
  exports.MegaphoneOff = MegaphoneOff;
  exports.MegaphoneOffIcon = MegaphoneOff;
  exports.Meh = Meh;
  exports.MehIcon = Meh;
  exports.MemoryStick = MemoryStick;
  exports.MemoryStickIcon = MemoryStick;
  exports.Menu = Menu;
  exports.MenuIcon = Menu;
  exports.MenuSquare = SquareMenu;
  exports.MenuSquareIcon = SquareMenu;
  exports.Merge = Merge;
  exports.MergeIcon = Merge;
  exports.MessageCircle = MessageCircle;
  exports.MessageCircleCode = MessageCircleCode;
  exports.MessageCircleCodeIcon = MessageCircleCode;
  exports.MessageCircleDashed = MessageCircleDashed;
  exports.MessageCircleDashedIcon = MessageCircleDashed;
  exports.MessageCircleHeart = MessageCircleHeart;
  exports.MessageCircleHeartIcon = MessageCircleHeart;
  exports.MessageCircleIcon = MessageCircle;
  exports.MessageCircleMore = MessageCircleMore;
  exports.MessageCircleMoreIcon = MessageCircleMore;
  exports.MessageCircleOff = MessageCircleOff;
  exports.MessageCircleOffIcon = MessageCircleOff;
  exports.MessageCirclePlus = MessageCirclePlus;
  exports.MessageCirclePlusIcon = MessageCirclePlus;
  exports.MessageCircleQuestion = MessageCircleQuestionMark;
  exports.MessageCircleQuestionIcon = MessageCircleQuestionMark;
  exports.MessageCircleQuestionMark = MessageCircleQuestionMark;
  exports.MessageCircleQuestionMarkIcon = MessageCircleQuestionMark;
  exports.MessageCircleReply = MessageCircleReply;
  exports.MessageCircleReplyIcon = MessageCircleReply;
  exports.MessageCircleWarning = MessageCircleWarning;
  exports.MessageCircleWarningIcon = MessageCircleWarning;
  exports.MessageCircleX = MessageCircleX;
  exports.MessageCircleXIcon = MessageCircleX;
  exports.MessageSquare = MessageSquare;
  exports.MessageSquareCode = MessageSquareCode;
  exports.MessageSquareCodeIcon = MessageSquareCode;
  exports.MessageSquareDashed = MessageSquareDashed;
  exports.MessageSquareDashedIcon = MessageSquareDashed;
  exports.MessageSquareDiff = MessageSquareDiff;
  exports.MessageSquareDiffIcon = MessageSquareDiff;
  exports.MessageSquareDot = MessageSquareDot;
  exports.MessageSquareDotIcon = MessageSquareDot;
  exports.MessageSquareHeart = MessageSquareHeart;
  exports.MessageSquareHeartIcon = MessageSquareHeart;
  exports.MessageSquareIcon = MessageSquare;
  exports.MessageSquareLock = MessageSquareLock;
  exports.MessageSquareLockIcon = MessageSquareLock;
  exports.MessageSquareMore = MessageSquareMore;
  exports.MessageSquareMoreIcon = MessageSquareMore;
  exports.MessageSquareOff = MessageSquareOff;
  exports.MessageSquareOffIcon = MessageSquareOff;
  exports.MessageSquarePlus = MessageSquarePlus;
  exports.MessageSquarePlusIcon = MessageSquarePlus;
  exports.MessageSquareQuote = MessageSquareQuote;
  exports.MessageSquareQuoteIcon = MessageSquareQuote;
  exports.MessageSquareReply = MessageSquareReply;
  exports.MessageSquareReplyIcon = MessageSquareReply;
  exports.MessageSquareShare = MessageSquareShare;
  exports.MessageSquareShareIcon = MessageSquareShare;
  exports.MessageSquareText = MessageSquareText;
  exports.MessageSquareTextIcon = MessageSquareText;
  exports.MessageSquareWarning = MessageSquareWarning;
  exports.MessageSquareWarningIcon = MessageSquareWarning;
  exports.MessageSquareX = MessageSquareX;
  exports.MessageSquareXIcon = MessageSquareX;
  exports.MessagesSquare = MessagesSquare;
  exports.MessagesSquareIcon = MessagesSquare;
  exports.Mic = Mic;
  exports.Mic2 = MicVocal;
  exports.Mic2Icon = MicVocal;
  exports.MicIcon = Mic;
  exports.MicOff = MicOff;
  exports.MicOffIcon = MicOff;
  exports.MicVocal = MicVocal;
  exports.MicVocalIcon = MicVocal;
  exports.Microchip = Microchip;
  exports.MicrochipIcon = Microchip;
  exports.Microscope = Microscope;
  exports.MicroscopeIcon = Microscope;
  exports.Microwave = Microwave;
  exports.MicrowaveIcon = Microwave;
  exports.Milestone = Milestone;
  exports.MilestoneIcon = Milestone;
  exports.Milk = Milk;
  exports.MilkIcon = Milk;
  exports.MilkOff = MilkOff;
  exports.MilkOffIcon = MilkOff;
  exports.Minimize = Minimize;
  exports.Minimize2 = Minimize2;
  exports.Minimize2Icon = Minimize2;
  exports.MinimizeIcon = Minimize;
  exports.Minus = Minus;
  exports.MinusCircle = CircleMinus;
  exports.MinusCircleIcon = CircleMinus;
  exports.MinusIcon = Minus;
  exports.MinusSquare = SquareMinus;
  exports.MinusSquareIcon = SquareMinus;
  exports.Monitor = Monitor;
  exports.MonitorCheck = MonitorCheck;
  exports.MonitorCheckIcon = MonitorCheck;
  exports.MonitorCog = MonitorCog;
  exports.MonitorCogIcon = MonitorCog;
  exports.MonitorDot = MonitorDot;
  exports.MonitorDotIcon = MonitorDot;
  exports.MonitorDown = MonitorDown;
  exports.MonitorDownIcon = MonitorDown;
  exports.MonitorIcon = Monitor;
  exports.MonitorOff = MonitorOff;
  exports.MonitorOffIcon = MonitorOff;
  exports.MonitorPause = MonitorPause;
  exports.MonitorPauseIcon = MonitorPause;
  exports.MonitorPlay = MonitorPlay;
  exports.MonitorPlayIcon = MonitorPlay;
  exports.MonitorSmartphone = MonitorSmartphone;
  exports.MonitorSmartphoneIcon = MonitorSmartphone;
  exports.MonitorSpeaker = MonitorSpeaker;
  exports.MonitorSpeakerIcon = MonitorSpeaker;
  exports.MonitorStop = MonitorStop;
  exports.MonitorStopIcon = MonitorStop;
  exports.MonitorUp = MonitorUp;
  exports.MonitorUpIcon = MonitorUp;
  exports.MonitorX = MonitorX;
  exports.MonitorXIcon = MonitorX;
  exports.Moon = Moon;
  exports.MoonIcon = Moon;
  exports.MoonStar = MoonStar;
  exports.MoonStarIcon = MoonStar;
  exports.MoreHorizontal = Ellipsis;
  exports.MoreHorizontalIcon = Ellipsis;
  exports.MoreVertical = EllipsisVertical;
  exports.MoreVerticalIcon = EllipsisVertical;
  exports.Mountain = Mountain;
  exports.MountainIcon = Mountain;
  exports.MountainSnow = MountainSnow;
  exports.MountainSnowIcon = MountainSnow;
  exports.Mouse = Mouse;
  exports.MouseIcon = Mouse;
  exports.MouseOff = MouseOff;
  exports.MouseOffIcon = MouseOff;
  exports.MousePointer = MousePointer;
  exports.MousePointer2 = MousePointer2;
  exports.MousePointer2Icon = MousePointer2;
  exports.MousePointerBan = MousePointerBan;
  exports.MousePointerBanIcon = MousePointerBan;
  exports.MousePointerClick = MousePointerClick;
  exports.MousePointerClickIcon = MousePointerClick;
  exports.MousePointerIcon = MousePointer;
  exports.MousePointerSquareDashed = SquareDashedMousePointer;
  exports.MousePointerSquareDashedIcon = SquareDashedMousePointer;
  exports.Move = Move;
  exports.Move3D = Move3d;
  exports.Move3DIcon = Move3d;
  exports.Move3d = Move3d;
  exports.Move3dIcon = Move3d;
  exports.MoveDiagonal = MoveDiagonal;
  exports.MoveDiagonal2 = MoveDiagonal2;
  exports.MoveDiagonal2Icon = MoveDiagonal2;
  exports.MoveDiagonalIcon = MoveDiagonal;
  exports.MoveDown = MoveDown;
  exports.MoveDownIcon = MoveDown;
  exports.MoveDownLeft = MoveDownLeft;
  exports.MoveDownLeftIcon = MoveDownLeft;
  exports.MoveDownRight = MoveDownRight;
  exports.MoveDownRightIcon = MoveDownRight;
  exports.MoveHorizontal = MoveHorizontal;
  exports.MoveHorizontalIcon = MoveHorizontal;
  exports.MoveIcon = Move;
  exports.MoveLeft = MoveLeft;
  exports.MoveLeftIcon = MoveLeft;
  exports.MoveRight = MoveRight;
  exports.MoveRightIcon = MoveRight;
  exports.MoveUp = MoveUp;
  exports.MoveUpIcon = MoveUp;
  exports.MoveUpLeft = MoveUpLeft;
  exports.MoveUpLeftIcon = MoveUpLeft;
  exports.MoveUpRight = MoveUpRight;
  exports.MoveUpRightIcon = MoveUpRight;
  exports.MoveVertical = MoveVertical;
  exports.MoveVerticalIcon = MoveVertical;
  exports.Music = Music;
  exports.Music2 = Music2;
  exports.Music2Icon = Music2;
  exports.Music3 = Music3;
  exports.Music3Icon = Music3;
  exports.Music4 = Music4;
  exports.Music4Icon = Music4;
  exports.MusicIcon = Music;
  exports.Navigation = Navigation;
  exports.Navigation2 = Navigation2;
  exports.Navigation2Icon = Navigation2;
  exports.Navigation2Off = Navigation2Off;
  exports.Navigation2OffIcon = Navigation2Off;
  exports.NavigationIcon = Navigation;
  exports.NavigationOff = NavigationOff;
  exports.NavigationOffIcon = NavigationOff;
  exports.Network = Network;
  exports.NetworkIcon = Network;
  exports.Newspaper = Newspaper;
  exports.NewspaperIcon = Newspaper;
  exports.Nfc = Nfc;
  exports.NfcIcon = Nfc;
  exports.NonBinary = NonBinary;
  exports.NonBinaryIcon = NonBinary;
  exports.Notebook = Notebook;
  exports.NotebookIcon = Notebook;
  exports.NotebookPen = NotebookPen;
  exports.NotebookPenIcon = NotebookPen;
  exports.NotebookTabs = NotebookTabs;
  exports.NotebookTabsIcon = NotebookTabs;
  exports.NotebookText = NotebookText;
  exports.NotebookTextIcon = NotebookText;
  exports.NotepadText = NotepadText;
  exports.NotepadTextDashed = NotepadTextDashed;
  exports.NotepadTextDashedIcon = NotepadTextDashed;
  exports.NotepadTextIcon = NotepadText;
  exports.Nut = Nut;
  exports.NutIcon = Nut;
  exports.NutOff = NutOff;
  exports.NutOffIcon = NutOff;
  exports.Octagon = Octagon;
  exports.OctagonAlert = OctagonAlert;
  exports.OctagonAlertIcon = OctagonAlert;
  exports.OctagonIcon = Octagon;
  exports.OctagonMinus = OctagonMinus;
  exports.OctagonMinusIcon = OctagonMinus;
  exports.OctagonPause = OctagonPause;
  exports.OctagonPauseIcon = OctagonPause;
  exports.OctagonX = OctagonX;
  exports.OctagonXIcon = OctagonX;
  exports.Omega = Omega;
  exports.OmegaIcon = Omega;
  exports.Option = Option;
  exports.OptionIcon = Option;
  exports.Orbit = Orbit;
  exports.OrbitIcon = Orbit;
  exports.Origami = Origami;
  exports.OrigamiIcon = Origami;
  exports.Outdent = IndentDecrease;
  exports.OutdentIcon = IndentDecrease;
  exports.Package = Package;
  exports.Package2 = Package2;
  exports.Package2Icon = Package2;
  exports.PackageCheck = PackageCheck;
  exports.PackageCheckIcon = PackageCheck;
  exports.PackageIcon = Package;
  exports.PackageMinus = PackageMinus;
  exports.PackageMinusIcon = PackageMinus;
  exports.PackageOpen = PackageOpen;
  exports.PackageOpenIcon = PackageOpen;
  exports.PackagePlus = PackagePlus;
  exports.PackagePlusIcon = PackagePlus;
  exports.PackageSearch = PackageSearch;
  exports.PackageSearchIcon = PackageSearch;
  exports.PackageX = PackageX;
  exports.PackageXIcon = PackageX;
  exports.PaintBucket = PaintBucket;
  exports.PaintBucketIcon = PaintBucket;
  exports.PaintRoller = PaintRoller;
  exports.PaintRollerIcon = PaintRoller;
  exports.Paintbrush = Paintbrush;
  exports.Paintbrush2 = PaintbrushVertical;
  exports.Paintbrush2Icon = PaintbrushVertical;
  exports.PaintbrushIcon = Paintbrush;
  exports.PaintbrushVertical = PaintbrushVertical;
  exports.PaintbrushVerticalIcon = PaintbrushVertical;
  exports.Palette = Palette;
  exports.PaletteIcon = Palette;
  exports.Palmtree = TreePalm;
  exports.PalmtreeIcon = TreePalm;
  exports.Panda = Panda;
  exports.PandaIcon = Panda;
  exports.PanelBottom = PanelBottom;
  exports.PanelBottomClose = PanelBottomClose;
  exports.PanelBottomCloseIcon = PanelBottomClose;
  exports.PanelBottomDashed = PanelBottomDashed;
  exports.PanelBottomDashedIcon = PanelBottomDashed;
  exports.PanelBottomIcon = PanelBottom;
  exports.PanelBottomInactive = PanelBottomDashed;
  exports.PanelBottomInactiveIcon = PanelBottomDashed;
  exports.PanelBottomOpen = PanelBottomOpen;
  exports.PanelBottomOpenIcon = PanelBottomOpen;
  exports.PanelLeft = PanelLeft;
  exports.PanelLeftClose = PanelLeftClose;
  exports.PanelLeftCloseIcon = PanelLeftClose;
  exports.PanelLeftDashed = PanelLeftDashed;
  exports.PanelLeftDashedIcon = PanelLeftDashed;
  exports.PanelLeftIcon = PanelLeft;
  exports.PanelLeftInactive = PanelLeftDashed;
  exports.PanelLeftInactiveIcon = PanelLeftDashed;
  exports.PanelLeftOpen = PanelLeftOpen;
  exports.PanelLeftOpenIcon = PanelLeftOpen;
  exports.PanelRight = PanelRight;
  exports.PanelRightClose = PanelRightClose;
  exports.PanelRightCloseIcon = PanelRightClose;
  exports.PanelRightDashed = PanelRightDashed;
  exports.PanelRightDashedIcon = PanelRightDashed;
  exports.PanelRightIcon = PanelRight;
  exports.PanelRightInactive = PanelRightDashed;
  exports.PanelRightInactiveIcon = PanelRightDashed;
  exports.PanelRightOpen = PanelRightOpen;
  exports.PanelRightOpenIcon = PanelRightOpen;
  exports.PanelTop = PanelTop;
  exports.PanelTopClose = PanelTopClose;
  exports.PanelTopCloseIcon = PanelTopClose;
  exports.PanelTopDashed = PanelTopDashed;
  exports.PanelTopDashedIcon = PanelTopDashed;
  exports.PanelTopIcon = PanelTop;
  exports.PanelTopInactive = PanelTopDashed;
  exports.PanelTopInactiveIcon = PanelTopDashed;
  exports.PanelTopOpen = PanelTopOpen;
  exports.PanelTopOpenIcon = PanelTopOpen;
  exports.PanelsLeftBottom = PanelsLeftBottom;
  exports.PanelsLeftBottomIcon = PanelsLeftBottom;
  exports.PanelsLeftRight = Columns3;
  exports.PanelsLeftRightIcon = Columns3;
  exports.PanelsRightBottom = PanelsRightBottom;
  exports.PanelsRightBottomIcon = PanelsRightBottom;
  exports.PanelsTopBottom = Rows3;
  exports.PanelsTopBottomIcon = Rows3;
  exports.PanelsTopLeft = PanelsTopLeft;
  exports.PanelsTopLeftIcon = PanelsTopLeft;
  exports.Paperclip = Paperclip;
  exports.PaperclipIcon = Paperclip;
  exports.Parentheses = Parentheses;
  exports.ParenthesesIcon = Parentheses;
  exports.ParkingCircle = CircleParking;
  exports.ParkingCircleIcon = CircleParking;
  exports.ParkingCircleOff = CircleParkingOff;
  exports.ParkingCircleOffIcon = CircleParkingOff;
  exports.ParkingMeter = ParkingMeter;
  exports.ParkingMeterIcon = ParkingMeter;
  exports.ParkingSquare = SquareParking;
  exports.ParkingSquareIcon = SquareParking;
  exports.ParkingSquareOff = SquareParkingOff;
  exports.ParkingSquareOffIcon = SquareParkingOff;
  exports.PartyPopper = PartyPopper;
  exports.PartyPopperIcon = PartyPopper;
  exports.Pause = Pause;
  exports.PauseCircle = CirclePause;
  exports.PauseCircleIcon = CirclePause;
  exports.PauseIcon = Pause;
  exports.PauseOctagon = OctagonPause;
  exports.PauseOctagonIcon = OctagonPause;
  exports.PawPrint = PawPrint;
  exports.PawPrintIcon = PawPrint;
  exports.PcCase = PcCase;
  exports.PcCaseIcon = PcCase;
  exports.Pen = Pen;
  exports.PenBox = SquarePen;
  exports.PenBoxIcon = SquarePen;
  exports.PenIcon = Pen;
  exports.PenLine = PenLine;
  exports.PenLineIcon = PenLine;
  exports.PenOff = PenOff;
  exports.PenOffIcon = PenOff;
  exports.PenSquare = SquarePen;
  exports.PenSquareIcon = SquarePen;
  exports.PenTool = PenTool;
  exports.PenToolIcon = PenTool;
  exports.Pencil = Pencil;
  exports.PencilIcon = Pencil;
  exports.PencilLine = PencilLine;
  exports.PencilLineIcon = PencilLine;
  exports.PencilOff = PencilOff;
  exports.PencilOffIcon = PencilOff;
  exports.PencilRuler = PencilRuler;
  exports.PencilRulerIcon = PencilRuler;
  exports.Pentagon = Pentagon;
  exports.PentagonIcon = Pentagon;
  exports.Percent = Percent;
  exports.PercentCircle = CirclePercent;
  exports.PercentCircleIcon = CirclePercent;
  exports.PercentDiamond = DiamondPercent;
  exports.PercentDiamondIcon = DiamondPercent;
  exports.PercentIcon = Percent;
  exports.PercentSquare = SquarePercent;
  exports.PercentSquareIcon = SquarePercent;
  exports.PersonStanding = PersonStanding;
  exports.PersonStandingIcon = PersonStanding;
  exports.PhilippinePeso = PhilippinePeso;
  exports.PhilippinePesoIcon = PhilippinePeso;
  exports.Phone = Phone;
  exports.PhoneCall = PhoneCall;
  exports.PhoneCallIcon = PhoneCall;
  exports.PhoneForwarded = PhoneForwarded;
  exports.PhoneForwardedIcon = PhoneForwarded;
  exports.PhoneIcon = Phone;
  exports.PhoneIncoming = PhoneIncoming;
  exports.PhoneIncomingIcon = PhoneIncoming;
  exports.PhoneMissed = PhoneMissed;
  exports.PhoneMissedIcon = PhoneMissed;
  exports.PhoneOff = PhoneOff;
  exports.PhoneOffIcon = PhoneOff;
  exports.PhoneOutgoing = PhoneOutgoing;
  exports.PhoneOutgoingIcon = PhoneOutgoing;
  exports.Pi = Pi;
  exports.PiIcon = Pi;
  exports.PiSquare = SquarePi;
  exports.PiSquareIcon = SquarePi;
  exports.Piano = Piano;
  exports.PianoIcon = Piano;
  exports.Pickaxe = Pickaxe;
  exports.PickaxeIcon = Pickaxe;
  exports.PictureInPicture = PictureInPicture;
  exports.PictureInPicture2 = PictureInPicture2;
  exports.PictureInPicture2Icon = PictureInPicture2;
  exports.PictureInPictureIcon = PictureInPicture;
  exports.PieChart = ChartPie;
  exports.PieChartIcon = ChartPie;
  exports.PiggyBank = PiggyBank;
  exports.PiggyBankIcon = PiggyBank;
  exports.Pilcrow = Pilcrow;
  exports.PilcrowIcon = Pilcrow;
  exports.PilcrowLeft = PilcrowLeft;
  exports.PilcrowLeftIcon = PilcrowLeft;
  exports.PilcrowRight = PilcrowRight;
  exports.PilcrowRightIcon = PilcrowRight;
  exports.PilcrowSquare = SquarePilcrow;
  exports.PilcrowSquareIcon = SquarePilcrow;
  exports.Pill = Pill;
  exports.PillBottle = PillBottle;
  exports.PillBottleIcon = PillBottle;
  exports.PillIcon = Pill;
  exports.Pin = Pin;
  exports.PinIcon = Pin;
  exports.PinOff = PinOff;
  exports.PinOffIcon = PinOff;
  exports.Pipette = Pipette;
  exports.PipetteIcon = Pipette;
  exports.Pizza = Pizza;
  exports.PizzaIcon = Pizza;
  exports.Plane = Plane;
  exports.PlaneIcon = Plane;
  exports.PlaneLanding = PlaneLanding;
  exports.PlaneLandingIcon = PlaneLanding;
  exports.PlaneTakeoff = PlaneTakeoff;
  exports.PlaneTakeoffIcon = PlaneTakeoff;
  exports.Play = Play;
  exports.PlayCircle = CirclePlay;
  exports.PlayCircleIcon = CirclePlay;
  exports.PlayIcon = Play;
  exports.PlaySquare = SquarePlay;
  exports.PlaySquareIcon = SquarePlay;
  exports.Plug = Plug;
  exports.Plug2 = Plug2;
  exports.Plug2Icon = Plug2;
  exports.PlugIcon = Plug;
  exports.PlugZap = PlugZap;
  exports.PlugZap2 = PlugZap;
  exports.PlugZap2Icon = PlugZap;
  exports.PlugZapIcon = PlugZap;
  exports.Plus = Plus;
  exports.PlusCircle = CirclePlus;
  exports.PlusCircleIcon = CirclePlus;
  exports.PlusIcon = Plus;
  exports.PlusSquare = SquarePlus;
  exports.PlusSquareIcon = SquarePlus;
  exports.Pocket = Pocket;
  exports.PocketIcon = Pocket;
  exports.PocketKnife = PocketKnife;
  exports.PocketKnifeIcon = PocketKnife;
  exports.Podcast = Podcast;
  exports.PodcastIcon = Podcast;
  exports.Pointer = Pointer;
  exports.PointerIcon = Pointer;
  exports.PointerOff = PointerOff;
  exports.PointerOffIcon = PointerOff;
  exports.Popcorn = Popcorn;
  exports.PopcornIcon = Popcorn;
  exports.Popsicle = Popsicle;
  exports.PopsicleIcon = Popsicle;
  exports.PoundSterling = PoundSterling;
  exports.PoundSterlingIcon = PoundSterling;
  exports.Power = Power;
  exports.PowerCircle = CirclePower;
  exports.PowerCircleIcon = CirclePower;
  exports.PowerIcon = Power;
  exports.PowerOff = PowerOff;
  exports.PowerOffIcon = PowerOff;
  exports.PowerSquare = SquarePower;
  exports.PowerSquareIcon = SquarePower;
  exports.Presentation = Presentation;
  exports.PresentationIcon = Presentation;
  exports.Printer = Printer;
  exports.PrinterCheck = PrinterCheck;
  exports.PrinterCheckIcon = PrinterCheck;
  exports.PrinterIcon = Printer;
  exports.Projector = Projector;
  exports.ProjectorIcon = Projector;
  exports.Proportions = Proportions;
  exports.ProportionsIcon = Proportions;
  exports.Puzzle = Puzzle;
  exports.PuzzleIcon = Puzzle;
  exports.Pyramid = Pyramid;
  exports.PyramidIcon = Pyramid;
  exports.QrCode = QrCode;
  exports.QrCodeIcon = QrCode;
  exports.Quote = Quote;
  exports.QuoteIcon = Quote;
  exports.Rabbit = Rabbit;
  exports.RabbitIcon = Rabbit;
  exports.Radar = Radar;
  exports.RadarIcon = Radar;
  exports.Radiation = Radiation;
  exports.RadiationIcon = Radiation;
  exports.Radical = Radical;
  exports.RadicalIcon = Radical;
  exports.Radio = Radio;
  exports.RadioIcon = Radio;
  exports.RadioReceiver = RadioReceiver;
  exports.RadioReceiverIcon = RadioReceiver;
  exports.RadioTower = RadioTower;
  exports.RadioTowerIcon = RadioTower;
  exports.Radius = Radius;
  exports.RadiusIcon = Radius;
  exports.RailSymbol = RailSymbol;
  exports.RailSymbolIcon = RailSymbol;
  exports.Rainbow = Rainbow;
  exports.RainbowIcon = Rainbow;
  exports.Rat = Rat;
  exports.RatIcon = Rat;
  exports.Ratio = Ratio;
  exports.RatioIcon = Ratio;
  exports.Receipt = Receipt;
  exports.ReceiptCent = ReceiptCent;
  exports.ReceiptCentIcon = ReceiptCent;
  exports.ReceiptEuro = ReceiptEuro;
  exports.ReceiptEuroIcon = ReceiptEuro;
  exports.ReceiptIcon = Receipt;
  exports.ReceiptIndianRupee = ReceiptIndianRupee;
  exports.ReceiptIndianRupeeIcon = ReceiptIndianRupee;
  exports.ReceiptJapaneseYen = ReceiptJapaneseYen;
  exports.ReceiptJapaneseYenIcon = ReceiptJapaneseYen;
  exports.ReceiptPoundSterling = ReceiptPoundSterling;
  exports.ReceiptPoundSterlingIcon = ReceiptPoundSterling;
  exports.ReceiptRussianRuble = ReceiptRussianRuble;
  exports.ReceiptRussianRubleIcon = ReceiptRussianRuble;
  exports.ReceiptSwissFranc = ReceiptSwissFranc;
  exports.ReceiptSwissFrancIcon = ReceiptSwissFranc;
  exports.ReceiptText = ReceiptText;
  exports.ReceiptTextIcon = ReceiptText;
  exports.RectangleCircle = RectangleCircle;
  exports.RectangleCircleIcon = RectangleCircle;
  exports.RectangleEllipsis = RectangleEllipsis;
  exports.RectangleEllipsisIcon = RectangleEllipsis;
  exports.RectangleGoggles = RectangleGoggles;
  exports.RectangleGogglesIcon = RectangleGoggles;
  exports.RectangleHorizontal = RectangleHorizontal;
  exports.RectangleHorizontalIcon = RectangleHorizontal;
  exports.RectangleVertical = RectangleVertical;
  exports.RectangleVerticalIcon = RectangleVertical;
  exports.Recycle = Recycle;
  exports.RecycleIcon = Recycle;
  exports.Redo = Redo;
  exports.Redo2 = Redo2;
  exports.Redo2Icon = Redo2;
  exports.RedoDot = RedoDot;
  exports.RedoDotIcon = RedoDot;
  exports.RedoIcon = Redo;
  exports.RefreshCcw = RefreshCcw;
  exports.RefreshCcwDot = RefreshCcwDot;
  exports.RefreshCcwDotIcon = RefreshCcwDot;
  exports.RefreshCcwIcon = RefreshCcw;
  exports.RefreshCw = RefreshCw;
  exports.RefreshCwIcon = RefreshCw;
  exports.RefreshCwOff = RefreshCwOff;
  exports.RefreshCwOffIcon = RefreshCwOff;
  exports.Refrigerator = Refrigerator;
  exports.RefrigeratorIcon = Refrigerator;
  exports.Regex = Regex;
  exports.RegexIcon = Regex;
  exports.RemoveFormatting = RemoveFormatting;
  exports.RemoveFormattingIcon = RemoveFormatting;
  exports.Repeat = Repeat;
  exports.Repeat1 = Repeat1;
  exports.Repeat1Icon = Repeat1;
  exports.Repeat2 = Repeat2;
  exports.Repeat2Icon = Repeat2;
  exports.RepeatIcon = Repeat;
  exports.Replace = Replace;
  exports.ReplaceAll = ReplaceAll;
  exports.ReplaceAllIcon = ReplaceAll;
  exports.ReplaceIcon = Replace;
  exports.Reply = Reply;
  exports.ReplyAll = ReplyAll;
  exports.ReplyAllIcon = ReplyAll;
  exports.ReplyIcon = Reply;
  exports.Rewind = Rewind;
  exports.RewindIcon = Rewind;
  exports.Ribbon = Ribbon;
  exports.RibbonIcon = Ribbon;
  exports.Rocket = Rocket;
  exports.RocketIcon = Rocket;
  exports.RockingChair = RockingChair;
  exports.RockingChairIcon = RockingChair;
  exports.RollerCoaster = RollerCoaster;
  exports.RollerCoasterIcon = RollerCoaster;
  exports.Rotate3D = Rotate3d;
  exports.Rotate3DIcon = Rotate3d;
  exports.Rotate3d = Rotate3d;
  exports.Rotate3dIcon = Rotate3d;
  exports.RotateCcw = RotateCcw;
  exports.RotateCcwIcon = RotateCcw;
  exports.RotateCcwKey = RotateCcwKey;
  exports.RotateCcwKeyIcon = RotateCcwKey;
  exports.RotateCcwSquare = RotateCcwSquare;
  exports.RotateCcwSquareIcon = RotateCcwSquare;
  exports.RotateCw = RotateCw;
  exports.RotateCwIcon = RotateCw;
  exports.RotateCwSquare = RotateCwSquare;
  exports.RotateCwSquareIcon = RotateCwSquare;
  exports.Route = Route;
  exports.RouteIcon = Route;
  exports.RouteOff = RouteOff;
  exports.RouteOffIcon = RouteOff;
  exports.Router = Router;
  exports.RouterIcon = Router;
  exports.Rows = Rows2;
  exports.Rows2 = Rows2;
  exports.Rows2Icon = Rows2;
  exports.Rows3 = Rows3;
  exports.Rows3Icon = Rows3;
  exports.Rows4 = Rows4;
  exports.Rows4Icon = Rows4;
  exports.RowsIcon = Rows2;
  exports.Rss = Rss;
  exports.RssIcon = Rss;
  exports.Ruler = Ruler;
  exports.RulerDimensionLine = RulerDimensionLine;
  exports.RulerDimensionLineIcon = RulerDimensionLine;
  exports.RulerIcon = Ruler;
  exports.RussianRuble = RussianRuble;
  exports.RussianRubleIcon = RussianRuble;
  exports.Sailboat = Sailboat;
  exports.SailboatIcon = Sailboat;
  exports.Salad = Salad;
  exports.SaladIcon = Salad;
  exports.Sandwich = Sandwich;
  exports.SandwichIcon = Sandwich;
  exports.Satellite = Satellite;
  exports.SatelliteDish = SatelliteDish;
  exports.SatelliteDishIcon = SatelliteDish;
  exports.SatelliteIcon = Satellite;
  exports.SaudiRiyal = SaudiRiyal;
  exports.SaudiRiyalIcon = SaudiRiyal;
  exports.Save = Save;
  exports.SaveAll = SaveAll;
  exports.SaveAllIcon = SaveAll;
  exports.SaveIcon = Save;
  exports.SaveOff = SaveOff;
  exports.SaveOffIcon = SaveOff;
  exports.Scale = Scale;
  exports.Scale3D = Scale3d;
  exports.Scale3DIcon = Scale3d;
  exports.Scale3d = Scale3d;
  exports.Scale3dIcon = Scale3d;
  exports.ScaleIcon = Scale;
  exports.Scaling = Scaling;
  exports.ScalingIcon = Scaling;
  exports.Scan = Scan;
  exports.ScanBarcode = ScanBarcode;
  exports.ScanBarcodeIcon = ScanBarcode;
  exports.ScanEye = ScanEye;
  exports.ScanEyeIcon = ScanEye;
  exports.ScanFace = ScanFace;
  exports.ScanFaceIcon = ScanFace;
  exports.ScanHeart = ScanHeart;
  exports.ScanHeartIcon = ScanHeart;
  exports.ScanIcon = Scan;
  exports.ScanLine = ScanLine;
  exports.ScanLineIcon = ScanLine;
  exports.ScanQrCode = ScanQrCode;
  exports.ScanQrCodeIcon = ScanQrCode;
  exports.ScanSearch = ScanSearch;
  exports.ScanSearchIcon = ScanSearch;
  exports.ScanText = ScanText;
  exports.ScanTextIcon = ScanText;
  exports.ScatterChart = ChartScatter;
  exports.ScatterChartIcon = ChartScatter;
  exports.School = School;
  exports.School2 = University;
  exports.School2Icon = University;
  exports.SchoolIcon = School;
  exports.Scissors = Scissors;
  exports.ScissorsIcon = Scissors;
  exports.ScissorsLineDashed = ScissorsLineDashed;
  exports.ScissorsLineDashedIcon = ScissorsLineDashed;
  exports.ScissorsSquare = SquareScissors;
  exports.ScissorsSquareDashedBottom = SquareBottomDashedScissors;
  exports.ScissorsSquareDashedBottomIcon = SquareBottomDashedScissors;
  exports.ScissorsSquareIcon = SquareScissors;
  exports.ScreenShare = ScreenShare;
  exports.ScreenShareIcon = ScreenShare;
  exports.ScreenShareOff = ScreenShareOff;
  exports.ScreenShareOffIcon = ScreenShareOff;
  exports.Scroll = Scroll;
  exports.ScrollIcon = Scroll;
  exports.ScrollText = ScrollText;
  exports.ScrollTextIcon = ScrollText;
  exports.Search = Search;
  exports.SearchCheck = SearchCheck;
  exports.SearchCheckIcon = SearchCheck;
  exports.SearchCode = SearchCode;
  exports.SearchCodeIcon = SearchCode;
  exports.SearchIcon = Search;
  exports.SearchSlash = SearchSlash;
  exports.SearchSlashIcon = SearchSlash;
  exports.SearchX = SearchX;
  exports.SearchXIcon = SearchX;
  exports.Section = Section;
  exports.SectionIcon = Section;
  exports.Send = Send;
  exports.SendHorizonal = SendHorizontal;
  exports.SendHorizonalIcon = SendHorizontal;
  exports.SendHorizontal = SendHorizontal;
  exports.SendHorizontalIcon = SendHorizontal;
  exports.SendIcon = Send;
  exports.SendToBack = SendToBack;
  exports.SendToBackIcon = SendToBack;
  exports.SeparatorHorizontal = SeparatorHorizontal;
  exports.SeparatorHorizontalIcon = SeparatorHorizontal;
  exports.SeparatorVertical = SeparatorVertical;
  exports.SeparatorVerticalIcon = SeparatorVertical;
  exports.Server = Server;
  exports.ServerCog = ServerCog;
  exports.ServerCogIcon = ServerCog;
  exports.ServerCrash = ServerCrash;
  exports.ServerCrashIcon = ServerCrash;
  exports.ServerIcon = Server;
  exports.ServerOff = ServerOff;
  exports.ServerOffIcon = ServerOff;
  exports.Settings = Settings;
  exports.Settings2 = Settings2;
  exports.Settings2Icon = Settings2;
  exports.SettingsIcon = Settings;
  exports.Shapes = Shapes;
  exports.ShapesIcon = Shapes;
  exports.Share = Share;
  exports.Share2 = Share2;
  exports.Share2Icon = Share2;
  exports.ShareIcon = Share;
  exports.Sheet = Sheet;
  exports.SheetIcon = Sheet;
  exports.Shell = Shell;
  exports.ShellIcon = Shell;
  exports.Shield = Shield;
  exports.ShieldAlert = ShieldAlert;
  exports.ShieldAlertIcon = ShieldAlert;
  exports.ShieldBan = ShieldBan;
  exports.ShieldBanIcon = ShieldBan;
  exports.ShieldCheck = ShieldCheck;
  exports.ShieldCheckIcon = ShieldCheck;
  exports.ShieldClose = ShieldX;
  exports.ShieldCloseIcon = ShieldX;
  exports.ShieldEllipsis = ShieldEllipsis;
  exports.ShieldEllipsisIcon = ShieldEllipsis;
  exports.ShieldHalf = ShieldHalf;
  exports.ShieldHalfIcon = ShieldHalf;
  exports.ShieldIcon = Shield;
  exports.ShieldMinus = ShieldMinus;
  exports.ShieldMinusIcon = ShieldMinus;
  exports.ShieldOff = ShieldOff;
  exports.ShieldOffIcon = ShieldOff;
  exports.ShieldPlus = ShieldPlus;
  exports.ShieldPlusIcon = ShieldPlus;
  exports.ShieldQuestion = ShieldQuestionMark;
  exports.ShieldQuestionIcon = ShieldQuestionMark;
  exports.ShieldQuestionMark = ShieldQuestionMark;
  exports.ShieldQuestionMarkIcon = ShieldQuestionMark;
  exports.ShieldUser = ShieldUser;
  exports.ShieldUserIcon = ShieldUser;
  exports.ShieldX = ShieldX;
  exports.ShieldXIcon = ShieldX;
  exports.Ship = Ship;
  exports.ShipIcon = Ship;
  exports.ShipWheel = ShipWheel;
  exports.ShipWheelIcon = ShipWheel;
  exports.Shirt = Shirt;
  exports.ShirtIcon = Shirt;
  exports.ShoppingBag = ShoppingBag;
  exports.ShoppingBagIcon = ShoppingBag;
  exports.ShoppingBasket = ShoppingBasket;
  exports.ShoppingBasketIcon = ShoppingBasket;
  exports.ShoppingCart = ShoppingCart;
  exports.ShoppingCartIcon = ShoppingCart;
  exports.Shovel = Shovel;
  exports.ShovelIcon = Shovel;
  exports.ShowerHead = ShowerHead;
  exports.ShowerHeadIcon = ShowerHead;
  exports.Shredder = Shredder;
  exports.ShredderIcon = Shredder;
  exports.Shrimp = Shrimp;
  exports.ShrimpIcon = Shrimp;
  exports.Shrink = Shrink;
  exports.ShrinkIcon = Shrink;
  exports.Shrub = Shrub;
  exports.ShrubIcon = Shrub;
  exports.Shuffle = Shuffle;
  exports.ShuffleIcon = Shuffle;
  exports.Sidebar = PanelLeft;
  exports.SidebarClose = PanelLeftClose;
  exports.SidebarCloseIcon = PanelLeftClose;
  exports.SidebarIcon = PanelLeft;
  exports.SidebarOpen = PanelLeftOpen;
  exports.SidebarOpenIcon = PanelLeftOpen;
  exports.Sigma = Sigma;
  exports.SigmaIcon = Sigma;
  exports.SigmaSquare = SquareSigma;
  exports.SigmaSquareIcon = SquareSigma;
  exports.Signal = Signal;
  exports.SignalHigh = SignalHigh;
  exports.SignalHighIcon = SignalHigh;
  exports.SignalIcon = Signal;
  exports.SignalLow = SignalLow;
  exports.SignalLowIcon = SignalLow;
  exports.SignalMedium = SignalMedium;
  exports.SignalMediumIcon = SignalMedium;
  exports.SignalZero = SignalZero;
  exports.SignalZeroIcon = SignalZero;
  exports.Signature = Signature;
  exports.SignatureIcon = Signature;
  exports.Signpost = Signpost;
  exports.SignpostBig = SignpostBig;
  exports.SignpostBigIcon = SignpostBig;
  exports.SignpostIcon = Signpost;
  exports.Siren = Siren;
  exports.SirenIcon = Siren;
  exports.SkipBack = SkipBack;
  exports.SkipBackIcon = SkipBack;
  exports.SkipForward = SkipForward;
  exports.SkipForwardIcon = SkipForward;
  exports.Skull = Skull;
  exports.SkullIcon = Skull;
  exports.Slack = Slack;
  exports.SlackIcon = Slack;
  exports.Slash = Slash;
  exports.SlashIcon = Slash;
  exports.SlashSquare = SquareSlash;
  exports.SlashSquareIcon = SquareSlash;
  exports.Slice = Slice;
  exports.SliceIcon = Slice;
  exports.Sliders = SlidersVertical;
  exports.SlidersHorizontal = SlidersHorizontal;
  exports.SlidersHorizontalIcon = SlidersHorizontal;
  exports.SlidersIcon = SlidersVertical;
  exports.SlidersVertical = SlidersVertical;
  exports.SlidersVerticalIcon = SlidersVertical;
  exports.Smartphone = Smartphone;
  exports.SmartphoneCharging = SmartphoneCharging;
  exports.SmartphoneChargingIcon = SmartphoneCharging;
  exports.SmartphoneIcon = Smartphone;
  exports.SmartphoneNfc = SmartphoneNfc;
  exports.SmartphoneNfcIcon = SmartphoneNfc;
  exports.Smile = Smile;
  exports.SmileIcon = Smile;
  exports.SmilePlus = SmilePlus;
  exports.SmilePlusIcon = SmilePlus;
  exports.Snail = Snail;
  exports.SnailIcon = Snail;
  exports.Snowflake = Snowflake;
  exports.SnowflakeIcon = Snowflake;
  exports.SoapDispenserDroplet = SoapDispenserDroplet;
  exports.SoapDispenserDropletIcon = SoapDispenserDroplet;
  exports.Sofa = Sofa;
  exports.SofaIcon = Sofa;
  exports.SortAsc = ArrowUpNarrowWide;
  exports.SortAscIcon = ArrowUpNarrowWide;
  exports.SortDesc = ArrowDownWideNarrow;
  exports.SortDescIcon = ArrowDownWideNarrow;
  exports.Soup = Soup;
  exports.SoupIcon = Soup;
  exports.Space = Space;
  exports.SpaceIcon = Space;
  exports.Spade = Spade;
  exports.SpadeIcon = Spade;
  exports.Sparkle = Sparkle;
  exports.SparkleIcon = Sparkle;
  exports.Sparkles = Sparkles;
  exports.SparklesIcon = Sparkles;
  exports.Speaker = Speaker;
  exports.SpeakerIcon = Speaker;
  exports.Speech = Speech;
  exports.SpeechIcon = Speech;
  exports.SpellCheck = SpellCheck;
  exports.SpellCheck2 = SpellCheck2;
  exports.SpellCheck2Icon = SpellCheck2;
  exports.SpellCheckIcon = SpellCheck;
  exports.Spline = Spline;
  exports.SplineIcon = Spline;
  exports.SplinePointer = SplinePointer;
  exports.SplinePointerIcon = SplinePointer;
  exports.Split = Split;
  exports.SplitIcon = Split;
  exports.SplitSquareHorizontal = SquareSplitHorizontal;
  exports.SplitSquareHorizontalIcon = SquareSplitHorizontal;
  exports.SplitSquareVertical = SquareSplitVertical;
  exports.SplitSquareVerticalIcon = SquareSplitVertical;
  exports.Spool = Spool;
  exports.SpoolIcon = Spool;
  exports.SprayCan = SprayCan;
  exports.SprayCanIcon = SprayCan;
  exports.Sprout = Sprout;
  exports.SproutIcon = Sprout;
  exports.Square = Square;
  exports.SquareActivity = SquareActivity;
  exports.SquareActivityIcon = SquareActivity;
  exports.SquareArrowDown = SquareArrowDown;
  exports.SquareArrowDownIcon = SquareArrowDown;
  exports.SquareArrowDownLeft = SquareArrowDownLeft;
  exports.SquareArrowDownLeftIcon = SquareArrowDownLeft;
  exports.SquareArrowDownRight = SquareArrowDownRight;
  exports.SquareArrowDownRightIcon = SquareArrowDownRight;
  exports.SquareArrowLeft = SquareArrowLeft;
  exports.SquareArrowLeftIcon = SquareArrowLeft;
  exports.SquareArrowOutDownLeft = SquareArrowOutDownLeft;
  exports.SquareArrowOutDownLeftIcon = SquareArrowOutDownLeft;
  exports.SquareArrowOutDownRight = SquareArrowOutDownRight;
  exports.SquareArrowOutDownRightIcon = SquareArrowOutDownRight;
  exports.SquareArrowOutUpLeft = SquareArrowOutUpLeft;
  exports.SquareArrowOutUpLeftIcon = SquareArrowOutUpLeft;
  exports.SquareArrowOutUpRight = SquareArrowOutUpRight;
  exports.SquareArrowOutUpRightIcon = SquareArrowOutUpRight;
  exports.SquareArrowRight = SquareArrowRight;
  exports.SquareArrowRightIcon = SquareArrowRight;
  exports.SquareArrowUp = SquareArrowUp;
  exports.SquareArrowUpIcon = SquareArrowUp;
  exports.SquareArrowUpLeft = SquareArrowUpLeft;
  exports.SquareArrowUpLeftIcon = SquareArrowUpLeft;
  exports.SquareArrowUpRight = SquareArrowUpRight;
  exports.SquareArrowUpRightIcon = SquareArrowUpRight;
  exports.SquareAsterisk = SquareAsterisk;
  exports.SquareAsteriskIcon = SquareAsterisk;
  exports.SquareBottomDashedScissors = SquareBottomDashedScissors;
  exports.SquareBottomDashedScissorsIcon = SquareBottomDashedScissors;
  exports.SquareChartGantt = SquareChartGantt;
  exports.SquareChartGanttIcon = SquareChartGantt;
  exports.SquareCheck = SquareCheck;
  exports.SquareCheckBig = SquareCheckBig;
  exports.SquareCheckBigIcon = SquareCheckBig;
  exports.SquareCheckIcon = SquareCheck;
  exports.SquareChevronDown = SquareChevronDown;
  exports.SquareChevronDownIcon = SquareChevronDown;
  exports.SquareChevronLeft = SquareChevronLeft;
  exports.SquareChevronLeftIcon = SquareChevronLeft;
  exports.SquareChevronRight = SquareChevronRight;
  exports.SquareChevronRightIcon = SquareChevronRight;
  exports.SquareChevronUp = SquareChevronUp;
  exports.SquareChevronUpIcon = SquareChevronUp;
  exports.SquareCode = SquareCode;
  exports.SquareCodeIcon = SquareCode;
  exports.SquareDashed = SquareDashed;
  exports.SquareDashedBottom = SquareDashedBottom;
  exports.SquareDashedBottomCode = SquareDashedBottomCode;
  exports.SquareDashedBottomCodeIcon = SquareDashedBottomCode;
  exports.SquareDashedBottomIcon = SquareDashedBottom;
  exports.SquareDashedIcon = SquareDashed;
  exports.SquareDashedKanban = SquareDashedKanban;
  exports.SquareDashedKanbanIcon = SquareDashedKanban;
  exports.SquareDashedMousePointer = SquareDashedMousePointer;
  exports.SquareDashedMousePointerIcon = SquareDashedMousePointer;
  exports.SquareDashedTopSolid = SquareDashedTopSolid;
  exports.SquareDashedTopSolidIcon = SquareDashedTopSolid;
  exports.SquareDivide = SquareDivide;
  exports.SquareDivideIcon = SquareDivide;
  exports.SquareDot = SquareDot;
  exports.SquareDotIcon = SquareDot;
  exports.SquareEqual = SquareEqual;
  exports.SquareEqualIcon = SquareEqual;
  exports.SquareFunction = SquareFunction;
  exports.SquareFunctionIcon = SquareFunction;
  exports.SquareGanttChart = SquareChartGantt;
  exports.SquareGanttChartIcon = SquareChartGantt;
  exports.SquareIcon = Square;
  exports.SquareKanban = SquareKanban;
  exports.SquareKanbanIcon = SquareKanban;
  exports.SquareLibrary = SquareLibrary;
  exports.SquareLibraryIcon = SquareLibrary;
  exports.SquareM = SquareM;
  exports.SquareMIcon = SquareM;
  exports.SquareMenu = SquareMenu;
  exports.SquareMenuIcon = SquareMenu;
  exports.SquareMinus = SquareMinus;
  exports.SquareMinusIcon = SquareMinus;
  exports.SquareMousePointer = SquareMousePointer;
  exports.SquareMousePointerIcon = SquareMousePointer;
  exports.SquareParking = SquareParking;
  exports.SquareParkingIcon = SquareParking;
  exports.SquareParkingOff = SquareParkingOff;
  exports.SquareParkingOffIcon = SquareParkingOff;
  exports.SquarePen = SquarePen;
  exports.SquarePenIcon = SquarePen;
  exports.SquarePercent = SquarePercent;
  exports.SquarePercentIcon = SquarePercent;
  exports.SquarePi = SquarePi;
  exports.SquarePiIcon = SquarePi;
  exports.SquarePilcrow = SquarePilcrow;
  exports.SquarePilcrowIcon = SquarePilcrow;
  exports.SquarePlay = SquarePlay;
  exports.SquarePlayIcon = SquarePlay;
  exports.SquarePlus = SquarePlus;
  exports.SquarePlusIcon = SquarePlus;
  exports.SquarePower = SquarePower;
  exports.SquarePowerIcon = SquarePower;
  exports.SquareRadical = SquareRadical;
  exports.SquareRadicalIcon = SquareRadical;
  exports.SquareRoundCorner = SquareRoundCorner;
  exports.SquareRoundCornerIcon = SquareRoundCorner;
  exports.SquareScissors = SquareScissors;
  exports.SquareScissorsIcon = SquareScissors;
  exports.SquareSigma = SquareSigma;
  exports.SquareSigmaIcon = SquareSigma;
  exports.SquareSlash = SquareSlash;
  exports.SquareSlashIcon = SquareSlash;
  exports.SquareSplitHorizontal = SquareSplitHorizontal;
  exports.SquareSplitHorizontalIcon = SquareSplitHorizontal;
  exports.SquareSplitVertical = SquareSplitVertical;
  exports.SquareSplitVerticalIcon = SquareSplitVertical;
  exports.SquareSquare = SquareSquare;
  exports.SquareSquareIcon = SquareSquare;
  exports.SquareStack = SquareStack;
  exports.SquareStackIcon = SquareStack;
  exports.SquareTerminal = SquareTerminal;
  exports.SquareTerminalIcon = SquareTerminal;
  exports.SquareUser = SquareUser;
  exports.SquareUserIcon = SquareUser;
  exports.SquareUserRound = SquareUserRound;
  exports.SquareUserRoundIcon = SquareUserRound;
  exports.SquareX = SquareX;
  exports.SquareXIcon = SquareX;
  exports.SquaresExclude = SquaresExclude;
  exports.SquaresExcludeIcon = SquaresExclude;
  exports.SquaresIntersect = SquaresIntersect;
  exports.SquaresIntersectIcon = SquaresIntersect;
  exports.SquaresSubtract = SquaresSubtract;
  exports.SquaresSubtractIcon = SquaresSubtract;
  exports.SquaresUnite = SquaresUnite;
  exports.SquaresUniteIcon = SquaresUnite;
  exports.Squircle = Squircle;
  exports.SquircleDashed = SquircleDashed;
  exports.SquircleDashedIcon = SquircleDashed;
  exports.SquircleIcon = Squircle;
  exports.Squirrel = Squirrel;
  exports.SquirrelIcon = Squirrel;
  exports.Stamp = Stamp;
  exports.StampIcon = Stamp;
  exports.Star = Star;
  exports.StarHalf = StarHalf;
  exports.StarHalfIcon = StarHalf;
  exports.StarIcon = Star;
  exports.StarOff = StarOff;
  exports.StarOffIcon = StarOff;
  exports.Stars = Sparkles;
  exports.StarsIcon = Sparkles;
  exports.StepBack = StepBack;
  exports.StepBackIcon = StepBack;
  exports.StepForward = StepForward;
  exports.StepForwardIcon = StepForward;
  exports.Stethoscope = Stethoscope;
  exports.StethoscopeIcon = Stethoscope;
  exports.Sticker = Sticker;
  exports.StickerIcon = Sticker;
  exports.StickyNote = StickyNote;
  exports.StickyNoteIcon = StickyNote;
  exports.StopCircle = CircleStop;
  exports.StopCircleIcon = CircleStop;
  exports.Store = Store;
  exports.StoreIcon = Store;
  exports.StretchHorizontal = StretchHorizontal;
  exports.StretchHorizontalIcon = StretchHorizontal;
  exports.StretchVertical = StretchVertical;
  exports.StretchVerticalIcon = StretchVertical;
  exports.Strikethrough = Strikethrough;
  exports.StrikethroughIcon = Strikethrough;
  exports.Subscript = Subscript;
  exports.SubscriptIcon = Subscript;
  exports.Subtitles = Captions;
  exports.SubtitlesIcon = Captions;
  exports.Sun = Sun;
  exports.SunDim = SunDim;
  exports.SunDimIcon = SunDim;
  exports.SunIcon = Sun;
  exports.SunMedium = SunMedium;
  exports.SunMediumIcon = SunMedium;
  exports.SunMoon = SunMoon;
  exports.SunMoonIcon = SunMoon;
  exports.SunSnow = SunSnow;
  exports.SunSnowIcon = SunSnow;
  exports.Sunrise = Sunrise;
  exports.SunriseIcon = Sunrise;
  exports.Sunset = Sunset;
  exports.SunsetIcon = Sunset;
  exports.Superscript = Superscript;
  exports.SuperscriptIcon = Superscript;
  exports.SwatchBook = SwatchBook;
  exports.SwatchBookIcon = SwatchBook;
  exports.SwissFranc = SwissFranc;
  exports.SwissFrancIcon = SwissFranc;
  exports.SwitchCamera = SwitchCamera;
  exports.SwitchCameraIcon = SwitchCamera;
  exports.Sword = Sword;
  exports.SwordIcon = Sword;
  exports.Swords = Swords;
  exports.SwordsIcon = Swords;
  exports.Syringe = Syringe;
  exports.SyringeIcon = Syringe;
  exports.Table = Table;
  exports.Table2 = Table2;
  exports.Table2Icon = Table2;
  exports.TableCellsMerge = TableCellsMerge;
  exports.TableCellsMergeIcon = TableCellsMerge;
  exports.TableCellsSplit = TableCellsSplit;
  exports.TableCellsSplitIcon = TableCellsSplit;
  exports.TableColumnsSplit = TableColumnsSplit;
  exports.TableColumnsSplitIcon = TableColumnsSplit;
  exports.TableConfig = Columns3Cog;
  exports.TableConfigIcon = Columns3Cog;
  exports.TableIcon = Table;
  exports.TableOfContents = TableOfContents;
  exports.TableOfContentsIcon = TableOfContents;
  exports.TableProperties = TableProperties;
  exports.TablePropertiesIcon = TableProperties;
  exports.TableRowsSplit = TableRowsSplit;
  exports.TableRowsSplitIcon = TableRowsSplit;
  exports.Tablet = Tablet;
  exports.TabletIcon = Tablet;
  exports.TabletSmartphone = TabletSmartphone;
  exports.TabletSmartphoneIcon = TabletSmartphone;
  exports.Tablets = Tablets;
  exports.TabletsIcon = Tablets;
  exports.Tag = Tag;
  exports.TagIcon = Tag;
  exports.Tags = Tags;
  exports.TagsIcon = Tags;
  exports.Tally1 = Tally1;
  exports.Tally1Icon = Tally1;
  exports.Tally2 = Tally2;
  exports.Tally2Icon = Tally2;
  exports.Tally3 = Tally3;
  exports.Tally3Icon = Tally3;
  exports.Tally4 = Tally4;
  exports.Tally4Icon = Tally4;
  exports.Tally5 = Tally5;
  exports.Tally5Icon = Tally5;
  exports.Tangent = Tangent;
  exports.TangentIcon = Tangent;
  exports.Target = Target;
  exports.TargetIcon = Target;
  exports.Telescope = Telescope;
  exports.TelescopeIcon = Telescope;
  exports.Tent = Tent;
  exports.TentIcon = Tent;
  exports.TentTree = TentTree;
  exports.TentTreeIcon = TentTree;
  exports.Terminal = Terminal;
  exports.TerminalIcon = Terminal;
  exports.TerminalSquare = SquareTerminal;
  exports.TerminalSquareIcon = SquareTerminal;
  exports.TestTube = TestTube;
  exports.TestTube2 = TestTubeDiagonal;
  exports.TestTube2Icon = TestTubeDiagonal;
  exports.TestTubeDiagonal = TestTubeDiagonal;
  exports.TestTubeDiagonalIcon = TestTubeDiagonal;
  exports.TestTubeIcon = TestTube;
  exports.TestTubes = TestTubes;
  exports.TestTubesIcon = TestTubes;
  exports.Text = Text;
  exports.TextCursor = TextCursor;
  exports.TextCursorIcon = TextCursor;
  exports.TextCursorInput = TextCursorInput;
  exports.TextCursorInputIcon = TextCursorInput;
  exports.TextIcon = Text;
  exports.TextQuote = TextQuote;
  exports.TextQuoteIcon = TextQuote;
  exports.TextSearch = TextSearch;
  exports.TextSearchIcon = TextSearch;
  exports.TextSelect = TextSelect;
  exports.TextSelectIcon = TextSelect;
  exports.TextSelection = TextSelect;
  exports.TextSelectionIcon = TextSelect;
  exports.Theater = Theater;
  exports.TheaterIcon = Theater;
  exports.Thermometer = Thermometer;
  exports.ThermometerIcon = Thermometer;
  exports.ThermometerSnowflake = ThermometerSnowflake;
  exports.ThermometerSnowflakeIcon = ThermometerSnowflake;
  exports.ThermometerSun = ThermometerSun;
  exports.ThermometerSunIcon = ThermometerSun;
  exports.ThumbsDown = ThumbsDown;
  exports.ThumbsDownIcon = ThumbsDown;
  exports.ThumbsUp = ThumbsUp;
  exports.ThumbsUpIcon = ThumbsUp;
  exports.Ticket = Ticket;
  exports.TicketCheck = TicketCheck;
  exports.TicketCheckIcon = TicketCheck;
  exports.TicketIcon = Ticket;
  exports.TicketMinus = TicketMinus;
  exports.TicketMinusIcon = TicketMinus;
  exports.TicketPercent = TicketPercent;
  exports.TicketPercentIcon = TicketPercent;
  exports.TicketPlus = TicketPlus;
  exports.TicketPlusIcon = TicketPlus;
  exports.TicketSlash = TicketSlash;
  exports.TicketSlashIcon = TicketSlash;
  exports.TicketX = TicketX;
  exports.TicketXIcon = TicketX;
  exports.Tickets = Tickets;
  exports.TicketsIcon = Tickets;
  exports.TicketsPlane = TicketsPlane;
  exports.TicketsPlaneIcon = TicketsPlane;
  exports.Timer = Timer;
  exports.TimerIcon = Timer;
  exports.TimerOff = TimerOff;
  exports.TimerOffIcon = TimerOff;
  exports.TimerReset = TimerReset;
  exports.TimerResetIcon = TimerReset;
  exports.ToggleLeft = ToggleLeft;
  exports.ToggleLeftIcon = ToggleLeft;
  exports.ToggleRight = ToggleRight;
  exports.ToggleRightIcon = ToggleRight;
  exports.Toilet = Toilet;
  exports.ToiletIcon = Toilet;
  exports.Tornado = Tornado;
  exports.TornadoIcon = Tornado;
  exports.Torus = Torus;
  exports.TorusIcon = Torus;
  exports.Touchpad = Touchpad;
  exports.TouchpadIcon = Touchpad;
  exports.TouchpadOff = TouchpadOff;
  exports.TouchpadOffIcon = TouchpadOff;
  exports.TowerControl = TowerControl;
  exports.TowerControlIcon = TowerControl;
  exports.ToyBrick = ToyBrick;
  exports.ToyBrickIcon = ToyBrick;
  exports.Tractor = Tractor;
  exports.TractorIcon = Tractor;
  exports.TrafficCone = TrafficCone;
  exports.TrafficConeIcon = TrafficCone;
  exports.Train = TramFront;
  exports.TrainFront = TrainFront;
  exports.TrainFrontIcon = TrainFront;
  exports.TrainFrontTunnel = TrainFrontTunnel;
  exports.TrainFrontTunnelIcon = TrainFrontTunnel;
  exports.TrainIcon = TramFront;
  exports.TrainTrack = TrainTrack;
  exports.TrainTrackIcon = TrainTrack;
  exports.TramFront = TramFront;
  exports.TramFrontIcon = TramFront;
  exports.Transgender = Transgender;
  exports.TransgenderIcon = Transgender;
  exports.Trash = Trash;
  exports.Trash2 = Trash2;
  exports.Trash2Icon = Trash2;
  exports.TrashIcon = Trash;
  exports.TreeDeciduous = TreeDeciduous;
  exports.TreeDeciduousIcon = TreeDeciduous;
  exports.TreePalm = TreePalm;
  exports.TreePalmIcon = TreePalm;
  exports.TreePine = TreePine;
  exports.TreePineIcon = TreePine;
  exports.Trees = Trees;
  exports.TreesIcon = Trees;
  exports.Trello = Trello;
  exports.TrelloIcon = Trello;
  exports.TrendingDown = TrendingDown;
  exports.TrendingDownIcon = TrendingDown;
  exports.TrendingUp = TrendingUp;
  exports.TrendingUpDown = TrendingUpDown;
  exports.TrendingUpDownIcon = TrendingUpDown;
  exports.TrendingUpIcon = TrendingUp;
  exports.Triangle = Triangle;
  exports.TriangleAlert = TriangleAlert;
  exports.TriangleAlertIcon = TriangleAlert;
  exports.TriangleDashed = TriangleDashed;
  exports.TriangleDashedIcon = TriangleDashed;
  exports.TriangleIcon = Triangle;
  exports.TriangleRight = TriangleRight;
  exports.TriangleRightIcon = TriangleRight;
  exports.Trophy = Trophy;
  exports.TrophyIcon = Trophy;
  exports.Truck = Truck;
  exports.TruckElectric = TruckElectric;
  exports.TruckElectricIcon = TruckElectric;
  exports.TruckIcon = Truck;
  exports.Turtle = Turtle;
  exports.TurtleIcon = Turtle;
  exports.Tv = Tv;
  exports.Tv2 = TvMinimal;
  exports.Tv2Icon = TvMinimal;
  exports.TvIcon = Tv;
  exports.TvMinimal = TvMinimal;
  exports.TvMinimalIcon = TvMinimal;
  exports.TvMinimalPlay = TvMinimalPlay;
  exports.TvMinimalPlayIcon = TvMinimalPlay;
  exports.Twitch = Twitch;
  exports.TwitchIcon = Twitch;
  exports.Twitter = Twitter;
  exports.TwitterIcon = Twitter;
  exports.Type = Type;
  exports.TypeIcon = Type;
  exports.TypeOutline = TypeOutline;
  exports.TypeOutlineIcon = TypeOutline;
  exports.Umbrella = Umbrella;
  exports.UmbrellaIcon = Umbrella;
  exports.UmbrellaOff = UmbrellaOff;
  exports.UmbrellaOffIcon = UmbrellaOff;
  exports.Underline = Underline;
  exports.UnderlineIcon = Underline;
  exports.Undo = Undo;
  exports.Undo2 = Undo2;
  exports.Undo2Icon = Undo2;
  exports.UndoDot = UndoDot;
  exports.UndoDotIcon = UndoDot;
  exports.UndoIcon = Undo;
  exports.UnfoldHorizontal = UnfoldHorizontal;
  exports.UnfoldHorizontalIcon = UnfoldHorizontal;
  exports.UnfoldVertical = UnfoldVertical;
  exports.UnfoldVerticalIcon = UnfoldVertical;
  exports.Ungroup = Ungroup;
  exports.UngroupIcon = Ungroup;
  exports.University = University;
  exports.UniversityIcon = University;
  exports.Unlink = Unlink;
  exports.Unlink2 = Unlink2;
  exports.Unlink2Icon = Unlink2;
  exports.UnlinkIcon = Unlink;
  exports.Unlock = LockOpen;
  exports.UnlockIcon = LockOpen;
  exports.UnlockKeyhole = LockKeyholeOpen;
  exports.UnlockKeyholeIcon = LockKeyholeOpen;
  exports.Unplug = Unplug;
  exports.UnplugIcon = Unplug;
  exports.Upload = Upload;
  exports.UploadCloud = CloudUpload;
  exports.UploadCloudIcon = CloudUpload;
  exports.UploadIcon = Upload;
  exports.Usb = Usb;
  exports.UsbIcon = Usb;
  exports.User = User;
  exports.User2 = UserRound;
  exports.User2Icon = UserRound;
  exports.UserCheck = UserCheck;
  exports.UserCheck2 = UserRoundCheck;
  exports.UserCheck2Icon = UserRoundCheck;
  exports.UserCheckIcon = UserCheck;
  exports.UserCircle = CircleUser;
  exports.UserCircle2 = CircleUserRound;
  exports.UserCircle2Icon = CircleUserRound;
  exports.UserCircleIcon = CircleUser;
  exports.UserCog = UserCog;
  exports.UserCog2 = UserRoundCog;
  exports.UserCog2Icon = UserRoundCog;
  exports.UserCogIcon = UserCog;
  exports.UserIcon = User;
  exports.UserLock = UserLock;
  exports.UserLockIcon = UserLock;
  exports.UserMinus = UserMinus;
  exports.UserMinus2 = UserRoundMinus;
  exports.UserMinus2Icon = UserRoundMinus;
  exports.UserMinusIcon = UserMinus;
  exports.UserPen = UserPen;
  exports.UserPenIcon = UserPen;
  exports.UserPlus = UserPlus;
  exports.UserPlus2 = UserRoundPlus;
  exports.UserPlus2Icon = UserRoundPlus;
  exports.UserPlusIcon = UserPlus;
  exports.UserRound = UserRound;
  exports.UserRoundCheck = UserRoundCheck;
  exports.UserRoundCheckIcon = UserRoundCheck;
  exports.UserRoundCog = UserRoundCog;
  exports.UserRoundCogIcon = UserRoundCog;
  exports.UserRoundIcon = UserRound;
  exports.UserRoundMinus = UserRoundMinus;
  exports.UserRoundMinusIcon = UserRoundMinus;
  exports.UserRoundPen = UserRoundPen;
  exports.UserRoundPenIcon = UserRoundPen;
  exports.UserRoundPlus = UserRoundPlus;
  exports.UserRoundPlusIcon = UserRoundPlus;
  exports.UserRoundSearch = UserRoundSearch;
  exports.UserRoundSearchIcon = UserRoundSearch;
  exports.UserRoundX = UserRoundX;
  exports.UserRoundXIcon = UserRoundX;
  exports.UserSearch = UserSearch;
  exports.UserSearchIcon = UserSearch;
  exports.UserSquare = SquareUser;
  exports.UserSquare2 = SquareUserRound;
  exports.UserSquare2Icon = SquareUserRound;
  exports.UserSquareIcon = SquareUser;
  exports.UserX = UserX;
  exports.UserX2 = UserRoundX;
  exports.UserX2Icon = UserRoundX;
  exports.UserXIcon = UserX;
  exports.Users = Users;
  exports.Users2 = UsersRound;
  exports.Users2Icon = UsersRound;
  exports.UsersIcon = Users;
  exports.UsersRound = UsersRound;
  exports.UsersRoundIcon = UsersRound;
  exports.Utensils = Utensils;
  exports.UtensilsCrossed = UtensilsCrossed;
  exports.UtensilsCrossedIcon = UtensilsCrossed;
  exports.UtensilsIcon = Utensils;
  exports.UtilityPole = UtilityPole;
  exports.UtilityPoleIcon = UtilityPole;
  exports.Variable = Variable;
  exports.VariableIcon = Variable;
  exports.Vault = Vault;
  exports.VaultIcon = Vault;
  exports.Vegan = Vegan;
  exports.VeganIcon = Vegan;
  exports.VenetianMask = VenetianMask;
  exports.VenetianMaskIcon = VenetianMask;
  exports.Venus = Venus;
  exports.VenusAndMars = VenusAndMars;
  exports.VenusAndMarsIcon = VenusAndMars;
  exports.VenusIcon = Venus;
  exports.Verified = BadgeCheck;
  exports.VerifiedIcon = BadgeCheck;
  exports.Vibrate = Vibrate;
  exports.VibrateIcon = Vibrate;
  exports.VibrateOff = VibrateOff;
  exports.VibrateOffIcon = VibrateOff;
  exports.Video = Video;
  exports.VideoIcon = Video;
  exports.VideoOff = VideoOff;
  exports.VideoOffIcon = VideoOff;
  exports.Videotape = Videotape;
  exports.VideotapeIcon = Videotape;
  exports.View = View;
  exports.ViewIcon = View;
  exports.Voicemail = Voicemail;
  exports.VoicemailIcon = Voicemail;
  exports.Volleyball = Volleyball;
  exports.VolleyballIcon = Volleyball;
  exports.Volume = Volume;
  exports.Volume1 = Volume1;
  exports.Volume1Icon = Volume1;
  exports.Volume2 = Volume2;
  exports.Volume2Icon = Volume2;
  exports.VolumeIcon = Volume;
  exports.VolumeOff = VolumeOff;
  exports.VolumeOffIcon = VolumeOff;
  exports.VolumeX = VolumeX;
  exports.VolumeXIcon = VolumeX;
  exports.Vote = Vote;
  exports.VoteIcon = Vote;
  exports.Wallet = Wallet;
  exports.Wallet2 = WalletMinimal;
  exports.Wallet2Icon = WalletMinimal;
  exports.WalletCards = WalletCards;
  exports.WalletCardsIcon = WalletCards;
  exports.WalletIcon = Wallet;
  exports.WalletMinimal = WalletMinimal;
  exports.WalletMinimalIcon = WalletMinimal;
  exports.Wallpaper = Wallpaper;
  exports.WallpaperIcon = Wallpaper;
  exports.Wand = Wand;
  exports.Wand2 = WandSparkles;
  exports.Wand2Icon = WandSparkles;
  exports.WandIcon = Wand;
  exports.WandSparkles = WandSparkles;
  exports.WandSparklesIcon = WandSparkles;
  exports.Warehouse = Warehouse;
  exports.WarehouseIcon = Warehouse;
  exports.WashingMachine = WashingMachine;
  exports.WashingMachineIcon = WashingMachine;
  exports.Watch = Watch;
  exports.WatchIcon = Watch;
  exports.Waves = Waves;
  exports.WavesIcon = Waves;
  exports.WavesLadder = WavesLadder;
  exports.WavesLadderIcon = WavesLadder;
  exports.Waypoints = Waypoints;
  exports.WaypointsIcon = Waypoints;
  exports.Webcam = Webcam;
  exports.WebcamIcon = Webcam;
  exports.Webhook = Webhook;
  exports.WebhookIcon = Webhook;
  exports.WebhookOff = WebhookOff;
  exports.WebhookOffIcon = WebhookOff;
  exports.Weight = Weight;
  exports.WeightIcon = Weight;
  exports.Wheat = Wheat;
  exports.WheatIcon = Wheat;
  exports.WheatOff = WheatOff;
  exports.WheatOffIcon = WheatOff;
  exports.WholeWord = WholeWord;
  exports.WholeWordIcon = WholeWord;
  exports.Wifi = Wifi;
  exports.WifiCog = WifiCog;
  exports.WifiCogIcon = WifiCog;
  exports.WifiHigh = WifiHigh;
  exports.WifiHighIcon = WifiHigh;
  exports.WifiIcon = Wifi;
  exports.WifiLow = WifiLow;
  exports.WifiLowIcon = WifiLow;
  exports.WifiOff = WifiOff;
  exports.WifiOffIcon = WifiOff;
  exports.WifiPen = WifiPen;
  exports.WifiPenIcon = WifiPen;
  exports.WifiZero = WifiZero;
  exports.WifiZeroIcon = WifiZero;
  exports.Wind = Wind;
  exports.WindArrowDown = WindArrowDown;
  exports.WindArrowDownIcon = WindArrowDown;
  exports.WindIcon = Wind;
  exports.Wine = Wine;
  exports.WineIcon = Wine;
  exports.WineOff = WineOff;
  exports.WineOffIcon = WineOff;
  exports.Workflow = Workflow;
  exports.WorkflowIcon = Workflow;
  exports.Worm = Worm;
  exports.WormIcon = Worm;
  exports.WrapText = WrapText;
  exports.WrapTextIcon = WrapText;
  exports.Wrench = Wrench;
  exports.WrenchIcon = Wrench;
  exports.X = X;
  exports.XCircle = CircleX;
  exports.XCircleIcon = CircleX;
  exports.XIcon = X;
  exports.XOctagon = OctagonX;
  exports.XOctagonIcon = OctagonX;
  exports.XSquare = SquareX;
  exports.XSquareIcon = SquareX;
  exports.Youtube = Youtube;
  exports.YoutubeIcon = Youtube;
  exports.Zap = Zap;
  exports.ZapIcon = Zap;
  exports.ZapOff = ZapOff;
  exports.ZapOffIcon = ZapOff;
  exports.ZoomIn = ZoomIn;
  exports.ZoomInIcon = ZoomIn;
  exports.ZoomOut = ZoomOut;
  exports.ZoomOutIcon = ZoomOut;
  exports.createLucideIcon = createLucideIcon;
  exports.icons = index;

}));
//# sourceMappingURL=lucide-react.js.map
