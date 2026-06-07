(function () {
  const STORAGE_KEY = "record-agent-state-v1";
  const APP_RESOURCE_VERSION = "v10";
  const APP_STATE_VERSION = 4;
  const state = loadState();
  let activeView = "timeline";
  let searchQuery = "";
  let music = null;
  let musicStartPending = false;

  const dom = {
    appShell: document.querySelector(".app-shell"),
    tripList: document.getElementById("tripList"),
    tripCount: document.getElementById("tripCount"),
    activeTripTitle: document.getElementById("activeTripTitle"),
    activeTripMeta: document.getElementById("activeTripMeta"),
    memoryForm: document.getElementById("memoryForm"),
    memoryPhotoInput: document.getElementById("memoryPhotoInput"),
    addMemoryButton: document.getElementById("addMemoryButton"),
    agentStrip: document.getElementById("agentStrip"),
    viewContent: document.getElementById("viewContent"),
    inspector: document.getElementById("inspector"),
    searchInput: document.getElementById("searchInput"),
    recordPanel: document.getElementById("recordPanel"),
    tripDialog: document.getElementById("tripDialog"),
    tripForm: document.getElementById("tripForm"),
    tripTitleInput: document.getElementById("tripTitleInput"),
    tripLocationInput: document.getElementById("tripLocationInput"),
    tripStartInput: document.getElementById("tripStartInput"),
    tripEndInput: document.getElementById("tripEndInput"),
    musicStatus: document.getElementById("musicStatus"),
    appVersion: document.getElementById("appVersion")
  };

  if (dom.appVersion) {
    dom.appVersion.textContent = APP_RESOURCE_VERSION;
    dom.appVersion.title = `当前版本 ${APP_RESOURCE_VERSION}`;
  }

  bindEvents();
  render();
  setupAmbientMusic();
  registerServiceWorker();

  function bindEvents() {
    document.getElementById("newTripButton").addEventListener("click", () => {
      requestAmbientMusic();
      openTripDialog();
    });
    document.getElementById("closeTripDialog").addEventListener("click", closeTripDialog);
    document.getElementById("cancelTripButton").addEventListener("click", closeTripDialog);
    dom.addMemoryButton.addEventListener("click", openMemoryComposer);

    dom.tripList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-trip-id]");
      if (!button) return;
      requestAmbientMusic();
      state.activeTripId = button.dataset.tripId;
      state.selectedMemoryId = null;
      saveState();
      render();
    });

    dom.tripForm.addEventListener("submit", (event) => {
      event.preventDefault();
      requestAmbientMusic();
      const title = dom.tripTitleInput.value.trim();
      if (!title) return;
      const trip = {
        id: createId("trip"),
        title,
        startDate: dom.tripStartInput.value || toDateInput(new Date()),
        endDate: dom.tripEndInput.value || "",
        locations: [dom.tripLocationInput.value.trim() || "未命名地点"],
        coverMediaId: "",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.trips.unshift(trip);
      state.activeTripId = trip.id;
      state.selectedMemoryId = null;
      activeView = "timeline";
      updateActiveTab();
      saveState();
      closeTripDialog();
      render();
    });

    dom.memoryForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await createMemoryFromForm(dom.memoryPhotoInput.files[0]);
    });

    document.querySelector(".tabs").addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (!button) return;
      requestAmbientMusic();
      activeView = button.dataset.view;
      updateActiveTab();
      renderView();
    });

    dom.searchInput.addEventListener("input", () => {
      searchQuery = dom.searchInput.value.trim().toLowerCase();
      renderView();
    });

    dom.viewContent.addEventListener("click", (event) => {
      const card = event.target.closest("[data-memory-id]");
      if (!card) return;
      state.selectedMemoryId = card.dataset.memoryId;
      saveState();
      render();
    });

    dom.inspector.addEventListener("click", async (event) => {
      const action = event.target.closest("[data-action]");
      if (!action) return;
      const memory = getSelectedMemory();
      if (!memory) return;

      if (action.dataset.action === "generate-3d") {
        await start3DGeneration(memory.id);
      }

      if (action.dataset.action === "export-card") {
        exportMemoryCard(memory.id);
      }

      if (action.dataset.action === "save-detail") {
        saveMemoryDetail(memory.id);
      }

      if (action.dataset.action === "add-annotation") {
        addAnnotation(memory.id);
      }
    });

    dom.inspector.addEventListener("pointerdown", (event) => {
      const stage = event.target.closest(".depth-stage");
      if (!stage) return;
      bindDepthDrag(stage, event);
    });
  }

  async function createMemoryFromForm(file, options = {}) {
    const trip = getActiveTrip();
    if (!trip) return;

    const titleInput = document.getElementById("memoryTitleInput");
    const locationInput = document.getElementById("memoryLocationInput");
    const noteInput = document.getElementById("memoryNoteInput");
    const moodInput = document.getElementById("memoryMoodInput");
    const tagsInput = document.getElementById("memoryTagsInput");

    const note = noteInput.value.trim();
    const title = titleInput.value.trim();
    const locationName = locationInput.value.trim() || trip.locations[0] || "旅途中";
    const media = file
      ? {
          id: createId("media"),
          type: "image",
          source: "user",
          dataUrl: await resizeImage(file),
          createdAt: new Date().toISOString()
        }
      : null;
    const agent = buildAgentDraft({ title, note, locationName, tags: tagsInput.value });
    const memory = {
      id: createId("memory"),
      tripId: trip.id,
      title: title || agent.title,
      rawNote: note || "这是一条稍后补全的旅行记忆。",
      agentSummary: agent.summary,
      agentQuestions: agent.questions,
      occurredAt: new Date().toISOString(),
      location: createLocation(locationName),
      mediaIds: media ? [media.id] : [],
      object3DIds: [],
      tags: uniqueTags([...parseTags(tagsInput.value), ...agent.tags]),
      mood: moodInput.value,
      privacyLevel: "private",
      annotations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (media) state.media.unshift(media);
    state.memories.unshift(memory);
    if (media && !trip.coverMediaId) trip.coverMediaId = media.id;
    trip.updatedAt = new Date().toISOString();
    state.selectedMemoryId = memory.id;
    saveState();

    if (!options.quick) {
      dom.memoryForm.reset();
      moodInput.value = "平静";
    }
    dom.recordPanel.classList.add("is-hidden");
    activeView = "timeline";
    render();
  }

  function buildAgentDraft(input) {
    const text = `${input.title} ${input.note} ${input.locationName} ${input.tags}`.trim();
    const clean = text || "一次值得保存的旅行瞬间";
    const tags = [];

    const dictionary = [
      ["雨", "雨天"],
      ["寺", "寺庙"],
      ["神社", "神社"],
      ["街", "街角"],
      ["店", "小店"],
      ["咖啡", "咖啡"],
      ["建筑", "建筑"],
      ["桥", "桥"],
      ["海", "海边"],
      ["山", "山"],
      ["博物馆", "博物馆"],
      ["朋友", "人物故事"],
      ["纪念", "纪念物"]
    ];

    dictionary.forEach(([keyword, tag]) => {
      if (clean.includes(keyword)) tags.push(tag);
    });
    if (!tags.length) tags.push("旅途片刻");

    const summary = input.note
      ? `这条记忆关于 ${input.locationName}：${truncate(input.note, 72)}`
      : `这条记忆发生在 ${input.locationName}，建议补充当时为什么停下来拍下它。`;

    const title = input.title || inferTitle(input.locationName, tags[0]);
    return {
      title,
      summary,
      tags,
      questions: [
        "你当时为什么想留下这个画面？",
        "照片里最有意义的是哪个细节？",
        "几年后回看时，你希望自己先想起什么？"
      ]
    };
  }

  function inferTitle(locationName, tag) {
    const place = locationName.replace(/[，,].*$/, "").trim() || "旅途中";
    return `${place}的${tag}`;
  }

  function createLocation(name) {
    const seed = hashString(name);
    return {
      name,
      lat: 22 + (seed % 5200) / 100,
      lng: 88 + ((seed / 13) % 5200) / 100
    };
  }

  function render() {
    if (!state.activeTripId && state.trips[0]) {
      state.activeTripId = state.trips[0].id;
    }
    renderTrips();
    renderHeader();
    renderAgentStrip();
    renderView();
    renderInspector();
  }

  function renderTrips() {
    dom.tripCount.textContent = state.trips.length;
    dom.tripList.innerHTML = state.trips.map((trip) => {
      const count = getTripMemories(trip.id).length;
      const isActive = trip.id === state.activeTripId ? " is-active" : "";
      return `
        <button class="trip-item${isActive}" type="button" data-trip-id="${trip.id}">
          <strong>${escapeHtml(trip.title)}</strong>
          <small>${escapeHtml(trip.locations.join("、"))}</small>
          <small>${formatDateRange(trip.startDate, trip.endDate)} · ${count} 条记忆</small>
        </button>
      `;
    }).join("");
  }

  function renderHeader() {
    const trip = getActiveTrip();
    if (!trip) {
      dom.activeTripTitle.textContent = "准备中";
      dom.activeTripMeta.textContent = "当前旅行";
      return;
    }
    const memories = getTripMemories(trip.id);
    dom.activeTripTitle.textContent = trip.title;
    dom.activeTripMeta.textContent = `${formatDateRange(trip.startDate, trip.endDate)} · ${memories.length} 条记忆 · ${trip.locations.join("、")}`;
  }

  function renderAgentStrip() {
    const memory = getSelectedMemory();
    if (!memory) {
      dom.agentStrip.hidden = true;
      dom.agentStrip.innerHTML = "";
      return;
    }

    dom.agentStrip.hidden = false;
    dom.agentStrip.innerHTML = `
      <div class="agent-header">
        <div>
          <p class="eyebrow">Agent 对 ${escapeHtml(memory.title)} 的整理</p>
          <strong>${escapeHtml(memory.agentSummary)}</strong>
        </div>
      </div>
      <details class="agent-questions">
        <summary>展开 Agent 的 3 个补全问题</summary>
        <ol>
          ${memory.agentQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}
        </ol>
      </details>
    `;
  }

  function renderView() {
    const renderers = {
      timeline: renderTimeline,
      map: renderMap,
      objects: renderObjects,
      review: renderReview
    };
    updateActiveTab();
    renderers[activeView]();
  }

  function updateActiveTab() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.view === activeView);
    });
  }

  function renderTimeline() {
    const memories = getFilteredMemories();
    if (!memories.length) {
      dom.viewContent.innerHTML = getEmptyState();
      return;
    }
    dom.viewContent.innerHTML = `
      <div class="timeline-list">
        ${memories.map(renderTimelineItem).join("")}
      </div>
    `;
  }

  function renderTimelineItem(memory) {
    const object = getObject3D(memory.object3DIds[0]);
    const hasPhoto = hasUserPhoto(memory);
    const badge = object
      ? object.status === "succeeded"
        ? '<span class="badge is-ready">3D 已生成</span>'
        : '<span class="badge is-processing">3D 建模中</span>'
      : hasPhoto
        ? '<span class="badge">可生成 3D</span>'
        : '<span class="badge">无照片</span>';
    return `
      <article class="timeline-item" data-memory-id="${memory.id}">
        <time datetime="${escapeAttr(memory.occurredAt)}">${formatTimelineDate(memory.occurredAt)}</time>
        <button class="timeline-entry" type="button">
          <span class="timeline-dot" aria-hidden="true"></span>
          <span class="timeline-main">
            <span class="status-row">
              ${badge}
            </span>
            <strong>${escapeHtml(memory.title)}</strong>
            <span class="meta">${escapeHtml(memory.location.name)} · ${escapeHtml(truncate(memory.rawNote, 54))}</span>
          </span>
        </button>
      </article>
    `;
  }

  function renderMap() {
    const memories = getFilteredMemories();
    if (!memories.length) {
      dom.viewContent.innerHTML = getEmptyState();
      return;
    }
    dom.viewContent.innerHTML = `
      <div class="map-panel">
        <div class="map-summary">
          <div>
            <p class="eyebrow">Memory Map</p>
            <strong>本地记忆地图</strong>
          </div>
          <span class="badge">${memories.length} 个地点</span>
        </div>
        <div class="map-canvas" role="img" aria-label="根据记忆地点生成的示意地图">
          <div class="map-water" aria-hidden="true"></div>
          <div class="map-land one" aria-hidden="true"></div>
          <div class="map-land two" aria-hidden="true"></div>
          <div class="map-route" aria-hidden="true"></div>
          ${memories.map((memory, index) => {
            const position = mapPosition(memory.location.name, index);
            return `
              <button class="map-marker" type="button" data-memory-id="${memory.id}" style="--x: ${position.x}%; --y: ${position.y}%">
                <span class="map-pin" aria-hidden="true"></span>
                <strong>${escapeHtml(memory.title)}</strong>
                <small>${escapeHtml(memory.location.name)}</small>
                <small>${formatDateTime(memory.occurredAt)}</small>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function renderObjects() {
    const memories = getFilteredMemories();
    const objectMemories = memories.filter((memory) => memory.object3DIds.length);
    if (!objectMemories.length) {
      dom.viewContent.innerHTML = `
        <div class="empty-state">
          <h3>还没有 3D 记忆对象</h3>
          <p>选择一条记忆后点击“生成 3D”，就能把照片变成可拖动的空间记忆卡。</p>
        </div>
      `;
      return;
    }
    dom.viewContent.innerHTML = `
      <div class="object-grid">
        ${objectMemories.map((memory) => {
          const media = getMedia(memory.mediaIds[0]);
          const object = getObject3D(memory.object3DIds[0]);
          const progress = object.status === "succeeded" ? 100 : object.progress;
          return `
            <article class="object-card" data-memory-id="${memory.id}">
              <img class="memory-photo" src="${media.dataUrl}" alt="${escapeAttr(memory.title)}">
              <div class="object-body">
                <div class="status-row">
                  <span class="badge ${object.status === "succeeded" ? "is-ready" : "is-processing"}">${object.status === "succeeded" ? "可查看" : "生成中"}</span>
                  <span class="badge">单图 3D 记忆</span>
                </div>
                <h3>${escapeHtml(memory.title)}</h3>
                <div class="progress-bar" aria-label="生成进度"><span style="--value: ${progress}%"></span></div>
                <p class="meta">${escapeHtml(object.qualityReport)}</p>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderReview() {
    const trip = getActiveTrip();
    const memories = getFilteredMemories();
    const objectCount = memories.filter((memory) => memory.object3DIds.some((id) => getObject3D(id)?.status === "succeeded")).length;
    const tags = uniqueTags(memories.flatMap((memory) => memory.tags)).slice(0, 8);
    const moods = uniqueTags(memories.map((memory) => memory.mood));

    dom.viewContent.innerHTML = `
      <div class="review-layout">
        <div class="stats-grid">
          <div class="stat-card"><p class="eyebrow">Memories</p><h3>${memories.length}</h3><p class="meta">已保存的意义片段</p></div>
          <div class="stat-card"><p class="eyebrow">3D</p><h3>${objectCount}</h3><p class="meta">已生成的空间记忆</p></div>
          <div class="stat-card"><p class="eyebrow">Mood</p><h3>${escapeHtml(moods[0] || "未记录")}</h3><p class="meta">${escapeHtml(moods.join("、") || "等待补充情绪")}</p></div>
        </div>
        <article class="review-block">
          <p class="eyebrow">Agent 草稿</p>
          <h3>${escapeHtml(trip?.title || "旅行回顾")}</h3>
          <p class="meta">${buildReviewCopy(memories)}</p>
          <div class="tag-row">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        </article>
        <article class="review-block">
          <p class="eyebrow">导出方向</p>
          <p class="meta">MVP 当前支持单条记忆图片卡片导出。下一阶段可把这里扩展成 Markdown、PDF 和私密网页展览。</p>
        </article>
      </div>
    `;
  }

  function renderInspector() {
    const memory = getSelectedMemory();
    if (!memory) {
      dom.appShell.classList.add("is-inspector-hidden");
      dom.inspector.hidden = true;
      dom.inspector.innerHTML = "";
      return;
    }

    dom.appShell.classList.remove("is-inspector-hidden");
    dom.inspector.hidden = false;
    const object = getObject3D(memory.object3DIds[0]);
    const hasReadyObject = object?.status === "succeeded";
    const hasPhoto = hasUserPhoto(memory);
    const media = hasPhoto ? getMedia(memory.mediaIds[0]) : null;
    dom.inspector.innerHTML = `
      <div class="detail">
        ${media ? `<img class="detail-cover" src="${media.dataUrl}" alt="${escapeAttr(memory.title)}">` : '<div class="detail-cover detail-cover-empty">这条记忆还没有照片</div>'}
        <div>
          <p class="eyebrow">${escapeHtml(memory.location.name)}</p>
          <h3>${escapeHtml(memory.title)}</h3>
          <p class="meta">${formatDateTime(memory.occurredAt)} · ${escapeHtml(memory.mood)}</p>
        </div>

        <div class="detail-actions">
          ${hasPhoto ? `<button class="primary-action" type="button" data-action="generate-3d">${hasReadyObject ? "重新生成 3D" : object ? "查看 3D" : "生成 3D"}</button>` : '<span class="disabled-action">添加照片后可生成 3D</span>'}
          <button class="ghost-button" type="button" data-action="export-card">导出卡片</button>
        </div>

        ${renderObjectStatus(memory, object)}

        <details class="detail-section detail-fold">
          <summary>编辑原话和 Agent 摘要</summary>
          <label>
            <span>用户原话</span>
            <textarea id="detailNoteInput" rows="4">${escapeHtml(memory.rawNote)}</textarea>
          </label>
          <label>
            <span>Agent 摘要</span>
            <textarea id="detailSummaryInput" rows="3">${escapeHtml(memory.agentSummary)}</textarea>
          </label>
          <button class="ghost-button" type="button" data-action="save-detail">保存编辑</button>
        </details>

        <div class="detail-section">
          <strong>标签</strong>
          <div class="tag-row">${memory.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        </div>

        <details class="detail-section detail-fold">
          <summary>添加或查看说明点</summary>
          <label>
            <span>说明点</span>
            <input id="annotationInput" type="text" placeholder="例如：门口这盏灯让我停了下来">
          </label>
          <button class="ghost-button" type="button" data-action="add-annotation">添加到 3D 中心</button>
          ${renderAnnotationList(memory)}
        </details>
      </div>
    `;
  }

  function renderObjectStatus(memory, object) {
    if (!hasUserPhoto(memory)) {
      return `
        <div class="detail-section">
          <strong>3D 状态</strong>
          <p class="meta">这条记忆还没有照片。上传或导入照片后，才会出现可生成的 3D 记忆对象。</p>
        </div>
      `;
    }

    if (!object) {
      return `
        <div class="detail-section">
          <strong>3D 状态</strong>
          <p class="meta">这张照片还没有生成 3D 记忆对象。当前版本会直接生成一个可拖动的本地 3D 预览，后续可替换成真实云端 3D 重建结果。</p>
        </div>
      `;
    }

    if (object.status !== "succeeded") {
      return `
      <div class="detail-section">
        <strong>生成中</strong>
        <div class="progress-bar"><span style="--value: ${object.progress}%"></span></div>
          <p class="meta">${escapeHtml(object.qualityReport)}</p>
        </div>
      `;
    }

    const media = getMedia(memory.mediaIds[0]);
    return `
      <div class="detail-section">
        <strong>3D 记忆对象</strong>
        <div class="depth-stage" data-depth-stage>
          <div class="depth-stack" style="--depth-image: url('${media.dataUrl}')">
            <div class="depth-layer back"></div>
            <div class="depth-layer mid"></div>
            <img class="depth-image" src="${media.dataUrl}" alt="${escapeAttr(memory.title)}">
            ${memory.annotations.map((item) => `
              <button class="annotation-pin" type="button" style="--x: ${item.x}%; --y: ${item.y}%" aria-label="${escapeAttr(item.text)}">
                <span>${escapeHtml(item.text)}</span>
              </button>
            `).join("")}
          </div>
        </div>
        <p class="hint">拖动预览区可以旋转。当前是本地单图 3D 预览，后续可以接入真实建模服务。</p>
      </div>
    `;
  }

  function renderAnnotationList(memory) {
    if (!memory.annotations.length) {
      return '<p class="meta">还没有标注。生成 3D 后可以把说明点贴到对象上。</p>';
    }
    return `
      <ul class="annotation-list">
        ${memory.annotations.map((item) => `<li>${escapeHtml(item.text)}</li>`).join("")}
      </ul>
    `;
  }

  async function start3DGeneration(memoryId) {
    const memory = state.memories.find((item) => item.id === memoryId);
    if (!memory) return;
    if (!hasUserPhoto(memory)) return;
    let object = getObject3D(memory.object3DIds[0]);
    if (!object) {
      object = {
        id: createId("object3d"),
        memoryId,
        sourceMediaIds: memory.mediaIds.slice(),
        generationLevel: "single-image-3d-preview",
        status: "succeeded",
        progress: 100,
        assetUrl: "",
        previewUrl: getMedia(memory.mediaIds[0]).dataUrl,
        qualityScore: 0.82,
        qualityReport: "已生成本地单图 3D 记忆预览。后续可替换为真实 3D 建模管线。",
        failureReason: "",
        annotations: [],
        createdAt: new Date().toISOString()
      };
      state.objects3D.unshift(object);
      memory.object3DIds = [object.id];
    } else {
      object.status = "succeeded";
      object.progress = 100;
      object.qualityReport = "已重新生成本地单图 3D 记忆预览。";
    }

    object.assetUrl = `local://${object.id}`;
    activeView = "objects";
    saveState();
    render();
  }

  function setupAmbientMusic() {
    requestAmbientMusic();
    ["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
      document.addEventListener(eventName, requestAmbientMusic, { once: true, passive: true });
    });
  }

  function requestAmbientMusic() {
    if (music?.playing || musicStartPending) return;
    musicStartPending = true;
    startMusic()
      .catch(() => {
        if (dom.musicStatus) dom.musicStatus.textContent = "音频会在下一次点击页面时启动。";
      })
      .finally(() => {
        musicStartPending = false;
      });
  }

  async function startMusic() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      if (dom.musicStatus) dom.musicStatus.textContent = "当前浏览器不支持 Web Audio。";
      return;
    }

    if (!music) {
      const context = new AudioContext();
      const master = context.createGain();
      const padGain = context.createGain();
      const delayNode = context.createDelay(1.4);
      const feedback = context.createGain();
      const filter = context.createBiquadFilter();

      master.gain.value = 0.2;
      padGain.gain.value = 0.06;
      delayNode.delayTime.value = 0.48;
      feedback.gain.value = 0.2;
      filter.type = "lowpass";
      filter.frequency.value = 2400;

      master.connect(filter);
      filter.connect(context.destination);
      master.connect(delayNode);
      delayNode.connect(feedback);
      feedback.connect(delayNode);
      delayNode.connect(filter);
      padGain.connect(master);

      music = {
        context,
        master,
        padGain,
        padOscillators: [],
        playing: false,
        timers: [],
        step: 0,
        notes: [392.0, 493.88, 587.33, 659.25, 783.99, 659.25, 587.33, 493.88]
      };
    }

    await music.context.resume();
    if (music.context.state !== "running") {
      if (dom.musicStatus) dom.musicStatus.textContent = "音频会在下一次点击页面时启动。";
      return;
    }
    if (music.playing) return;
    music.playing = true;
    startPad();
    playStartupChime();
    if (dom.musicStatus) dom.musicStatus.textContent = "背景音乐播放中。";
    scheduleAmbientNote();
  }

  function playStartupChime() {
    const now = music.context.currentTime;
    playTone(493.88, now, 0.9, 0.1);
    playTone(587.33, now + 0.12, 1, 0.09);
    playTone(783.99, now + 0.28, 1.2, 0.075);
  }

  function startPad() {
    if (!music || music.padOscillators.length) return;
    [196.0, 293.66, 392.0].forEach((frequency, index) => {
      const oscillator = music.context.createOscillator();
      const gain = music.context.createGain();
      oscillator.type = index === 1 ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 1 ? 0.18 : 0.12;
      oscillator.connect(gain);
      gain.connect(music.padGain);
      oscillator.start();
      music.padOscillators.push(oscillator);
    });
  }

  function scheduleAmbientNote() {
    if (!music?.playing) return;
    const now = music.context.currentTime;
    const note = music.notes[music.step % music.notes.length];
    const harmony = music.notes[(music.step + 2) % music.notes.length] / 2;
    playTone(note, now, 3.2, 0.07);
    playTone(harmony, now + 0.08, 3.6, 0.04);
    music.step += music.step % 5 === 4 ? 2 : 1;
    music.timers.push(window.setTimeout(scheduleAmbientNote, 1750));
  }

  function playTone(frequency, startAt, duration, volume) {
    const oscillator = music.context.createOscillator();
    const gain = music.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(music.master);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.1);
  }

  function stopMusic() {
    if (!music) return;
    music.playing = false;
    music.timers.forEach((timer) => window.clearTimeout(timer));
    music.timers = [];
    music.padOscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch (error) {
        // The oscillator may already be stopped by the browser.
      }
    });
    music.padOscillators = [];
    if (dom.musicStatus) dom.musicStatus.textContent = "";
  }

  function saveMemoryDetail(memoryId) {
    const memory = state.memories.find((item) => item.id === memoryId);
    if (!memory) return;
    const note = document.getElementById("detailNoteInput")?.value.trim();
    const summary = document.getElementById("detailSummaryInput")?.value.trim();
    memory.rawNote = note || memory.rawNote;
    memory.agentSummary = summary || memory.agentSummary;
    memory.updatedAt = new Date().toISOString();
    saveState();
    render();
  }

  function addAnnotation(memoryId) {
    const memory = state.memories.find((item) => item.id === memoryId);
    if (!memory) return;
    const input = document.getElementById("annotationInput");
    const text = input?.value.trim();
    if (!text) return;
    const index = memory.annotations.length;
    memory.annotations.push({
      id: createId("annotation"),
      targetType: "object3D",
      targetId: memory.object3DIds[0] || "",
      x: 42 + ((index * 17) % 34),
      y: 38 + ((index * 13) % 30),
      text,
      createdAt: new Date().toISOString()
    });
    input.value = "";
    saveState();
    render();
  }

  function exportMemoryCard(memoryId) {
    const memory = state.memories.find((item) => item.id === memoryId);
    if (!memory) return;
    const media = getMedia(memory.mediaIds[0]);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1440;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f6f9f6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawRoundedRect(ctx, 70, 70, 940, 760, 20, "#ffffff");
      drawCoverImage(ctx, image, 90, 90, 900, 720);
      ctx.fillStyle = "#16231b";
      ctx.font = "700 54px Segoe UI, Microsoft YaHei, sans-serif";
      wrapText(ctx, memory.title, 90, 920, 900, 68);
      ctx.fillStyle = "#2f6f50";
      ctx.font = "700 28px Segoe UI, Microsoft YaHei, sans-serif";
      ctx.fillText(memory.location.name, 90, 1040);
      ctx.fillStyle = "#65736a";
      ctx.font = "28px Segoe UI, Microsoft YaHei, sans-serif";
      wrapText(ctx, memory.rawNote, 90, 1110, 900, 42);
      ctx.fillStyle = "#2f6f50";
      ctx.font = "700 24px Segoe UI, Microsoft YaHei, sans-serif";
      ctx.fillText(`旅行意义记录 Agent · ${formatDateTime(memory.occurredAt)}`, 90, 1340);

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${sanitizeFileName(memory.title)}.png`;
      link.click();
    };
    image.src = media.dataUrl;
  }

  function bindDepthDrag(stage, startEvent) {
    const stack = stage.querySelector(".depth-stack");
    if (!stack) return;
    stage.setPointerCapture(startEvent.pointerId);
    const rect = stage.getBoundingClientRect();
    updateRotation(startEvent);

    function move(event) {
      updateRotation(event);
    }

    function up(event) {
      stage.releasePointerCapture(event.pointerId);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
    }

    function updateRotation(event) {
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 18;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * -14;
      stack.style.setProperty("--ry", `${x.toFixed(2)}deg`);
      stack.style.setProperty("--rx", `${y.toFixed(2)}deg`);
    }

    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
  }

  function getActiveTrip() {
    return state.trips.find((trip) => trip.id === state.activeTripId) || state.trips[0] || null;
  }

  function getSelectedMemory() {
    return state.memories.find((memory) => memory.id === state.selectedMemoryId) || null;
  }

  function getTripMemories(tripId) {
    return state.memories
      .filter((memory) => memory.tripId === tripId)
      .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
  }

  function getFilteredMemories() {
    const trip = getActiveTrip();
    if (!trip) return [];
    const memories = getTripMemories(trip.id);
    if (!searchQuery) return memories;
    return memories.filter((memory) => {
      const objectText = memory.object3DIds
        .map((id) => getObject3D(id))
        .filter(Boolean)
        .map((object) => `${object.generationLevel} ${object.status} ${object.qualityReport}`)
        .join(" ");
      const haystack = [
        memory.title,
        memory.rawNote,
        memory.agentSummary,
        memory.location.name,
        memory.mood,
        memory.tags.join(" "),
        objectText
      ].join(" ").toLowerCase();
      return haystack.includes(searchQuery);
    });
  }

  function getMedia(id) {
    return state.media.find((item) => item.id === id) || { dataUrl: createSampleImage("缺失图片") };
  }

  function hasUserPhoto(memory) {
    return memory.mediaIds.some((id) => {
      const media = state.media.find((item) => item.id === id);
      return media?.type === "image" && media.source !== "placeholder";
    });
  }

  function getObject3D(id) {
    return state.objects3D.find((item) => item.id === id) || null;
  }

  function openTripDialog() {
    dom.tripForm.reset();
    const today = toDateInput(new Date());
    dom.tripStartInput.value = today;
    if (typeof dom.tripDialog.showModal === "function") {
      dom.tripDialog.showModal();
    }
  }

  function openMemoryComposer() {
    const trip = getActiveTrip();
    if (!trip) return;
    requestAmbientMusic();
    dom.recordPanel.classList.remove("is-hidden");
    document.getElementById("memoryLocationInput").value = trip.locations[0] || "";
    dom.recordPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("memoryTitleInput").focus();
  }

  function closeTripDialog() {
    dom.tripDialog.close();
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.uiVersion !== APP_STATE_VERSION) {
          if (isDemoOnlyState(parsed) || !parsed.trips?.length) {
            return createSeedState();
          }
          parsed.selectedMemoryId = null;
          parsed.uiVersion = APP_STATE_VERSION;
        }
        return parsed;
      }
    } catch (error) {
      console.warn("Unable to load local state", error);
    }
    return createSeedState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function isDemoOnlyState(value) {
    const tripTitle = value?.trips?.[0]?.title || "";
    const memoryTitle = value?.memories?.[0]?.title || "";
    return value?.trips?.length === 1
      && value?.memories?.length === 1
      && tripTitle.includes("京都")
      && memoryTitle.includes("雨后");
  }

  function createSeedState() {
    const tripId = createId("trip");
    const mediaId = createId("media");
    const memoryId = createId("memory");
    const image = createSampleImage("雨后的街角");
    return {
      activeTripId: tripId,
      selectedMemoryId: null,
      uiVersion: APP_STATE_VERSION,
      trips: [
        {
          id: tripId,
          title: "京都 2026 春",
          startDate: "2026-04-05",
          endDate: "2026-04-12",
          locations: ["日本京都"],
          coverMediaId: mediaId,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      memories: [
        {
          id: memoryId,
          tripId,
          title: "雨后的街角小店",
          rawNote: "下雨刚停，店门口的灯和湿掉的石板路让我觉得这一刻很安静。",
          agentSummary: "这条记忆关于日本京都：雨后的小店、灯光和湿润的街道共同构成了一个平静的停顿。",
          agentQuestions: [
            "你当时为什么愿意在这里停下来？",
            "这张照片里最想保留的是灯光、路面，还是那家店？",
            "如果把它做成 3D 记忆对象，你想标注哪个细节？"
          ],
          occurredAt: new Date().toISOString(),
          location: createLocation("京都，哲学之道附近"),
          mediaIds: [mediaId],
          object3DIds: [],
          tags: ["雨天", "街角", "小店"],
          mood: "平静",
          privacyLevel: "private",
          annotations: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      media: [
        {
          id: mediaId,
          type: "image",
          source: "user",
          dataUrl: image,
          createdAt: new Date().toISOString()
        }
      ],
      objects3D: []
    };
  }

  function createSampleImage(label) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");

    const sky = ctx.createLinearGradient(0, 0, 0, 520);
    sky.addColorStop(0, "#dcefe5");
    sky.addColorStop(1, "#f6f9f6");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#8bb49e";
    ctx.fillRect(0, 610, canvas.width, 290);
    ctx.fillStyle = "#6c947d";
    ctx.beginPath();
    ctx.moveTo(0, 650);
    ctx.bezierCurveTo(240, 580, 400, 720, 620, 645);
    ctx.bezierCurveTo(840, 570, 1010, 670, 1200, 610);
    ctx.lineTo(1200, 900);
    ctx.lineTo(0, 900);
    ctx.closePath();
    ctx.fill();

    drawBuilding(ctx, 120, 300, 250, 350, "#f8fbf8", "#476958");
    drawBuilding(ctx, 410, 250, 320, 410, "#ffffff", "#315541");
    drawBuilding(ctx, 780, 330, 270, 330, "#eef5f0", "#557764");

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    for (let i = 0; i < 70; i += 1) {
      const x = (i * 73) % 1200;
      const y = 80 + ((i * 41) % 560);
      ctx.fillRect(x, y, 2, 18);
    }

    ctx.fillStyle = "#16231b";
    ctx.font = "700 48px Segoe UI, Microsoft YaHei, sans-serif";
    ctx.fillText(label.slice(0, 14), 74, 120);
    ctx.fillStyle = "#2f6f50";
    ctx.font = "28px Segoe UI, Microsoft YaHei, sans-serif";
    ctx.fillText("Generated travel memory preview", 76, 166);

    return canvas.toDataURL("image/jpeg", 0.88);
  }

  function drawBuilding(ctx, x, y, width, height, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = stroke;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        ctx.globalAlpha = 0.75;
        ctx.fillRect(x + 42 + col * 72, y + 48 + row * 70, 34, 42);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillRect(x + width / 2 - 32, y + height - 86, 64, 86);
  }

  async function resizeImage(file) {
    const dataUrl = await readFileAsDataUrl(file);
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const maxSide = 1400;
        const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.round(image.width * ratio);
        const height = Math.round(image.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.src = dataUrl;
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function buildReviewCopy(memories) {
    if (!memories.length) {
      return "这次旅行还在等待第一条记忆。";
    }
    const first = memories[memories.length - 1];
    const latest = memories[0];
    return `这次旅行从“${first.title}”开始被记录，最近一次停留在“${latest.title}”。这些片段共同指向 ${uniqueTags(memories.flatMap((memory) => memory.tags)).slice(0, 4).join("、")}，后续可以整理成一篇按地点和情绪展开的旅行回顾。`;
  }

  function drawCoverImage(ctx, image, x, y, width, height) {
    const ratio = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * ratio;
    const drawHeight = image.height * ratio;
    const dx = x + (width - drawWidth) / 2;
    const dy = y + (height - drawHeight) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 16);
    ctx.clip();
    ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
    ctx.restore();
  }

  function drawRoundedRect(ctx, x, y, width, height, radius, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const characters = String(text).split("");
    let line = "";
    let cursorY = y;
    characters.forEach((character) => {
      const testLine = line + character;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        line = character;
        cursorY += lineHeight;
      } else {
        line = testLine;
      }
    });
    if (line) ctx.fillText(line, x, cursorY);
  }

  function mapPosition(text, index) {
    const seed = hashString(text);
    return {
      x: 18 + ((seed + index * 19) % 64),
      y: 20 + ((seed * 7 + index * 23) % 58)
    };
  }

  function parseTags(value) {
    return value
      .split(/[,，、\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function uniqueTags(tags) {
    return Array.from(new Set(tags.filter(Boolean))).slice(0, 10);
  }

  function truncate(text, length) {
    const value = String(text || "");
    return value.length > length ? `${value.slice(0, length)}...` : value;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function formatDateRange(start, end) {
    if (!start && !end) return "未设置日期";
    if (!end || start === end) return start;
    return `${start} 至 ${end}`;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatTimelineDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function toDateInput(date) {
    return date.toISOString().slice(0, 10);
  }

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function createId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function sanitizeFileName(value) {
    return String(value || "memory-card").replace(/[\\/:*?"<>|]/g, "_");
  }

  function getEmptyState() {
    return document.getElementById("emptyStateTemplate").innerHTML;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Local file previews cannot register a service worker; served previews can.
    });
  }
})();
