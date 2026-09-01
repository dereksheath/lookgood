(function () {
  // Keep the Mixcloud iframe mounted: internal links swap #content only.
  function locFrom(href, baseHref) {
    try {
      return new URL(href, baseHref);
    } catch (e) {
      return null;
    }
  }

  function isSpecialHref(href) {
    if (!href || href.charAt(0) === "#") return true;
    return /^(mailto:|javascript:|tel:)/i.test(href);
  }

  function isAdminPath(pathname) {
    return pathname === "/admin" || pathname.indexOf("/admin/") === 0;
  }

  function isAssetPath(pathname) {
    return /\.(png|jpe?g|gif|webp|svg|mp3|mp4|pdf|zip)$/i.test(pathname);
  }

  function isInternalHref(href, loc) {
    if (isSpecialHref(href)) return false;
    var u = locFrom(href, loc.href);
    if (!u) return false;
    if (u.origin !== loc.origin) return false;
    if (isAdminPath(u.pathname)) return false;
    if (isAssetPath(u.pathname)) return false;
    return true;
  }

  function isSamePageHref(href, loc) {
    var u = locFrom(href, loc.href);
    if (!u) return false;
    return u.origin === loc.origin && u.pathname === loc.pathname && u.search === loc.search;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      isSpecialHref: isSpecialHref,
      isAdminPath: isAdminPath,
      isAssetPath: isAssetPath,
      isInternalHref: isInternalHref,
      isSamePageHref: isSamePageHref
    };
  }

  if (typeof document === "undefined") return;

  var inflight = null;

  function hasClass(el, name) {
    return el && new RegExp("\\b" + name + "\\b").test(el.className || "");
  }

  function addClass(el, name) {
    if (!el || hasClass(el, name)) return;
    el.className = (el.className ? el.className + " " : "") + name;
  }

  function removeClass(el, name) {
    if (!el) return;
    el.className = (el.className || "").replace(new RegExp("\\b" + name + "\\b", "g"), " ").replace(/\s+/g, " ").trim();
  }

  function closestAnchor(el) {
    while (el && el.nodeType === 1) {
      if (el.tagName === "A") return el;
      el = el.parentElement;
    }
    return null;
  }

  function runScripts(root) {
    if (!root) return Promise.resolve();
    var scripts = Array.prototype.slice.call(root.querySelectorAll("script"));

    function next(i) {
      if (i >= scripts.length) return Promise.resolve();
      var old = scripts[i];
      if (!old || !old.parentNode) return next(i + 1);

      var s = document.createElement("script");
      var attrs = old.attributes || [];
      var j;
      for (j = 0; j < attrs.length; j++) {
        s.setAttribute(attrs[j].name, attrs[j].value);
      }
      if (!old.src) s.text = old.textContent;

      return new Promise(function (resolve) {
        if (old.src) {
          s.onload = s.onerror = function () { resolve(); };
          old.parentNode.replaceChild(s, old);
        } else {
          old.parentNode.replaceChild(s, old);
          resolve();
        }
      }).then(function () {
        return next(i + 1);
      });
    }

    return next(0);
  }

  function updateActiveNav() {
    var path = location.pathname;
    var links = document.querySelectorAll("#sidebar a.h");
    var i;
    for (i = 0; i < links.length; i++) {
      var hrefPath = locFrom(links[i].href, location.href);
      if (!hrefPath) continue;
      var active = hrefPath.pathname === path;
      if (active) addClass(links[i], "is-active");
      else removeClass(links[i], "is-active");
    }
  }

  function visit(href, push) {
    var u = locFrom(href, location.href);
    if (!u) {
      location.href = href;
      return;
    }

    if (inflight) inflight.abort();
    inflight = typeof AbortController === "function" ? new AbortController() : null;

    var content = document.getElementById("content");
    addClass(content, "is-loading");

    var opts = { credentials: "same-origin", headers: { Accept: "text/html" } };
    if (inflight) opts.signal = inflight.signal;

    fetch(u.href, opts)
      .then(function (res) {
        if (!res.ok && res.status !== 404) throw new Error("bad status");
        var ct = res.headers.get("Content-Type") || "";
        if (ct && ct.indexOf("text/html") === -1) throw new Error("not html");
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var next = doc.getElementById("content");
        var cur = document.getElementById("content");
        if (!next || !cur) throw new Error("no content");

        document.dispatchEvent(new Event("lookgood:navigate"));
        if (push) history.pushState({ persistNav: true }, "", u.href);
        document.title = doc.title || document.title;
        cur.replaceWith(next);
        return runScripts(document.getElementById("content")).then(function () {
          updateActiveNav();
          if (u.hash) {
            var id = decodeURIComponent(u.hash.replace(/^#/, ""));
            var el = id ? document.getElementById(id) : null;
            if (el && el.scrollIntoView) el.scrollIntoView();
            else window.scrollTo(0, 0);
          } else {
            window.scrollTo(0, 0);
          }
        });
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return;
        if (err && err.message === "not html") return;
        location.href = u.href;
      })
      .then(function () {
        removeClass(document.getElementById("content"), "is-loading");
      });
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = closestAnchor(e.target);
    if (!a) return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download")) return;
    if (hasClass(a, "lb")) return;

    var href = a.getAttribute("href");
    if (!isInternalHref(href, location)) return;

    if (isSamePageHref(href, location)) {
      var same = locFrom(href, location.href);
      if (same && !same.hash) {
        e.preventDefault();
        window.scrollTo(0, 0);
      }
      return;
    }

    if (typeof fetch !== "function" || typeof DOMParser !== "function") return;

    e.preventDefault();
    visit(a.href, true);
  });

  window.addEventListener("popstate", function () {
    visit(location.href, false);
  });
})();
