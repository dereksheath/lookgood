(function () {
  var CMS = window.LookgoodCMS;
  var lockScreen = document.getElementById("lockScreen");
  var appScreen = document.getElementById("appScreen");
  var passwordForm = document.getElementById("passwordForm");
  var passwordInput = document.getElementById("passwordInput");
  var lockError = document.getElementById("lockError");
  var tokenForm = document.getElementById("tokenForm");
  var tokenInput = document.getElementById("tokenInput");
  var tokenStatus = document.getElementById("tokenStatus");
  var postForm = document.getElementById("postForm");
  var typeInputs = document.querySelectorAll('input[name="postType"]');
  var galleryFields = document.getElementById("galleryFields");
  var statusBox = document.getElementById("statusBox");
  var publishBtn = document.getElementById("publishBtn");
  var gbTokenForm = document.getElementById("gbTokenForm");
  var gbTokenInput = document.getElementById("gbTokenInput");
  var gbTokenStatus = document.getElementById("gbTokenStatus");
  var gbList = document.getElementById("gbList");
  var gbListStatus = document.getElementById("gbListStatus");

  function show(el) {
    el.hidden = false;
  }
  function hide(el) {
    el.hidden = true;
  }

  function setStatus(kind, html) {
    statusBox.className = "status " + kind;
    statusBox.innerHTML = html;
    show(statusBox);
  }

  function clearStatus() {
    statusBox.className = "status";
    statusBox.innerHTML = "";
    hide(statusBox);
  }

  function isUnlocked() {
    try {
      return sessionStorage.getItem(CMS.UNLOCK_KEY) === "yes";
    } catch (e) {
      return false;
    }
  }

  function setUnlocked(yes) {
    try {
      if (yes) sessionStorage.setItem(CMS.UNLOCK_KEY, "yes");
      else sessionStorage.removeItem(CMS.UNLOCK_KEY);
    } catch (e) {}
  }

  function renderTokenStatus() {
    var token = CMS.getToken();
    if (token) {
      tokenStatus.textContent =
        "Token is saved in this browser only. You do not need to paste it again on this computer.";
      tokenStatus.className = "hint ok";
      tokenInput.value = "";
      tokenInput.placeholder = "Token saved — paste a new one only if you need to replace it";
    } else {
      tokenStatus.textContent = "No token saved yet. Paste it once below.";
      tokenStatus.className = "hint";
    }
  }

  function showApp() {
    hide(lockScreen);
    show(appScreen);
    renderTokenStatus();
    updateType();
    loadGuestbook();
  }

  function showLock() {
    hide(appScreen);
    show(lockScreen);
    passwordInput.value = "";
    lockError.hidden = true;
  }

  function updateType() {
    var type = document.querySelector('input[name="postType"]:checked').value;
    galleryFields.hidden = type !== "gallery";
    if (type === "gallery") {
      galleryFields.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function readFileBase64(file) {
    return file.arrayBuffer().then(function (buf) {
      return CMS.bytesToBase64(new Uint8Array(buf));
    });
  }

  passwordForm.addEventListener("submit", function (e) {
    e.preventDefault();
    lockError.hidden = true;
    CMS.passwordMatches(passwordInput.value).then(function (ok) {
      if (!ok) {
        lockError.hidden = false;
        lockError.textContent = "That password is not right.";
        return;
      }
      setUnlocked(true);
      passwordInput.value = "";
      showApp();
    });
  });

  document.getElementById("lockBtn").addEventListener("click", function () {
    setUnlocked(false);
    showLock();
  });

  tokenForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var token = tokenInput.value.trim();
    if (!token) {
      tokenStatus.textContent = "Paste a token first.";
      tokenStatus.className = "hint bad";
      return;
    }
    CMS.setToken(token);
    tokenInput.value = "";
    tokenStatus.textContent = "Checking the token with GitHub…";
    tokenStatus.className = "hint";
    CMS.checkToken(CMS.getToken())
      .then(function () {
        renderTokenStatus();
        tokenStatus.textContent =
          "Token saved in this browser. It was not sent to this chat or saved in the website files.";
        tokenStatus.className = "hint ok";
      })
      .catch(function (err) {
        tokenStatus.textContent =
          (err && err.message) ||
          "Saved in this browser, but GitHub did not accept it yet.";
        tokenStatus.className = "hint bad";
      });
  });

  document.getElementById("forgetTokenBtn").addEventListener("click", function () {
    CMS.clearToken();
    tokenInput.value = "";
    renderTokenStatus();
  });

  typeInputs.forEach(function (input) {
    input.addEventListener("change", updateType);
  });

  postForm.addEventListener("submit", function (e) {
    e.preventDefault();
    clearStatus();

    var type = document.querySelector('input[name="postType"]:checked').value;
    var title = document.getElementById("titleInput").value.trim();
    var intro = document.getElementById("introInput").value;
    var cover = document.getElementById("coverInput").files[0];
    var photos = Array.prototype.slice.call(
      document.getElementById("photosInput").files || []
    );
    var token = CMS.getToken();

    if (!token) {
      setStatus("bad", "Save your GitHub token first (step 1).");
      return;
    }
    if (!title) {
      setStatus("bad", "Please type a title.");
      return;
    }
    if (!cover) {
      setStatus("bad", "Please choose a cover picture.");
      return;
    }
    if (!CMS.isAllowedImageName(cover.name)) {
      setStatus("bad", "The cover picture needs to be a JPG or PNG file.");
      return;
    }
    if (type === "gallery") {
      if (!photos.length) {
        setStatus("bad", "A gallery needs at least one photo.");
        return;
      }
      for (var i = 0; i < photos.length; i++) {
        if (!CMS.isAllowedImageName(photos[i].name)) {
          setStatus(
            "bad",
            "Gallery photos need to be JPG or PNG. This one is not: " +
              photos[i].name
          );
          return;
        }
      }
    }

    var plan = CMS.planPost({
      type: type,
      title: title,
      intro: intro,
      coverName: cover.name,
      photoNames: photos.map(function (f) {
        return f.name;
      })
    });

    publishBtn.disabled = true;
    setStatus("busy", "Starting save…");

    var photoB64 = [];
    readFileBase64(cover)
      .then(function (coverB64) {
        function nextPhoto(idx) {
          if (idx >= photos.length) return Promise.resolve();
          setStatus(
            "busy",
            "Reading photo " + (idx + 1) + " of " + photos.length + "…"
          );
          return readFileBase64(photos[idx]).then(function (b64) {
            photoB64.push(b64);
            return nextPhoto(idx + 1);
          });
        }
        return nextPhoto(0).then(function () {
          var files = CMS.filesFromPlan(plan, coverB64, photoB64);
          return CMS.publishPlan({
            token: token,
            plan: plan,
            files: files,
            onProgress: function (msg) {
              setStatus("busy", msg);
            }
          });
        });
      })
      .then(function () {
        var extra =
          type === "gallery"
            ? " Thumbnails will be built automatically in a few minutes."
            : "";
        setStatus(
          "ok",
          "Saved. The public site usually updates in one or two minutes." +
            extra +
            '<br><a href="' +
            CMS.SITE_URL +
            '/" target="_blank" rel="noopener">Open the homepage</a>' +
            ' · <a href="' +
            plan.postUrl +
            '" target="_blank" rel="noopener">Open this post</a> (may 404 until the site finishes updating)'
        );
        postForm.reset();
        document.querySelector('input[name="postType"][value="announcement"]').checked = true;
        updateType();
      })
      .catch(function (err) {
        setStatus("bad", (err && err.message) || "Could not save the post.");
      })
      .then(function () {
        publishBtn.disabled = false;
      });
  });

  function loadGuestbook() {
    gbList.innerHTML = "";
    var token = CMS.getToken();
    if (!token) {
      gbListStatus.textContent = "Save your GitHub token in step 1 to see comments.";
      gbListStatus.className = "hint";
      return;
    }
    gbListStatus.textContent = "Loading comments…";
    gbListStatus.className = "hint";
    CMS.listGuestbookEntries(token)
      .then(function (entries) {
        gbList.innerHTML = "";
        if (!entries.length) {
          gbListStatus.textContent = "No guestbook comments right now.";
          gbListStatus.className = "hint";
          return;
        }
        gbListStatus.textContent = entries.length + " comment" + (entries.length === 1 ? "" : "s") + ".";
        gbListStatus.className = "hint";
        entries.sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        });
        entries.forEach(function (entry) {
          var item = document.createElement("div");
          item.className = "gbitem";

          var who = document.createElement("div");
          who.className = "who";
          who.textContent = entry.name || "(no name)";

          var when = document.createElement("div");
          when.className = "when";
          when.textContent = entry.date || "";

          var msg = document.createElement("div");
          msg.className = "msg";
          msg.textContent = entry.message || "";

          var del = document.createElement("button");
          del.type = "button";
          del.textContent = "Remove";
          del.addEventListener("click", function () {
            if (!window.confirm("Remove this comment from the website?")) return;
            del.disabled = true;
            CMS.deleteGuestbookEntry(CMS.getToken(), entry.path, entry.sha)
              .then(function () {
                loadGuestbook();
              })
              .catch(function (err) {
                del.disabled = false;
                gbListStatus.textContent =
                  (err && err.message) || "Could not remove that comment.";
                gbListStatus.className = "hint bad";
              });
          });

          item.appendChild(who);
          item.appendChild(when);
          item.appendChild(msg);
          item.appendChild(del);
          gbList.appendChild(item);
        });
      })
      .catch(function (err) {
        gbListStatus.textContent =
          (err && err.message) || "Could not load guestbook comments.";
        gbListStatus.className = "hint bad";
      });
  }

  document.getElementById("gbRefreshBtn").addEventListener("click", loadGuestbook);

  gbTokenForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var adminToken = CMS.getToken();
    var gbToken = gbTokenInput.value.trim();
    if (!adminToken) {
      gbTokenStatus.textContent = "Save your GitHub token in step 1 first.";
      gbTokenStatus.className = "hint bad";
      return;
    }
    if (!gbToken) {
      gbTokenStatus.textContent = "Paste the guestbook token first.";
      gbTokenStatus.className = "hint bad";
      return;
    }
    gbTokenStatus.textContent = "Checking that this token cannot edit website files…";
    gbTokenStatus.className = "hint";
    CMS.tokenCanReadFiles(gbToken)
      .then(function (canEdit) {
        if (canEdit) {
          throw new Error(
            "That token can edit website files. Make a different token that can only create issues, then try again."
          );
        }
        gbTokenStatus.textContent = "Saving the guestbook key to the website…";
        return CMS.saveGuestbookAuth(adminToken, gbToken);
      })
      .then(function () {
        gbTokenInput.value = "";
        gbTokenStatus.textContent =
          "Guestbook is on. Signatures should work after the site updates (about a minute).";
        gbTokenStatus.className = "hint ok";
      })
      .catch(function (err) {
        gbTokenStatus.textContent =
          (err && err.message) || "Could not turn on the guestbook.";
        gbTokenStatus.className = "hint bad";
      });
  });

  document.getElementById("gbTokenOffBtn").addEventListener("click", function () {
    var adminToken = CMS.getToken();
    if (!adminToken) {
      gbTokenStatus.textContent = "Save your GitHub token in step 1 first.";
      gbTokenStatus.className = "hint bad";
      return;
    }
    gbTokenStatus.textContent = "Turning the guestbook off…";
    gbTokenStatus.className = "hint";
    CMS.saveGuestbookAuth(adminToken, "")
      .then(function () {
        gbTokenInput.value = "";
        gbTokenStatus.textContent = "Guestbook is off. People cannot sign until you turn it on again.";
        gbTokenStatus.className = "hint ok";
      })
      .catch(function (err) {
        gbTokenStatus.textContent =
          (err && err.message) || "Could not turn off the guestbook.";
        gbTokenStatus.className = "hint bad";
      });
  });

  if (isUnlocked()) showApp();
  else showLock();
})();
