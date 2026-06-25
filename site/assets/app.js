const state = {
  catalog: null,
  selectedTermId: null,
  selectedTags: new Set()
};

const page = document.body.dataset.page;
const params = new URLSearchParams(window.location.search);

document.addEventListener("DOMContentLoaded", async () => {
  try {
    state.catalog = await loadCatalog();
    if (page === "home") renderHome();
    if (page === "course") renderCourse();
    if (page === "lesson") renderLesson();
    if (page === "search") renderSearch();
  } catch (error) {
    renderError(document.querySelector("main") || document.body, error.message);
  }
});

async function loadCatalog() {
  const response = await fetch("./data/catalog.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("catalog.json を読み込めませんでした。生成と配置を確認してください。");
  }
  return response.json();
}

function renderHome() {
  const list = document.querySelector("#course-list");
  list.innerHTML = "";

  for (const course of state.catalog.courses) {
    const lessons = state.catalog.lessons.filter((lesson) => lesson.courseId === course.id);
    const termCount = new Set(lessons.map((lesson) => lesson.termId)).size;
    const lessonCount = new Set(lessons.map((lesson) => lesson.lessonNo)).size;
    list.append(
      el("a", {
        className: "card",
        href: `./course.html?id=${encodeURIComponent(course.id)}`
      }, [
        el("h3", {}, course.title),
        el("p", {}, course.description || ""),
        el("div", { className: "meta-row" }, [
          pill(`${termCount} 開講期`),
          pill(`${lessonCount} 授業回`)
        ]),
        tagRow(course.tags)
      ])
    );
  }

  if (!state.catalog.courses.length) {
    list.append(notice("科目がまだ登録されていません。"));
  }
}

function renderCourse() {
  const courseId = params.get("id");
  const course = findCourse(courseId);
  const heading = document.querySelector("#course-heading");
  if (!course) {
    renderError(heading, "科目が見つかりません。");
    return;
  }

  const lessons = lessonsForCourse(course.id);
  const terms = termsForLessons(lessons);
  state.selectedTermId = params.get("term") || terms[0]?.id || null;

  document.title = `${course.title} | 授業資料`;
  heading.innerHTML = "";
  heading.append(
    el("p", { className: "eyebrow" }, "Course"),
    el("h1", {}, course.title),
    el("p", {}, course.description || ""),
    tagRow(course.tags)
  );

  document.querySelector("#term-count").textContent = `${terms.length} 開講期`;
  document.querySelector("#course-search-link").href = `./search.html?course=${encodeURIComponent(course.id)}`;
  renderTermTabs(terms, (termId) => {
    state.selectedTermId = termId;
    history.replaceState(null, "", `./course.html?id=${encodeURIComponent(course.id)}&term=${encodeURIComponent(termId)}`);
    renderCourseLessons(course.id);
  });
  renderCourseLessons(course.id);
}

function renderCourseLessons(courseId) {
  const list = document.querySelector("#lesson-list");
  const lessons = lessonsForCourse(courseId)
    .filter((lesson) => lesson.termId === state.selectedTermId)
    .sort(compareLessonNo);
  list.innerHTML = "";

  for (const lesson of lessons) {
    list.append(lessonCard(lesson, { showCourse: false }));
  }

  if (!lessons.length) {
    list.append(notice("この開講期の授業は登録されていません。"));
  }
}

function renderLesson() {
  const termId = params.get("term");
  const courseId = params.get("course");
  const lessonNo = params.get("lesson");
  const lesson = findLesson(termId, courseId, lessonNo);
  const heading = document.querySelector("#lesson-heading");
  if (!lesson) {
    renderError(heading, "授業が見つかりません。URLの開講期、科目、授業回を確認してください。");
    return;
  }

  const course = findCourse(lesson.courseId);
  const term = findTerm(lesson.termId);
  document.title = `${lesson.title} | 授業資料`;
  document.querySelector("#lesson-breadcrumb").innerHTML =
    `<a href="./course.html?id=${encodeURIComponent(course.id)}">${escapeHtml(course.title)}</a>`;

  heading.innerHTML = "";
  heading.append(
    el("p", { className: "eyebrow" }, `${term.label} / 第${lesson.lessonNo}回`),
    el("h1", {}, lesson.title),
    el("p", {}, lesson.description || ""),
    el("div", { className: "meta-row" }, [
      pill(`最終更新 ${formatDate(lesson.lastUpdated)}`),
      lesson.isLatestForCourseLesson ? pill("最新版") : pill("過去開講期")
    ]),
    tagRow([...course.tags, ...lesson.tags])
  );

  const files = document.querySelector("#file-list");
  files.innerHTML = "";
  document.querySelector("#file-count").textContent = `${lesson.files.length} 件`;
  for (const file of lesson.files) {
    files.append(fileItem(file));
  }

  const versions = state.catalog.lessons
    .filter((candidate) => candidate.courseId === lesson.courseId && candidate.lessonNo === lesson.lessonNo)
    .sort(compareLessonVersion)
    .filter((candidate) => candidate.id !== lesson.id);
  const versionList = document.querySelector("#version-list");
  versionList.innerHTML = "";
  for (const version of versions) {
    versionList.append(lessonCard(version, { showCourse: false }));
  }
  if (!versions.length) {
    versionList.append(notice("他開講期の同じ授業はありません。"));
  }
}

function renderSearch() {
  hydrateSearchControls();
  updateSearchResults();
}

function hydrateSearchControls() {
  const courseFilter = document.querySelector("#course-filter");
  const termFilter = document.querySelector("#term-filter");
  const lessonFilter = document.querySelector("#lesson-filter");
  const query = document.querySelector("#query");

  fillSelect(courseFilter, [["", "すべて"], ...state.catalog.courses.map((course) => [course.id, course.title])]);
  fillSelect(termFilter, [["", "すべて"], ["latest", "最新開講期のみ"], ...state.catalog.terms.map((term) => [term.id, term.label])]);

  courseFilter.value = params.get("course") || "";
  termFilter.value = params.get("term") || "";
  lessonFilter.value = params.get("lesson") || "";
  query.value = params.get("q") || "";

  for (const control of [courseFilter, termFilter, lessonFilter, query]) {
    control.addEventListener("input", updateSearchResults);
  }

  const tags = allTags();
  const tagList = document.querySelector("#tag-list");
  tagList.innerHTML = "";
  for (const tag of tags) {
    const button = el("button", { type: "button", "aria-pressed": "false" }, tag);
    button.addEventListener("click", () => {
      toggleTag(tag);
      updateSearchResults();
    });
    tagList.append(button);
  }

  const viewList = document.querySelector("#view-list");
  viewList.innerHTML = "";
  for (const view of state.catalog.searchViews || []) {
    const button = el("button", { type: "button", "aria-pressed": "false" }, view.label);
    button.addEventListener("click", () => {
      state.selectedTags = new Set(view.tags || []);
      syncTagButtons();
      updateSearchResults();
    });
    viewList.append(button);
  }

  document.querySelector("#clear-tags").addEventListener("click", () => {
    state.selectedTags.clear();
    syncTagButtons();
    updateSearchResults();
  });
}

function updateSearchResults() {
  const query = document.querySelector("#query").value.trim().toLowerCase();
  const courseId = document.querySelector("#course-filter").value;
  const termId = document.querySelector("#term-filter").value;
  const lessonNo = document.querySelector("#lesson-filter").value.trim();
  const list = document.querySelector("#search-results");

  syncTagButtons();
  const results = state.catalog.lessons
    .filter((lesson) => {
      if (!termId) return true;
      if (termId === "latest") return lesson.isLatestForCourseLesson;
      return lesson.termId === termId;
    })
    .filter((lesson) => !courseId || lesson.courseId === courseId)
    .filter((lesson) => !lessonNo || lesson.lessonNo === normalizeLessonNo(lessonNo))
    .filter((lesson) => selectedTagsMatch(lesson))
    .filter((lesson) => textMatches(lesson, query))
    .sort(compareLessonVersion);

  list.innerHTML = "";
  document.querySelector("#result-count").textContent = `${results.length} 件`;
  for (const lesson of results) {
    list.append(lessonCard(lesson, { showCourse: true }));
  }
  if (!results.length) {
    list.append(notice("条件に一致する資料はありません。"));
  }
}

function lessonCard(lesson, options = {}) {
  const course = findCourse(lesson.courseId);
  const term = findTerm(lesson.termId);
  const href = lessonHref(lesson);
  const title = options.showCourse ? `${course.title} / 第${lesson.lessonNo}回 ${lesson.title}` : `第${lesson.lessonNo}回 ${lesson.title}`;
  return el("article", { className: "lesson-item" }, [
    el("div", { className: "lesson-item-header" }, [
      el("div", {}, [
        el("h3", {}, title),
        el("p", {}, lesson.description || ""),
        el("div", { className: "meta-row" }, [
          pill(term.label),
          pill(`最終更新 ${formatDate(lesson.lastUpdated)}`),
          lesson.isLatestForCourseLesson ? pill("最新版") : pill("過去開講期")
        ])
      ]),
      el("div", { className: "actions" }, [
        el("a", { className: "button primary", href }, "授業ページ"),
        lesson.files[0] ? el("a", { className: "button secondary", href: lesson.files[0].path }, "資料を開く") : ""
      ])
    ]),
    tagRow([...course.tags, ...lesson.tags])
  ]);
}

function fileItem(file) {
  return el("article", { className: "file-item" }, [
    el("div", {}, [
      el("strong", {}, file.name),
      el("div", { className: "muted" }, formatBytes(file.size))
    ]),
    el("a", { className: "button primary", href: file.path }, "開く")
  ]);
}

function renderTermTabs(terms, onSelect) {
  const tabs = document.querySelector("#term-tabs");
  tabs.innerHTML = "";
  for (const term of terms) {
    const pressed = term.id === state.selectedTermId;
    const button = el("button", { type: "button", "aria-pressed": String(pressed) }, term.label);
    button.addEventListener("click", () => {
      for (const item of tabs.querySelectorAll("button")) item.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-pressed", "true");
      onSelect(term.id);
    });
    tabs.append(button);
  }
}

function selectedTagsMatch(lesson) {
  if (!state.selectedTags.size) return true;
  const course = findCourse(lesson.courseId);
  const tags = new Set([...(course.tags || []), ...(lesson.tags || [])]);
  return [...state.selectedTags].every((tag) => tags.has(tag));
}

function textMatches(lesson, query) {
  if (!query) return true;
  const course = findCourse(lesson.courseId);
  return [course.title, course.description, lesson.title, lesson.description, lesson.lessonNo, ...(course.tags || []), ...(lesson.tags || [])]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function toggleTag(tag) {
  if (state.selectedTags.has(tag)) state.selectedTags.delete(tag);
  else state.selectedTags.add(tag);
}

function syncTagButtons() {
  document.querySelectorAll("#tag-list button").forEach((button) => {
    button.setAttribute("aria-pressed", String(state.selectedTags.has(button.textContent)));
  });
  document.querySelectorAll("#view-list button").forEach((button) => {
    const view = (state.catalog.searchViews || []).find((item) => item.label === button.textContent);
    const selected = view && sameTags(new Set(view.tags || []), state.selectedTags);
    button.setAttribute("aria-pressed", String(Boolean(selected)));
  });
}

function allTags() {
  const tags = new Set();
  for (const course of state.catalog.courses) for (const tag of course.tags || []) tags.add(tag);
  for (const lesson of state.catalog.lessons) for (const tag of lesson.tags || []) tags.add(tag);
  return [...tags].sort((a, b) => a.localeCompare(b, "ja"));
}

function termsForLessons(lessons) {
  const termIds = new Set(lessons.map((lesson) => lesson.termId));
  return state.catalog.terms.filter((term) => termIds.has(term.id)).sort(compareTermDesc);
}

function lessonsForCourse(courseId) {
  return state.catalog.lessons.filter((lesson) => lesson.courseId === courseId);
}

function findCourse(id) {
  return state.catalog.courses.find((course) => course.id === id);
}

function findTerm(id) {
  return state.catalog.terms.find((term) => term.id === id);
}

function findLesson(termId, courseId, lessonNo) {
  return state.catalog.lessons.find((lesson) =>
    lesson.termId === termId &&
    lesson.courseId === courseId &&
    lesson.lessonNo === normalizeLessonNo(lessonNo)
  );
}

function compareTermDesc(a, b) {
  return b.startsAt.localeCompare(a.startsAt);
}

function compareLessonNo(a, b) {
  return a.lessonNo.localeCompare(b.lessonNo, "ja", { numeric: true });
}

function compareLessonVersion(a, b) {
  const termOrder = findTerm(b.termId).startsAt.localeCompare(findTerm(a.termId).startsAt);
  if (termOrder !== 0) return termOrder;
  return compareLessonNo(a, b);
}

function lessonHref(lesson) {
  return `./lesson.html?term=${encodeURIComponent(lesson.termId)}&course=${encodeURIComponent(lesson.courseId)}&lesson=${encodeURIComponent(lesson.lessonNo)}`;
}

function normalizeLessonNo(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  return /^\d+$/.test(trimmed) ? trimmed.padStart(2, "0") : trimmed;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function fillSelect(select, options) {
  select.innerHTML = "";
  for (const [value, label] of options) {
    select.append(el("option", { value }, label));
  }
}

function tagRow(tags = []) {
  return el("div", { className: "tag-row" }, [...new Set(tags)].map((tag) => el("span", { className: "tag" }, tag)));
}

function pill(text) {
  return el("span", { className: "pill" }, text);
}

function notice(text) {
  return el("div", { className: "notice" }, text);
}

function renderError(target, message) {
  target.innerHTML = "";
  target.append(el("div", { className: "notice error" }, message));
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "className") node.className = value;
    else node.setAttribute(key, value);
  }
  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    if (child === null || child === undefined || child === "") continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function sameTags(a, b) {
  if (a.size !== b.size) return false;
  return [...a].every((tag) => b.has(tag));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}
