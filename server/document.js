const fs = require("fs");
const path = require("path");

const express = require("express");

const { Document, slugToFolder } = require("../content");
const { buildDocument } = require("../build");
const { BUILD_OUT_ROOT } = require("../build/constants");

const router = express();

router.post("/", (req, res) => {
  const { rawHTML, metadata } = req.body;
  Document.create(rawHTML, metadata);
  res.sendStatus(201);
});

function withDocument(req, res, next) {
  if (!req.query.url) {
    return res.status(400).send("No ?url= query param");
  }
  const document = Document.findByURL(req.query.url.toLowerCase());
  if (!document) {
    return res.status(404).send(`No document by the URL ${req.query.url}`);
  }
  req.document = document;
  next();
}

router.put("/fixfixableflaws", withDocument, async (req, res) => {
  if (req.document.isArchive) {
    return res.status(400).send("Can't fix archived documents");
  }
  // To get the 'doc' we have to find the built art
  await buildDocument(req.document, {
    fixFlaws: true,
    fixFlawsVerbose: true,
  });

  // Just because you *build* document, doesn't mean it writes the new
  // built content to disk. So, if *was* already built, with all the flaws
  // in place, it won't be written to disk until you use the build CLI next.
  // Also, when viewing documents it will fetch the `./index.json` on the
  // fly and if it's already present on disk it won't refresh from the
  // server dynamically. So, delete any possible copies of this from disk.
  const outPath = path.join(BUILD_OUT_ROOT, slugToFolder(req.document.url));
  if (fs.existsSync(path.join(outPath, "index.html"))) {
    fs.unlinkSync(path.join(outPath, "index.html"));
  }
  if (fs.existsSync(path.join(outPath, "index.json"))) {
    fs.unlinkSync(path.join(outPath, "index.json"));
  }

  res.sendStatus(200);
});

router.get("/", withDocument, (req, res) => {
  res.json(req.document);
});

router.put("/", withDocument, async (req, res) => {
  const { rawHTML, metadata } = req.body;
  if (metadata.title && rawHTML) {
    Document.update(
      req.document.fileInfo.folder,
      rawHTML.trim() + "\n",
      metadata
    );
  }
  res.sendStatus(200);
});

router.delete("/", withDocument, (req, res) => {
  Document.del(req.document.fileInfo.folder);
  res.sendStatus(200);
});

module.exports = router;
