# WhatsApp-to-website gateway

## Status

Implemented locally on 27 November 2026. The owner explicitly approved WhatsApp linking and background operation, then scanned the QR themselves. The per-user LaunchAgent is installed and the companion reports **Connected**. The owner sent the group-link instruction and received the companion’s reply; `/health` confirms **groupLinked=true**. The first real, owner-approved WhatsApp publication remains pending; no test content has been published through this gateway. The local setup page is http://127.0.0.1:8998/ on the Mac. A real, owner-approved group upload is the remaining integration step. Browser inspection is currently unavailable because local browser use is disabled in Codex Work settings; do not claim visual verification or use another automation stack to bypass that setting.

The existing Cloudflare phone form remains a working alternative; its first live upload was verified on 26 November. This companion is a separate Mac service that publishes through the repository and its existing Pages workflow. It does not request the uploader's blocked `workers.dev` address or copy its Cloudflare secrets.

## Phone experience

1. Use the dedicated upload group selected by the owner. Forward the items for **one event**: photographs, video clips, WhatsApp voice notes, audio files, forwarded text and/or YouTube video links. Compose a text message outside an active question to include it as content; `MESSAGE your text` also works.
2. After the items arrive, the companion asks which section: His Holiness, Teachings, Devotion and Celebration, Vedic Learning, Education, Annadanam or Medical. Reply with its number.
3. Select an existing event by number, use NEXT for more, or enter a new authentic event/school name. Events are listed only within the selected section. No donation amount or occasion date is inferred.
4. Reply with the caption. SAME keeps a forwarded caption; SKIP uses the event name. Original forwarded item captions remain attached to their items.
5. Read the item count, section, destination and caption. Reply **PUBLISH** to release that set to the public website. `DATE YYYY-MM-DD` optionally supplies the actual occasion date; EDIT restarts the questions without losing the pending items.
6. The companion replies with a live link only after GitHub Pages succeeds. You can prepare the next event while the previous one publishes. STATUS reports pending/recent jobs; RETRY reuses a failed job and saved derivatives. CLEAR/CANCEL removes only the unsubmitted selection; private originals remain.

The optional compact instruction `UPLOAD education | Air Force School, Yelahanka | Swamiji blessed the students.` publishes an already-forwarded set directly. An exact existing title or event ID appends; otherwise it creates a new occasion. This keyword is explicit public-release confirmation; ordinary chat messages never trigger publication.

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
- YouTube URLs are parsed against exact allowlisted hostnames and video-ID syntax; the website retains a canonical video link and its real YouTube thumbnail. It does not download YouTube recordings. Text is preserved verbatim, escaped and rendered as a message in the existing occasion viewer, with a full reading page. No transcription, rewritten quotation or fabricated donation is generated.
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
