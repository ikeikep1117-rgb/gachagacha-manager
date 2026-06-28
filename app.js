const STORAGE_KEY = "capsule-shelf-items";
const WISH_KEY = "capsule-shelf-wishes";
const SERVICE_WORKER_PATH = "./sw.js";

const state = {
  items: readStorage(STORAGE_KEY, []),
  wishes: readStorage(WISH_KEY, []),
  query: "",
  sort: "newest",
};

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
const itemForm = document.querySelector("#itemForm");
const collectionList = document.querySelector("#collectionList");
const collectionEmpty = document.querySelector("#collectionEmpty");
const itemTemplate = document.querySelector("#itemTemplate");
const searchInput = document.querySelector("#searchInput");
const sortSelect = document.querySelector("#sortSelect");
const wishForm = document.querySelector("#wishForm");
const wishList = document.querySelector("#wishList");
const wishEmpty = document.querySelector("#wishEmpty");

document.querySelector("[data-open-form]").addEventListener("click", () => {
  itemForm.classList.add("is-open");
  document.querySelector("#name").focus();
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((button) => button.classList.toggle("is-active", button === tab));
    panels.forEach((panel) => panel.classList.toggle("is-active", panel.id === tab.dataset.tab));
  });
});

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = getFormData();
  const editId = document.querySelector("#editId").value;

  if (editId) {
    state.items = state.items.map((item) => (item.id === editId ? { ...item, ...formData } : item));
  } else {
    state.items.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...formData,
    });
  }

  saveItems();
  resetForm();
  render();
});

document.querySelector("#cancelEdit").addEventListener("click", resetForm);

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  renderCollection();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderCollection();
});

wishForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#wishName").value.trim();
  const series = document.querySelector("#wishSeries").value.trim();

  if (!name) return;

  state.wishes.unshift({
    id: crypto.randomUUID(),
    name,
    series,
    createdAt: new Date().toISOString(),
  });
  wishForm.reset();
  saveWishes();
  renderWishlist();
});

document.querySelector("#sampleButton").addEventListener("click", () => {
  if (state.items.length || state.wishes.length) return;

  state.items = [
    {
      id: crypto.randomUUID(),
      name: "喫茶店のプリン",
      series: "レトロ純喫茶",
      quantity: 2,
      rarity: "レア",
      acquiredDate: "2026-06-22",
      status: "飾っている",
      memo: "クリームの造形がかわいい。1つは交換候補。",
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "透明カプセルの宇宙飛行士",
      series: "小さな宇宙博",
      quantity: 1,
      rarity: "シークレット",
      acquiredDate: "2026-06-18",
      status: "保管中",
      memo: "台座つき。",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "柴犬のおすわり",
      series: "公園どうぶつ",
      quantity: 3,
      rarity: "ノーマル",
      acquiredDate: "2026-06-10",
      status: "交換候補",
      memo: "",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  state.wishes = [
    { id: crypto.randomUUID(), name: "クリームソーダ", series: "レトロ純喫茶", createdAt: new Date().toISOString() },
    { id: crypto.randomUUID(), name: "月面探査車", series: "小さな宇宙博", createdAt: new Date().toISOString() },
  ];

  saveItems();
  saveWishes();
  render();
});

document.querySelector("#exportButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ items: state.items, wishes: state.wishes }, null, 2)], {
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
    state.items = Array.isArray(data.items) ? data.items : [];
    state.wishes = Array.isArray(data.wishes) ? data.wishes : [];
    saveItems();
    saveWishes();
    render();
  } catch {
    alert("読み込めないJSONファイルです。");
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#clearButton").addEventListener("click", () => {
  if (!confirm("登録データをすべて削除しますか？")) return;
  state.items = [];
  state.wishes = [];
  saveItems();
  saveWishes();
  render();
});

function getFormData() {
  return {
    name: document.querySelector("#name").value.trim(),
    series: document.querySelector("#series").value.trim(),
    quantity: Number(document.querySelector("#quantity").value) || 1,
    rarity: document.querySelector("#rarity").value,
    acquiredDate: document.querySelector("#acquiredDate").value,
    status: document.querySelector("#status").value,
    memo: document.querySelector("#memo").value.trim(),
  };
}

function resetForm() {
  itemForm.reset();
  document.querySelector("#editId").value = "";
  document.querySelector("#quantity").value = 1;
  itemForm.classList.remove("is-open");
}

function render() {
  renderCollection();
  renderWishlist();
  renderStats();
}

function renderCollection() {
  const items = getVisibleItems();
  collectionList.innerHTML = "";
  collectionEmpty.classList.toggle("is-visible", items.length === 0);

  items.forEach((item) => {
    const node = itemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = item.name;
    node.querySelector(".series-name").textContent = item.series;
    node.querySelector(".memo-text").textContent = item.memo;
    node.querySelector(".rarity-badge").textContent = item.rarity;
    node.querySelector(".quantity-badge").textContent = `${item.quantity}個`;
    node.querySelector(".date-text").textContent = item.acquiredDate || "未設定";
    node.querySelector(".status-text").textContent = item.status;
    node.querySelector(".edit-button").addEventListener("click", () => editItem(item.id));
    node.querySelector(".delete-button").addEventListener("click", () => deleteItem(item.id));
    collectionList.append(node);
  });
}

function getVisibleItems() {
  const filtered = state.items.filter((item) => {
    const haystack = `${item.name} ${item.series} ${item.memo}`.toLowerCase();
    return haystack.includes(state.query);
  });

  return [...filtered].sort((a, b) => {
    if (state.sort === "name") return a.name.localeCompare(b.name, "ja");
    if (state.sort === "series") return a.series.localeCompare(b.series, "ja");
    if (state.sort === "quantity") return b.quantity - a.quantity;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

function editItem(id) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;

  document.querySelector("#editId").value = item.id;
  document.querySelector("#name").value = item.name;
  document.querySelector("#series").value = item.series;
  document.querySelector("#quantity").value = item.quantity;
  document.querySelector("#rarity").value = item.rarity;
  document.querySelector("#acquiredDate").value = item.acquiredDate;
  document.querySelector("#status").value = item.status;
  document.querySelector("#memo").value = item.memo;
  itemForm.classList.add("is-open");
  itemForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteItem(id) {
  state.items = state.items.filter((item) => item.id !== id);
  saveItems();
  render();
}

function renderWishlist() {
  wishList.innerHTML = "";
  wishEmpty.classList.toggle("is-visible", state.wishes.length === 0);

  state.wishes.forEach((wish) => {
    const row = document.createElement("article");
    row.className = "wish-item";
    row.innerHTML = `
      <div>
        <strong></strong>
        <span></span>
      </div>
      <button class="danger-button" type="button">削除</button>
    `;
    row.querySelector("strong").textContent = wish.name;
    row.querySelector("span").textContent = wish.series || "シリーズ未設定";
    row.querySelector("button").addEventListener("click", () => {
      state.wishes = state.wishes.filter((item) => item.id !== wish.id);
      saveWishes();
      renderWishlist();
    });
    wishList.append(row);
  });
}

function renderStats() {
  const totalQuantity = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const seriesNames = new Set(state.items.map((item) => item.series));
  const secretCount = state.items.filter((item) => item.rarity === "シークレット").length;

  document.querySelector("#heroTotal").textContent = state.items.length;
  document.querySelector("#statItems").textContent = state.items.length;
  document.querySelector("#statQuantity").textContent = totalQuantity;
  document.querySelector("#statSeries").textContent = seriesNames.size;
  document.querySelector("#statSecret").textContent = secretCount;

  const chart = document.querySelector("#seriesChart");
  chart.innerHTML = "";
  const bySeries = state.items.reduce((acc, item) => {
    acc[item.series] = (acc[item.series] || 0) + item.quantity;
    return acc;
  }, {});
  const max = Math.max(...Object.values(bySeries), 1);

  Object.entries(bySeries)
    .sort(([, a], [, b]) => b - a)
    .forEach(([series, count]) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `
        <span class="bar-name"></span>
        <span class="bar-track"><span class="bar-fill"></span></span>
        <strong></strong>
      `;
      row.querySelector(".bar-name").textContent = series;
      row.querySelector(".bar-fill").style.width = `${Math.max(8, (count / max) * 100)}%`;
      row.querySelector("strong").textContent = count;
      chart.append(row);
    });

  if (!Object.keys(bySeries).length) {
    chart.innerHTML = '<p class="note">登録するとシリーズ別の数が表示されます。</p>';
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function saveWishes() {
  localStorage.setItem(WISH_KEY, JSON.stringify(state.wishes));
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
