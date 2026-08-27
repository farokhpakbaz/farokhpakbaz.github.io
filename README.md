# Farokh's personal site

A small personal portfolio built with Hugo. Its visual language is inspired by the focused, code-editor-like atmosphere of musicForProgramming while using an original layout and interaction system.

The optional **focus radio** streams recent mixes directly from
musicForProgramming. Hugo refreshes its episode list from the source RSS feed
at build time, with a local fallback for offline or unavailable builds. Audio is
never loaded or played until a visitor opens the player and presses play. The
player can collapse into a compact controller without interrupting playback,
integrates with browser media controls, remembers position during same-tab site
navigation, and includes a sleep timer.

The optional **Matrix mode** is powered by a deliberately trimmed WebGL runtime
from [Rezmason/matrix](https://github.com/Rezmason/matrix). It offers two
experiences: **Ambient** keeps the website usable over subtle digital rain, while
**Immersive** becomes a full-screen rain-only view. Visitors can tune character
size, color, fall and symbol speed, trails, angle, brightness, contrast, spacing,
bloom, quality, ambient opacity, vignette, scanlines, and an optional lead-glyph
beacon (off by default). Disabling animation freezes the live canvas instead of
substituting a stock image. Controls auto-hide while idle, settings persist
locally, and reduced-motion visitors start with the live canvas paused. Its MIT
license and attribution are included in `static/matrix/`.

Chrome visitors can install **Matrix Immersive** as a Progressive Web App from
the Matrix menu. The installed app launches directly into the fullscreen rain
experience, keeps the existing tuning preferences, and caches its renderer for
later launches.

## Run locally

```sh
hugo server -D
```

Open `http://localhost:1313`.

## Write a new post

Create a Markdown file with Hugo:

```sh
hugo new content notes/my-new-post.md
```

Then edit `content/notes/my-new-post.md`. Update its title and description,
write the article below the front matter, and change `draft: true` to
`draft: false` when it is ready to publish.

Preview drafts locally with:

```sh
hugo server -D
```

Commit and push the Markdown file to `main`. GitHub Actions builds the HTML and
publishes it automatically; generated HTML should not be edited or committed.

## Customize

- Identity, location, status, and links: `hugo.toml`
- Homepage sections: `layouts/index.html`
- About page: `content/about/index.md`
- Blog posts: `content/notes/*.md`
- Visual design: `assets/css/main.css`
- Focus-player fallback data: `data/focus_episodes.json`
- Matrix runtime and fallback: `static/matrix/`
- Matrix PWA manifest and offline worker: `static/matrix-app.webmanifest`, `static/sw.js`

Create a production build with `hugo --gc --minify --cleanDestinationDir`. The
generated site is written to `public/`.

## Deploy

The included GitHub Actions workflow builds and publishes the site after every
push to `main`.

Before the first deployment, open **Settings → Pages → Build and deployment**
and set **Source** to **GitHub Actions**. This setting is required: if the source
is left as **Deploy from a branch**, GitHub runs Jekyll against the repository
root and publishes this README instead of the Hugo build.

After changing the source, run the workflow manually or push a commit to
`main`. Subsequent pushes deploy automatically.

Published at `https://farokhpakbaz.github.io/`.
