(function () {
  var form = document.getElementById("gbForm");
  var statusBox = document.getElementById("gbStatus");
  if (!form || !statusBox) return;

  var OWNER = "dereksheath";
  var REPO = "lookgood";
  var LAST_KEY = "lookgood_gb_last";

  function setStatus(kind, text) {
    statusBox.hidden = false;
    statusBox.className = "gb-status " + kind;
    statusBox.textContent = text;
  }

  function token() {
    var t = window.LOOKGOOD_GUESTBOOK_AUTH;
    return typeof t === "string" ? t.trim() : "";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (document.getElementById("gbHome").value) {
      setStatus("ok", "Thanks. Your note should show up in a minute or two.");
      form.reset();
      return;
    }

    var name = document.getElementById("gbName").value.trim();
    var message = document.getElementById("gbMessage").value.trim();
    var captcha = document.getElementById("gbCaptcha").value.trim().toLowerCase();
    var auth = token();

    if (!auth) {
      setStatus("bad", "The guestbook is not taking signatures yet.");
      return;
    }
    if (!name) {
      setStatus("bad", "Please type a name.");
      return;
    }
    if (!message) {
      setStatus("bad", "Please type a comment.");
      return;
    }
    if (captcha !== "dancefloor") {
      setStatus("bad", "Type the word DANCEFLOOR to prove you are a person.");
      return;
    }

    try {
      var last = parseInt(localStorage.getItem(LAST_KEY) || "0", 10);
      if (last && Date.now() - last < 45000) {
        setStatus("bad", "Wait a few seconds before signing again.");
        return;
      }
    } catch (err) {}

    var btn = form.querySelector('input[type="submit"]');
    btn.disabled = true;
    setStatus("busy", "Saving your note…");

    fetch("https://api.github.com/repos/" + OWNER + "/" + REPO + "/issues", {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + auth,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        title: "[guestbook]",
        body:
          "LOOKGOOD_GUESTBOOK_V1\n" +
          JSON.stringify({ name: name.slice(0, 40), message: message.slice(0, 500) })
      })
    })
      .then(function (res) {
        if (res.ok) {
          try {
            localStorage.setItem(LAST_KEY, String(Date.now()));
          } catch (err2) {}
          setStatus(
            "ok",
            "Thanks. Your note should show up on this page in a minute or two. Refresh then."
          );
          form.reset();
          return;
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error("The guestbook is not taking signatures right now.");
        }
        throw new Error("Could not save that. Try again in a minute.");
      })
      .catch(function (err) {
        setStatus("bad", (err && err.message) || "Could not save that.");
      })
      .then(function () {
        btn.disabled = false;
      });
  });
})();
