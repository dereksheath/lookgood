(function () {
  var form = document.getElementById("mcForm");
  var statusBox = document.getElementById("mcStatus");
  if (!form || !statusBox) return;

  var OWNER = "dereksheath";
  var REPO = "lookgood";
  var LAST_KEY = "lookgood_mc_last";
  var EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
  var URL_RE = /https?:\/\//i;
  var HANDLE_RE = /(^|[\s])@[A-Za-z0-9._]{2,}/;
  var PHONE_RE = /(?:\+?1[\s.\-]*)?(?:\(?\d{3}\)?[\s.\-]*)\d{3}[\s.\-]*\d{4}/;

  function token() {
    var t = window.LOOKGOOD_GUESTBOOK_AUTH;
    return typeof t === "string" ? t.trim() : "";
  }

  function setStatus(box, kind, text) {
    box.hidden = false;
    box.className = "gb-status " + kind;
    box.textContent = text;
  }

  function looksPublicContact(text) {
    var s = String(text || "");
    return EMAIL_RE.test(s) || URL_RE.test(s) || HANDLE_RE.test(s) || PHONE_RE.test(s);
  }

  function tooSoon() {
    try {
      var last = parseInt(localStorage.getItem(LAST_KEY) || "0", 10);
      return last && Date.now() - last < 45000;
    } catch (err) {
      return false;
    }
  }

  function markSent() {
    try {
      localStorage.setItem(LAST_KEY, String(Date.now()));
    } catch (err) {}
  }

  function postIssue(title, payload) {
    var auth = token();
    if (!auth) {
      return Promise.reject(new Error("Missed connections is not taking notes yet."));
    }
    return fetch("https://api.github.com/repos/" + OWNER + "/" + REPO + "/issues", {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + auth,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        title: title,
        body: payload
      })
    }).then(function (res) {
      if (res.ok) return;
      if (res.status === 401 || res.status === 403) {
        throw new Error("Missed connections is not taking notes right now.");
      }
      throw new Error("Could not save that. Try again in a minute.");
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (document.getElementById("mcHome").value) {
      setStatus(statusBox, "ok", "Thanks. It should show up in a minute or two.");
      form.reset();
      return;
    }

    var name = document.getElementById("mcName").value.trim();
    var night = document.getElementById("mcNight").value.trim();
    var you = document.getElementById("mcYou").value.trim();
    var me = document.getElementById("mcMe").value.trim();
    var note = document.getElementById("mcNote").value.trim();
    var contact = document.getElementById("mcContact").value.trim();
    var captcha = document.getElementById("mcCaptcha").value.trim().toLowerCase();

    if (!name) {
      setStatus(statusBox, "bad", "Please type a name.");
      return;
    }
    if (!night) {
      setStatus(statusBox, "bad", "Please choose a night.");
      return;
    }
    if (!you && !me && !note) {
      setStatus(statusBox, "bad", "Write who they were, who you were, or the moment.");
      return;
    }
    if (looksPublicContact(name + " " + you + " " + me + " " + note)) {
      setStatus(
        statusBox,
        "bad",
        "Keep phone numbers, emails, and @handles off the board. Put how to find you in the private field."
      );
      return;
    }
    if (!contact) {
      setStatus(statusBox, "bad", "Leave a private way to find you so we can pass a reply along.");
      return;
    }
    if (captcha !== "dancefloor") {
      setStatus(statusBox, "bad", "Type the word DANCEFLOOR to prove you are a person.");
      return;
    }
    if (tooSoon()) {
      setStatus(statusBox, "bad", "Wait a few seconds before posting again.");
      return;
    }

    var btn = form.querySelector('input[type="submit"]');
    btn.disabled = true;
    setStatus(statusBox, "busy", "Saving your note…");

    postIssue(
      "[missed]",
      "LOOKGOOD_MISSED_V1\n" +
        JSON.stringify({
          name: name.slice(0, 40),
          night: night.slice(0, 80),
          you: you.slice(0, 200),
          me: me.slice(0, 200),
          note: note.slice(0, 400),
          contact: contact.slice(0, 80)
        })
    )
      .then(function () {
        markSent();
        setStatus(
          statusBox,
          "ok",
          "Thanks. Your note should show up on the board in a minute or two. Refresh then. If someone replies, we will use the private contact you left."
        );
        form.reset();
      })
      .catch(function (err) {
        setStatus(statusBox, "bad", (err && err.message) || "Could not save that.");
      })
      .then(function () {
        btn.disabled = false;
      });
  });

  var toggles = document.querySelectorAll(".mc-reply-toggle");
  var t;
  for (t = 0; t < toggles.length; t++) {
    toggles[t].addEventListener("click", function (e) {
      var href = this.getAttribute("href") || "";
      var id = href.charAt(0) === "#" ? href.slice(1) : "";
      var replyForm = id ? document.getElementById(id) : null;
      if (!replyForm) return;
      e.preventDefault();
      replyForm.hidden = !replyForm.hidden;
    });
  }

  var replies = document.querySelectorAll(".mc-reply-form");
  var r;
  for (r = 0; r < replies.length; r++) {
    replies[r].addEventListener("submit", function (e) {
      e.preventDefault();
      var replyForm = this;
      var box = replyForm.querySelector(".mc-reply-status") || statusBox;
      var hp = replyForm.querySelector('input[name="homepage"]');
      if (hp && hp.value) {
        setStatus(box, "ok", "Thanks. We will pass it along.");
        replyForm.reset();
        return;
      }

      var nameEl = replyForm.querySelector('input[name="name"]');
      var noteEl = replyForm.querySelector('textarea[name="note"]');
      var contactEl = replyForm.querySelector('input[name="contact"]');
      var captchaEl = replyForm.querySelector('input[name="captcha"]');
      var name = nameEl ? nameEl.value.trim() : "";
      var note = noteEl ? noteEl.value.trim() : "";
      var contact = contactEl ? contactEl.value.trim() : "";
      var captcha = captchaEl ? captchaEl.value.trim().toLowerCase() : "";
      var post = String(replyForm.getAttribute("data-post") || "").replace(/[^0-9]/g, "");

      if (!post) {
        setStatus(box, "bad", "Could not tell which note this is for.");
        return;
      }
      if (!name) {
        setStatus(box, "bad", "Please type a name.");
        return;
      }
      if (!note) {
        setStatus(box, "bad", "Say why this is you. A detail only you would know.");
        return;
      }
      if (!contact) {
        setStatus(box, "bad", "Leave a private way to find you.");
        return;
      }
      if (captcha !== "dancefloor") {
        setStatus(box, "bad", "Type the word DANCEFLOOR to prove you are a person.");
        return;
      }
      if (tooSoon()) {
        setStatus(box, "bad", "Wait a few seconds before posting again.");
        return;
      }

      var btn = replyForm.querySelector('input[type="submit"]');
      btn.disabled = true;
      setStatus(box, "busy", "Sending your reply…");

      postIssue(
        "[missed] reply " + post,
        "LOOKGOOD_MISSED_REPLY_V1\n" +
          JSON.stringify({
            post: post,
            name: name.slice(0, 40),
            note: note.slice(0, 400),
            contact: contact.slice(0, 80)
          })
      )
        .then(function () {
          markSent();
          setStatus(
            box,
            "ok",
            "Sent. This reply is not on the board. If it looks real, we will pass it along."
          );
          replyForm.reset();
        })
        .catch(function (err) {
          setStatus(box, "bad", (err && err.message) || "Could not save that.");
        })
        .then(function () {
          btn.disabled = false;
        });
    });
  }
})();
