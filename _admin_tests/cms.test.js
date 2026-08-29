const assert = require("assert");
const CMS = require("../admin/cms.js");

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
  test("slugify makes a folder-safe name", function () {
    assert.strictEqual(
      CMS.slugify("2007 Night at El Cid"),
      "2007-night-at-el-cid"
    );
    assert.strictEqual(CMS.slugify("Hello!!!"), "hello");
  })
);

tests.push(
  test("announcement markdown has no gallery_dir", function () {
    const plan = CMS.planPost({
      type: "announcement",
      title: "2007 Night - El Cid",
      intro: "We're back.",
      date: "2026-08-29",
      coverName: "flyer.jpg"
    });
    assert.strictEqual(plan.galleryDir, null);
    assert.strictEqual(plan.markdownPath, "_posts/2026-08-29-2007-night-el-cid.md");
    assert.strictEqual(
      plan.coverPath,
      "img/headers/2026-08-29-2007-night-el-cid.jpg"
    );
    assert.strictEqual(plan.photoPaths.length, 0);
    assert.ok(!CMS.hasGalleryDir(plan.markdown));
    assert.ok(plan.markdown.indexOf("feed_image:") !== -1);
    assert.ok(plan.markdown.indexOf('title: "2007 Night - El Cid"') !== -1);
    assert.ok(plan.markdown.indexOf("gallery_dir") === -1);
  })
);

tests.push(
  test("gallery markdown has gallery_dir and full-size photo paths", function () {
    const plan = CMS.planPost({
      type: "gallery",
      title: "2006 Night at El Cid - Photo Dump",
      intro: "Photos by Morganne.",
      date: "2026-01-23",
      coverName: "cover.PNG",
      photoNames: ["party-a.jpg", "party-b.png"]
    });
    assert.strictEqual(plan.galleryDir, "2006-night-at-el-cid-photo-dump");
    assert.ok(CMS.hasGalleryDir(plan.markdown));
    assert.ok(
      plan.markdown.indexOf(
        'gallery_dir: "2006-night-at-el-cid-photo-dump"'
      ) !== -1
    );
    assert.deepStrictEqual(plan.photoPaths, [
      "img/2006-night-at-el-cid-photo-dump/full/001.jpg",
      "img/2006-night-at-el-cid-photo-dump/full/002.png"
    ]);
    assert.strictEqual(
      plan.coverPath,
      "img/headers/2026-01-23-2006-night-at-el-cid-photo-dump.png"
    );
  })
);

tests.push(
  test("yaml quotes do not break titles", function () {
    const plan = CMS.planPost({
      type: "announcement",
      title: 'Say "hello"',
      date: "2026-08-29",
      coverName: "a.jpg"
    });
    assert.ok(plan.markdown.indexOf('title: "Say \\"hello\\""') !== -1);
  })
);

tests.push(
  test("password hashing is stable and does not store a plaintext secret", function () {
    return CMS.hashPassword("unit-test-only").then(function (hex) {
      assert.strictEqual(hex.length, 64);
      assert.strictEqual(CMS.PASSWORD_HASH.length, 64);
      assert.notStrictEqual(hex, CMS.PASSWORD_HASH);
      assert.ok(!/password/i.test(JSON.stringify(CMS.PASSWORD_HASH)));
    });
  })
);

tests.push(
  test("wrong password is rejected", function () {
    return CMS.passwordMatches("nope").then(function (ok) {
      assert.strictEqual(ok, false);
    });
  })
);

tests.push(
  test("token is stored only in the provided storage object", function () {
    const mem = {
      data: {},
      getItem: function (k) {
        return this.data[k] || null;
      },
      setItem: function (k, v) {
        this.data[k] = String(v);
      },
      removeItem: function (k) {
        delete this.data[k];
      }
    };
    CMS.setToken("  ghp_exampletoken  ", mem);
    assert.strictEqual(CMS.getToken(mem), "ghp_exampletoken");
    CMS.clearToken(mem);
    assert.strictEqual(CMS.getToken(mem), "");
    assert.strictEqual(Object.keys(mem.data).length, 0);
  })
);

tests.push(
  test("filesFromPlan writes markdown, cover, and gallery full images", function () {
    const plan = CMS.planPost({
      type: "gallery",
      title: "Party",
      date: "2026-08-29",
      coverName: "cover.jpg",
      photoNames: ["one.jpg"]
    });
    const files = CMS.filesFromPlan(plan, "Y292ZXI=", ["cGhvdG8="]);
    assert.deepStrictEqual(
      files.map(function (f) {
        return f.path;
      }),
      [
        "_posts/2026-08-29-party.md",
        "img/headers/2026-08-29-party.jpg",
        "img/party/full/001.jpg"
      ]
    );
    const md = Buffer.from(files[0].content, "base64").toString("utf8");
    assert.ok(CMS.hasGalleryDir(md));
    assert.ok(!/ghp_|github_pat_/i.test(md));
  })
);

tests.push(
  test("publishPlan sends blobs then a tree of the same files this site uses", function () {
    const calls = [];
    const fakeFetch = function (url, opts) {
      const path = url.replace("https://api.github.com", "");
      calls.push({ path: path, method: opts.method, body: opts.body });
      let data = {};
      if (path.indexOf("/commits/main") !== -1) {
        data = { sha: "commit1", commit: { tree: { sha: "tree1" } } };
      } else if (path.indexOf("/git/blobs") !== -1) {
        data = { sha: "blob-" + calls.length };
      } else if (path.indexOf("/git/trees") !== -1) {
        data = { sha: "tree2" };
      } else if (path.indexOf("/git/commits") !== -1) {
        data = { sha: "commit2" };
      } else if (path.indexOf("/git/refs/heads/main") !== -1) {
        data = { ok: true };
      }
      return Promise.resolve({
        ok: true,
        text: function () {
          return Promise.resolve(JSON.stringify(data));
        }
      });
    };

    const plan = CMS.planPost({
      type: "announcement",
      title: "Flyer",
      date: "2026-08-29",
      coverName: "f.jpg"
    });
    const files = CMS.filesFromPlan(plan, "YQ==", []);
    return CMS.publishPlan({
      token: "fake-token-for-test",
      plan: plan,
      files: files,
      fetch: fakeFetch
    }).then(function () {
      const treeCall = calls.find(function (c) {
        return c.path.indexOf("/git/trees") !== -1 && c.method === "POST";
      });
      const tree = JSON.parse(treeCall.body);
      const paths = tree.tree.map(function (t) {
        return t.path;
      });
      assert.deepStrictEqual(paths, [
        "_posts/2026-08-29-flyer.md",
        "img/headers/2026-08-29-flyer.jpg"
      ]);
      assert.ok(
        paths.every(function (p) {
          return p.indexOf("thumbs") === -1;
        })
      );
      const auth = JSON.stringify(calls);
      assert.ok(auth.indexOf("fake-token-for-test") === -1);
    });
  })
);

Promise.all(tests)
  .then(function () {
    console.log("\nAll CMS tests passed.");
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
