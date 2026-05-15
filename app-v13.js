const API_URL = 'https://a2b-api-manual.deva-7b7.workers.dev';
const state = { employee: null, employeePassword: '', manager: null, managerPin: '', locations: [] };

document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => showScreen(button.dataset.screen)));
document.getElementById('syncButton').addEventListener('click', bootstrap);
document.getElementById('employeeLoginForm').addEventListener('submit', employeeLogin);
document.getElementById('hoursForm').addEventListener('submit', submitHours);
document.getElementById('registerForm').addEventListener('submit', registerEmployee);
document.getElementById('managerLoginForm').addEventListener('submit', managerLogin);
document.getElementById('loadEntries').addEventListener('click', loadEntries);
document.getElementById('runReport').addEventListener('click', runReport);
document.getElementById('exportReport').addEventListener('click', exportReport);
document.querySelectorAll('[data-employee-step]').forEach(button => button.addEventListener('click', () => adjustEmployeeTime(button.dataset.employeeStep)));

async function api(action, payload = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Request failed.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(action + ' timed out.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
function message(id, text, kind = '') { const node = document.getElementById(id); node.textContent = text || ''; node.className = 'message ' + kind; }
function busy(form, isBusy) { form.querySelectorAll('button').forEach(button => button.disabled = isBusy); }
function showScreen(id) { document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('active', screen.id === id)); document.querySelectorAll('[data-screen]').forEach(tab => tab.classList.toggle('active', tab.dataset.screen === id)); }
function todayText() { return new Date().toISOString().slice(0, 10); }
function setToday() { document.querySelectorAll('input[type="date"]').forEach(input => { if (!input.value || input.readOnly) input.value = todayText(); }); }
function fillSelect(id, values, blank = false) { const select = document.getElementById(id); select.innerHTML = ''; if (blank) select.add(new Option('Select', '')); values.forEach(value => select.add(new Option(value, value))); }

async function bootstrap() {
  try {
    const result = await api('getBootstrap');
    state.locations = result.locations || [];
    fillSelect('employeeLocation', state.locations, true);
    fillSelect('managerName', result.managerNames || []);
    setToday();
    message('employeeLoginMessage', '', '');
  } catch (error) { message('employeeLoginMessage', error.message, 'err'); }
}

async function employeeLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  busy(form, true);
  message('employeeLoginMessage', 'Checking login...');
  try {
    const data = formData(form);
    const result = await api('loginEmployee', data);
    state.employee = result.employee;
    state.employeePassword = data.password;
    form.classList.add('hidden');
    document.getElementById('hoursForm').classList.remove('hidden');
    message('hoursMessage', '', '');
    setToday();
  } catch (error) { message('employeeLoginMessage', error.message, 'err'); } finally { busy(form, false); }
}

async function submitHours(event) {
  event.preventDefault();
  const form = event.currentTarget;
  busy(form, true);
  message('hoursMessage', 'Submitting shift...');
  try {
    const data = formData(form);
    const payload = {
      ...data,
      username: state.employee.username,
      password: state.employeePassword,
      workDate: todayText(),
      shiftStart: normalizeTime(data.shiftStart),
      shiftClose: normalizeTime(data.shiftClose)
    };
    const result = await api('submitTimeEntry', payload);
    message('hoursMessage', `Submitted for approval: ${Number(result.totalHours).toFixed(2)} hrs`, 'ok');
    form.reset();
    setToday();
  } catch (error) { message('hoursMessage', error.message, 'err'); } finally { busy(form, false); }
}

async function registerEmployee(event) {
  event.preventDefault();
  const form = event.currentTarget;
  busy(form, true);
  message('registerMessage', 'Creating employee...');
  try {
    const result = await api('registerEmployeeCompact', compactRegisterData(form));
    message('registerMessage', `Employee created. Username: ${result.username}`, 'ok');
    form.reset();
    setToday();
  } catch (error) { message('registerMessage', error.message, 'err'); } finally { busy(form, false); }
}

function compactRegisterData(form) {
  const data = formData(form);
  const fields = ['firstName','surname','password','fullName','nickName','homeAddress','mobile','email','emergencyContactName','emergencyPhone','dateOfBirth','taxFileNo','visaDetails','availability','bank','bsb','accountNo','accountName','superFundName','superAbn','spinNo','accountInvestorNo'];
  return { values: fields.map(field => data[field] || '') };
}

async function managerLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  busy(form, true);
  message('managerLoginMessage', 'Checking manager login...');
  try {
    const data = formData(form);
    const result = await api('managerLogin', data);
    state.manager = result.manager;
    state.managerPin = data.pin;
    form.classList.add('hidden');
    document.getElementById('managerWorkspace').classList.remove('hidden');
    message('managerMessage', `Logged in as ${result.manager}.`, 'ok');
    await loadEntries();
  } catch (error) { message('managerLoginMessage', error.message, 'err'); } finally { busy(form, false); }
}

function managerPayload(extra = {}) {
  return {
    name: state.manager,
    pin: state.managerPin,
    filters: {
      status: document.getElementById('statusFilter').value,
      fromDate: document.getElementById('fromDate').value,
      toDate: document.getElementById('toDate').value,
      username: document.getElementById('employeeFilter').value,
      period: document.getElementById('reportPeriod').value
    },
    ...extra
  };
}

async function loadEntries() {
  message('managerMessage', 'Loading entries...');
  try {
    const result = await api('managerGetEntries', managerPayload());
    renderEntries(result.entries || []);
    message('managerMessage', `${(result.entries || []).length} entries loaded.`, 'ok');
  } catch (error) { message('managerMessage', error.message, 'err'); }
}

function renderEntries(entries) {
  const list = document.getElementById('entriesList');
  list.innerHTML = entries.length ? '' : '<article class="card">No entries found.</article>';
  entries.forEach(entry => {
    const card = document.createElement('article');
    card.className = 'card review-card';
    card.innerHTML = `
      <div class="review-top"><strong>Name ${escapeHtml(entry.employeeName)}</strong><select data-field="status"><option ${entry.status === 'Pending' ? 'selected' : ''}>Pending</option><option ${entry.status === 'Approved' ? 'selected' : ''}>Approved</option><option ${entry.status === 'Rejected' ? 'selected' : ''}>Rejected</option></select></div>
      <div class="review-time"><span>ST</span><button type="button" data-step="shiftStart:-1">-</button><input data-field="shiftStart" value="${escapeHtml(formatClock(entry.shiftStart))}"><button type="button" data-step="shiftStart:1">+</button><span>FT</span><button type="button" data-step="shiftClose:-1">-</button><input data-field="shiftClose" value="${escapeHtml(formatClock(entry.shiftClose))}"><button type="button" data-step="shiftClose:1">+</button><output>${Number(entry.totalHours).toFixed(2)} hrs</output><button type="button" class="primary" data-save>Save</button></div>
      <label>Notes<textarea data-field="managerNotes">${escapeHtml(entry.managerNotes)}</textarea></label>
      <input type="hidden" data-field="workDate" value="${escapeHtml(entry.workDate)}"><input type="hidden" data-field="location" value="${escapeHtml(entry.location)}">
      <div class="meta">${escapeHtml(entry.username)} | ${escapeHtml(entry.workDate)} | ${escapeHtml(entry.location)}</div>
    `;
    card.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => adjustTime(card, button.dataset.step)));
    card.querySelector('[data-save]').addEventListener('click', () => saveEntry(entry, card));
    list.appendChild(card);
  });
}

function adjustEmployeeTime(spec) {
  const [name, amount] = spec.split(':');
  const input = document.querySelector(`[name="${name}"]`);
  input.value = formatClock(addMinutes(input.value, Number(amount)));
}

function adjustTime(card, spec) {
  const [field, amount] = spec.split(':');
  const input = card.querySelector(`[data-field="${field}"]`);
  input.value = formatClock(addMinutes(input.value, Number(amount)));
}

function normalizeTime(value) {
  const text = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  let match = text.match(/^(\d{1,2}):(\d{2})(am|pm)?$/);
  if (!match) match = text.match(/^(\d{1,2})(\d{2})(am|pm)?$/);
  if (!match) throw new Error('Please enter time like 11:03 AM.');
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const marker = match[3] || '';
  if (minute > 59 || hour > 23 || hour < 0) throw new Error('Please enter a valid time.');
  if (marker === 'pm' && hour < 12) hour += 12;
  if (marker === 'am' && hour === 12) hour = 0;
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

function addMinutes(value, amount) {
  const base = normalizeTime(value || formatClock(new Date().toTimeString().slice(0, 5)));
  const parts = base.split(':');
  const minutes = (Number(parts[0]) * 60 + Number(parts[1]) + amount + 1440) % 1440;
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

function formatClock(value) {
  const time = normalizeTime(value);
  const parts = time.split(':');
  const hour = Number(parts[0]);
  const displayHour = hour % 12 || 12;
  return displayHour + ':' + parts[1] + ' ' + (hour >= 12 ? 'PM' : 'AM');
}

async function saveEntry(entry, card) {
  const payload = { entryId: entry.entryId };
  card.querySelectorAll('[data-field]').forEach(field => payload[field.dataset.field] = field.value);
  try {
    payload.shiftStart = normalizeTime(payload.shiftStart);
    payload.shiftClose = normalizeTime(payload.shiftClose);
  } catch (error) {
    message('managerMessage', error.message, 'err');
    return;
  }
  message('managerMessage', 'Saving entry...');
  try { await api('managerUpdateEntry', managerPayload({ entry: payload })); message('managerMessage', 'Entry saved.', 'ok'); await loadEntries(); }
  catch (error) { message('managerMessage', error.message, 'err'); }
}

async function runReport() {
  message('reportMessage', 'Running report...');
  try {
    const result = await api('managerReport', managerPayload());
    const rows = result.rows || [];
    const list = document.getElementById('reportList');
    list.innerHTML = rows.length ? '' : '<article class="card">No approved hours found.</article>';
    rows.forEach(row => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `<div class="card-title"><span>${escapeHtml(row.employeeName)}</span><span>${escapeHtml(row.hoursText)}</span></div><div class="meta">${escapeHtml(row.username)} | ${escapeHtml(row.period)} | ${row.shifts} shifts</div>`;
      list.appendChild(card);
    });
    message('reportMessage', `${rows.length} report rows.`, 'ok');
  } catch (error) { message('reportMessage', error.message, 'err'); }
}

async function exportReport() {
  message('reportMessage', 'Creating Excel file...');
  try { const result = await api('exportReportToExcel', managerPayload()); message('reportMessage', `Created: ${result.name}`, 'ok'); window.open(result.url, '_blank'); }
  catch (error) { message('reportMessage', error.message, 'err'); }
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
bootstrap();
