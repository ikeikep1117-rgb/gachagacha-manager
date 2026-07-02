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
    node.querySelector(".add-lineup-button").addEventListener("click", () => {
      lineupForm.classList.add("is-open");
      lineupForm.querySelector("input").focus();
    });
    node.querySelector(".cancel-lineup-button").addEventListener("click", () => {
      lineupForm.reset();
      lineupForm.classList.remove("is-open");
    });
    lineupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const nameInput = lineupForm.querySelector(".lineup-name-input");
      const photoInput = lineupForm.querySelector(".lineup-photo-input");
      const moodInput = lineupForm.querySelector(".lineup-mood-input");
      const photo = photoInput.files[0] ? await fileToDataUrl(photoInput.files[0]) : "";

      release.lineup.push({
        id: crypto.randomUUID(),
        name: nameInput.value.trim(),
        photo,
        mood: moodInput.value,
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

    if (item.photo) {
      image.style.backgroundImage = `url("${item.photo}")`;
      image.style.backgroundSize = "cover";
      image.style.backgroundPosition = "center";
    } else {
      const total = Math.max(release.lineup.length, 1);
      image.style.backgroundImage = `url("${release.photo}")`;
      image.style.backgroundSize = `${total * 100}% 100%`;
      image.style.backgroundPosition = `${total === 1 ? 50 : (index / (total - 1)) * 100}% center`;
    }

    const moodSelect = row.querySelector(".mood-select");
    moodSelect.value = item.mood;
    moodSelect.addEventListener("change", () => {
      item.mood = moodSelect.value;
      save();
      renderStats(
        state.releases.filter((releaseItem) => releaseItem.status === "current"),
        state.releases.filter((releaseItem) => releaseItem.status === "upcoming")
      );
    });

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
    row.querySelector(".delete-lineup-button").addEventListener("click", () => {
      release.lineup = release.lineup.filter((lineupItem) => lineupItem.id !== item.id);
      save();
      render();
    });

    lineupList.append(row);
  });
}

function renderStats(current, upcoming) {
  const allLineup = state.releases.flatMap((release) => release.lineup);
  const owned = allLineup.reduce((sum, item) => sum + item.count, 0);
  const moods = {
    want: allLineup.filter((item) => item.mood === "want").length,
    normal: allLineup.filter((item) => item.mood === "normal").length,
    skip: allLineup.filter((item) => item.mood === "skip").length,
  };

  document.querySelector("#heroTotal").textContent = current.length;
  document.querySelector("#heroUpcoming").textContent = `発売予定 ${upcoming.length}件`;
  document.querySelector("#statCurrent").textContent = current.length;
  document.querySelector("#statUpcoming").textContent = upcoming.length;
  document.querySelector("#statLineup").textContent = allLineup.length;
  document.querySelector("#statOwned").textContent = owned;

  const chart = document.querySelector("#moodChart");
  chart.innerHTML = "";
  const rows = [
    ["ほしい！", moods.want],
    ["ふつう", moods.normal],
    ["いらない", moods.skip],
  ];
  const max = Math.max(...rows.map(([, count]) => count), 1);

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
  if (Array.isArray(data.releases)) return data.releases;

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
        mood: "normal",
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
