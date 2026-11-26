# Latest interface update · 26 November 2026

- Media navigation follows the entire occasion in this order: photographs, local videos, YouTube videos, audio, supporting documents. Next/Previous and keyboard/swipe cross media types in place; tabs remain direct shortcuts. A prominent Continue link appears at a media-type boundary. Original media-type URLs stay valid; native players remain user-initiated.
- Restore the earlier header character (serif brand, spaced FOUNDATION lettering, fine divider) and consistent homepage spacing. Reserve caption space across selections so different description lengths do not shift the carousel. Keep useful content and the footer-free layout.

- Footer-free layout across home, inner sections, book and folded-card experiences. Share, contact, About and book edition information live in the More menu.
- Latest clarification: preserve the welcoming homepage headline, Swamiji’s name, selected-category description and a compact Explore link. Remove unnecessary repetition and the footer rather than stripping away useful content. The active card also opens its section. Milestones and contribution totals remain on their cards. The home menu is visibly labelled Menu.
- Inner cards retain concise factual descriptions, authentic titles, prominent amounts and receipt attachments. Descriptions use education-profile introductions, event `cardDescription` (or the event account), and reading leads. Keep context; minimal does not mean empty.
- Everyday Teachings uses subject-specific line illustrations (`visual` and `visualLabel` in the canonical teachings collection) rather than repeating one Swamiji photograph. Preserve the teaching caption as the discovery title. These are visual symbols, not photographs or attributed artwork by Swamiji.
- Phones use swipe and named bottom tabs with pause. Desktop arrows appear on hover/focus. Active cards show an Open/Read/Explore cue on focus/hover, always visible on touch. Back/Home remain accessible inside sections.
- Shared shell: `src/site-shell.js` and `src/minimal-shell.css`. Escape closes More without also leaving a section. Original book opening/page turns, folded cards, calendar filters, in-place galleries and complete receipt pages remain intact.

## Earlier content and navigation decisions

- Keep the earlier light, context-sensitive palettes. The full forest-green redesign was rejected and is not part of the published design.
- Latest direction: every inner discovery section uses the Anugraha Bhashanams format: one centred card, softly visible neighbouring cards from that same section, a short caption and a numbered bottom strip. Keep Back/Home; do not introduce cross-cause previews.
- Introductory scenes show one perspective or occasion at a time. Do not replace them with an archive or folder grid.
- Use the same next/previous, touch and parent-return conventions across scenes. Books retain their opening reader; messages retain their folded-card reader.
- A gallery keeps its shell and native player when changing photos or recordings. Media changes replace the current URL/history entry so browser Back leaves the occasion.
- Enlarged photographs stay in a closable dialog. Persistent Back and Home controls remain visible on inner screens, including mobile; dedicated books/cards have Home links too.
- Education headings use authentic institution names first. Examples: Air Force School, Yelahanka; Shri Gnanambica Degree College; ZP High School, Danavaipeta. Avoid generic headings that hide the institution.
- School awards and Navajeevan are categorized under education. Historical support navigation is scoped to its cause. Annadanam must not cycle into school, medical or temple support. Preserve the distinct original donors and amounts.
- “His Holiness Shankaracharya” introduces Swamiji’s life and spiritual journey. Use the supplied portraits and verified biographical details; early-life dates, initiation and lineage details must be supplied or verified before adding them. Teachings and service retain their own sections.
- Seven homepage cards, in order: His Holiness Shankaracharya; Swamiji’s Teachings; Devotion and Celebration; Support for Vedic Learning; Education Contributions; Annadanam; Medical. The blank eighth item is unassigned. Foundation and care for all life remain reachable separately.
- Show recorded contribution totals on the main homepage cards only. Keep section headers free of cause totals, especially on phones. Do not show calculation explanations. Keep source accounting notes internal; reviewed acknowledgements are attachments.
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
Satsang discovery: `satsangView()` in `src/app.js` and scoped `src/satsang.css`. One full-colour portrait paired with one readable reflection; no faded paper stack or archive grid. Top calendar supports date/month selection; theme filtering is a separate visible control, and keyword search remains available. Only supplied reading dates are enabled (July–November 2026; 29 July remains unavailable). Previous/next respects the selected filter and stops at boundaries. Preserve the edited-reflection label and full reader. Visual references: Poem-a-Day (`https://poets.org/poem-a-day`) and Plum Village (`https://plumvillage.org/mindfulness/mindfulness-practice`); no borrowed imagery or text.

Run source validation, the independent route check, the tests and the build. GitHub Pages uses the manual `Publish website` workflow in `.github/workflows/pages.yml` after a reviewed push to main.

- Hebbal and Viman Nagar institution scenes use actual campus photographs rather than an unrelated Swamiji portrait. Credit/source links are in `education-profiles.json`; source details are in `docs/SCHOOL_PHOTO_SOURCES.json`. These are campus context images, not photographs of a donation or Swamiji visit.

- Donation scenes must use the actual recipient, place or relevant activity; never fall back to an unrelated Swamiji portrait or another school. Govindapuram uses the official Adhishtanam photograph; Shirdi Medical uses the official Sansthan hospital; Shirdi Annadanam uses the official Prasadalaya dining hall. Sources: `docs/DONATION_PHOTO_SOURCES.json`. Education record images resolve through their school profile and event before any shared acknowledgement event. Receipts remain attachments.

- Receipts and acknowledgements use full supplied page frames and proportions. No cropped/rearranged excerpts. Relevant privacy fields are masked in place, and Yelahanka includes both the school letter and the actual receipt. Public PDFs and page previews live in `assets/documents/contributions/`; unchanged source documents remain local in `media/receipt-originals/`.
- The user requested the website critique and then authorised implementation and publication of its fixes. Preserve the reviewed card-based direction; do not revert to archive grids.

- Occasion, school and contribution selectors are persistent numbered strips at the bottom, with horizontal scrolling and an active label. No chooser popup. Scrolling this strip must not advance the main story. Preserve its position when changing stories, and keep the active choice visible. Books use the same numbered strip and centred cover carousel, while retaining the original opening reader. Message cards also use a numbered bottom strip instead of an occasion dropdown; the original folded-card reader is preserved. Reflection search remains a separate search function.

- Yelahanka shows ₹4,00,000 at school level. Its receipt links explicitly distinguish ₹2,00,000 personal support from Swamiji and ₹2,00,000 from Sri Krishna Sudama Religious & Charitable Trust; preserve the original printed donor names and the two independent documents. Hebbal uses the owner-supplied entrance-gate photograph in `assets/media/education/hebbal/campus-user-reference.jpg`.

- All three Shirdi Annadan Fund receipts appear as one Shirdi Annadanam story (`#/record/shirdi-annadanam`), displaying ₹85,186 prominently. Its three full-page receipts remain separate under Receipts. Historical individual record links resolve to that grouped story. The medical fund remains separate. `contributions.json.displayGroups` controls presentation without adding records or double-counting homepage totals.
- Support-story amounts are prominent, in the section accent colour; keep the page heading free of cause-wide totals.


## Review fixes and owner-confirmed milestones · 26 November 2026

- Homepage cards include “52 Chaturmasyas completed” and “8 spiritual books published”, confirmed by the owner. Category `homeMilestone`/`shortTitle` fields drive the labels. Biography remains limited to confirmed facts; initiation/lineage dates are not invented.
- `src/refinements.css` and `src/reader-refinements.css` align readable type, rounded framing, light contextual palettes, hover/pressed/focus feedback and touch targets. Native pointer and reduced motion remain supported. The book keeps its optional night reading theme.
- Homepage choices have named, horizontally movable tabs; manual selection pauses automatic progress briefly, focus/hover pause it, and an explicit pause persists through navigation. Mobile occasion strips retain names on unselected choices. Teaching choices have direct mobile shortcuts.
- Back controls identify their parent, gallery media changes replace history, and the About contact link opens the actual foundation contact dialog. Contribution categories open their support story directly; cross-cause links are removed from contribution details. Photos, videos, audio and full-page receipts keep their original destinations.
- The book opens directly via `reading-room.html?open=1`, with the original opening/page-turn mechanics. Folded-card mechanics remain intact; rotation pauses on interaction and does not restart on closing a card.
- Satsang themes are separate from Calendar. Date filtering and descending date order persist into the full reader and back to the selected preview. Edited-reflection labels remain visible.
- School previews use concise factual introductions; complete context remains in the event descriptions. Gollapalli's displayed image is explicitly identified as the later 78th-birthday celebration. Medical discovery uses the supplied eye-care montage. File-like captions have been replaced by verified visible descriptions or the authentic event name.
- `content/image-variants.json` records complete-frame discovery derivatives in `assets/variants/`. The build includes these dimensions/source choices in the public manifest. Full media and receipt assets are unchanged. In-place gallery changes remove a preceding image's responsive sources before loading a different photograph.
- Eight local recordings now include measured `durationSeconds`; unmeasured dates/durations are not fabricated. Video choices say Watch rather than Read. YouTube links explicitly identify the external destination.
- Builds generate static `visit/` sharing pages for sections, schools, events, contributions and individual Satsangs. Their escaped metadata redirects to the existing route. Footer Share copies that address; meaningful browser titles and active navigation update with the current story.
- Regression checks cover escaped sharing metadata, route preservation, image manifest inclusion and traversal rejection, alongside existing donor/grouping/build checks. Review changes preserve the 12 original giving records, 40 real events, 8 books and 8 message collections.

Final verification: 25 automated tests passed; source and built-site validation passed; all 40 event routes, 8 books, 8 message collections and 12 giving records remain reachable. Browser checks covered 1280px desktop, 390px phone and 320px compact phone layouts, school media changes/history, direct book opening/page turning, folded-card opening/closing, source-date Satsang filtering/order, foundation contact/menu state, grouped Shirdi receipts and a generated school-sharing redirect. Individual recordings were not all played end-to-end.


## Shared inner-card format · latest owner direction

- `sectionSpotlight()` in `src/app.js` and `src/section-spotlight.css` now provide one common, minimal discovery layout for life perspectives, events, Vedic learning, schools, Annadanam, medical support, the teaching gateway, books, Satsangs, practical teachings and the foundation. This replaces the previous separate left/right scene and four-column gateway templates.
- Keep only the section heading, real photograph/book cover, short authentic title and essential date or contribution fact. Source detail remains in the opened gallery/reader or full-page receipt attachments. `frontTitle` and `cardMeta` allow concise display text without rewriting canonical event descriptions.
- Neighbours are other items within the selected scope. A lone foundation card has no invented neighbours. Full readers, folded-card mechanics and media viewers remain functional destinations.
- Reuse the mounted deck when selecting another item, so the same cards physically move to the front. Automatic rotation respects pause, interaction and reduced motion. Selection replaces its URL/history entry; browser Back leaves the section rather than stepping through its rotation history.
- Each main section has a distinct restrained palette in its category JSON: saffron, indigo, peach, muted violet, sage, honey and rose. Preserve authentic media and all original donation figures.
- Satsangs retain Calendar at the top; optional keyword and theme filters sit under Find. Schools and contribution cards keep full original receipt links in the compact Receipts control. Shirdi remains one story with three receipts.
- Explicit picture dimensions and a stable card stage keep photographs visible on small screens. Preserve image proportions; receipt PDFs and original media remain unchanged.

Shared-deck verification: 25 automated tests and all route/build checks passed. Browser checks confirmed in-place card selection and automatic rotation with an unchanged scene, a single browser Back step to the homepage after multiple selections, 320px/390px phone and 1280px desktop layouts, grouped Shirdi receipts, the direct physical book reader, the original blessing cards, and contact open/close.

- Homepage invitation refinement: `#chapter-link` is compact at rest; the action word and arrow reveal with a short transition on hover of the link/active portrait and on keyboard focus. Touch devices show the full action without a hover step. The mobile action stays centred, and the category strip uses local positioning and resize-aware reveal so its selected pill remains visible. Verified resting/focused widths, keyboard reveal and a 390px phone layout.
