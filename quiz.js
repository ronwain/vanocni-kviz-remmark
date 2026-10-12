const { supabaseUrl, supabaseKey } = window.QUIZ_CONFIG;
const db = window.supabase.createClient(supabaseUrl, supabaseKey);
const params = new URLSearchParams(location.search);
const heading = document.querySelector('#heading');
const description = document.querySelector('#description');
const game = document.querySelector('#game');
const scoreValue = document.querySelector('#score-value');
const tokenFromUrl = params.get('player');
const storedPlayerToken = localStorage.getItem('vanocni-player-token');
const playerToken = tokenFromUrl || storedPlayerToken;
const station = params.get('station');
let deviceId = localStorage.getItem('vanocni-device-id');
if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem('vanocni-device-id', deviceId); }
function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value ?? ''; return el.innerHTML; }
async function rpc(name, args) { const { data, error } = await db.rpc(name, args); if (error) throw error; return data; }
function setScore(points) { scoreValue.textContent = Number(points || 0); }
async function loadScore() { const score = await rpc('get_player_score', { p_qr_token: playerToken }); setScore(score[0]?.total_points); }
async function activatePlayer() { const player = await rpc('activate_player', { p_qr_token: playerToken, p_device_id: deviceId }); if (tokenFromUrl) localStorage.setItem('vanocni-player-token', tokenFromUrl); return player; }
async function boot() {
  if (!playerToken) { scoreValue.closest('.score-counter').hidden = true; heading.textContent = 'Nejdřív osobní QR kód'; description.textContent = 'Naskenujte svůj osobní QR kód. Do tohoto telefonu se bezpečně uloží vaše přezdívka pro celé hraní.'; game.innerHTML = '<p class="notice">Potom můžete u jednotlivých stanovišť načítat společné QR kódy.</p>'; return; }
  let player;
  try { player = await activatePlayer(); await loadScore(); description.textContent = `Hraje ${player[0].nickname}.`; } catch (error) { scoreValue.closest('.score-counter').hidden = true; heading.textContent = 'Tento QR kód už není platný'; description.textContent = error.message; return; }
  if (!station) { heading.textContent = `Vítej, ${player[0].nickname}!`; description.textContent = 'Úspěšně jste zapsáni do hry.'; game.innerHTML = '<p class="notice">Teď načti QR kód prvního stanoviště.</p>'; return; }
  if (station === 'stanoviste-4') { showNumericGuess(); return; }
  heading.textContent = 'Stanoviště';
  try { const questions = await rpc('get_station_questions', { p_qr_token: playerToken, p_station_slug: station }); if (!questions.length) { game.innerHTML = '<p class="notice">Otázky pro toto stanoviště ještě nejsou vložené.</p>'; return; } showQuestion(questions, 0); } catch (error) { game.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }
}
function showNumericGuess() {
  heading.textContent = 'Finále – číselný tip'; description.textContent = 'Tipni si a získej až tři body.';
  game.innerHTML = '<p class="question">Kolik minut má film Sám doma?</p><p class="muted">Zapiš celé číslo od 1 do 500. Přesný tip má 3 body, rozdíl do 2 minut 2 body a do 5 minut 1 bod.</p><form id="numeric-guess"><label>Tvůj tip v minutách<input name="guess" type="number" min="1" max="500" required inputmode="numeric"></label><button class="primary">Potvrdit tip</button></form>';
  game.querySelector('#numeric-guess').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const guess = Number(new FormData(form).get('guess')); form.querySelector('button').disabled = true; try { const result = await rpc('submit_numeric_guess', { p_qr_token: playerToken, p_guess: guess }); const outcome = result[0]; setScore(outcome.total_points); game.innerHTML = `<p class="success">Tip je uložený.</p><p>Za finále získáváš ${outcome.points_awarded} ${outcome.points_awarded === 1 ? 'bod' : outcome.points_awarded < 5 ? 'body' : 'bodů'}.</p><p>Celkem máte ${outcome.total_points} bodů.</p><div class="station-complete"><strong>Stanoviště 4 je dokončeno.</strong><span>Gratulujeme, došli jste do cíle.</span></div><button class="primary">Zpět na úvod</button>`; game.querySelector('button').addEventListener('click', () => { location.href = location.pathname; }); } catch (error) { game.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; } });
}
function showQuestion(questions, index) {
  const q = questions[index]; const image = q.image_url ? `<img class="question-image" src="${escapeHtml(q.image_url)}" alt="Ilustrační obrázek k otázce">` : '';
  game.innerHTML = `<p class="muted">Otázka ${index + 1} z ${questions.length}</p>${image}<p class="question">${escapeHtml(q.question_text)}</p><div class="options">${q.answer_options.map((answer, answerIndex) => `<button data-answer="${answerIndex + 1}">${escapeHtml(answer)}</button>`).join('')}</div>`;
  game.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', async () => { game.querySelectorAll('button').forEach(item => item.disabled = true); try { const result = await rpc('submit_answer', { p_qr_token: playerToken, p_question_id: q.id, p_selected_option: Number(button.dataset.answer) }); const good = result[0].is_correct; const finished = index + 1 === questions.length; const stationName = station.replace('stanoviste-', 'Stanoviště '); setScore(result[0].total_points); game.innerHTML = `<p class="${good ? 'success' : 'error'}">${good ? 'Správně!' : 'Tentokrát ne.'}</p><p>Celkem máte ${result[0].total_points} bodů.</p>${finished ? `<div class="station-complete"><strong>${escapeHtml(stationName)} je dokončeno.</strong><span>Můžeš pátrat po dalším stanovišti.</span></div>` : ''}<button class="primary">${finished ? 'Zpět na úvod' : 'Další otázka'}</button>`; game.querySelector('button').addEventListener('click', () => finished ? (location.href = location.pathname) : showQuestion(questions, index + 1)); } catch (error) { game.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; } }));
}
boot();
