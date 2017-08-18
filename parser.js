const fs = require('fs-extra');
const path = require('path');
const htmlparser = require('htmlparser2');
const cheerio = require('cheerio');
const uncss = require('uncss');
const postcss = require('postcss');
const discardDupes = require('postcss-discard-duplicates');
const clean = require('postcss-clean');
const commonDir = require('commondir');

function getCSSFromHTML(html, rootDir) {
  const css = [];
  const urls = [];

  const parser = new htmlparser.Parser(
    {
      onopentag: function(name, attribs) {
        currentTag = name;

        if (name === 'link') {
          if (attribs.rel === 'stylesheet') {
            let href = attribs.href;

            if (href.indexOf('http') === -1) {
              href = path.join(rootDir, href);
              css.push(fs.readFileSync(href));
            } else {
              //to-do: fetch stylesheets from external URL
              urls.push(href);
            }
          }
        }
      },
      ontext: function(text) {
        if (currentTag === 'style') {
          css.push(text);
        }
      },
      onclosetag: function(tagname) {
        currentTag = null;
      }
    },
    { decodeEntities: true }
  );

  parser.write(html);
  parser.end();

  return css.join('');
}

function stripTags(html) {
  const $ = cheerio.load(html);
  $('style').remove();
  $('link[rel="stylesheet"]').remove();

  return $.html();
}

function cleanCSS(html, css, config, cb) {
  postcss([clean(config.clean || {}), discardDupes])
    .process(css)
    .then(result => {
      uncss(
        html,
        {
          raw: result.css,
          htmlroot: config.root,
          ignore: config.ignore
        },
        cb
      );
    });
}

function injectCSS(html, css) {
  const $ = cheerio.load(html);
  $('head').append('<style>' + css + '</style>');

  return $.html();
}

module.exports = function(file, outDir, config, cb) {
  // Read the html from the file
  let html = fs.readFileSync(file);

  // Get the CSS from the HTML
  let css = getCSSFromHTML(html, config.root);

  // Get rid of the CSS tags
  html = stripTags(html);

  // Clean up the CSS!
  cleanCSS(html, css, config, (err, cleanedCSS) => {
    if (err) {
      cb(err);
    } else {
      // Add our cleaned CSS to the HTML
      html = injectCSS(html, cleanedCSS);

      const prefix = commonDir([outDir, file]);
      const outFile = path.resolve(path.join(outDir, file.replace(prefix, '')));

      outDir = path.dirname(outFile);

      fs.ensureDirSync(outDir);

      const oldSize = Buffer.byteLength(css, 'utf8');
      const newSize = Buffer.byteLength(cleanedCSS, 'utf8');

      const stats = {
        oldSize: oldSize,
        newSize: newSize,
        percentage: Math.floor(100 - newSize / oldSize * 100) + '%'
      };

      // Write our HTML
      fs.writeFile(outFile, html, () => cb(null, outFile, stats));
    }
  });
};
