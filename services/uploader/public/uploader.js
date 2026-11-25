const $ = (id) => document.getElementById(id);
let catalog,
  files = [],
  cover = 0,
  batchId = null,
  pollTimer = null,
  preparing = false;
const panels = ["unlock", "workspace", "review", "publishing"];
function show(panel) {
  for (const id of panels) $(id).hidden = id !== panel;
  $("message").hidden = true;
  window.scrollTo({ top: 0, behavior: "instant" });
}
function error(message) {
  $("message").textContent = message;
  $("message").hidden = false;
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body instanceof Blob
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const result = await response
    .json()
    .catch(() => ({
      error: "The connection was interrupted. Please try again.",
    }));
  if (!response.ok) {
    if (response.status === 401) {
      show("unlock");
      $("signout").hidden = true;
    }
    throw new Error(result.error || "Please try again.");
  }
  return result;
}
async function load() {
  catalog = await api("/api/catalog");
  $("section").replaceChildren(
    new Option("Choose a section", ""),
    ...catalog.categories.map((c) => new Option(c.title, c.id)),
  );
  $("connection-note").hidden = catalog.publishEnabled;
  $("review-connection-note").hidden = catalog.publishEnabled;
  $("signout").hidden = false;
  show("workspace");
  await recent();
}
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = e.submitter;
  b.disabled = true;
  try {
    await api("/api/session", {
      method: "POST",
      body: JSON.stringify({ password: $("access-code").value }),
    });
    $("access-code").value = "";
    await load();
  } catch (e) {
    error(e.message);
  } finally {
    b.disabled = false;
  }
});
$("signout").addEventListener("click", async () => {
  try {
    await api("/api/session", { method: "DELETE" });
    for (const f of files) URL.revokeObjectURL(f.url);
    files = [];
    clearTimeout(pollTimer);
    $("update-form").reset();
    $("signout").hidden = true;
    show("unlock");
  } catch (e) {
    error(e.message);
  }
});
$("section").addEventListener("change", () => {
  const id = $("section").value;
  $("existing").replaceChildren(
    new Option("Yes, create a new occasion", ""),
    ...catalog.events
      .filter((e) => e.category === id)
      .map((e) => new Option("Add to: " + e.title, e.id)),
  );
  $("title-label").textContent =
    id === "education" ? "School or institution name" : "Occasion title";
  $("title").placeholder =
    id === "education"
      ? "For example, Air Force School, Yelahanka"
      : "For example, Guru Purnima at Guruashraya";
  $("existing").dispatchEvent(new Event("change"));
});
$("existing").addEventListener("change", () => {
  const event = catalog.events.find((e) => e.id === $("existing").value);
  $("title").readOnly = Boolean(event);
  $("date").disabled = Boolean(event);
  if (event) $("title").value = event.title;
});
async function prepare(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Please use JPG, PNG or WebP photographs.");
  if (file.size > 25000000)
    throw new Error(
      "One photograph is too large. Please choose a smaller copy.",
    );
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    let edge = 1600,
      blob;
    while (edge >= 800) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas
        .getContext("2d")
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.8),
      );
      if (!blob || blob.type !== "image/webp")
        throw new Error(
          "This browser could not prepare the photograph. Please use a recent browser.",
        );
      if (blob.size <= 500000) break;
      edge -= 200;
    }
    if (blob.size > 500000)
      throw new Error(
        "This photograph could not be resized enough. Please choose a smaller copy.",
      );
    const hash = [
      ...new Uint8Array(
        await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
      ),
    ]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { blob, hash, url: URL.createObjectURL(blob) };
  } finally {
    bitmap.close();
  }
}
function render() {
  $("previews").replaceChildren();
  files.forEach((file, i) => {
    const item = document.createElement("div");
    item.className = "preview";
    const image = document.createElement("img");
    image.src = file.url;
    image.alt = "Selected photograph " + (i + 1);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Remove photograph " + (i + 1));
    remove.onclick = () => {
      URL.revokeObjectURL(file.url);
      files.splice(i, 1);
      if (cover === i) cover = 0;
      else if (cover > i) cover--;
      render();
    };
    const label = document.createElement("label"),
      radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "cover";
    radio.checked = i === cover;
    radio.value = String(i);
    radio.onchange = () => {
      cover = i;
      render();
    };
    label.append(
      radio,
      document.createTextNode(i === cover ? "Cover" : "Use as cover"),
    );
    item.append(image, remove, label);
    $("previews").append(item);
  });
  $("photo-count").textContent = files.length
    ? `${files.length} photograph${files.length === 1 ? "" : "s"} selected · choose one as the cover.`
    : "The selected cover will introduce this occasion on the website.";
}
$("photos").addEventListener("change", async () => {
  if (preparing) return;
  preparing = true;
  $("review-button").disabled = true;
  $("message").hidden = true;
  const added = [...$("photos").files];
  try {
    if (files.length + added.length > 20)
      throw new Error("Choose up to 20 photographs for one update.");
    for (let i = 0; i < added.length; i++) {
      $("preparing").textContent =
        `Preparing photograph ${i + 1} of ${added.length}…`;
      const file = await prepare(added[i]);
      if (files.some((f) => f.hash === file.hash)) {
        URL.revokeObjectURL(file.url);
        continue;
      }
      files.push(file);
      render();
    }
  } catch (e) {
    error(e.message);
  } finally {
    $("photos").value = "";
    preparing = false;
    $("review-button").disabled = false;
    $("preparing").textContent =
      "Your photographs are resized for the website automatically.";
  }
});
$("update-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!files.length) {
    error("Choose at least one photograph.");
    return;
  }
  if (preparing) return;
  $("review-section").textContent =
    catalog.categories.find((c) => c.id === $("section").value)?.title || "";
  $("review-title").textContent = $("title").value.trim();
  $("review-caption").textContent = $("caption").value.trim();
  $("review-meta").textContent = [
    `${files.length} photograph${files.length === 1 ? "" : "s"}`,
    $("place").value,
    $("date").disabled ? "" : $("date").value,
    $("existing").value ? "Adding to the existing occasion" : "New occasion",
  ]
    .filter(Boolean)
    .join(" · ");
  $("cover-preview").src = files[cover].url;
  $("consent").checked = false;
  show("review");
});
$("back-to-edit").addEventListener("click", () => show("workspace"));
$("publish-button").addEventListener("click", () => publish(false));
$("retry").addEventListener("click", () => publish(true));
$("return-review").addEventListener("click", () => show("review"));
async function publish(retry) {
  if (!retry && !$("consent").checked) {
    error("Please confirm that you have reviewed the update.");
    return;
  }
  if (!catalog?.publishEnabled) {
    error(
      "Publishing is not connected yet. Your photographs have not been sent.",
    );
    return;
  }
  $("publish-button").disabled = true;
  $("retry").hidden = true;
  $("return-review").hidden = true;
  $("new-update").hidden = true;
  $("view-update").hidden = true;
  $("progress").hidden = false;
  $("progress").removeAttribute("value");
  show("publishing");
  try {
    if (!retry) {
      $("publish-title").textContent = "Saving your photographs.";
      $("publish-description").textContent =
        "Please keep this page open until the photographs are saved.";
      // A failed local submission is discarded before another new batch is created.
      if (batchId) {
        try {
          await api("/api/batches/" + batchId, { method: "DELETE" });
        } catch {
          throw new Error(
            "Check the previous update in Recent updates before trying again.",
          );
        }
      }
      const data = await api("/api/batches", {
        method: "POST",
        body: JSON.stringify({
          category: $("section").value,
          target: $("existing").value || null,
          title: $("title").value.trim(),
          caption: $("caption").value.trim(),
          location: $("place").value.trim(),
          date: $("date").disabled ? null : $("date").value || null,
        }),
      });
      batchId = data.id;
      for (let i = 0; i < files.length; i++) {
        $("publish-description").textContent =
          `Saving photograph ${i + 1} of ${files.length}…`;
        await api(`/api/batches/${batchId}/photos?position=${i}`, {
          method: "POST",
          body: files[i].blob,
          headers: { "Content-Type": "image/webp" },
        });
      }
    }
    await api(`/api/batches/${batchId}/publish`, {
      method: "POST",
      body: JSON.stringify({
        cover: retry ? $("retry").dataset.cover : files[cover].hash,
        confirmed: true,
      }),
    });
    await status(batchId);
  } catch (e) {
    $("publish-title").textContent = "Your update needs another moment.";
    $("publish-description").textContent = e.message;
    $("progress").hidden = true;
    $("new-update").hidden = false;
    if (retry) $("retry").hidden = false;
    else if (files.length) {
      $("return-review").hidden = false;
      $("new-update").hidden = true;
    }
  } finally {
    $("publish-button").disabled = false;
  }
}
async function status(id) {
  clearTimeout(pollTimer);
  try {
    const b = await api("/api/batches/" + id);
    batchId = id;
    show("publishing");
    $("progress").hidden = false;
    $("view-update").hidden = true;
    $("retry").hidden = true;
    $("return-review").hidden = true;
    $("new-update").hidden = true;
    if (b.state === "published") {
      $("publish-title").textContent = "Your moment is now live.";
      $("publish-description").textContent =
        "The photographs and caption have been published to the website.";
      $("progress").hidden = true;
      const target = b.target || "upload-" + b.id;
      const link = new URL(b.siteUrl);
      link.hash = "/event/" + target;
      $("view-update").href = link.href;
      $("view-update").hidden = false;
      $("new-update").hidden = false;
      return;
    }
    if (b.state === "failed") {
      $("publish-title").textContent = "Publishing paused.";
      $("publish-description").textContent =
        b.error || "Your photographs are saved. Please try again.";
      $("progress").hidden = true;
      $("retry").dataset.cover = b.cover || "";
      $("retry").hidden = false;
      $("new-update").hidden = false;
      return;
    }
    if (b.state === "draft") {
      $("publish-title").textContent = "This update has not been published.";
      $("publish-description").textContent =
        "Return to your photographs to review and publish it.";
      $("progress").hidden = true;
      $("new-update").hidden = false;
      return;
    }
    $("publish-title").textContent =
      b.state === "processing"
        ? "Bringing your story to the website."
        : "Your update is in the publishing queue.";
    $("publish-description").textContent =
      b.error ||
      "The website checks and publishing can take a few minutes. You may leave this page and check Recent updates later.";
    pollTimer = setTimeout(() => status(id), 6000);
  } catch (e) {
    error(e.message);
    $("new-update").hidden = false;
  }
}
$("new-update").addEventListener("click", async () => {
  clearTimeout(pollTimer);
  batchId = null;
  for (const f of files) URL.revokeObjectURL(f.url);
  files = [];
  cover = 0;
  $("update-form").reset();
  $("title").readOnly = false;
  $("date").disabled = false;
  render();
  show("workspace");
  await recent();
});
async function recent() {
  try {
    const data = await api("/api/batches");
    $("recent").hidden = !data.batches.length;
    $("recent-list").replaceChildren();
    for (const b of data.batches) {
      const button = document.createElement("button"),
        title = document.createElement("span"),
        state = document.createElement("span");
      title.textContent = b.title;
      state.textContent =
        {
          published: "Published",
          processing: "Publishing",
          queued: "Queued",
          failed: "Retry needed",
          draft: "Not published",
        }[b.state] || b.state;
      button.type = "button";
      button.append(title, state);
      button.onclick = () => status(b.id);
      $("recent-list").append(button);
    }
  } catch (e) {
    error(e.message);
  }
}
load().catch((e) => {
  show("unlock");
  if (!e.message.startsWith("Please unlock")) error(e.message);
});
