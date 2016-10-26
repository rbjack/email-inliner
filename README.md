## HTML Email Inliner

The `gulpfile.js` is a task runner to inline the css styles in a HTML email.

## Requirements

You will need to have Node, Gulp, and Gulp Command line installed on your computer
to use the task runner. The requirements are necessary to install the development 
dependancies to run the Gulp file task runner.

## Install requirements

If you don't already have it, download the appropriate [Node software](https://nodejs.org/en/) for 
your computer. Once it is loaded, open up a terminal/command prompt and install a version of
Gulp and the Gulp Command line globally

```
$ npm install --global gulp
```

```
$ npm install --global gulp-cli
```

## Install development dependancies

Navigate to your email directory that contains your HTML email and more importantly, your
package.json file. That file will be used to install the appropriate scripts required by 
the task runner.

```
$ npm install
```

## Directions to render inlined email

You will use the terminal/command prompt to inline all files that have a `.html` extension into
a build folder inside your development directory. Typing in the below command will generate
the compiled file(s).


```
$ gulp
```

## Setup HTML email to inline styles

The inliner requires that your css styles are embedded into the HTML head of the document in
a style tag.

It will inline all styles, in a seperate file inside a `build` folder, and then delete them from 
the new rendered email file, except in the case where the styles are in a `@media` query. If there 
are styles that you don't want inlined outside of a media query, the task runner has a special media 
query wrapper that gets deleted (but not the styles inside) when compiled.

```
@media not inline {
	/* not inlined styles go here */
}
```

This will allow you to use a browser for development and see the styles implemented.


## Configure HTML email to Dynamically add Google Analytic Tracking

In the head of the HTML file there is a meta tag that has a set of unique data attributes
that can be modified to allow for the tracking. Changing the following attributes to correlate to the 
tracking parameters: `data-utm-source`, `data-utm-medium` and `data-utm-campaign`.

```
<meta data-utm-campaign="campaign" data-utm-source="newsletter" data-utm-medium="email" />
```

In the anchor tag add the content tracking data attribute `data-utm-content`

```
<a data-utm-content="unique" href="http://www.example.com/#sample">
```

When the gulpfile activates the task runner, and if all data attributes are set, it will add the formatted 
tracking parameters to the url.

```
<a data-utm-content="unique" href="http://www.example.com/?utm_campaign=campaign&utm_source=newsletter&utm_medium=email&utm_content=unique#sample">
```