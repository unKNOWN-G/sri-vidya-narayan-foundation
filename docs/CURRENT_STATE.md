# Current design and navigation decisions

- Keep the earlier light, context-sensitive palettes. The full forest-green redesign was rejected and is not part of the published design.
- Inside a selected section, show only its current story: no overlapping next-story photograph, cross-section strip, or onward teaser. Keep Back/Home and navigation through the current section’s own items.
- Introductory scenes show one perspective or occasion at a time. Do not replace them with an archive or folder grid.
- Use the same next/previous, touch and parent-return conventions across scenes. Books retain their opening reader; messages retain their folded-card reader.
- A gallery keeps its shell and native player when changing photos or recordings. Media changes replace the current URL/history entry so browser Back leaves the occasion.
- Enlarged photographs stay in a closable dialog. Persistent Back and Home controls remain visible on inner screens, including mobile; dedicated books/cards have Home links too.
- Education headings use authentic institution names first. Examples: Air Force School, Yelahanka; Shri Gnanambica Degree College; ZP High School, Danavaipeta. Avoid generic headings that hide the institution.
- School awards and Navajeevan are categorized under education. Historical support navigation is scoped to its cause. Annadanam must not cycle into school, medical or temple support. Preserve the distinct original donors and amounts.
- Music remains a draft until actual photographs are supplied.

## Files to use for a focused follow-up

Interface: `src/app.js`, `src/experience.css`, `src/index.html`.
Institutions: `content/events/` and `content/categories/education.json`.
Giving: `content/collections/contributions.json` and `content/collections/service-links.json`.
Readers: `src/reading-room.html`, `src/message-cards.html`, canonical `content/collections/cards.json`.

Run source validation, the independent route check, the tests and the build. GitHub Pages uses the manual `Publish website` workflow in `.github/workflows/pages.yml` after a reviewed push to main.
