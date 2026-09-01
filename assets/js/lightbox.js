(function () {
  var SWIPE_MIN_PX = 50;
  var DRAG_MIN_PX = 10;

  // Horizontal swipe: left = next (+1), right = previous (-1).
  // Vertical / short / diagonal moves are ignored.
  function swipeDir(dx, dy, minPx) {
    minPx = minPx == null ? SWIPE_MIN_PX : minPx;
    if (!isFinite(dx) || !isFinite(dy)) return 0;
    if (Math.abs(dx) < minPx) return 0;
    if (Math.abs(dy) > Math.abs(dx)) return 0;
    return dx < 0 ? 1 : -1;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { swipeDir: swipeDir, SWIPE_MIN_PX: SWIPE_MIN_PX };
  }

  if (typeof document === "undefined") return;

  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var links = qa("a.lb");
  if (!links.length) return;

  // Group links by data-group
  var groups = {};
  links.forEach(function (a) {
    var g = a.getAttribute("data-group") || "default";
    (groups[g] = groups[g] || []).push(a);
  });

  // Build overlay
  var overlay = document.createElement("div");
  overlay.id = "lbOverlay";
  overlay.innerHTML =
    '<div id="lbFrame">' +
      '<a href="#" id="lbClose">×</a>' +
      '<a href="#" id="lbPrev">‹</a>' +
      '<img id="lbImg" src="" alt="">' +
      '<a href="#" id="lbNext">›</a>' +
      '<div id="lbCount"></div>' +
    "</div>";

  document.body.appendChild(overlay);

  var lbImg = q("#lbImg", overlay);
  var lbPrev = q("#lbPrev", overlay);
  var lbNext = q("#lbNext", overlay);
  var lbClose = q("#lbClose", overlay);
  var lbCount = q("#lbCount", overlay);

  var currentGroup = null;
  var currentIndex = 0;

  var touchStartX = 0;
  var touchStartY = 0;
  var trackingTouch = false;
  var dragging = false;
  var suppressClick = false;
  var suppressTimer = null;

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

  function resetImgOffset(animate) {
    lbImg.style.transition = animate ? "transform 0.15s ease-out" : "none";
    lbImg.style.transform = "";
  }

  function openAt(groupName, idx) {
    currentGroup = groupName;
    currentIndex = idx;

    var arr = groups[currentGroup] || [];
    var href = arr[currentIndex].getAttribute("href");

    lbImg.src = href;
    lbCount.innerHTML = (currentIndex + 1) + " / " + arr.length;
    resetImgOffset(false);

    overlay.style.display = "block";
    document.body.className += " lbNoScroll";
  }

  function close() {
    overlay.style.display = "none";
    lbImg.src = "";
    resetImgOffset(false);
    document.body.className = document.body.className.replace(/\blbNoScroll\b/g, "").trim();
  }

  function step(dir) {
    var arr = groups[currentGroup] || [];
    if (!arr.length) return;
    currentIndex = (currentIndex + dir + arr.length) % arr.length;
    openAt(currentGroup, currentIndex);
  }

  function isOpen() {
    return overlay.style.display === "block";
  }

  // Click handlers
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

  overlay.addEventListener("click", function (e) {
    if (consumeGhostClick(e)) return;
    // click outside image closes
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", function (e) {
    if (!isOpen()) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  lbImg.addEventListener("dragstart", function (e) {
    e.preventDefault();
  });

  overlay.addEventListener("touchstart", function (e) {
    if (!isOpen() || e.touches.length !== 1) return;
    trackingTouch = true;
    dragging = false;
    if (suppressTimer) {
      clearTimeout(suppressTimer);
      suppressTimer = null;
    }
    suppressClick = false;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    lbImg.style.transition = "none";
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
    }

    e.preventDefault();
    lbImg.style.transform = "translateX(" + dx + "px)";
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
      step(dir);
      return;
    }

    resetImgOffset(true);
  }

  overlay.addEventListener("touchend", function (e) {
    if (!e.changedTouches.length) return;
    finishTouch(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });

  overlay.addEventListener("touchcancel", function () {
    trackingTouch = false;
    dragging = false;
    resetImgOffset(true);
  });
})();
