const api = window.catGatekeeper;

const els = {
  statusLine: document.getElementById('statusLine'),
  startButton: document.getElementById('startButton'),
  stopButton: document.getElementById('stopButton'),
  testButton: document.getElementById('testButton'),
  resetButton: document.getElementById('resetButton'),
  saveButton: document.getElementById('saveButton'),
  useActiveButton: document.getElementById('useActiveButton'),
  addButton: document.getElementById('addButton'),
  activeApp: document.getElementById('activeApp'),
  breakMinutesInput: document.getElementById('breakMinutesInput'),
  animalSelect: document.getElementById('animalSelect'),
  processInput: document.getElementById('processInput'),
  minutesInput: document.getElementById('minutesInput'),
  descriptionInput: document.getElementById('descriptionInput'),
  appsBody: document.getElementById('appsBody'),
  logOutput: document.getElementById('logOutput')
};

let animals = [];
let config = { breakMinutes: 5, animal: 'blue_cat', apps: [] };
let state = {
  activeApp: 'unknown',
  tracking: false,
  resting: false,
  usageSeconds: {}
};

function safeMinutes(value, fallback = 30) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
}

function formatSeconds(totalSeconds) {
  const seconds = Math.max(0, Number.parseInt(totalSeconds || 0, 10));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function renderAnimals() {
  els.animalSelect.innerHTML = '';
  for (const animal of animals) {
    const option = document.createElement('option');
    option.value = animal.id;
    option.textContent = animal.label;
    els.animalSelect.append(option);
  }
}

function renderConfig() {
  els.breakMinutesInput.value = String(config.breakMinutes);
  els.animalSelect.value = config.animal;
  renderApps();
}

function renderState() {
  els.activeApp.textContent = state.activeApp || 'unknown';
  const mode = state.resting ? 'Break running' : (state.tracking ? 'Running' : 'Stopped');
  els.statusLine.textContent = `${mode} · ${state.activeApp || 'unknown'}`;
  els.startButton.disabled = state.tracking || state.resting;
  els.stopButton.disabled = !state.tracking;
  renderApps();
}

function renderApps() {
  els.appsBody.innerHTML = '';

  if (!config.apps.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'empty';
    cell.colSpan = 5;
    cell.textContent = 'No tracked apps yet.';
    row.append(cell);
    els.appsBody.append(row);
    return;
  }

  for (const appConfig of config.apps) {
    const row = document.createElement('tr');
    const used = state.usageSeconds && state.usageSeconds[appConfig.processName];

    row.innerHTML = `
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td><button class="danger" type="button" data-remove="">Remove</button></td>
    `;
    row.children[0].textContent = appConfig.processName;
    row.children[1].textContent = `${appConfig.timeLimitMinutes}m`;
    row.children[2].textContent = formatSeconds(used || 0);
    row.children[3].textContent = appConfig.description || '';
    row.querySelector('button').dataset.remove = appConfig.processName;
    els.appsBody.append(row);
  }
}

function appendLog(line) {
  const timestamp = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  els.logOutput.textContent += `[${timestamp}] ${line}\n`;
  els.logOutput.scrollTop = els.logOutput.scrollHeight;
}

async function saveFromInputs() {
  config = await api.saveConfig({
    breakMinutes: safeMinutes(els.breakMinutesInput.value, config.breakMinutes),
    animal: els.animalSelect.value,
    apps: config.apps
  });
  renderConfig();
  return config;
}

els.saveButton.addEventListener('click', async () => {
  await saveFromInputs();
  appendLog('Settings saved.');
});

els.startButton.addEventListener('click', async () => {
  await saveFromInputs();
  await api.start();
});

els.stopButton.addEventListener('click', () => api.stop());
els.resetButton.addEventListener('click', () => api.reset());

els.testButton.addEventListener('click', async () => {
  await saveFromInputs();
  await api.testOverlay(els.animalSelect.value);
});

els.useActiveButton.addEventListener('click', async () => {
  const result = await api.getActive();
  if (result && result.name && result.name !== 'unknown') {
    els.processInput.value = result.name;
    els.minutesInput.value = els.minutesInput.value || '30';
  }
});

els.addButton.addEventListener('click', async () => {
  const processName = els.processInput.value.trim();
  if (!processName) return;

  config.apps = config.apps.filter((item) => item.processName !== processName);
  config.apps.push({
    processName,
    timeLimitMinutes: safeMinutes(els.minutesInput.value, 30),
    description: els.descriptionInput.value.trim()
  });
  await saveFromInputs();
  els.processInput.value = '';
  els.descriptionInput.value = '';
  renderApps();
});

els.appsBody.addEventListener('click', async (event) => {
  const processName = event.target && event.target.dataset && event.target.dataset.remove;
  if (!processName) return;
  config.apps = config.apps.filter((item) => item.processName !== processName);
  await saveFromInputs();
});

api.onState((nextState) => {
  state = nextState;
  config = nextState.config || config;
  renderState();
});

api.onLog(appendLog);

async function init() {
  const initial = await api.getInitial();
  animals = initial.animals;
  config = initial.config;
  state = initial.state;
  renderAnimals();
  renderConfig();
  renderState();
}

init();
