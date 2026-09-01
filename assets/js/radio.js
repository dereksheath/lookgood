(function () {
  function initRadio() {
    var radio = document.getElementById("indie-sleaze-radio");
    var playButton = document.getElementById("radio-play");
    var iframe = document.getElementById("mixcloud-player");
    var mobileSlot = document.getElementById("radio-mobile-slot");

    if (!radio || !playButton || !iframe) return;
    if (radio.getAttribute("data-radio-ready") === "1") return;
    radio.setAttribute("data-radio-ready", "1");

    if (typeof Mixcloud === "undefined" || !Mixcloud.PlayerWidget) return;

    var player = Mixcloud.PlayerWidget(iframe);
    var isPlaying = false;
    var playerReady = false;

    function toggle() {
      if (!playerReady) return;
      if (isPlaying) player.pause();
      else player.play();
    }

    // Bind immediately so a tap is not lost if Mixcloud is still starting,
    // and so the handler stays on the button after the chrome is relocated.
    playButton.addEventListener("click", toggle);

    player.ready.then(function () {
      playerReady = true;

      player.events.play.on(function () {
        isPlaying = true;
        radio.classList.add("is-playing");
        playButton.setAttribute("aria-label", "Pause Indie Sleaze Radio");
      });

      player.events.pause.on(function () {
        isPlaying = false;
        radio.classList.remove("is-playing");
        playButton.setAttribute("aria-label", "Play Indie Sleaze Radio");
      });

      player.events.ended.on(function () {
        isPlaying = false;
        radio.classList.remove("is-playing");
        playButton.setAttribute("aria-label", "Play Indie Sleaze Radio");
      });
    });

    var originalParent = radio.parentNode;
    var originalNextSibling = radio.nextSibling;

    function positionRadio() {
      if (window.innerWidth <= 700 && mobileSlot) {
        if (radio.parentNode !== mobileSlot) {
          mobileSlot.appendChild(radio);
        }
      } else if (radio.parentNode !== originalParent) {
        if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
          originalParent.insertBefore(radio, originalNextSibling);
        } else {
          originalParent.appendChild(radio);
        }
      }
    }

    positionRadio();
    window.addEventListener("resize", positionRadio);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRadio);
  } else {
    initRadio();
  }
})();
