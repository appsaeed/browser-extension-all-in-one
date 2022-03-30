(function () {
  "use strict";

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

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-i18n]").forEach(function (elt) {
      elt.innerHTML = chrome.i18n.getMessage(elt.dataset.i18n);
    });
  });

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

  /** @module Queue implementation based on 2 stacks (arrays) */

  async function activeTabCurWnd() {
    let tabs = await chrome.tabs.query({
      currentWindow: true,
      active: true,
    });

    if (!tabs || tabs.length !== 1) {
      return null;
    }

    return tabs[0];
  }
  /**
   * Subscribe to eventName on object and return promise that resolves when the event fires.
   * The event handler is attached with {once: true}.
   * @return Promise
   */

  function eventShoot(object, eventName) {
    return new Promise((resolve) => {
      object.addEventListener(eventName, resolve, {
        once: true,
      });
    });
  }

  const updateTimeout = 2000; // ms, how often we update data on the popup

  async function queryState() {
    let tab = await activeTabCurWnd();
    let [status, blockedCounts] = await Promise.all([
      chrome.runtime.sendMessage({
        message: "on-off-status",
        tabId: tab.id,
      }),
      queryBlockedCounts(tab.id),
    ]);
    let state = {
      tabId: tab.id,
      isGloballyEnabled: status.globally,
      isEnabledForTab: status.locally,
      // false, true, null - inapplicable
      isHardWhitelisted: status.isHardWhitelisted,
      blockedCounts,
    };
    return state;
  }

  function queryBlockedCounts(tabId) {
    return chrome.runtime.sendMessage({
      message: "blocked-counts",
      tabId,
    });
  }

  let // This communication with the background page is doing ASAP, even before DOM is ready
    state = queryState(),
    domReady = eventShoot(document, "DOMContentLoaded");
  Promise.all([state, domReady]).then(onReady);

  function onReady([state]) {
    // Global entities (for the lifetime of this popup webpage)
    let {
      tabId,
      isGloballyEnabled,
      isEnabledForTab,
      // false, true, null - inapplicable
      isHardWhitelisted,
      blockedCounts,
    } = state;
    let checkbox = document.getElementById("check"),
      contItem = document.getElementsByClassName("cont-item")[0],
      globalSwitch = document.getElementById("global-switch"),
      locallyBlocked = document.getElementById("locally-blocked"),
      globallyBlocked = document.getElementById("globally-blocked"),
      storeLinkBtn = document.querySelector(".footer-button"),
      storeLinks = {
        chrome: "https://wdprogram.com/",
        opera: "https://wdprogram.com/",
        edge: "https://wdprogram.com/",
      };

    storeLinkBtn.setAttribute("href", storeLinks[GlobalState.brw]);

    function updateUi() {
      checkbox.disabled =
        !isGloballyEnabled || isEnabledForTab === null || isHardWhitelisted;

      if (!isGloballyEnabled || isEnabledForTab === null) {
        document.body.classList.add("off");
      } else {
        document.body.classList.remove("off");
      }

      checkbox.checked = isEnabledForTab === false || isHardWhitelisted;

      if (isGloballyEnabled) {
        globalSwitch.innerText = chrome.i18n.getMessage("adlock_turn_off");
        globalSwitch.classList.remove("off");
      } else {
        globalSwitch.innerText = chrome.i18n.getMessage("adlock_turn_on");
        globalSwitch.classList.add("off");
      }

      if (isHardWhitelisted) {
        contItem.appendChild(
          createHardWhitelistedNotification(
            chrome.i18n.getMessage("page_hard_whitelisted")
          )
        );
      }
    }

    function displayBlockedCounts() {
      locallyBlocked.innerText = blockedCounts.locally;
      globallyBlocked.innerText = formatNumCount(blockedCounts.globally);
    }

    function pollBlockedCounts() {
      setTimeout(() => {
        queryBlockedCounts(tabId).then((newBlockedCounts) => {
          blockedCounts = newBlockedCounts;
          displayBlockedCounts();
          pollBlockedCounts();
        });
      }, updateTimeout);
    }

    checkbox.addEventListener("change", function () {
      chrome.runtime.send1wayMessage({
        message: "set-local-status",
        status: !isEnabledForTab,
        tabId,
      });
      isEnabledForTab = !isEnabledForTab;
      updateUi();
    });
    globalSwitch.addEventListener("click", function () {
      chrome.runtime.send1wayMessage({
        message: "set-global-status",
        status: !isGloballyEnabled,
      });
      isGloballyEnabled = !isGloballyEnabled;
      updateUi();
    }); // Inject the link to options page (cannot have static link in HTML, it is dynamic)

    document.getElementById("settings-link").href =
      chrome.runtime.getURL("options.html");
    updateUi();
    displayBlockedCounts(); // This is just to suppress transition temporarily, when the popup shows up.
    // See https://stackoverflow.com/questions/11131875/

    checkbox.classList.add("notransition");
    checkbox.offsetHeight;
    checkbox.classList.remove("notransition");
    pollBlockedCounts();
  }

  function formatNumCount(count$$1) {
    let unit = 1000,
      i = 0;
    if (count$$1 <= unit) return count$$1;

    while (count$$1 > unit) {
      i += 1;
      count$$1 = count$$1 / unit;
    }

    let pre = "kMGTPE".charAt(i - 1);

    if (count$$1 < 10) {
      count$$1.toFixed(1).slice(-1) === "0"
        ? (count$$1 = Math.floor(count$$1))
        : (count$$1 = count$$1.toFixed(1));
    } else {
      count$$1 = Math.floor(count$$1);
    }

    return count$$1 + pre;
  }

  function createHardWhitelistedNotification(text) {
    let p = document.createElement("p");
    p.className = "hashed-notification";
    p.innerText = text;
    return p;
  }
})();
