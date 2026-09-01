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

    player.ready.then(function () {
      playButton.addEventListener("click", function () {
        if (isPlaying) player.pause();
        else player.play();
      });

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
