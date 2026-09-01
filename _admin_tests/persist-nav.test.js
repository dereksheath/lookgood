const assert = require("assert");
const nav = require("../assets/js/persist-nav.js");

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(function () {
      console.log("ok  " + name);
    })
    .catch(function (err) {
      console.error("fail  " + name);
      throw err;
    });
}

const home = { href: "https://lookgood.party/", origin: "https://lookgood.party", pathname: "/", search: "" };
const galleries = { href: "https://lookgood.party/galleries/", origin: "https://lookgood.party", pathname: "/galleries/", search: "" };
const category = { href: "https://lookgood.party/category.html?c=El+Cid", origin: "https://lookgood.party", pathname: "/category.html", search: "?c=El+Cid" };

const tests = [];

tests.push(
  test("internal gallery link is captured", function () {
    assert.strictEqual(nav.isInternalHref("/galleries/", home), true);
    assert.strictEqual(nav.isSamePageHref("/galleries/", home), false);
  })
);

tests.push(
  test("same-page header click is not a fetch navigation", function () {
    assert.strictEqual(nav.isInternalHref("/", home), true);
    assert.strictEqual(nav.isSamePageHref("/", home), true);
    assert.strictEqual(nav.isSamePageHref("https://lookgood.party/", home), true);
  })
);

tests.push(
  test("external and special links are left alone", function () {
    assert.strictEqual(nav.isInternalHref("https://www.instagram.com/lookgood.party/", home), false);
    assert.strictEqual(nav.isInternalHref("mailto:hi@example.com", home), false);
    assert.strictEqual(nav.isInternalHref("#about", home), false);
    assert.strictEqual(nav.isSpecialHref("#about"), true);
  })
);

tests.push(
  test("admin stays a full page load", function () {
    assert.strictEqual(nav.isAdminPath("/admin"), true);
    assert.strictEqual(nav.isAdminPath("/admin/"), true);
    assert.strictEqual(nav.isAdminPath("/admin/index.html"), true);
    assert.strictEqual(nav.isInternalHref("/admin/", home), false);
    assert.strictEqual(nav.isAdminPath("/galleries/"), false);
  })
);

tests.push(
  test("category query changes count as a new page", function () {
    assert.strictEqual(nav.isInternalHref("/category.html?c=Virgil", category), true);
    assert.strictEqual(nav.isSamePageHref("/category.html?c=Virgil", category), false);
    assert.strictEqual(nav.isSamePageHref("/category.html?c=El+Cid", category), true);
  })
);

tests.push(
  test("hash on the current page is not a fetch navigation", function () {
    assert.strictEqual(nav.isSamePageHref("/galleries/#top", galleries), true);
  })
);

tests.push(
  test("image and other asset links are left to the lightbox or browser", function () {
    assert.strictEqual(nav.isAssetPath("/img/a.png"), true);
    assert.strictEqual(nav.isInternalHref("/img/a.png", home), false);
    assert.strictEqual(nav.isInternalHref("/img/full/12.jpg", galleries), false);
  })
);

Promise.all(tests)
  .then(function () {
    console.log("all " + tests.length + " tests passed");
  })
  .catch(function () {
    process.exit(1);
  });
