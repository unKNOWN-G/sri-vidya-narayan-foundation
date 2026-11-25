# Current design and navigation decisions

- Keep the earlier light, context-sensitive palettes. The full forest-green redesign was rejected and is not part of the published design.
- Inside a selected section, show only its current story: no overlapping next-story photograph, cross-section strip, or onward teaser. Keep Back/Home and navigation through the current section’s own items.
- Introductory scenes show one perspective or occasion at a time. Do not replace them with an archive or folder grid.
- Use the same next/previous, touch and parent-return conventions across scenes. Books retain their opening reader; messages retain their folded-card reader.
- A gallery keeps its shell and native player when changing photos or recordings. Media changes replace the current URL/history entry so browser Back leaves the occasion.
- Enlarged photographs stay in a closable dialog. Persistent Back and Home controls remain visible on inner screens, including mobile; dedicated books/cards have Home links too.
- Education headings use authentic institution names first. Examples: Air Force School, Yelahanka; Shri Gnanambica Degree College; ZP High School, Danavaipeta. Avoid generic headings that hide the institution.
- School awards and Navajeevan are categorized under education. Historical support navigation is scoped to its cause. Annadanam must not cycle into school, medical or temple support. Preserve the distinct original donors and amounts.
- “His Holiness Shankaracharya” introduces Swamiji’s life and spiritual journey. Use the supplied portraits and verified biographical details; early-life dates, initiation and lineage details must be supplied or verified before adding them. Teachings and service retain their own sections.
- Seven homepage cards, in order: His Holiness Shankaracharya; Swamiji’s Teachings; Devotion and Celebration; Support for Vedic Learning; Education Contributions; Annadanam; Medical. The blank eighth item is unassigned. Foundation and care for all life remain reachable separately.
- Do not show cause totals on opening cards or section headers. Do not show calculation explanations. Keep source accounting notes internal; reviewed acknowledgements are attachments.
- Education uses one institution per scene, starting with supplied photographs: Yelahanka, Gollapalli, Danavaipeta, A. Kothakota, Chandra Colony, SGDC, Navajeevan, then Hebbal and Viman Nagar. `content/collections/education-profiles.json` controls these scenes.
- School service includes personal visits, blessings and motivation. Never imply every school received a donation or show a missing-amount label for a visit. Show amounts only for confirmed financial support; preserve original donor attribution and approximate qualifiers.
- Owner-confirmed activities: Danavaipeta pens for all Class 10 students; Chandra Colony chocolate distribution; SGDC interaction and awareness. Owner-confirmed Gollapalli history: Swamiji donated nearly three acres for the school in 2004; Air Marshal B. K. Pandey arrived by helicopter to inaugurate it. No land valuation is supplied. The photographs show the school community’s later celebration of Swamiji’s 78th birthday, not the 2004 inauguration.
- Teachings lead to Satsangs, books and Anugraha Bhashanams; retain the existing book and folded-card experiences.
- Music remains a draft until actual photographs are supplied.

## Files to use for a focused follow-up

Interface: `src/app.js`, `src/experience.css`, `src/index.html`.
Institutions: `content/events/` and `content/categories/education.json`.
Giving: `content/collections/contributions.json` and `content/collections/service-links.json`.
Readers: `src/reading-room.html`, `src/message-cards.html`, canonical `content/collections/cards.json`.

Run source validation, the independent route check, the tests and the build. GitHub Pages uses the manual `Publish website` workflow in `.github/workflows/pages.yml` after a reviewed push to main.

- Hebbal and Viman Nagar institution scenes use actual campus photographs rather than an unrelated Swamiji portrait. Credit/source links are in `education-profiles.json`; source details are in `docs/SCHOOL_PHOTO_SOURCES.json`. These are campus context images, not photographs of a donation or Swamiji visit.

- Donation scenes must use the actual recipient, place or relevant activity; never fall back to an unrelated Swamiji portrait or another school. Govindapuram uses the official Adhishtanam photograph; Shirdi Medical uses the official Sansthan hospital; Shirdi Annadanam uses the official Prasadalaya dining hall. Sources: `docs/DONATION_PHOTO_SOURCES.json`. Education record images resolve through their school profile and event before any shared acknowledgement event. Receipts remain attachments.

- Receipts and acknowledgements use full supplied page frames and proportions. No cropped/rearranged excerpts. Relevant privacy fields are masked in place, and Yelahanka includes both the school letter and the actual receipt. Public PDFs and page previews live in `assets/documents/contributions/`; unchanged source documents remain local in `media/receipt-originals/`.
- The user deferred the website critique: do not begin it until they explicitly ask again.

- Occasion, school and contribution selectors are persistent numbered strips at the bottom, with horizontal scrolling and an active label. No chooser popup. Scrolling this strip must not advance the main story. Preserve its position when changing stories, and keep the active choice visible. Books retain the visible cover strip. Message cards also use a numbered bottom strip instead of an occasion dropdown; the original folded-card reader is preserved. Reflection search remains a separate search function.
