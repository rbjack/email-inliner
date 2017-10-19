/********************
 *
 * EMAIL Inliner
 *
 ********************/

var fs        = require( 'fs' );
var glob      = require( 'glob' );
var gulp      = require( 'gulp' );
var inlineCss = require( 'gulp-inline-css' );
var prettify  = require( 'gulp-prettify');


// leave empty "" or choose between "_blank" or "_self" to add to anchor links;
// target attributes already in anchor links will not be overwritten
var linkTargetAttribute = "_blank";


// data attribute, class to be inlined then deleted
var inlineAttribute = "aria-labelledby";


// compose analytic parameter
function getParameters(href, parameters, utm, tag) {

  var utmPatt = new RegExp("^(utm_"+ utm +"\=)", ''),
    param = "";

  if (utmPatt.test(href) === false) {
    if (parameters !== "") { param += "&"; }
    param += "utm_"+ utm +"="+ tag;
  }

  return param;
}

// add tracking to link
function addTracking(href, utmSource, utmMedium, utmCampaign, utmContent) {

  var parameters = "";

  parameters += getParameters(href, parameters, 'campaign', utmCampaign);
  parameters += getParameters(href, parameters, 'source', utmSource);
  parameters += getParameters(href, parameters, 'medium', utmMedium);
  parameters += getParameters(href, parameters, 'content', utmContent);

  if (parameters !== "") {
    return href.replace(/([^#]*)/, function(uri) {

      if (uri.split("?").length <= 1) { parameters = "?"+parameters; }
      else { parameters = "&"+parameters; }

      return uri + parameters;
    });
  } else { return href; }
}

// check to see if tracking needs to be added to link
function setTracking(linkData, utmSource, utmMedium, utmCampaign) {

  var utmContent = href = "";

  // get link data utm content attribute
  var utmContentMatch = linkData.match('data\-utm\-content\=\"(.*?)\"');
  if (utmContentMatch !== undefined && utmContentMatch !== null) { utmContent = utmContentMatch[1]; }

  var hrefMatch = linkData.match('href\=\"(.*?)\"');
  if (hrefMatch !== undefined && hrefMatch !== null) { href = hrefMatch[1]; }

  if (utmContent !== "" && href !== "") {

    return linkData.replace(/href\=\"(.*?)\"/g, function(hrefAttr) {

      var toggle = false, link = hrefAttr;

      if (hrefAttr.substring(hrefAttr.length-1) === '"') {
        toggle = true;
        link = hrefAttr.slice(0, -1);
      }

      var result = addTracking(link, utmSource, utmMedium, utmCampaign, utmContent);
      if (toggle) { result += '"'; }

      return result;
    });

  } else { return linkData; }
}


// ux default override; target attribute
function setTarget(linkData, targetSetting) {
  var values = ['_blank', '_self'];
  var pseudoProtocals = ["mailto", "tel", "javascript", "sms", "geo", "market"];

  // check for any target attribute
  var href = linkData.match('href\=\"(.*?)\"');
  var attribute = linkData.match('target');
  var setting = linkData.match('target\=\"(.*?)\"');
  var value = '_self'; // default

  // is a link...
  if (href !== null && href[1].charAt(0) !== '#') {

    // ... but not a `pseudo-protocal` link
    if (pseudoProtocals.indexOf(href[1].match('^[a-zA-Z0-9]+[^:]')[0]) < 0) {

      // target attribute does exist...
      if (setting !== null) {

        // ... if it's an approved value, then leave as is.
        if (values.indexOf(setting[1]) > -1) {
          value = setting[1];
        }
      }
      // set the value...
      else {

        // ... if it's an apporved value
        if (values.indexOf(targetSetting) > -1) {
          value = targetSetting;
        }
      }

      // modify attribute
      if (attribute !== null) {

        return linkData.replace(/target\=\"(.*?)\"/g, function(targetAttr) {
          return 'target="'+ value +'"';
        });
      }
      // add attribute
      else {

        return linkData.replace(/href/g, 'target="'+ value +'" href');
      }
    }
  }

  return linkData;
}


// Move styles inline except for styles in a media query
gulp.task('inline', function(callback) {

  return gulp.src('./*.html')
    .pipe(inlineCss({
        applyStyleTags: true,
        applyLinkTags: false,
        removeStyleTags: true,
        removeLinkTags: false,
        preserveMediaQueries: true
    }))
    .pipe(gulp.dest('build/'));
});


// Remove the "not inline" media query wrapper
// (so they aren't inlined from the "inliner" task)
gulp.task('remove-not-inline-media-query', ['inline'], function(callback) {

  // loop through all html files
  glob('./build/*.html', function (err, matches) {
    if (err) { return console.log(err); }

    var i, count = 0;

    for(i = 0; i < matches.length; i++) {

      // get the wildcard filename
      var filename = matches[i];

      // enclose the filename inside an IIFE
      (function(filename) {
        return fs.readFile(filename, 'utf8', function (err,data) {
          if (err) { return console.log(err); }

          // regex target all styles in a "not inline" media query
          var result = data.replace(/@media not inline[^{]+\{([\s\S]+?})\s*}/igm, function(match) {

            var css = match.replace(/@media not inline[^{]+\{/g, ''); // remove opening media query
            css = css.replace(/(})\s*}/g, '}'); // remove closing media query

            return css;
          });

          // overwrite email with new modifications
          fs.writeFile(filename, result, function (err) {
            if (err) return console.log(err);

          });

          // if there is more than one email...
          count++;
          if (count >= matches.length) {
            callback(); // ... continue gulp sequence
          }

        });

      })(filename);

    }

  });
});

// add google analytic parameters to links
gulp.task('links', ['remove-not-inline-media-query'], function(callback) {

  // loop through all html files
  glob('./build/*.html', function (err, matches) {
    if (err) { return console.log(err); }

    var i, count = 0;

    for(i = 0; i < matches.length; i++) {

      // get the wildcard filename
      var filename = matches[i];

      // enclose the filename inside an IIFE
      (function(filename) {
        return fs.readFile(filename, 'utf8', function (err, data) {
          if (err) { return console.log(err); }

          var utmSource = "", utmMedium = "", utmCampaign = "",
          utmSourceMatch = data.match('data\-utm\-source\=\"(.*?)\"'),
          utmMediumMatch = data.match('data\-utm\-medium\=\"(.*?)\"'),
          utmCampaignMatch = data.match('data\-utm\-campaign\=\"(.*?)\"');

          // get meta data attributes
          if (utmSourceMatch !== undefined && utmSourceMatch !== null) { utmSource = utmSourceMatch[1]; }
          if (utmMediumMatch !== undefined && utmMediumMatch !== null) { utmMedium = utmMediumMatch[1]; }
          if (utmCampaignMatch !== undefined && utmCampaignMatch !== null) { utmCampaign = utmCampaignMatch[1]; }

          var file = data;

          // if analytics defined
          if (utmSource !== "" && utmMedium !== "" && utmCampaign !== "") {

            // Links Part 1
            file = file.replace(/<a[^>]*>/g, function(anchorData) {
              return setTracking(anchorData, utmSource, utmMedium, utmCampaign);
            });

            // Links Part 2   // i.e.: bulletproof buttons
            file = file.replace(/<v[^>]*>/g, function(vectorData) {
              return setTracking(vectorData, utmSource, utmMedium, utmCampaign);
            });

          }

          // if target attribute defined
          if (linkTargetAttribute !== "") {

            file = file.replace(/<a[^>]*>/g, function(anchorData) {
              return setTarget(anchorData, linkTargetAttribute);
            });

            file = file.replace(/<v[^>]*>/g, function(vectorData) {
              return setTarget(vectorData, linkTargetAttribute);
            });
          }

          // if analytics defined and target attribute configure is true
          if ( (utmSource !== "" && utmMedium !== "" && utmCampaign !== "") || linkTargetAttribute !== "") {

            // overwrite email with new modifications
            fs.writeFile(filename, file, function (err) {
              if (err) return console.log(err);
            });
          }

          // if there is more than one email...
          count++;
          if (count >= matches.length) {
            callback(); // ... continue gulp sequence
          }

        });
      })(filename);
    }
  });
});


//remove inline attribute removals
gulp.task('inline-attribute-removal', ['links'], function(callback) {
  glob('./build/*.html', function (err, matches) {
    if (err) { return console.log(err); }

    var i,
      count = 0,
      attribute = inlineAttribute,
      attPattern = new RegExp(attribute+'\=\"(.*?)\"','g'),
      utmPattern = new RegExp('data-utm-.*?=\".*?\"', 'g'),
      idPattern = new RegExp('data-.+id=\".*?\"', 'g'),
      metaPattern = new RegExp('\<meta(?: {1,9}|)(?:\/|)\>\n', 'g');

    for(i = 0; i < matches.length; i++) {

      // get the wildcard filename
      var filename = matches[i];

      // enclose the filename inside an IIFE
      (function(filename) {
        return fs.readFile(filename, 'utf8', function (err, data) {
          if (err) { return console.log(err); }

          var results = data;

          // Step 1: remove all inline `attribute` selectors
          results = results.replace(attPattern, "");

          // Step 2: remove all GA data-utm attributes
          results = results.replace(utmPattern, "");

          // Step 3: remove data-*id attributes
          results = results.replace(idPattern, "");

          // Step 4: remove empty `meta` tag
          results = results.replace(metaPattern, "");


          // overwrite email with new modifications
          fs.writeFile(filename, results, function (err) {
            if (err) return console.log(err);
          });

          // if there is more than one email...
          count++;
          if (count >= matches.length) {
            callback(); // ... continue gulp sequence
          }

        });

      })(filename);
    }
  });
});


// Format/Clean-up html & css
gulp.task('prettify', ['inline-attribute-removal'], function(callback) {
  return gulp.src( 'build/*.html' )
    .pipe( prettify( {
      indent_size: 2,
      indent_inner_html: true,
      wrap_line_length: 0,
      unformatted: ['a', 'br', 'img', 'span', 'strong']
    } ) )
    .pipe( gulp.dest( 'build' ) );
});


// Reduced css to one line per selector(s)
gulp.task('css-selector-per-line', ['prettify'], function(callback) {

  // loop through all html files
  glob('./build/*.html', function (err, matches) {
    if (err) { return console.log(err); }

    var i, count = 0;

    for(i = 0; i < matches.length; i++) {

      // get the wildcard filename
      var filename = matches[i];

      // enclose the filename inside an IIFE
      (function(filename) {
        return fs.readFile(filename, 'utf8', function (err,data) {
          if (err) { return console.log(err); }

          // regex target all styles
          var result = data.replace(/\<style[^\>]+\>([\s\S]+?\<\/style\>)/igm, function(styles) {

            // resets / minifyish
            var css = styles.replace(/\r?\n|\r/g, ''); // remove `new lines` &/or `carriage returns`
            css = css.replace(/\s\s+/g, ' ');          // remove more than one space between everything

            // formats
            css = css.replace(/\}\s/g, "\}\n      ");   // add new line + spacing to end of selector
            css = css.replace(/"\>/g, "\"\>\n     ");  // add new line + spacing to end of first selector
            css = css.replace(/  \<\//g, '\<\/');      // remove spacing before end of style tag

            // add new line + spacing to end of first selector inside of a media query
            css = css.replace(/@media[^\{]+\{\s/g, function(mq) {
              return mq.replace(/\{\s/g, "\{\n      ");
            });

            // Indent selectors inside @media query
            css = css.replace(/@media[^{]+\{([\s\S]+?})\s*}/igm, function(mq) {

              var format = mq.replace(/\n/g, "\n  ");
              return format.replace(/  \}$/, '\}'); // undo indent at end of media query
            });

            return css;
          });

          // overwrite email with new modifications
          fs.writeFile(filename, result, function (err) {
            if (err) return console.log(err);

          });

          // if there is more than one email...
          count++;
          if (count >= matches.length) {
            callback(); // ... continue gulp sequence
          }

        });

      })(filename);

    }

  });
});

// move image files
gulp.task('images', ['css-selector-per-line'], function(callback) {
  return gulp.src( 'images/**/*' )
    .pipe( gulp.dest( 'build/images' ) );
});

// Default: start the task cascade
gulp.task('default', ['images'], function(callback) {

  // ready, set, go

});
