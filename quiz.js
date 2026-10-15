const { supabaseUrl, supabaseKey } = window.QUIZ_CONFIG;
const db = window.supabase.createClient(supabaseUrl, supabaseKey);
const params = new URLSearchParams(location.search);
const heading = document.querySelector('#heading');
const description = document.querySelector('#description');
const game = document.querySelector('#game');
const scoreValue = document.querySelector('#score-value');
const tokenFromUrl = params.get('player');
let storageUnavailable = false;
function readStorage(key) { try { return localStorage.getItem(key); } catch { storageUnavailable = true; return null; } }
function writeStorage(key, value) { try { localStorage.setItem(key, value); if (localStorage.getItem(key) !== value) storageUnavailable = true; } catch { storageUnavailable = true; } }
const storedPlayerToken = readStorage('vanocni-player-token');
const playerToken = tokenFromUrl || storedPlayerToken;
const station = params.get('station');
let deviceId = readStorage('vanocni-device-id');
if (!deviceId) deviceId = crypto.randomUUID();
writeStorage('vanocni-device-id', deviceId);
function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value ?? ''; return el.innerHTML; }
async function rpc(name, args) { const { data, error } = await db.rpc(name, args); if (error) throw error; return data; }
function setScore(points) { scoreValue.textContent = Number(points || 0); }async function loadScore() { const score = await rpc('get_player_score', { p_qr_token: playerToken }); setScore(score[0]?.total_points); }
async function loadProgress() { const progress = await rpc('get_player_progress', { p_qr_token: playerToken }); return progress[0]; }
async function activatePlayer() { const player = await rpc('activate_player', { p_qr_token: playerToken, p_device_id: deviceId }); if (tokenFromUrl) writeStorage('vanocni-player-token', tokenFromUrl); return player; }
async function boot() {
  if (storageUnavailable) { scoreValue.closest('.score-counter').hidden = true; heading.textContent = 'Otevři hru v běžném prohlížeči'; description.textContent = 'Tento prohlížeč nedovoluje uložit přihlášení. Otevři osobní QR odkaz v běžném Safari nebo Chromu a povol ukládání dat webu.'; return; }
  if (!playerToken) { scoreValue.closest('.score-counter').hidden = true; heading.textContent = 'Nejdřív osobní QR kód'; description.textContent = 'Naskenujte svůj osobní QR kód. Do tohoto telefonu se bezpečně uloží vaše přezdívka pro celé hraní.'; game.innerHTML = '<p class="notice">Otevři osobní odkaz v běžném Safari nebo Chromu. Stanoviště potom načítej tlačítkem přímo ve hře, aby přihlášení zůstalo zachované.</p><button type="button" class="primary" data-scan-mode="player">Načíst osobní QR</button>'; return; }
  let player;
  try { player = await activatePlayer(); await loadScore(); description.textContent = `Hraje ${player[0].nickname}.`; } catch (error) { scoreValue.closest('.score-counter').hidden = true; heading.textContent = 'Tento QR kód už není platný'; description.textContent = error.message; return; }
  if (!station) { const progress = await loadProgress(); heading.textContent = `Vítej, ${player[0].nickname}!`; description.textContent = 'Úspěšně jste zapsáni do hry.'; game.innerHTML = `<section class="stats" aria-label="Tvůj postup ve hře"><article><strong>${progress.completed_stations}</strong><span>splněná stanoviště</span></article><article><strong>${progress.total_points}</strong><span>bodů</span></article><article><strong>${progress.remaining_stations}</strong><span>ještě neobjevená</span></article></section><p class="notice">Hledej QR kód s otázkami. Načti ho tlačítkem přímo tady ve hře.</p><button type="button" class="primary" data-scan-mode="station">Načíst QR stanoviště</button>`; return; }
  if (station === 'stanoviste-4') { showNumericGuess(); return; }
  heading.textContent = 'Stanoviště';
  try { const questions = await rpc('get_station_questions', { p_qr_token: playerToken, p_station_slug: station }); if (!questions.length) { game.innerHTML = '<p class="notice">Otázky pro toto stanoviště ještě nejsou vložené.</p>'; return; } showQuestion(questions, 0); } catch (error) { game.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }
}
function showNumericGuess() {
  heading.textContent = 'Finále – číselný tip'; description.textContent = 'Tipni si a získej až tři body.';
  game.innerHTML = '<p class="question">Kolik minut má film Sám doma?</p><p class="muted">Zapiš celé číslo od 1 do 500. Přesný tip má 3 body, rozdíl do 2 minut 2 body a do 5 minut 1 bod.</p><form id="numeric-guess"><label>Tvůj tip v minutách<input name="guess" type="number" min="1" max="500" required inputmode="numeric"></label><button class="primary">Potvrdit tip</button></form>';
  game.querySelector('#numeric-guess').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const guess = Number(new FormData(form).get('guess')); form.querySelector('button').disabled = true; try { const result = await rpc('submit_numeric_guess', { p_qr_token: playerToken, p_guess: guess }); const outcome = result[0]; setScore(outcome.total_points); game.innerHTML = `<p class="success">Tip je uložený.</p><p>Za finále získáváš ${outcome.points_awarded} ${outcome.points_awarded === 1 ? 'bod' : outcome.points_awarded < 5 ? 'body' : 'bodů'}.</p><p>Celkem máte ${outcome.total_points} bodů.</p><div class="station-complete"><strong>Stanoviště 4 je dokončeno.</strong><span>Gratulujeme, došli jste do cíle.</span></div><button class="primary">Zpět na úvod</button><button type="button" data-scan-mode="station">Načíst další stanoviště</button>`; game.querySelector('button').addEventListener('click', () => { location.href = location.pathname; }); } catch (error) { game.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; } });
}
function showQuestion(questions, index) {
  const q = questions[index]; const image = q.image_url ? `<img class="question-image" src="${escapeHtml(q.image_url)}" alt="Ilustrační obrázek k otázce">` : '';
  game.innerHTML = `<p class="muted">Otázka ${index + 1} z ${questions.length}</p>${image}<p class="question">${escapeHtml(q.question_text)}</p><div class="options">${q.answer_options.map((answer, answerIndex) => `<button data-answer="${answerIndex + 1}">${escapeHtml(answer)}</button>`).join('')}</div>`;
  game.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', async () => { game.querySelectorAll('button').forEach(item => item.disabled = true); try { const result = await rpc('submit_answer', { p_qr_token: playerToken, p_question_id: q.id, p_selected_option: Number(button.dataset.answer) }); const good = result[0].is_correct; const finished = index + 1 === questions.length; const stationName = station.replace('stanoviste-', 'Stanoviště '); setScore(result[0].total_points); game.innerHTML = `<p class="${good ? 'success' : 'error'}">${good ? 'Správně!' : 'Tentokrát ne.'}</p><p>Celkem máte ${result[0].total_points} bodů.</p>${finished ? `<div class="station-complete"><strong>${escapeHtml(stationName)} je dokončeno.</strong><span>Můžeš pátrat po dalším stanovišti.</span></div>` : ''}<button class="primary">${finished ? 'Zpět na úvod' : 'Další otázka'}</button>${finished ? '<button type="button" data-scan-mode="station">Načíst další stanoviště</button>' : ''}`; game.querySelector('button').addEventListener('click', () => finished ? (location.href = location.pathname) : showQuestion(questions, index + 1)); } catch (error) { game.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; } }));
}
function parseQuizQr(value, mode) {
  const url = new URL(value);
  const base = new URL('.', location.href);
  if (url.origin !== base.origin || ![base.pathname, `${base.pathname}index.html`].includes(url.pathname) || url.username || url.password) throw new Error('Tento QR kód nepatří k tomuto kvízu.');
  const target = new URL('index.html', base);
  if (mode === 'player') {
    const token = url.searchParams.get('player');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || '')) throw new Error('Načti svůj osobní QR kód hráče, ne kód stanoviště.');
    target.searchParams.set('player', token);
    if (station) target.searchParams.set('station', station);
  } else {
    const slug = url.searchParams.get('station');
    if (!/^stanoviste-[1-9]\d*$/.test(slug || '') || url.searchParams.has('player')) throw new Error('Načti společný QR kód stanoviště, ne osobní QR hráče.');
    target.searchParams.set('station', slug);
  }
  return target.href;
}
let qrLibrary;
let closeCurrentScanner;
function loadQrLibrary() {
  if (!qrLibrary) qrLibrary = import('https://cdn.jsdelivr.net/npm/qr-scanner@1.4.2/qr-scanner.min.js').then(module => module.default).catch(error => { qrLibrary = null; throw error; });
  return qrLibrary;
}
async function openQrScanner(mode) {
  if (closeCurrentScanner) return;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'qr-title');
  dialog.style.cssText = 'width:min(94vw,32rem);max-height:90vh;overflow:auto;border:1px solid var(--line);border-radius:1rem;padding:1.25rem;color:var(--ink);background:white;';
  dialog.innerHTML = `<h2 id="qr-title">${mode === 'player' ? 'Načíst osobní QR' : 'Načíst QR stanoviště'}</h2><p>Namiř zadní kameru na QR kód. Fotografii zpracuje přímo tvůj prohlížeč.</p><video playsinline muted style="display:none;width:100%;max-height:45vh;border-radius:.75rem;object-fit:cover" aria-label="Náhled kamery"></video><p role="status" id="qr-status">Spusť kameru nebo vyber fotografii QR kódu.</p><div style="display:grid;gap:.75rem"><button type="button" class="primary" id="qr-camera">Spustit kameru</button><label>Vyfotit nebo vybrat QR kód<input type="file" accept="image/*" capture="environment" id="qr-image"></label><button type="button" id="qr-close">Zavřít</button></div>`;
  document.body.append(dialog);
  const video = dialog.querySelector('video');
  const status = dialog.querySelector('#qr-status');
  const cameraButton = dialog.querySelector('#qr-camera');
  const imageInput = dialog.querySelector('#qr-image');
  let scanner;
  let closed = false;
  let navigating = false;
  let imageBusy = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scanner?.destroy();
    dialog.close();
    dialog.remove();
    closeCurrentScanner = null;
  };
  closeCurrentScanner = close;
  const accept = result => {
    if (closed || navigating || imageBusy) return;
    try {
      const target = parseQuizQr(result.data, mode);
      navigating = true;
      close();
      location.assign(target);
    } catch (error) { status.textContent = error.message; }
  };
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.querySelector('#qr-close').addEventListener('click', close);
  dialog.showModal();
  cameraButton.addEventListener('click', async () => {
    cameraButton.disabled = true;
    status.textContent = 'Připravuji kameru…';
    try {
      const QrScanner = await loadQrLibrary();
      if (closed) return;
      if (!scanner) scanner = new QrScanner(video, accept, { preferredCamera: 'environment', maxScansPerSecond: 8, returnDetailedScanResult: true });
      video.style.display = 'block';
      await scanner.start();
      if (closed) { scanner.destroy(); return; }
      status.textContent = 'Namiř kameru na QR kód.';
      cameraButton.textContent = 'Kamera je zapnutá';
    } catch {
      if (closed) return;
      scanner?.stop();
      video.style.display = 'none';
      status.textContent = 'Kameru se nepodařilo spustit. Povol k ní přístup, nebo použij fotografii QR kódu níže.';
      cameraButton.disabled = false;
      cameraButton.textContent = 'Zkusit kameru znovu';
    }
  });
  imageInput.addEventListener('change', async () => {
    const file = imageInput.files?.[0];
    if (!file || imageBusy) return;
    imageBusy = true;
    scanner?.stop();
    cameraButton.disabled = false;
    cameraButton.textContent = 'Spustit kameru';
    imageInput.disabled = true;
    status.textContent = 'Čtu QR kód z fotografie…';
    try {
      const QrScanner = await loadQrLibrary();
      if (closed) return;
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      imageBusy = false;
      accept(result);
    } catch { if (!closed) status.textContent = 'QR kód se nepodařilo přečíst. Vyber ostřejší fotografii s celým QR kódem.'; }
    finally { imageBusy = false; imageInput.disabled = false; imageInput.value = ''; }
  });
}
game.addEventListener('click', event => {
  const button = event.target.closest('[data-scan-mode]');
  if (button && game.contains(button)) openQrScanner(button.dataset.scanMode);
});
window.addEventListener('pagehide', () => closeCurrentScanner?.());
boot().catch(() => { heading.textContent = 'Hru se nepodařilo načíst'; description.textContent = 'Zkontroluj připojení a obnov stránku. Přihlášení i uložené odpovědi zůstanou zachované.'; });
