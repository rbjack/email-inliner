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

// NOTE:
// Any images will need to me moved (manually) to the 
// "build" directory once gulp has been executed


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


// Format/Clean-up html & css
gulp.task('prettify', ['remove-not-inline-media-query'], function(callback) {
  return gulp.src( 'build/*.html' )
    .pipe( prettify( {
      indent_size: 2,
      indent_inner_html: true,
      wrap_line_length: 0
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

            // resets
            var css = styles.replace(/\r?\n|\r/g, ''); // remove `new lines` &/or `carriage returns`
            css = css.replace(/\s\s+/g, ' ');          // remove more than one space between everything

            // formats
            css = css.replace(/\}\s/g, "\}\n      ");   // add new line to end of selector + spacing
            css = css.replace(/"\>/g, "\"\>\n     ");  // add new line to end of first selector + spacing
            css = css.replace(/  \<\//g, '\<\/');      // remove spacing before end of style tag

            // add new line to end of first selector + spacing inside a media query
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


// add google analytic parameters to links
gulp.task('links', ['css-selector-per-line'], function(callback) {

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

          var utmSource = utmMedium = utmCampaign = "";

          // get meta data attributes
          var utmSourceMatch = data.match('data\-utm\-source\=\"(.*?)\"');
          if (utmSourceMatch !== undefined && utmSourceMatch !== null) { utmSource = utmSourceMatch[1]; }

          var utmMediumMatch = data.match('data\-utm\-medium\=\"(.*?)\"');
          if (utmMediumMatch !== undefined && utmMediumMatch !== null) { utmMedium = utmMediumMatch[1]; }

          var utmCampaignMatch = data.match('data\-utm\-campaign\=\"(.*?)\"');
          if (utmCampaignMatch !== undefined && utmCampaignMatch !== null) { utmCampaign = utmCampaignMatch[1]; }

          // if analytics defined
          if (utmSource !== "" && utmMedium !== "" && utmCampaign !== "") {

            // Links Part 1
            var linkAnchor = data.replace(/<a[^>]*>/g, function(anchorData) {
              return setTracking(anchorData, utmSource, utmMedium, utmCampaign);
            });

            // Links Part 2
            var linkVector = linkAnchor.replace(/<v[^>]*>/g, function(vectorData) {
              return setTracking(vectorData, utmSource, utmMedium, utmCampaign);
            });

            // overwrite email with new modifications
            fs.writeFile(filename, linkVector, function (err) {
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


// Default: start the task cascade
gulp.task('default', ['links'], function(callback) {

  // ready, set, go

});