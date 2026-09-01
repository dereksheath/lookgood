(function () {
  var SWIPE_MIN_PX = 50;
  var DRAG_MIN_PX = 10;
  var SLIDE_MS = 220;

  // Horizontal swipe: left = next (+1), right = previous (-1).
  // Vertical / short / diagonal moves are ignored.
  function swipeDir(dx, dy, minPx) {
    minPx = minPx == null ? SWIPE_MIN_PX : minPx;
    if (!isFinite(dx) || !isFinite(dy)) return 0;
    if (Math.abs(dx) < minPx) return 0;
    if (Math.abs(dy) > Math.abs(dx)) return 0;
    return dx < 0 ? 1 : -1;
  }

  function wrapIndex(i, n) {
    if (!n) return 0;
    return ((i % n) + n) % n;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      swipeDir: swipeDir,
      wrapIndex: wrapIndex,
      SWIPE_MIN_PX: SWIPE_MIN_PX
    };
  }

  if (typeof document === "undefined") return;

  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var links = qa("a.lb");
  if (!links.length) return;

  var groups = {};
  links.forEach(function (a) {
    var g = a.getAttribute("data-group") || "default";
    (groups[g] = groups[g] || []).push(a);
  });

  var overlay = document.createElement("div");
  overlay.id = "lbOverlay";
  overlay.innerHTML =
    '<div id="lbFrame">' +
      '<a href="#" id="lbClose" title="Close" aria-label="Close">×</a>' +
      '<div id="lbStage">' +
        '<div id="lbViewport">' +
          '<div id="lbTrack">' +
            '<div class="lbPane"><img class="lbSlide" id="lbSlidePrev" alt="" draggable="false"></div>' +
            '<div class="lbPane"><img class="lbSlide" id="lbSlideCur" alt="" draggable="false"></div>' +
            '<div class="lbPane"><img class="lbSlide" id="lbSlideNext" alt="" draggable="false"></div>' +
          "</div>" +
        "</div>" +
        '<a href="#" id="lbPrev">‹</a>' +
        '<a href="#" id="lbNext">›</a>' +
      "</div>" +
      '<a href="" id="lbDownload" download>Download this photo</a>' +
      '<div id="lbCount"></div>' +
    "</div>";

  document.body.appendChild(overlay);

  var lbViewport = q("#lbViewport", overlay);
  var lbTrack = q("#lbTrack", overlay);
  var slidePrev = q("#lbSlidePrev", overlay);
  var slideCur = q("#lbSlideCur", overlay);
  var slideNext = q("#lbSlideNext", overlay);
  var lbPrev = q("#lbPrev", overlay);
  var lbNext = q("#lbNext", overlay);
  var lbClose = q("#lbClose", overlay);
  var lbDownload = q("#lbDownload", overlay);
  var lbCount = q("#lbCount", overlay);
  var slides = [slidePrev, slideCur, slideNext];
  var panes = qa(".lbPane", overlay);

  function fileNameFromHref(href) {
    var name = String(href || "").split("?")[0].split("#")[0].split("/").pop();
    try { name = decodeURIComponent(name); } catch (e) {}
    return name || "image";
  }

  var currentGroup = null;
  var currentIndex = 0;
  var trackX = 0;
  var settling = false;
  var settleTimer = null;
  var settleFn = null;

  var touchStartX = 0;
  var touchStartY = 0;
  var trackingTouch = false;
  var dragging = false;
  var suppressClick = false;
  var suppressTimer = null;

  function groupArr() {
    return groups[currentGroup] || [];
  }

  function hrefAt(idx) {
    var arr = groupArr();
    if (!arr.length) return "";
    return arr[wrapIndex(idx, arr.length)].getAttribute("href") || "";
  }

  function vpWidth() {
    return lbViewport.clientWidth || overlay.clientWidth || window.innerWidth;
  }

  function restX() {
    return -vpWidth();
  }

  function setTrackX(x, animate) {
    trackX = x;
    lbTrack.style.transition = animate
      ? "transform " + SLIDE_MS + "ms ease-out"
      : "none";
    lbTrack.style.transform = "translate3d(" + x + "px,0,0)";
  }

  function layoutSlides() {
    var w = vpWidth();
    var i;
    for (i = 0; i < panes.length; i++) {
      panes[i].style.flex = "0 0 " + w + "px";
      panes[i].style.width = w + "px";
    }
  }

  function setSlideSrc(img, href) {
    if (!href) {
      img.removeAttribute("src");
      img.removeAttribute("data-src");
      return;
    }
    if (img.getAttribute("data-src") === href && img.getAttribute("src")) return;
    img.setAttribute("data-src", href);
    img.src = href;
  }

  function handoff(from, to) {
    var href = from.getAttribute("data-src") || "";
    var src = from.currentSrc || from.src;
    if (!href || !src) return;
    to.setAttribute("data-src", href);
    to.src = src;
  }

  function preloadHref(href) {
    if (!href) return;
    var img = new Image();
    img.decoding = "async";
    img.src = href;
  }

  function preloadAround() {
    var arr = groupArr();
    if (!arr.length) return;
    var offsets = [-2, -1, 0, 1, 2];
    var i;
    for (i = 0; i < offsets.length; i++) {
      preloadHref(hrefAt(currentIndex + offsets[i]));
    }
  }

  function applySlides() {
    setSlideSrc(slidePrev, hrefAt(currentIndex - 1));
    setSlideSrc(slideCur, hrefAt(currentIndex));
    setSlideSrc(slideNext, hrefAt(currentIndex + 1));
  }

  function updateMeta() {
    var arr = groupArr();
    var href = hrefAt(currentIndex);
    lbDownload.href = href;
    lbDownload.setAttribute("download", fileNameFromHref(href));
    lbCount.innerHTML = arr.length ? (currentIndex + 1) + " / " + arr.length : "";
  }

  function lockScroll() {
    if (!/\blbNoScroll\b/.test(document.body.className)) {
      document.body.className += " lbNoScroll";
    }
  }

  function suppressGhostClick() {
    suppressClick = true;
    if (suppressTimer) clearTimeout(suppressTimer);
    suppressTimer = setTimeout(function () {
      suppressClick = false;
      suppressTimer = null;
    }, 350);
  }

  function consumeGhostClick(e) {
    if (!suppressClick) return false;
    suppressClick = false;
    if (suppressTimer) {
      clearTimeout(suppressTimer);
      suppressTimer = null;
    }
    if (e) e.preventDefault();
    return true;
  }

  function finishSettle() {
    if (!settleFn) return;
    var fn = settleFn;
    settleFn = null;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    lbTrack.removeEventListener("transitionend", onTrackEnd);
    fn();
  }

  function onTrackEnd(e) {
    if (e.target !== lbTrack) return;
    finishSettle();
  }

  function animateTrack(toX, cb) {
    settleFn = cb;
    lbTrack.addEventListener("transitionend", onTrackEnd);
    setTrackX(toX, true);
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(finishSettle, SLIDE_MS + 80);
  }

  function snapRest() {
    layoutSlides();
    setTrackX(restX(), false);
  }

  function commitDir(dir) {
    var arr = groupArr();
    if (!dir || !arr.length) {
      settling = false;
      snapRest();
      return;
    }

    settling = true;
    var w = vpWidth();
    var target = dir > 0 ? -2 * w : 0;

    animateTrack(target, function () {
      currentIndex = wrapIndex(currentIndex + dir, arr.length);
      handoff(dir > 0 ? slideNext : slidePrev, slideCur);
      layoutSlides();
      setTrackX(restX(), false);
      setSlideSrc(slidePrev, hrefAt(currentIndex - 1));
      setSlideSrc(slideNext, hrefAt(currentIndex + 1));
      updateMeta();
      preloadAround();
      settling = false;
    });
  }

  function openAt(groupName, idx) {
    currentGroup = groupName;
    currentIndex = idx;
    settling = false;
    trackingTouch = false;
    dragging = false;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    settleFn = null;

    overlay.style.display = "block";
    lockScroll();
    applySlides();
    updateMeta();
    snapRest();
    preloadAround();
  }

  function close() {
    overlay.style.display = "none";
    settling = false;
    trackingTouch = false;
    dragging = false;
    setSlideSrc(slidePrev, "");
    setSlideSrc(slideCur, "");
    setSlideSrc(slideNext, "");
    lbDownload.href = "";
    document.body.className = document.body.className.replace(/\blbNoScroll\b/g, "").trim();
  }

  function step(dir) {
    if (!isOpen() || settling) return;
    layoutSlides();
    setTrackX(restX(), false);
    commitDir(dir);
  }

  function isOpen() {
    return overlay.style.display === "block";
  }

  function isControl(el) {
    return el === lbClose || el === lbPrev || el === lbNext || el === lbDownload;
  }

  Object.keys(groups).forEach(function (g) {
    groups[g].forEach(function (a, idx) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        openAt(g, idx);
      });
    });
  });

  lbPrev.addEventListener("click", function (e) {
    e.preventDefault();
    if (consumeGhostClick(e)) return;
    step(-1);
  });
  lbNext.addEventListener("click", function (e) {
    e.preventDefault();
    if (consumeGhostClick(e)) return;
    step(1);
  });
  lbClose.addEventListener("click", function (e) {
    e.preventDefault();
    if (consumeGhostClick(e)) return;
    close();
  });
  lbDownload.addEventListener("click", function (e) {
    e.stopPropagation();
    if (consumeGhostClick(e)) return;
  });

  overlay.addEventListener("click", function (e) {
    if (consumeGhostClick(e)) return;
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", function (e) {
    if (!isOpen()) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  slides.forEach(function (img) {
    img.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });
    img.addEventListener("contextmenu", function (e) {
      e.stopPropagation();
    });
  });

  overlay.addEventListener("touchstart", function (e) {
    if (!isOpen() || e.touches.length !== 1) return;

    if (suppressTimer) {
      clearTimeout(suppressTimer);
      suppressTimer = null;
    }
    suppressClick = false;

    if (settling || isControl(e.target)) return;

    trackingTouch = true;
    dragging = false;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    layoutSlides();
    setTrackX(restX(), false);
  }, { passive: true });

  overlay.addEventListener("touchmove", function (e) {
    if (!isOpen() || !trackingTouch || e.touches.length !== 1) return;

    var dx = e.touches[0].clientX - touchStartX;
    var dy = e.touches[0].clientY - touchStartY;

    if (!dragging) {
      if (Math.abs(dx) < DRAG_MIN_PX && Math.abs(dy) < DRAG_MIN_PX) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        trackingTouch = false;
        return;
      }
      dragging = true;
      suppressGhostClick();
      preloadHref(hrefAt(currentIndex + (dx < 0 ? 2 : -2)));
    }

    e.preventDefault();
    setTrackX(restX() + dx, false);
  }, { passive: false });

  function finishTouch(clientX, clientY) {
    if (!trackingTouch && !dragging) return;

    var dx = clientX - touchStartX;
    var dy = clientY - touchStartY;
    var dir = dragging ? swipeDir(dx, dy, SWIPE_MIN_PX) : 0;

    trackingTouch = false;
    dragging = false;

    if (dir) {
      suppressGhostClick();
      commitDir(dir);
      return;
    }

    settling = true;
    animateTrack(restX(), function () {
      settling = false;
    });
  }

  overlay.addEventListener("touchend", function (e) {
    if (!e.changedTouches.length) return;
    finishTouch(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });

  overlay.addEventListener("touchcancel", function () {
    trackingTouch = false;
    dragging = false;
    if (!isOpen()) return;
    settling = true;
    animateTrack(restX(), function () {
      settling = false;
    });
  });

  window.addEventListener("resize", function () {
    if (!isOpen() || dragging || settling) return;
    snapRest();
  });
})();
