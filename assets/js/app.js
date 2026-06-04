(function () {
  const STORAGE_KEY = "sefb_planner_v3";
  const OLD_STORAGE_KEY = "sefb_planner_v2";
  const MIN_CR = 12;
  const MAX_CR = 20;
  const DEANS_LIST = 3.67;
  const FAIL_GRADES = new Set(["C-", "D+", "D", "F"]);
  const LOCK_ICON = "&#128274;";
  const SESSION_OPTIONS = ["A241", "A242", "A251", "A252", "A261", "A262", "A271", "A272", "A281", "A282"];
  const PATHWAY_COURSES = {
    L1: new Set(["MPB1013", "MPB2013", "MPB3013"]),
    L2: new Set(["MPB2013", "MPB3013"]),
    L3: new Set(["MPB3013", "SBLEK3023", "SBLEK3033", "SBLEK3043", "SBLEK3053"]),
    EX: new Set([])
  };
  const LANG_FAMILY_DIGIT = { MAN: "5", ARA: "2", JPN: "3", FRA: "4", KOR: "6" };
  const FIELD_RECOMMENDED_SLOTS = {
    BECONS: {
      BM: {
        3: ["BWBBK1013", "BWBBK2013"],
        4: ["BWBBK3013"],
        5: ["BWBBK3023"],
        6: ["BWBBK3043", "BWBBK3063"]
      },
      FIN: {
        3: ["BWFFK2033"],
        4: ["BWFFK2043"],
        5: ["BWFFK2053", "BWFFK3013"],
        6: ["BWFFK3033", "BWFFK3073"]
      },
      HRM: {
        3: ["BPMHK2013"],
        4: ["BPMHK3023", "BPMHK3033"],
        5: ["BPMHK3053"],
        6: ["BPMHK3063", "BPMHK3083"]
      },
      MKT: {
        3: ["BPMMK1013"],
        4: ["BPMMK2023", "BPMMK3023"],
        5: ["BPMMK3083"],
        6: ["BPMMK3313", "BPMMK3333"]
      },
      MUA: {
        3: ["BIMEK1013", "BIMCK2033"],
        4: ["BIMCK2083"],
        5: ["BIMCK1043"],
        6: ["BIMCK3063", "BIMEK3023"]
      },
      PM: {
        3: ["GMGAK2013", "GMGAK2023"],
        4: ["GMGAK2033"],
        5: ["GMGAK2053"],
        6: ["GMGFK2023", "GMGMK3023"]
      }
    }
  };
  const PROGRAMS = window.SEFB.PROGRAMS;
  const GRADES = window.SEFB.GRADES;
  const $ = (id) => document.getElementById(id);

  const defaultState = () => ({
    programId: "BFIN",
    trackId: "INV",
    fieldId: "",
    pathId: "L2",
    langMode: "MAN",
    langId: "MAN",
    theme: "architectural",
    plan: {},
    sessions: {},
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
    if (!state.sessions || typeof state.sessions !== "object") state.sessions = {};
    if (!state.pathId) state.pathId = "L2";
    if (!state.langMode) state.langMode = state.langId && state.langId !== "MAN" ? "OTH" : "MAN";
    if (state.langMode !== "OTH") state.langMode = "MAN";
    if (!state.langId) state.langId = "MAN";
    if (state.langMode === "OTH" && !["ARA", "JPN", "FRA", "KOR", "OTH"].includes(state.langId)) state.langId = "ARA";
    if (state.langMode === "MAN") state.langId = "MAN";
    if (p.tracks && p.tracks.length && !state.trackId) state.trackId = p.tracks[0].id;
    if (!p.tracks || !p.tracks.length) state.trackId = "";
    if (p.fFields && p.fFields.length && !state.fieldId) state.fieldId = p.fFields[0].id;
    if (!p.fFields || !p.fFields.length) state.fieldId = "";
    for (let i = 1; i <= totalSems(); i++) {
      if (!Array.isArray(state.plan[i])) state.plan[i] = [];
      if (!state.sessions[i] || !SESSION_OPTIONS.includes(state.sessions[i])) {
        state.sessions[i] = SESSION_OPTIONS[Math.min(i - 1, SESSION_OPTIONS.length - 1)];
      }
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

  function hasPassingGrade(item) {
    return item.grade && !FAIL_GRADES.has(item.grade);
  }

  function completedCredits() {
    return plannedItems().filter(hasPassingGrade).reduce((sum, item) => sum + courseCredits(item), 0);
  }

  function creditsBefore(sem, options = {}) {
    return plannedItems()
      .filter((item) => item.sem < sem)
      .filter((item) => !options.passedOnly || hasPassingGrade(item))
      .reduce((sum, item) => sum + courseCredits(item), 0);
  }

  function gp(grade) {
    const row = GRADES.find((g) => g.g === grade);
    return row ? row.p : null;
  }

  function classifyCgpa(value) {
    if (!value || value < 2) {
      return { label: "Fail", note: "", tone: "fail" };
    }
    if (value >= 3.67) {
      return { label: "First Class Honours", note: "", tone: "first" };
    }
    if (value >= 3) {
      return { label: "Second Class Upper", note: "", tone: "upper" };
    }
    return { label: "Second Class Lower", note: "", tone: "lower" };
  }

  function computeGPA() {
    let cumPoints = 0;
    let cumCredits = 0;
    let plannedCourses = 0;
    let gradedCourses = 0;
    const per = [];
    for (let sem = 1; sem <= totalSems(); sem++) {
      let points = 0;
      let credits = 0;
      const semItems = state.plan[sem] || [];
      let semGradedCourses = 0;
      semItems.forEach((item) => {
        const c = getCourse(item.code);
        const p = gp(item.grade);
        if (!c || p === null) return;
        semGradedCourses += 1;
        gradedCourses += 1;
        points += p * c.cr;
        credits += c.cr;
      });
      plannedCourses += semItems.length;
      cumPoints += points;
      cumCredits += credits;
      per.push({
        sem,
        credits,
        plannedCourses: semItems.length,
        gradedCourses: semGradedCourses,
        allGraded: semItems.length > 0 && semGradedCourses === semItems.length,
        gpa: credits ? points / credits : null,
        cgpa: cumCredits ? cumPoints / cumCredits : null
      });
    }
    return {
      per,
      cgpa: cumCredits ? cumPoints / cumCredits : 0,
      gradedCredits: cumCredits,
      plannedCourses,
      gradedCourses,
      allPlannedGraded: plannedCourses > 0 && gradedCourses === plannedCourses
    };
  }

  function semesterGpa(sem) {
    const semItems = state.plan[sem] || [];
    let points = 0;
    let credits = 0;
    let gradedCourses = 0;
    semItems.forEach((item) => {
      const cr = courseCredits(item);
      const p = gp(item.grade);
      if (!cr || p === null) return;
      gradedCourses += 1;
      points += p * cr;
      credits += cr;
    });
    return {
      plannedCourses: semItems.length,
      gradedCourses,
      credits,
      allGraded: semItems.length > 0 && gradedCourses === semItems.length,
      gpa: credits ? points / credits : null
    };
  }

  function prereqStatus(code, sem, options = {}) {
    const c = getCourse(code);
    if (!c) return { ok: true, missing: [] };
    const missing = [];
    const requireGrades = Boolean(options.requireGrades);
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
      if (found && requireGrades && !found.grade) missing.push(`${pre} grade missing`);
    });
    const priorCredits = creditsBefore(sem, { passedOnly: requireGrades });
    if (c.minCr && priorCredits < c.minCr) missing.push(`${c.minCr}cr minimum`);
    if (c.all && priorCredits < currentProgram().total - c.cr) missing.push("finish other courses first");
    if (c.offer === "odd" && sem % 2 === 0) missing.push("odd semesters only");
    if (c.offer === "even" && sem % 2 === 1) missing.push("even semesters only");
    return { ok: missing.length === 0, missing };
  }

  function componentProgress(options = {}) {
    const p = currentProgram();
    const byCat = {};
    p.components.forEach((comp) => {
      byCat[comp.l] = { ...comp, done: 0 };
    });
    const items = options.completedOnly ? plannedItems().filter(hasPassingGrade) : plannedItems();
    items.forEach((item) => {
      const c = getCourse(item.code);
      if (c && byCat[c.cat]) byCat[c.cat].done += c.cr;
    });
    return byCat;
  }

  function availableCourses(sem) {
    const placement = placementMap();
    const committedTrack = committedTrackId();
    const committedField = committedFieldId() || state.fieldId;
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
    const committedField = committedFieldId() || state.fieldId;
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
    const label = (p) => `${p.nameEn || p.short} (${p.short.replace(/[()]/g, "")})`;
    return Object.values(PROGRAMS).map((p) => `<option value="${p.id}" ${p.id === state.programId ? "selected" : ""}>${label(p)}</option>`).join("");
  }

  function renderChrome(active) {
    const nav = [
      ["index.html", "Overview"],
      ["planner.html", "Planner"],
      ["audit.html", "Graduation Checklist"],
      ["analytics.html", "CGPA Simulation"],
      ["courses.html", "Course List"],
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
        <p>Saved on this device.</p>`;
    });
  }

  function renderTrackControl() {
    const holder = $("trackControl");
    if (!holder) return;
    const p = currentProgram();
    if (!p.tracks || !p.tracks.length) {
      if (!p.fFields || !p.fFields.length) {
        holder.innerHTML = "";
        return;
      }
      holder.innerHTML = `<select class="select" id="fieldSelect" aria-label="Economics field elective">${p.fFields.map((f) => `<option value="${f.id}" ${f.id === state.fieldId ? "selected" : ""}>Field Elective - ${f.en}</option>`).join("")}</select>`;
      $("fieldSelect").onchange = (event) => {
        state.fieldId = event.target.value;
        saveState();
        location.reload();
      };
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
      L1: "Path 1 · 9 cr (MUET 1.0-2.5)",
      L2: "Path 2 · 6 cr (MUET 3.0-3.5)",
      L3: "Path 3 · 6 cr (MUET 4.0-4.5)",
      EX: "Exempted (MUET 5.0+)"
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
    const familyLabels = {
      ARA: "Arabic",
      JPN: "Japanese",
      FRA: "French",
      KOR: "Korean",
      OTH: "Other Foreign Language"
    };
    holder.innerHTML = `<select class="select" id="langModeSelect" aria-label="Foreign language">
      <option value="MAN" ${state.langMode === "MAN" ? "selected" : ""}>Mandarin</option>
      <option value="OTH" ${state.langMode === "OTH" ? "selected" : ""}>Other language...</option>
    </select>${state.langMode === "OTH" ? `<select class="select" id="langFamilySelect" aria-label="Language family">${Object.entries(familyLabels).map(([id, label]) => `<option value="${id}" ${state.langId === id ? "selected" : ""}>${label}</option>`).join("")}</select>` : ""}`;
    $("langModeSelect").onchange = (event) => {
      const nextMode = event.target.value;
      const nextLang = nextMode === "OTH" ? (state.langId && state.langId !== "MAN" ? state.langId : "ARA") : "MAN";
      substituteLangCourses(state.langId, nextLang);
      state.langMode = nextMode;
      state.langId = nextLang;
      saveState();
      location.reload();
    };
    const familySelect = $("langFamilySelect");
    if (familySelect) familySelect.onchange = (event) => {
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
    const standing = g.allPlannedGraded ? classifyCgpa(g.cgpa) : null;
    const heroProgram = $("heroProgram");
    if (heroProgram) heroProgram.textContent = p.nameEn || p.short;
    $("heroMeta").textContent = `${p.total} credits / ${p.semCount} semesters / ${p.courses.length} course entries`;
    $("statCredits").textContent = `${total}/${p.total}`;
    $("statCgpa").textContent = g.allPlannedGraded ? g.cgpa.toFixed(2) : "--";
    $("statCourses").textContent = plannedItems().length;
    $("statStatus").textContent = standing ? standing.label : g.gradedCourses ? `${g.gradedCourses}/${g.plannedCourses} graded` : "Awaiting grades";
    renderCgpaOverview(g, total, standing);
    renderComponents("componentGrid");
    renderSemesterBars("semesterBars");
  }

  function renderCgpaOverview(g, total, standing) {
    const gauge = $("cgpaGauge");
    if (!gauge) return;
    $("cgpaOverview").dataset.tone = standing ? standing.tone : "empty";
    const value = g.allPlannedGraded ? g.cgpa : 0;
    const pct = Math.max(0, Math.min(100, (value / 4) * 100));
    gauge.style.setProperty("--cgpa", `${pct}%`);
    gauge.dataset.tone = standing ? standing.tone : "empty";
    $("cgpaGaugeValue").textContent = g.allPlannedGraded ? g.cgpa.toFixed(2) : "--";
    $("cgpaGaugeStanding").textContent = standing ? standing.label : "Awaiting grades";
    $("cgpaGaugeNote").textContent = standing ? "" : `${g.gradedCourses}/${g.plannedCourses} planned courses graded.`;
    $("cgpaStandingTitle").textContent = standing ? standing.label : "Awaiting grades";
    $("cgpaStandingText").textContent = standing ? "Classification follows the SEFB CGPA bands." : "Your standing will appear after every planned course has a grade.";
    $("overviewProgramName").textContent = currentProgram().nameEn || currentProgram().short;
    $("overviewCreditsPlanned").textContent = total;
    $("overviewGradedCourses").textContent = g.gradedCourses;
    $("overviewGradedCredits").textContent = g.gradedCredits;
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

  function categoryLabel(cat) {
    const component = currentProgram().components.find((item) => item.l === cat);
    return component ? `Category ${cat}: ${component.en}` : `Category ${cat}`;
  }

  function courseListCategoryLabel(cat) {
    const component = currentProgram().components.find((item) => item.l === cat);
    return component ? `${component.en} (Category ${cat})` : `Category ${cat}`;
  }

  function courseListCourseDetail(course, committedTrack, committedField) {
    const p = currentProgram();
    if (course.track) {
      const track = p.tracks?.find((item) => item.id === course.track);
      const selected = committedTrack && committedTrack !== course.track ? " - locked by selected specialisation" : "";
      return `Specialisation: ${track ? `${track.en} (${track.ms})` : course.track}${selected}`;
    }
    if (course.field) {
      const field = p.fFields?.find((item) => item.id === course.field);
      const selected = committedField && committedField !== course.field ? " - locked by selected field" : "";
      return `Field: ${field ? `${field.en} (${field.ms})` : course.field}${selected}`;
    }
    return "";
  }

  function courseListSearchText(course) {
    const prereqText = (course.pre || []).map((code) => {
      const prereq = getCourse(code);
      return prereq ? `${code} ${prereq.en} ${prereq.ms || ""}` : code;
    }).join(" ");
    const detailText = courseListCourseDetail(course, null, null);
    return [
      course.code,
      course.en,
      course.ms || "",
      course.cat,
      courseListCategoryLabel(course.cat),
      detailText,
      prereqText
    ].join(" ").toLowerCase();
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
    const committedField = committedFieldId() || state.fieldId;
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
    const gpa = computeGPA();
    for (let sem = 1; sem <= totalSems(); sem++) {
      const credits = (state.plan[sem] || []).reduce((sum, item) => sum + courseCredits(item), 0);
      const session = state.sessions?.[sem] || SESSION_OPTIONS[Math.min(sem - 1, SESSION_OPTIONS.length - 1)];
      const term = gpa.per[sem - 1];
      const termText = !term || !term.plannedCourses ? "--" : term.allGraded && term.gpa !== null ? term.gpa.toFixed(2) : term.gradedCourses ? `${term.gradedCourses}/${term.plannedCourses}` : "--";
      const courses = (state.plan[sem] || []).map((item, index) => {
        const c = getCourse(item.code);
        if (!c) return "";
        const status = prereqStatus(c.code, sem, { requireGrades: true });
        const moveOptions = Array.from({ length: totalSems() }, (_, i) => i + 1).filter((target) => target !== sem);
        return `<article class="course cat-${c.cat}">
          <div class="course-code">${c.code}</div>
          <div class="course-main">
            <div class="course-title">${c.en}</div>
            <div class="course-sub">${c.ms || ""} · ${categoryLabel(c.cat)}</div>
            ${status.ok ? "" : `<div class="course-lock">${LOCK_ICON} ${status.missing.join(", ")}</div>`}
          </div>
          <div class="course-credit">${c.cr} CR</div>
          <div class="inline-actions">
            <select class="select grade-select" data-grade="${sem}:${index}">
              <option value="">--</option>
              ${GRADES.map((g) => `<option value="${g.g}" ${item.grade === g.g ? "selected" : ""}>${g.g}</option>`).join("")}
            </select>
            <select class="select compact-select" data-move-target="${sem}:${index}">
              <option value="">Move to...</option>
              ${moveOptions.map((target) => `<option value="${target}">Semester ${target}</option>`).join("")}
            </select>
            <button class="mini-button remove-button" data-remove="${sem}:${index}" title="Remove course" aria-label="Remove course">Remove course</button>
          </div>
        </article>`;
      }).join("");
      holder.innerHTML += `<section class="semester">
        <div class="semester-head">
          <strong>Semester ${sem}</strong>
          <div class="semester-meta">
            <button class="button dean-button" data-simulate-deans="${sem}">Simulate a Dean's List semester for me!</button>
            <select class="select session-select" data-session="${sem}" aria-label="Session for Semester ${sem}">
              ${SESSION_OPTIONS.map((item) => `<option value="${item}" ${session === item ? "selected" : ""}>${item}</option>`).join("")}
            </select>
            <span>${credits} credits</span>
            <div class="term-gpa"><span>Term GPA</span><strong>${termText}</strong></div>
          </div>
        </div>
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
    document.querySelectorAll("[data-simulate-deans]").forEach((button) => {
      button.onclick = () => simulateDeansList(Number(button.dataset.simulateDeans));
    });
    document.querySelectorAll("[data-session]").forEach((select) => {
      select.onchange = () => {
        const sem = select.dataset.session;
        state.sessions[sem] = select.value;
        saveState();
        renderPlanner();
      };
    });
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
    document.querySelectorAll("[data-move-target]").forEach((select) => {
      select.onchange = () => {
        const [sem, index] = select.dataset.moveTarget.split(":").map(Number);
        const target = Number(select.value);
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

  function simulateDeansList(sem) {
    const semItems = state.plan[sem] || [];
    if (!semItems.length) {
      toast(`Add courses to Semester ${sem} first`);
      return;
    }
    const creditItems = semItems
      .map((item) => ({ item, cr: courseCredits(item) }))
      .filter((row) => row.cr > 0)
      .sort((a, b) => b.cr - a.cr);
    if (!creditItems.length) {
      toast(`Semester ${sem} has no credit-bearing courses`);
      return;
    }
    const shortPatterns = {
      1: ["A"],
      2: ["A+", "A-"],
      3: ["A+", "A", "B+"],
      4: ["A+", "A", "A-", "B+"],
      5: ["A+", "A", "A-", "B+", "A"],
      6: ["A+", "A", "A-", "B+", "A", "A-"]
    };
    const pattern = shortPatterns[creditItems.length] || ["A+", "A", "A-", "B+", "A", "A-", "A", "B+"];
    creditItems.forEach((row, index) => {
      row.item.grade = pattern[index % pattern.length];
    });
    const target = DEANS_LIST + 0.005;
    let term = semesterGpa(sem);
    for (let guard = 0; term.gpa !== null && term.gpa < target && guard < creditItems.length * 2; guard++) {
      const row = creditItems
        .filter((candidate) => gp(candidate.item.grade) < 4)
        .sort((a, b) => gp(a.item.grade) - gp(b.item.grade) || b.cr - a.cr)[0];
      if (!row) break;
      row.item.grade = row.item.grade === "B+" ? "A-" : "A";
      term = semesterGpa(sem);
    }
    for (const row of creditItems) {
      if (term.gpa !== null && term.gpa >= target) break;
      row.item.grade = "A";
      term = semesterGpa(sem);
    }
    saveState();
    renderPlanner();
    toast(`Semester ${sem} simulated at ${term.gpa ? term.gpa.toFixed(2) : "--"} Term GPA`);
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
      if (component.l === "D" && p.tracks && p.tracks.length && list.some((course) => course.track)) {
        const committedTrack = committedTrackId();
        const headerText = committedTrack
          ? `Selected specialisation: ${p.tracks.find((track) => track.id === committedTrack)?.en || committedTrack}`
          : `Choose ONE specialisation (${component.req} credits)`;
        const groups = [`<optgroup label="D. ${component.en} - ${headerText}"><option disabled>${headerText}</option></optgroup>`];
        p.tracks.forEach((track, index) => {
          const trackList = list.filter((course) => course.track === track.id).sort((a, b) => a.code.localeCompare(b.code));
          if (!trackList.length) return;
          const locked = committedTrack && committedTrack !== track.id;
          const label = `D${index + 1}. ${track.en} - ${track.ms}${locked ? " (locked)" : ""}`;
          groups.push(`<optgroup label="${label}">${trackList.map(courseOptionHtml).join("")}</optgroup>`);
        });
        const shared = list.filter((course) => !course.track);
        if (shared.length) {
          groups.push(`<optgroup label="Shared specialisation courses">${shared.map(courseOptionHtml).join("")}</optgroup>`);
        }
        return groups.join("");
      }
      if (component.l === "F" && p.fFields && p.fFields.length && list.some((course) => course.field)) {
        const committedField = committedFieldId() || state.fieldId;
        const headerText = committedField
          ? `Selected field: ${p.fFields.find((field) => field.id === committedField)?.en || committedField}`
          : `Choose ONE field (${component.req} credits)`;
        const groups = [`<optgroup label="F. ${component.en} - ${headerText}"><option disabled>${headerText}</option></optgroup>`];
        p.fFields.forEach((field, index) => {
          const fieldList = list.filter((course) => course.field === field.id).sort((a, b) => a.code.localeCompare(b.code));
          if (!fieldList.length) return;
          const locked = committedField && committedField !== field.id;
          const label = `F${index + 1}. ${field.en} - ${field.ms} (${fieldList.length} courses, choose 6)${locked ? " (locked)" : ""}`;
          groups.push(`<optgroup label="${label}">${fieldList.map(courseOptionHtml).join("")}</optgroup>`);
        });
        return groups.join("");
      }
      return `<optgroup label="${component.l}. ${component.en}">${list.map(courseOptionHtml).join("")}</optgroup>`;
    }).join("");
  }

  function courseOptionHtml(course) {
    const disabled = course.disabled || !course.status.ok ? "disabled" : "";
    return `<option value="${course.code}" ${disabled}>${optionLabel(course)}</option>`;
  }

  function optionLabel(course) {
    if (course.failedPlaced) return `Retake Sem ${course.placed.sem} / ${course.code} / ${course.en} (${course.cr}cr)`;
    if (course.placed) return `Sem ${course.placed.sem} / ${course.code} / ${course.en} (${course.cr}cr)`;
    if (course.disabled) return `${LOCK_ICON} ${course.code} · ${course.en} (${course.cr}cr) · ${course.lockReason}`;
    if (!course.status.ok) return `${LOCK_ICON} ${course.code} · ${course.en} (${course.cr}cr) · ${course.status.missing.join(", ")}`;
    return `${course.code} / ${course.en} (${course.cr}cr)`;
  }

  function loadRecommended() {
    const p = currentProgram();
    const rec = p.recommended && p.recommended[state.trackId || ""];
    if (!rec) {
      toast("No recommended plan for this selection");
      return;
    }
    if (p.fFields && p.fFields.length) {
      const field = p.fFields.find((item) => item.id === state.fieldId);
      if (!field) {
        toast("Choose a field elective first");
        return;
      }
      confirmDialog(`Replace your current plan with the recommended plan for ${field.en}?`, () => applyRecommendedPlan(applyFieldElectiveChoice(rec, state.fieldId)));
      return;
    }
    confirmDialog("Replace your current plan with the official recommended plan?", () => applyRecommendedPlan(rec));
  }

  function applyFieldElectiveChoice(rec, fieldId) {
    const p = currentProgram();
    const schedule = FIELD_RECOMMENDED_SLOTS[p.id]?.[fieldId];
    if (!schedule) return rec;
    const out = {};
    Object.entries(rec).forEach(([sem, codes]) => {
      const replacement = schedule[Number(sem)] || [];
      const base = codes.filter((code) => {
        const course = getCourse(code);
        return !(course && course.cat === "F" && course.field);
      });
      out[sem] = base.concat(replacement);
    });
    return out;
  }

  function applyRecommendedPlan(rec) {
    state.plan = emptyPlan();
    Object.entries(rec).forEach(([sem, codes]) => {
      state.plan[sem] = codes.map((code) => ({ code, grade: "" }));
    });
    if (state.langId && state.langId !== "MAN") substituteLangCourses("MAN", state.langId);
    saveState();
    renderPlanner();
    toast("Recommended plan loaded");
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
    const planned = plannedItems();
    const gradedCount = planned.filter((item) => item.grade).length;
    const failedCount = planned.filter((item) => item.grade && FAIL_GRADES.has(item.grade)).length;
    const passedByCat = componentProgress({ completedOnly: true });
    const plannedByCat = componentProgress();
    const total = completedCredits();
    const placedTotal = plannedCredits();
    const g = computeGPA();
    const items = [
      { ok: planned.length > 0 && gradedCount === planned.length, label: "All planned courses graded", value: `${gradedCount}/${planned.length} courses` },
      {
        ok: planned.length > 0 && gradedCount === planned.length && failedCount === 0,
        label: "No failed courses pending retake",
        value: gradedCount !== planned.length ? `${gradedCount}/${planned.length} courses graded` : failedCount ? `${failedCount} course(s)` : "OK"
      }
    ];
    Object.values(passedByCat).forEach((comp) => items.push({ ok: comp.done >= comp.req, label: `${comp.l}. ${comp.en}`, value: `${comp.done}/${comp.req} cr` }));
    items.push({ ok: total >= p.total, label: "Completed credits", value: `${total}/${p.total}` });
    items.push({ ok: g.allPlannedGraded && g.cgpa >= 2, label: "Minimum CGPA 2.00", value: g.allPlannedGraded ? g.cgpa.toFixed(2) : `${g.gradedCourses}/${g.plannedCourses} courses graded` });
    const remaining = items.filter((item) => !item.ok).length;
    const pendingPlaced = planned.filter((item) => !hasPassingGrade(item)).reduce((sum, item) => sum + courseCredits(item), 0);
    const completion = items.length ? Math.round((items.filter((item) => item.ok).length / items.length) * 100) : 0;
    const eligible = items.every((item) => item.ok);
    const degree = $("auditDegree");
    if (degree) degree.textContent = p.nameEn || p.short;
    $("auditSummary").innerHTML = `
      <div class="eyebrow">Final status</div>
      <h2>${eligible ? "Eligible To Graduate" : "Not Yet Eligible"}</h2>
      <p>${remaining} requirement${remaining === 1 ? "" : "s"} remaining / ${pendingPlaced} credits placed but not yet passed</p>
      <strong>${completion}%</strong>
      <span>Checklist completion</span>
    `;
    const rows = Object.values(passedByCat).map((comp) => {
      const plannedComp = plannedByCat[comp.l] || comp;
      const pending = Math.max(0, plannedComp.done - comp.done);
      const pct = comp.req ? Math.min(100, Math.round((comp.done / comp.req) * 100)) : 0;
      const met = comp.done >= comp.req;
      const note = pending ? `${pending} cr placed, not yet passed` : comp.ms;
      return { label: `${comp.l}. ${comp.en}`, detail: note, value: `${comp.done} / ${comp.req} cr passed`, pct, met, status: met ? "Met" : pending ? "Grading pending" : "Pending" };
    });
    rows.push({
      label: "Total Credits",
      detail: `${placedTotal} cr placed in planner`,
      value: `${total} / ${p.total} cr passed`,
      pct: p.total ? Math.min(100, Math.round((total / p.total) * 100)) : 0,
      met: total >= p.total,
      status: total >= p.total ? "Met" : "Grading pending"
    });
    rows.push({
      label: "Minimum CGPA 2.00",
      detail: g.allPlannedGraded ? "All planned grades entered" : `${g.gradedCourses} / ${g.plannedCourses} courses graded`,
      value: g.allPlannedGraded ? g.cgpa.toFixed(2) : "--",
      pct: g.allPlannedGraded ? Math.min(100, Math.round((g.cgpa / 4) * 100)) : 0,
      met: g.allPlannedGraded && g.cgpa >= 2,
      status: g.allPlannedGraded && g.cgpa >= 2 ? "Met" : "Grading pending"
    });
    $("auditList").innerHTML = rows.map((row) => `
      <div class="audit-progress-row ${row.met ? "met" : ""}">
        <div>
          <strong>${row.label}</strong>
          <span>${row.detail}</span>
        </div>
        <div class="audit-line"><span style="--w:${row.pct}%"></span></div>
        <small>${row.value}</small>
        <em>${row.status}</em>
      </div>
    `).join("");
    renderPortfolio(g, total, planned);
    renderAlerts();
  }

  function renderPortfolio(g, total, planned) {
    const holder = $("auditPortfolio");
    if (!holder) return;
    const p = currentProgram();
    const semOneTwo = [1, 2].flatMap((sem) => state.plan[sem] || []);
    const regularLoads = g.per.map((row) => {
      const credits = (state.plan[row.sem] || []).reduce((sum, item) => sum + courseCredits(item), 0);
      return { sem: row.sem, credits };
    }).filter((row) => row.credits > 0 && !(p.shortSems || []).includes(row.sem));
    const balancedLoads = regularLoads.length > 0 && regularLoads.every((row) => row.credits >= MIN_CR && row.credits <= MAX_CR);
    const deansTerm = g.per.some((row) => row.allGraded && row.gpa !== null && row.gpa >= DEANS_LIST);
    const halfwayCredits = Math.ceil(p.total / 2);
    const finalApproachCredits = Math.ceil(p.total * 0.85);
    const tiles = [
      {
        label: "First year cleared",
        detail: "Semester 1 and 2 courses have passing grades.",
        earned: semOneTwo.length > 0 && semOneTwo.every(hasPassingGrade)
      },
      {
        label: "Halfway point",
        detail: `${total} / ${p.total} credits passed. Target: ${halfwayCredits} credits.`,
        earned: total >= halfwayCredits
      },
      {
        label: "Final approach",
        detail: `${total} / ${p.total} credits passed. Target: ${finalApproachCredits} credits.`,
        earned: total >= finalApproachCredits
      },
      {
        label: "Semester load okay",
        detail: "Scheduled semesters stay within the normal credit range.",
        earned: balancedLoads
      },
      {
        label: "Dean's List semester",
        detail: "At least one completed semester has Term GPA 3.67 or higher.",
        earned: deansTerm
      },
      {
        label: "All grades entered",
        detail: `${g.gradedCourses} / ${g.plannedCourses} planned courses have grades.`,
        earned: planned.length > 0 && planned.every((item) => item.grade)
      }
    ];
    holder.innerHTML = tiles.map((tile) => `
      <article class="achievement-tile ${tile.earned ? "earned" : ""}">
        <strong>${tile.earned ? "Met" : "Not yet"}</strong>
        <span>${tile.label}</span>
        <p>${tile.detail}</p>
      </article>
    `).join("");
  }

  function renderAlerts() {
    const holder = $("alerts");
    if (!holder) return;
    const issues = [];
    const p = currentProgram();
    for (let sem = 1; sem <= totalSems(); sem++) {
      const credits = (state.plan[sem] || []).reduce((sum, item) => sum + courseCredits(item), 0);
      const ungraded = [];
      if (credits > 0 && credits < MIN_CR && !(p.shortSems || []).includes(sem)) {
        issues.push({ kind: "load", tag: "Credits", mark: "!", title: `Semester ${sem} is underloaded`, detail: `${credits}/${MIN_CR} minimum credits planned.` });
      }
      if (credits > MAX_CR) {
        issues.push({ kind: "load", tag: "Credits", mark: "!", title: `Semester ${sem} is overloaded`, detail: `${credits}/${MAX_CR} maximum credits planned.` });
      }
      (state.plan[sem] || []).forEach((item) => {
        const status = prereqStatus(item.code, sem, { requireGrades: true });
        if (!status.ok) {
          issues.push({ kind: "rule", tag: "Rule", mark: LOCK_ICON, title: `${item.code} is locked`, detail: `Semester ${sem}: ${status.missing.join(", ")}.` });
        }
        if (!item.grade) ungraded.push(item.code);
        if (item.grade && FAIL_GRADES.has(item.grade)) {
          issues.push({ kind: "retake", tag: "Retake", mark: "R", title: `${item.code} needs retake`, detail: "This grade does not count as completed credit." });
        }
      });
      if (ungraded.length) {
        issues.push({ kind: "grades", tag: "Grades", mark: "A+", title: `Semester ${sem}: add missing grades`, detail: `${ungraded.length} course(s) still blank. No need to panic, just fill them after results.` });
      }
    }
    const count = $("alertCount");
    if (count) count.textContent = issues.length ? `${issues.length} item${issues.length === 1 ? "" : "s"}` : "Clear";
    holder.innerHTML = issues.length ? `<div class="action-board">${issues.map((issue) => `
      <article class="fix-card ${issue.kind}">
        <div class="fix-mark">${issue.mark}</div>
        <div class="fix-copy">
          <span>${issue.tag}</span>
          <strong>${issue.title}</strong>
          <p>${issue.detail}</p>
        </div>
      </article>
    `).join("")}</div>` : `<div class="empty-fix"><strong>All clear for now.</strong><p>No planning alerts right now.</p></div>`;
  }

  function renderAnalytics() {
    const g = computeGPA();
    $("analyticsCgpa").textContent = g.allPlannedGraded ? g.cgpa.toFixed(2) : "--";
    $("analyticsStanding").textContent = !g.gradedCourses ? "No graded credits" : !g.allPlannedGraded ? `${g.gradedCourses}/${g.plannedCourses} courses graded` : classifyCgpa(g.cgpa).label;
    $("gpaRows").innerHTML = g.per.map((row) => `<div class="bar-row">
      <span>Sem ${row.sem}</span>
      <div class="bar"><span style="--w:${row.allGraded ? Math.round(((row.gpa || 0) / 4) * 100) : 0}%"></span></div>
      <span>${row.allGraded && row.gpa !== null ? row.gpa.toFixed(2) : row.gradedCourses ? `${row.gradedCourses}/${row.plannedCourses}` : "--"}</span>
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
        const text = courseListSearchText(c);
        if (c.cat === "D" && c.lang && c.lang !== state.langId) return false;
        return !q || text.includes(q);
      });
      $("courseRows").innerHTML = rows.map((c) => {
        const detail = courseListCourseDetail(c, committedTrack, committedField);
        const prereqs = (c.pre || []).map((code) => {
          const prereq = getCourse(code);
          return prereq ? `${code} - ${prereq.en}` : code;
        }).join("<br>") || "None";
        return `<tr><td><strong>${c.code}</strong></td><td>${c.en}<br><span class="muted">${c.ms || ""}</span></td><td>${courseListCategoryLabel(c.cat)}${detail ? `<br><span class="muted">${detail}</span>` : ""}</td><td>${c.cr} ${c.cr === 1 ? "credit" : "credits"}</td><td>${prereqs}</td></tr>`;
      }).join("");
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
        toast("Backup restored");
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        toast("Restore failed: choose a valid backup file");
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
