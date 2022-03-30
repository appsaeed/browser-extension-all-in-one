(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-i18n]").forEach(function (elt) {
      elt.innerHTML = chrome.i18n.getMessage(elt.dataset.i18n);
    });
  });

  /** @module General-purpose utilities
   *
   * Most of these functions/types should be placed somewhere in more appropriate location.
   */
  function failure(msg) {
    throw new Error(msg);
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
  /**
   * Make a function (thunk) that runs asyncFn
   */

  function thunk(asyncFn) {
    return function () {
      asyncFn();
    };
  }
  function toArray(obj) {
    return Array.isArray(obj) ? obj : [obj];
  }
  let objHasOwnProperty = Object.prototype.hasOwnProperty;
  function hasOwnProperty(obj, prop) {
    return objHasOwnProperty.call(obj, prop);
  }
  function sconcat() {
    return String.prototype.concat.apply([], arguments);
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
  function bind(obj, meth) {
    return obj[meth].bind(obj);
  }

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

  /**
   Ad-hoc DOM-manipulation utils
   */
  function remove$1(node) {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  function indexInParent(elem) {
    return Array.prototype.indexOf.call(elem.parentNode.children, elem);
  }

  /**
   * Hashes of domains (e.g. whitelist).
   */
  const reHash = /(\d+)=(\d+)/;
  const pwr16 = 1 << 16;
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
  const ADLOCK_FILTERS = [
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
    ADLOCK_FILTER_IDS = ADLOCK_FILTERS.map((info) => info.id);

  /**
   * "Resource" is an AdLock server resource: filter list, whitelist hashes, etc.
   */

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

  const urlValidChars = sconcat(
    "!",
    charRangeStr("#", ";"),
    "=?@",
    charRangeStr("[", "_"),
    charRangeStr("a", "z"),
    charRangeStr("{", "~")
  );

  const // party (1st/3rd) gets encoded together with the type
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
    any_party = type2mask["first-party"] | type2mask["third-party"];
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

  const // The following are just 0 which stands special at diff places, for better readability
    STARTING_INDEX = 1,
    ZERO_NSTR = 0;
  function RadixTrie(initialBufLen) {
    this.buf = new Int32Array(initialBufLen); // zero-filled

    this.size = STARTING_INDEX; // {string: [nstr, refcount]}

    this.dict = Object.create(null); // {Number: string}

    this.nstr2word = Object.create(null);
    this.nstr2word[ZERO_NSTR] = ""; // special datum, to avoid special cases

    this.nextNstr = 1;
    this.nextTerminalNumber = 1;
  }

  /** @module Public Suffix List operations (see https://publicsuffix.org/list/) */
  const INITIAL_RADIX_BUFLEN = 50000;

  function PslRadixTrie(initialBufLen) {
    RadixTrie.call(this, initialBufLen); // [exception: true|false, ...] for each rule

    this.suffixes = [false];
  }

  PslRadixTrie.prototype = RadixTrie.prototype;

  let radix = new PslRadixTrie(INITIAL_RADIX_BUFLEN);

  /** @module Queue implementation based on 2 stacks (arrays) */

  /**
   * Module responsible for tabs bookkeeping.
   * We need that to be able to do some synchronous operations with tabs.
   */

  const RADIX_INITIAL_BUFLEN = 100000;
  let radix$1 = new RadixTrie(RADIX_INITIAL_BUFLEN);

  /**
   * Filter operations: load/update, etc.
   */
  const reRuleLineSep = /\r?\n/,
    customFidPrefix = "c-";
  function nextCustomFid(cfids) {
    let numcfids = cfids.map(customFid2Number);
    let next = numcfids.isEmpty ? 1 : Math.max(...numcfids) + 1;
    return number2CustomFid(next);
  }

  function customFid2Number(cfid) {
    return Number(cfid.slice(customFidPrefix.length));
  }

  function number2CustomFid(num) {
    return customFidPrefix + num;
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
  function fid2name(id) {
    return chrome.i18n.getMessage("filter_name_" + id);
  }
  function fid2desc(id) {
    return chrome.i18n.getMessage("filter_desc_" + id);
  }

  const reHostname = /^[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*$/;
  const reDetails = /details=([^&]+)/;
  const redirectProUrl = "https://wdprogram.com/chrome-vs-windows/?acr=NTQSguI";
  let addFilterBtn = document.querySelector(".create-filter-btn");
  let filterListWrap = document.querySelector(".filter-list-wrap ol");
  let showFilterForm = document.querySelector(".show-filter-form");
  let loadArrows = document.querySelector(".load-arrows");
  let navTabs = Array.from(document.querySelectorAll(".nav-item"));
  let navWrapHeader = document.querySelector("header");
  let sections = Array.from(document.querySelectorAll("section"));
  let sectionBlocked = document.getElementById("blocked-section");
  let filterForm = document.querySelector(".filter-form");
  let newFilterLoadingForm = document.querySelector(".new-filter-loading-form");
  let filterName = document.getElementById("filter-name"),
    filterUrl = document.getElementById("filter-url");
  let notificationsWrap = document.getElementById("notifications-wrap");
  let optionBody = document.querySelector("body"); // Filter update UI elements

  let filtersUpdate = document.querySelector(".filters-update");
  let countCheckedFilters = document.getElementById("count-checked-filters");
  let nFiltersCheckingForUpdate = document.getElementById("n-filters-checking");
  let nFiltersCheckedForUpdate = document.getElementById("n-filters-checked");
  let storeLinkBtn = document.querySelector(".rate-btn");
  let storeLinks = {
    chrome:
      "https://chrome.google.com/webstore/detail/adlock-ad-blocker/aemffjkmgcepimloclpkecifcnipnodh/",
    opera: "https://addons.opera.com/extensions/details/adlock-2/",
    edge: "https://microsoftedge.microsoft.com/addons/detail/coanhlhpoegcbpjapcaedenbdcajnijo",
  };
  storeLinkBtn.setAttribute("href", storeLinks[GlobalState.brw]); // Navigation between tabs

  let navigate = run(function () {
    let sectionRoutes = {
      whitelist: {
        initializer: initializeWhitelistSection,
        status: false,
      },
      filters: {
        initializer: initializeFiltersSection,
        status: false,
      },
    };
    return function (navItem) {
      if (navItem.classList.contains("active")) {
        return;
      }

      let id = navItem.dataset.id;

      if (!sectionRoutes[id].status) {
        sectionRoutes[id].initializer();
        sectionRoutes[id].status = true;
      }

      for (let navTab of navTabs) {
        navTab.classList.remove("active");
      }

      navItem.classList.add("active");

      for (let section of sections) {
        if (section.dataset.target === id) {
          section.classList.add("active");
        } else {
          section.classList.remove("active");
        }
      }
    };
  });
  navWrapHeader.addEventListener("click", function (e) {
    if (!e.target.matches(".nav-item")) {
      return;
    }

    navigate(e.target);
  });
  let filter2fid = new WeakMap();
  let customFids;
  let badNewCustomFilterNotification = null; // Is options.html shown as "blocked page" or "options page" ?

  run(function () {
    let match = reDetails.exec(window.location.search);

    if (!match) {
      navigate(navTabs[0]);
      return;
    }

    let { url, rule } = JSON.parse(atob(match[1]));
    let urlElem = document.getElementById("url");
    let ruleElem = document.getElementById("blocked-rule");
    sectionBlocked.classList.add("active");
    urlElem.textContent = url;
    ruleElem.textContent = rule;
    urlElem.addEventListener(
      "click",
      thunk(async function () {
        if (!navigator.clipboard) {
          return;
        }

        let notification = makeNotificationElem(
          chrome.i18n.getMessage("clipboard"),
          "",
          "info"
        );

        try {
          await navigator.clipboard.writeText(url);
        } catch (e) {
          console.log("Async: Could not copy text: ", err);
        }

        urlElem.style.color = "grey";
        notificationsWrap.appendChild(notification);
        setTimeout(function () {
          if (!notification.parentNode) {
            return;
          }

          notificationsWrap.removeChild(notification);
        }, 3000);
      })
    ); // Section: Blocked page

    let excludeDanger = document.querySelector(".exclude-danger");
    let ignoreDanger = document.querySelector(".ignore-danger");
    let hostname;

    try {
      hostname = new URL(url).hostname;
    } catch (e) {
      return;
    }

    excludeDanger.addEventListener("click", function () {
      saveWhitelistExcludePage(hostname);
      window.location = url;
    });
    ignoreDanger.addEventListener(
      "click",
      thunk(async function () {
        await chrome.runtime.sendMessage({
          message: "temporarily-unblock",
          tabId: (await chrome.tabs.getCurrent()).id,
        });
        window.location = url;
      })
    );
  }); // Section: Filters

  async function initializeFiltersSection() {
    let finfos, cfinfos;
    [finfos, customFids] = await load((S) => [
      ADLOCK_FILTER_IDS.map((fid) => S.filters[fid].info),
      S.customFids,
    ]);
    cfinfos = await load((S) => customFids.map((fid) => S.filters[fid].info));
    appendProElem();

    for (let finfo of finfos) {
      if (finfo.id !== "1900") {
        let elem = makeFilterElem(finfo);
        filter2fid.set(elem, finfo.id);
        filterListWrap.appendChild(elem);
      }
    }

    for (let cfinfo of cfinfos) {
      let elem = makeCustomFilterElem(cfinfo);
      filter2fid.set(elem, cfinfo.id);
      filterListWrap.appendChild(elem);
    }
  } //Fake elem for Pro version

  function appendProElem() {
    let spyware = {
      date: new Date().getTime(),
      id: "1003",
      isCustom: false,
      on: false,
      version: 2,
    };
    filterListWrap.appendChild(makeFakeFilterElem(spyware));
  } // Filter update

  let filtersUpdating = false;

  function startFilterUpdate(nFilters, nChecked) {
    nFiltersCheckingForUpdate.innerText = String(nFilters);
    nFiltersCheckedForUpdate.innerText = String(nChecked);
    filtersUpdate.classList.add("active");
    optionBody.classList.add("hidden");

    if (nFilters > 0) {
      countCheckedFilters.classList.add("active");
    } else {
      countCheckedFilters.classList.remove("active");
    }

    filtersUpdating = true;
  }

  function stopFilterUpdate() {
    filtersUpdate.classList.remove("active");
    optionBody.classList.remove("hidden");
    filtersUpdating = false;
  }

  loadArrows.addEventListener(
    "click",
    thunk(async function () {
      let state = await chrome.runtime.sendMessage({
        message: "start-filter-update",
      });
      startFilterUpdate(state.nFilters, state.nChecked);
    })
  );
  chrome.runtime.onMessage.addListener(onMessage);

  function onMessage(request, sender, sendResponse) {
    switch (request.message) {
      case "filter-updated":
        {
          if (!filtersUpdating) {
            return;
          }

          nFiltersCheckingForUpdate.innerText = request.nFilters;
          nFiltersCheckedForUpdate.innerText = request.nChecked;
          countCheckedFilters.classList.add("active");
        }
        return;

      case "filter-update-completed":
        {
          if (!filtersUpdating) {
            return;
          }

          stopFilterUpdate();
          let notification;

          if (request.didUpdateAnything) {
            notification = makeNotificationElem(
              chrome.i18n.getMessage("success"),
              chrome.i18n.getMessage("filters_updated"),
              "success"
            );
          } else {
            notification = makeNotificationElem(
              chrome.i18n.getMessage("no_filters_update"),
              "",
              "info"
            );
          }

          notificationsWrap.appendChild(notification);
        }
        return;

      case "filter-update-failed":
        {
          if (!filtersUpdating) {
            return;
          }

          stopFilterUpdate();
          showFilterUpdateFailedNotification();
        }
        return;

      default:
        return;
    }
  } // Turn on/off a filter

  filterListWrap.addEventListener("change", onFilterEnabledDisabled); // Close notification

  notificationsWrap.addEventListener("click", function (e) {
    if (!e.target.matches(".filter-notification-close")) {
      return;
    }

    remove$1(e.target.closest(".filter-notification"));
  });
  filterForm.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "Enter":
        onAddCustomFilter();
        break;

      case "Escape":
        closeFilterForm();
        break;
    }
  });
  showFilterForm.addEventListener("click", toggleFilterForm);

  function toggleFilterForm() {
    filterForm.classList.toggle("show");
    showFilterForm.classList.toggle("active");
    filterName.value = "";
    filterName.focus();
    filterUrl.value = "";
    filterUrl.classList.remove("error");
  }

  document
    .querySelector(".filter-form-close-x")
    .addEventListener("click", closeFilterForm);

  function closeFilterForm() {
    filterForm.classList.remove("show");
    showFilterForm.classList.remove("active");
    filterName.value = "";
    filterUrl.value = "";
    removeBadNewCustomFilterNotification();
  }

  addFilterBtn.addEventListener("click", onAddCustomFilter);

  function onAddCustomFilter() {
    removeBadNewCustomFilterNotification();
    filterForm.dataset["target"] = "waiting";
    addCustomFilter().then(
      () => {
        filterForm.dataset["target"] = "add";
      },
      (e) => {
        filterForm.dataset["target"] = "add";
        let elem = makeNotificationElem(
          chrome.i18n.getMessage("fetch_rules"),
          chrome.i18n.getMessage("check_url"),
          "error"
        );
        setBadNewCustomFilterNotification(elem);
        filterUrl.classList.add("error");
        filterUrl.focus();
      }
    );
  }

  async function addCustomFilter() {
    filterUrl.classList.remove("error");

    if (!filterName.value && !filterUrl.value) {
      return;
    }

    let urlobj;

    try {
      urlobj = new URL(filterUrl.value);
    } catch (e) {
      filterUrl.classList.add("error");
      filterUrl.focus();
      return;
    }

    let infoRules = await fetchRulesByUserUrl(urlobj);
    let cfid = nextCustomFid(customFids);
    customFids.push(cfid);
    let cfinfo = {
      id: cfid,
      name: filterName.value,
      date: new Date().toISOString(),
      on: true,
      url: filterUrl.value,
      isCustom: true,
      hash: infoRules.hash,
    };
    await save((S) => {
      S.customFids = customFids;
      S.filters[cfid].info = cfinfo;
      S.filters[cfid].rules = infoRules.rules;
    });
    chrome.runtime.send1wayMessage({
      message: "update-filter-status",
      on: true,
      fid: cfid,
    });
    let userFilter = makeCustomFilterElem(cfinfo);
    filter2fid.set(userFilter, cfid);
    filterListWrap.appendChild(userFilter);
    let notification = makeNotificationElem(
      chrome.i18n.getMessage("success"),
      chrome.i18n.getMessage(
        "custom_filter_successfully_added",
        filterName.value
      ),
      "success"
    );
    notificationsWrap.appendChild(notification);
    closeFilterForm();
  }

  function setBadNewCustomFilterNotification(elem) {
    removeBadNewCustomFilterNotification();
    badNewCustomFilterNotification = elem;
    notificationsWrap.appendChild(elem);
  }

  function removeBadNewCustomFilterNotification() {
    if (badNewCustomFilterNotification) {
      remove$1(badNewCustomFilterNotification);
      badNewCustomFilterNotification = null;
    }
  }

  filterListWrap.addEventListener("click", onDeleteCustomFilter);
  filterUrl.addEventListener("input", function () {
    if (this.value === "") {
      this.classList.remove("error");
    }
  });

  function onDeleteCustomFilter(e) {
    if (!e.target.matches(".custom-filter-close-x")) {
      return;
    }

    let filter = e.target.closest(".filter"),
      cfid = filter2fid.get(filter);
    chrome.runtime.send1wayMessage({
      message: "remove-custom-filter",
      fid: cfid,
    });
    remove$1(filter);
    remove((S) => [S.filters[cfid].info, S.filters[cfid].rules]);
    customFids.remove(cfid);
    save((S) => {
      S.customFids = customFids;
    });
  }

  function onFilterEnabledDisabled(e) {
    if (!e.target.matches(".filter-info-checked")) {
      return;
    }

    if (e.target.matches(".filter-info-pro")) {
      window.location = redirectProUrl;
      return;
    }

    let checkbox = e.target,
      filter = checkbox.closest(".filter"),
      fid = filter2fid.get(filter);
    processKey(
      (S) => S.filters[fid].info,
      (finfo) => {
        finfo.on = checkbox.checked;
      }
    );
    chrome.runtime.send1wayMessage({
      message: "update-filter-status",
      on: checkbox.checked,
      fid: fid,
    });
  }

  function makeFilterElem(finfo) {
    let html = `
    <li class="filter">
      <div class="filter-info-desc clip-nowrap-text-container">
        <p class="filter-name" >${fid2name(finfo.id)}</p>
        <p class="filter-url">${fid2desc(finfo.id)}</p>
      </div>
      <div class="filter-info-date">
        <p class="filter-date-lbl">${chrome.i18n.getMessage("last_update")}</p>
        <p class="filter-date">${dateOrNever(finfo.date)}</p>
      </div>
      <div class="flex-stretcher"></div>
      <input class="filter-info-checked" type="checkbox" ${
        finfo.on ? "checked" : ""
      }>
    </li>
  `;
    return document.createRange().createContextualFragment(html.trim())
      .firstChild;
  }

  function makeFakeFilterElem(finfo) {
    let html = `
    <li class="filter">
      <div class="filter-info-desc clip-nowrap-text-container">
        <p class="filter-name" >${fid2name(finfo.id)}</p>
        <p class="filter-url">${fid2desc(finfo.id)}</p>
      </div>
      <div class="filter-info-date">
        <p class="filter-date-lbl">${chrome.i18n.getMessage("last_update")}</p>
        <p class="filter-date">${dateOrNever(finfo.date)}</p>
      </div>
      <div class="flex-stretcher"></div>
       <input class="filter-info-pro filter-info-checked" type="checkbox"}>
    </li>
  `;
    return document.createRange().createContextualFragment(html.trim())
      .firstChild;
  }

  function makeCustomFilterElem(cfinfo) {
    let html = `
    <li class="filter custom-filter">
      <div class="filter-info-desc">
        <img src="./img/user.svg" alt="" class="custom-filter-icon">
        <div class="clip-nowrap-text-container">
          <p class="filter-name">${cfinfo.name}</p>
          <a class="filter-url" href="${cfinfo.url}">${cfinfo.url}</a>
        </div>
      </div>
      <div class="filter-info-date">
          <p class="filter-date-lbl">${chrome.i18n.getMessage(
            "last_update"
          )}</p>
          <p class="filter-date">${dateOrNever(cfinfo.date)}</p>
      </div>
      <div class="flex-stretcher"></div>
      <input class="filter-info-checked" type="checkbox" ${
        cfinfo.on ? "checked" : ""
      }>
      <div class="custom-filter-close-x"></div>
    </li>
  `;
    return document.createRange().createContextualFragment(html.trim())
      .firstChild;
  }

  function makeNotificationElem(header, msg, klass) {
    let html = `
      <div class="filter-notification filter-notification-${klass}">
        <div class="filter-notification-icon"></div>
        <div class="filter-notification-contents">
          <span class="filter-notification-header">${header}</span>
          <span class="filter-notification-msg">${msg}</span>
        </div>
        <button class="filter-notification-close"></button>
      </div>
  `;
    return document.createRange().createContextualFragment(html.trim())
      .firstChild;
  }

  function showFilterUpdateFailedNotification() {
    let elem = makeNotificationElem(
      chrome.i18n.getMessage("filter_failed"),
      chrome.i18n.getMessage("check_network"),
      "error"
    );
    notificationsWrap.appendChild(elem);
  }

  function dateOrNever(date) {
    if (!date) {
      return chrome.i18n.getMessage("never");
    }

    return new Date(date).toLocaleString();
  } // Section: Whitelist

  let excForm = document.querySelector(".exc-form");
  let whitelistWrap = document.querySelector(".whitelist-wrap ul");
  let openExcFormBtn = document.querySelector(".exc-open-form-btn");
  let excUrl = document.querySelector(".exc-url");
  let whitelist = [];

  async function initializeWhitelistSection() {
    whitelist = await load((S) => S.whitelist);

    if (!whitelist) {
      return;
    }

    for (let white of whitelist) {
      let elem = makeWhiteDomainElem(white);
      whitelistWrap.appendChild(elem);
    }
  }

  document
    .querySelector(".exc-open-form-btn")
    .addEventListener("click", function () {
      this.classList.toggle("active");
      excForm.classList.toggle("show");
      excUrl.classList.remove("error");
      excUrl.value = "";
      excUrl.focus();
    });
  document
    .querySelector(".exc-close-form-btn")
    .addEventListener("click", function () {
      excForm.classList.remove("show");
      openExcFormBtn.classList.remove("active");
    });
  document
    .querySelector(".filter-whitelist")
    .addEventListener("input", function () {
      let val = this.value;

      for (let i = 0; i < whitelist.length; i += 1) {
        let hostname = whitelist[i].hostname,
          elem = whitelistWrap.children[i];

        if (hostname.toUpperCase().indexOf(val.toUpperCase()) !== -1) {
          elem.classList.remove("invisible");

          if (val !== "") {
            elem.children[1].innerHTML = hostname.replace(
              val,
              `<span class="sch-result-highlight">${val}</span>`
            );
          }
        } else {
          elem.classList.add("invisible");
        }

        if (val === "") {
          elem.children[1].innerHTML = hostname;
        }
      }
    });
  excUrl.addEventListener("input", function () {
    if (this.value === "") {
      this.classList.remove("error");
    }
  });
  document
    .querySelector(".exc-add-btn")
    .addEventListener("click", saveToWhitelist);

  function saveToWhitelist() {
    excUrl.classList.remove("error");
    let url = excUrl.value;

    if (url === "") {
      return;
    }

    let hostname;

    if (reHostname.test(url)) {
      hostname = url;
    } else {
      try {
        hostname = new URL(url).hostname;
      } catch (e) {
        excUrl.classList.add("error");
        excUrl.focus();
        return;
      }
    }

    let white = saveWhitelistToStorage(hostname);
    let elem = makeWhiteDomainElem(white);
    whitelistWrap.appendChild(elem);
    excUrl.value = "";
    excForm.classList.remove("show");
    openExcFormBtn.classList.remove("active");
  }

  function whiteListHostname(hostname) {
    return {
      hostname,
      date: new Date().toISOString(),
    };
  }

  function saveWhitelistToStorage(hostname) {
    let white = whiteListHostname(hostname);
    whitelist.push(white);
    save((S) => {
      S.whitelist = whitelist;
    });
    notifyWhitelistUpdated("add", white.hostname);
    return white;
  }

  function saveWhitelistExcludePage(hostname) {
    let white = whiteListHostname(hostname);
    processKey(
      (S) => S.whitelist,
      (whiteList) => {
        whiteList.push(white);
      }
    );
    notifyWhitelistUpdated("add", white.hostname);
  }

  function makeWhiteDomainElem(white) {
    let html = `
      <li class="white-list-item">
        <p>${new Date(white.date).toLocaleString()}</p>
        <h4 class="hostname">${white.hostname}</h4>
        <div class="cross-white-list"></div>
      </li>
  `;
    return document.createRange().createContextualFragment(html.trim())
      .firstChild;
  } // Remove exclusion

  whitelistWrap.addEventListener("click", function (e) {
    if (!e.target.matches(".cross-white-list")) {
      return;
    }

    let cross = e.target,
      whiteElem = cross.closest(".white-list-item"),
      index = indexInParent(whiteElem);
    notifyWhitelistUpdated("delete", whitelist[index].hostname);
    whitelist.splice(index, 1);
    save((S) => {
      S.whitelist = whitelist;
    });
    remove$1(whiteElem);
  });
  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "Enter":
        saveToWhitelist();
        break;

      case "Escape":
        excForm.classList.remove("show");
        openExcFormBtn.classList.remove("active");
        break;
    }
  });

  function notifyWhitelistUpdated(type, hostname) {
    chrome.runtime.send1wayMessage({
      message: "update-whitelist",
      type: type,
      hostname: hostname,
    });
  }
})();
