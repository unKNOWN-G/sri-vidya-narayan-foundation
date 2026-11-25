# Experience skeleton — the tribute

## Main goal
Help a visitor feel who Swamiji is, choose a side of his life, and enter a meaningful moment. The foundation hosts the tribute. The visible experience is composed scenes, living photographs, books and cards. Repository folders are an editorial concern only.

## Permanent navigation
**Meet Swamiji** · **His Life in Action** · **Learn Swamiji’s Teachings** · **The Foundation**

Every scene has a visible parent/return route. An open occasion returns to its selected story, an open book returns to Books, and an open message returns to the same selected card. The homepage remains one fixed portrait scene with neighbouring perspectives visible, automatic motion, colour changes and pause.

## Page skeleton and its job

| Page / scene | Main goal | What appears here | Primary action / destination | Other connections |
|---|---|---|---|---|
| Meet Swamiji | Reveal several sides at first glance | Actual portraits rotating smoothly; concise action-led caption; warm changing ambience | Meet this side → its story scene | His Life in Action; Learn Swamiji’s Teachings; Foundation |
| His Life in Action | Let a visitor choose a human interest | One generous photograph and story at a time; visible neighbouring scenes; a compact choice of perspectives | Enter this story → occasion | Direct jump between perspectives; return to portraits |
| His Holiness Shankaracharya | Understand the spiritual guide | Portrait and journey, archival photograph, Swamiji Stuti, birthday gathering | Open a moment → photograph, Stuti, occasion | Devotion & celebrations; Learn the teachings |
| Education | Show encouragement and support in real settings | School visits, student interactions, SGDC college visit | Step into a visit → full occasion | Relevant support note behind story; Teachings |
| Vedic Learning & Parayanam | Connect learning, practice and living tradition | Dharmagiri, Vaikhanasa Mutt, Veda Sabha and related gatherings | Enter the occasion → photo / film / audio / supplied YouTube recording | Devotion & celebrations; education |
| Care & Wellbeing | Show specific acts of care | Vision camp, Dhanvantari Day, Navajeevan, medical support | See the occasion → photographs / original report | Relevant historical support; Foundation |
| Compassion in Action | Make the action explicit | Goshala/Gajashala visit and farmer interaction | Step into the visit | Related service and devotion |
| Annadanam | Present nourishment as service | Tirumala, Shirdi, Bodhendra support and supplied context | Discover the story | Supporting acknowledgement only on request; Foundation |
| Devotion & Celebrations | Preserve the strong existing event experience | Large event compositions; worship and gatherings; Chaturmasya, Radha Kalyanam and other authentic occasions | Enter occasion → photographs, film, audio | Adjacent occasion; Vedic learning |
| Learn Swamiji’s Teachings | One unmistakable gateway to the whole teaching experience | Four generous, distinct choices: Satsangh Messages, Books, Message Cards & Blessings, Everyday Teachings | Choose a way to learn | Back to his life; direct entry to Pearls |
| Satsangh Messages | Offer a thought worth taking into daily life | One staged paper reflection with neighbouring pages behind; search / date / topic tools open only on request | Read reflection → focused reading | Previous / next date; everyday practice; return with search remembered |
| Books | Make each actual cover inviting | One featured book, neighbouring covers, short attribution | Pearls → cover welcome → Open book; other seven books → supplied publication link | All eight titles; Teachings gateway |
| Pearls of Wisdom | Preserve the real opening and reading experience | Actual digital cover, opening animation, one pearl per page, page turns, contents/search, bookmarks, resume, size and appearance | Open → read / turn / save | Close to cover; Back to Books |
| Message Cards & Blessings | Invite a visitor to open a personal message | Rotating actual covers; selected card under a spotlight | Open card → front / inside spread / back, or real page sequence | Enlarge/Fit; original PDF/image; return to same card |
| Everyday Teachings | Turn understanding into a small action | One practical teaching with meaning and actions | Read / next teaching | Source-labelled satsang reflections; Teachings gateway |
| The Foundation | Explain how the example continues | Purpose, actual service moments, contact and involvement | Connect → email/phone; discover a service story | Historical support notes reachable as evidence, not the landing page |
| Supporting acknowledgement | Provide context when requested | Recipient, named donor/trust, date and amount as supplied; reviewed source excerpt | View original acknowledgement | Return to the relevant service story |

## Interaction sequence

1. **Meet → recognise → enter.** A portrait introduces a side of his life. Selecting it leads to a large editorial story, not a grid of folders.
2. **Story → occasion → moment.** Next/previous and swipe change the selected story. An occasion opens directly into a generous media stage with unobtrusive context and a meaningful way onward.
3. **Learn → choose a form.** The teaching gateway makes Books, Satsangh Messages, Cards and Everyday Teachings equally discoverable.
4. **Cover → open → read.** Preserve the existing Pearls and message-card mechanics rather than flattening them into generic gallery tiles.
5. **Service → understand → optional evidence.** Receipts and contribution amounts support the story only when requested.

## Navigation contracts

- Canonical routes: `#/`, `#/explore`, `#/category/<category>/moments/<event>`, `#/event/<event>/<media-type>/<position>`, `#/learn`, `#/library/readings`, `#/library/books`, `#/library/messages`, `#/library/teachings`, `#/read/<collection>/<id>`, `#/record/<id>`.
- Preserved dedicated experiences: `reading-room.html` (Pearls welcome/open/page turns), `message-cards.html` (spotlight/open/fold/read).
- The gateway and story scenes link directly to these experiences. Their back links return to the correct new project page, never the previous website.
- Links use the project’s relative assets and routes; no local absolute source paths or hard-coded old preview server.
- A page never becomes a dead end: parent, next/previous and a global way home remain available.
- Full original PDFs, text reading panels, Veda audio and supplied YouTube links remain reachable; media type is not lost when importing a photograph.

## Visual commitments

Large photographs with context, restrained typography, breathing room, useful captions and smooth transitions. Light saffron/ivory and gentle contextual colours for the tribute; a quiet deep green reading room or media backdrop where it improves focus. Preserve the original media proportions. No thumbnail-wall landing pages, boxed folder catalogues, receipt dashboards, or invented icon substitutes for missing photographs.

No long homepage scroll. Intentional reading and expanded source material may scroll for legibility. Touch, keyboard, pause and reduced-motion alternatives remain available.

## Content boundary

Music/concerts is ready in the project structure but stays unpublished until real photographs arrive. Seven commercial books have supplied covers/publication links, not full digital texts. Dates, donors and historical contributions retain their real source distinctions.
