(function () {
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var links = qa('a.lb');
  if (!links.length) return;

  // Group links by data-group
  var groups = {};
  links.forEach(function (a) {
    var g = a.getAttribute('data-group') || 'default';
    (groups[g] = groups[g] || []).push(a);
  });

  // Build overlay
  var overlay = document.createElement('div');
  overlay.id = 'lbOverlay';
  overlay.innerHTML =
    '<div id="lbFrame">' +
      '<a href="#" id="lbClose">×</a>' +
      '<a href="#" id="lbPrev">‹</a>' +
      '<img id="lbImg" src="" alt="">' +
      '<a href="#" id="lbNext">›</a>' +
      '<div id="lbCount"></div>' +
    '</div>';

  document.body.appendChild(overlay);

  var lbImg = q('#lbImg', overlay);
  var lbPrev = q('#lbPrev', overlay);
  var lbNext = q('#lbNext', overlay);
  var lbClose = q('#lbClose', overlay);
  var lbCount = q('#lbCount', overlay);

  var currentGroup = null;
  var currentIndex = 0;

  function openAt(groupName, idx) {
    currentGroup = groupName;
    currentIndex = idx;

    var arr = groups[currentGroup] || [];
    var href = arr[currentIndex].getAttribute('href');

    lbImg.src = href;
    lbCount.innerHTML = (currentIndex + 1) + ' / ' + arr.length;

    overlay.style.display = 'block';
    document.body.className += ' lbNoScroll';
  }

  function close() {
    overlay.style.display = 'none';
    lbImg.src = '';
    document.body.className = document.body.className.replace(/\blbNoScroll\b/g, '').trim();
  }

  function step(dir) {
    var arr = groups[currentGroup] || [];
    if (!arr.length) return;
    currentIndex = (currentIndex + dir + arr.length) % arr.length;
    openAt(currentGroup, currentIndex);
  }

  // Click handlers
  Object.keys(groups).forEach(function (g) {
    groups[g].forEach(function (a, idx) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        openAt(g, idx);
      });
    });
  });

  lbPrev.addEventListener('click', function (e) { e.preventDefault(); step(-1); });
  lbNext.addEventListener('click', function (e) { e.preventDefault(); step(1); });
  lbClose.addEventListener('click', function (e) { e.preventDefault(); close(); });

  overlay.addEventListener('click', function (e) {
    // click outside image closes
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', function (e) {
    if (overlay.style.display !== 'block') return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
})();
