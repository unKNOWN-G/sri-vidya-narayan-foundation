# WhatsApp-to-website gateway

## Status

**Live and verified on 27 November 2026.** The owner approved linking/background operation, scanned the QR and bound the dedicated upload group. The owner then forwarded 10 photographs, completed the guided section/event/caption review and replied PUBLISH. “Hayagreeva Swamy Temple Visit, Tirumala” was published successfully under Devotion and Celebration.

- Live event: https://unknown-g.github.io/sri-vidya-narayan-foundation/#/event/whatsapp-59025070-c4f4-4274-98d4-7ac9bfbda191
- Successful Pages run: https://github.com/unKNOWN-G/sri-vidya-narayan-foundation/actions/runs/45976760410
- Published source commit: `8fbca1d0e2bd9bf846218c4ce3995c52c1a1c80d`.
- All 10 live WebP assets were fetched from GitHub Pages and checked against their prepared SHA-256 hashes (2,854,186 bytes total). The companion reports `published`, no error and an empty outgoing reply queue.
- The per-user LaunchAgent is running. Saved credentials and the dedicated-group binding are present with private file permissions; future forwarding and questions happen entirely in WhatsApp while the Mac is awake and online.
- Photos are production-tested through WhatsApp. Video/voice/audio/YouTube/text have focused intake/import/conversion tests and an isolated five-media full-build acceptance test, but have not yet been sent through a live WhatsApp publication.

The private operator setup/health page is http://127.0.0.1:8998/ on the Mac. Browser visual inspection remains unavailable because local browser use is disabled in Codex Work settings. Public JSON and actual asset bytes were verified; do not describe that as a visual browser audit or use another automation stack to bypass the setting.

The existing Cloudflare phone form remains a working alternative; its first live upload was verified on 26 November. This companion is a separate Mac service that publishes through the repository and its existing Pages workflow. It does not request the uploader's blocked `workers.dev` address or copy its Cloudflare secrets.

## Phone experience

Assistant replies use a bold **Website Assistant** label and WhatsApp-native monospace text so they are distinct from the owner's ordinary messages. Links remain outside monospace blocks for easy opening. This is presentation at send time only; uploaded text/captions and typed responses are not rewritten. The first connection after this style update sends a single styled notice or the saved pending menu.

Prompts and publication acknowledgements are concise; no separate caption question is asked during a normal upload. Saved drafts waiting at the old caption step resume at review.

Every question now includes **B. Back** (BACK also works). The review includes **E. Edit**: choose section, event/name, caption or date without re-forwarding the pending files. Changing one field keeps the other answers. Nothing publishes until PUBLISH from the final review.

After publication, **REDO** (or EDIT with no pending set) reopens the most recent published upload with its saved files. Corrections keep the same event ID/link and do not append duplicate media. Changing the section of an event consisting entirely of that upload updates the category lists and education profile, and copies the same public assets into the corrected section; original files remain. On an event containing other uploads, only this set's captions may be changed automatically; moving/renaming that shared event requires a separate review so other people's content and contribution links cannot be silently changed. RETRY remains for failed publication; CLEAR discards only the current unsubmitted selection. A pending menu is resent after a process restart so Back/Edit are visible immediately.

1. Use the dedicated upload group selected by the owner. Forward the items for **one event**: photographs, video clips, WhatsApp voice notes, audio files, forwarded text and/or YouTube video links. Compose a text message outside an active question to include it as content; `MESSAGE your text` also works. Any text message containing valid YouTube video, Live or playlist links is classified as YouTube content, even inside an active question or after a MESSAGE prefix. Surrounding text becomes its caption (up to 1,500 characters); repeated links in that message are deduplicated. The normal section/event review and PUBLISH confirmation remain. Valid UPLOAD instructions retain their command behaviour.
2. After the items arrive, the companion asks which section: His Holiness, Teachings, Devotion and Celebration, Vedic Learning, Education, Annadanam or Medical. Reply with its number.
3. Select an existing event by number, use NEXT for more, or enter a new authentic event/school name. Events are listed only within the selected section. No donation amount or occasion date is inferred.
4. The flow goes straight to review. A forwarded caption is kept; otherwise the event name is used. Caption editing remains optional under **E → 3**. Original forwarded item captions remain attached to their items.
5. Read the item count, section and event. Reply **PUBLISH** to release that set to the public website. `DATE YYYY-MM-DD` optionally supplies the actual occasion date; EDIT opens the details menu without losing the pending items.
6. The companion replies with a live link only after GitHub Pages succeeds. You can prepare the next event while the previous one publishes. STATUS reports pending/recent jobs; RETRY reuses a failed job and saved derivatives. CLEAR/CANCEL removes only the unsubmitted selection; private originals remain.

The optional compact instruction `UPLOAD education | Air Force School, Yelahanka` (with `| caption` if wanted) publishes an already-forwarded set directly. An exact existing title or event ID appends; otherwise it creates a new occasion. This keyword is explicit public-release confirmation; ordinary chat messages never trigger publication.

## Free personal-number constraints

The owner explicitly chose a dedicated group and confirmed that the laptop can remain running while uploads are sent from the phone. No Meta developer login, Facebook account, subscription, paid model or paid WhatsApp provider is used. The Mac must be awake, online and signed in; macOS sleep, logout or shutdown pauses processing. Reconnection and saved jobs are supported, but delivery of media sent while the linked device is offline is not guaranteed. Re-forward missing items after reconnection.

The pinned `@whiskeysockets/baileys` library uses WhatsApp's linked-device protocol and is **unofficial**. WhatsApp may restrict the account or change the protocol. See the [maintainer disclaimer](https://github.com/WhiskeySockets/Baileys#disclaimer) and [WhatsApp's terms](https://www.whatsapp.com/legal/terms-of-service). Do not promise official support or permanent uninterrupted service. Use is limited to the owner's publishing task, with no bulk outreach or unsolicited messaging.

## One-time linking — owner action required

Prepare and test the implementation before asking to link. The one-time request must explain that a linked device receives account-level access; the single-group restriction is enforced by this companion, **not by a WhatsApp-scoped permission**. The owner must approve linking and background operation, then scan the QR themselves. Do not ask again if this exact scope is already approved later in the conversation.

1. On the Mac, `python3 scripts/whatsapp_tool.py init` installs pinned dependencies into this service's Node environment and Python venv. This has been completed locally.
2. `python3 scripts/whatsapp_tool.py setup` opens a loopback-only setup service **without connecting** to WhatsApp. Stop this preview before starting the real service.
3. After owner approval, `python3 scripts/whatsapp_tool.py install` installs the per-user LaunchAgent and starts the linked-device connection. It starts again at this Mac login; the account is not linked until the owner scans the displayed QR. For a foreground diagnostic run use `connect` instead of `install`.
4. Open http://127.0.0.1:8998/ on the Mac. On the owner's phone, WhatsApp → Settings → Linked devices → Link a device. Scan the local QR. Never put the QR, WhatsApp auth files or raw pairing payload in Git, a public page or a screenshot artifact.
5. Send the setup page's one-time `WEBSITE LINK …` message **from the linked number** in the owner's dedicated upload group. The companion then accepts only this group and only messages sent by that same account. Other chats, other members and old history are ignored before media download or persistence. No contacts or group membership are automatically changed.
6. Forward one real, approved mixed-media set and complete the questions/PUBLISH. Verify the actual Pages run, live event/player/message view and WhatsApp success reply. Record the result here. Do not claim the gateway is live merely because linking or unit tests passed.

To stop the background companion: `python3 scripts/whatsapp_tool.py stop`. To inspect launchd: `python3 scripts/whatsapp_tool.py status`. The owner can revoke account access at any time in WhatsApp's Linked devices screen. No automatic permanent logout/reset of the owner's account is performed.

## Data and publishing

- Service: `services/whatsapp/`; operator helper: `scripts/whatsapp_tool.py`; media importer and publisher: `scripts/whatsapp_publish.py`.
- WhatsApp credentials, group ID, pending questions, job manifests, progress and outbox are in ignored `private/whatsapp/`, with directory mode 0700 / file mode 0600. They never enter public assets or builds. Logs contain connection/operation status, not chat bodies. A persistent outbox retries acknowledgements after disconnection; bot message IDs prevent reply loops.
- Unchanged WhatsApp-delivered originals are retained in ignored `media/whatsapp/originals/`. These are the received WhatsApp files, not a claim of full camera originals. Review storage and backups separately. No original is automatically deleted.
- The receiver accepts up to 200 items per event, up to 20 MiB per photo and 250 MiB per audio/video input. Disappearing/view-once messages, PDFs, private receipts and unsupported documents are excluded. An image of a private record must not be sent through this gateway; it cannot safely redact arbitrary records.
- Photographs become metadata-free WebP, at most 1600 px / 500 kB. Audio/voice notes are decoded into AAC/M4A; short videos become H.264/AAC MP4 plus a real extracted poster. FFmpeg is restricted to local media formats and file/pipe protocols. Long outputs over 85 MiB are refused with guidance to send a YouTube link. The total built site must remain under 900 MiB. Free Pages is not unlimited video hosting.
- YouTube video/Live links (including links after shared text), playlists and channel `/live` links are parsed against exact allowlisted hostnames and validated identifiers; the website retains a canonical YouTube link. Individual videos use their real YouTube thumbnail; playlists and channel-live links do not invent a video thumbnail. It does not download YouTube recordings. YouTube controls playback availability: a private recording must be made Unlisted or Public by its owner before ordinary website visitors can watch; a correct website link cannot override that setting. Text is preserved verbatim, escaped and rendered as a message in the existing occasion viewer, with a full reading page. No transcription, rewritten quotation or fabricated donation is generated.
- Canonical public output stays in `content/events/`, category event lists, education profiles where needed, and `assets/media/<category>/<event>/whatsapp/<job>/`. New Teaching events appear through a conditional “Messages and recordings” choice in the existing teaching carousel. No folder/archive visitor interface is added.
- Each approved event uses a disposable detached Git worktree. The main working checkout is never reset or stashed. Only the event/category/profile and its derived assets may be committed. Pushes require a fast-forward; a concurrent source update is fetched and reimported, without force-pushing. Stable job IDs and content hashes prevent retry duplicates. Originals and prepared derivatives survive a failed publication.
- The existing `pages.yml` accepts an optional opaque `update_id` for run tracking, shares the existing Pages concurrency lock, and keeps manual website publication compatible. A live acknowledgement requires the actual matching Pages run to finish successfully. GitHub credentials stay in the existing Mac CLI authentication; none is copied into the browser, chat, repository or WhatsApp session data.

## Checks

```
python3 scripts/whatsapp_tool.py test
python3 -m unittest discover -s tests
python3 scripts/validate.py
python3 scripts/check_content_routes.py --require-experiences
python3 scripts/build.py
```

The focused tests cover the guided mixed-media conversation, explicit publication, one-group/one-account filtering, dates, categories, YouTube URL validation, text escaping, media deduplication, retry idempotence, real Opus→AAC and MOV→MP4/poster conversion, and refusal of unconfirmed/path-traversal input. Real account pairing and live publication remain separate acceptance checks.
