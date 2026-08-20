# Farokh's personal site

A small personal portfolio built with Hugo. Its visual language is inspired by the focused, code-editor-like atmosphere of musicForProgramming while using an original layout and interaction system.

The optional **focus radio** streams a curated set of recent mixes directly from musicForProgramming. Audio is never loaded or played until a visitor opens the player and presses play.

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

Create a production build with `hugo --minify`. The generated site is written to `public/`.

## Deploy

The included GitHub Actions workflow builds and publishes the site after every push to `main`. In the repository settings, choose **GitHub Actions** as the Pages source once; subsequent pushes deploy automatically.

Published at `https://farokhpakbaz.github.io/`.
