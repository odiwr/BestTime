# Security

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Use GitHub's [private vulnerability reporting](https://github.com/odiwr/BestTime/security/advisories/new) instead. You should get a response within a few days.

## What is in scope

BestTime renders content from a URL the page author chose, so the interesting
questions are about what that content can do:

- **Sheet content becoming markup or script.** Every field from a source is
  written with `textContent`, never `innerHTML`. A row that contains
  `<script>` must render as those literal characters. If it does not, that is
  a vulnerability.
- **Media URLs.** Embeds are sandboxed iframes and images with
  `referrerPolicy="no-referrer"`. A `javascript:` or `data:` URL in a Media
  column must not become a navigation or a script.
- **Escaping the shadow root.** Styles and behaviour should stay inside the
  element.
- **The published-sheet URL rewriter.** `toCsvUrl` must not be steerable into
  requesting something the page author did not intend.

## What is not in scope

- The contents of a sheet you published yourself. BestTime shows what the sheet
  says; deciding what to put in it is the author's job.
- Third-party embed hosts (YouTube, Wikipedia and so on) doing something
  undesirable inside their own sandboxed iframe.
- Rate limits or downtime at Google's CSV endpoint.

## Supported versions

The latest minor release gets fixes. This project is young enough that there is
no long-term support branch yet.
