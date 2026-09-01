const assert = require("assert");
const lb = require("../assets/js/lightbox.js");

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

const tests = [];

tests.push(
  test("swipe left advances to the next photo", function () {
    assert.strictEqual(lb.swipeDir(-80, 0), 1);
    assert.strictEqual(lb.swipeDir(-50, 8), 1);
  })
);

tests.push(
  test("swipe right goes to the previous photo", function () {
    assert.strictEqual(lb.swipeDir(80, 0), -1);
    assert.strictEqual(lb.swipeDir(50, -8), -1);
  })
);

tests.push(
  test("short flicks do not change the photo", function () {
    assert.strictEqual(lb.swipeDir(-49, 0), 0);
    assert.strictEqual(lb.swipeDir(20, 2), 0);
    assert.strictEqual(lb.swipeDir(0, 0), 0);
  })
);

tests.push(
  test("vertical or mostly-vertical moves are ignored", function () {
    assert.strictEqual(lb.swipeDir(10, 80), 0);
    assert.strictEqual(lb.swipeDir(-40, 80), 0);
    assert.strictEqual(lb.swipeDir(60, 61), 0);
  })
);

tests.push(
  test("invalid numbers are ignored", function () {
    assert.strictEqual(lb.swipeDir(NaN, 0), 0);
    assert.strictEqual(lb.swipeDir(-80, Infinity), 0);
  })
);

Promise.all(tests)
  .then(function () {
    console.log("all " + tests.length + " tests passed");
  })
  .catch(function () {
    process.exit(1);
  });
