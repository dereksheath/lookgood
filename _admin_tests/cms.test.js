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

tests.push(
  test("guestbook captcha is case-insensitive", function () {
    assert.strictEqual(CMS.captchaOk("DANCEFLOOR"), true);
    assert.strictEqual(CMS.captchaOk(" dancefloor "), true);
    assert.strictEqual(CMS.captchaOk("nope"), false);
  })
);

tests.push(
  test("guestbook paths stay inside _guestbook", function () {
    assert.strictEqual(CMS.isGuestbookFilePath("_guestbook/2026-08-29-120000-1.md"), true);
    assert.strictEqual(CMS.isGuestbookFilePath("_posts/hack.md"), false);
    assert.strictEqual(CMS.isGuestbookFilePath("_guestbook/../_posts/x.md"), false);
    return CMS.deleteGuestbookEntry("t", "_posts/hack.md", "sha").then(
      function () {
        throw new Error("should reject");
      },
      function (err) {
        assert.ok(/not a guestbook/i.test(err.message));
      }
    );
  })
);

tests.push(
  test("guestbook markdown parse and auth file quoting", function () {
    const parsed = CMS.parseGuestbookMarkdown(
      '---\nname: "Sam"\nmessage: "Yo"\ndate: "2026-08-29 12:00:00 -0700"\n---\n'
    );
    assert.strictEqual(parsed.name, "Sam");
    assert.strictEqual(parsed.message, "Yo");
    const js = CMS.buildGuestbookAuthJs('abc"def');
    assert.strictEqual(js.indexOf("abc\"def") !== -1 || js.indexOf("abc\\\"def") !== -1, true);
    assert.ok(js.indexOf("LOOKGOOD_GUESTBOOK_AUTH") !== -1);
    const body = CMS.buildGuestbookIssueBody("Sam", "Hello");
    assert.ok(body.indexOf("LOOKGOOD_GUESTBOOK_V1") === 0);
    assert.ok(body.indexOf("Hello") !== -1);
    const issueUrl = CMS.guestbookIssueUrl("Sam", "Hello");
    assert.ok(issueUrl.indexOf("github.com/dereksheath/lookgood/issues/new") !== -1);
    assert.ok(issueUrl.indexOf("ghp_") === -1);
    assert.ok(issueUrl.indexOf("github_pat_") === -1);
    assert.ok(issueUrl.indexOf("Bearer") === -1);
  })
);

tests.push(
  test("guestbook token write check treats 403 as cannot edit files", function () {
    const fakeFetch = function (url, opts) {
      const ok = opts.method !== "POST";
      return Promise.resolve({
        ok: ok,
        status: ok ? 200 : 403,
        text: function () {
          return Promise.resolve(JSON.stringify({ message: "Forbidden" }));
        }
      });
    };
    return CMS.tokenCanWriteFiles("gb-readonly", fakeFetch).then(function (canWrite) {
      assert.strictEqual(canWrite, false);
    });
  })
);

tests.push(
  test("guestbook token write check treats 422 as cannot edit files", function () {
    const fakeFetch = function () {
      return Promise.resolve({
        ok: false,
        status: 422,
        text: function () {
          return Promise.resolve(
            JSON.stringify({ message: "Resource not accessible by personal access token" })
          );
        }
      });
    };
    return CMS.tokenCanWriteFiles("gb-readonly", fakeFetch).then(function (canWrite) {
      assert.strictEqual(canWrite, false);
    });
  })
);

tests.push(
  test("guestbook auth save only writes the auth js file", function () {
    const calls = [];
    const fakeFetch = function (url, opts) {
      const path = url.replace("https://api.github.com", "");
      calls.push({ path: path, method: opts.method, body: opts.body });
      let data = { sha: "commit1", commit: { tree: { sha: "tree1" } } };
      if (path.indexOf("/git/blobs") !== -1) data = { sha: "blob1" };
      else if (path.indexOf("/git/trees") !== -1) data = { sha: "tree2" };
      else if (path.indexOf("/git/commits") !== -1 && opts.method === "POST") {
        data = { sha: "commit2" };
      } else if (path.indexOf("/git/refs/heads/main") !== -1) data = { ok: true };
      else if (path.indexOf("/commits/main") !== -1) {
        data = { sha: "commit1", commit: { tree: { sha: "tree1" } } };
      }
      return Promise.resolve({
        ok: true,
        text: function () {
          return Promise.resolve(JSON.stringify(data));
        }
      });
    };
    return CMS.saveGuestbookAuth("admin-token", "gb-token", fakeFetch).then(function () {
      const treeCall = calls.find(function (c) {
        return c.path.indexOf("/git/trees") !== -1 && c.method === "POST";
      });
      const tree = JSON.parse(treeCall.body);
      assert.deepStrictEqual(
        tree.tree.map(function (t) {
          return t.path;
        }),
        ["assets/js/guestbook-auth.js"]
      );
      const dumped = JSON.stringify(calls);
      assert.ok(dumped.indexOf("admin-token") === -1);
      assert.ok(dumped.indexOf("gb-token") === -1);
    });
  })
);

tests.push(
  test("next photo number continues after existing 001-style names", function () {
    assert.strictEqual(CMS.nextPhotoNumber([]), 1);
    assert.strictEqual(CMS.nextPhotoNumber(["001.jpg", "002.png"]), 3);
    assert.strictEqual(CMS.nextPhotoNumber(["150.jpg", "readme.txt"]), 151);
    assert.strictEqual(CMS.nextPhotoNumber(["009.jpg", "010.jpg"]), 11);
    assert.strictEqual(CMS.pad3(151), "151");
    assert.strictEqual(CMS.pad3(7), "007");
  })
);

tests.push(
  test("append plan numbers new files after the last photo and does not rewrite the post", function () {
    const plan = CMS.planAppendPhotos({
      title: "2006 Night at El Cid - Photo Dump",
      galleryDir: "2006-night-el-cid",
      markdownPath: "_posts/2026-01-23-el-cid-2006-night.md",
      startIndex: 151,
      photoNames: ["more-a.jpg", "more-b.png"]
    });
    assert.strictEqual(plan.type, "append");
    assert.deepStrictEqual(plan.photoPaths, [
      "img/2006-night-el-cid/full/151.jpg",
      "img/2006-night-el-cid/full/152.png"
    ]);
    assert.ok(!plan.markdown);
    assert.ok(!plan.coverPath);
    assert.ok(/Add photos to gallery/.test(plan.commitMessage));
    assert.strictEqual(
      plan.postUrl,
      "https://lookgood.party/2026/01/23/el-cid-2006-night/"
    );
    const files = CMS.filesFromPlan(plan, null, ["YQ==", "Yg=="]);
    assert.deepStrictEqual(
      files.map(function (f) {
        return f.path;
      }),
      [
        "img/2006-night-el-cid/full/151.jpg",
        "img/2006-night-el-cid/full/152.png"
      ]
    );
  })
);

tests.push(
  test("front matter parser finds gallery_dir on existing posts", function () {
    const meta = CMS.parsePostFrontMatter(
      '---\ntitle: "2006 Night at El Cid - Photo Dump"\nintro: "Photos."\n\nfeed_image: "/img/headers/2006-night-el-cid.jpg"\n\ngallery_dir: "2006-night-el-cid"\n---\n'
    );
    assert.strictEqual(meta.title, "2006 Night at El Cid - Photo Dump");
    assert.strictEqual(meta.galleryDir, "2006-night-el-cid");
    assert.strictEqual(CMS.isSafeGalleryDir(meta.galleryDir), true);
    assert.strictEqual(CMS.isSafeGalleryDir("../secret"), false);
    assert.strictEqual(CMS.isSafeGalleryDir("img/foo"), false);
    const noGallery = CMS.parsePostFrontMatter(
      '---\ntitle: "Flyer"\nfeed_image: "/img/headers/a.jpg"\n---\n'
    );
    assert.strictEqual(noGallery.galleryDir, null);
  })
);

tests.push(
  test("listGalleryPosts returns only posts with a gallery folder", function () {
    const mdGallery = Buffer.from(
      '---\ntitle: "Party Photos"\ngallery_dir: "party-photos"\n---\n'
    ).toString("base64");
    const mdAnnounce = Buffer.from(
      '---\ntitle: "Flyer"\nfeed_image: "/x.jpg"\n---\n'
    ).toString("base64");
    const fakeFetch = function (url) {
      const path = url.replace("https://api.github.com", "");
      let data;
      if (path.indexOf("/contents/_posts?") !== -1) {
        data = [
          { type: "file", name: "2026-01-23-party-photos.md", path: "_posts/2026-01-23-party-photos.md" },
          { type: "file", name: "2026-01-20-flyer.md", path: "_posts/2026-01-20-flyer.md" }
        ];
      } else if (path.indexOf("_posts/2026-01-23-party-photos.md") !== -1) {
        data = { content: mdGallery };
      } else {
        data = { content: mdAnnounce };
      }
      return Promise.resolve({
        ok: true,
        text: function () {
          return Promise.resolve(JSON.stringify(data));
        }
      });
    };
    return CMS.listGalleryPosts("fake-token-for-test", fakeFetch).then(function (posts) {
      assert.strictEqual(posts.length, 1);
      assert.strictEqual(posts[0].title, "Party Photos");
      assert.strictEqual(posts[0].galleryDir, "party-photos");
      assert.strictEqual(posts[0].markdownPath, "_posts/2026-01-23-party-photos.md");
    });
  })
);

tests.push(
  test("listGalleryPhotoNames reads existing full-size files and treats a missing folder as empty", function () {
    const fakeFetch = function (url) {
      const path = url.replace("https://api.github.com", "");
      if (path.indexOf("/full") !== -1 && path.indexOf("missing-gallery") !== -1) {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: function () {
            return Promise.resolve(JSON.stringify({ message: "Not Found" }));
          }
        });
      }
      return Promise.resolve({
        ok: true,
        text: function () {
          return Promise.resolve(
            JSON.stringify([
              { type: "file", name: "001.jpg" },
              { type: "file", name: "002.png" },
              { type: "dir", name: "ignore" }
            ])
          );
        }
      });
    };
    return CMS.listGalleryPhotoNames(
      "fake-token-for-test",
      "2006-night-el-cid",
      fakeFetch
    ).then(function (names) {
      assert.deepStrictEqual(names, ["001.jpg", "002.png"]);
      return CMS.listGalleryPhotoNames(
        "fake-token-for-test",
        "missing-gallery",
        fakeFetch
      );
    }).then(function (names) {
      assert.deepStrictEqual(names, []);
    });
  })
);

tests.push(
  test("publishPlan can read files lazily so a later batch does not need every photo in memory first", function () {
    const calls = [];
    const fakeFetch = function (url, opts) {
      const path = url.replace("https://api.github.com", "");
      calls.push({ path: path, method: opts.method, body: opts.body });
      let data = { sha: "commit1", commit: { tree: { sha: "tree1" } } };
      if (path.indexOf("/git/blobs") !== -1) data = { sha: "blob-" + calls.length };
      else if (path.indexOf("/git/trees") !== -1) data = { sha: "tree2" };
      else if (path.indexOf("/git/commits") !== -1 && opts.method === "POST") {
        data = { sha: "commit2" };
      } else if (path.indexOf("/git/refs/heads/main") !== -1) data = { ok: true };
      return Promise.resolve({
        ok: true,
        text: function () {
          return Promise.resolve(JSON.stringify(data));
        }
      });
    };
    let reads = 0;
    const plan = CMS.planAppendPhotos({
      title: "Party",
      galleryDir: "party",
      startIndex: 3,
      photoNames: ["c.jpg"]
    });
    return CMS.publishPlan({
      token: "fake-token-for-test",
      plan: plan,
      files: [
        {
          path: plan.photoPaths[0],
          read: function () {
            reads += 1;
            return Promise.resolve("Yw==");
          }
        }
      ],
      fetch: fakeFetch
    }).then(function () {
      assert.strictEqual(reads, 1);
      const treeCall = calls.find(function (c) {
        return c.path.indexOf("/git/trees") !== -1 && c.method === "POST";
      });
      const tree = JSON.parse(treeCall.body);
      assert.deepStrictEqual(
        tree.tree.map(function (t) {
          return t.path;
        }),
        ["img/party/full/003.jpg"]
      );
    });
  })
);

tests.push(
  test("missed connections keep contact out of public markdown helpers", function () {
    assert.strictEqual(CMS.isMissedFilePath("_missed/2026-08-29-120000-12.md"), true);
    assert.strictEqual(CMS.isMissedFilePath("_posts/hack.md"), false);
    assert.strictEqual(CMS.isMissedFilePath("_missed/../_posts/x.md"), false);
    assert.strictEqual(CMS.looksLikePublicContact("email me at a@b.com"), true);
    assert.strictEqual(CMS.looksLikePublicContact("ig @findme"), true);
    assert.strictEqual(CMS.looksLikePublicContact("sequin top by the patio"), false);
    const parsed = CMS.parseMissedMarkdown(
      '---\nname: "Sam"\nnight: "2008 Night"\nyou: "sequin"\nme: "stripes"\nnote: "hi"\nnumber: 12\nhas_contact: true\ndate: "2026-08-29 12:00:00 -0700"\n---\n'
    );
    assert.strictEqual(parsed.name, "Sam");
    assert.strictEqual(parsed.number, "12");
    assert.strictEqual(parsed.hasContact, true);
    const body = CMS.buildMissedIssueBody({
      name: "Sam",
      night: "2008 Night",
      you: "sequin",
      me: "stripes",
      note: "hi",
      contact: "@secret.person"
    });
    assert.ok(body.indexOf("LOOKGOOD_MISSED_V1") === 0);
    assert.ok(body.indexOf("@secret.person") !== -1);
    const publicMd = CMS.parseMissedMarkdown(
      '---\nname: "Sam"\nnight: "2008 Night"\nyou: "sequin"\nme: "stripes"\nnote: "hi"\nnumber: 12\nhas_contact: true\ndate: "2026-08-29 12:00:00 -0700"\n---\n'
    );
    assert.ok(!Object.prototype.hasOwnProperty.call(publicMd, "contact"));
    const replyBody = CMS.buildMissedReplyIssueBody({
      post: "12",
      name: "Alex",
      note: "sequin top",
      contact: "@alex"
    });
    assert.ok(replyBody.indexOf("LOOKGOOD_MISSED_REPLY_V1") === 0);
    const reply = CMS.parseMissedReplyIssue("[missed] reply 12", replyBody);
    assert.strictEqual(reply.post, "12");
    assert.strictEqual(reply.contact, "@alex");
    assert.strictEqual(CMS.isMissedReplyTitle("[missed] reply 12"), true);
    assert.strictEqual(CMS.isMissedReplyTitle("[missed]"), false);
    assert.strictEqual(CMS.isMissedReplyTitle("[guestbook]"), false);
    return CMS.deleteMissedEntry("t", "_posts/hack.md", "sha").then(
      function () {
        throw new Error("should reject");
      },
      function (err) {
        assert.ok(/not a missed connections file/i.test(err.message));
      }
    );
  })
);

tests.push(
  test("missed reply inbox joins the original issue contact and can close", function () {
    const calls = [];
    const fakeFetch = function (url, opts) {
      const path = url.replace("https://api.github.com", "");
      calls.push({ path: path, method: opts.method || "GET" });
      let data;
      if (path.indexOf("/issues?state=open") !== -1) {
        data = [
          {
            number: 20,
            title: "[missed] reply 12",
            body: CMS.buildMissedReplyIssueBody({
              post: "12",
              name: "Alex",
              note: "I had the sequin top",
              contact: "@alex"
            })
          },
          { number: 99, title: "Some other issue", body: "nope", pull_request: { url: "x" } }
        ];
      } else if (path.indexOf("/issues/12") !== -1 && (opts.method || "GET") === "GET") {
        data = {
          number: 12,
          title: "[missed]",
          body: CMS.buildMissedIssueBody({
            name: "Sam",
            night: "2008 Night",
            you: "sequin",
            me: "stripes",
            note: "hi",
            contact: "@sam.hide"
          })
        };
      } else if (path.indexOf("/issues/20") !== -1 && opts.method === "PATCH") {
        data = { number: 20, state: "closed" };
      } else {
        data = {};
      }
      return Promise.resolve({
        ok: true,
        text: function () {
          return Promise.resolve(JSON.stringify(data));
        }
      });
    };
    return CMS.listMissedReplies("fake-token-for-test", fakeFetch).then(function (rows) {
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].from, "Alex");
      assert.strictEqual(rows[0].post, "12");
      assert.strictEqual(rows[0].contact, "@alex");
      assert.strictEqual(rows[0].posterName, "Sam");
      assert.strictEqual(rows[0].posterContact, "@sam.hide");
      const dumped = JSON.stringify(calls);
      assert.ok(dumped.indexOf("fake-token-for-test") === -1);
      return CMS.closeIssue("fake-token-for-test", 20, fakeFetch);
    }).then(function (closed) {
      assert.strictEqual(closed.state, "closed");
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
