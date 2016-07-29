var html = require('choo/html')

module.exports = function () {
  return html`
    <footer>
      <p>
        <a href="http://typographyforlawyers.com/equity.html">
          Equity
        </a>
        and
        <a href="http://typographyforlawyers.com/triplicate.html">
          Triplicate
        </a>
        typefaces by
        <a href="http://typographyforlawyers.com/about.html">
          Matthew Butterick
        </a>.
      </p>
      <p>
        <a class=openSource>
          Common Form is open-source software.
        </a>
      </p>
    </footer>
  `
}
