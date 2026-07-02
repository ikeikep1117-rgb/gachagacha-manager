const STORAGE_KEY = "capsule-shelf-releases-v2";
const LEGACY_KEYS = ["capsule-shelf-items", "capsule-shelf-wishes"];
const SERVICE_WORKER_PATH = "./sw.js";

const state = {
  releases: readStorage(STORAGE_KEY, []),
};

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
const settingsPanel = document.querySelector("#settingsPanel");
const currentForm = document.querySelector("#currentForm");
const upcomingForm = document.querySelector("#upcomingForm");
const currentList = document.querySelector("#currentList");
const upcomingList = document.querySelector("#upcomingList");
const gachaTemplate = document.querySelector("#gachaTemplate");
const lineupTemplate = document.querySelector("#lineupTemplate");

moveDueUpcoming();
setDefaultMonths();

document.querySelector("#settingsToggle").addEventListener("click", () => {
  settingsPanel.classList.toggle("is-open");
});

document.querySelectorAll("[data-open-form]").forEach((button) => {
  button.addEventListener("click", () => {
    const form = document.querySelector(`#${button.dataset.openForm}`);
    form.classList.add("is-open");
    form.querySelector("input").focus();
  });
});

document.querySelectorAll("[data-close-form]").forEach((button) => {
  button.addEventListener("click", () => {
    const form = document.querySelector(`#${button.dataset.closeForm}`);
    form.reset();
    form.classList.remove("is-open");
    setDefaultMonths();
  });
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((button) => button.classList.toggle("is-active", button === tab));
    panels.forEach((panel) => panel.classList.toggle("is-active", panel.id === tab.dataset.tab));
  });
});

currentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const release = await buildReleaseFromForm("current");
  state.releases.unshift(release);
  save();
  currentForm.reset();
  currentForm.classList.remove("is-open");
  setDefaultMonths();
  render();
});

upcomingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const release = await buildReleaseFromForm("upcoming");
  state.releases.unshift(release);
  save();
  upcomingForm.reset();
  upcomingForm.classList.remove("is-open");
  setDefaultMonths();
  moveDueUpcoming();
  render();
});

document.querySelector("#exportButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ releases: state.releases }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "capsule-shelf-data.json";
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    state.releases = normalizeImportedData(data);
    moveDueUpcoming();
    save();
    render();
  } catch {
    alert("読み込めないJSONファイルです。");
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#clearButton").addEventListener("click", () => {
  if (!confirm("登録データをすべて削除しますか？")) return;
  state.releases = [];
  save();
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  render();
});

async function buildReleaseFromForm(type) {
  const prefix = type === "current" ? "current" : "upcoming";
  const photoFile = document.querySelector(`#${prefix}Photo`).files[0];

  return {
    id: crypto.randomUUID(),
    status: type,
    name: document.querySelector(`#${prefix}Name`).value.trim(),
    releaseMonth: document.querySelector(`#${prefix}Month`).value,
    releaseWeek: Number(document.querySelector(`#${prefix}Week`).value),
    photo: await fileToDataUrl(photoFile),
    lineup: [],
    open: true,
    createdAt: new Date().toISOString(),
  };
}

function render() {
  const current = sortReleases(state.releases.filter((release) => release.status === "current"));
  const upcoming = sortReleases(state.releases.filter((release) => release.status === "upcoming"));

  renderReleaseList(currentList, current, "current");
  renderReleaseList(upcomingList, upcoming, "upcoming");
  document.querySelector("#currentEmpty").classList.toggle("is-visible", current.length === 0);
  document.querySelector("#upcomingEmpty").classList.toggle("is-visible", upcoming.length === 0);
  renderStats(current, upcoming);
}

function renderReleaseList(container, releases, listType) {
  container.innerHTML = "";

  releases.forEach((release) => {
    const node = gachaTemplate.content.firstElementChild.cloneNode(true);
    node.classList.toggle("is-open", release.open);
    node.dataset.id = release.id;
    node.querySelector(".release-name").textContent = release.name;
    node.querySelector(".release-date").textContent = `${formatMonth(release.releaseMonth)} 第${release.releaseWeek}週`;
    node.querySelector(".summary-count").textContent = `${release.lineup.length}種`;
    node.querySelector(".summary-photo").style.backgroundImage = `url("${release.photo}")`;
    node.querySelector(".main-photo").src = release.photo;
    node.querySelector(".main-photo").alt = `${release.name}のラインナップ写真`;

    node.querySelector(".release-summary").addEventListener("click", () => {
      release.open = !release.open;
      save();
      render();
    });

    const lineupForm = node.querySelector(".lineup-form");
    setupCropper(lineupForm, release.photo);

    node.querySelector(".add-lineup-button").addEventListener("click", () => {
      lineupForm.classList.add("is-open");
      lineupForm.querySelector("input").focus();
      resetCropBox(lineupForm);
    });

    node.querySelector(".cancel-lineup-button").addEventListener("click", () => {
      lineupForm.reset();
      lineupForm.classList.remove("is-open");
      resetCropBox(lineupForm);
    });

    lineupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nameInput = lineupForm.querySelector(".lineup-name-input");
      const photoInput = lineupForm.querySelector(".lineup-photo-input");
      const photo = photoInput.files[0] ? await fileToDataUrl(photoInput.files[0]) : await cropMainPhoto(lineupForm);

      release.lineup.push({
        id: crypto.randomUUID(),
        name: nameInput.value.trim(),
        photo,
        count: 0,
        createdAt: new Date().toISOString(),
      });
      save();
      render();
    });

    renderLineup(node, release);

    const moveButton = node.querySelector(".move-button");
    moveButton.textContent = listType === "current" ? "発売予定に戻す" : "発売中に移動";
    moveButton.addEventListener("click", () => {
      release.status = listType === "current" ? "upcoming" : "current";
      release.open = true;
      save();
      render();
    });

    node.querySelector(".delete-release-button").addEventListener("click", () => {
      if (!confirm(`${release.name}を削除しますか？`)) return;
      state.releases = state.releases.filter((item) => item.id !== release.id);
      save();
      render();
    });

    container.append(node);
  });
}

function renderLineup(node, release) {
  const lineupList = node.querySelector(".lineup-list");
  const lineupEmpty = node.querySelector(".lineup-empty");
  lineupList.innerHTML = "";
  lineupEmpty.classList.toggle("is-visible", release.lineup.length === 0);

  release.lineup.forEach((item, index) => {
    const row = lineupTemplate.content.firstElementChild.cloneNode(true);
    const image = row.querySelector(".lineup-image");
    row.querySelector(".lineup-title").textContent = item.name;
    row.querySelector(".count-value").textContent = item.count;
    image.style.backgroundImage = `url("${item.photo || release.photo}")`;

    row.querySelector(".minus-button").addEventListener("click", () => {
      item.count = Math.max(0, item.count - 1);
      save();
      render();
    });
    row.querySelector(".plus-button").addEventListener("click", () => {
      item.count += 1;
      save();
      render();
    });
    row.querySelector(".move-up-button").disabled = index === 0;
    row.querySelector(".move-up-button").addEventListener("click", () => {
      moveLineupItem(release, index, index - 1);
    });
    row.querySelector(".move-down-button").disabled = index === release.lineup.length - 1;
    row.querySelector(".move-down-button").addEventListener("click", () => {
      moveLineupItem(release, index, index + 1);
    });
    row.querySelector(".delete-lineup-button").addEventListener("click", () => {
      release.lineup = release.lineup.filter((lineupItem) => lineupItem.id !== item.id);
      save();
      render();
    });

    lineupList.append(row);
  });
}

function moveLineupItem(release, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= release.lineup.length) return;
  const [item] = release.lineup.splice(fromIndex, 1);
  release.lineup.splice(toIndex, 0, item);
  save();
  render();
}

function setupCropper(form, photo) {
  const source = form.querySelector(".crop-source");
  const box = form.querySelector(".crop-box");
  const cropper = form.querySelector(".cropper");
  source.src = photo;

  form.querySelector(".crop-reset-button").addEventListener("click", () => resetCropBox(form));
  form.querySelector(".crop-square-button").addEventListener("click", () => makeCropBoxSquare(form));

  let mode = "";
  let startX = 0;
  let startY = 0;
  let startRect = null;

  const start = (event, nextMode) => {
    event.preventDefault();
    const point = getPointer(event);
    mode = nextMode;
    startX = point.x;
    startY = point.y;
    startRect = getBoxRect(box);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  const move = (event) => {
    if (!mode || !startRect) return;
    const point = getPointer(event);
    const cropperRect = cropper.getBoundingClientRect();
    const dx = point.x - startX;
    const dy = point.y - startY;

    if (mode === "move") {
      setBoxRect(box, cropperRect, {
        left: startRect.left + dx,
        top: startRect.top + dy,
        width: startRect.width,
        height: startRect.height,
      });
      return;
    }

    setBoxRect(box, cropperRect, {
      left: startRect.left,
      top: startRect.top,
      width: startRect.width + dx,
      height: startRect.height + dy,
    });
  };

  const stop = () => {
    mode = "";
    startRect = null;
    window.removeEventListener("pointermove", move);
  };

  box.addEventListener("pointerdown", (event) => {
    if (event.target.classList.contains("crop-handle")) return;
    start(event, "move");
  });
  box.querySelector(".crop-handle").addEventListener("pointerdown", (event) => start(event, "resize"));
}

function resetCropBox(form) {
  const cropper = form.querySelector(".cropper");
  const box = form.querySelector(".crop-box");
  const rect = cropper.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const size = Math.min(rect.width, rect.height) * 0.5;
  setBoxRect(box, rect, {
    left: (rect.width - size) / 2,
    top: (rect.height - size) / 2,
    width: size,
    height: size,
  });
}

function makeCropBoxSquare(form) {
  const cropper = form.querySelector(".cropper");
  const box = form.querySelector(".crop-box");
  const cropperRect = cropper.getBoundingClientRect();
  const rect = getBoxRect(box);
  const size = Math.min(rect.width, rect.height);
  setBoxRect(box, cropperRect, {
    left: rect.left,
    top: rect.top,
    width: size,
    height: size,
  });
}

async function cropMainPhoto(form) {
  const source = form.querySelector(".crop-source");
  const box = form.querySelector(".crop-box");
  const cropper = form.querySelector(".cropper");

  if (!source.complete) {
    await new Promise((resolve) => source.addEventListener("load", resolve, { once: true }));
  }

  const boxRect = getBoxRect(box);
  const cropperRect = cropper.getBoundingClientRect();
  const scaleX = source.naturalWidth / cropperRect.width;
  const scaleY = source.naturalHeight / cropperRect.height;
  const canvas = document.createElement("canvas");
  const size = 600;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  context.drawImage(
    source,
    boxRect.left * scaleX,
    boxRect.top * scaleY,
    boxRect.width * scaleX,
    boxRect.height * scaleY,
    0,
    0,
    size,
    size
  );

  return canvas.toDataURL("image/jpeg", 0.9);
}

function getPointer(event) {
  return {
    x: event.clientX,
    y: event.clientY,
  };
}

function getBoxRect(box) {
  return {
    left: parseFloat(box.style.left) || 0,
    top: parseFloat(box.style.top) || 0,
    width: parseFloat(box.style.width) || box.offsetWidth,
    height: parseFloat(box.style.height) || box.offsetHeight,
  };
}

function setBoxRect(box, cropperRect, next) {
  const minSize = 44;
  const width = Math.min(Math.max(next.width, minSize), cropperRect.width);
  const height = Math.min(Math.max(next.height, minSize), cropperRect.height);
  const left = Math.min(Math.max(next.left, 0), cropperRect.width - width);
  const top = Math.min(Math.max(next.top, 0), cropperRect.height - height);

  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
}

function renderStats(current, upcoming) {
  const allLineup = state.releases.flatMap((release) => release.lineup);
  const owned = allLineup.reduce((sum, item) => sum + item.count, 0);

  document.querySelector("#heroTotal").textContent = current.length;
  document.querySelector("#heroUpcoming").textContent = `発売予定 ${upcoming.length}件`;
  document.querySelector("#statCurrent").textContent = current.length;
  document.querySelector("#statUpcoming").textContent = upcoming.length;
  document.querySelector("#statLineup").textContent = allLineup.length;
  document.querySelector("#statOwned").textContent = owned;

  const chart = document.querySelector("#releaseChart");
  chart.innerHTML = "";
  const rows = state.releases.map((release) => [release.name, release.lineup.length]);
  const max = Math.max(...rows.map(([, count]) => count), 1);

  if (!rows.length) {
    chart.innerHTML = '<p class="note">ガチャを登録すると、ラインナップ数が表示されます。</p>';
    return;
  }

  rows.forEach(([label, count]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <span class="bar-name"></span>
      <span class="bar-track"><span class="bar-fill"></span></span>
      <strong></strong>
    `;
    row.querySelector(".bar-name").textContent = label;
    row.querySelector(".bar-fill").style.width = `${Math.max(8, (count / max) * 100)}%`;
    row.querySelector("strong").textContent = count;
    chart.append(row);
  });
}

function moveDueUpcoming() {
  const now = getCurrentReleasePosition();
  let changed = false;

  state.releases.forEach((release) => {
    if (release.status !== "upcoming") return;
    const releasePosition = releaseToPosition(release.releaseMonth, release.releaseWeek);
    if (releasePosition <= now) {
      release.status = "current";
      release.open = true;
      changed = true;
    }
  });

  if (changed) save();
}

function getCurrentReleasePosition() {
  const today = new Date();
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return releaseToPosition(month, getWeekOfMonth(today));
}

function releaseToPosition(month, week) {
  const [year, monthNumber] = month.split("-").map(Number);
  return year * 1000 + monthNumber * 10 + Number(week);
}

function getWeekOfMonth(date) {
  return Math.min(5, Math.ceil(date.getDate() / 7));
}

function sortReleases(releases) {
  return [...releases].sort((a, b) => {
    const byRelease = releaseToPosition(a.releaseMonth, a.releaseWeek) - releaseToPosition(b.releaseMonth, b.releaseWeek);
    if (byRelease !== 0) return byRelease;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function setDefaultMonths() {
  const value = new Date().toISOString().slice(0, 7);
  document.querySelector("#currentMonth").value ||= value;
  document.querySelector("#upcomingMonth").value ||= value;
}

function formatMonth(month) {
  const [year, monthNumber] = month.split("-");
  return `${year}年${Number(monthNumber)}月`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeImportedData(data) {
  if (Array.isArray(data.releases)) {
    return data.releases.map((release) => ({
      ...release,
      lineup: (release.lineup || []).map((item) => ({
        id: item.id || crypto.randomUUID(),
        name: item.name || "ラインナップ",
        photo: item.photo || "",
        count: Number(item.count) || 0,
        createdAt: item.createdAt || new Date().toISOString(),
      })),
    }));
  }

  const legacyItems = Array.isArray(data.items) ? data.items : [];
  return legacyItems.map((item) => ({
    id: crypto.randomUUID(),
    status: "current",
    name: item.series || item.name || "名前未設定",
    releaseMonth: item.acquiredDate ? item.acquiredDate.slice(0, 7) : new Date().toISOString().slice(0, 7),
    releaseWeek: 1,
    photo: "",
    lineup: [
      {
        id: crypto.randomUUID(),
        name: item.name || "ラインナップ",
        photo: "",
        count: Number(item.quantity) || 0,
        createdAt: item.createdAt || new Date().toISOString(),
      },
    ],
    open: true,
    createdAt: item.createdAt || new Date().toISOString(),
  }));
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.releases));
}

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SERVICE_WORKER_PATH).catch(() => {
      // Offline support is optional; the app still works without a service worker.
    });
  });
}
