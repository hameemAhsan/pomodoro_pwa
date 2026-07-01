'use strict';

const STORAGE_KEY = 'focus-targets-pwa-state-v1';
const SECOND = 1000;
let deferredInstallPrompt = null;
let timerInterval = null;
let timer = null;

const defaultState = () => ({
  version: 1,
  settings: {
    theme: 'system',
    defaultFocusMinutes: 25,
    defaultBreakMinutes: 5,
    defaultRounds: 1,
    soundEnabled: true,
    vibrationEnabled: true,
    notificationsEnabled: false,
    autoBreak: true,
    autoNextFocus: false
  },
  categories: [
    createCategory('MBA Study', 180, '#2563eb', true),
    createCategory('Math Research', 60, '#7c3aed', true),
    createCategory('Business Work', 120, '#f97316', true),
    createCategory('Reading', 30, '#16a34a', true)
  ],
  sessions: []
});

let state = loadState();

function createId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createCategory(name, targetMinutes, color, isDefault = false) {
  return {
    id: createId('cat'),
    name,
    targetMinutes: Number(targetMinutes) || 0,
    color,
    active: true,
    isDefault,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const fallback = defaultState();
    return {
      ...fallback,
      ...parsed,
      settings: { ...fallback.settings, ...(parsed.settings || {}) },
      categories: Array.isArray(parsed.categories) && parsed.categories.length ? parsed.categories : fallback.categories,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    };
  } catch (error) {
    console.error('Failed to load state', error);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function $(id) {
  return document.getElementById(id);
}

function formatMinutes(totalMinutes) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function formatSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseMinutes(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.round(n);
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.add('hidden'), 2800);
}

function getCategory(id) {
  return state.categories.find(cat => cat.id === id) || state.categories[0];
}

function getActiveCategories() {
  return state.categories.filter(cat => cat.active !== false);
}

function sessionsForDate(dateKey) {
  return state.sessions.filter(session => session.date === dateKey);
}

function sessionsForRange(days) {
  const keys = new Set();
  for (let i = 0; i < days; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    keys.add(todayKey(date));
  }
  return state.sessions.filter(session => keys.has(session.date));
}

function completedFocusSessions(sessions) {
  return sessions.filter(session => session.type === 'focus' && ['completed', 'partial'].includes(session.status));
}

function minutesByCategory(sessions) {
  const map = new Map();
  completedFocusSessions(sessions).forEach(session => {
    map.set(session.categoryId, (map.get(session.categoryId) || 0) + session.actualMinutes);
  });
  return map;
}

function totalTargetForActiveCategories(days = 1) {
  return getActiveCategories().reduce((sum, cat) => sum + (Number(cat.targetMinutes) || 0) * days, 0);
}

function totalFocusMinutes(sessions) {
  return completedFocusSessions(sessions).reduce((sum, session) => sum + (Number(session.actualMinutes) || 0), 0);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function applyTheme() {
  const theme = state.settings.theme || 'system';
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const actual = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = actual;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', actual === 'dark' ? '#070b14' : '#0f172a');
}

function toggleTheme() {
  const actual = document.documentElement.dataset.theme || 'light';
  state.settings.theme = actual === 'dark' ? 'light' : 'dark';
  saveState();
  applyTheme();
  showToast(`${state.settings.theme === 'dark' ? 'Dark' : 'Light'} theme on`);
}

function setView(viewName) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active-view', view.dataset.view === viewName));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.nav === viewName));
  renderAll();
}

function renderRing(percent) {
  const circle = $('todayRing');
  const circumference = 314;
  circle.style.strokeDashoffset = String(circumference - (clampPercent(percent) / 100) * circumference);
}

function renderToday() {
  const dateKey = todayKey();
  const todaySessions = sessionsForDate(dateKey);
  const focusSessions = completedFocusSessions(todaySessions);
  const total = totalFocusMinutes(todaySessions);
  const target = totalTargetForActiveCategories(1);
  const percent = target ? Math.round((total / target) * 100) : 0;

  $('todayDateLabel').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('todayTotal').textContent = `${formatMinutes(total)} focused`;
  $('todaySubtext').textContent = target ? `${formatMinutes(Math.max(0, target - total))} left against today’s active targets.` : 'Set category targets to track performance.';
  $('todayPercent').textContent = `${clampPercent(percent)}%`;
  $('todayCompleted').textContent = String(focusSessions.filter(s => s.status === 'completed').length);
  $('streakCount').textContent = `${calculateStreak()} days`;
  renderRing(percent);

  const byCat = minutesByCategory(todaySessions);
  const progress = $('todayCategoryProgress');
  progress.innerHTML = getActiveCategories().map(cat => {
    const actual = byCat.get(cat.id) || 0;
    const catPercent = cat.targetMinutes ? Math.round((actual / cat.targetMinutes) * 100) : 0;
    return `<article class="category-progress">
      <div class="category-row">
        <span class="category-name"><span class="dot" style="background:${cat.color};color:${cat.color}"></span>${escapeHtml(cat.name)}</span>
        <strong>${formatMinutes(actual)} / ${formatMinutes(cat.targetMinutes)}</strong>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${clampPercent(catPercent)}%;background:${cat.color}"></div></div>
    </article>`;
  }).join('');

  const list = $('todaySessions');
  list.innerHTML = todaySessions.length ? todaySessions.slice().reverse().map(sessionItemHtml).join('') : '';
}

function sessionItemHtml(session) {
  const category = getCategory(session.categoryId) || { name: session.categoryNameSnapshot || 'Category', color: '#64748b' };
  const start = new Date(session.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const end = session.endAt ? new Date(session.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const statusText = session.status === 'partial' ? 'partial saved' : session.status;
  return `<article class="session-item">
    <div class="session-top">
      <span class="category-name"><span class="dot" style="background:${category.color};color:${category.color}"></span>${escapeHtml(session.categoryNameSnapshot || category.name)}</span>
      <strong>${formatMinutes(session.actualMinutes || 0)}</strong>
    </div>
    <div class="session-meta">
      <span>${start}–${end}</span>
      <span class="status-chip">${escapeHtml(statusText)}</span>
      ${session.note ? `<span>${escapeHtml(session.note)}</span>` : ''}
    </div>
  </article>`;
}

function calculateStreak() {
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = todayKey(date);
    const sessions = sessionsForDate(key);
    const total = totalFocusMinutes(sessions);
    const target = totalTargetForActiveCategories(1);
    const targetHit = target > 0 ? total >= target : total > 0;
    if (targetHit) streak += 1;
    else break;
  }
  return streak;
}

function renderCategorySelect() {
  const select = $('focusCategorySelect');
  const current = select.value;
  const categories = getActiveCategories();
  select.innerHTML = categories.map(cat => `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`).join('');
  if (categories.some(cat => cat.id === current)) select.value = current;
}

function renderCategories() {
  const list = $('categoryList');
  list.innerHTML = state.categories.map(cat => `<article class="category-item">
    <div class="category-row">
      <span class="category-name"><span class="dot" style="background:${cat.color};color:${cat.color}"></span>${escapeHtml(cat.name)}</span>
      <strong>${formatMinutes(cat.targetMinutes)} / day</strong>
    </div>
    <div class="category-actions">
      <button class="ghost small" type="button" data-edit-category="${cat.id}">Edit</button>
      <button class="ghost small" type="button" data-toggle-category="${cat.id}">${cat.active === false ? 'Activate' : 'Deactivate'}</button>
      <button class="danger-soft small" type="button" data-delete-category="${cat.id}">Delete</button>
    </div>
  </article>`).join('');
}

function clearCategoryForm() {
  $('categoryIdInput').value = '';
  $('categoryNameInput').value = '';
  $('categoryTargetInput').value = '60';
  $('categoryColorInput').value = '#2563eb';
}

function handleCategorySubmit(event) {
  event.preventDefault();
  const id = $('categoryIdInput').value;
  const name = $('categoryNameInput').value.trim();
  const target = Math.max(0, Math.round(Number($('categoryTargetInput').value) || 0));
  const color = $('categoryColorInput').value || '#2563eb';
  if (!name) {
    showToast('Category name is required.');
    return;
  }
  if (id) {
    const cat = state.categories.find(item => item.id === id);
    if (cat) {
      cat.name = name;
      cat.targetMinutes = target;
      cat.color = color;
      cat.updatedAt = nowIso();
      showToast('Category updated.');
    }
  } else {
    state.categories.push(createCategory(name, target, color));
    showToast('Category added.');
  }
  saveState();
  clearCategoryForm();
  renderAll();
}

function handleCategoryActions(event) {
  const editId = event.target.closest('[data-edit-category]')?.dataset.editCategory;
  const toggleId = event.target.closest('[data-toggle-category]')?.dataset.toggleCategory;
  const deleteId = event.target.closest('[data-delete-category]')?.dataset.deleteCategory;

  if (editId) {
    const cat = state.categories.find(item => item.id === editId);
    if (!cat) return;
    $('categoryIdInput').value = cat.id;
    $('categoryNameInput').value = cat.name;
    $('categoryTargetInput').value = cat.targetMinutes;
    $('categoryColorInput').value = cat.color;
    setView('categories');
    return;
  }

  if (toggleId) {
    const cat = state.categories.find(item => item.id === toggleId);
    if (cat) {
      cat.active = cat.active === false;
      cat.updatedAt = nowIso();
      saveState();
      renderAll();
    }
    return;
  }

  if (deleteId) {
    const used = state.sessions.some(session => session.categoryId === deleteId);
    const message = used ? 'This category has saved sessions. Delete anyway? Old sessions will remain readable by snapshot.' : 'Delete this category?';
    if (!confirm(message)) return;
    state.categories = state.categories.filter(cat => cat.id !== deleteId);
    if (!state.categories.length) state.categories.push(createCategory('Focus', 60, '#2563eb'));
    saveState();
    renderAll();
  }
}

function initTimerFromInputs() {
  const categories = getActiveCategories();
  if (!categories.length) {
    showToast('Add at least one active category first.');
    return null;
  }
  const categoryId = $('focusCategorySelect').value || categories[0].id;
  const category = getCategory(categoryId);
  const focusMinutes = parseMinutes($('focusMinutesInput').value, state.settings.defaultFocusMinutes);
  const breakMinutes = parseMinutes($('breakMinutesInput').value, state.settings.defaultBreakMinutes);
  const rounds = Math.max(1, Math.min(12, parseMinutes($('roundsInput').value, state.settings.defaultRounds)));
  return {
    phase: 'focus',
    status: 'running',
    categoryId,
    categoryNameSnapshot: category.name,
    focusMinutes,
    breakMinutes,
    rounds,
    currentRound: 1,
    totalSeconds: focusMinutes * 60,
    remainingSeconds: focusMinutes * 60,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    elapsedFocusSecondsThisPhase: 0,
    note: $('sessionNoteInput').value.trim(),
    autoBreak: $('autoBreakInput').checked,
    autoNextFocus: $('autoNextFocusInput').checked
  };
}

function startTimer() {
  if (timer && timer.status === 'paused') {
    resumeTimer();
    return;
  }
  if (timer && timer.status === 'running') return;
  timer = initTimerFromInputs();
  if (!timer) return;
  $('startBtn').classList.add('hidden');
  $('pauseBtn').classList.remove('hidden');
  $('resumeBtn').classList.add('hidden');
  $('partialActions').classList.add('hidden');
  disableSessionInputs(true);
  startTicking();
  renderTimer();
  showToast('Focus started.');
}

function startTicking() {
  clearInterval(timerInterval);
  timerInterval = setInterval(tick, 250);
}

function tick() {
  if (!timer || timer.status !== 'running') return;
  const elapsed = Math.floor((Date.now() - timer.phaseStartedAt) / SECOND);
  timer.remainingSeconds = Math.max(0, timer.totalSeconds - elapsed);
  if (timer.phase === 'focus') {
    timer.elapsedFocusSecondsThisPhase = Math.min(timer.totalSeconds, elapsed);
  }
  renderTimer();
  if (timer.remainingSeconds <= 0) completePhase();
}

function pauseTimer() {
  if (!timer || timer.status !== 'running') return;
  timer.status = 'paused';
  timer.pausedAt = Date.now();
  timer.remainingAtPause = timer.remainingSeconds;
  if (timer.phase === 'focus') timer.elapsedFocusSecondsThisPhase = timer.totalSeconds - timer.remainingSeconds;
  clearInterval(timerInterval);
  $('pauseBtn').classList.add('hidden');
  $('resumeBtn').classList.remove('hidden');
  if (timer.phase === 'focus' && timer.elapsedFocusSecondsThisPhase > 0) $('partialActions').classList.remove('hidden');
  renderTimer();
}

function resumeTimer() {
  if (!timer || timer.status !== 'paused') return;
  timer.status = 'running';
  const remaining = timer.remainingAtPause ?? timer.remainingSeconds;
  timer.remainingSeconds = remaining;
  timer.phaseStartedAt = Date.now() - ((timer.totalSeconds - remaining) * SECOND);
  $('resumeBtn').classList.add('hidden');
  $('pauseBtn').classList.remove('hidden');
  $('partialActions').classList.add('hidden');
  startTicking();
  renderTimer();
}

function completePhase() {
  if (!timer) return;
  clearInterval(timerInterval);
  if (timer.phase === 'focus') {
    saveFocusSession('completed', timer.focusMinutes, timer.sessionStartedAt, Date.now());
    alertUser('Focus session complete', `${timer.focusMinutes} minutes added to ${timer.categoryNameSnapshot}.`);
    if (timer.autoBreak && timer.breakMinutes > 0) {
      beginBreak();
    } else {
      timer.status = 'awaiting-break';
      $('timerStatus').textContent = 'Focus saved. Start the break manually or reset to end.';
      $('startBtn').classList.remove('hidden');
      $('startBtn').textContent = 'Start break';
      $('pauseBtn').classList.add('hidden');
      $('resumeBtn').classList.add('hidden');
    }
  } else {
    alertUser('Break complete', timer.currentRound < timer.rounds ? 'Start your next focus session.' : 'All rounds completed.');
    if (timer.currentRound < timer.rounds) {
      timer.currentRound += 1;
      if (timer.autoNextFocus) beginFocusRound();
      else {
        timer.status = 'awaiting-focus';
        $('startBtn').classList.remove('hidden');
        $('startBtn').textContent = 'Start next focus';
        $('pauseBtn').classList.add('hidden');
      }
    } else {
      finishTimerCycle();
    }
  }
  renderAll();
}

function beginBreak() {
  if (!timer) return;
  timer.phase = 'break';
  timer.status = 'running';
  timer.totalSeconds = timer.breakMinutes * 60;
  timer.remainingSeconds = timer.totalSeconds;
  timer.phaseStartedAt = Date.now();
  $('startBtn').classList.add('hidden');
  $('pauseBtn').classList.remove('hidden');
  $('resumeBtn').classList.add('hidden');
  $('partialActions').classList.add('hidden');
  startTicking();
  renderTimer();
}

function beginFocusRound() {
  if (!timer) return;
  timer.phase = 'focus';
  timer.status = 'running';
  timer.totalSeconds = timer.focusMinutes * 60;
  timer.remainingSeconds = timer.totalSeconds;
  timer.phaseStartedAt = Date.now();
  timer.sessionStartedAt = Date.now();
  timer.elapsedFocusSecondsThisPhase = 0;
  $('startBtn').classList.add('hidden');
  $('pauseBtn').classList.remove('hidden');
  $('resumeBtn').classList.add('hidden');
  $('partialActions').classList.add('hidden');
  startTicking();
  renderTimer();
}

function finishTimerCycle() {
  timer = null;
  clearInterval(timerInterval);
  $('startBtn').textContent = 'Start';
  $('startBtn').classList.remove('hidden');
  $('pauseBtn').classList.add('hidden');
  $('resumeBtn').classList.add('hidden');
  $('partialActions').classList.add('hidden');
  disableSessionInputs(false);
  renderTimer();
  showToast('Timer cycle completed.');
}

function resetTimer() {
  if (timer && timer.phase === 'focus' && (timer.elapsedFocusSecondsThisPhase || 0) > 0 && timer.status !== 'running') {
    $('partialActions').classList.remove('hidden');
    showToast('Save partial or discard this unfinished session.');
    return;
  }
  if (timer && timer.phase === 'focus' && timer.status === 'running' && (timer.elapsedFocusSecondsThisPhase || 0) > 0) {
    pauseTimer();
    $('partialActions').classList.remove('hidden');
    return;
  }
  discardCurrentTimer();
}

function discardCurrentTimer() {
  timer = null;
  clearInterval(timerInterval);
  $('startBtn').textContent = 'Start';
  $('startBtn').classList.remove('hidden');
  $('pauseBtn').classList.add('hidden');
  $('resumeBtn').classList.add('hidden');
  $('partialActions').classList.add('hidden');
  disableSessionInputs(false);
  renderTimer();
  showToast('Session discarded.');
}

function savePartialSession() {
  if (!timer || timer.phase !== 'focus') return;
  const seconds = timer.elapsedFocusSecondsThisPhase || (timer.totalSeconds - timer.remainingSeconds);
  const minutes = Math.max(1, Math.round(seconds / 60));
  saveFocusSession('partial', minutes, timer.sessionStartedAt || Date.now(), Date.now());
  timer = null;
  clearInterval(timerInterval);
  $('startBtn').textContent = 'Start';
  $('startBtn').classList.remove('hidden');
  $('pauseBtn').classList.add('hidden');
  $('resumeBtn').classList.add('hidden');
  $('partialActions').classList.add('hidden');
  disableSessionInputs(false);
  renderAll();
  showToast(`${formatMinutes(minutes)} saved as partial focus.`);
}

function saveFocusSession(status, actualMinutes, startAtMs, endAtMs) {
  const category = getCategory(timer.categoryId);
  state.sessions.push({
    id: createId('session'),
    type: 'focus',
    date: todayKey(new Date(startAtMs)),
    startAt: new Date(startAtMs).toISOString(),
    endAt: new Date(endAtMs).toISOString(),
    categoryId: timer.categoryId,
    categoryNameSnapshot: timer.categoryNameSnapshot || category.name,
    plannedMinutes: timer.focusMinutes,
    actualMinutes: Math.max(1, Math.round(actualMinutes)),
    breakMinutes: timer.breakMinutes,
    round: timer.currentRound,
    rounds: timer.rounds,
    status,
    note: timer.note,
    createdAt: nowIso()
  });
  saveState();
}

function disableSessionInputs(disabled) {
  ['focusCategorySelect', 'focusMinutesInput', 'breakMinutesInput', 'roundsInput', 'sessionNoteInput', 'autoBreakInput', 'autoNextFocusInput'].forEach(id => {
    $(id).disabled = disabled;
  });
}

function renderTimer() {
  if (!timer) {
    const focusMinutes = parseMinutes($('focusMinutesInput')?.value || state.settings.defaultFocusMinutes, state.settings.defaultFocusMinutes);
    $('timerDisplay').textContent = formatSeconds(focusMinutes * 60);
    $('timerModePill').textContent = 'Focus';
    $('timerModePill').className = 'pill focus';
    $('timerRoundLabel').textContent = `Round 1 of ${$('roundsInput')?.value || state.settings.defaultRounds}`;
    $('timerStatus').textContent = 'Choose a category and start your focus block.';
    $('timerProgressBar').style.width = '0%';
    return;
  }
  $('timerDisplay').textContent = formatSeconds(timer.remainingSeconds);
  $('timerModePill').textContent = timer.phase === 'focus' ? 'Focus' : 'Break';
  $('timerModePill').className = `pill ${timer.phase === 'break' ? 'break' : 'focus'}`;
  $('timerRoundLabel').textContent = `Round ${timer.currentRound} of ${timer.rounds}`;
  const phaseLabel = timer.phase === 'focus' ? timer.categoryNameSnapshot : 'Break time';
  const actionLabel = timer.status === 'paused' ? 'Paused' : timer.status === 'running' ? 'Running' : 'Ready';
  $('timerStatus').textContent = `${actionLabel}: ${phaseLabel}.`;
  const progress = timer.totalSeconds ? ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100 : 0;
  $('timerProgressBar').style.width = `${clampPercent(progress)}%`;
}

function alertUser(title, body) {
  playChime();
  if (state.settings.vibrationEnabled && navigator.vibrate) navigator.vibrate([180, 80, 180]);
  if (state.settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: 'assets/icon-192.png' }); } catch (error) { console.warn(error); }
  }
  showToast(body);
}

function playChime() {
  if (!state.settings.soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.22, now + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.36);
    });
    setTimeout(() => ctx.close(), 900);
  } catch (error) {
    console.warn('Chime failed', error);
  }
}

function renderReports() {
  const days = Number($('reportRangeSelect').value || 7);
  const sessions = sessionsForRange(days);
  const focusTotal = totalFocusMinutes(sessions);
  const target = totalTargetForActiveCategories(days);
  const percent = target ? Math.round((focusTotal / target) * 100) : 0;
  $('reportTotal').textContent = formatMinutes(focusTotal);
  $('reportPercent').textContent = `${clampPercent(percent)}%`;
  $('reportCompleted').textContent = String(completedFocusSessions(sessions).filter(s => s.status === 'completed').length);

  const byCat = minutesByCategory(sessions);
  $('reportBars').innerHTML = getActiveCategories().map(cat => {
    const actual = byCat.get(cat.id) || 0;
    const catTarget = (cat.targetMinutes || 0) * days;
    const catPercent = catTarget ? Math.round((actual / catTarget) * 100) : 0;
    return `<article class="report-item">
      <div class="report-top">
        <span class="category-name"><span class="dot" style="background:${cat.color};color:${cat.color}"></span>${escapeHtml(cat.name)}</span>
        <strong>${clampPercent(catPercent)}%</strong>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${clampPercent(catPercent)}%;background:${cat.color}"></div></div>
      <div class="report-line"><span>Actual ${formatMinutes(actual)}</span><span>Target ${formatMinutes(catTarget)}</span></div>
    </article>`;
  }).join('');

  renderDailyTrend(days);
  $('historyList').innerHTML = state.sessions.length ? state.sessions.slice().reverse().slice(0, 25).map(sessionItemHtml).join('') : '';
}

function renderDailyTrend(days) {
  const maxTarget = Math.max(1, totalTargetForActiveCategories(1));
  const html = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = todayKey(date);
    const total = totalFocusMinutes(sessionsForDate(key));
    const height = Math.max(4, Math.min(100, Math.round((total / maxTarget) * 100)));
    html.push(`<div class="trend-day" title="${key}: ${formatMinutes(total)}">
      <div class="trend-bar" style="height:${height}%"></div>
      <span>${date.toLocaleDateString(undefined, { day: '2-digit' })}</span>
    </div>`);
  }
  $('dailyTrend').innerHTML = html.join('');
}

function renderSettings() {
  $('defaultFocusInput').value = state.settings.defaultFocusMinutes;
  $('defaultBreakInput').value = state.settings.defaultBreakMinutes;
  $('defaultRoundsInput').value = state.settings.defaultRounds;
  $('soundEnabledInput').checked = !!state.settings.soundEnabled;
  $('vibrationEnabledInput').checked = !!state.settings.vibrationEnabled;
  $('notificationsEnabledInput').checked = !!state.settings.notificationsEnabled;
}

function saveSettings() {
  state.settings.defaultFocusMinutes = parseMinutes($('defaultFocusInput').value, 25);
  state.settings.defaultBreakMinutes = parseMinutes($('defaultBreakInput').value, 5);
  state.settings.defaultRounds = Math.max(1, Math.min(12, parseMinutes($('defaultRoundsInput').value, 1)));
  state.settings.soundEnabled = $('soundEnabledInput').checked;
  state.settings.vibrationEnabled = $('vibrationEnabledInput').checked;
  state.settings.notificationsEnabled = $('notificationsEnabledInput').checked;

  if (state.settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission !== 'granted') {
        state.settings.notificationsEnabled = false;
        $('notificationsEnabledInput').checked = false;
        saveState();
        showToast('Notifications were not enabled.');
      }
    });
  }
  saveState();
  applySettingsToFocusForm();
  renderAll();
  showToast('Settings saved.');
}

function applySettingsToFocusForm() {
  if (!timer) {
    $('focusMinutesInput').value = state.settings.defaultFocusMinutes;
    $('breakMinutesInput').value = state.settings.defaultBreakMinutes;
    $('roundsInput').value = state.settings.defaultRounds;
    $('autoBreakInput').checked = !!state.settings.autoBreak;
    $('autoNextFocusInput').checked = !!state.settings.autoNextFocus;
    renderTimer();
  }
}

function renderRangeOptions() {
  const select = $('reportRangeSelect');
  if (select.options.length) return;
  for (let i = 1; i <= 14; i += 1) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = String(i);
    if (i === 7) option.selected = true;
    select.appendChild(option);
  }
}

function exportCsv() {
  const rows = [[
    'Date', 'Start Time', 'End Time', 'Category', 'Planned Minutes', 'Actual Minutes', 'Break Minutes', 'Round', 'Rounds', 'Status', 'Note'
  ]];
  state.sessions.forEach(session => {
    rows.push([
      session.date,
      new Date(session.startAt).toLocaleString(),
      session.endAt ? new Date(session.endAt).toLocaleString() : '',
      session.categoryNameSnapshot,
      session.plannedMinutes,
      session.actualMinutes,
      session.breakMinutes,
      session.round,
      session.rounds,
      session.status,
      session.note || ''
    ]);
  });
  downloadBlob(rows.map(row => row.map(csvEscape).join(',')).join('\n'), `focus-sessions-${todayKey()}.csv`, 'text/csv;charset=utf-8');
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportJson() {
  downloadBlob(JSON.stringify(state, null, 2), `focus-targets-backup-${todayKey()}.json`, 'application/json');
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.sessions)) {
        throw new Error('Invalid backup file.');
      }
      state = {
        ...defaultState(),
        ...parsed,
        settings: { ...defaultState().settings, ...(parsed.settings || {}) }
      };
      saveState();
      applyTheme();
      applySettingsToFocusForm();
      renderAll();
      showToast('Backup imported.');
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clearAllData() {
  if (!confirm('Clear all categories, settings, and session history from this device?')) return;
  state = defaultState();
  saveState();
  applyTheme();
  applySettingsToFocusForm();
  renderAll();
  showToast('Data cleared.');
}

function renderAll() {
  renderRangeOptions();
  renderCategorySelect();
  renderToday();
  renderCategories();
  renderReports();
  renderSettings();
  renderTimer();
}

function registerPwa() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Service worker failed', error));
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $('installBtn').classList.remove('hidden');
  });
}

async function handleInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('installBtn').classList.add('hidden');
}

function attachEvents() {
  document.querySelectorAll('[data-nav]').forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.nav));
  });
  $('themeToggle').addEventListener('click', toggleTheme);
  $('installBtn').addEventListener('click', handleInstall);
  $('categoryForm').addEventListener('submit', handleCategorySubmit);
  $('cancelCategoryEditBtn').addEventListener('click', clearCategoryForm);
  $('categoryList').addEventListener('click', handleCategoryActions);
  $('startBtn').addEventListener('click', () => {
    if (timer?.status === 'awaiting-break') beginBreak();
    else if (timer?.status === 'awaiting-focus') beginFocusRound();
    else startTimer();
  });
  $('pauseBtn').addEventListener('click', pauseTimer);
  $('resumeBtn').addEventListener('click', resumeTimer);
  $('resetBtn').addEventListener('click', resetTimer);
  $('savePartialBtn').addEventListener('click', savePartialSession);
  $('discardPartialBtn').addEventListener('click', discardCurrentTimer);
  ['focusMinutesInput', 'roundsInput'].forEach(id => $(id).addEventListener('input', renderTimer));
  $('saveSettingsBtn').addEventListener('click', saveSettings);
  $('testChimeBtn').addEventListener('click', () => alertUser('Test chime', 'This is the timer completion sound.'));
  $('exportCsvBtn').addEventListener('click', exportCsv);
  $('exportJsonBtn').addEventListener('click', exportJson);
  $('importJsonInput').addEventListener('change', importJson);
  $('clearDataBtn').addEventListener('click', clearAllData);
  $('reportRangeSelect').addEventListener('change', renderReports);
}

function init() {
  applyTheme();
  renderRangeOptions();
  attachEvents();
  applySettingsToFocusForm();
  renderAll();
  registerPwa();
}

document.addEventListener('DOMContentLoaded', init);
