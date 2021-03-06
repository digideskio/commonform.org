var Clipboard = require('clipboard')
var EventEmitter = require('events').EventEmitter
var assert = require('assert')
var assign = require('object-assign')
var browserModel = require('./models/browser')
var compare = require('./views/compare')
var formModel = require('./models/form')
var level = require('./level')
var loading = require('./views/loading')
var notFound = require('./views/not-found')
var pathOf = require('pathname-match')
var projects = require('./views/projects')
var publishers = require('./views/publishers')
var read = require('./views/read')
var runParallel = require('run-parallel')
var searchModel = require('./models/search')
var searchView = require('./views/search')
var showError = require('./views/error')
var yo = require('yo-yo')

// State
var form = {}
var browser = {}
var search = {}
var state = {
  browser: browser,
  form: form,
  search: search
}

// Data Modeling

var actions = new EventEmitter()
.on('error', function (error) {
  console.error(error)
  window.alert(error.toString())
})

function action (/* variadic */) {
  var event = arguments[0]
  assert(
    actions.listenerCount(event) > 0,
    'no listeners for action ' + event
  )
  actions.emit.apply(actions, arguments)
}

var reductions = new EventEmitter()
var initializers = {}

function useModel (scope, model) {
  model(initialize(scope), reduce(scope), handle(scope))

  function initialize (scope) {
    return function (initializer) {
      initializers[scope] = initializer
      assign(state[scope], initializer())
    }
  }

  function reduce (scope) {
    return function (event, handler) {
      event = scope + ':' + event
      assert.equal(typeof event, 'string', 'event is a string')
      assert(event.length !== 0, 'event is not empty')
      assert.equal(
        reductions.listenerCount(event), 0,
        'just one listener for ' + event
      )
      reductions.on(event, function (data) {
        assign(state[scope], handler(data, state[scope]))
      })
    }
  }

  function handle (scope) {
    return function (event, handler) {
      assert.equal(typeof event, 'string', 'event is a string')
      assert(event.length !== 0, 'event is not empty')
      event = scope + ':' + event
      assert.equal(
        actions.listenerCount(event), 0,
        'just one listener for ' + event
      )
      actions.on(event, function (data) {
        handler(data, state[scope], send, callback)
        function send (event, data) {
          event = scope + ':' + event
          assert(
            reductions.listenerCount(event) > 0,
            'no listeners for ' + event
          )
          reductions.emit(event, data)
        }
        function callback (error) {
          if (error) {
            action('error', error)
          }
          update()
        }
      })
    }
  }
}

function resetStates (scopes) {
  scopes.forEach(function (scope) {
    assign(state[scope], initializers[scope]())
  })
}

useModel('form', formModel)
useModel('browser', browserModel)
useModel('search', searchModel)

// Rendering

var rendered

function render () {
  if (state.error) {
    return showError(state.error)
  } else {
    var path = pathOf(window.location.href)
    var publisher
    var split
    if (path === '' || path === '/') {
      resetStates(['form', 'search'])
      return publishers(browser, action)
    } else if (startsWith('/forms/')) {
      resetStates(['browser', 'search'])
      var suffix = path.substring(7)
      split = suffix.split('/')
      var digest = split[0]
      if (split[1]) {
        return compare(digest, split[1], form, action)
      } else {
        return read(digest, form, action)
      }
    } else if (startsWith('/search')) {
      resetStates(['browser', 'form'])
      split = path.split('/')
      return searchView(
        decode(split[2]), decode(split[3]), search, action
      )
    } else if (path === '/publishers' || path === '/publishers') {
      resetStates(['form', 'search'])
      return publishers(browser, action)
    } else if (startsWith('/publishers/')) {
      resetStates(['form', 'search'])
      publisher = decodeURIComponent(path.substring(12))
      return projects(publisher, browser, action)
    } else if (startsWith('/publications/')) {
      resetStates(['form', 'search'])
      var match = new RegExp(
        '^' +
        '/publications' +
        '/([^/]+)' + // publisher
        '/([^/]+)' + // project
        '(/[^/]+)?' + // edition
        '$'
      ).exec(path)
      if (!match) {
        return notFound()
      } else {
        return loading(form.mode, function () {
          action('form:load publication', {
            publisher: decodeURIComponent(match[1]),
            project: decodeURIComponent(match[2]),
            edition: match[3]
              ? decodeURIComponent(match[3].substring(1))
              : 'current'
          })
        })
      }
    } else {
      return notFound()
    }
  }
  function startsWith (prefix) {
    return path.indexOf(prefix) === 0
  }
}

function decode (argument) {
  return argument ? decodeURIComponent(argument) : argument
}

function update () {
  yo.update(rendered, render())
}

// History

// Trap hyperlinks.
window.addEventListener('click', function (event) {
  if (event.which === 2) {
    return
  }
  function findLocalLinkAnchor (node) {
    if (!node) {
      return undefined
    } else {
      var checkParent = (
        !node ||
        node.localName !== 'a' ||
        node.href === undefined ||
        window.location.host !== node.host
      )
      return checkParent ? findLocalLinkAnchor(node.parentNode) : node
    }
  }
  var node = findLocalLinkAnchor(event.target)
  if (node) {
    event.preventDefault()
    var path = pathOf(node.href)
    window.history.pushState({}, null, path)
    update()
  }
})

window.addEventListener('popstate', update)

// Copy Links

new Clipboard('.copy')
.on('success', function (event) {
  window.alert('Copied')
  event.clearSelection()
})

if (module.parent) {
  module.exports = render
} else {
  // Load Settings
  runParallel([
    function (done) {
      level.get('settings.annotators', function (error, data) {
        if (!error && data) {
          try {
            var annotators = JSON.parse(data)
            reductions.emit('form:annotators', annotators)
          } catch (error) {
            console.error(error)
          }
        }
        done()
      })
    },
    function (done) {
      level.get('settings.numbering', function (error, data) {
        if (!error && data) {
          try {
            var name = JSON.parse(data)
            reductions.emit('form:numbering', {name: name})
          } catch (error) {
            console.error(error)
          }
        }
        done()
      })
    }
  ], function () {
    rendered = render()
    document.body.appendChild(rendered)
  })
}
