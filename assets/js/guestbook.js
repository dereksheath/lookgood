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

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (document.getElementById("gbHome").value) {
      setStatus("ok", "Thanks.");
      form.reset();
      return;
    }

    var name = document.getElementById("gbName").value.trim();
    var message = document.getElementById("gbMessage").value.trim();
    var captcha = document.getElementById("gbCaptcha").value.trim().toLowerCase();

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
      localStorage.setItem(LAST_KEY, String(Date.now()));
    } catch (err) {}

    var body =
      "LOOKGOOD_GUESTBOOK_V1\n" +
      JSON.stringify({
        name: name.slice(0, 40),
        message: message.slice(0, 500)
      });
    var url =
      "https://github.com/" +
      OWNER +
      "/" +
      REPO +
      "/issues/new?title=" +
      encodeURIComponent("[guestbook]") +
      "&body=" +
      encodeURIComponent(body);

    setStatus("busy", "Opening GitHub to finish signing…");
    window.location.href = url;
  });
})();
