var assert = require('assert')
var html = require('choo/html')
var classnames = require('classnames')
var clone = require('../utilities/clone')
var deepEqual = require('deep-equal')
var definition = require('./definition')
var details = require('./details')
var find = require('array-find')
var get = require('keyarray').get
var group = require('commonform-group-series')
var improvePunctuation = require('../utilities/improve-punctuation')
var input = require('./input')
var predicates = require('commonform-predicate')
var reference = require('./reference')
var replaceUnicode = require('../utilities/replace-unicode')
var use = require('./use')

module.exports = form

function form (form, send) {
  assert.equal(typeof form.tree, 'object')
  var root = form.path.length === 0
  var formKey = root ? [] : ['form']
  var tree = root ? form.tree : form.tree.form
  var groups = group(clone(tree))
  var isFocused = deepEqual(form.focused, form.path)
  var annotationsHere = get(
    form.annotations,
    formKey.concat('annotations'),
    []
  )
  var classes = classnames({
    conspicuous: 'conspicuous' in tree,
    focused: isFocused
  })

  var setHeading = function (newValue) {
    send('form:heading', {
      path: form.path,
      heading: newValue
    })
  }

  var offset = 0
  return html`
    <section
        class="${classes}"
        data-digest="${form.merkle.digest}"
        ondblclick=${toggleFocus}>
      ${root ? null : sectionButton(toggleFocus)}
      ${root ? null : heading(form.mode, form.tree.heading, setHeading)}
      ${
        isFocused
        ? details(form.merkle.digest, annotationsHere, send)
        : null
      }
      ${
        marginalia(
          tree, form.path, form.blanks,
          annotationsHere, toggleFocus
        )
      }
      ${groups.map(function (group) {
        var groupState = {
          mode: form.mode,
          blanks: form.blanks,
          data: group,
          annotations: get(form.annotations, formKey, {}),
          focused: form.focused,
          offset: offset,
          path: form.path.concat(formKey)
        }
        var renderer
        if (group.type === 'series') {
          renderer = series
          groupState.merkle = form.merkle
        } else renderer = paragraph
        var result = renderer(groupState, send)
        offset += group.content.length
        return result
      })}
    </section>
  `

  function toggleFocus (event) {
    event.stopPropagation()
    send('form:focus', {path: isFocused ? null : form.path})
  }
}

function sectionButton (toggleFocus) {
  return html`
    <a class=sigil
      onclick=${toggleFocus}
      title="Click to focus.">§</a>
  `
}

function marginalia (tree, path, blanks, annotations, toggleFocus) {
  var hasError = annotations.some(function (a) {
    return a.level === 'error'
  })
  var hasAnnotation = annotations.some(function (a) {
    return a.level !== 'error'
  })
  var hasBlank = tree.content.some(function (element, index) {
    return (
      predicates.blank(element) &&
      !blanks.some(function (direction) {
        return deepEqual(
          direction.blank,
          path.concat('form', 'content', index)
        )
      })
    )
  })
  return html`
    <aside class=marginalia onclick=${toggleFocus}>
      ${hasError ? html`<a class=flag>\u26A0</a>` : null}
      ${hasAnnotation ? html`<a class=flag>\u2690</a>` : null}
      ${hasBlank ? html`<a class=flag>\u270D</a>` : null}
    </aside>
  `
}

function heading (mode, heading, send) {
  if (mode === 'edit') {
    return html`
      <input
          type=text
          class=heading
          placeholder="Click to add heading"
          id="Heading:${heading}"
          onchange=${function (event) {
            send(event.target.value)
          }}
          value=${heading || ''}/>
    `
  } else {
    if (heading) {
      return html`
        <p
            class=heading
            id="Heading:${heading}"
          >${heading}</p>
      `
    } else {
      return null
    }
  }
}

function series (state, send) {
  return state.data.content.map(function (child, index) {
    var absoluteIndex = index + state.offset
    var pathSuffix = ['content', absoluteIndex]
    var result = form(
      {
        mode: state.mode,
        blanks: state.blanks,
        tree: child,
        annotations: get(
          state.annotations, ['content', absoluteIndex], {}
        ),
        merkle: state.merkle.content[absoluteIndex],
        focused: state.focused,
        path: state.path.concat(pathSuffix)
      },
      send
    )
    return result
  })
}

function paragraph (state, send) {
  return html`
    <p class=text>
      ${
        state.data.content.map(function (child, index) {
          if (predicates.text(child)) {
            return html`<span>${improvePunctuation(child)}</span>`
          } else if (predicates.use(child)) {
            return use(child.use)
          } else if (predicates.definition(child)) {
            return definition(child.definition)
          } else if (predicates.blank(child)) {
            var childPath = state.path
            .concat(['content', state.offset + index])
            return blank(state.blanks, childPath, send)
          } else if (predicates.reference(child)) {
            return reference(child.reference)
          }
        })
      }
    </p>
  `
}

function blank (blanks, path, send) {
  var direction = find(blanks, function (element) {
    return deepEqual(element.blank, path)
  })
  var value = direction
  ? improvePunctuation(direction.value)
  : ''
  return input(
    value,
    function (value) {
      send('form:blank', {
        path: path,
        value: replaceUnicode(value)
      })
    },
    function () {
      send('form:blank', {
        path: path,
        value: null
      })
    }
  )
}