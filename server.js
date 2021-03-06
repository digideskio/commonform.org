var fs = require('fs')
var http = require('http')
var replace = require('stream-replace')
var url = require('url')

var release = '/releases/development/'
var ecstatic = require('ecstatic')({
  root: 'build',
  baseDir: 'releases/development',
  cache: 0
})

function serveIndex (response) {
  response.setHeader('Content-Type', 'text/html')
  fs.createReadStream('build/index.html')
  .pipe(replace(/RELEASE\//g, release))
  .pipe(response)
}

http
.createServer(function (request, response) {
  response.setHeader(
    'Cache-Control', 'no-cache, no-store, must-revalidate'
  )
  response.setHeader('Pragma', 'no-cache')
  response.setHeader('Expires', '0')
  var pathname = url.parse(request.url).pathname
  if (pathname === '/') {
    serveIndex(response)
  } else if (
    pathname.startsWith('/forms/') ||
    pathname.startsWith('/publications/') ||
    pathname.startsWith('/publishers') ||
    pathname.startsWith('/search')
  ) {
    serveIndex(response)
  } else {
    ecstatic(request, response)
  }
})
.listen(8000)
