(function () {
  const LS_KEY = "shunkan_eisakubun_progress_v1";
  const ALL = (typeof SENTENCES !== "undefined" ? SENTENCES : []).map((s, i) => ({ id: i, ...s }));

  let progress = loadProgress();
  let topicFilter = "__all__";
  let reviewOnly = false;
  let orderMode = "random"; // "random" | "sequential"
  let queue = [];
  let pos = 0;
  let revealed = false;

  const el = {
    topicSelect: document.getElementById("topicSelect"),
    orderBtn: document.getElementById("orderBtn"),
    reviewBtn: document.getElementById("reviewBtn"),
    shuffleBtn: document.getElementById("shuffleBtn"),
    progressFill: document.getElementById("progressFill"),
    progressLabel: document.getElementById("progressLabel"),
    modeLabel: document.getElementById("modeLabel"),
    cardTag: document.getElementById("cardTag"),
    jaText: document.getElementById("jaText"),
    enText: document.getElementById("enText"),
    revealRow: document.getElementById("revealRow"),
    judgeRow: document.getElementById("judgeRow"),
    revealBtn: document.getElementById("revealBtn"),
    ngBtn: document.getElementById("ngBtn"),
    okBtn: document.getElementById("okBtn"),
    favBtn: document.getElementById("favBtn"),
    statsBar: document.getElementById("statsBar"),
    resetLink: document.getElementById("resetLink"),
  };

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveProgress() {
    localStorage.setItem(LS_KEY, JSON.stringify(progress));
  }
  function getEntry(id) {
    return progress[id] || { status: null, favorited: false, seen: 0 };
  }
  function setEntry(id, patch) {
    const cur = getEntry(id);
    progress[id] = { ...cur, ...patch };
    saveProgress();
  }

  function buildTopicOptions() {
    const topics = [...new Set(ALL.map((s) => s.topic))];
    el.topicSelect.innerHTML =
      `<option value="__all__">すべてのトピック（${ALL.length}問）</option>` +
      topics
        .map((t) => {
          const count = ALL.filter((s) => s.topic === t).length;
          return `<option value="${escapeHtml(t)}">${escapeHtml(t)}（${count}問）</option>`;
        })
        .join("");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function currentPool() {
    let pool = ALL;
    if (topicFilter !== "__all__") {
      pool = pool.filter((s) => s.topic === topicFilter);
    }
    if (reviewOnly) {
      pool = pool.filter((s) => {
        const e = getEntry(s.id);
        return e.favorited || e.status === "ng";
      });
    }
    return pool;
  }

  function rebuildQueue(keepPos) {
    const pool = currentPool();
    queue = orderMode === "random" ? shuffle(pool) : pool.slice();
    pos = keepPos ? Math.min(pos, Math.max(queue.length - 1, 0)) : 0;
    revealed = false;
    renderCard();
    renderStats();
  }

  function renderStats() {
    const total = ALL.length;
    const seen = Object.values(progress).filter((e) => e.seen > 0).length;
    const ok = Object.values(progress).filter((e) => e.status === "ok").length;
    const favorited = Object.values(progress).filter((e) => e.favorited || e.status === "ng").length;
    el.statsBar.innerHTML =
      `<span>総問題数 <b>${total}</b></span>` +
      `<span>練習済み <b>${seen}</b></span>` +
      `<span>できた <b>${ok}</b></span>` +
      `<span>要復習 <b>${favorited}</b></span>`;
  }

  function renderCard() {
    const total = queue.length;
    el.progressLabel.textContent = total === 0 ? "0 / 0" : `${pos + 1} / ${total}`;
    el.progressFill.style.width = total === 0 ? "0%" : `${((pos + 1) / total) * 100}%`;
    el.modeLabel.textContent = reviewOnly ? "復習モード" : orderMode === "random" ? "ランダム" : "順番";

    if (total === 0) {
      el.cardTag.textContent = "";
      el.jaText.innerHTML = `<span class="empty-msg">${
        reviewOnly ? "復習対象の問題がありません（お気に入りや✕がついた問題がここに表示されます）" : "該当する問題がありません"
      }</span>`;
      el.enText.style.display = "none";
      el.revealRow.style.display = "none";
      el.judgeRow.style.display = "none";
      return;
    }

    const item = queue[pos];
    el.cardTag.textContent = `${item.topic} #${item.group}`;
    el.jaText.textContent = item.ja;
    el.enText.textContent = item.en;

    if (revealed) {
      el.enText.style.display = "block";
      el.revealRow.style.display = "none";
      el.judgeRow.style.display = "flex";
      const e = getEntry(item.id);
      el.favBtn.classList.toggle("favorited", !!e.favorited);
    } else {
      el.enText.style.display = "none";
      el.revealRow.style.display = "flex";
      el.judgeRow.style.display = "none";
    }
  }

  function reveal() {
    if (queue.length === 0) return;
    revealed = true;
    renderCard();
  }

  function next() {
    if (queue.length === 0) return;
    pos = (pos + 1) % queue.length;
    revealed = false;
    renderCard();
  }

  function judge(status) {
    if (queue.length === 0) return;
    const item = queue[pos];
    const e = getEntry(item.id);
    setEntry(item.id, { status, seen: (e.seen || 0) + 1 });
    renderStats();
    if (reviewOnly && status === "ok" && !getEntry(item.id).favorited) {
      // 復習モードでできた問題はキューから外す
      queue.splice(pos, 1);
      if (queue.length === 0) {
        renderCard();
        return;
      }
      pos = pos % queue.length;
      revealed = false;
      renderCard();
    } else {
      next();
    }
  }

  function toggleFavorite() {
    if (queue.length === 0) return;
    const item = queue[pos];
    const e = getEntry(item.id);
    setEntry(item.id, { favorited: !e.favorited });
    renderStats();
    renderCard();
  }

  // イベント
  el.topicSelect.addEventListener("change", () => {
    topicFilter = el.topicSelect.value;
    rebuildQueue(false);
  });
  el.orderBtn.addEventListener("click", () => {
    orderMode = orderMode === "random" ? "sequential" : "random";
    el.orderBtn.textContent = orderMode === "random" ? "🔀 ランダム" : "📋 順番";
    el.orderBtn.classList.toggle("active", orderMode === "random");
    rebuildQueue(false);
  });
  el.reviewBtn.addEventListener("click", () => {
    reviewOnly = !reviewOnly;
    el.reviewBtn.classList.toggle("active", reviewOnly);
    el.reviewBtn.classList.toggle("danger", reviewOnly);
    rebuildQueue(false);
  });
  el.shuffleBtn.addEventListener("click", () => rebuildQueue(false));
  el.revealBtn.addEventListener("click", reveal);
  el.okBtn.addEventListener("click", () => judge("ok"));
  el.ngBtn.addEventListener("click", () => judge("ng"));
  el.favBtn.addEventListener("click", toggleFavorite);
  el.resetLink.addEventListener("click", () => {
    if (confirm("進捗（正誤・お気に入り）をすべてリセットしますか？")) {
      progress = {};
      saveProgress();
      rebuildQueue(true);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT") return;
    if (e.code === "Space") {
      e.preventDefault();
      revealed ? next() : reveal();
    } else if (e.code === "ArrowRight") {
      if (revealed) judge("ok");
    } else if (e.code === "ArrowLeft") {
      if (revealed) judge("ng");
    } else if (e.key === "f" || e.key === "F") {
      if (revealed) toggleFavorite();
    }
  });

  // 初期化
  el.orderBtn.classList.add("active");
  buildTopicOptions();
  rebuildQueue(false);
})();
