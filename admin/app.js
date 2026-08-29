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
  var newPostFields = document.getElementById("newPostFields");
  var appendFields = document.getElementById("appendFields");
  var galleryFields = document.getElementById("galleryFields");
  var gallerySelect = document.getElementById("gallerySelect");
  var gallerySelectHint = document.getElementById("gallerySelectHint");
  var photosInput = document.getElementById("photosInput");
  var photosCountHint = document.getElementById("photosCountHint");
  var typeHint = document.getElementById("typeHint");
  var statusBox = document.getElementById("statusBox");
  var publishBtn = document.getElementById("publishBtn");
  var gbList = document.getElementById("gbList");
  var gbListStatus = document.getElementById("gbListStatus");
  var galleriesCache = [];
  var selectedNextIndex = 1;

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

  function currentType() {
    var el = document.querySelector('input[name="postType"]:checked');
    return el ? el.value : "announcement";
  }

  function updateType() {
    var type = currentType();
    var isGallery = type === "gallery";
    var isAppend = type === "append";
    newPostFields.hidden = isAppend;
    appendFields.hidden = !isAppend;
    galleryFields.hidden = !isGallery && !isAppend;
    publishBtn.textContent = isAppend
      ? "Add photos to this gallery"
      : "Publish to the website";
    if (isAppend) {
      typeHint.textContent =
        "Use this after a gallery is already on the site. Publish a batch, then come back and add more pictures to the same gallery. Existing photos stay put.";
      loadGalleries();
      appendFields.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else if (isGallery) {
      typeHint.textContent =
        "A new gallery needs a title, cover picture, and photos. If you have hundreds of pictures, publish a first batch here, then use “Add photos to a gallery” for the rest.";
      galleryFields.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      typeHint.textContent =
        "Announcement = title, text, and a cover picture. It does not get a photo folder.";
    }
    updatePhotosHint();
  }

  function updatePhotosHint() {
    var n = (photosInput.files || []).length;
    var base =
      "These are saved as full-size photos. The site’s usual thumbnail helper will make 320px thumbs after they are saved. About 50 to 100 photos at a time is a safe batch if a huge upload fails.";
    if (!n) {
      photosCountHint.textContent = base;
      return;
    }
    photosCountHint.textContent =
      n +
      " photo" +
      (n === 1 ? "" : "s") +
      " selected. " +
      (n > 100
        ? "That is a large batch. If GitHub errors, publish a smaller set, then add the rest to this same gallery."
        : base);
  }

  function setGallerySelectPlaceholder(text) {
    gallerySelect.innerHTML = "";
    var opt = document.createElement("option");
    opt.value = "";
    opt.textContent = text;
    gallerySelect.appendChild(opt);
  }

  function loadGalleries() {
    var token = CMS.getToken();
    var previous = gallerySelect.value;
    gallerySelectHint.className = "hint";
    gallerySelectHint.textContent =
      "Choose the gallery you already published. New pictures are added to that same folder; they do not replace the ones already there.";
    selectedNextIndex = 1;
    if (!token) {
      galleriesCache = [];
      setGallerySelectPlaceholder("Save your GitHub token first");
      return Promise.resolve();
    }
    setGallerySelectPlaceholder("Loading galleries…");
    return CMS.listGalleryPosts(token)
      .then(function (posts) {
        galleriesCache = posts || [];
        setGallerySelectPlaceholder(
          galleriesCache.length
            ? "Choose a gallery…"
            : "No galleries yet — publish a new gallery first"
        );
        galleriesCache.forEach(function (post) {
          var opt = document.createElement("option");
          opt.value = post.markdownPath;
          opt.textContent = post.title;
          gallerySelect.appendChild(opt);
        });
        if (
          previous &&
          galleriesCache.some(function (p) {
            return p.markdownPath === previous;
          })
        ) {
          gallerySelect.value = previous;
          return refreshSelectedGallery();
        }
      })
      .catch(function (err) {
        galleriesCache = [];
        setGallerySelectPlaceholder("Could not load galleries");
        gallerySelectHint.textContent =
          (err && err.message) || "Could not load galleries.";
        gallerySelectHint.className = "hint bad";
      });
  }

  function selectedGallery() {
    var path = gallerySelect.value;
    for (var i = 0; i < galleriesCache.length; i++) {
      if (galleriesCache[i].markdownPath === path) return galleriesCache[i];
    }
    return null;
  }

  function refreshSelectedGallery() {
    var post = selectedGallery();
    gallerySelectHint.className = "hint";
    selectedNextIndex = 1;
    if (!post) {
      gallerySelectHint.textContent =
        "Choose the gallery you already published. New pictures are added to that same folder; they do not replace the ones already there.";
      return Promise.resolve();
    }
    gallerySelectHint.textContent =
      "Checking how many photos are already in this gallery…";
    return CMS.listGalleryPhotoNames(CMS.getToken(), post.galleryDir)
      .then(function (names) {
        var imageNames = (names || []).filter(function (n) {
          return CMS.isAllowedImageName(n);
        });
        selectedNextIndex = CMS.nextPhotoNumber(names);
        if (!imageNames.length) {
          gallerySelectHint.textContent =
            "This gallery does not have photos yet. New pictures will start at 001.";
          return;
        }
        gallerySelectHint.textContent =
          "This gallery already has " +
          imageNames.length +
          " photo" +
          (imageNames.length === 1 ? "" : "s") +
          ". New pictures will be numbered starting at " +
          CMS.pad3(selectedNextIndex) +
          ".";
      })
      .catch(function (err) {
        selectedNextIndex = 1;
        gallerySelectHint.textContent =
          (err && err.message) || "Could not read that gallery’s photos.";
        gallerySelectHint.className = "hint bad";
      });
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
        if (currentType() === "append") loadGalleries();
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

  gallerySelect.addEventListener("change", refreshSelectedGallery);
  photosInput.addEventListener("change", updatePhotosHint);

  postForm.addEventListener("submit", function (e) {
    e.preventDefault();
    clearStatus();

    var type = currentType();
    var title = document.getElementById("titleInput").value.trim();
    var intro = document.getElementById("introInput").value;
    var cover = document.getElementById("coverInput").files[0];
    var photos = Array.prototype.slice.call(photosInput.files || []);
    var token = CMS.getToken();
    var gallery = selectedGallery();

    if (!token) {
      setStatus("bad", "Save your GitHub token first (step 1).");
      return;
    }

    function photosAreValid() {
      if (!photos.length) {
        setStatus(
          "bad",
          type === "append"
            ? "Choose at least one photo to add."
            : "A gallery needs at least one photo."
        );
        return false;
      }
      for (var i = 0; i < photos.length; i++) {
        if (!CMS.isAllowedImageName(photos[i].name)) {
          setStatus(
            "bad",
            "Gallery photos need to be JPG or PNG. This one is not: " +
              photos[i].name
          );
          return false;
        }
      }
      return true;
    }

    function filesForPlan(plan) {
      var files = [];
      if (plan.markdownPath && plan.markdown) {
        files.push({
          path: plan.markdownPath,
          content: CMS.textToBase64(plan.markdown)
        });
      }
      if (plan.coverPath && cover) {
        files.push({
          path: plan.coverPath,
          read: function () {
            return readFileBase64(cover);
          }
        });
      }
      (plan.photoPaths || []).forEach(function (path, idx) {
        files.push({
          path: path,
          read: function () {
            return readFileBase64(photos[idx]);
          }
        });
      });
      return files;
    }

    function publish(plan) {
      publishBtn.disabled = true;
      setStatus("busy", "Starting save…");
      return CMS.publishPlan({
        token: token,
        plan: plan,
        files: filesForPlan(plan),
        onProgress: function (msg) {
          setStatus("busy", msg);
        }
      }).then(function () {
        return plan;
      });
    }

    var ready;
    if (type === "append") {
      if (!gallery) {
        setStatus("bad", "Choose the gallery you want to add photos to.");
        return;
      }
      if (!photosAreValid()) return;
      publishBtn.disabled = true;
      setStatus("busy", "Checking how many photos are already in this gallery…");
      ready = CMS.listGalleryPhotoNames(token, gallery.galleryDir).then(
        function (names) {
          selectedNextIndex = CMS.nextPhotoNumber(names);
          return publish(
            CMS.planAppendPhotos({
              title: gallery.title,
              galleryDir: gallery.galleryDir,
              markdownPath: gallery.markdownPath,
              postUrl: gallery.postUrl,
              startIndex: selectedNextIndex,
              photoNames: photos.map(function (f) {
                return f.name;
              })
            })
          );
        }
      );
    } else {
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
      if (type === "gallery" && !photosAreValid()) return;
      ready = publish(
        CMS.planPost({
          type: type,
          title: title,
          intro: intro,
          coverName: cover.name,
          photoNames: photos.map(function (f) {
            return f.name;
          })
        })
      );
    }

    ready
      .then(function (plan) {
        var extra =
          type === "gallery" || type === "append"
            ? " Thumbnails will be built automatically in a few minutes."
            : "";
        var more =
          type === "gallery"
            ? " You can add more pictures to this same gallery with “Add photos to a gallery”."
            : type === "append"
              ? " You can add another batch to this same gallery without making a new post."
              : "";
        setStatus(
          "ok",
          "Saved. The public site usually updates in one or two minutes." +
            extra +
            more +
            '<br><a href="' +
            CMS.SITE_URL +
            '/" target="_blank" rel="noopener">Open the homepage</a>' +
            ' · <a href="' +
            plan.postUrl +
            '" target="_blank" rel="noopener">Open this post</a> (may 404 until the site finishes updating)'
        );
        if (type === "append") {
          photosInput.value = "";
          updatePhotosHint();
          return refreshSelectedGallery();
        }
        postForm.reset();
        document.querySelector(
          'input[name="postType"][value="announcement"]'
        ).checked = true;
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

  if (isUnlocked()) showApp();
  else showLock();
})();
