---
title: Building a quieter personal website
date: 2026-08-18
description: Notes on making a personal site that feels like a place, not a feed.
---

Personal websites are a rare chance to design without a conversion funnel. They can be small, specific, and unmistakably human. This one began with a simple constraint: make it feel like a focused workspace.

## Start with atmosphere

The visual system borrows from code editors without pretending to be one. Monospaced type, syntax-like colors, line numbers, and compact metadata create the atmosphere. The hierarchy still behaves like a conventional editorial site, so the interface stays legible and familiar.

The dark surface is not pure black, the text is not pure white, and the green is used sparingly. Small differences matter when almost every element is made of type and rules.

## Keep the machinery small

Hugo fits the project well: content lives in plain Markdown, templates stay readable, and the result is static HTML. There is no client-side framework and the only JavaScript handles the theme switch and local clock.

```text
content → templates → static HTML
```

That makes the site inexpensive to host, quick to load, and straightforward to keep for a long time.

## Leave room to grow

A personal site is never really finished. The useful goal is a structure that makes the next project or note easy to add. A good system gets out of the way of publishing.

