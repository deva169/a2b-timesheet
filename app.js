const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzI2TMVFKOZotCW4Or2qSlCrvsML7Mn5EDyjyRB3oA4ktqqNzMxoWYpTlS-n1C9RXkHNg/exec';

const state = {
  employee: null,
  employeePassword: '',
  manager: null,
  managerPin: '',
  locations: []
};

document.querySelectorAll('[data-screen]').forEach(button => {
  button.addEventListener('click', () => showScreen(button.dataset.screen));
});

document.getElementById('syncButton').addEventListener('click', bootstrap);
document.getElementById('employeeLoginForm').addEventListener('submit', employeeLogin);
document.getElementById('hoursForm').addEventListener('submit', submitHours);
document.getElementById('registerForm').addEventListener('submit', registerEmployee);
document.getElementById('managerLoginForm').addEventListener('submit', managerLogin);
document.getElementById('loadEntries').addEventListener('click', loadEntries);
document.getElementById('runReport').addEventListener('click', runReport);
document.getElementById('exportReport').addEventListener('click', exportReport);

function api(action, payload = {}) {
  const callback = 'a2b_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('callback', callback);
  url.searchParams.set('payload', JSON.stringify(payload));
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => cleanup(new Error('Request timed out.')), 30000);
    window[callback] = response => {
      if (response && response.ok) cleanup(null, response);
      else cleanup(new Error((response && response.error) || 'Request failed.'));
    };
    function cleanup(error, response) {
      clearTimeout(timeout);
      delete window[callback];
      script.remove();
      error ? reject(error) : resolve(response);
    }
    script.onerror = () => cleanup(new Error('Could not reach the Apps Script backend.'));
    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function postApi(action, payload = {}) {
  const requestId = 'post_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const iframeName = 'frame_' + requestId;
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.className = 'hidden';
    const form = document.createElement('form');
    form.method = 'post';
    form.action = APPS_SCRIPT_URL;
    form.target = iframeName;
    form.className = 'hidden';
    addHidden(form, 'action', action);
    addHidden(form, 'requestId', requestId);
    addHidden(form, 'payload', JSON.stringify(payload));
    const timeout = setTimeout(() => cleanup(new Error('Request timed out.')), 45000);
    function onMessage(event) {
      let response = event.data;
      if (typeof response === 'string') {
        try { response = JSON.parse(response); } catch (error) { return; }
      }
      if (!response || response.requestId !== requestId) return;
      if (response.ok) cleanup(null, response);
      else cleanup(new Error(response.error || 'Request failed.'));
    }
    function cleanup(error, response) {
      clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      form.remove();
      iframe.remove();
      error ? reject(error) : resolve(response);
    }
    window.addEventListener('message', onMessage);
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
  });
}

function addHidden(form, name, value) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function message(id, text, kind = '') {
