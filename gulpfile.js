'use strict';

var gulp = require('gulp'),
    jshint = require('gulp-jshint'),
    concat = require('gulp-concat'),
    rimraf = require('gulp-rimraf'),
    sass = require('gulp-sass'),
    autoprefixer = require('gulp-autoprefixer'),
    open = require('open'),
    notify = require('gulp-notify'),
    file = require('gulp-file'),
    ghPages = require('gulp-gh-pages');

// Modules for webserver and livereload
var express = require('express'),
    refresh = require('gulp-livereload'),
    livereload = require('connect-livereload'),
    livereloadport = 35725,
    serverport = 4000;

// Set up an express server (not starting it yet)
var server = express();
// Add live reload
server.use(livereload({port: livereloadport}));
// Use our 'dist' folder as rootfolder
server.use(express.static('./dist'));
// Because I like HTML5 pushstate .. this redirects everything back to our index.html
server.all('/*', function(req, res) {
  res.sendFile('index.html', { root: 'dist' });
});

// Dev task
gulp.task('build', ['views', 'images', 'scripts', 'styles', 'lint'], function() { });

// JSHint task
gulp.task('lint', function() {
  gulp.src('app/scripts/*.js')
  .pipe(jshint())
  .pipe(jshint.reporter('default'));
});

// views
gulp.task('views', function() {
  gulp.src('app/*.html')
    .pipe(gulp.dest('dist/'))
});

// images
gulp.task('images', function() {
  gulp.src(['app/images/**/*.png','app/images/**/*.svg','app/images/**/*.jpg','app/images/**/*.gif'])
    .pipe(gulp.dest('dist/images'))
});

// scripts
gulp.task('scripts', function() {
  gulp.src('app/scripts/*.js')
    .pipe(gulp.dest('dist/scripts'))
});

// Styles task
gulp.task('styles', function() {
  gulp.src('app/styles/*.sass')
  // The onerror handler prevents Gulp from crashing when you make a mistake in your SASS
  .pipe(sass({
    includePaths: [
      'app/styles'
    ]
  }).on("error", notify.onError(function (error) {
    return "Error: " + error.message;
   }))) 
  // Optionally add autoprefixer
  .pipe(autoprefixer('last 2 versions', '> 1%', 'ie 8'))
  // These last two should look familiar now :)
  .pipe(gulp.dest('dist/styles/'));
});

gulp.task('watch', ['lint'], function() {
  // Start webserver
  server.listen(serverport);

  // Start live reload
  refresh.listen(livereloadport);

  // Watch our scripts, and when they change run lint and browserify
  gulp.watch(['app/scripts/*.js', 'app/scripts/**/*.js'],[
    'lint',
  ]);

  // Watch our sass files
  gulp.watch(['app/styles/**/*.sass'], [
    'styles'
  ]);


  // Watch our scripts files
  gulp.watch(['app/scripts/**/*.js'], [
    'scripts'
  ]);

  // Watch our template files
  gulp.watch(['app/**/*.html'], [
    'views'
  ]);

  // Watch our images files
  gulp.watch(['app/images/**/*.png','app/images/**/*.svg','app/images/**/*.jpg','app/images/**/*.gif'], [
    'images'
  ]);

  // refresh if changed
  gulp.watch('dist/**').on('change', refresh.changed);
});

gulp.task('open-browser', ['watch'], function(){
  open('http://0.0.0.0:4000');
});

gulp.task('deploy', function() {
  return gulp.src('./dist/**/*').pipe(ghPages());
});

gulp.task('default', ['build', 'watch', 'open-browser']);
