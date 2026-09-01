/* Private posting helper for lookgood.party
   GitHub tokens and passwords are never written to the repo. */
(function (global) {
  var CMS = {};

  CMS.REPO_OWNER = "dereksheath";
  CMS.REPO_NAME = "lookgood";
  CMS.BRANCH = "main";
  CMS.SITE_URL = "https://lookgood.party";
  CMS.TIMEZONE = "America/Los_Angeles";

  CMS.TOKEN_KEY = "lookgood_github_token";
  CMS.UNLOCK_KEY = "lookgood_admin_unlock";

  /* sha256("lookgood.party:" + password). Password is not stored in this file. */
  CMS.PASSWORD_HASH =
    "b9604090647e4418a867a3cace2ba2689cbbeab3006fc44a147e8347b0b21411";

  CMS.ALLOWED_IMAGE_EXT = { jpg: true, jpeg: true, png: true };

  CMS.slugify = function (title) {
    var slug = String(title || "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug.length > 60) slug = slug.slice(0, 60).replace(/-+$/g, "");
    return slug || "post";
  };

  CMS.todayStamp = function (now) {
    var d = now || new Date();
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: CMS.TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return fmt.format(d);
  };

  CMS.extOf = function (filename) {
    var m = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  };

  CMS.isAllowedImageName = function (filename) {
    return !!CMS.ALLOWED_IMAGE_EXT[CMS.extOf(filename)];
  };

  CMS.yamlQuote = function (value) {
    return (
      '"' +
      String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\r\n/g, "\n")
        .replace(/\n/g, " ") +
      '"'
    );
  };

  CMS.pad3 = function (n) {
    var s = String(n);
    while (s.length < 3) s = "0" + s;
    return s;
  };

  CMS.isSafeGalleryDir = function (dir) {
    return /^[a-z0-9][a-z0-9_-]{0,80}$/i.test(String(dir || ""));
  };

  CMS.photoPathsFor = function (galleryDir, photoNames, startIndex) {
    var start = startIndex || 1;
    var names = photoNames || [];
    var paths = [];
    for (var i = 0; i < names.length; i++) {
      var ext = CMS.extOf(names[i]) || "jpg";
      paths.push(
        "img/" + galleryDir + "/full/" + CMS.pad3(start + i) + "." + ext
      );
    }
    return paths;
  };

  CMS.nextPhotoNumber = function (names) {
    var max = 0;
    (names || []).forEach(function (name) {
      var m = String(name || "").match(/^(\d+)\./);
      if (!m) return;
      var n = parseInt(m[1], 10);
      if (n > max) max = n;
    });
    return max + 1;
  };

  CMS.postUrlFromPath = function (markdownPath) {
    var m = String(markdownPath || "").match(
      /_posts\/(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/i
    );
    if (!m) return CMS.SITE_URL + "/";
    return CMS.SITE_URL + "/" + m[1] + "/" + m[2] + "/" + m[3] + "/" + m[4] + "/";
  };

  CMS.parsePostFrontMatter = function (text) {
    var raw = String(text || "").replace(/\r\n/g, "\n");
    var m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return {};
    function field(key) {
      var quoted = m[1].match(
        new RegExp("^" + key + ':\\s*"([\\s\\S]*?)"\\s*$', "m")
      );
      if (quoted) return quoted[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      var plain = m[1].match(new RegExp("^" + key + ":\\s*(.*)$", "m"));
      return plain ? plain[1].trim() : "";
    }
    var galleryDir = field("gallery_dir");
    return {
      title: field("title"),
      intro: field("intro"),
      galleryDir: galleryDir || null,
      feedImage: field("feed_image")
    };
  };

  CMS.buildMarkdown = function (opts) {
    var lines = ["---", "title: " + CMS.yamlQuote(opts.title)];

    if (opts.intro && String(opts.intro).trim()) {
      lines.push("intro: " + CMS.yamlQuote(opts.intro.trim()));
    }

    lines.push("");
    lines.push("feed_image: " + CMS.yamlQuote(opts.feedImage));

    if (opts.type === "gallery") {
      lines.push("");
      lines.push("gallery_dir: " + CMS.yamlQuote(opts.galleryDir));
    }

    lines.push("---");
    lines.push("");
    return lines.join("\n");
  };

  CMS.planPost = function (opts) {
    var title = String(opts.title || "").trim();
    var date = opts.date || CMS.todayStamp();
    var slug = CMS.slugify(title);
    var type = opts.type === "gallery" ? "gallery" : "announcement";
    var coverName = opts.coverName || "cover.jpg";
    var coverExt = CMS.extOf(coverName) || "jpg";
    var galleryDir = type === "gallery" ? slug : null;
    var coverPath = "img/headers/" + date + "-" + slug + "." + coverExt;
    var feedImage = "/" + coverPath;
    var markdownPath = "_posts/" + date + "-" + slug + ".md";
    var photoNames = opts.photoNames || [];
    var photoPaths =
      type === "gallery"
        ? CMS.photoPathsFor(galleryDir, photoNames, 1)
        : [];

    var markdown = CMS.buildMarkdown({
      type: type,
      title: title,
      intro: opts.intro || "",
      feedImage: feedImage,
      galleryDir: galleryDir
    });

    return {
      type: type,
      title: title,
      date: date,
      slug: slug,
      galleryDir: galleryDir,
      markdownPath: markdownPath,
      markdown: markdown,
      coverPath: coverPath,
      photoPaths: photoPaths,
      postUrl: CMS.SITE_URL + "/" + date.replace(/-/g, "/") + "/" + slug + "/",
      commitMessage:
        (type === "gallery" ? "Add gallery: " : "Add announcement: ") + title
    };
  };

  CMS.hasGalleryDir = function (markdown) {
    return /(^|\n)gallery_dir\s*:/.test(markdown);
  };

  CMS.planAppendPhotos = function (opts) {
    var galleryDir = String(opts.galleryDir || "").trim();
    var title = String(opts.title || galleryDir).trim();
    var startIndex = opts.startIndex || 1;
    var photoNames = opts.photoNames || [];
    return {
      type: "append",
      title: title,
      galleryDir: galleryDir,
      markdownPath: opts.markdownPath || null,
      photoPaths: CMS.photoPathsFor(galleryDir, photoNames, startIndex),
      startIndex: startIndex,
      postUrl: opts.postUrl || CMS.postUrlFromPath(opts.markdownPath),
      commitMessage: "Add photos to gallery: " + title
    };
  };

  CMS.bytesToBase64 = function (bytes) {
    if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
      return Buffer.from(bytes).toString("base64");
    }
    var binary = "";
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  CMS.textToBase64 = function (text) {
    if (typeof TextEncoder !== "undefined") {
      return CMS.bytesToBase64(new TextEncoder().encode(text));
    }
    return Buffer.from(String(text), "utf8").toString("base64");
  };

  CMS.hexFromBuffer = function (buf) {
    var bytes = new Uint8Array(buf);
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      hex += h.length === 1 ? "0" + h : h;
    }
    return hex;
  };

  CMS.hashPassword = function (password) {
    var payload = "lookgood.party:" + String(password || "");
    if (global.crypto && global.crypto.subtle) {
      return global.crypto.subtle
        .digest("SHA-256", new TextEncoder().encode(payload))
        .then(function (buf) {
          return CMS.hexFromBuffer(buf);
        });
    }
    var nodeCrypto = require("crypto");
    return Promise.resolve(
      nodeCrypto.createHash("sha256").update(payload).digest("hex")
    );
  };

  CMS.passwordMatches = function (password) {
    return CMS.hashPassword(password).then(function (hex) {
      return hex === CMS.PASSWORD_HASH;
    });
  };

  CMS.getToken = function (storage) {
    try {
      return (storage || global.localStorage).getItem(CMS.TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  };

  CMS.setToken = function (token, storage) {
    var store = storage || global.localStorage;
    var value = String(token || "").trim();
    try {
      if (!value) {
        store.removeItem(CMS.TOKEN_KEY);
        return "";
      }
      store.setItem(CMS.TOKEN_KEY, value);
      return value;
    } catch (e) {
      throw new Error("This browser would not save the token. Try another browser, or turn off private browsing.");
    }
  };

  CMS.clearToken = function (storage) {
    CMS.setToken("", storage);
  };

  CMS.githubRequest = function (token, method, path, body, fetchFn) {
    var doFetch = fetchFn || global.fetch;
    var headers = {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
    var opts = { method: method, headers: headers, credentials: "omit" };
    if (body) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return doFetch("https://api.github.com" + path, opts).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = { message: text };
          }
        }
        if (!res.ok) {
          var err = new Error(friendlyGithubError(res.status, data));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  };

  function friendlyGithubError(status, data) {
    if (status === 401 || status === 403) {
      return "GitHub did not accept the token. Make a new token that can edit files in the lookgood repository, then save it here again.";
    }
    if (status === 404) {
      return "GitHub could not find this website’s files. Check that the token is allowed to use the lookgood repository.";
    }
    if (status === 409) {
      return "The website files changed while saving. Wait a moment and try again.";
    }
    if (status === 422) {
      var msg422 = data && data.message ? String(data.message) : "";
      if (/fast-forward|does not exist/i.test(msg422)) {
        return "The website files changed while saving. Wait a moment and try again.";
      }
      if (/not accessible|Resource not accessible|Validation Failed/i.test(msg422)) {
        return "This GitHub token does not have permission for that step.";
      }
      if (msg422) return "GitHub said: " + msg422;
      return "GitHub could not save that. Wait a moment and try again.";
    }
    var msg = data && data.message ? String(data.message) : "";
    if (msg) return "GitHub said: " + msg;
    return "Could not save to GitHub (error " + status + ").";
  }

  CMS.checkToken = function (token, fetchFn) {
    return CMS.githubRequest(
      token,
      "GET",
      "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME,
      null,
      fetchFn
    );
  };

  function runPool(items, limit, worker) {
    var i = 0;
    var results = new Array(items.length);
    function next() {
      if (i >= items.length) return Promise.resolve();
      var idx = i++;
      return Promise.resolve(worker(items[idx], idx)).then(function (value) {
        results[idx] = value;
        return next();
      });
    }
    var starters = [];
    var n = Math.min(limit, items.length) || 0;
    for (var s = 0; s < n; s++) starters.push(next());
    if (!starters.length) return Promise.resolve(results);
    return Promise.all(starters).then(function () {
      return results;
    });
  }

  CMS.listGalleryPosts = function (token, fetchFn) {
    var repo = "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME;
    return CMS.githubRequest(
      token,
      "GET",
      repo + "/contents/_posts?ref=" + CMS.BRANCH,
      null,
      fetchFn
    ).then(function (items) {
      var files = (items || []).filter(function (it) {
        return it && it.type === "file" && /\.md$/i.test(it.name);
      });
      return runPool(files, 4, function (it) {
        return CMS.githubRequest(
          token,
          "GET",
          repo + "/contents/" + it.path + "?ref=" + CMS.BRANCH,
          null,
          fetchFn
        ).then(function (file) {
          var meta = CMS.parsePostFrontMatter(
            CMS.base64ToText(file.content || "")
          );
          if (!meta.galleryDir || !CMS.isSafeGalleryDir(meta.galleryDir)) {
            return null;
          }
          return {
            title: meta.title || it.name,
            galleryDir: meta.galleryDir,
            markdownPath: it.path,
            postUrl: CMS.postUrlFromPath(it.path)
          };
        });
      }).then(function (posts) {
        return posts.filter(function (p) {
          return !!p;
        });
      });
    });
  };

  CMS.listGalleryPhotoNames = function (token, galleryDir, fetchFn) {
    if (!CMS.isSafeGalleryDir(galleryDir)) {
      return Promise.reject(new Error("That gallery folder name is not valid."));
    }
    var repo = "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME;
    var dirPath = "img/" + galleryDir + "/full";
    return CMS.githubRequest(
      token,
      "GET",
      repo + "/contents/" + dirPath + "?ref=" + CMS.BRANCH,
      null,
      fetchFn
    )
      .then(function (items) {
        return (items || [])
          .filter(function (it) {
            return it && it.type === "file";
          })
          .map(function (it) {
            return it.name;
          });
      })
      .catch(function (err) {
        if (err && err.status === 404) return [];
        if (err && (err.status === 403 || err.status === 422)) {
          return listGalleryPhotoNamesViaTree(token, galleryDir, fetchFn);
        }
        throw err;
      });
  };

  function listGalleryPhotoNamesViaTree(token, galleryDir, fetchFn) {
    var repo = "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME;
    var prefix = "img/" + galleryDir + "/full/";
    return CMS.githubRequest(
      token,
      "GET",
      repo + "/git/trees/" + CMS.BRANCH + "?recursive=1",
      null,
      fetchFn
    ).then(function (tree) {
      return (tree.tree || [])
        .filter(function (it) {
          return (
            it &&
            it.type === "blob" &&
            it.path.indexOf(prefix) === 0 &&
            it.path.indexOf("/", prefix.length) === -1
          );
        })
        .map(function (it) {
          return it.path.slice(prefix.length);
        });
    });
  }

  CMS.publishPlan = function (opts) {
    var token = opts.token;
    var plan = opts.plan;
    var files = opts.files || [];
    var fetchFn = opts.fetch;
    var onProgress = opts.onProgress || function () {};

    function req(method, path, body) {
      return CMS.githubRequest(token, method, path, body, fetchFn);
    }

    var repo = "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME;

    var tries = 0;
    function attempt() {
      onProgress("Checking the website files…");
      return req("GET", repo + "/commits/" + CMS.BRANCH).then(function (latest) {
      var commitSha = latest.sha;
      var baseTree = latest.commit.tree.sha;
      onProgress("Uploading pictures…");
      return runPool(files, 3, function (file, idx) {
        onProgress("Uploading file " + (idx + 1) + " of " + files.length + "…");
        return CMS.resolveFileContent(file).then(function (content) {
          return req("POST", repo + "/git/blobs", {
            content: content,
            encoding: "base64"
          });
        }).then(function (blob) {
          return {
            path: file.path,
            mode: "100644",
            type: "blob",
            sha: blob.sha
          };
        });
      }).then(function (treeItems) {
        onProgress("Saving the post…");
        return req("POST", repo + "/git/trees", {
          base_tree: baseTree,
          tree: treeItems
        }).then(function (tree) {
          return req("POST", repo + "/git/commits", {
            message: plan.commitMessage,
            tree: tree.sha,
            parents: [commitSha]
          });
        });
      });
    })
      .then(function (newCommit) {
        return req("PATCH", repo + "/git/refs/heads/" + CMS.BRANCH, {
          sha: newCommit.sha,
          force: false
        }).then(function () {
          onProgress("Saved.");
          return { commitSha: newCommit.sha, plan: plan };
        });
      });
    }

    return attempt().catch(function (err) {
      tries += 1;
      var msg = (err && err.data && err.data.message) || (err && err.message) || "";
      var conflict =
        err &&
        (err.status === 409 ||
          (err.status === 422 && /fast-forward|does not exist/i.test(msg)));
      if (conflict && tries < 3) {
        onProgress("The website changed. Trying again…");
        return attempt();
      }
      throw err;
    });
  };

  CMS.filesFromPlan = function (plan, coverBase64, photoBase64List) {
    var files = [];
    if (plan.markdownPath && plan.markdown != null) {
      files.push({
        path: plan.markdownPath,
        content: CMS.textToBase64(plan.markdown)
      });
    }
    if (plan.coverPath && coverBase64) {
      files.push({ path: plan.coverPath, content: coverBase64 });
    }
    var photos = photoBase64List || [];
    var paths = plan.photoPaths || [];
    for (var i = 0; i < paths.length; i++) {
      files.push({ path: paths[i], content: photos[i] });
    }
    return files;
  };

  CMS.resolveFileContent = function (file) {
    if (file && typeof file.read === "function") {
      return Promise.resolve(file.read());
    }
    if (file && file.content != null) {
      return Promise.resolve(file.content);
    }
    return Promise.reject(
      new Error("Missing file content" + (file && file.path ? " for " + file.path : "."))
    );
  };

  CMS.base64ToText = function (b64) {
    var clean = String(b64 || "").replace(/\n/g, "");
    if (typeof Buffer !== "undefined" && typeof Buffer.from === "function") {
      return Buffer.from(clean, "base64").toString("utf8");
    }
    var binary = atob(clean);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  CMS.GUESTBOOK_DIR = "_guestbook";
  CMS.GUESTBOOK_AUTH_PATH = "assets/js/guestbook-auth.js";
  CMS.GUESTBOOK_CAPTCHA = "dancefloor";

  CMS.captchaOk = function (value) {
    return String(value || "").trim().toLowerCase() === CMS.GUESTBOOK_CAPTCHA;
  };

  CMS.isGuestbookFilePath = function (path) {
    return /^_guestbook\/[A-Za-z0-9._-]+\.md$/.test(String(path || ""));
  };

  CMS.buildGuestbookAuthJs = function (token) {
    return "window.LOOKGOOD_GUESTBOOK_AUTH = " + JSON.stringify(String(token || "")) + ";\n";
  };

  CMS.parseGuestbookMarkdown = function (text) {
    var raw = String(text || "").replace(/\r\n/g, "\n");
    var m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    function field(key) {
      var quoted = m[1].match(new RegExp("^" + key + ':\\s*"([\\s\\S]*?)"\\s*$', "m"));
      if (quoted) return quoted[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      var plain = m[1].match(new RegExp("^" + key + ":\\s*(.*)$", "m"));
      return plain ? plain[1].trim() : "";
    }
    return {
      name: field("name"),
      message: field("message"),
      date: field("date")
    };
  };

  CMS.buildGuestbookIssueBody = function (name, message) {
    return (
      "LOOKGOOD_GUESTBOOK_V1\n" +
      JSON.stringify({
        name: String(name || "").slice(0, 40),
        message: String(message || "").slice(0, 500)
      })
    );
  };

  CMS.guestbookIssueUrl = function (name, message) {
    return (
      "https://github.com/" +
      CMS.REPO_OWNER +
      "/" +
      CMS.REPO_NAME +
      "/issues/new?title=" +
      encodeURIComponent("[guestbook]") +
      "&body=" +
      encodeURIComponent(CMS.buildGuestbookIssueBody(name, message))
    );
  };

  CMS.tokenCanWriteFiles = function (token, fetchFn) {
    return CMS.githubRequest(
      token,
      "POST",
      "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME + "/git/blobs",
      { content: "x", encoding: "utf-8" },
      fetchFn
    )
      .then(function () {
        return true;
      })
      .catch(function (err) {
        if (
          err &&
          (err.status === 401 ||
            err.status === 403 ||
            err.status === 404 ||
            err.status === 422)
        ) {
          return false;
        }
        throw err;
      });
  };

  CMS.saveGuestbookAuth = function (adminToken, guestbookToken, fetchFn) {
    var js = CMS.buildGuestbookAuthJs(guestbookToken);
    return CMS.publishPlan({
      token: adminToken,
      plan: { commitMessage: "Update guestbook posting key" },
      files: [{ path: CMS.GUESTBOOK_AUTH_PATH, content: CMS.textToBase64(js) }],
      fetch: fetchFn
    });
  };

  CMS.listGuestbookEntries = function (token, fetchFn) {
    var repo = "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME;
    return CMS.githubRequest(
      token,
      "GET",
      repo + "/contents/" + CMS.GUESTBOOK_DIR + "?ref=" + CMS.BRANCH,
      null,
      fetchFn
    )
      .then(function (items) {
        var files = (items || []).filter(function (it) {
          return it && it.type === "file" && CMS.isGuestbookFilePath(it.path);
        });
        return runPool(files, 4, function (it) {
          return CMS.githubRequest(
            token,
            "GET",
            repo + "/contents/" + it.path,
            null,
            fetchFn
          ).then(function (file) {
            var parsed = CMS.parseGuestbookMarkdown(
              CMS.base64ToText(file.content || "")
            ) || {};
            return {
              path: it.path,
              sha: file.sha,
              name: parsed.name || it.name,
              message: parsed.message || "",
              date: parsed.date || ""
            };
          });
        });
      })
      .catch(function (err) {
        if (err && err.status === 404) return [];
        throw err;
      });
  };

  CMS.deleteGuestbookEntry = function (token, path, sha, fetchFn) {
    if (!CMS.isGuestbookFilePath(path)) {
      return Promise.reject(new Error("That is not a guestbook file."));
    }
    return CMS.githubRequest(
      token,
      "DELETE",
      "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME + "/contents/" + path,
      {
        message: "Guestbook: remove comment",
        sha: sha,
        branch: CMS.BRANCH
      },
      fetchFn
    );
  };

  CMS.MISSED_DIR = "_missed";
  CMS.MISSED_POST_MARKER = "LOOKGOOD_MISSED_V1";
  CMS.MISSED_REPLY_MARKER = "LOOKGOOD_MISSED_REPLY_V1";

  CMS.isMissedFilePath = function (path) {
    return /^_missed\/[A-Za-z0-9._-]+\.md$/.test(String(path || ""));
  };

  CMS.looksLikePublicContact = function (text) {
    var s = String(text || "");
    if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(s)) return true;
    if (/https?:\/\//i.test(s)) return true;
    if (/(^|[\s])@[A-Za-z0-9._]{2,}/.test(s)) return true;
    if (/(?:\+?1[\s.\-]*)?(?:\(?\d{3}\)?[\s.\-]*)\d{3}[\s.\-]*\d{4}/.test(s)) return true;
    return false;
  };

  CMS.parseMarkedJsonBody = function (text, marker) {
    var raw = String(text || "").replace(/\r\n/g, "\n").trim();
    if (raw.indexOf(marker) !== 0) return null;
    var rest = raw.slice(marker.length).trim();
    try {
      var data = JSON.parse(rest);
      return data && typeof data === "object" ? data : null;
    } catch (e) {
      return null;
    }
  };

  CMS.parseMissedMarkdown = function (text) {
    var raw = String(text || "").replace(/\r\n/g, "\n");
    var m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    function field(key) {
      var quoted = m[1].match(new RegExp("^" + key + ':\\s*"([\\s\\S]*?)"\\s*$', "m"));
      if (quoted) return quoted[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      var plain = m[1].match(new RegExp("^" + key + ":\\s*(.*)$", "m"));
      return plain ? plain[1].trim() : "";
    }
    return {
      name: field("name"),
      night: field("night"),
      you: field("you"),
      me: field("me"),
      note: field("note"),
      number: field("number"),
      hasContact: field("has_contact") === "true",
      date: field("date")
    };
  };

  CMS.buildMissedIssueBody = function (fields) {
    var f = fields || {};
    return (
      CMS.MISSED_POST_MARKER +
      "\n" +
      JSON.stringify({
        name: String(f.name || "").slice(0, 40),
        night: String(f.night || "").slice(0, 80),
        you: String(f.you || "").slice(0, 200),
        me: String(f.me || "").slice(0, 200),
        note: String(f.note || "").slice(0, 400),
        contact: String(f.contact || "").slice(0, 80)
      })
    );
  };

  CMS.buildMissedReplyIssueBody = function (fields) {
    var f = fields || {};
    return (
      CMS.MISSED_REPLY_MARKER +
      "\n" +
      JSON.stringify({
        post: String(f.post || "").replace(/[^0-9]/g, ""),
        name: String(f.name || "").slice(0, 40),
        note: String(f.note || "").slice(0, 400),
        contact: String(f.contact || "").slice(0, 80)
      })
    );
  };

  CMS.parseMissedPostIssue = function (body) {
    var data = CMS.parseMarkedJsonBody(body, CMS.MISSED_POST_MARKER);
    if (!data) return null;
    return {
      kind: "post",
      name: String(data.name || ""),
      night: String(data.night || ""),
      you: String(data.you || ""),
      me: String(data.me || ""),
      note: String(data.note || ""),
      contact: String(data.contact || "")
    };
  };

  CMS.parseMissedReplyIssue = function (title, body) {
    var data = CMS.parseMarkedJsonBody(body, CMS.MISSED_REPLY_MARKER);
    if (!data) return null;
    var post = String(data.post || "").replace(/[^0-9]/g, "");
    if (!post) {
      var fromTitle = String(title || "").match(/\[missed\]\s*reply\s+(\d+)/i);
      post = fromTitle ? fromTitle[1] : "";
    }
    return {
      kind: "reply",
      post: post,
      name: String(data.name || ""),
      note: String(data.note || ""),
      contact: String(data.contact || "")
    };
  };

  CMS.isMissedReplyTitle = function (title) {
    return /^\[missed\]\s*reply\b/i.test(String(title || ""));
  };

  CMS.listMissedEntries = function (token, fetchFn) {
    var repo = "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME;
    return CMS.githubRequest(
      token,
      "GET",
      repo + "/contents/" + CMS.MISSED_DIR + "?ref=" + CMS.BRANCH,
      null,
      fetchFn
    )
      .then(function (items) {
        var files = (items || []).filter(function (it) {
          return it && it.type === "file" && CMS.isMissedFilePath(it.path);
        });
        return runPool(files, 4, function (it) {
          return CMS.githubRequest(
            token,
            "GET",
            repo + "/contents/" + it.path,
            null,
            fetchFn
          ).then(function (file) {
            var parsed = CMS.parseMissedMarkdown(
              CMS.base64ToText(file.content || "")
            ) || {};
            return {
              path: it.path,
              sha: file.sha,
              name: parsed.name || it.name,
              night: parsed.night || "",
              you: parsed.you || "",
              me: parsed.me || "",
              note: parsed.note || "",
              number: parsed.number || "",
              date: parsed.date || ""
            };
          });
        });
      })
      .catch(function (err) {
        if (err && err.status === 404) return [];
        throw err;
      });
  };

  CMS.deleteMissedEntry = function (token, path, sha, fetchFn) {
    if (!CMS.isMissedFilePath(path)) {
      return Promise.reject(new Error("That is not a missed connections file."));
    }
    return CMS.githubRequest(
      token,
      "DELETE",
      "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME + "/contents/" + path,
      {
        message: "Missed connections: remove note",
        sha: sha,
        branch: CMS.BRANCH
      },
      fetchFn
    );
  };

  CMS.listRepoIssues = function (token, state, fetchFn) {
    return CMS.githubRequest(
      token,
      "GET",
      "/repos/" +
        CMS.REPO_OWNER +
        "/" +
        CMS.REPO_NAME +
        "/issues?state=" +
        encodeURIComponent(state || "open") +
        "&per_page=100",
      null,
      fetchFn
    ).then(function (items) {
      return (items || []).filter(function (it) {
        return it && !it.pull_request;
      });
    });
  };

  CMS.closeIssue = function (token, number, fetchFn) {
    var n = String(number || "").replace(/[^0-9]/g, "");
    if (!n) return Promise.reject(new Error("Missing issue number."));
    return CMS.githubRequest(
      token,
      "PATCH",
      "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME + "/issues/" + n,
      { state: "closed" },
      fetchFn
    );
  };

  CMS.listMissedReplies = function (token, fetchFn) {
    var repo = "/repos/" + CMS.REPO_OWNER + "/" + CMS.REPO_NAME;
    return CMS.listRepoIssues(token, "open", fetchFn).then(function (items) {
      var replies = (items || []).filter(function (it) {
        return it && CMS.isMissedReplyTitle(it.title);
      });
      return runPool(replies, 4, function (issue) {
        var parsed = CMS.parseMissedReplyIssue(issue.title, issue.body) || {};
        var row = {
          number: issue.number,
          from: parsed.name || "",
          note: parsed.note || "",
          contact: parsed.contact || "",
          post: parsed.post || "",
          posterName: "",
          posterContact: "",
          posterNight: ""
        };
        if (!row.post) return row;
        return CMS.githubRequest(
          token,
          "GET",
          repo + "/issues/" + row.post,
          null,
          fetchFn
        )
          .then(function (orig) {
            var poster = CMS.parseMissedPostIssue(orig && orig.body) || {};
            row.posterName = poster.name || "";
            row.posterContact = poster.contact || "";
            row.posterNight = poster.night || "";
            return row;
          })
          .catch(function () {
            return row;
          });
      });
    });
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = CMS;
  } else {
    global.LookgoodCMS = CMS;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
