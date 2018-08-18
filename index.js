#! /usr/bin/env node

var fs = require('fs');
var dir = require('node-dir');
var path = require('path')
var marked = require('marked');
var mkdirp = require('mkdirp');
var shell = require('shelljs');

var argv = require('minimist')(process.argv.slice(2));

var root = "/home/sfrees/projects/ramapo/";;//process.cwd();
var source_path = "/home/sfrees/projects/ramapo/source/";//path.join(root, "/source/");
var site_path = "/home/sfrees/projects/ramapo/site/";//path.join(root, "/site/");

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  }
  catch (err) {
    return false;
  }
}

var check_pass = function () {
  if (!fileExists(".ftppass")) {
    console.log([
      "You need a .ftppass file at the root of this project.",
      "It should contain the following: ",
      '"key1": {',
      '   "username": "best_user_ever",',
      '   "password": "best_password_ever"',
      '}'
    ].join("\n"));
    process.exit();
  }
}

var deploy = function () {

  check_pass();
  var touch = require("touch");
  touch.sync(path.join(root, "Gruntfile.js"));

  var webconfig = require(path.join(root, 'webconfig.json'));
  var grunt = require('grunt');


  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    'sftp-deploy': webconfig["sftp-deploy"]
  });

  grunt.loadNpmTasks('grunt-sftp-deploy');
  grunt.tasks(['sftp-deploy']);
}

var build = function () {
  marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: true,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: false
  });

  var ignore = require('ignore');
  var patterns = fs.readFileSync(path.join(root, ".gitignore"), "utf-8").split("\n");
  var ig = ignore().addPattern(patterns);


  shell.rm('-rf', site_path + "/*");

  // copy script and css source files to site
  var content = path.join(root, '/mix/', "/content/");
  shell.cp("-r", content, site_path);

  // build markup content
  var html_open = "<!doctype html><html><body class='markdown-body'>";
  var html_close = "</body></html>";
  var head = fs.readFileSync(path.join(root, '/mix/head.html'), "utf-8")

  function build(f) {
    var markdown = fs.readFileSync(f, "utf-8");
    var html = marked(markdown);

    var rel_to_source_root = path.relative(path.dirname(f), source_path);
    if (rel_to_source_root.length > 0) {
      rel_to_source_root += "/";
    }
    var local_head = head.replace("[@root]", function () { return rel_to_source_root });

    var page = html_open + local_head + html + html_close;

    var filename = path.join(path.dirname(f), path.basename(f, ".md") + ".html");
    var file_base = path.relative(source_path, filename);
    var out_filename = path.join(site_path, file_base);
    var out_dir = path.dirname(out_filename);



    mkdirp(out_dir, function (err) {
      if (err) console.error(err)
      else {
        fs.writeFile(out_filename, page, {}, function (err) {
          if (err) throw err;
          console.log("Built " + out_filename);
        })
      }
    });
  }


  dir.files(source_path, function (err, files) {
    if (err) throw err;
    files.forEach(function (f) {
      var copy = ig.filter([f]).length > 0;
      if (path.extname(f) == '.md') {
        build(f);
      }
      else if (copy) {
        console.log("Copying " + f);
        var file_base = path.relative(source_path, f);
        var out_filename = path.join(site_path, file_base);
        var out_dir = path.dirname(out_filename);
        mkdirp(out_dir, function (err) {
          shell.cp(f, out_filename);
        });
      }
      else {
        console.log("Ignoring " + f);
      }
    });
  });

}

if (argv._.length == 0) {
  console.log("You need to either build or deploy!");
}
else if (argv._[0] == 'deploy') {
  deploy();
}
else if (argv._[0] == 'build') {
  build();
  console.log("Run locally - npm install http-server -g");
}
else {
  console.log(argv._[0] + " is a bogus command... you can either build or deploy")
}
