(function () {
  "use strict";

  /** @module General-purpose utilities
   *
   * Most of these functions/types should be placed somewhere in more appropriate location.
   */
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
  function* chain(...Xs) {
    for (let X of Xs) {
      yield* X;
    }
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

  function compileChain(chain$$1) {
    let pipeline = [],
      link = chain$$1;

    while (link) {
      pipeline.push(compileLink(link));
      link = link.next;
    }

    return combinePipeline(pipeline);
  }

  function compileLink(link) {
    if (link.type === "upward") {
      return (elts) =>
        !elts || !elts.length
          ? []
          : elts.map((elt) => compileUpwardFilter(elt, link));
    }

    if (link.type === "xpath") {
      return (elts) => compileXpathFilter(elts, link);
    }

    if (link.type === "nth-ancestor") {
      return (elts) =>
        !!elts.length
          ? elts.map((elt) => searchResultNodes(elt, link.pseudoClassArg))
          : [];
    }

    if (link.type === "deepener") {
      return compileDeepener(link);
    }

    if (link.type === "filter") {
      let combinedFilter = andFuncs(link.filters.map(compileFilter));
      return (elts) => elts.filter(combinedFilter);
    }

    if (link.type === "merger") {
      return compileMerger(link);
    }
  }

  function compileXpathFilter(elts, link) {
    if (!elts || (!elts.length && !link.specific)) {
      elts = [document];
    } else {
      return [];
    }

    let pseudoParent = [];
    elts.forEach((elt) => {
      let pseudo = searchResultNodes(elt, link.pseudoClassArg);
      if (pseudo) pseudoParent.push(pseudo);
    });
    return pseudoParent;
  }

  function compileDeepener(deepener) {
    if (deepener.selector) {
      return (elts) =>
        merge(elts.map((elt) => elt.querySelectorAll(deepener.selector)));
    } else if (deepener.combinator === "+") {
      return (elts) =>
        Array.from(elts, (elt) => elt.nextElementSibling).filter(
          (elt) => elt !== null
        );
    } else {
      function followingSiblings(elt) {
        let siblings = Array.from(elt.parentElement.children);
        let myindex = siblings.indexOf(elt);
        return siblings.slice(myindex + 1);
      }

      return (elts) => merge(elts.map(followingSiblings));
    }
  }

  function compileFilter(filter) {
    if (filter.type === "matches-selector") {
      return (elt) => elt.matches(filter.selector);
    }

    if (filter.type === "upward") {
      return compileUpwardFilter(filter);
    }

    if (filter.type === "xpath") {
      return searchResultNodes(filter.pseudoClassArg);
    }

    if (filter.type === "nth-ancestor") {
      return searchResultNodes(filter.pseudoClassArg);
    }

    if (filter.type === "contains") {
      return compileContainsFilter(filter.what);
    }

    if (filter.type === "matches-css") {
      return compileMatchesCssFilter(filter.props, filter.pseudoElt);
    }

    let fnchain = compileChain(filter.chain);

    if (filter.type === "has") {
      return (elt) => fnchain([elt]).length > 0;
    } else {
      return (elt) => fnchain([elt]).length === 0;
    }
  }

  function compileContainsFilter(what) {
    if ("text" in what) {
      return (elt) => elt.textContent.includes(what.text);
    } else {
      let regex = new RegExp(what.regex, what.regexModifiers);
      return (elt) => regex.test(elt.textContent);
    }
  }

  function searchResultNodes(node, pseudoClassArg) {
    let xpathResult = document.evaluate(
      pseudoClassArg,
      node,
      null,
      XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
      null
    );
    let iNode; // eslint-disable-next-line no-cond-assign

    let parent;

    while ((iNode = xpathResult.iterateNext())) {
      parent = iNode;
    }

    return parent;
  }

  function compileUpwardFilter(elt, link) {
    let { selectorText, pseudoClassArg } = link;

    if (Number.isInteger(+selectorText)) {
      return searchResultNodes(elt, pseudoClassArg);
    } else {
      if (pseudoClassArg !== "") {
        let parentNode = elt.parentElement;

        if (parentNode === null) {
          return elt;
        }

        let closestParent = elt.closest(pseudoClassArg);

        if (closestParent === null) {
          return elt;
        }

        return closestParent;
      } else {
        return elt;
      }
    }
  }

  function compileMatchesCssFilter(props, pseudoElt) {
    function make1propMatcher([prop, value]) {
      if ("text" in value) {
        return (computedStyle) => computedStyle[prop] === value.text;
      } else {
        let regex = new RegExp(value.regex, value.regexModifiers);
        return (computedStyle) => regex.test(computedStyle[prop]);
      }
    }

    let propMatcher = andFuncs(Object.entries(props).map(make1propMatcher));
    return (elt) => propMatcher(window.getComputedStyle(elt, pseudoElt));
  }

  function compileMerger(link) {
    if (link.chains.length === 1) {
      return compileChain(link.chains[0]);
    }

    let fnchains = link.chains.map(compileChain);
    return (elts) => merge(fnchains.map((fnchain) => fnchain(elts)));
  }

  function merge(collections) {
    let set = new Set();

    for (let collection of collections) {
      for (let elt of collection) {
        set.add(elt);
      }
    }

    return Array.from(set);
  }

  function andFuncs(funcs) {
    if (funcs.length === 0) {
      return () => true;
    }

    if (funcs.length === 1) {
      return funcs[0];
    }

    return function () {
      for (let func of funcs) {
        if (!func.apply(this, arguments)) {
          return false;
        }
      }

      return true;
    };
  }
  /**
   *  Pipeline is an array of funcs: [element] => [element].
   *  Make a single function -- a composition of all the functions in the pipeline.
   */

  function combinePipeline(pipeline) {
    if (pipeline.length === 0) {
      return (elts) => elts;
    }

    if (pipeline.length === 1) {
      return pipeline[0];
    }

    return function (elts) {
      for (let fn of pipeline) {
        elts = fn(elts);
      }

      return elts;
    };
  }

  function makeRule(chain$$1, styleObj) {
    return {
      fnchain: compileChain(chain$$1),
      styleObj: styleObj,
    };
  }

  class CallbackScheduler {
    constructor(callback, interval) {
      this.callback = callback;
      this.interval = interval;
      this.timeoutId = null;
      this.lastRun = performance.now();
    }

    request() {
      if (this.timeoutId !== null) {
        return;
      }

      let now = performance.now(),
        elapsed = now - this.lastRun,
        interval = Math.max(this.interval - (now - elapsed), 0);
      this.timeoutId = window.setTimeout(this.onTimeout.bind(this), interval);
    }

    onTimeout() {
      this.lastRun = performance.now();
      this.timeoutId = null;
      this.callback();
    }
  }

  const REAPPLY_RULES_INTERVAL = 200;
  let rules = [];
  let processedElts = new Map(); // Map([element, ProcessedElement])

  let mutationObserver = null;
  let scheduler = new CallbackScheduler(applyRules, REAPPLY_RULES_INTERVAL);
  /**
   * Main entry point. Called just once on a page to initialize this CSS4 machinery.
   */

  function initialize(css4Rules) {
    if (css4Rules.length === 0) {
      return;
    }

    for (let { chain: chain$$1, styleObj } of css4Rules) {
      rules.push(makeRule(chain$$1, styleObj));
    }

    mutationObserver = new MutationObserver(onMutation);

    if (document.readyState === "complete") {
      applyRules();
    } else {
      document.addEventListener("readystatechange", (e) => {
        if (e.target.readyState !== "loading") {
          applyRules();
        }
      });
    }
  }

  function onMutation(mrecords) {
    if (mrecords.length === 0) {
      return;
    }

    scheduler.request();
  }

  class ProcessedElement {
    constructor(elt) {
      this.elt = elt;
      this.rules = [];
      this.cssTextBeforeUs = "";
    }

    apply() {
      this.cssTextBeforeUs = this.elt.style.cssText;

      if (this.rules.some((rule) => rule.styleObj["remove"] === "true")) {
        if (this.elt.parentNode) {
          this.elt.remove();
        }

        return true;
      }

      for (let rule of this.rules) {
        for (let [prop, value] of Object.entries(rule.styleObj)) {
          this.elt.style.setProperty(prop, value);
        }
      }

      return false;
    }

    unapply() {
      this.elt.style.cssText = this.cssTextBeforeUs;
    }
  }

  function applyRules() {
    let before = performance.now();
    mutationObserver.disconnect();
    let newProcessedElts = new Map();

    for (let rule of rules) {
      let elts = rule.fnchain([window.document]);
      if (!elts) continue;

      for (let elt of elts) {
        let pElt = newProcessedElts.get(elt);

        if (!pElt) {
          pElt = new ProcessedElement(elt);
          newProcessedElts.set(elt, pElt);
        }

        pElt.rules.push(rule);
      }
    } // Now compare processedElts and newProcessedElts: unapply, apply or unapply then apply

    let removed = [];

    for (let elt of chain(processedElts.keys(), newProcessedElts.keys())) {
      let pElt = processedElts.get(elt),
        newpElt = newProcessedElts.get(elt);
      let remove = false;

      if (pElt && !newpElt) {
        pElt.unapply();
      } else if (!pElt && newpElt) {
        remove = newpElt.apply();
      } else if (!areArraysDeepEqual(pElt.rules, newpElt.rules)) {
        pElt.unapply();
        remove = newpElt.apply();
      }

      if (remove) {
        removed.push(elt);
      }
    }

    for (let elt of removed) {
      newProcessedElts.delete(elt);
    }

    processedElts = newProcessedElts;
    mutationObserver.observe(window.document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "class"],
    });
  }

  function areArraysDeepEqual(ar1, ar2) {
    if (ar1.length !== ar2.length) {
      return false;
    }

    for (let i = 0; i < ar1.length; i += 1) {
      if (ar1[i] !== ar2[i]) {
        return false;
      }
    }

    return true;
  }

  function insertScripts(jsArray) {
    jsArray.forEach((js) => {
      let script = makeScript(js);
      (document.head || document.documentElement).appendChild(script);
      removeScript(script);
    });
  }

  function makeScript(scriptString) {
    let code = document.createElement("script");
    code.setAttribute("type", "text/javascript");
    code.textContent = scriptString;
    return code;
  }

  function removeScript(script) {
    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }

    script.textContent = "";
  }

  chrome.runtime.onMessage.addListener(onMessage);

  function onMessage(request, sender) {
    switch (request.message) {
      case "blocked-iframe":
        {
          for (let iframe of document.getElementsByTagName("iframe")) {
            if (iframe.src === request.url) {
              iframe.style.display = "none";
            }
          }
        }
        return;
    }
  }

  run(function () {
    chrome.runtime.sendMessage(
      {
        message: "content-script",
      },
      function (resp) {
        if (resp.scripts) {
          insertScripts(resp.scripts);
        }

        if (resp.css4Rules) {
          initialize(resp.css4Rules);
        }
      }
    );
  });
})();
