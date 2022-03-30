(function () {
  "use strict";

  /** @module General-purpose utilities
   *
   * Most of these functions/types should be placed somewhere in more appropriate location.
   */
  function failure(msg) {
    throw new Error(msg);
  }
  /**
   * Return negated fn: for each x return !fn(x).
   */

  function not(fn) {
    return function () {
      return !fn.apply(this, arguments);
    };
  }
  /** Just run the given function
   *
   * This is done because this:
   *
   *   run(function () { ...});
   *
   * Reads a bit better than this:
   *
   *   (function () { ... })();
   *
   * */

  function run(fn, ...args) {
    return fn.apply(this, args);
  }
  function toArray(obj) {
    return Array.isArray(obj) ? obj : [obj];
  }
  let objHasOwnProperty = Object.prototype.hasOwnProperty;
  function hasOwnProperty(obj, prop) {
    return objHasOwnProperty.call(obj, prop);
  }
  function iterator(obj) {
    return obj[Symbol.iterator]();
  }
  function* zip(...Xs) {
    let Is = Xs.map(iterator);

    for (;;) {
      let res = [];

      for (let I of Is) {
        let { done, value } = I.next();

        if (done) {
          return value;
        } else {
          res.push(value);
        }
      }

      yield res;
    }
  }
  function addToObjMap2Many(map, obj, key) {
    let array = map[key];

    if (!array) {
      array = map[key] = [];
    }

    array.push(obj);
  }
  function sconcat() {
    return String.prototype.concat.apply([], arguments);
  }
  function sqr(x) {
    return x * x;
  }

  function less(a, b) {
    return a < b;
  }

  function lessEq(a, b) {
    return a <= b;
  }

  function more(a, b) {
    return a > b;
  }

  function moreEq(a, b) {
    return a >= b;
  }

  function processRangeArgs(args, inclusive) {
    let [start, stop] = args;

    if (stop === undefined) {
      stop = start;
      start = 0;
    }

    const ascending = start <= stop,
      cond = ascending
        ? inclusive
          ? lessEq
          : less
        : inclusive
        ? moreEq
        : more,
      step = ascending ? 1 : -1;
    return [start, stop, step, cond];
  }
  function incRange() {
    const [start, stop, step, cond] = processRangeArgs(arguments, true),
      res = [];

    for (let v = start; cond(v, stop); v += step) {
      res.push(v);
    }

    return res;
  }
  function countOccurences(str, substr) {
    let i = 0,
      n = 0;

    while ((i = str.indexOf(substr, i)) !== -1) {
      i += substr.length;
      n += 1;
    }

    return n;
  }
  function bind(obj, meth) {
    return obj[meth].bind(obj);
  }
  function splitArray(arr, chunk) {
    let array = [];

    for (let i = 0; i <= arr.length; i += chunk) {
      array.push(arr.slice(i, i + chunk));
    }

    return array;
  } // UUID v4 generation (adopted from https://www.npmjs.com/package/uuid)

  /**
   * Convert array of 16 byte values to UUID string format of the form:
   * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   */

  const byteToHex = run(() => {
    let byteToHex = new Array(256);

    for (let i = 0; i < 256; i += 1) {
      byteToHex[i] = (i + 0x100).toString(16).substr(1);
    }

    return byteToHex;
  });

  function bytesToUuid(buf) {
    let i = 0,
      bth = byteToHex;
    return [
      bth[buf[i++]],
      bth[buf[i++]],
      bth[buf[i++]],
      bth[buf[i++]],
      "-",
      bth[buf[i++]],
      bth[buf[i++]],
      "-",
      bth[buf[i++]],
      bth[buf[i++]],
      "-",
      bth[buf[i++]],
      bth[buf[i++]],
      "-",
      bth[buf[i++]],
      bth[buf[i++]],
      bth[buf[i++]],
      bth[buf[i++]],
      bth[buf[i++]],
      bth[buf[i++]],
    ].join("");
  }
  /**
   * Generate UUID v4. Random number are taken from crypto.getRandomValues()
   * @return String: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   */

  function makeUuid() {
    let buf = new Uint8Array(16);
    crypto.getRandomValues(buf); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`

    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    return bytesToUuid(buf);
  }
  /**
   * Generate hexadecimal value in string format
   * @return String
   */

  function hexString(buffer) {
    const byteArray = new Uint8Array(buffer);
    const hexCodes = [...byteArray].map((value) => {
      const hexCode = value.toString(16);
      const paddedHexCode = hexCode.padStart(2, "0");
      return paddedHexCode;
    });
    return hexCodes.join("");
  }

  /**
   * Replace asynchronous Chrome APIs with wrappers that return a promise.

   * This code is based on:
   * https://github.com/KeithHenry/chromeExtensionAsync/blob/master/chrome-extension-async.js
   *
   * @author Keith Henry <keith.henry@evolutionjobs.co.uk>
   * @license MIT
  */
  /** Wrap an asynchronous function.
   * @param {function} func - async function to wrap, should accept a callback as last argument
   * @param propChain - name of chrome API function being wrapped (for error reporting)
   * @param {Array} callbackArgNames - callback argument names, in case there are >2 of them. In this
   *   case, the promise will resolve to an object having specified keys.
   */

  function promisify(func, propChain, callbackArgNames = null) {
    return function () {
      if (typeof arguments[arguments.length - 1] === "function") {
        // Callback was passed in explicitly
        return func.apply(this, arguments);
      }

      return new Promise((resolve, reject) => {
        func(...arguments, function () {
          // Chrome extensions always fire the callback, but populate chrome.runtime.lastError
          // with exception details
          if (chrome.runtime.lastError) {
            // Return as an error for the awaited catch block
            let msg = chrome.runtime.lastError.message || "(empty)";
            reject(
              new Error(`Chrome API "${propChain}" failed with message: ${msg}`)
            );
          } else {
            if (callbackArgNames) {
              let obj = {};

              for (let i = 0; i < callbackArgNames.length; i += 1) {
                obj[callbackArgNames[i]] = arguments[i];
              }

              resolve(obj);
            } else if (arguments.length === 1) {
              resolve(arguments[0]);
            } else if (arguments.length === 0) {
              resolve();
            } else {
              resolve(Array.prototype.slice.call(arguments, 0));
            }
          }
        });
      });
    };
  }

  const reFuncName = /^(\w+)(:.+)?$/;
  /**
   * Parse 'str' as function name.
   *
   * @see applyMap
   *
   * @param str - func name
   * @return array [funcName, callbackArgNames | null]
   */

  function parseFuncName(str) {
    let match = reFuncName.exec(str);

    if (match[2]) {
      return [match[1], match[2].slice(1).split(",")];
    } else {
      return [match[1], null];
    }
  }
  /** Promisify all the known functions in the map
   *
   * @param object - The Chrome native API to extend (a function or a nested object)
   * @param map - nested map or array of string.
   *
   * Recursive definition of a map:
   *   map ::= ['string', ...]
   *   map ::= {key: map, ...}
   *
   * Each 'string' is either a name of function or a string in the form 'func:arg1,arg2,...', where
   * all the 'arg1,...,argn' go as callbackArgNames to promisify().
   * */

  function applyMap(object, propChain, map) {
    if (!object) {
      // Not supported by current permissions
      return;
    }

    if (Array.isArray(map)) {
      for (let str of map) {
        let [funcName, callbackArgNames] = parseFuncName(str);

        if (!object[funcName]) {
          continue; // not supported by current permissions
        }

        if (typeof object[funcName] !== "function") {
          failure(`Not a function by the name ${funcName} in Chrome API`);
        }

        object[funcName] = promisify(
          bind(object, funcName),
          `${propChain}.${funcName}`,
          callbackArgNames
        );
      }
    } else {
      for (let key in map) {
        applyMap(object[key], `${propChain}.${key}`, map[key]);
      }
    }
  } // accessibilityFeatures https://developer.chrome.com/extensions/accessibilityFeatures

  const knownA11ySetting = ["get", "set", "clear"]; // ContentSetting https://developer.chrome.com/extensions/contentSettings#type-ContentSetting

  const knownInContentSetting = [
    "clear",
    "get",
    "set",
    "getResourceIdentifiers",
  ]; // StorageArea https://developer.chrome.com/extensions/storage#type-StorageArea

  const knownInStorageArea = ["get", "getBytesInUse", "set", "remove", "clear"]; // Map of API functions that follow the callback pattern that we can 'promisify'

  applyMap(chrome, "chrome", {
    // Todo: this should extend AccessibilityFeaturesSetting.prototype instead
    accessibilityFeatures: {
      spokenFeedback: knownA11ySetting,
      largeCursor: knownA11ySetting,
      stickyKeys: knownA11ySetting,
      highContrast: knownA11ySetting,
      screenMagnifier: knownA11ySetting,
      autoclick: knownA11ySetting,
      virtualKeyboard: knownA11ySetting,
      animationPolicy: knownA11ySetting,
    },
    alarms: ["get", "getAll", "clear", "clearAll"],
    bookmarks: [
      "get",
      "getChildren",
      "getRecent",
      "getTree",
      "getSubTree",
      "search",
      "create",
      "move",
      "update",
      "remove",
      "removeTree",
    ],
    browser: ["openTab"],
    browserAction: [
      "getTitle",
      "setIcon",
      "setPopup",
      "getPopup",
      "getBadgeText",
      "setBadgeText",
      "getBadgeBackgroundColor",
      "setBadgeBackgroundColor",
    ],
    browsingData: [
      "settings",
      "remove",
      "removeAppcache",
      "removeCache",
      "removeCookies",
      "removeDownloads",
      "removeFileSystems",
      "removeFormData",
      "removeHistory",
      "removeIndexedDB",
      "removeLocalStorage",
      "removePluginData",
      "removePasswords",
      "removeWebSQL",
    ],
    commands: ["getAll"],
    // Todo: this should extend ContentSetting.prototype instead
    contentSettings: {
      cookies: knownInContentSetting,
      images: knownInContentSetting,
      javascript: knownInContentSetting,
      location: knownInContentSetting,
      plugins: knownInContentSetting,
      popups: knownInContentSetting,
      notifications: knownInContentSetting,
      fullscreen: knownInContentSetting,
      mouselock: knownInContentSetting,
      microphone: knownInContentSetting,
      camera: knownInContentSetting,
      unsandboxedPlugins: knownInContentSetting,
      automaticDownloads: knownInContentSetting,
    },
    contextMenus: ["create", "update", "remove", "removeAll"],
    cookies: ["get", "getAll", "set", "remove", "getAllCookieStores"],
    debugger: ["attach", "detach", "sendCommand", "getTargets"],
    desktopCapture: ["chooseDesktopMedia"],
    // TODO: devtools.*
    documentScan: ["scan"],
    downloads: [
      "download",
      "search",
      "pause",
      "resume",
      "cancel",
      "getFileIcon",
      "erase",
      "removeFile",
      "acceptDanger",
    ],
    enterprise: {
      platformKeys: [
        "getToken",
        "getCertificates",
        "importCertificate",
        "removeCertificate",
      ],
    },
    // mostly deprecated in favour of runtime
    extension: ["isAllowedIncognitoAccess", "isAllowedFileSchemeAccess"],
    fileBrowserHandler: ["selectFile"],
    fileSystemProvider: ["mount", "unmount", "getAll", "get", "notify"],
    fontSettings: [
      "setDefaultFontSize",
      "getFont",
      "getDefaultFontSize",
      "getMinimumFontSize",
      "setMinimumFontSize",
      "getDefaultFixedFontSize",
      "clearDefaultFontSize",
      "setDefaultFixedFontSize",
      "clearFont",
      "setFont",
      "clearMinimumFontSize",
      "getFontList",
      "clearDefaultFixedFontSize",
    ],
    gcm: ["register", "unregister", "send"],
    history: [
      "search",
      "getVisits",
      "addUrl",
      "deleteUrl",
      "deleteRange",
      "deleteAll",
    ],
    i18n: ["getAcceptLanguages", "detectLanguage"],
    identity: [
      "getAuthToken",
      "getProfileUserInfo",
      "removeCachedAuthToken",
      "launchWebAuthFlow",
      "getRedirectURL",
    ],
    idle: ["queryState"],
    input: {
      ime: [
        "setMenuItems",
        "commitText",
        "setCandidates",
        "setComposition",
        "updateMenuItems",
        "setCandidateWindowProperties",
        "clearComposition",
        "setCursorPosition",
        "sendKeyEvents",
        "deleteSurroundingText",
      ],
    },
    management: [
      "setEnabled",
      "getPermissionWarningsById",
      "get",
      "getAll",
      "getPermissionWarningsByManifest",
      "launchApp",
      "uninstall",
      "getSelf",
      "uninstallSelf",
      "createAppShortcut",
      "setLaunchType",
      "generateAppForLink",
    ],
    networking: {
      config: ["setNetworkFilter", "finishAuthentication"],
    },
    notifications: [
      "create",
      "update",
      "clear",
      "getAll",
      "getPermissionLevel",
    ],
    pageAction: ["getTitle", "updateIcon", "getPopup"],
    pageCapture: ["saveAsMHTML"],
    permissions: ["getAll", "contains", "request", "remove"],
    platformKeys: [
      "selectClientCertificates",
      "verifyTLSServerCertificate",
      "getKeyPair:publicKey,privateKey",
    ],
    runtime: [
      "getBackgroundPage",
      "openOptionsPage",
      "setUninstallURL",
      "restartAfterDelay", // NOTE: sendMessage is processed separately below
      "sendNativeMessage",
      "getPlatformInfo",
      "getPackageDirectoryEntry",
      "requestUpdateCheck:status,details",
    ],
    scriptBadge: ["getPopup"],
    sessions: ["getRecentlyClosed", "getDevices", "restore"],
    storage: {
      sync: knownInStorageArea,
      local: knownInStorageArea,
      managed: knownInStorageArea,
    },
    socket: [
      "create",
      "connect",
      "bind",
      "read",
      "write",
      "recvFrom",
      "sendTo",
      "listen",
      "accept",
      "setKeepAlive",
      "setNoDelay",
      "getInfo",
      "getNetworkList",
    ],
    sockets: {
      tcp: [
        "create",
        "update",
        "setPaused",
        "setKeepAlive",
        "setNoDelay",
        "connect",
        "disconnect",
        "secure",
        "send",
        "close",
        "getInfo",
        "getSockets",
      ],
      tcpServer: [
        "create",
        "update",
        "setPaused",
        "listen",
        "disconnect",
        "close",
        "getInfo",
        "getSockets",
      ],
      udp: [
        "create",
        "update",
        "setPaused",
        "bind",
        "send",
        "close",
        "getInfo",
        "getSockets",
        "joinGroup",
        "leaveGroup",
        "setMulticastTimeToLive",
        "setMulticastLoopbackMode",
        "getJoinedGroups",
        "setBroadcast",
      ],
    },
    system: {
      cpu: ["getInfo"],
      memory: ["getInfo"],
      storage: ["getInfo", "ejectDevice", "getAvailableCapacity"],
    },
    tabCapture: ["capture", "getCapturedTabs"],
    tabs: [
      "get",
      "getCurrent", // NOTE: sendMessage is processed separately below
      "create",
      "duplicate",
      "query",
      "highlight",
      "update",
      "move",
      "reload",
      "remove",
      "detectLanguage",
      "captureVisibleTab",
      "executeScript",
      "insertCSS",
      "setZoom",
      "getZoom",
      "setZoomSettings",
      "getZoomSettings",
      "discard",
    ],
    topSites: ["get"],
    tts: ["isSpeaking", "getVoices", "speak"],
    types: ["set", "get", "clear"],
    vpnProvider: [
      "createConfig",
      "destroyConfig",
      "setParameters",
      "sendPacket",
      "notifyConnectionStateChanged",
    ],
    wallpaper: ["setWallpaper"],
    webNavigation: ["getFrame", "getAllFrames", "handlerBehaviorChanged"],
    windows: [
      "get",
      "getCurrent",
      "getLastFocused",
      "getAll",
      "create",
      "update",
      "remove",
    ],
  }); // Special handling for sendMessage: we want to be able to specify or omit the callback

  chrome.runtime.send1wayMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = promisify(
    bind(chrome.runtime, "sendMessage"),
    "chrome.runtime.sendMessage"
  );
  chrome.tabs.send1wayMessage = chrome.tabs.sendMessage;
  chrome.tabs.sendMessage = promisify(
    bind(chrome.tabs, "sendMessage"),
    "chrome.tabs.sendMessage"
  );

  /** @module Extend native prototypes */
  Object.defineProperties(Array.prototype, {
    isEmpty: {
      get() {
        return this.length === 0;
      },
    },
    isNonEmpty: {
      get() {
        return this.length > 0;
      },
    },
    extend: {
      value(...iterables) {
        for (let iterable of iterables) {
          for (let x of iterable) {
            this.push(x);
          }
        }
      },
    },
    remove: {
      value(item) {
        let idx = this.indexOf(item);

        if (idx !== -1) {
          this.splice(idx, 1);
          return true;
        } else {
          return false;
        }
      },
    },
    removeIf: {
      value(pred) {
        let idx = this.findIndex(pred);

        if (idx !== -1) {
          this.splice(idx, 1);
          return true;
        } else {
          return false;
        }
      },
    },
  });
  Object.defineProperties(Set.prototype, {
    isEmpty: {
      get() {
        return this.size === 0;
      },
    },
    isNonEmpty: {
      get() {
        return this.size > 0;
      },
    },
    uniteWith: {
      value(...iterables) {
        for (let iterable of iterables) {
          for (let x of iterable) {
            this.add(x);
          }
        }
      },
    },
    deleteAll: {
      value(...iterables) {
        for (let iterable of iterables) {
          for (let x of iterable) {
            this.delete(x);
          }
        }
      },
    },
  });
  Object.defineProperties(Map.prototype, {
    isEmpty: {
      get() {
        return this.size === 0;
      },
    },
    isNonEmpty: {
      get() {
        return this.size > 0;
      },
    },

    /**
     * Generate
     * @param keys: iterable of keys
     */
    getAll: {
      value: function* (keys) {
        for (const key of keys) {
          yield this.get(key);
        }
      },
    },
  });
  Set.empty = new Set();
  Map.empty = new Map();

  /** Highest positive signed 32-bit float value */
  const maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

  /** Bootstring parameters */
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  const initialBias = 72;
  const initialN = 128; // 0x80
  const delimiter = "-"; // '\x2D'

  /** Regular expressions */
  const regexPunycode = /^xn--/;
  const regexNonASCII = /[^\0-\x7E]/; // non-ASCII chars
  const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

  /** Error messages */
  const errors = {
    overflow: "Overflow: input needs wider integers to process",
    "not-basic": "Illegal input >= 0x80 (not a basic code point)",
    "invalid-input": "Invalid input",
  };

  /** Convenience shortcuts */
  const baseMinusTMin = base - tMin;
  const floor = Math.floor;
  const stringFromCharCode = String.fromCharCode;

  /*--------------------------------------------------------------------------*/

  /**
   * A generic error utility function.
   * @private
   * @param {String} type The error type.
   * @returns {Error} Throws a `RangeError` with the applicable error message.
   */
  function error(type) {
    throw new RangeError(errors[type]);
  }

  /**
   * A generic `Array#map` utility function.
   * @private
   * @param {Array} array The array to iterate over.
   * @param {Function} callback The function that gets called for every array
   * item.
   * @returns {Array} A new array of values returned by the callback function.
   */
  function map(array, fn) {
    const result = [];
    let length = array.length;
    while (length--) {
      result[length] = fn(array[length]);
    }
    return result;
  }

  /**
   * A simple `Array#map`-like wrapper to work with domain name strings or email
   * addresses.
   * @private
   * @param {String} domain The domain name or email address.
   * @param {Function} callback The function that gets called for every
   * character.
   * @returns {Array} A new string of characters returned by the callback
   * function.
   */
  function mapDomain(string, fn) {
    const parts = string.split("@");
    let result = "";
    if (parts.length > 1) {
      // In email addresses, only the domain name should be punycoded. Leave
      // the local part (i.e. everything up to `@`) intact.
      result = parts[0] + "@";
      string = parts[1];
    }
    // Avoid `split(regex)` for IE8 compatibility. See #17.
    string = string.replace(regexSeparators, "\x2E");
    const labels = string.split(".");
    const encoded = map(labels, fn).join(".");
    return result + encoded;
  }

  /**
   * Creates an array containing the numeric code points of each Unicode
   * character in the string. While JavaScript uses UCS-2 internally,
   * this function will convert a pair of surrogate halves (each of which
   * UCS-2 exposes as separate characters) into a single code point,
   * matching UTF-16.
   * @see `punycode.ucs2.encode`
   * @see <https://mathiasbynens.be/notes/javascript-encoding>
   * @memberOf punycode.ucs2
   * @name decode
   * @param {String} string The Unicode input string (UCS-2).
   * @returns {Array} The new array of code points.
   */
  function ucs2decode(string) {
    const output = [];
    let counter = 0;
    const length = string.length;
    while (counter < length) {
      const value = string.charCodeAt(counter++);
      if (value >= 0xd800 && value <= 0xdbff && counter < length) {
        // It's a high surrogate, and there is a next character.
        const extra = string.charCodeAt(counter++);
        if ((extra & 0xfc00) == 0xdc00) {
          // Low surrogate.
          output.push(((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
        } else {
          // It's an unmatched surrogate; only append this code unit, in case the
          // next code unit is the high surrogate of a surrogate pair.
          output.push(value);
          counter--;
        }
      } else {
        output.push(value);
      }
    }
    return output;
  }

  /**
   * Creates a string based on an array of numeric code points.
   * @see `punycode.ucs2.decode`
   * @memberOf punycode.ucs2
   * @name encode
   * @param {Array} codePoints The array of numeric code points.
   * @returns {String} The new Unicode string (UCS-2).
   */
  const ucs2encode = (array) => String.fromCodePoint(...array);

  /**
   * Converts a basic code point into a digit/integer.
   * @see `digitToBasic()`
   * @private
   * @param {Number} codePoint The basic numeric code point value.
   * @returns {Number} The numeric value of a basic code point (for use in
   * representing integers) in the range `0` to `base - 1`, or `base` if
   * the code point does not represent a value.
   */
  const basicToDigit = function (codePoint) {
    if (codePoint - 0x30 < 0x0a) {
      return codePoint - 0x16;
    }
    if (codePoint - 0x41 < 0x1a) {
      return codePoint - 0x41;
    }
    if (codePoint - 0x61 < 0x1a) {
      return codePoint - 0x61;
    }
    return base;
  };

  /**
   * Converts a digit/integer into a basic code point.
   * @see `basicToDigit()`
   * @private
   * @param {Number} digit The numeric value of a basic code point.
   * @returns {Number} The basic code point whose value (when used for
   * representing integers) is `digit`, which needs to be in the range
   * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
   * used; else, the lowercase form is used. The behavior is undefined
   * if `flag` is non-zero and `digit` has no uppercase form.
   */
  const digitToBasic = function (digit, flag) {
    //  0..25 map to ASCII a..z or A..Z
    // 26..35 map to ASCII 0..9
    return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
  };

  /**
   * Bias adaptation function as per section 3.4 of RFC 3492.
   * https://tools.ietf.org/html/rfc3492#section-3.4
   * @private
   */
  const adapt = function (delta, numPoints, firstTime) {
    let k = 0;
    delta = firstTime ? floor(delta / damp) : delta >> 1;
    delta += floor(delta / numPoints);
    for (
      ;
      /* no initialization */ delta > (baseMinusTMin * tMax) >> 1;
      k += base
    ) {
      delta = floor(delta / baseMinusTMin);
    }
    return floor(k + ((baseMinusTMin + 1) * delta) / (delta + skew));
  };

  /**
   * Converts a Punycode string of ASCII-only symbols to a string of Unicode
   * symbols.
   * @memberOf punycode
   * @param {String} input The Punycode string of ASCII-only symbols.
   * @returns {String} The resulting string of Unicode symbols.
   */
  const decode = function (input) {
    // Don't use UCS-2.
    const output = [];
    const inputLength = input.length;
    let i = 0;
    let n = initialN;
    let bias = initialBias;

    // Handle the basic code points: let `basic` be the number of input code
    // points before the last delimiter, or `0` if there is none, then copy
    // the first basic code points to the output.

    let basic = input.lastIndexOf(delimiter);
    if (basic < 0) {
      basic = 0;
    }

    for (let j = 0; j < basic; ++j) {
      // if it's not a basic code point
      if (input.charCodeAt(j) >= 0x80) {
        error("not-basic");
      }
      output.push(input.charCodeAt(j));
    }

    // Main decoding loop: start just after the last delimiter if any basic code
    // points were copied; start at the beginning otherwise.

    for (
      let index = basic > 0 ? basic + 1 : 0;
      index < inputLength /* no final expression */;

    ) {
      // `index` is the index of the next character to be consumed.
      // Decode a generalized variable-length integer into `delta`,
      // which gets added to `i`. The overflow checking is easier
      // if we increase `i` as we go, then subtract off its starting
      // value at the end to obtain `delta`.
      let oldi = i;
      for (let w = 1, k = base /* no condition */; ; k += base) {
        if (index >= inputLength) {
          error("invalid-input");
        }

        const digit = basicToDigit(input.charCodeAt(index++));

        if (digit >= base || digit > floor((maxInt - i) / w)) {
          error("overflow");
        }

        i += digit * w;
        const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;

        if (digit < t) {
          break;
        }

        const baseMinusT = base - t;
        if (w > floor(maxInt / baseMinusT)) {
          error("overflow");
        }

        w *= baseMinusT;
      }

      const out = output.length + 1;
      bias = adapt(i - oldi, out, oldi == 0);

      // `i` was supposed to wrap around from `out` to `0`,
      // incrementing `n` each time, so we'll fix that now:
      if (floor(i / out) > maxInt - n) {
        error("overflow");
      }

      n += floor(i / out);
      i %= out;

      // Insert `n` at position `i` of the output.
      output.splice(i++, 0, n);
    }

    return String.fromCodePoint(...output);
  };

  /**
   * Converts a string of Unicode symbols (e.g. a domain name label) to a
   * Punycode string of ASCII-only symbols.
   * @memberOf punycode
   * @param {String} input The string of Unicode symbols.
   * @returns {String} The resulting Punycode string of ASCII-only symbols.
   */
  const encode = function (input) {
    const output = [];

    // Convert the input in UCS-2 to an array of Unicode code points.
    input = ucs2decode(input);

    // Cache the length.
    let inputLength = input.length;

    // Initialize the state.
    let n = initialN;
    let delta = 0;
    let bias = initialBias;

    // Handle the basic code points.
    for (const currentValue of input) {
      if (currentValue < 0x80) {
        output.push(stringFromCharCode(currentValue));
      }
    }

    let basicLength = output.length;
    let handledCPCount = basicLength;

    // `handledCPCount` is the number of code points that have been handled;
    // `basicLength` is the number of basic code points.

    // Finish the basic string with a delimiter unless it's empty.
    if (basicLength) {
      output.push(delimiter);
    }

    // Main encoding loop:
    while (handledCPCount < inputLength) {
      // All non-basic code points < n have been handled already. Find the next
      // larger one:
      let m = maxInt;
      for (const currentValue of input) {
        if (currentValue >= n && currentValue < m) {
          m = currentValue;
        }
      }

      // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
      // but guard against overflow.
      const handledCPCountPlusOne = handledCPCount + 1;
      if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
        error("overflow");
      }

      delta += (m - n) * handledCPCountPlusOne;
      n = m;

      for (const currentValue of input) {
        if (currentValue < n && ++delta > maxInt) {
          error("overflow");
        }
        if (currentValue == n) {
          // Represent delta as a generalized variable-length integer.
          let q = delta;
          for (let k = base /* no condition */; ; k += base) {
            const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
            if (q < t) {
              break;
            }
            const qMinusT = q - t;
            const baseMinusT = base - t;
            output.push(
              stringFromCharCode(digitToBasic(t + (qMinusT % baseMinusT), 0))
            );
            q = floor(qMinusT / baseMinusT);
          }

          output.push(stringFromCharCode(digitToBasic(q, 0)));
          bias = adapt(
            delta,
            handledCPCountPlusOne,
            handledCPCount == basicLength
          );
          delta = 0;
          ++handledCPCount;
        }
      }

      ++delta;
      ++n;
    }
    return output.join("");
  };

  /**
   * Converts a Punycode string representing a domain name or an email address
   * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
   * it doesn't matter if you call it on a string that has already been
   * converted to Unicode.
   * @memberOf punycode
   * @param {String} input The Punycoded domain name or email address to
   * convert to Unicode.
   * @returns {String} The Unicode representation of the given Punycode
   * string.
   */
  const toUnicode = function (input) {
    return mapDomain(input, function (string) {
      return regexPunycode.test(string)
        ? decode(string.slice(4).toLowerCase())
        : string;
    });
  };

  /**
   * Converts a Unicode string representing a domain name or an email address to
   * Punycode. Only the non-ASCII parts of the domain name will be converted,
   * i.e. it doesn't matter if you call it with a domain that's already in
   * ASCII.
   * @memberOf punycode
   * @param {String} input The domain name or email address to convert, as a
   * Unicode string.
   * @returns {String} The Punycode representation of the given domain name or
   * email address.
   */
  const toASCII = function (input) {
    return mapDomain(input, function (string) {
      return regexNonASCII.test(string) ? "xn--" + encode(string) : string;
    });
  };

  /*--------------------------------------------------------------------------*/

  /** Define the public API */
  const punycode = {
    /**
     * A string representing the current Punycode.js version number.
     * @memberOf punycode
     * @type String
     */
    version: "2.1.0",
    /**
     * An object of methods to convert from JavaScript's internal character
     * representation (UCS-2) to Unicode code points, and back.
     * @see <https://mathiasbynens.be/notes/javascript-encoding>
     * @memberOf punycode
     * @type Object
     */
    ucs2: {
      decode: ucs2decode,
      encode: ucs2encode,
    },
    decode: decode,
    encode: encode,
    toASCII: toASCII,
    toUnicode: toUnicode,
  };

  class InvalidCss4 extends Error {
    constructor(streamOrMsg) {
      if (streamOrMsg instanceof Stream) {
        super(
          `Invalid CSS4 selector, remains to parse: ${streamOrMsg.sliceAhead()}`
        );
      } else {
        super(streamOrMsg);
      }
    }
  }

  class Stream {
    constructor(str) {
      this.str = str;
      this.i = 0;
    }

    get done() {
      return this.i >= this.str.length;
    }

    lookingAt(thg) {
      if (typeof thg === "string") {
        return this.str.slice(this.i, this.i + thg.length) === thg;
      } else {
        thg.lastIndex = this.i;
        return thg.test(this.str);
      }
    }

    get char() {
      return this.str[this.i];
    }

    consumeChar() {
      if (this.done) {
        throw new InvalidCss4(this);
      }

      let char = this.char;
      this.next();
      return char;
    }

    next() {
      this.i += 1;
    }

    sliceAhead() {
      return this.str.slice(this.i);
    }

    tryConsume(re) {
      re.lastIndex = this.i;
      let mo = re.exec(this.str);

      if (mo) {
        this.i += mo[0].length;
      }

      return mo;
    }

    consume(re) {
      let mo = this.tryConsume(re);

      if (mo === null) {
        throw new InvalidCss4(this);
      }

      return mo;
    }

    eatUpto(re) {
      re.lastIndex = this.i;
      let mo = re.exec(this.str);
      let j = mo ? mo.index : this.str.length;
      let res = this.str.slice(this.i, j);
      this.i = j;
      return res;
    }

    skipWhitespace() {
      let re = /\s*/y;
      re.lastIndex = this.i;
      re.test(this.str);
      this.i = re.lastIndex;
    }
  }

  const {
    reAttribute,
    reParenGroupOfInterest,
    rePseudo,
    reTextOrRegexInParen,
    reCssPropValueInParen,
  } = (function () {
    let unit = "(?:\\\\?.)";
    let esc = "(?:\\\\.)";
    let string = `(?<quote>["'])(?<string>${unit}*?)\\k<quote>`;
    let range = `\\[${unit}+?\\]`;
    let regex = `/(?<regex>(?:${esc}|${range}|.)+?)/(?<regexModifiers>[a-z]*)`;
    let attr = `(?<attr>.+?)`;
    let text = `(?<text>.+?)`;
    let attribute = `\\[\\s*${attr}\\s*(?:=\\s*(?:${string}|${text}))?\\s*\\]`;
    let pseudo = `::?[-\\w]+`;
    let textOrRegexInParen = `\\(\\s*(?:${regex}|${text})\\s*\\)`;
    let prop = `(?<prop>.+?)`;
    let cssPropValueInParen = `\\(${prop}\\s*:\\s*(?:${regex}|${text})\\s*\\)`;
    let parenGroupOfInterest = `(?:${string}|${regex}|.)*?(?<paren>[()])`;
    return {
      reAttribute: new RegExp(attribute, "y"),
      rePseudo: new RegExp(pseudo, "y"),
      reTextOrRegexInParen: new RegExp(textOrRegexInParen, "y"),
      reCssPropValueInParen: new RegExp(cssPropValueInParen, "y"),
      reParenGroupOfInterest: new RegExp(parenGroupOfInterest, "y"),
    };
  })();

  function compileSelector(selector) {
    let stream = new Stream(selector);

    function consumeComplex() {
      let firstLink = {
          next: null,
        },
        lastLink = firstLink;

      function link(newLink) {
        lastLink.next = newLink;
        lastLink = newLink;
      }

      for (;;) {
        stream.skipWhitespace();

        while (stream.lookingAt(/[~+]/y)) {
          link(jsDeepener(stream.consumeChar()));
          stream.skipWhitespace();
          let { plain: subplain, filters: subfilters } = consumeCompound();

          if (subplain) {
            subfilters.push(matchesSelectorFilter(subplain));
          }

          if (subfilters.length === 0) {
            throw new InvalidCss4(stream);
          }

          link(filtersAsLink(subfilters));
          stream.skipWhitespace();
        }

        let prefix;

        if (stream.lookingAt(">")) {
          prefix = ":scope > ";
          stream.next();
          stream.skipWhitespace();
        } else if (firstLink === lastLink) {
          prefix = "";
        } else {
          prefix = ":scope ";
        }

        let { plain, filters } = consumePlainCompounds();

        if (!plain) {
          break;
        }

        link(nativeDeepener(prefix + plain));

        if (filters === null) {
          break;
        }

        if (filters.length > 1) {
          for (let f of filters) {
            link(filtersAsLink([f]));
          }
        } else {
          link(filtersAsLink(filters));
        }
      }

      return firstLink.next;
    }

    function consumePlainCompounds() {
      let plainCompounds = [];

      for (;;) {
        if (stream.done || stream.lookingAt(",")) {
          return {
            plain: plainCompounds.join("\x20"),
            filters: null,
          };
        }

        let { plain, filters } = consumeCompound();

        if (!plain && filters.length === 0) {
          throw new InvalidCss4(stream);
        }

        if (plain) {
          plainCompounds.push(plain);
        }

        if (filters.length > 0) {
          if (!plain) {
            plainCompounds.push("*");
          }

          return {
            plain: plainCompounds.join("\x20"),
            filters,
          };
        }

        stream.skipWhitespace();

        if (stream.lookingAt(/[>+~]/y)) {
          plainCompounds.push(stream.consumeChar());
          stream.skipWhitespace();
        }
      }
    }

    function consumeCompound() {
      const reStop = /[\[:\s>+~,]/g;
      let chunks = [],
        filters = [];

      for (;;) {
        let chunk = stream.eatUpto(reStop);
        chunks.push(chunk);

        if (stream.done) {
          break;
        } else if (stream.char === "[") {
          let res = consumeAttribute();

          if (typeof res === "string") {
            chunks.push(res);
          } else {
            filters.push(res);
          }
        } else if (stream.char === ":") {
          let res = consumePseudo();

          if (typeof res === "string") {
            chunks.push(res);
          } else {
            filters.push(res);
          }
        } else {
          break;
        }
      }

      return {
        plain: chunks.join(""),
        filters,
      };
    }

    function consumeAttribute() {
      let {
        0: chunk,
        groups: { attr, string },
      } = stream.consume(reAttribute);

      if (attr === "-ext-has" || attr === "-abp-has") {
        if (!string) {
          return chunk;
        } // TODO: do we need to unescape string?

        return hasFilter(compileSelector(string));
      } else if (attr === "-ext-contains" || attr === "-abp-contains") {
        if (!string) {
          return chunk;
        } // TODO: do we need to unescape string?

        return containsFilter({
          text: string,
        });
      } else {
        return chunk;
      }
    }

    function consumePseudo() {
      let [pseudo] = stream.consume(rePseudo);

      if (pseudo === ":has" || pseudo === ":-abp-has") {
        let selector = consumeParenGroup();
        return hasFilter(compileSelector(selector));
      } else if (/^:matches-css(?:-before|-after)?$/.test(pseudo)) {
        let pseudoElt = pseudo.endsWith("-after")
            ? ":after"
            : pseudo.endsWith("-before")
            ? ":before"
            : null,
          {
            groups: { prop, regex, regexModifiers, text },
          } = stream.consume(reCssPropValueInParen);

        if (regex) {
          validateRegex(regex, regexModifiers);
          return matchesCssFilter(
            prop,
            {
              regex,
              regexModifiers,
            },
            pseudoElt
          );
        } else {
          return matchesCssFilter(
            prop,
            {
              text,
            },
            pseudoElt
          );
        }
      } else if (pseudo === ":contains" || pseudo === ":-abp-contains") {
        let {
          groups: { regex, regexModifiers, text },
        } = stream.consume(reTextOrRegexInParen);

        if (regex) {
          validateRegex(regex, regexModifiers);
          return containsFilter({
            regex,
            regexModifiers,
          });
        } else {
          return containsFilter({
            text,
          });
        }
      } else if (pseudo === ":not") {
        let selector = consumeParenGroup();
        let chain$$1 = compileSelector(selector);

        if (isChainPlainSelector(chain$$1)) {
          return pseudo + "(" + selector + ")";
        } else {
          return notFilter(chain$$1);
        }
      } else if (pseudo === ":upward") {
        let selector = consumeParenGroup();
        let output;

        if (!Number.isInteger(+selector)) {
          let chain$$1 = compileSelector(selector);
          output = isChainPlainSelector(chain$$1)
            ? chain$$1.selector
            : chain$$1;
        } else {
          if (Number.isNaN(+selector) || +selector < 1 || +selector >= 256) {
            throw new InvalidCss4(selector);
          }

          output = convertNthAncestor(selector);
        }

        return ancestorFilter("upward", output, selector);
      } else if (pseudo === ":nth-ancestor") {
        let selector = consumeParenGroup();
        let deep = Number(selector);

        if (Number.isNaN(deep) || deep < 1 || deep >= 256) {
          throw new InvalidCss4(selector);
        }

        let xpath = convertNthAncestor(selector);
        return ancestorFilter("nth-ancestor", xpath, selector);
      } else if (pseudo === ":xpath") {
        let xpath = consumeParenGroup();

        try {
          document.createExpression(xpath, null);
        } catch (e) {
          throw new InvalidCss4(xpath);
        }

        let xpathSelector = XpathSelector(xpath, stream.str);
        xpathSelector.specific = !!stream.str.indexOf(":xpath");
        return xpathSelector;
      } else {
        // Skip optional parentheses, no nested parens expected
        let [parens] = stream.tryConsume(/\(.*?\)/y) || [""];
        return pseudo + parens;
      }
    }

    function consumeParenGroup() {
      let nesting = 0,
        i = stream.i;

      for (;;) {
        let {
          groups: { paren },
        } = stream.consume(reParenGroupOfInterest);
        nesting += paren === "(" ? 1 : -1;

        if (nesting === 0) {
          break;
        }
      }

      return stream.str.slice(i + 1, stream.i - 1);
    }

    let chain$$1 = consumeComplex();
    stream.skipWhitespace();

    if (stream.done) {
      return chain$$1;
    }

    let chains = [chain$$1];
    chain$$1 = {
      type: "merger",
      chains: chains,
    };

    while (stream.lookingAt(",")) {
      stream.next();
      chains.push(consumeComplex());
      stream.skipWhitespace();
    }

    if (!stream.done) {
      throw new InvalidCss4(stream);
    }

    return chain$$1;
  }

  function isChainPlainSelector(chain$$1) {
    return (
      chain$$1.type === "deepener" && chain$$1.selector && chain$$1.next == null
    );
  }

  function validateRegex(regex, regexModifiers) {
    try {
      // The following assignment is done only because simple "new RegExp()" gets optimized away by
      // Rollup.  I wasn't able to quickly figure out how to instruct it not to be that smart.
      validateRegex.re = new RegExp(regex, regexModifiers);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new InvalidCss4(`Invalid regex: ${regex}`);
      }
    }
  }

  function nativeDeepener(selector) {
    return {
      type: "deepener",
      selector: selector,
    };
  }

  function jsDeepener(combinator) {
    return {
      type: "deepener",
      combinator: combinator,
    };
  }

  function matchesSelectorFilter(selector) {
    return {
      type: "matches-selector",
      selector: selector,
    };
  }

  function matchesCssFilter(prop, value, pseudoElt) {
    return {
      type: "matches-css",
      prop: prop,
      value: value,
      pseudoElt: pseudoElt,
    };
  }

  function containsFilter(what) {
    return {
      type: "contains",
      what: what,
    };
  }

  function hasFilter(chain$$1) {
    return {
      type: "has",
      chain: chain$$1,
    };
  }

  function notFilter(chain$$1) {
    return {
      type: "not",
      chain: chain$$1,
    };
  }

  function ancestorFilter(type, pseudoClassArg, selectorText) {
    return {
      type: type,
      pseudoClassArg: pseudoClassArg,
      selectorText: selectorText,
    };
  }

  function convertNthAncestor(deep) {
    let result = "..";

    while (deep > 1) {
      result += "/..";
      deep--;
    }

    return result;
  }

  function XpathSelector(xpath, selectorText) {
    let NO_SELECTOR_MARKER = ":xpath(//";
    let BODY_SELECTOR_REPLACER = "body:xpath(//";
    let modifiedSelectorText = selectorText;

    if (selectorText.startsWith(NO_SELECTOR_MARKER)) {
      modifiedSelectorText = selectorText.replace(
        NO_SELECTOR_MARKER,
        BODY_SELECTOR_REPLACER
      );
    }

    return ancestorFilter("xpath", xpath, modifiedSelectorText);
  }

  function filtersAsLink(filters) {
    const types = [
      "matches-selector",
      "contains",
      "matches-css",
      "has",
      "upward",
      "nth-ancestor",
      "xpath",
    ];
    const pseudoElts = [":before", null, ":after"];
    filters = filters.slice();
    filters.sort((f1, f2) => {
      let idx1 = types.indexOf(f1.type),
        idx2 = types.indexOf(f2.type);

      if (idx1 !== 2 || idx2 !== 2) {
        return idx1 - idx2;
      } // Both are matches-css. So compare pseudoElt properties, too

      return (
        pseudoElts.indexOf(f1.pseudoElt) - pseudoElts.indexOf(f2.pseudoElt)
      );
    });
    let i = filters.findIndex((f) => f.type === "matches-css");
    let ancestor = filters.findIndex((f) =>
      new RegExp(/upward|xpath|nth-ancestor/).test(f.type)
    ); //|'nth-ancestor'|'xpath'

    if (i !== -1) {
      // Merge consecutive matches-css filters that have the same pseudoElt
      while (i < filters.length && filters[i].type === "matches-css") {
        let props = {
          [filters[i].prop]: filters[i].value,
        };
        let j = i + 1;

        while (
          j < filters.length &&
          filters[j].type === "matches-css" &&
          filters[j].pseudoElt === filters[i].pseudoElt
        ) {
          props[filters[j].prop] = filters[j].value;
          j += 1;
        }

        filters.splice(i, j - i, {
          type: "matches-css",
          pseudoElt: filters[i].pseudoElt,
          props: props,
        });
        i = i + 1;
      }
    }

    if (ancestor !== -1) {
      return filters.find((f) =>
        new RegExp(/upward|xpath|nth-ancestor/).test(f.type)
      );
    }

    return {
      type: "filter",
      filters: filters,
    };
  }

  const CCODE_ASTERISK = 0x2a,
    CCODE_DOT = 0x2e;
  function charRangeStr(sFrom, sTo) {
    let cFrom = sFrom.charCodeAt(0),
      cTo = sTo.charCodeAt(0);

    if (cFrom > cTo) {
      throw new Error(
        'The "to" char code must be greater or equal to the "from" char code'
      );
    }

    return String.fromCharCode.apply(null, incRange(cFrom, cTo));
  }

  const reHttp = /^https?:\/\//;
  const reIP = /^\d+\.\d+\.\d+\.\d+$/;
  function isDomainSuffix(suffix, str) {
    const lenDiff = str.length - suffix.length;

    if (lenDiff < 0) {
      return false;
    }

    if (str.indexOf(suffix, lenDiff) === -1) {
      return false;
    }

    return lenDiff === 0 || str[lenDiff - 1] === ".";
  }
  const reNonAscii = /[^a-z0-9.-]/;
  function ensureAsciiHostname(hostname) {
    if (reNonAscii.test(hostname)) {
      return punycode.toASCII(hostname);
    }

    return hostname;
  }
  const urlValidChars = sconcat(
    "!",
    charRangeStr("#", ";"),
    "=?@",
    charRangeStr("[", "_"),
    charRangeStr("a", "z"),
    charRangeStr("{", "~")
  );
  function containsUrlValidCharsOnly(str) {
    return [...str].every((c) => urlValidChars.includes(c));
  }
  function isSubjectToAdBlocking(urlobj) {
    return reHttp.test(urlobj.href);
  }

  const reUnescapedSlash = /(?!\\)\//g,
    reContainsNonAscii = /[^\x00-\x7F]/,
    rePlainHostnameRule = /^\.?[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*\^?$/,
    // Extract leading hostname from patterns like ||some.name.com^
    reLeadingHostname = /^(\.?[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)(?:[/^]|$)/,
    reEnsureEndsWithSep = /^(\.?[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)($)/,
    reCosmeticRule = /^(.*?)#(@)?(\$|%|)(\?)?#(.+)$/,
    ANCHOR_START = 0b001,
    ANCHOR_END = 0b010,
    ANCHOR_HOSTNAME = 0b100,
    // party (1st/3rd) gets encoded together with the type
    types = [
      "first-party",
      "third-party",
      "sub_frame",
      "stylesheet",
      "script",
      "image",
      "font",
      "object",
      "xmlhttprequest",
      "media",
      "websocket",
      "other",
    ],
    // e.g. type2mask['stylesheet'] === (1 << 7)
    type2mask = run(function () {
      const res = {};

      for (let i = 0; i < types.length; i += 1) {
        res[types[i]] = 1 << i;
      } // Manually add:

      res["~first-party"] = res["third-party"];
      res["~third-party"] = res["first-party"];
      res["subdocument"] = res["sub_frame"]; // it is called $subdocument in rules

      return res;
    }),
    any_party = type2mask["first-party"] | type2mask["third-party"],
    any_type = ((1 << types.length) - 1) & ~any_party;
  class InvalidRuleError extends Error {}
  class Rule {
    constructor(options) {
      this.fid = null; // initialized later

      this.src = options.src;
      this.str = options.str || null;
      this.anchor = options.anchor || 0;
      this.allow = options.allow;
      this.type = options.type;
      this.domains = options.domains;
      this.bad = options.bad || false;
      this.notsupported = options.notsupported || false;
      this.important = options.important;
      this.redirect = options.redirect;
      this.re = options.re || null;
    }

    get regex() {
      if (this.re) {
        return this.re;
      } else {
        this.re = compileRegex(this.str, this.anchor);
        return this.re;
      }
    }
  }
  class GenericHideRule {
    constructor(options) {
      this.fid = null; // initialized later

      this.src = options.src;
      this.str = options.str || null;
      this.anchor = options.anchor || 0;
      this.bad = options.bad || false;
      this.re = options.re || compileRegex(this.str, this.anchor);
      this.domains = options.domains || null;
    }

    matches(url) {
      return this.re.test(url) && appliesByDomain(this.domains, url);
    }
  }
  class CosmeticRule {
    constructor(options) {
      this.fid = null; // initialized later

      this.domains = options.domains;
      this.selector = options.selector;
      this.allow = options.allow;
      this.style = options.style || null;
    }

    get isStyled() {
      return this.style !== null;
    }
  }
  class ExtCosmeticRule {
    static makeOne({ domains, contents, chain: chain$$1, styleObj }) {
      return Object.assign(new this(), arguments[0], {
        allow: false,
      });
    }

    static makeException({ domains, contents }) {
      return Object.assign(new this(), arguments[0], {
        allow: true,
      });
    }
  }
  class ScriptRule {
    constructor(options) {
      this.fid = null; // initialized later

      this.domains = options.domains || null;
      this.allow = options.allow;
      this.script = options.script;
    }
  }
  class ScriptletRule {
    constructor(options) {
      this.fid = null;
      this.domains = options.domains;
      this.name = options.name;
      this.arguments = options.arguments;
    }
  }
  function compileRegex(string, anchor) {
    if (string === "*") {
      return new RegExp("");
    }

    let str = string
      .replace(/[()[\]{}?.+$\\|]/g, "\\$&") // escape all special chars
      .replace(/\*|\^/g, function (s) {
        if (s === "*") return ".*";
        else if (s === "^") return "[^a-z0-9.%_-]";
      });

    if (anchor & ANCHOR_HOSTNAME) {
      if (str.startsWith("\\.")) {
        str = "^.+?://[0-9a-z.-]+?" + str;
      } else {
        str = "^.+?://(?:[0-9a-z.-]+?\\.)?" + str;
      }
    } else if (anchor & ANCHOR_START) {
      str = "^" + str;
    }

    if (anchor & ANCHOR_END) {
      str = str + "$";
    }

    return new RegExp(str);
  }
  function trimRule(src) {
    let str = src.trim();

    if (!str) {
      return null;
    }

    if (str.startsWith("!")) {
      // Comment
      return null;
    }

    return str;
  }
  function parseRule(src) {
    let match = reCosmeticRule.exec(src);

    if (match) {
      return parseCosmeticRule({
        domains: match[1],
        allow: Boolean(match[2]),
        kind: match[3],
        ext: Boolean(match[4]),
        contents: match[5],
      });
    } else {
      return parseNetRule(src);
    }
  }

  function parseNetRule(src) {
    let [str, $options] = ruleOptions(src);
    let pattern = parsePattern(str);
    let options = parseRuleOptions($options);

    if (options.generichide) {
      if (!pattern.allow) {
        throw new InvalidRuleError(
          `$generichide can only be used in exception rules`
        );
      }

      return new GenericHideRule({
        src,
        bad: options.bad,
        domains: options.domains,
        ...pattern,
      });
    }

    return new Rule({
      src,
      ...pattern,
      ...options,
    });
  }
  /**
   * Parse the pattern part of a network filter
   *
   * @return {str, anchor, allow} OR {re, allow}
   */

  function parsePattern(str) {
    let allow = false;

    if (str.startsWith("@@")) {
      allow = true;
      str = str.slice(2);
    }

    if (str.startsWith("/") && str.endsWith("/")) {
      return {
        re: parseRegexPattern(str.slice(1, -1)),
        allow,
      };
    }

    let anchor = 0;

    if (str.startsWith("||")) {
      anchor |= ANCHOR_HOSTNAME;
      str = str.slice(2);
    } else if (str.startsWith("|")) {
      anchor |= ANCHOR_START;
      str = str.slice(1);
    }

    if (str.endsWith("|")) {
      anchor |= ANCHOR_END;
      str = str.slice(0, -1);
    }

    let hasNonAscii = reContainsNonAscii.test(str),
      // We need to check for plain hostname before we process non-ASCII characters. That's why we
      // do this trick: substitute all of non-ASCII chars with some normal ASCII char and use that
      // string for plain hostname test.
      strAscii = hasNonAscii ? str.replace(/[^\x00-\x7F]/g, "x") : str; // completely convert "plain hostname" case to just "hostname-anchored"

    if (
      (anchor & ANCHOR_HOSTNAME) === 0 &&
      rePlainHostnameRule.test(strAscii)
    ) {
      anchor |= ANCHOR_HOSTNAME;
    } // If it's possible to extract the hostname part, encode non-ASCII chars in it (if any)

    if (hasNonAscii && anchor & ANCHOR_HOSTNAME) {
      let match = reLeadingHostname.exec(strAscii);

      if (match) {
        let i = match[1].length,
          hostname = str.slice(0, i),
          rest = str.slice(i);
        str = punycode.toASCII(hostname.toLowerCase()) + rest;
      }
    }

    if (anchor & ANCHOR_HOSTNAME) {
      str = str.replace(reEnsureEndsWithSep, "$1^");
    }

    if (reContainsNonAscii.test(str)) {
      throw new InvalidRuleError(
        "Filter contains non-ASCII characters in a non-hostname part"
      );
    }

    str = str.toLowerCase();

    if (!containsUrlValidCharsOnly(str)) {
      throw new InvalidRuleError("Filter contains invalid URL characters");
    }

    str = str || "*";
    return {
      str,
      anchor,
      allow,
    };
  }

  function parseRegexPattern(str) {
    try {
      return new RegExp(str);
    } catch (err) {
      if (err instanceof SyntaxError) {
        return;
      }

      throw err;
    }
  }
  /**
   * Find $ - options delimiter - and split the rule str at that position.
   * @param str - rule string
   * @return [selector, options]
   */

  function ruleOptions(str) {
    function splitAt(i) {
      return [str.slice(0, i), str.slice(i + 1)];
    }

    let i = str.indexOf("$");

    if (i === -1) {
      return [str, ""];
    }

    if (str[0] !== "/") {
      // If not starting with /, then it's guaranteed not to be a regexp-based filter
      return splitAt(i);
    } // Possible cases are:
    //   /...(?!/)$xmlhttprequest -- not a regexp-based filter, just starting with /
    //   /...$...$.../[$] -- regexp contains $ (1 or multiple)

    reUnescapedSlash.lastIndex = 1;

    if (!reUnescapedSlash.test(str)) {
      return splitAt(i);
    }

    if (reUnescapedSlash.lastIndex <= i) {
      return splitAt(i);
    }

    if (str[reUnescapedSlash.lastIndex] === "$") {
      return splitAt(reUnescapedSlash.lastIndex);
    }

    return splitAt(i);
  }
  /**
   * Parse string options into a plain object of properties (see code)
   *
   * @param $options - string options (everything past "$" sign)
   * @return either {generichide: true, bad: true/false} OR other options
   */

  function parseRuleOptions($options) {
    let options = {};
    $options
      .split(",")
      .map((opt) => opt.trim())
      .filter((opt) => opt !== "")
      .forEach((opt) => {
        options[opt] = true;
      });

    if (options["generichide"]) {
      delete options["generichide"];
      let bad = options["badfilter"] || false;
      delete options["badfilter"];
      let domains = null;
      let domain = Object.keys(options).find((opt) =>
        opt.startsWith("domain=")
      );

      if (domain) {
        delete options[domain];
        domains = parseDomains(domain.slice("domain=".length).split("|"));
      }

      delete options["content"];
      delete options["genericblock"];
      delete options["jsinject"];

      if (Object.keys(options).length > 0) {
        throw new InvalidRuleError(
          `$generichide cannot be combined with other options`
        );
      }

      return {
        generichide: true,
        domains,
        bad,
      };
    }

    let type = 0,
      nottype = any_type,
      // $~websocket,xmlhttprequest
      domains = null,
      bad = false,
      notsupported = false,
      important = false,
      redirect = null;

    for (let opt in options) {
      opt = opt.trim();

      switch (opt) {
        case "":
          continue;
        // skip empty strings, in cases like $xmlhttprequest,,third-party

        case "badfilter":
          bad = true;
          continue;

        case "replace":
        case "genericblock":
        case "popup": // The type "other" is possible for a particular request but it shouldn't be allowed to
        // specify it explicitly (makes no sense). So we just make the whole filter notsupported

        case "other":
          notsupported = true;
          continue;

        case "important":
          important = true;
          continue;
      }

      if (opt.startsWith("domain=")) {
        domains = parseDomains(opt.slice("domain=".length).split("|"));
        continue;
      }

      if (opt.startsWith("redirect=")) {
        redirect = opt.slice("redirect=".length);
        continue;
      }

      let mask = type2mask[opt];

      if (mask) {
        type |= mask;
        continue;
      } // Process negated types, like $~websocket. Negated ~first-party or ~third-party are processed
      // in the usual way (see above).

      if (opt.startsWith("~")) {
        mask = type2mask[opt.slice(1)];

        if (mask) {
          nottype &= ~mask;
          continue;
        }
      } // Unrecognized options -> ignore this filter

      notsupported = true;
    } // If none given, that actually means "block all", not "block none"

    if ((type & any_party) === 0) {
      type |= any_party;
    } // If given both negated types and normal types, that doesn't make sense

    if ((type & any_type) !== 0 && nottype !== any_type) {
      notsupported = true;
    } else if ((type & any_type) === 0) {
      type |= nottype;
    }

    return {
      type,
      nottype,
      domains,
      bad,
      notsupported,
      important,
      redirect,
    };
  }
  /**
   * Parse a list of possibly negated domains into [[domain, true|false], ...], where the second item
   * is false if negated (~), true if not.  The array is sorted by domain's nesting levels: domains
   * having most dots (.) inside go first.
   *
   * Empty domains are ignored. In case domains was empty or consisted of all empty strings, return
   * null, since [] as return value doesn't make sense.
   */

  function parseDomains(domains) {
    let suffixes = [];

    for (let domain of domains) {
      domain = domain.trim();

      if (!domain) {
        continue;
      }

      if (domain.startsWith("~")) {
        suffixes.push([domain.slice(1), false]);
      } else {
        suffixes.push([domain, true]);
      }
    }

    if (suffixes.isEmpty) {
      return null;
    }

    suffixes.sort((pair1, pair2) => {
      return countOccurences(pair2[0], ".") - countOccurences(pair1[0], ".");
    });
    return suffixes;
  }
  /**
   * Whether domains include or exclude pageHostname.
   *
   * @param domains - [[domain, true/false], ...]
   */

  function appliesByDomain(domains, pageHostname) {
    // Check domain manually, i f present
    if (domains === null) {
      return true;
    }

    let metPositive = false;

    for (let [suffix, include] of domains) {
      if (isDomainSuffix(suffix, pageHostname)) {
        return include;
      }

      metPositive = metPositive || include;
    }

    return !metPositive;
  }
  function cssRuleFor(rule) {
    return rule.selector + "{\n" + rule.style + "\n}";
  }
  function parseCosmeticRule({ domains, allow, kind, ext, contents }) {
    domains = parseDomains(domains.split(","));

    if (kind === "%") {
      // Script-injection rule (script is specified directly in the rule, in 1 line)
      return new ScriptRule({
        domains,
        allow,
        script: contents,
      });
    }

    if (kind === "" && contents.startsWith("+js")) {
      let option = contents.match(/(?<=\().+(?=\))/)[0].split(",");
      let name = option.splice(0, 1)[0].trim();
      let args = option.map((rule) => rule.trim());
      return new ScriptletRule({
        domains,
        name,
        arguments: args,
      });
    }

    let selector, style;

    if (kind === "") {
      selector = contents;
      style = null;
    } else {
      // Cosmetic rule with CSS properties
      let idxStart = contents.lastIndexOf("{"),
        idxEnd = contents.lastIndexOf("}");

      if (idxStart === -1 && idxEnd === -1) {
        // Styles were not given, so treat it like usual ## (implied display: none)
        selector = contents;
        style = null;
      } else if (idxStart === -1 || idxEnd === -1) {
        // Malformed filter
        throw new InvalidRuleError(
          "Malformed cosmetic filter: not found { or }"
        );
      } else {
        selector = contents.slice(0, idxStart).trim();
        style = contents.slice(idxStart + 1, idxEnd).trim();
      }
    }

    if (ext) {
      // Extended CSS cosmetic rule (with CSS4 selectors)
      if (allow) {
        return ExtCosmeticRule.makeException({
          domains,
          contents,
        });
      }

      let chain$$1;

      try {
        chain$$1 = compileSelector(selector);
      } catch (e) {
        if (!(e instanceof InvalidCss4)) {
          throw e;
        }

        throw new InvalidRuleError(e.message);
      }

      let styleObj = style === null ? null : parseCssDeclarations(style);
      return ExtCosmeticRule.makeOne({
        domains,
        contents,
        chain: chain$$1,
        styleObj,
      });
    }

    return new CosmeticRule({
      domains,
      selector,
      allow,
      style,
    });
  }

  function parseCssDeclarations(style) {
    const re = /\s*(?<prop>[-\w]+)\s*:\s*(?<value>.+?)\s*(?:$|;)/g;
    const reImportant = /\s*!important$/;
    let res = {};

    for (let {
      groups: { prop, value },
    } of style.matchAll(re)) {
      let mo = reImportant.exec(value);

      if (mo) {
        value = value.slice(0, mo.index);
      }

      res[prop] = value;
    }

    return res;
  }

  const // The following are just 0 which stands special at diff places, for better readability
    ZERO_INDEX = 0,
    STARTING_INDEX = 1,
    // index of the first node in the buffer
    ZERO_CCODE = 0,
    ZERO_CHAR = "\x00",
    ZERO_NSTR = 0,
    ZERO_TERMINAL = 0,
    MASK_NSTR = 0xffffff00,
    MASK_CCODE = 0x000000ff,
    MAX_NSTR = (1 << 24) - 1;
  function RadixTrie(initialBufLen) {
    this.buf = new Int32Array(initialBufLen); // zero-filled

    this.size = STARTING_INDEX; // {string: [nstr, refcount]}

    this.dict = Object.create(null); // {Number: string}

    this.nstr2word = Object.create(null);
    this.nstr2word[ZERO_NSTR] = ""; // special datum, to avoid special cases

    this.nextNstr = 1;
    this.nextTerminalNumber = 1;
  }
  /**
   * Add S (string) to radix and return the terminal value that corresponds to S
   * (either newly created or an old one, in case S has already been included in radix).
   */

  function add(radix, S) {
    S = S + ZERO_CHAR;

    if (isRadixEmpty(radix)) {
      // special case: first node
      makeNode(radix, S, null, "terminal");
      return radix.nextTerminalNumber - 1;
    }

    let s = 0,
      node = STARTING_INDEX,
      buf = radix.buf;

    while (s < S.length) {
      // Loop invariant: node points to a valid node, rather than ZERO_INDEX or terminal value (< 0).
      let c = S.charCodeAt(s);

      while (ccodeAt(buf, node) !== c && descAt(buf, node) !== ZERO_INDEX) {
        node = descAt(buf, node);
      }

      if (ccodeAt(buf, node) !== c) {
        // append the rest of S as the new descendant
        setDescAt(buf, node, makeNode(radix, S.slice(s + 1), c, "terminal"));
        return radix.nextTerminalNumber - 1;
      } // Found a node that starts with "c". 'node' is a node that fully or partially matched
      // some chars in S.

      s += 1;
      let W = wordAt(radix, node),
        // W === '' if node is a 1-char node
        w = 0; // NOTE: we don't check s < S.length because S always ends with \x00 and W either doesn't
      // contain \x00 char or ends with \x00. So we cannot step out of S.

      while (w < W.length && W.charCodeAt(w) === S.charCodeAt(s)) {
        w += 1;
        s += 1;
      }

      if (w === W.length) {
        // Fully matched W => continue with the sibling. If the sibling is a terminal value, that
        // means we just matched zero character, and consequently there will be no more iterations
        // of the while loop (s === S.length), so we won't break loop's invariant with negative
        // "node".
        node = siblingAt(buf, node);
      } else {
        // found a diff => split node into node and suffix node:
        //      (node)
        // P -> <w1...wiwi+1...wn> -> S
        //      |
        //      D
        //
        // becomes this:
        //
        //      (node)       (suffix)
        // P -> <w1...wi> -> <wi+1...wn> -> S
        //      |            |
        //      D            (new node goes here)
        let Wprefix = W.slice(0, w),
          Wsuffix = W.slice(w),
          nodeSuffix = makeNode(radix, Wsuffix);
        buf = radix.buf; // makeNode may have re-allocated the buffer

        removeWord(radix, W);
        setContentsAt(buf, node, addWord(radix, Wprefix), c);
        setSiblingAt(buf, nodeSuffix, siblingAt(buf, node));
        setSiblingAt(buf, node, nodeSuffix);
        node = nodeSuffix; // next iteration will create a desc of nodeSuffix, and that'd be it
      }
    }

    return -node;
  }
  /**
   * Look for all prefix matches: feed char codes 1 by 1 with gen.next(), return when a mismatch
   * was found.
   *
   * Return array of 0 or more terminal values.
   * ZERO_CCODE can be fed to the prefix matcher to force its stop.
   */

  function* prefixMatcher(radix) {
    if (isRadixEmpty(radix)) {
      return [];
    }

    let node = STARTING_INDEX,
      buf = radix.buf,
      terminals = [];

    for (;;) {
      let c = yield; // c cannot be ZERO_CCODE, we rely on this

      if (c === ZERO_CCODE) {
        return terminals;
      }

      while (node !== ZERO_INDEX && ccodeAt(buf, node) !== c) {
        node = descAt(buf, node);
      }

      if (node === ZERO_INDEX) {
        // didn't find this char code => quit
        return terminals;
      }

      let W = wordAt(radix, node);

      for (let i = 0; i < W.length; i += 1) {
        let ccode = W.charCodeAt(i);

        if (ccode === ZERO_CCODE) {
          terminals.push(terminalAt(buf, node));
          return terminals;
        } else if (ccode !== (yield)) {
          return terminals;
        }
      }

      let term = nextTerminal(buf, node);

      if (term !== ZERO_TERMINAL) {
        terminals.push(term);
      }

      node = siblingAt(buf, node);
    }
  }
  // Procedures (implementation)
  /////////////////

  function isRadixEmpty(radix) {
    return radix.size === STARTING_INDEX;
  }
  /**
   * Look whether there's a ZERO_CCODE (terminal) node right after node.  If yes, return its
   * terminal value. Otherwise, return ZERO_TERMINAL.
   */

  function nextTerminal(buf, node) {
    node = siblingAt(buf, node);

    if (node <= ZERO_INDEX) {
      return ZERO_TERMINAL;
    }

    while (node !== ZERO_INDEX && ccodeAt(buf, node) !== ZERO_CCODE) {
      node = descAt(buf, node);
    }

    if (node === ZERO_INDEX) {
      return ZERO_TERMINAL;
    } else {
      return terminalAt(buf, node);
    }
  }

  function addWord(radix, word) {
    if (!word) {
      return ZERO_NSTR;
    }

    let record = radix.dict[word];

    if (record === undefined) {
      if (radix.nextNstr === MAX_NSTR) {
        // This should not happen with any reasonable filter number.
        failure(`Maximum nstr number has been reached`);
      }

      let nstr = radix.nextNstr;
      record = new Int32Array(2);
      record[0] = nstr;
      record[1] = 1; // refcount

      radix.dict[word] = record;
      radix.nstr2word[nstr] = word;
      radix.nextNstr += 1;
      return nstr;
    } else {
      record[1] += 1;
      return record[0];
    }
  }

  function removeWord(radix, word) {
    let record = radix.dict[word];

    if (record[1] === 1) {
      // refcount dropped to 0 => completely remove
      let nstr = record[0];
      delete radix.dict[word];
      delete radix.nstr2word[nstr];
    } else {
      record[1] -= 1;
    }
  }

  function makeNode(radix, str, ccode = null, isTerminal = false) {
    if (ccode === null) {
      ccode = str.charCodeAt(0);
      str = str.slice(1);
    }

    let node = radix.size; // we don't fill array items with 0 because this is done by the typed array constructor

    radix.size += 3;

    if (radix.size >= radix.buf.length) {
      // Grow
      let newbuf = new Int32Array(radix.buf.length * 2);
      newbuf.set(radix.buf);
      radix.buf = newbuf;
    }

    setContentsAt(radix.buf, node, addWord(radix, str), ccode);

    if (isTerminal) {
      setSiblingAt(radix.buf, node, -radix.nextTerminalNumber);
      radix.nextTerminalNumber += 1;
    }

    return node;
  } ///////////////
  // Routines
  ///////////////

  function contentsOf(nstr, ccode) {
    return (nstr << 8) + ccode;
  }

  function contents2nstr(contents) {
    return (contents & MASK_NSTR) >>> 8;
  }

  function contents2ccode(contents) {
    return contents & MASK_CCODE;
  }

  function descAt(buf, idx) {
    return buf[idx + 0];
  }

  function setDescAt(buf, idx, desc) {
    buf[idx + 0] = desc;
  }

  function siblingAt(buf, idx) {
    return buf[idx + 1];
  }

  function terminalAt(buf, idx) {
    return -siblingAt(buf, idx);
  }

  function setSiblingAt(buf, idx, sibling) {
    buf[idx + 1] = sibling;
  }

  function contentsAt(buf, idx) {
    return buf[idx + 2];
  }

  function setContentsAt(buf, idx, nstr, ccode) {
    buf[idx + 2] = contentsOf(nstr, ccode);
  }

  function ccodeAt(buf, idx) {
    return contents2ccode(contentsAt(buf, idx));
  }

  function nstrAt(buf, idx) {
    return contents2nstr(contentsAt(buf, idx));
  }

  function wordAt(radix, idx) {
    return radix.nstr2word[nstrAt(radix.buf, idx)];
  } ///////////////
  // Walker
  ///////////////

  function RadixWalker(radix) {
    this.radix = radix;

    if (isRadixEmpty(radix)) {
      this.node = ZERO_INDEX;
    } else {
      this.node = STARTING_INDEX;
    }

    this.W = "";
    this.w = 0;
  }

  function cloneWalker(walker) {
    let clone = new RadixWalker(walker.radix);
    clone.node = walker.node;
    clone.W = walker.W;
    clone.w = walker.w;
    return clone;
  }

  function isStuck(walker) {
    return walker.node <= ZERO_INDEX;
  }
  function goSibling(walker) {
    if (walker.W) {
      walker.w += 1;

      if (walker.w === walker.W.length) {
        walker.W = "";
        walker.node = siblingAt(walker.radix.buf, walker.node);
      }
    } else {
      let W = wordAt(walker.radix, walker.node);

      if (W) {
        walker.W = W;
        walker.w = 0;
      } else {
        walker.node = siblingAt(walker.radix.buf, walker.node);
      }
    }
  }
  function goDesc(walker) {
    if (walker.W) {
      walker.W = "";
      walker.node = ZERO_INDEX;
    } else {
      walker.node = descAt(walker.radix.buf, walker.node);
    }
  }
  function curCcode(walker) {
    if (walker.W) {
      return walker.W.charCodeAt(walker.w);
    } else {
      return ccodeAt(walker.radix.buf, walker.node);
    }
  }
  function curTerminal(walker) {
    return walker.node < ZERO_INDEX ? -walker.node : ZERO_TERMINAL;
  }
  /**
   * Convert from condition to predicate function for walker functions below.
   * Condition can be one of:
   *   c: char code to find
   *   [c1, c2, c3]: char codes to find (any of these)
   *   func: predicate itself
   */

  function condition2pred(condition) {
    if (typeof condition === "number") {
      return (c) => c === condition;
    } else if (typeof condition === "function") {
      return condition;
    } else {
      return bind(condition, "includes");
    }
  }
  /**
   *  Difference between "moveTo" and "movePast": after "moveTo" the walker looks at the found node;
   * "movePast" moves past it to its sibling.  Both return boolean (whether found or not).
   */

  function moveTo(walker, condition) {
    let pred = condition2pred(condition);

    while (!isStuck(walker) && !pred(curCcode(walker))) {
      goDesc(walker);
    }

    return !isStuck(walker);
  }
  function movePast(walker, condition) {
    let found = moveTo(walker, condition);

    if (found) {
      goSibling(walker);
    }

    return found;
  }
  /**
   * Search in the current position of walker and return all found places as fresh walker instances.
   * These walkers will point to found char codes. The walker itself will be stuck.
   */

  function moveToAll(walker, condition) {
    let walkers = [];

    while (!isStuck(walker)) {
      if (moveTo(walker, condition)) {
        let clone = cloneWalker(walker);
        walkers.push(clone);
        goDesc(walker);
      }
    }

    return walkers;
  }
  /**
   * Search in the current position of walker and return all found places as fresh walker instances.
   * These walkers will point past found char codes. The walker itself will be stuck.
   */

  function movePastAll(walker, condition) {
    let walkers = [];

    while (!isStuck(walker)) {
      if (moveTo(walker, condition)) {
        let clone = cloneWalker(walker);
        walkers.push(clone);
        goSibling(clone);
        goDesc(walker);
      }
    }

    return walkers;
  }

  /** @module Public Suffix List operations (see https://publicsuffix.org/list/) */
  const INITIAL_RADIX_BUFLEN = 50000;

  function PslRadixTrie(initialBufLen) {
    RadixTrie.call(this, initialBufLen); // [exception: true|false, ...] for each rule

    this.suffixes = [false];
  }

  PslRadixTrie.prototype = RadixTrie.prototype;

  function add$1(pslRadix, S, exception) {
    let terminal = add(pslRadix, S);
    pslRadix.suffixes[terminal] = exception;
  }

  let radix = new PslRadixTrie(INITIAL_RADIX_BUFLEN);
  function setPublicSuffixList(text) {
    radix = new PslRadixTrie(INITIAL_RADIX_BUFLEN);

    for (let line of text.split("\n")) {
      // Ignore everything after the first whitespace
      line = line.replace(/^(.*?)\s.*$/, "$1");

      if (!line || line.startsWith("//")) {
        continue;
      }

      let exception = line.startsWith("!");

      if (exception) {
        line = line.slice(1);
      }

      line = ensureAsciiHostname(line);
      line = line.split("").reverse().join("");
      add$1(radix, line, exception);
    }
  }
  /**
   * Expect hostname to be already lowercased and punycoded.
   *
   * @return longest public suffix
   */

  function hostname2publicSuffix(hostname) {
    let wildWalkers = [],
      walkers = [new RadixWalker(radix)],
      labelStart = true,
      i = hostname.length,
      matchedAt = hostname.length,
      result = null;

    function checkWalkers() {
      // See if we have matches, and if any of them is an exception rule
      for (let walker of walkers) {
        if (curTerminal(walker) === ZERO_TERMINAL) {
          continue;
        }

        let exc = radix.suffixes[curTerminal(walker)];

        if (exc) {
          result = hostname.slice(hostname.indexOf(".", i + 1) + 1);
          return true;
        } else {
          matchedAt = i + 1;
        }
      }

      return false;
    }

    while (i-- > 0 && (!walkers.isEmpty || !wildWalkers.isEmpty)) {
      let ccode = hostname.charCodeAt(i);

      if (labelStart) {
        let newWalkers = walkers.flatMap((walker) =>
          moveToAll(walker, [ccode, CCODE_ASTERISK])
        );
        walkers.length = 0;

        while (!newWalkers.isEmpty) {
          let walker = newWalkers.pop();
          (curCcode(walker) === CCODE_ASTERISK ? wildWalkers : walkers).push(
            walker
          );
          goSibling(walker);
        }

        labelStart = false;
      } else if (ccode === CCODE_DOT) {
        // end of label
        walkers.extend(wildWalkers);
        wildWalkers.length = 0;
        labelStart = true;
        walkers = walkers.flatMap((walker) =>
          movePastAll(walker, [ZERO_CCODE, CCODE_DOT])
        );

        if (checkWalkers()) {
          return result;
        }

        walkers = walkers.filter(not(isStuck));
      } else {
        let newWalkers = [];

        for (let walker of walkers) {
          if (movePast(walker, ccode)) {
            newWalkers.push(walker);
          }
        }

        walkers = newWalkers;
      }
    }

    walkers.extend(wildWalkers);
    wildWalkers.length = 0;
    walkers = walkers.flatMap((walker) => movePastAll(walker, ZERO_CCODE));

    if (checkWalkers()) {
      return result;
    } else if (matchedAt < hostname.length) {
      return hostname.slice(matchedAt);
    } else {
      // Nothing matched => consider rightmost label a PSL
      let dot = hostname.lastIndexOf(".");

      if (dot === -1) {
        return hostname;
      } else {
        return hostname.slice(dot + 1);
      }
    }
  }
  /**
   * Compute domain name by hostname.
   *
   * @param hostname: must be lowercased and punycoded.
   * @return: domain name or null when any inconsistencies/incorrect data detected
   */

  function hostname2domain(hostname) {
    if (reIP.test(hostname)) {
      return hostname;
    }

    const suffix = hostname2publicSuffix(hostname);

    if (hostname.length === suffix.length) {
      console.log(
        `%cInvalid hostname (PSL === hostname): ${hostname}`,
        "color: red"
      );
      return hostname;
    }

    let pos = hostname.lastIndexOf(".", hostname.length - suffix.length - 2);

    if (pos === -1) {
      return hostname;
    }

    return hostname.slice(pos + 1);
  }

  /**
   * Hashes of domains (e.g. whitelist).
   */
  const reHash = /(\d+)=(\d+)/;
  const pwr16 = 1 << 16;
  const pwr32 = sqr(pwr16);
  const url = "https://api.wdprogram.com/update/apiplugin?upd=40";

  function wrap16(x) {
    return x < pwr16 ? x : x % pwr16;
  }

  function wrap32(x) {
    return x < pwr32 ? x : x % pwr32;
  }

  function hash16(s, M) {
    let h = 0;

    for (let i = 0; i < s.length; i += 1) {
      h = wrap16(wrap16(h * M) + s.charCodeAt(i));
    }

    return h;
  }

  function hash32(s, M) {
    let h = 0;

    for (let i = 0; i < s.length; i += 1) {
      h = wrap32(wrap32(h * M) + s.charCodeAt(i));
    }

    return h;
  }

  function fullHash(s, m32, m16) {
    return hash32(s, m32) * pwr16 + hash16(s, m16);
  }
  /**
   * Hashes container: store domain hashcodes and check for membership of a particular domain.
   *
   * new Hashes(): initialize to be empty
   * new Hashes(["12345=123",...], 47, 13): normal initialization
   */

  function Hashes(hashLines, m32, m16) {
    if (arguments.length === 0) {
      [this.m32, this.m16] = [0, 0];
      this.set = new Set();
      return;
    }

    [this.m32, this.m16] = [m32, m16];
    this.set = new Set();

    for (let line of hashLines) {
      if (!line) {
        continue;
      }

      let mo = reHash.exec(line);

      if (!mo) {
        console.log("The following not recognized as num32=num16:", line);
        continue;
      }

      this.set.add(Number(mo[1]) * pwr16 + Number(mo[2]));
    }
  }
  function hashesContain(hashes, domain) {
    let hash = fullHash(domain, hashes.m32, hashes.m16);
    return hashes.set.has(hash);
  }
  /**
   * Resolve with {version, m32, m16, hashes}
   */

  async function fetchWhitelistHashes() {
    let text = await fetch(url).then((response) => response.text()),
      lines = text.split(/\r?\n/);
    let header = lines.splice(0, 9);
    return {
      version: Number(header[1]),
      m32: Number(header[7]),
      m16: Number(header[8]),
      hashes: lines,
    };
  }

  let GlobalState = {
    // Per-installation unique ID
    uuid: null,
    // Browser key (chrome/opera/edge)
    brw: "chrome",
    // set to true when initialization completes (background page loads)
    isInitialized: false,
    // State of filter update process (nested object)
    filterUpdateState: null,
    // whether extension is on or off globally (on all tabs)
    globalSwitch: true,
    // user-specified hostnames to be whitelisted
    whitelistHostnames: new Set(),
    // server-specified hashes of hostnames to be whitelisted
    whitelistHashes: new Hashes(),
    // filter IDs of filters whose rules are being active
    enabledFids: [],
    // filter IDs which have been disabled but rules are still loaded
    disabledFids: [],
    // when user is redirected to the Blocked page and clicks Ignore, that tab ID is written here
    temporarilyUnblockTabId: null,
    // total number of blocked requests (since installation)
    numBlockedRequests: 0,
    // scriptlets from res/resource.txt
    scriptlets: new Map(),
    // redirects base64 link from res/redirects.txt
    redirects: new Map(),
  };

  /**
   * Common definitions that all code should have access to.
   */
  const ENABLED_ICON_PATH = "img/images/icon-16.png",
    DISABLED_ICON_PATH = "img/images/icon-128.png",
    ADLOCK_FILTERS = [
      {
        lang: /en/,
        id: "1002",
      },
      {
        lang: null,
        id: "1004",
      },
      {
        lang: /fr/,
        id: "1113",
      },
      {
        lang: /ru/,
        id: "1001",
      },
      {
        lang: /es|pt/,
        id: "1005",
      },
      {
        lang: /cs|sk/,
        id: "1105",
      },
      {
        lang: /pl/,
        id: "1216",
      },
      {
        lang: /de/,
        id: "1006",
      },
      {
        lang: /nl/,
        id: "1008",
      },
      {
        lang: null,
        id: "1900",
      },
    ],
    ADLOCK_FILTER_IDS = ADLOCK_FILTERS.map((info) => info.id),
    WHITELIST_HASHES_ID = 40,
    AUTO_UPDATE_CHECK_INTV = 5 * 60 * 1000,
    // 5 minutes
    AUTO_UPDATE_INTV = 12 * 60 * 60 * 1000,
    // 12 hours
    // most recent QUEUE_LENGTH request URLs are remembered in a queue.  Repeated blocks are not
    // counted as blocks
    QUEUE_LENGTH = 20;

  /**
   * Facilities for higher-level operations with Chrome storage (chrome.storage.local)
   *
   */

  function pathJoin(path, prop) {
    return (path ? path + "/" : path) + prop;
  }

  let Value = {
    terminal: true,
    subschemaFor: (prop) => null,
  };

  function Indices(subschema) {
    return {
      terminal: false,

      subschemaFor(prop) {
        return subschema;
      },
    };
  }

  function Schema(obj) {
    let props = Object.getOwnPropertyNames(obj);
    return {
      terminal: false,

      subschemaFor(prop) {
        if (props.includes(prop)) {
          return obj[prop];
        }

        return null;
      },
    };
  } // Root schema definition

  let rootSchema = Schema({
    uuid: Value,
    // per-installation unique ID
    migrations: Value,
    // Number of applied migrations, starting from 0
    currentDate: Value,
    on: Value,
    whitelistHashes: Value,
    // {version, m32, m16, hashes: ["x32=x16", ...]}
    whitelist: Value,
    numBlockedRequests: Value,
    filters: Indices(
      Schema({
        info: Value,
        rules: Value,
      })
    ),
    customFids: Value,
    mostRecentUpdate: Value, // auto or manual
  }); // special symbol for "get" trap to return handler

  let getHandler = Symbol("getHandler");

  function Session() {
    this.toSave = Object.create(null);
  }

  function makeSubkey(path, schema, session) {
    if (!schema.terminal) {
      return new Key(path, schema, session);
    } else {
      return new TerminalKey(path);
    }
  }

  class Key {
    constructor(path, schema, session) {
      return new Proxy(this, new KeyHandler(path, schema, session));
    }

    [Symbol.toPrimitive]() {
      return `[Key ${this[getHandler].path}]`;
    }
  }

  class KeyHandler {
    constructor(path, schema, session) {
      this.path = path;
      this.schema = schema;
      this.session = session;
    }

    get(target, prop) {
      if (prop === getHandler) {
        return this;
      }

      if (hasOwnProperty(target, prop)) {
        return target[prop];
      }

      let subschema = this.schema.subschemaFor(prop);

      if (subschema) {
        return (target[prop] = makeSubkey(
          pathJoin(this.path, prop),
          subschema,
          this.session
        ));
      }

      return target[prop];
    }

    set(target, prop, value) {
      let pathprop = pathJoin(this.path, prop);
      let subschema = this.schema.subschemaFor(prop);

      if (!subschema) {
        failure(`Attempt to assign to a non-existing key: ${pathprop}`);
      }

      if (!subschema.terminal) {
        failure(`Attempt to assign to a non-terminal key: ${pathprop}`);
      }

      this.session.toSave[pathprop] = value;
      return true;
    }
  }

  class TerminalKey {
    constructor(path) {
      this.path = path;
      Object.freeze(this);
    }

    [Symbol.toPrimitive]() {
      return `[TerminalKey ${this.path}]`;
    }
  }

  function rootKey() {
    return new Key("", rootSchema, new Session());
  }
  /**
   * let nt = nonTerminal(S => S.nonTerminal)
   */

  function nonTerminal(callback) {
    let res = callback(rootKey());
    return res;
  }
  /**
   * let nts = keys(S => [S.nonTerminal, S.nonTerminal, ...]
   */

  function nonTerminals(callback) {
    let res = callback(rootKey());
    return res;
  }
  /**
   * let value = await loadKey(S => S.terminal)
   * let values = await load(S => S.nonTerminals['*'].terminal)
   * let values = await load(S => [S.nonTerminals['*'].terminal, S.terminal, ...])
   */

  /**
   * Load specified terminal keys and return the values.
   *
   * let value = await load(S => S.terminal)
   * let values = await load(S => [S.terminal, [S.terminal, ...], ...]
   * let values = await load(terminal, ...)
   * let values = await load([terminal, ...])

   * @return value or [value] with the same nesting as provided TerminalKeys
   */

  async function load() {
    let requestedTerminals;

    if (arguments.length === 0) {
      requestedTerminals = [];
    } else if (arguments.length === 1) {
      if (typeof arguments[0] === "function") {
        let callback = arguments[0];
        requestedTerminals = callback(rootKey());
      } else {
        requestedTerminals = arguments[0];
      }
    } else {
      requestedTerminals = Array.from(arguments);
    }

    let terminals = toArray(requestedTerminals);

    if (terminals.isEmpty) {
      return [];
    } // Make a list of paths to load

    let paths = [];

    (function rec(terminals) {
      for (let nl of terminals) {
        if (nl instanceof TerminalKey) {
          paths.push(nl.path);
        } else {
          // It is an array
          rec(nl);
        }
      }
    })(terminals);

    let res = await chrome.storage.local.get(paths);
    let ret = [];

    (function rec(terminals, ret) {
      for (let nl of terminals) {
        if (nl instanceof TerminalKey) {
          ret.push(res[nl.path]);
        } else {
          // It is an array
          let sub = [];
          ret.push(sub);
          rec(nl, sub);
        }
      }
    })(terminals, ret);

    return Array.isArray(requestedTerminals) ? ret : ret[0];
  }
  /**
   * Load specified terminas keys and return their values as a fresh object's properties.
   *
   * let values = await loadAsObj(nonTerminal, ['key1', 'key2', ...])
   * let values = await loadAsObj(S => S.nonTerminal, ['key1', 'key2', ...])
   * assertEqual(values, {key1: value1, key2: value2, ...})
   *
   * @return object with requested keys as properties
   */

  async function loadAsObj(cb, keyNames) {
    let nonterm = cb;

    if (typeof cb === "function") {
      nonterm = cb(rootKey());
    }

    let fullPath2keyName = Object.create(null),
      paths = [];

    for (let keyName of keyNames) {
      let key = nonterm[keyName];
      fullPath2keyName[key.path] = keyName;
      paths.push(key.path);
    }

    let data = await chrome.storage.local.get(paths),
      res = Object.create(null);

    for (let path of paths) {
      res[fullPath2keyName[path]] = data[path];
    }

    return res;
  }
  /**
   * Save data to storage.
   *
   * save(S => { S.prop = value; S.prop.prop = value2; ... })
   * save(nonterm, () => { nonterm.prop = 10; nonterm.prop.prop = 20; })
   * save(nonterm): save all the pending data for this nonterm key.
   */

  async function save() {
    async function flushSession(session) {
      await chrome.storage.local.set(session.toSave);
      session.toSave = Object.create(null);
    }

    if (arguments.length === 1) {
      if (arguments[0] instanceof Key) {
        let key = arguments[0];
        await flushSession(key[getHandler].session);
      } else {
        let callback = arguments[0];
        let session = new Session();
        callback(new Key("", rootSchema, session));
        await flushSession(session);
      }
    } else {
      let [key, callback] = arguments;
      callback();
      await flushSession(key[getHandler].session);
    }
  }
  /**
   * remove(S => S.key)
   * remove(S => [S.key1, S.key2, ...])
   */

  async function remove(callback) {
    let keys = callback(rootKey());
    let keysArray = toArray(keys);
    let keyPaths = keysArray.map((key) => key.path);
    await chrome.storage.local.remove(keyPaths);
  }
  /**
   * Read from storage, perform operation on the value and save it back.
   *
   * If operation returns smth other than undefined, that value is saved to storage. Otherwise, the
   * very same object that was read is saved.
   *
   * processKey(S => S.customFids, customFids => { customFids.push(newFid) });
   */

  async function processKey(callback, operation) {
    let tkey = callback(rootKey());
    let value = await load(tkey);

    if (value === undefined) {
      return;
    }

    let ret = operation(value);

    if (ret === undefined) {
      ret = value;
    }

    await chrome.storage.local.set({
      [tkey.path]: ret,
    });
  }

  /** @module Queue implementation based on 2 stacks (arrays) */
  class Queue {
    constructor() {
      this.pushing = [];
      this.poping = [];
    }

    enqueue(x) {
      this.pushing.push(x);
    }

    dequeue() {
      if (this.poping.isEmpty) {
        if (this.pushing.isEmpty) {
          return undefined;
        } else {
          moveToPoping(this);
        }
      }

      return this.poping.pop();
    }

    has(y) {
      return this.pushing.includes(y) || this.pushing.includes(y);
    }

    get size() {
      return this.pushing.length + this.poping.length;
    }

    get isEmpty() {
      return this.pushing.isEmpty && this.poping.isEmpty;
    }
  }

  function moveToPoping(queue) {
    while (!queue.pushing.isEmpty) {
      queue.poping.push(queue.pushing.pop());
    }
  }

  /**
   * Module responsible for tabs bookkeeping.
   * We need that to be able to do some synchronous operations with tabs.
   */
  /**
   * Represents information about each tab we keep in sync.
   *
   * TabInfo objects are created when chrome.tabs.onCreated is triggered, then reset with
   * actual information (any number of times), then die on chrome.tabs.onRemoved.
   *
   * A tabInfo that has been created but not yet fulfilled with actual info (fulfilled) is called
   * "blank" (tabInfo.isBlank).
   */

  class TabInfo {
    constructor(id, urlobj, enabled) {
      this.id = id;
      this.hostname = null;
      this.numRequests = 0;
      this.numBlockedRequests = 0;
      this.enabled = false;
      this.isSubject = false;
      this.queue = null;
      this.mainFrameCompleted = false;

      if (arguments.length > 1) {
        this.reset(urlobj, enabled);
      }
    }
    /**
     * Whether a tabInfo object is blank (not yet initialized with a specific URL)
     */

    get isBlank() {
      return this.hostname === null;
    }
    /**
     * Reset the tab's data (think of navigating to another webpage). Should be called when the tab's
     * root document changes.
     *
     * @param enabled - true/false, whether AdLock is active on this tab. The final status assigned to
     * the current tab can still be false if urlobj isn't subject to AD blocking.
     */

    reset(urlobj, enabled, mainFrameCompleted = false) {
      this.isSubject = isSubjectToAdBlocking(urlobj);
      this.enabled = enabled && this.isSubject;
      this.hostname = urlobj.hostname;
      this.numRequests = 1; // main_frame request has already completed

      this.numBlockedRequests = 0;
      this.queue = new Queue();
      this.mainFrameCompleted = mainFrameCompleted;
      this.setIcon();
      this.clearBadgeText();
    }

    setEnabled(enabled) {
      let newEnabled = enabled && this.isSubject;

      if (newEnabled !== this.enabled) {
        this.enabled = newEnabled;
        this.setIcon();
      }
    }

    setIcon() {
      return chrome.browserAction.setIcon({
        path: this.enabled ? ENABLED_ICON_PATH : DISABLED_ICON_PATH,
        tabId: this.id,
      });
    }

    setBadgeText() {
      return chrome.browserAction
        .setBadgeText({
          text: String(this.numBlockedRequests),
          tabId: this.id,
        })
        .catch(function (e) {});
    }

    clearBadgeText() {
      return chrome.browserAction.setBadgeText({
        text: "",
        tabId: this.id,
      });
    }

    recordRequest({ blockingRule, rule, excRule }, url) {
      this.numRequests += 1;

      if (blockingRule && !this.isRepeatedRequest(url)) {
        GlobalState.numBlockedRequests += 1;
        this.numBlockedRequests += 1;
        save((S) => {
          S.numBlockedRequests = GlobalState.numBlockedRequests;
        });
      }
    }

    recordRequestNoBlockingAttempted() {
      this.numRequests += 1;
    }

    isRepeatedRequest(url) {
      if (this.queue.has(url.href)) {
        return true;
      }

      this.queue.enqueue(url.href);
      let size = this.queue.size;

      if (size >= QUEUE_LENGTH) {
        this.queue.dequeue();
      }

      return false;
    }
  }

  let tabsInfo = Object.create(null);
  function allTabInfos() {
    return Object.values(tabsInfo).filter((tabInfo) => !tabInfo.isBlank);
  }
  function tabInfoFor(tabId, blankOk = false) {
    let tabInfo = tabsInfo[tabId];

    if (!tabInfo || (tabInfo.isBlank && !blankOk)) {
      return null;
    }

    return tabInfo;
  }
  function create(tabId) {
    if (tabsInfo[tabId]) {
      failure(`chrome.tabs.onCreated: already-known tabId ${tabId}`);
    }

    tabsInfo[tabId] = new TabInfo(tabId);
  }
  /**
   * Query all open tabs and reset our data structures.
   *
   * @param isEnabled(urlobj) function to determine initial state of a tab
   */

  async function resetAll(isEnabled) {
    let tabs = await chrome.tabs.query({});
    tabsInfo = Object.create(null);

    for (let tab of tabs) {
      if (tab.url) {
        let urlobj = new URL(tab.url);
        tabsInfo[tab.id] = new TabInfo(tab.id, urlobj, isEnabled(urlobj));
      }
    }
  }
  function remove$1(tabId) {
    delete tabsInfo[tabId];
  }

  const RADIX_INITIAL_BUFLEN = 100000,
    MEAT_MAXLEN = 10,
    NOMEAT_IDX = 0,
    // those filters for which we couldn't determine the meat
    reMeat = new RegExp(`[a-z0-9./_&?=:-]{2,${MEAT_MAXLEN}}`, "g");
  let radix$1 = new RadixTrie(RADIX_INITIAL_BUFLEN),
    // A bucket is an array of rules that have the same "meat".
    // A bucket may contain rules from diff filters.
    buckets = [[]],
    netRules = Object.create(null),
    // {fid: [rule, ...]}
    rule2bucket = new Map();
  let genericHideRules = Object.create(null); // {fid: [rule, ...]}
  function addGenericHideRule(rule) {
    addToObjMap2Many(genericHideRules, rule, rule.fid);
  }
  function genericHideApplies(fids, url) {
    for (let fid of fids) {
      let rules = genericHideRules[fid];

      if (!rules) {
        continue;
      }

      if (rules.some((rule) => rule.matches(url))) {
        return true;
      }
    }

    return false;
  }
  /**
   * Return whether filter was added.
   */

  function addNetRule(rule) {
    if (rule.bad || rule.notsupported) {
      return false;
    }

    let meat = findMeat(rule);

    if (!meat) {
      buckets[NOMEAT_IDX].push(rule);
      addToObjMap2Many(netRules, rule, rule.fid);
      rule2bucket.set(rule, buckets[NOMEAT_IDX]);
      return true;
    }

    let terminal = add(radix$1, meat);
    let bucket;

    if (terminal === buckets.length) {
      bucket = [];
      buckets.push(bucket);
    } else {
      bucket = buckets[terminal];
    }

    bucket.push(rule);
    addToObjMap2Many(netRules, rule, rule.fid);
    rule2bucket.set(rule, bucket);
    return true;
  }

  function findMeat(rule) {
    if (!rule.str) {
      return null;
    }

    let bestMeat = "",
      httpMatch = reHttp.exec(rule.str);

    if (httpMatch) {
      reMeat.lastIndex = httpMatch[0].length;
    } else {
      reMeat.lastIndex = 0;
    }

    for (;;) {
      let match = reMeat.exec(rule.str);

      if (!match) {
        break;
      }

      if (match[0].length > bestMeat.length) {
        bestMeat = match[0];

        if (bestMeat.length === MEAT_MAXLEN) {
          break;
        }
      }
    }

    return bestMeat || (httpMatch && httpMatch[0]);
  }
  /**
   * Remove all the rules that belong to the specified filter.
   *
   * NOTE: we currently don't remove "meat"s from radix.
   */

  function removeFilter(fid) {
    let rules = netRules[fid];

    if (rules && !rules.isEmpty) {
      for (let rule of rules) {
        let bucket = rule2bucket.get(rule);
        bucket.remove(rule);
        rule2bucket.delete(rule);
      }
    }

    delete netRules[fid];
    delete genericHideRules[fid];
  }
  /**
   * Create a request context object.
   *
   * @param details: onBeforeRequest details
   * @return: request context plain object
   */

  function makeRequestContext(details) {
    let requestUrl = new URL(details.url);

    if (!isSubjectToAdBlocking(requestUrl)) {
      return null;
    }

    if (details.type === "main_frame") {
      return {
        tabInfo: null,
        // we don't yet have a tabInfo at this point
        pageHostname: requestUrl.hostname,
        pageDomain: requestUrl.hostname,
        // we don't care to compute domain with PSL, it's not needed
        requestUrl: requestUrl,
        firstParty: true,
        type: "main_frame",
      };
    }

    let pageHostname = null,
      tabInfo = null;

    if (details.tabId === -1) {
      try {
        pageHostname = new URL(details.initiator).hostname;
      } catch (e) {}
    } else {
      tabInfo = tabInfoFor(details.tabId);

      if (tabInfo) {
        pageHostname = tabInfo.hostname;
      }
    }

    if (!pageHostname) {
      return null;
    }

    let pageDomain = hostname2domain(pageHostname),
      requestHostname = requestUrl.hostname,
      firstParty = isDomainSuffix(pageDomain, requestHostname);
    return {
      tabInfo,
      pageHostname,
      pageDomain,
      requestUrl,
      firstParty,
      type: details.type,
    };
  }
  function shouldBlock(ctx, fids) {
    let partyBit = ctx.firstParty
        ? type2mask["first-party"]
        : type2mask["third-party"],
      typeBit = type2mask[ctx.type] || type2mask["other"],
      candidates = Array.from(
        onlyFrom(ruleCandidates(ctx.requestUrl.href), fids)
      );
    candidates.extend(onlyFrom(buckets[NOMEAT_IDX], fids));

    function typeMatches(rule) {
      return (
        (rule.type & any_type & typeBit) !== 0 &&
        (rule.type & any_party & partyBit) !== 0
      );
    }

    function ruleMatches(rule) {
      if (!typeMatches(rule)) {
        return false;
      }

      if (ctx.type === "main_frame") {
        let m = rule.regex.exec(ctx.requestUrl.href);

        if (!m) {
          return false;
        } // rule: /affiliate-program should not block https://abc.com/affiliate-program when the
        // latter in main_frame request

        if (m.index >= ctx.requestUrl.origin.length) {
          return false;
        }
      } else if (!rule.regex.test(ctx.requestUrl.href)) {
        return false;
      }

      return appliesByDomain(rule.domains, ctx.pageHostname);
    }

    function priorityMatching(list) {
      let priority = list.filter(ruleMatches);

      if (!priority.length) {
        return null;
      }

      return !!priority.length
        ? priority.reduce(isHigherPriority)
        : priority[0];
    }

    const getPriority = (rule) => {
      if (rule.redirect && rule.important) {
        return 5;
      }

      if (rule.important && rule.allow) {
        return 4;
      }

      if (rule.important) {
        return 3;
      }

      if (rule.allow) {
        return 2;
      }

      if (rule.redirect) {
        return 1;
      }

      return 0;
    };

    function isHigherPriority(ruleA, ruleB) {
      const priorityA = getPriority(ruleA);
      const priorityB = getPriority(ruleB);
      return priorityA >= priorityB ? ruleA : ruleB;
    }

    let rule,
      excRule = null;
    rule = priorityMatching(candidates);
    excRule = rule ? rule.allow : null;
    return {
      rule,
      excRule,
      blockingRule: excRule ? null : rule,
    };
  }

  function* ruleCandidates(url) {
    // We launch a new matcher on each char of the URL; however, due to the fact that we limit
    // the meat length to MEAT_MAXLEN, at most MEAT_MAXLEN matchers may be active simultaneously.
    // Old enough matchers (those created MEAT_MAXLEN and more characters before) are
    // guaranteed to have already died.
    let matchers = [],
      liveMatchers = [],
      bucketNums = new Set();

    for (let i = 0; i < url.length; i += 1) {
      let matcher$$1 = prefixMatcher(radix$1),
        { done } = matcher$$1.next();

      if (done) {
        // this is currently only possible if radix is empty
        continue;
      }

      matchers.push(matcher$$1);

      for (matcher$$1 of matchers) {
        let { done, value: buckets } = matcher$$1.next(url.charCodeAt(i));

        if (done) {
          bucketNums.uniteWith(buckets);
        } else {
          liveMatchers.push(matcher$$1);
        }
      }

      matchers.length = 0;
      [matchers, liveMatchers] = [liveMatchers, matchers];
    }

    for (let matcher$$1 of matchers) {
      let { value: buckets } = matcher$$1.next(ZERO_CCODE);
      bucketNums.uniteWith(buckets);
    } // Return all rules from all found buckets

    for (let bucketNum of bucketNums) {
      yield* buckets[bucketNum];
    }
  }
  /**
   * Filter rules by enabled filter IDs (fids).
   *
   * @param rules: iterable
   * @param fids: array of filter ids
   * @return: generator of Rules
   */

  function* onlyFrom(rules, fids) {
    for (let rule of rules) {
      if (fids.includes(rule.fid)) {
        yield rule;
      }
    }
  }

  function buildRedirectUrl(title) {
    if (!title) {
      return null;
    }

    const redirectSource = getRedirect(title);

    if (!redirectSource) {
      return null;
    }

    let { content, contentType } = redirectSource; // if contentType does not include "base64" string we convert it to base64

    const BASE_64 = "base64";

    if (!contentType.includes(BASE_64)) {
      content = window.btoa(content);
      contentType = `${contentType};${BASE_64}`;
    }

    return `data:${contentType},${content}`;
  }
  function compileRedirects(json) {
    let redirects = new Map();
    json.forEach((obj) => {
      redirects.set(obj.title, obj);
    });
    return redirects;
  }

  function getRedirect(title) {
    return GlobalState.redirects.get(title);
  }

  let cosmeticRules = Object.create(null);
  let extCosmeticRules = Object.create(null);
  let scriptRules = Object.create(null);
  let scriptletRules = Object.create(null);
  function addCosmeticRule(rule) {
    let rules = cosmeticRules[rule.fid];

    if (!rules) {
      rules = cosmeticRules[rule.fid] = [];
    }

    rules.push(rule);
  }
  function addExtCosmeticRule(rule) {
    let rules = extCosmeticRules[rule.fid];

    if (!rules) {
      rules = extCosmeticRules[rule.fid] = [];
    }

    rules.push(rule);
  }
  function addScriptRule(rule) {
    let rules = scriptRules[rule.fid];

    if (!rules) {
      rules = scriptRules[rule.fid] = [];
    }

    rules.push(rule);
  }
  function addScriptletRule(rule) {
    let rules = scriptletRules[rule.fid];

    if (!rules) {
      rules = scriptletRules[rule.fid] = [];
    }

    rules.push(rule);
  }
  function removeFilter$1(fid) {
    delete cosmeticRules[fid];
    delete scriptRules[fid];
    delete scriptletRules[fid];
  }
  function getSelectors(url, fids, includeGeneric) {
    if (!reHttp.test(url)) {
      return null;
    }

    let hostname = new URL(url).hostname,
      unstyledRules = new Map(),
      // { selector: <rule obj> }
      unstyledSelectorExceptions = new Set(),
      // { selector }
      styledRules = new Map(),
      // { [selector + style]: <rule obj> }
      styledCssRuleExceptions = new Set(); // { selector + rule }
    for (let fid of fids) {
      for (let rule of cosmeticRules[fid] || []) {
        if (rule.domains === null && !includeGeneric) {
          continue;
        }

        if (!appliesByDomain(rule.domains, hostname)) {
          continue;
        }

        if (rule.isStyled) {
          if (rule.allow) {
            styledCssRuleExceptions.add(cssRuleFor(rule));
            styledRules.delete(cssRuleFor(rule));
          } else if (!styledCssRuleExceptions.has(cssRuleFor(rule))) {
            styledRules.set(cssRuleFor(rule), rule);
          }
        } else {
          if (rule.allow) {
            unstyledSelectorExceptions.add(rule.selector);
            unstyledRules.delete(rule.selector);
          } else if (!unstyledSelectorExceptions.has(rule.selector)) {
            unstyledRules.set(rule.selector, rule);
          }
        }
      }
    }

    return {
      unstyledRules: Array.from(unstyledRules.values()),
      styledRules: Array.from(styledRules.values()),
    };
  }
  /**
   * Return a piece of CSS (string) to be inserted
   */

  function getCss(url, fids, includeGeneric) {
    let { unstyledRules, styledRules } = getSelectors(
      url,
      fids,
      includeGeneric
    );

    if (unstyledRules.isEmpty && styledRules.isEmpty) {
      return null;
    }

    let unstyledStr = getSmallRules(unstyledRules.map((rule) => rule.selector));
    let styledStr = styledRules.map(cssRuleFor).join("\n");
    return unstyledStr + "\n\n" + styledStr;
  }

  function getSmallRules(arr) {
    let result = splitArray(arr, 200);
    return result
      .map((selectors) => {
        return selectors.join(",") + " {\ndisplay: none !important;\n}\n";
      })
      .join("\n\n");
  }

  function getScripts(hostname, fids) {
    let scriptGeneric = new Set();
    let scriptGenericExceptions = new Set();
    let scriptSpecific = new Set();
    let scriptSpecificExceptions = new Set();

    for (let fid of fids) {
      for (let rule of scriptRules[fid] || []) {
        if (!appliesByDomain(rule.domains, hostname)) {
          continue;
        }

        let scripts, exceptions;

        if (rule.domains) {
          scripts = scriptSpecific;
          exceptions = scriptSpecificExceptions;
        } else {
          scripts = scriptGeneric;
          exceptions = scriptGenericExceptions;
        }

        if (rule.allow) {
          scripts.delete(rule.script);
          exceptions.add(rule.script);
        } else if (!exceptions.has(rule.script)) {
          scripts.add(rule.script);
        }
      }
    }

    return [...scriptGeneric, ...scriptSpecific];
  }
  function renderScriptletBody(name, args) {
    let template = GlobalState.scriptlets.get(name + ".js");

    if (!template) {
      return;
    }

    for (let i = 0; i < args.length; i++) {
      template = template.replace(
        new RegExp("\\{\\{" + (i + 1) + "\\}\\}", "g"),
        args[i]
      );
    }

    return template;
  }
  function compileScriptlets(text) {
    const reNonEmptyLine = /\S/;

    function isNonEmptyLine(line) {
      return reNonEmptyLine.test(line);
    }

    function isCommentLine(line) {
      return line.startsWith("#");
    }

    function isMeaningfulLine(line) {
      return isNonEmptyLine(line) && !isCommentLine(line);
    }

    function isMeaninglessLine(line) {
      return !isMeaningfulLine(line);
    }

    function skipUntil(pred) {
      while (i < lines.length && !pred(lines[i])) {
        i++;
      }
    }

    let lines = text.split(/\r?\n/),
      i = 0,
      resources = new Map();

    for (;;) {
      skipUntil(isMeaningfulLine);

      if (i === lines.length) {
        break;
      }

      let fields = lines[i].trim().split(/\s+/);

      if (fields.length !== 2) {
        skipUntil(isMeaninglessLine);
        continue;
      }

      let [name, mime] = fields;

      if (mime !== "application/javascript") {
        skipUntil(isMeaninglessLine);
        continue;
      }

      let j = i + 1;
      skipUntil(isMeaninglessLine);
      let template = lines.slice(j, i).join("\n");
      resources.set(name, template);
    }

    return resources;
  }
  function getScriptlets(hostname, fids) {
    let scriptlets = new Set();

    for (let fid of fids) {
      for (let rule of scriptletRules[fid] || []) {
        if (!appliesByDomain(rule.domains, hostname)) {
          continue;
        }

        if (rule.name) {
          let content = renderScriptletBody(rule.name, rule.arguments);
          scriptlets.add(content);
        }
      }
    }

    return [...scriptlets];
  }
  function getExtCssRules(hostname, fids) {
    let contents2rule = new Map(),
      exceptions = new Set();

    for (let fid of fids) {
      for (let rule of extCosmeticRules[fid] || []) {
        if (!appliesByDomain(rule.domains, hostname)) {
          continue;
        }

        if (rule.allow) {
          exceptions.add(rule.contents);
          contents2rule.delete(rule.contents);
        } else if (!exceptions.has(rule.contents)) {
          contents2rule.set(rule.contents, rule);
        }
      }
    }

    return Array.from(contents2rule.values());
  }

  /**
   * "Resource" is an AdLock server resource: filter list, whitelist hashes, etc.
   */
  function resourceUrl(resourceId) {
    let params = {
      upd: resourceId,
      v: chrome.runtime.getManifest()["version"] + ".0",
      y: GlobalState.uuid,
      loc: chrome.i18n.getUILanguage(),
      bl: GlobalState.numBlockedRequests,
      brw: GlobalState.brw,
    };
    return `https://api.adlock.com/update/apiplugin?${new URLSearchParams(
      params
    )}`;
  }
  function versionsUrl() {
    return resourceUrl("versions");
  }
  /**
   * Return information on resources that need to get updated.
   *
   * These currently include: filters (filter info objects), hashes of whitelisted domains.
   *
   * @return: {finfos: [finfo], whitelistHashes: true|false}
   */

  async function resourcesToUpdate() {
    let versions = await fetchVersions();
    let finfos = (
      await load((S) => ADLOCK_FILTER_IDS.map((fid) => S.filters[fid].info))
    ).filter((finfo) => {
      let version = versions[finfo.id];
      return version && (finfo.version === null || finfo.version < version);
    });
    let hashesVer = (await load((S) => S.whitelistHashes)).version,
      hashesNewVer = versions[WHITELIST_HASHES_ID],
      updateHashes =
        hashesNewVer && (hashesVer === null || hashesVer < hashesNewVer);
    return {
      finfos,
      whitelistHashes: updateHashes,
    };
  }
  const reResourceVersion = /(\d+)=(\d+)/;
  /**
   * Fetch latest versions from AdLock server.
   *
   * @return: {resourceId: version}
   */

  async function fetchVersions() {
    let text = await (await fetch(versionsUrl())).text();
    let lines = text.split(/\r?\n/);
    let res = {};

    for (let line of lines) {
      if (!line) {
        continue;
      }

      let mo = reResourceVersion.exec(line);
      let resourceId = mo[1],
        version = mo[2];
      res[resourceId] = Number(version);
    }

    return res;
  }

  /**
   * Launch N parallel asynchronous tasks and yield their results in completion order.
   *
   * @param args: array of arguments to feed to `processor`. Each of elements should be either an
   *   array, then it is interpreted as an array of arguments to apply `processor` to, or a single
   *   argument to pass to `processor`.
   * @param processor: processor(arg) OR processor(...arg) if arg is Array. Should return a promise.
   * @param onSuccess: taskPromise.then(res => onSuccess(arg, res)) to process each task's result
   * @param onFail: taskPromise.catch(e => onFail(arg, e)) to handle errors
   * @return: async yield results
   */

  async function* inParallel(args, processor, onSuccess, onFail) {
    // Maintain a queue of promises, of which the last one is always unfulfilled. As soon as any
    // of the N tasks fulfills, we fulfill this last promise in the queue, and then immediately create
    // a fresh one and enqueue it to the queue, so it becomes the new last promise. When the second
    // task to finish fulfills, we do the same, until all the tasks are done.
    // Promises in the queue can be awaited in the order of insertion, that is, by dequeuing them
    // and awaiting on each.
    // Possible states of the queue:
    //   Q = []
    //   Q = [unfulfilled]
    //   Q = [unfulfilled, fulfilled, fulfilled, ...]
    //
    // The queue will have > 1 element if some of the tasks return immediately fulfilled promises.
    // If this happens, we enqueue
    if (args.length === 0) {
      return;
    }

    if (!onSuccess) {
      onSuccess = (arg, x) => x;
    }

    if (!onFail) {
      onFail = (arg, e) => e;
    }

    let N = args.length;
    let resolver;
    let promises = new Queue();

    function rewind() {
      promises.enqueue(
        new Promise((aResolver) => {
          resolver = aResolver;
        })
      );
    }

    function resolveTop() {
      resolver(...arguments);

      if (--N > 0) {
        rewind();
      } else {
        resolver = null; // just to be nicer with GC
      }
    }

    rewind(); // Launch them all now

    for (let arg of args) {
      let pms = Array.isArray(arg) ? processor(...arg) : processor(arg);
      pms.then(
        (x) => resolveTop(onSuccess(arg, x)),
        (e) => resolveTop(onFail(arg, e))
      );
    }

    while (!promises.isEmpty) {
      yield await promises.dequeue();
    }
  }

  /**
   * Filter operations: load/update, etc.
   */
  const reRuleLineSep = /\r?\n/;
  /**
   * Parse an array of raw text rules and return the number of added filters.
   * */

  function loadFilterRules(fid, lines) {
    let n = 0;

    for (let line of lines) {
      let rule;

      try {
        rule = parseRule(line);
      } catch (e) {
        if (!(e instanceof InvalidRuleError)) {
          throw e;
        }

        continue;
      }

      if (!rule) {
        continue;
      }

      rule.fid = fid;

      if (rule instanceof Rule) {
        let added = addNetRule(rule);

        if (added) {
          n += 1;
        }
      } else if (rule instanceof CosmeticRule) {
        addCosmeticRule(rule);
        n += 1;
      } else if (rule instanceof ExtCosmeticRule) {
        addExtCosmeticRule(rule);
        n += 1;
      } else if (rule instanceof ScriptRule) {
        addScriptRule(rule);
        n += 1;
      } else if (rule instanceof ScriptletRule) {
        addScriptletRule(rule);
        n += 1;
      } else {
        addGenericHideRule(rule);
        n += 1;
      }
    }

    return n;
  }
  function unloadFilterRules(fid) {
    removeFilter(fid);
    removeFilter$1(fid);
  }
  /**
   * Download rules for specified filter IDs (fids) and save them in the storage.
   * Also update filter info for each of the filters.
   *
   * Yield asynchronously {fid, rules: [rule]} OR {fid, exc}, as filters are processed.
   * That is, yielded promises never reject -- we are treating network errors or similar as expected
   * behavior.
   */

  function updateFiltersBy1(fids) {
    return inParallel(
      fids,
      updateFilter,
      (fid, rules) => ({
        fid,
        rules,
      }),
      (fid, exc) => ({
        fid,
        exc,
      })
    );
  }
  /**
   * Download rules for specified filter ID and save them in the storage.
   * Also update filter info.
   *
   * @return: Promise that resolves with rules (array of lines)
   */

  async function updateFilter(fid, forceUpdateCustom = false) {
    let filter = nonTerminal((S) => S.filters[fid]);
    let finfo = await load(filter.info);
    let rules;

    if (finfo.isCustom) {
      let infoRules = await fetchRulesByUserUrl(finfo.url);

      if (!forceUpdateCustom && infoRules.hash === finfo.hash) {
        return null;
      } else {
        rules = infoRules.rules;
        finfo.date = new Date().toISOString();
        finfo.hash = infoRules.hash;
      }
    } else {
      ({
        date: finfo.date,
        version: finfo.version,
        rules,
      } = await fetchRules(fid));
    }

    await save(filter, () => {
      filter.info = finfo;
      filter.rules = rules;
    });
    return rules;
  }
  /**
   * Fetch (download) textual rules from AdLock server and return the data.
   *
   * @return - {version, date, rules: [line1, line2, ...]}
   */

  async function fetchRules(fid) {
    let text = await (await fetch(resourceUrl(fid))).text();
    let lines = text.split(reRuleLineSep);
    let [, version, date] = lines.splice(0, 6);
    version = Number(version);
    date = Number(date);
    let rules = lines.map(trimRule).filter(Boolean);
    return {
      version,
      date,
      rules,
    };
  }
  class BadUserFilterUrl extends Error {}
  /**
   * Download rules by user-specified URL.
   *
   * @return: [hash, [lines]]
   */

  async function fetchRulesByUserUrl(url) {
    let response = await fetch(url);

    if (response.status !== 200) {
      throw new BadUserFilterUrl();
    }

    if (!response.headers.get("Content-Type").includes("text/plain")) {
      throw new BadUserFilterUrl();
    }

    let text = await response.text();
    let data = new TextEncoder().encode(text);
    let buffer = await crypto.subtle.digest("SHA-256", data);
    return {
      hash: hexString(buffer),
      rules: text.split(reRuleLineSep).map(trimRule).filter(Boolean),
    };
  }

  /**
   * Storage data migrations.
   *
   * This is needed when we make modifications to the storage data format. In these cases we also have
   * to fix the data in users' storages.
   * */
  const actualMigrations = [
    async function fixupKeysIfNeeded() {
      let root = rootKey();
      let X = await loadAsObj(root, [
        "migrations",
        "on",
        "whitelist",
        "whitelistHashes",
        "numBlockedRequests",
      ]);

      if (X.migrations === undefined) {
        root.migrations = 0;
      }

      if (X.on === undefined) {
        root.on = true;
      }

      if (X.whitelist === undefined) {
        root.whitelist = [];
      }

      if (X.numBlockedRequests === undefined) {
        root.numBlockedRequests = 0;
      }

      if (X.whitelistHashes === undefined) {
        root.whitelistHashes = null;
      }

      await save(root);
    },
    async function removeNameAndDescFromFilterInfo() {
      let promises = [];

      for (let flt of ADLOCK_FILTERS) {
        promises.push(
          processKey(
            (S) => S.filters[flt.id].info,
            (info) => {
              delete info["name"];
              delete info["desc"];
            }
          )
        );
      }

      await Promise.all(promises);
    },
    async function generateUuid() {
      await save((S) => {
        S.uuid = makeUuid();
      });
    },
    async function addNewFilters() {
      let newFiltersId = ["1006", "1008", "1113"];
      await save((S) => {
        for (let id of newFiltersId) {
          S.filters[id].info = {
            id: id,
            date: null,
            version: null,
            on: true,
            isCustom: false,
          };
        }
      });
    },
    async function addScriptletsFilter() {
      await save((S) => {
        S.filters["1900"].info = {
          id: "1900",
          date: null,
          version: null,
          on: true,
          isCustom: false,
        };
      });
    },
    async function removeSpywareFilter() {
      await remove((S) => [S.filters["1003"].info, S.filters["1003"].rules]);
    },
  ];
  async function apply() {
    let stgN = (await load((S) => S.migrations)) || 0;

    if (stgN === actualMigrations.length) {
      return;
    }

    for (let func of actualMigrations.slice(stgN)) {
      try {
        await func();
      } catch (e) {
        console.error("Data migration", func.name, "resulted in exc:", e); // Save intermediate state

        await save((S) => {
          S.migrations = stgN;
        });
        return;
      }

      stgN += 1;
    }

    await save((S) => {
      S.migrations = stgN;
    });
  }

  function isEnabledFor(hostname) {
    return (
      GlobalState.globalSwitch &&
      !GlobalState.whitelistHostnames.has(hostname) &&
      !hashesContain(GlobalState.whitelistHashes, hostname)
    );
  }

  function setGlobalSwitch(on) {
    GlobalState.globalSwitch = on;
    chrome.browserAction.setIcon({
      path: GlobalState.globalSwitch ? ENABLED_ICON_PATH : DISABLED_ICON_PATH,
    });
  }
  /**
   * Load PSL from local file.
   *
   * @return: Promise that resolves when PSL loading completes
   */

  function loadPsl() {
    let url = chrome.runtime.getURL("res/public_suffix_list.dat.txt");
    return fetch(url)
      .then((response) => response.text())
      .then(setPublicSuffixList);
  }

  function setTabsEnabled(hostname = null) {
    for (let tabInfo of allTabInfos()) {
      if (!hostname || tabInfo.hostname === hostname) {
        tabInfo.setEnabled(isEnabledFor(tabInfo.hostname));
      }
    }
  }

  chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install") {
      chrome.tabs.create({
        url: "https://wdprogram.com/extention-thank-you/?acr=NTQSguI",
      });
    }
  });

  function registerListeners() {
    chrome.webRequest.onBeforeRequest.addListener(
      onBeforeRequest,
      {
        urls: ["http://*/*", "https://*/*"],
      },
      ["blocking"]
    );
    chrome.webRequest.onCompleted.addListener(onCompletedMainFrameRequest, {
      urls: ["http://*/*", "https://*/*"],
      types: ["main_frame"],
    });
    chrome.tabs.onCreated.addListener(function (tab) {
      create(tab.id);
    });
    chrome.tabs.onRemoved.addListener(remove$1);
    chrome.webNavigation.onCommitted.addListener(onWebNavigationCommitted);
    chrome.runtime.onMessage.addListener(onMessage);
  }

  function onWebNavigationCommitted(details) {
    let urlobj = new URL(details.url),
      tabInfo = tabInfoFor(details.tabId, true);

    if (!tabInfo) {
      return;
    }

    if (details.frameId === 0) {
      // if tabInfo.mainFrameCompleted is false, then onCompletedMainFrameRequest for this tab's
      // main_frame request was not called.  That can be for various reasons, such as:
      //   * aux tabs, such as chrome://version,
      //   * for service worker-controlled tabs
      //
      // In such a case we reset the tab's info here.  Otherwise, the tab has already been reset and
      // we don't need to do it again; but we do set tabInfo.mainFrameCompleted to false, so that
      // subsequent webNavigation.onCommitted without onCompleted handler leads to a reset.
      if (tabInfo.mainFrameCompleted) {
        tabInfo.mainFrameCompleted = false;
      } else {
        tabInfo.reset(urlobj, isEnabledFor(urlobj.hostname), false);
      } // webNavigation resets tabs' icons, so we need to re-setIcon it

      tabInfo.setIcon();
    }

    if (!tabInfo.enabled) {
      // If we are disabled on a tab, don't inject any CSS neither in it or in any of its iframes
      return;
    }

    if (!isSubjectToAdBlocking(urlobj)) {
      // That happens for some iframes (e.g. chrome-search://...)
      return;
    }

    let includeGeneric = !genericHideApplies(
        GlobalState.enabledFids,
        urlobj.href
      ),
      rules = getCss(urlobj.href, GlobalState.enabledFids, includeGeneric);

    if (rules) {
      chrome.tabs
        .insertCSS(details.tabId, {
          code: rules,
          frameId: details.frameId,
        })
        .catch(function () {
          console.log("Could not inject CSS into page", urlobj.href);
        });
    }
  }

  function onMessage(request, sender, sendResponse) {
    switch (request.message) {
      case "on-off-status":
        {
          let tabInfo = tabInfoFor(request.tabId);

          if (tabInfo) {
            sendResponse({
              globally: GlobalState.globalSwitch,
              locally: tabInfo.isSubject ? tabInfo.enabled : null,
              isHardWhitelisted: hashesContain(
                GlobalState.whitelistHashes,
                tabInfo.hostname
              ),
            });
          } else {
            // This happens when the extension is not yet initialized or when the tab is blank
            sendResponse({
              globally: GlobalState.globalSwitch,
              locally: true,
              isHardWhitelisted: false,
            });
          }
        }
        return;

      case "set-global-status":
        {
          setGlobalSwitch(request.status);
          save((S) => {
            S.on = GlobalState.globalSwitch;
          });
          setTabsEnabled();
          chrome.tabs
            .executeScript({
              code: "window.location.reload()",
            })
            .catch(() => void 0);
        }
        return;

      case "set-local-status":
        {
          let tabInfo = tabInfoFor(request.tabId); // the popup's switcher should be disabled for non-subject URLs

          if (!(tabInfo && tabInfo.isSubject && GlobalState.globalSwitch)) {
            return;
          }

          if (request.status) {
            // Delete the whitelist entry for this tab's hostname
            GlobalState.whitelistHostnames.delete(tabInfo.hostname);
            processKey(
              (S) => S.whitelist,
              (whitelist) => {
                whitelist.removeIf(
                  (white) => white.hostname === tabInfo.hostname
                );
              }
            );
          } else {
            // Create a whitelist entry for this tab's hostname
            GlobalState.whitelistHostnames.add(tabInfo.hostname);
            processKey(
              (S) => S.whitelist,
              (whitelist) => {
                whitelist.push({
                  hostname: tabInfo.hostname,
                  date: new Date().toISOString(),
                });
              }
            );
          }

          setTabsEnabled(tabInfo.hostname);
          chrome.tabs
            .executeScript(request.tabId, {
              code: "window.location.reload()",
            })
            .catch(() => void 0);
        }
        return;

      case "blocked-counts":
        {
          let tabInfo = tabInfoFor(request.tabId);
          sendResponse({
            locally: (tabInfo && tabInfo.numBlockedRequests) || 0,
            globally: GlobalState.numBlockedRequests,
          });
        }
        return;

      case "content-script":
        {
          if (!sender.tab && GlobalState.brw === "edge") {
            sendResponse({});
            return;
          }

          let url;
          let tabInfo = tabInfoFor(sender.tab.id);

          if (!tabInfo || !tabInfo.enabled) {
            sendResponse({});
            return;
          }

          try {
            url = new URL(sender.url);
          } catch (e) {
            sendResponse({});
            return;
          }

          let scripts = getScripts(url.hostname, GlobalState.enabledFids);
          let scriptlets = getScriptlets(url.hostname, GlobalState.enabledFids);
          let extCssRules = getExtCssRules(
            url.hostname,
            GlobalState.enabledFids
          );
          sendResponse({
            scripts: [...scripts, ...scriptlets],
            css4Rules: extCssRules.map((rule) => ({
              chain: rule.chain,
              styleObj: rule.styleObj || {
                display: "none",
              },
            })),
          });
        }
        return;

      case "update-whitelist":
        {
          // The sender has added the new record himself. Here we're just responsible for updating our
          // in-memory data structure to match what's in storage.
          request.type === "add"
            ? GlobalState.whitelistHostnames.add(request.hostname)
            : GlobalState.whitelistHostnames.delete(request.hostname);
          setTabsEnabled(request.hostname);
        }
        return;

      case "temporarily-unblock":
        {
          GlobalState.temporarilyUnblockTabId = request.tabId; // We need to call sendResponse so that the blocking page could wait for it and be sure that
          // it can now do the redirect.

          sendResponse();
        }
        return;

      case "update-filter-status":
        {
          // Enable/disable filters. We should only update our data structures in BG page.
          run(async () => {
            if (request.on) {
              if (GlobalState.disabledFids.includes(request.fid)) {
                // Easy case: it is loaded into memory but disabled
                GlobalState.disabledFids.remove(request.fid);
                GlobalState.enabledFids.push(request.fid);
              } else {
                // Hard case: it is not loaded into memory.
                //
                // Add the FID on enabledFids first b/c in theory it's possible that the second such
                // requests initiates the second load and we end up with each rule duplicated in memory.
                GlobalState.enabledFids.push(request.fid);
                let rules = await load((S) => S.filters[request.fid].rules);

                if (!rules);
                else {
                  let nloaded = loadFilterRules(request.fid, rules);
                }
              }
            } else {
              if (GlobalState.enabledFids.includes(request.fid)) {
                GlobalState.enabledFids.remove(request.fid);
                GlobalState.disabledFids.push(request.fid);
              }
            }
          }).finally(sendResponse);
          return true;
        }
        return;

      case "remove-custom-filter":
        {
          GlobalState.enabledFids.remove(request.fid);
          GlobalState.disabledFids.remove(request.fid);
          unloadFilterRules(request.fid);
          sendResponse();
        }
        return;

      case "start-filter-update":
        {
          if (GlobalState.filterUpdateState) {
            sendResponse({
              nFilters: GlobalState.filterUpdateState.nFilters,
              nChecked: GlobalState.filterUpdateState.nChecked,
            });
            return;
          }

          checkFilterUpdates().catch(() => {
            chrome.runtime.send1wayMessage({
              message: "filter-update-failed",
            });
          });
          sendResponse({
            nFilters: 0,
            nChecked: 0,
          });
        }
        return;

      case "blocked-info":
        return;
    }
  }

  function onBeforeRequest(details) {
    if (!GlobalState.globalSwitch) {
      let tabInfo = tabInfoFor(details.tabId);

      if (tabInfo) {
        tabInfo.recordRequestNoBlockingAttempted();
      }

      return;
    }

    if (details.type === "main_frame") {
      let url = mainFrameRequestRedirectUrl(details);
      return (
        (url && {
          redirectUrl: url,
        }) ||
        undefined
      );
    }

    let reqctx = makeRequestContext(details);

    if (reqctx === null) {
      return;
    }

    let tabInfo = reqctx.tabInfo,
      cancel;

    if (!tabInfo) {
      let { blockingRule } = shouldBlock(reqctx, GlobalState.enabledFids);
      cancel = blockingRule !== null;
    } else if (!tabInfo.enabled) {
      tabInfo.recordRequestNoBlockingAttempted();
      cancel = false;
    } else {
      let block = shouldBlock(reqctx, GlobalState.enabledFids);
      cancel = block.blockingRule !== null;

      if (block.blockingRule && block.rule.redirect) {
        let url = buildRedirectUrl(block.rule.redirect);
        return {
          redirectUrl: url,
        };
      }

      if (block.blockingRule && reqctx.type === "sub_frame") {
        chrome.tabs.send1wayMessage(tabInfo.id, {
          message: "blocked-iframe",
          url: reqctx.requestUrl,
        });
      }

      tabInfo.recordRequest(block, reqctx.requestUrl);

      if (block.blockingRule) {
        tabInfo.setBadgeText();
      }
    }

    return {
      cancel: cancel,
    };
  }

  function onCompletedMainFrameRequest(details) {
    if (details.tabId === -1) {
      return;
    }

    if (
      GlobalState.temporarilyUnblockTabId &&
      details.tabId === GlobalState.temporarilyUnblockTabId
    ) {
      GlobalState.temporarilyUnblockTabId = null;
    }

    let url = new URL(details.url),
      tabInfo = tabInfoFor(details.tabId, true);

    if (tabInfo) {
      tabInfo.reset(url, isEnabledFor(url.hostname), true);
    }
  }
  /**
   * Return either redirect URL if this main_frame request is going to be blocked, or null otherwise.

   * @param details - assumed to have .type === 'main_frame'
   * @return: url to redirect or null
   */

  function mainFrameRequestRedirectUrl(details) {
    if (
      GlobalState.temporarilyUnblockTabId &&
      details.tabId === GlobalState.temporarilyUnblockTabId
    ) {
      return null;
    }

    let hostname = new URL(details.url).hostname;
    let whitelisted =
      GlobalState.whitelistHostnames.has(hostname) ||
      hashesContain(GlobalState.whitelistHashes, hostname);

    if (whitelisted) {
      return null;
    }

    let reqctx = makeRequestContext(details);

    if (!reqctx) {
      return null;
    }

    let { blockingRule, rule } = shouldBlock(reqctx, GlobalState.enabledFids);

    if (!blockingRule) {
      return null;
    }

    let data = {
      url: details.url,
      rule: rule.src,
    };

    if (rule.redirect) {
      return buildRedirectUrl(rule.redirect);
    }

    return (
      chrome.extension.getURL("options.html?details=") +
      btoa(JSON.stringify(data))
    );
  }
  /**
   * Do the update. Resolve with true if done, false if not (e.g. another update in progress).
   * Reject e.g. in case of network errors or server down.
   */

  async function checkFilterUpdates() {
    if (GlobalState.filterUpdateState) {
      return false;
    } // For AdLock filters, we first know what needs to be updated. For custom filters, we find that
    // out after downloading the contents by the given URL.  That's why we have separate "checked"
    // and "updated" counts. The invariant is this: nUpdated <= nChecked.

    GlobalState.filterUpdateState = {
      nFilters: 0,
      // total number of filters (will be set after we fetch the # of custom filters)
      nChecked: 0,
      // # of checked filters
      nUpdated: 0, // # of actually updated filters
    };

    try {
      await doCheckFilterUpdates();
    } finally {
      GlobalState.filterUpdateState = null;
      await save((S) => {
        S.mostRecentUpdate = new Date().toISOString();
      });
    }

    return true;
  }

  async function doCheckFilterUpdates() {
    function sendMsgFilterUpdated() {
      chrome.runtime.send1wayMessage({
        message: "filter-updated",
        nFilters: GlobalState.filterUpdateState.nFilters,
        nChecked: GlobalState.filterUpdateState.nChecked,
      });
    }

    let customFids = await load((S) => S.customFids);
    GlobalState.filterUpdateState.nFilters =
      ADLOCK_FILTERS.length + customFids.length;
    sendMsgFilterUpdated();
    let { finfos, whitelistHashes: shouldUpdateWhitelistHashes } =
      await resourcesToUpdate();
    GlobalState.filterUpdateState.nChecked =
      ADLOCK_FILTERS.length - finfos.length;
    sendMsgFilterUpdated();
    finfos.extend(
      await load((S) => customFids.map((fid) => S.filters[fid].info))
    );
    let whitelistHashesPromise;

    if (shouldUpdateWhitelistHashes) {
      whitelistHashesPromise = loadWhitelistHashes();
    } else {
      whitelistHashesPromise = Promise.resolve();
    }

    for await (let res of updateFiltersBy1(finfos.map((finfo) => finfo.id))) {
      GlobalState.filterUpdateState.nChecked += 1;

      if (res.exc) {
        console.log("Failed to update filter", res.fid, "thrown exc:", res.exc);
      } else {
        let finfo = finfos.find((finfo) => finfo.id === res.fid);

        if (res.rules !== null) {
          GlobalState.filterUpdateState.nUpdated += 1;

          if (finfo.on) {
            unloadFilterRules(res.fid);
            loadFilterRules(res.fid, res.rules);
          }
        }
      }

      sendMsgFilterUpdated();
    }

    await whitelistHashesPromise;
    chrome.runtime.send1wayMessage({
      message: "filter-update-completed",
      didUpdateAnything: GlobalState.filterUpdateState.nUpdated > 0,
    });
    return true;
  }

  function setFilterAutoUpdate() {
    async function check() {
      let update = new Date(await load((S) => S.mostRecentUpdate)),
        now = new Date();

      if (!update || now - update > AUTO_UPDATE_INTV) {
        try {
          let res = await checkFilterUpdates();
          console.log("Auto-updated filters", res);
        } catch (e) {
          console.log("Automatic filter update failed with reason:", e);
        }
      }

      setTimeout(check, AUTO_UPDATE_CHECK_INTV);
    }

    setTimeout(check, AUTO_UPDATE_CHECK_INTV);
  }
  /**
   * Load all AdLock filters, unconditionally.
   */

  async function firstTimeLoadFilters() {
    let nRulesLoaded = 0;

    for await (let res of updateFiltersBy1(ADLOCK_FILTER_IDS)) {
      if (res.exc) {
        console.log(
          "Failed to download filter",
          res.fid,
          "thrown exc:",
          res.exc
        );
        continue;
      } // res.rules cannot be null since at this point there should be no custom filters

      nRulesLoaded += loadFilterRules(res.fid, res.rules);
    }

    await save((S) => {
      S.mostRecentUpdate = new Date().toISOString();
    });
  }

  async function ordinaryLoadFilters() {
    let customFids = await load((S) => S.customFids);
    let filters = nonTerminals((S) => [
      ...ADLOCK_FILTER_IDS.map((fid) => S.filters[fid]),
      ...customFids.map((fid) => S.filters[fid]),
    ]);
    let finfos = await load(filters.map((filter) => filter.info)); // Remove from finfos those objects which have .on = false. Also remove corresponding nonterminals
    // in "filters".

    let newlen = 0;

    for (let i = 0; i < finfos.length; i += 1) {
      if (finfos[i].on) {
        finfos[newlen] = finfos[i];
        filters[newlen] = filters[i];
        newlen += 1;
      }
    }

    filters.length = finfos.length = newlen;
    GlobalState.enabledFids = finfos.map((finfo) => finfo.id);
    let ruless = await load(filters.map((filter) => filter.rules)); // At this point there still may be filters for which we have no rules. This can happen:
    //   * after we add new filters;
    //   * if there was a (e.g. network) failure during preceding load
    //
    // So we update those filters and load rules for all enabled filters.

    let gtor = inParallel(
      Array.from(zip(finfos, ruless)),
      (finfo, rules) => {
        if (rules) {
          return Promise.resolve(rules);
        } else {
          return updateFilter(finfo.id, true);
        }
      },
      ([finfo], rules) => ({
        fid: finfo.id,
        rules,
      }),
      ([finfo], exc) => ({
        fid: finfo.id,
        exc,
      })
    );
    let nRulesLoaded = 0;

    for await (let res of gtor) {
      if (res.exc) {
        console.log("Exception during update of fid", res.fid, res.exc);
        continue;
      }

      nRulesLoaded += loadFilterRules(res.fid, res.rules);
    } // Load filters.txt only when this is a dev (debug) build

    await void 0;
    console.log("Rules loaded:", nRulesLoaded);
    console.log("Enabled filters:", GlobalState.enabledFids);
  }

  async function loadWhitelistHashes() {
    let hres = await fetchWhitelistHashes();
    GlobalState.whitelistHashes = new Hashes(hres.hashes, hres.m32, hres.m16);
    await save((S) => {
      S.whitelistHashes = {
        version: hres.version,
        m32: hres.m32,
        m16: hres.m16,
        hashes: hres.hashes,
      };
    });
    setTabsEnabled(); // Need to do that since whitelist hashes changed
  }
  /**
   * Initialize the storage and choose what filters to turn on.
   *
   * This should be called after we've detected that the storage is uninitialized (clean).
   */

  async function initStorage() {
    let onFids = ADLOCK_FILTER_IDS;
    await save((S) => {
      S.uuid = makeUuid();
      S.migrations = actualMigrations.length;
      S.mostRecentUpdate = null;
      S.customFids = [];
      S.on = true;
      S.whitelist = [];
      S.numBlockedRequests = 0;
      S.whitelistHashes = null;

      for (let info of ADLOCK_FILTERS) {
        S.filters[info.id].info = {
          id: info.id,
          date: null,
          version: null,
          on: onFids.includes(info.id),
          isCustom: false,
        };
      }
    });
  }

  let fetchScriptletsResources = async function () {
    let filterTxt = chrome.extension.getURL("res/resources.txt");
    let text = await fetch(filterTxt).then((response) => response.text());
    return compileScriptlets(text);
  };

  let fetchRedirectsResources = async function () {
    let filterYml = chrome.extension.getURL("res/redirects.txt");
    let json = await fetch(filterYml).then((response) => response.json());
    return compileRedirects(json);
  };
  /**
   * The single entry point: execute this code when the background code loads
   */

  async function entry() {
    let before = performance.now();
    chrome.browserAction.setBadgeBackgroundColor({
      color: [96, 96, 96, 1],
    }); // G.enabledFids are assigned the full list of IDs quite early in the load process. That's
    // because the options page can be accessed before the initialization process is finished. So
    // the user can enable/disable filters which can lead to double (down)loading rules.
    // Having G.enabledFids == <all the filter IDs> protects us from this.

    GlobalState.enabledFids = Array.from(ADLOCK_FILTER_IDS);
    let isCleanStorage = (await chrome.storage.local.getBytesInUse()) === 0;
    let initPromises = [loadPsl()];

    if (isCleanStorage) {
      await initStorage();
    } else {
      await apply();
    }

    let I = await loadAsObj(rootKey(), [
      "on",
      "uuid",
      "whitelist",
      "whitelistHashes",
      "numBlockedRequests",
    ]);
    setGlobalSwitch(I.on);
    GlobalState.uuid = I.uuid;
    GlobalState.whitelistHostnames = new Set(
      I.whitelist.map((wl) => wl.hostname)
    );
    GlobalState.numBlockedRequests = I.numBlockedRequests;
    GlobalState.scriptlets = await fetchScriptletsResources();
    GlobalState.redirects = await fetchRedirectsResources();

    if (I.whitelistHashes) {
      GlobalState.whitelistHashes = new Hashes(
        I.whitelistHashes.hashes,
        I.whitelistHashes.m32,
        I.whitelistHashes.m16
      );
    } else {
      initPromises.push(loadWhitelistHashes());
    }

    if (isCleanStorage) {
      initPromises.push(firstTimeLoadFilters());
    } else {
      initPromises.push(ordinaryLoadFilters());
    }

    initPromises.push(resetAll((urlobj) => isEnabledFor(urlobj.hostname)));
    registerListeners();
    await Promise.all(initPromises);
    setFilterAutoUpdate();
    GlobalState.isInitialized = true;
    console.log(
      "Load process took, ms:",
      Math.round(performance.now() - before)
    );
  }

  entry();
})();
