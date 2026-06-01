(function () {
  const STORAGE_KEY = "sefb_planner_v3";
  const OLD_STORAGE_KEY = "sefb_planner_v2";
  const MIN_CR = 12;
  const MAX_CR = 20;
  const DEANS_LIST = 3.67;
  const FAIL_GRADES = new Set(["C-", "D+", "D", "F"]);
  const PATHWAY_COURSES = {
    L1: new Set(["MPB1013", "MPB2013", "MPB3013"]),
    L2: new Set(["MPB2013", "MPB3013"]),
    L3: new Set(["MPB3013", "SBLEK3023", "SBLEK3033", "SBLEK3043", "SBLEK3053"]),
    EX: new Set([])
  };
  const LANG_FAMILY_DIGIT = { MAN: "5", ARA: "2", JPN: "3", FRA: "4", KOR: "6" };
  const PROGRAMS = window.SEFB.PROGRAMS;
  const GRADES = window.SEFB.GRADES;
  const $ = (id) => document.getElementById(id);

  const defaultState = () => ({
    programId: "BFIN",
    trackId: "INV",
    pathId: "L2",
    langId: "MAN",
    theme: "architectural",
    plan: {},
    extraSems: 0,
    lastSaved: null
  });

  let state = loadState();

  function currentProgram() {
    return PROGRAMS[state.programId] || PROGRAMS.BFIN;
  }

  function totalSems() {
    return currentProgram().semCount + (state.extraSems || 0);
  }

  function emptyPlan() {
    const plan = {};
    for (let i = 1; i <= totalSems(); i++) plan[i] = [];
    return plan;
  }

  function normalizeState() {
    const p = currentProgram();
    if (!state.plan || typeof state.plan !== "object") state.plan = {};
    if (!state.pathId) state.pathId = "L2";
    if (!state.langId) state.langId = "MAN";
    if (p.tracks && p.tracks.length && !state.trackId) state.trackId = p.tracks[0].id;
    if (!p.tracks || !p.tracks.length) state.trackId = "";
    for (let i = 1; i <= totalSems(); i++) {
      if (!Array.isArray(state.plan[i])) state.plan[i] = [];
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (err) {}
    return defaultState();
  }

  function saveState() {
    normalizeState();
    state.lastSaved = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderSaveStatus();
  }

  function relativeTime(ts) {
    if (!ts) return "not saved yet";
    const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  }

  function getCourse(code) {
    return currentProgram().courses.find((course) => course.code === code);
  }

  function courseCredits(item) {
    const c = getCourse(item.code);
    return c ? c.cr : 0;
  }

  function plannedItems() {
    const out = [];
    for (let s = 1; s <= totalSems(); s++) {
      (state.plan[s] || []).forEach((item, index) => out.push({ ...item, sem: s, index }));
    }
    return out;
  }

  function plannedCredits() {
    return plannedItems().reduce((sum, item) => sum + courseCredits(item), 0);
  }

  function creditsBefore(sem) {
    return plannedItems().filter((item) => item.sem < sem).reduce((sum, item) => sum + courseCredits(item), 0);
  }

  function gp(grade) {
    const row = GRADES.find((g) => g.g === grade);
    return row ? row.p : null;
  }

  function computeGPA() {
    let cumPoints = 0;
    let cumCredits = 0;
    const per = [];
    for (let sem = 1; sem <= totalSems(); sem++) {
      let points = 0;
      let credits = 0;
      (state.plan[sem] || []).forEach((item) => {
        const c = getCourse(item.code);
        const p = gp(item.grade);
        if (!c || p === null) return;
        points += p * c.cr;
        credits += c.cr;
      });
      cumPoints += points;
      cumCredits += credits;
      per.push({ sem, credits, gpa: credits ? points / credits : null, cgpa: cumCredits ? cumPoints / cumCredits : null });
    }
    return { per, cgpa: cumCredits ? cumPoints / cumCredits : 0, gradedCredits: cumCredits };
  }

  function prereqStatus(code, sem) {
    const c = getCourse(code);
    if (!c) return { ok: true, missing: [] };
    const missing = [];
    const pathwayAllowed = PATHWAY_COURSES[state.pathId] || new Set();
    (c.pre || []).forEach((pre) => {
      const preCourse = getCourse(pre);
      if (preCourse && preCourse.cat === "B" && preCourse.pathway && !pathwayAllowed.has(pre)) return;
      let found = null;
      for (let s = 1; s < sem; s++) {
        found = (state.plan[s] || []).find((item) => item.code === pre);
        if (found) break;
      }
      if (!found) missing.push(pre);
      if (found && found.grade && FAIL_GRADES.has(found.grade)) missing.push(`${pre} failed`);
    });
    if (c.minCr && creditsBefore(sem) < c.minCr) missing.push(`${c.minCr}cr minimum`);
    if (c.all && creditsBefore(sem) < currentProgram().total - c.cr) missing.push("finish other courses first");
    if (c.offer === "odd" && sem % 2 === 0) missing.push("odd semesters only");
    if (c.offer === "even" && sem % 2 === 1) missing.push("even semesters only");
    return { ok: missing.length === 0, missing };
  }

  function componentProgress() {
    const p = currentProgram();
    const byCat = {};
    p.components.forEach((comp) => {
      byCat[comp.l] = { ...comp, done: 0 };
    });
    plannedItems().forEach((item) => {
      const c = getCourse(item.code);
      if (c && byCat[c.cat]) byCat[c.cat].done += c.cr;
    });
    return byCat;
  }

  function availableCourses(sem) {
    const placement = placementMap();
    const committedTrack = committedTrackId();
    const committedField = committedFieldId();
    return currentProgram().courses.filter((course) => {
      const placed = placement[course.code];
      if (placed && !(placed.grade && FAIL_GRADES.has(placed.grade))) return false;
      if (course.cat === "D" && course.lang && course.lang !== state.langId) return false;
      if (course.cat === "D" && course.track && committedTrack && course.track !== committedTrack) return false;
      if (course.cat === "F" && course.field && committedField && course.field !== committedField) return false;
      return true;
    }).map((course) => ({ ...course, status: prereqStatus(course.code, sem), placed: placement[course.code] || null }));
  }

  function addableCourseRows(sem) {
    const placement = placementMap();
    const committedTrack = committedTrackId();
    const committedField = committedFieldId();
    return currentProgram().courses.filter((course) => {
      return !(course.cat === "D" && course.lang && course.lang !== state.langId);
    }).map((course) => {
      const placed = placement[course.code] || null;
      const failedPlaced = placed && placed.grade && FAIL_GRADES.has(placed.grade);
      let disabled = false;
      let lockReason = "";
      if (course.cat === "D" && course.track && committedTrack && course.track !== committedTrack) {
        disabled = true;
        lockReason = "other field locked";
      }
      if (course.cat === "F" && course.field && committedField && course.field !== committedField) {
        disabled = true;
        lockReason = "other field locked";
      }
      if (placed && !failedPlaced) {
        disabled = true;
        lockReason = `taken in Sem ${placed.sem}`;
      }
      const status = prereqStatus(course.code, sem);
      return { ...course, placed, failedPlaced, status, disabled, lockReason };
    });
  }

  function placementMap() {
    const out = {};
    plannedItems().forEach((item) => {
      out[item.code] = { sem: item.sem, grade: item.grade || "" };
    });
    return out;
  }

  function committedTrackId() {
    for (const item of plannedItems()) {
      const course = getCourse(item.code);
      if (course && course.cat === "D" && course.track) return course.track;
    }
    return null;
  }

  function committedFieldId() {
    for (const item of plannedItems()) {
      const course = getCourse(item.code);
      if (course && course.cat === "F" && course.field) return course.field;
    }
    return null;
  }

  function substituteLangCourses(fromLang, toLang) {
    if (!fromLang || !toLang || fromLang === toLang) return;
    const p = currentProgram();
    if (fromLang === "OTH") {
      const toD = LANG_FAMILY_DIGIT[toLang];
      if (!toD) return;
      const re = /^FOREIGN([123])013$/;
      Object.keys(state.plan).forEach((sem) => {
        state.plan[sem] = (state.plan[sem] || []).map((item) => {
          const match = item.code.match(re);
          if (!match) return item;
          const newCode = `SBLFK${match[1]}0${toD}3`;
          return p.courses.find((course) => course.code === newCode) ? { ...item, code: newCode } : item;
        });
      });
      return;
    }
    if (toLang === "OTH") {
      const fromD = LANG_FAMILY_DIGIT[fromLang];
      if (!fromD) return;
      const re = new RegExp(`^SBLFK([123])0${fromD}3$`);
      Object.keys(state.plan).forEach((sem) => {
        state.plan[sem] = (state.plan[sem] || []).map((item) => {
          const match = item.code.match(re);
          if (!match) return item;
          const newCode = `FOREIGN${match[1]}013`;
          return p.courses.find((course) => course.code === newCode) ? { ...item, code: newCode } : item;
        });
      });
      return;
    }
    const fromD = LANG_FAMILY_DIGIT[fromLang];
    const toD = LANG_FAMILY_DIGIT[toLang];
    if (!fromD || !toD) return;
    const re = new RegExp(`^SBLFK([123])0${fromD}3$`);
    Object.keys(state.plan).forEach((sem) => {
      state.plan[sem] = (state.plan[sem] || []).map((item) => {
        const match = item.code.match(re);
        if (!match) return item;
        const newCode = `SBLFK${match[1]}0${toD}3`;
        return p.courses.find((course) => course.code === newCode) ? { ...item, code: newCode } : item;
      });
    });
  }

  function programOptions() {
    return Object.values(PROGRAMS).map((p) => `<option value="${p.id}" ${p.id === state.programId ? "selected" : ""}>${p.short}</option>`).join("");
  }

  function renderChrome(active) {
    const nav = [
      ["index.html", "Overview"],
      ["planner.html", "Planner"],
      ["audit.html", "Audit"],
      ["analytics.html", "Analytics"],
      ["courses.html", "Courses"],
      ["profile.html", "Profile"],
      ["help.html", "Help"]
    ];
    document.querySelectorAll("[data-nav]").forEach((node) => {
      node.innerHTML = nav.map(([href, label]) => `<a class="${active === href ? "active" : ""}" href="${href}">${label}</a>`).join("");
    });
    document.querySelectorAll("[data-program-select]").forEach((select) => {
      select.innerHTML = programOptions();
      select.value = state.programId;
      select.onchange = () => {
        state.programId = select.value;
        const p = currentProgram();
        state.trackId = p.tracks && p.tracks.length ? p.tracks[0].id : "";
        state.extraSems = 0;
        state.plan = emptyPlan();
        saveState();
        location.reload();
      };
    });
    renderTrackControl();
    renderPathControl();
    renderLangControl();
    renderSaveStatus();
  }

  function renderSaveStatus() {
    document.querySelectorAll(".side").forEach((side) => {
      let card = side.querySelector("[data-save-status]");
      if (!card) {
        card = document.createElement("div");
        card.className = "save-card";
        card.setAttribute("data-save-status", "");
        side.appendChild(card);
      }
      card.innerHTML = `<div class="eyebrow">Private browser save</div>
        <strong>${relativeTime(state.lastSaved)}</strong>
        <p>Saved on this device. Export a backup from Profile.</p>`;
    });
  }

  function renderTrackControl() {
    const holder = $("trackControl");
    if (!holder) return;
    const p = currentProgram();
    if (!p.tracks || !p.tracks.length) {
      holder.innerHTML = "";
      return;
    }
    holder.innerHTML = `<select class="select" id="trackSelect">${p.tracks.map((t) => `<option value="${t.id}" ${t.id === state.trackId ? "selected" : ""}>${t.en}</option>`).join("")}</select>`;
    $("trackSelect").onchange = (event) => {
      state.trackId = event.target.value;
      saveState();
      location.reload();
    };
  }

  function renderPathControl() {
    const holder = $("pathControl");
    if (!holder) return;
    const p = currentProgram();
    if (!p.courses.some((course) => course.cat === "B" && course.pathway)) {
      holder.innerHTML = "";
      return;
    }
    const labels = {
      L1: "English Path 1",
      L2: "English Path 2",
      L3: "English Path 3",
      EX: "English Exempted"
    };
    holder.innerHTML = `<select class="select" id="pathSelect">${Object.entries(labels).map(([id, label]) => `<option value="${id}" ${state.pathId === id ? "selected" : ""}>${label}</option>`).join("")}</select>`;
    $("pathSelect").onchange = (event) => {
      state.pathId = event.target.value;
      saveState();
      location.reload();
    };
  }

  function renderLangControl() {
    const holder = $("langControl");
    if (!holder) return;
    const p = currentProgram();
    if (!p.courses.some((course) => course.lang)) {
      holder.innerHTML = "";
      return;
    }
    const labels = {
      MAN: "Mandarin",
      ARA: "Arabic",
      JPN: "Japanese",
      FRA: "French",
      KOR: "Korean",
      OTH: "Other language"
    };
    holder.innerHTML = `<select class="select" id="langSelect">${Object.entries(labels).map(([id, label]) => `<option value="${id}" ${state.langId === id ? "selected" : ""}>${label}</option>`).join("")}</select>`;
    $("langSelect").onchange = (event) => {
      substituteLangCourses(state.langId, event.target.value);
      state.langId = event.target.value;
      saveState();
      location.reload();
    };
  }

  function renderOverview() {
    const p = currentProgram();
    const g = computeGPA();
    const total = plannedCredits();
    const heroProgram = $("heroProgram");
    if (heroProgram) heroProgram.textContent = p.nameEn || p.short;
    $("heroMeta").textContent = `${p.total} credits / ${p.semCount} semesters / ${p.courses.length} course entries`;
    $("statCredits").textContent = `${total}/${p.total}`;
    $("statCgpa").textContent = g.cgpa ? g.cgpa.toFixed(2) : "--";
    $("statCourses").textContent = plannedItems().length;
    $("statStatus").textContent = total >= p.total && g.cgpa >= 2 ? "Ready" : "In progress";
    renderComponents("componentGrid");
    renderSemesterBars("semesterBars");
  }

  function renderComponents(id) {
    const holder = $(id);
    if (!holder) return;
    holder.innerHTML = Object.values(componentProgress()).map((comp) => {
      const pct = Math.min(100, Math.round((comp.done / comp.req) * 100));
      return `<div class="panel">
        <div class="eyebrow">${comp.l}. ${comp.ms}</div>
        <h3>${comp.en}</h3>
        <div class="muted">${comp.done}/${comp.req} credits</div>
        <div class="progress"><span style="--w:${pct}%"></span></div>
      </div>`;
    }).join("");
  }

  function renderSemesterBars(id) {
    const holder = $(id);
    if (!holder) return;
    holder.innerHTML = "";
    for (let s = 1; s <= totalSems(); s++) {
      const credits = (state.plan[s] || []).reduce((sum, item) => sum + courseCredits(item), 0);
      const pct = Math.min(100, Math.round((credits / MAX_CR) * 100));
      holder.innerHTML += `<div class="bar-row"><span>Sem ${s}</span><div class="bar"><span style="--w:${pct}%"></span></div><span>${credits} cr</span></div>`;
    }
  }

  function renderPlanner() {
    $("plannerTitle").textContent = currentProgram().nameEn || currentProgram().short;
    const p = currentProgram();
    const committedTrack = committedTrackId();
    const committedField = committedFieldId();
    const notices = [];
    if (committedTrack && p.tracks) {
      const dComponent = p.components.find((component) => component.l === "D");
      notices.push(`${dComponent?.en || "Specialization"} committed: ${p.tracks.find((track) => track.id === committedTrack)?.en || committedTrack}`);
    }
    if (committedField && p.fFields) notices.push(`Field elective committed: ${p.fFields.find((field) => field.id === committedField)?.en || committedField}`);
    const legendHolder = $("plannerLegend");
    if (legendHolder) {
      const categoryLegend = p.components.map((component) => `
        <span class="legend-chip cat-${component.l}">
          <strong>Category ${component.l}</strong>
          <span>${component.en}</span>
        </span>
      `).join("");
      const commitment = notices.length ? `<div class="commitment-note">${notices.map((msg) => `${msg} / other groups locked`).join(" · ")}</div>` : "";
      legendHolder.innerHTML = `<div class="legend-chips">${categoryLegend}</div>${commitment}`;
    }
    const holder = $("semesters");
    holder.innerHTML = "";
    for (let sem = 1; sem <= totalSems(); sem++) {
      const credits = (state.plan[sem] || []).reduce((sum, item) => sum + courseCredits(item), 0);
      const courses = (state.plan[sem] || []).map((item, index) => {
        const c = getCourse(item.code);
        if (!c) return "";
        const status = prereqStatus(c.code, sem);
        return `<article class="course cat-${c.cat}">
          <div class="course-title">${c.code} / ${c.en}</div>
          <div class="muted">${c.ms || ""}</div>
          <div class="course-meta">
            <span class="pill">${c.cr} credits</span><span class="pill cat-pill cat-${c.cat}">Cat ${c.cat}</span>
            <span class="pill ${status.ok ? "ok" : "bad"}">${status.ok ? "Ready" : status.missing.join(", ")}</span>
          </div>
          <div class="inline-actions">
            <select class="select" data-grade="${sem}:${index}">
              <option value="">Grade</option>
              ${GRADES.map((g) => `<option value="${g.g}" ${item.grade === g.g ? "selected" : ""}>${g.g}</option>`).join("")}
            </select>
            <select class="select compact-select" data-move-target="${sem}:${index}">
              ${Array.from({ length: totalSems() }, (_, i) => i + 1).map((target) => `<option value="${target}" ${target === sem ? "selected" : ""}>Move to Sem ${target}</option>`).join("")}
            </select>
            <button class="mini-button" data-move="${sem}:${index}">Move</button>
            <button class="mini-button" data-remove="${sem}:${index}">Remove</button>
          </div>
        </article>`;
      }).join("");
      holder.innerHTML += `<section class="semester">
        <div class="semester-head"><strong>Semester ${sem}</strong><span>${credits} credits</span></div>
        <div class="semester-body">
          ${courses || `<div class="empty-state"><strong>No courses planned.</strong><span>Use the grouped list below to add a subject.</span></div>`}
          <div class="dropdown-add">
            <select class="select add-select" data-add-select="${sem}">
              <option value="">+ Add course...</option>
              ${buildGroupedCourseOptions(sem)}
            </select>
            <button class="button solid" data-add-selected="${sem}">Add</button>
          </div>
        </div>
      </section>`;
    }
    bindPlannerActions();
  }

  function bindPlannerActions() {
    document.querySelectorAll("[data-add-selected]").forEach((button) => {
      button.onclick = () => {
        const sem = button.dataset.addSelected;
        const select = document.querySelector(`[data-add-select="${sem}"]`);
        if (!select || !select.value) return;
        state.plan[sem].push({ code: select.value, grade: "" });
        saveState();
        renderPlanner();
        toast("Course added");
      };
    });
    document.querySelectorAll("[data-remove]").forEach((button) => {
      button.onclick = () => {
        const [sem, index] = button.dataset.remove.split(":");
        state.plan[sem].splice(Number(index), 1);
        saveState();
        renderPlanner();
      };
    });
    document.querySelectorAll("[data-move]").forEach((button) => {
      button.onclick = () => {
        const [sem, index] = button.dataset.move.split(":").map(Number);
        const target = Number(document.querySelector(`[data-move-target="${sem}:${index}"]`).value);
        if (!target || target === sem) return;
        const [item] = state.plan[sem].splice(index, 1);
        state.plan[target] = state.plan[target] || [];
        state.plan[target].push(item);
        saveState();
        renderPlanner();
        toast(`Moved to Semester ${target}`);
      };
    });
    document.querySelectorAll("[data-grade]").forEach((select) => {
      select.onchange = () => {
        const [sem, index] = select.dataset.grade.split(":");
        state.plan[sem][Number(index)].grade = select.value;
        saveState();
        renderPlanner();
      };
    });
    const load = $("loadRecommended");
    if (load) load.onclick = loadRecommended;
    const reset = $("resetPlanner");
    if (reset) reset.onclick = resetCurrentPlan;
    const addSem = $("addSemester");
    if (addSem) addSem.onclick = () => {
      state.extraSems = (state.extraSems || 0) + 1;
      state.plan[totalSems()] = [];
      saveState();
      renderPlanner();
    };
  }

  function buildGroupedCourseOptions(sem) {
    const p = currentProgram();
    const byCat = {};
    addableCourseRows(sem).forEach((course) => {
      (byCat[course.cat] = byCat[course.cat] || []).push(course);
    });
    return p.components.map((component) => {
      const list = (byCat[component.l] || []).sort((a, b) => a.code.localeCompare(b.code));
      if (!list.length) return "";
      const options = [];
      options.push(`<option disabled>── ${component.l}. ${component.en.toUpperCase()} ──</option>`);
      list.forEach((course) => {
        const label = optionLabel(course);
        const disabled = course.disabled ? "disabled" : "";
        options.push(`<option value="${course.code}" ${disabled}>${label}</option>`);
      });
      return `<optgroup label="${component.l}. ${component.en}">${options.join("")}</optgroup>`;
    }).join("");
  }

  function optionLabel(course) {
    if (course.failedPlaced) return `Retake Sem ${course.placed.sem} / ${course.code} / ${course.en} (${course.cr}cr)`;
    if (course.placed) return `Sem ${course.placed.sem} / ${course.code} / ${course.en} (${course.cr}cr)`;
    if (course.disabled) return `Locked / ${course.code} / ${course.en} (${course.cr}cr) / ${course.lockReason}`;
    if (!course.status.ok) return `Locked / ${course.code} / ${course.en} (${course.cr}cr) / ${course.status.missing.join(", ")}`;
    return `${course.code} / ${course.en} (${course.cr}cr)`;
  }

  function loadRecommended() {
    const p = currentProgram();
    const rec = p.recommended && p.recommended[state.trackId || ""];
    if (!rec) {
      toast("No recommended plan for this selection");
      return;
    }
    confirmDialog("Replace your current plan with the official recommended plan?", () => {
      state.plan = emptyPlan();
      Object.entries(rec).forEach(([sem, codes]) => {
        state.plan[sem] = codes.map((code) => ({ code, grade: "" }));
      });
      if (state.langId && state.langId !== "MAN") substituteLangCourses("MAN", state.langId);
      saveState();
      renderPlanner();
      toast("Recommended plan loaded");
    });
  }

  function resetCurrentPlan() {
    confirmDialog("Reset your current plan? This cannot be undone.", () => {
      state.plan = emptyPlan();
      state.extraSems = 0;
      saveState();
      renderPlanner();
      toast("Plan reset");
    });
  }

  function renderAudit() {
    const p = currentProgram();
    const byCat = componentProgress();
    const total = plannedCredits();
    const g = computeGPA();
    const items = Object.values(byCat).map((comp) => ({ ok: comp.done >= comp.req, label: `${comp.l}. ${comp.en}`, value: `${comp.done}/${comp.req} cr` }));
    items.push({ ok: total >= p.total, label: "Total credits", value: `${total}/${p.total}` });
    items.push({ ok: g.cgpa >= 2, label: "Minimum CGPA 2.00", value: g.cgpa ? g.cgpa.toFixed(2) : "--" });
    $("auditSummary").innerHTML = `<h2>${items.every((item) => item.ok) ? "Eligible to graduate" : "Not yet eligible"}</h2><p class="muted">${items.filter((item) => !item.ok).length} requirement(s) remaining.</p>`;
    $("auditList").innerHTML = items.map((item) => `<div class="audit-item"><strong class="${item.ok ? "ok" : "bad"}">${item.ok ? "OK" : "NO"}</strong><span>${item.label}</span><span>${item.value}</span></div>`).join("");
    renderAlerts();
  }

  function renderAlerts() {
    const holder = $("alerts");
    if (!holder) return;
    const issues = [];
    const p = currentProgram();
    for (let sem = 1; sem <= totalSems(); sem++) {
      const credits = (state.plan[sem] || []).reduce((sum, item) => sum + courseCredits(item), 0);
      if (credits > 0 && credits < MIN_CR && !(p.shortSems || []).includes(sem)) issues.push(`Semester ${sem}: ${credits} credits is below ${MIN_CR}.`);
      if (credits > MAX_CR) issues.push(`Semester ${sem}: ${credits} credits is above ${MAX_CR}.`);
      (state.plan[sem] || []).forEach((item) => {
        const status = prereqStatus(item.code, sem);
        if (!status.ok) issues.push(`${item.code} in Semester ${sem}: ${status.missing.join(", ")}.`);
        if (item.grade && FAIL_GRADES.has(item.grade)) issues.push(`${item.code} has a failing grade and should be retaken.`);
      });
    }
    holder.innerHTML = issues.length ? issues.map((msg) => `<div class="audit-item"><strong class="warn">Note</strong><span>${msg}</span><span></span></div>`).join("") : `<p class="muted">No planning alerts right now.</p>`;
  }

  function renderAnalytics() {
    const g = computeGPA();
    $("analyticsCgpa").textContent = g.cgpa ? g.cgpa.toFixed(2) : "--";
    $("analyticsStanding").textContent = g.cgpa >= DEANS_LIST ? "Dean's List range" : g.cgpa >= 2 ? "Good standing" : "No graded credits";
    $("gpaRows").innerHTML = g.per.map((row) => `<div class="bar-row">
      <span>Sem ${row.sem}</span>
      <div class="bar"><span style="--w:${Math.round(((row.gpa || 0) / 4) * 100)}%"></span></div>
      <span>${row.gpa ? row.gpa.toFixed(2) : "--"}</span>
    </div>`).join("");
    renderSemesterBars("creditBars");
  }

  function renderCourses() {
    const input = $("courseSearch");
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const committedTrack = committedTrackId();
      const committedField = committedFieldId();
      const rows = currentProgram().courses.filter((c) => {
        const text = `${c.code} ${c.en} ${c.ms || ""} ${c.cat}`.toLowerCase();
        if (c.cat === "D" && c.lang && c.lang !== state.langId) return false;
        if (c.cat === "D" && c.track && state.trackId && c.track !== state.trackId) return false;
        if (c.cat === "D" && c.track && committedTrack && c.track !== committedTrack) return false;
        if (c.cat === "F" && c.field && committedField && c.field !== committedField) return false;
        return !q || text.includes(q);
      });
      $("courseRows").innerHTML = rows.map((c) => `<tr><td><strong>${c.code}</strong></td><td>${c.en}<br><span class="muted">${c.ms || ""}</span></td><td>${c.cat}</td><td>${c.cr}</td><td>${(c.pre || []).join(", ") || "None"}</td></tr>`).join("");
    };
    input.oninput = draw;
    draw();
  }

  function renderProfile() {
    const p = currentProgram();
    $("profileProgram").textContent = p.fullName;
    $("profileMeta").textContent = `${p.total} credits / ${p.semCount} standard semesters`;
    $("profileStored").textContent = localStorage.getItem(STORAGE_KEY) ? "Saved in this browser" : "No saved v3 plan yet";
    $("resetPlan").onclick = () => {
      confirmDialog("Reset your current plan? This cannot be undone.", () => {
        state.plan = emptyPlan();
        state.extraSems = 0;
        saveState();
        toast("Plan reset");
        renderProfile();
      });
    };
    $("exportJson").onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sefb-plan.json";
      a.click();
      URL.revokeObjectURL(url);
    };
    $("importJson").onchange = importJson;
  }

  function importJson(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported || !PROGRAMS[imported.programId] || !imported.plan || typeof imported.plan !== "object") {
          throw new Error("Invalid SEFB plan file");
        }
        state = Object.assign(defaultState(), imported);
        normalizeState();
        saveState();
        toast("Plan imported");
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        toast("Import failed: invalid plan file");
      }
    };
    reader.readAsText(file);
  }

  function toast(message) {
    let node = $("toast");
    if (!node) {
      node = document.createElement("div");
      node.id = "toast";
      node.className = "toast";
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add("show");
    setTimeout(() => node.classList.remove("show"), 1800);
  }

  function confirmDialog(message, onOk) {
    let modal = $("confirmModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "confirmModal";
      modal.className = "confirm-modal";
      document.body.appendChild(modal);
    }
    modal.innerHTML = `<div class="confirm-card">
      <div class="confirm-icon">!</div>
      <p>${message}</p>
      <div class="confirm-actions">
        <button class="button" data-confirm-cancel>Cancel</button>
        <button class="button solid" data-confirm-ok>OK</button>
      </div>
    </div>`;
    modal.classList.add("show");
    modal.querySelector("[data-confirm-cancel]").onclick = () => modal.classList.remove("show");
    modal.querySelector("[data-confirm-ok]").onclick = () => {
      modal.classList.remove("show");
      onOk();
    };
  }

  function boot() {
    normalizeState();
    if (!state.lastSaved) saveState();
    const page = document.body.dataset.page;
    renderChrome(`${page}.html`);
    if (page === "index") renderChrome("index.html");
    if (page === "index") renderOverview();
    if (page === "planner") renderPlanner();
    if (page === "audit") renderAudit();
    if (page === "analytics") renderAnalytics();
    if (page === "courses") renderCourses();
    if (page === "profile") renderProfile();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
