const { supabaseUrl, supabaseKey } = window.QUIZ_CONFIG;
const db = window.supabase.createClient(supabaseUrl, supabaseKey);
const params = new URLSearchParams(location.search);
const heading = document.querySelector('#heading');
const description = document.querySelector('#description');
const game = document.querySelector('#game');
const tokenFromUrl = params.get('player');
if (tokenFromUrl) localStorage.setItem('vanocni-player-token', tokenFromUrl);
const playerToken = tokenFromUrl || localStorage.getItem('vanocni-player-token');
const station = params.get('station');

function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value ?? ''; return el.innerHTML; }
async function rpc(name, args) { const { data, error } = await db.rpc(name, args); if (error) throw error; return data; }
async function boot() {
  if (!playerToken) { heading.textContent = 'Nejdřív osobní QR kód'; description.textContent = 'Naskenujte svůj osobní QR kód. Do tohoto telefonu se bezpečně uloží vaše přezdívka pro celé hraní.'; game.innerHTML = '<p class="notice">Potom můžete u jednotlivých stanovišť načítat společné QR kódy.</p>'; return; }
  try { const player = await rpc('start_quiz', { p_qr_token: playerToken }); description.textContent = `Hraje ${player[0].nickname}.`; if (!station) { heading.textContent = `Vítej, ${player[0].nickname}!`; description.textContent = 'Úspěšně jste zapsáni do hry.'; game.innerHTML = '<p class="notice">Teď načti QR kód prvního stanoviště.</p>'; return; } } catch (error) { heading.textContent = 'Tento QR kód už není platný'; description.textContent = error.message; return; }
  heading.textContent = 'Stanoviště';
  try { const questions = await rpc('get_station_questions', { p_qr_token: playerToken, p_station_slug: station }); if (!questions.length) { game.innerHTML = '<p class="notice">Otázky pro toto stanoviště ještě nejsou vložené.</p>'; return; } showQuestion(questions, 0); } catch (error) { game.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; }
}
function showQuestion(questions, index) {
  const q = questions[index];
  game.innerHTML = `<p class="muted">Otázka ${index + 1} z ${questions.length}</p><p class="question">${escapeHtml(q.question_text)}</p><div class="options">${q.answer_options.map((answer, answerIndex) => `<button data-answer="${answerIndex + 1}">${escapeHtml(answer)}</button>`).join('')}</div>`;
  game.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', async () => { game.querySelectorAll('button').forEach(item => item.disabled = true); try { const result = await rpc('submit_answer', { p_qr_token: playerToken, p_question_id: q.id, p_selected_option: Number(button.dataset.answer) }); const good = result[0].is_correct; game.innerHTML = `<p class="${good ? 'success' : 'error'}">${good ? 'Správně!' : 'Tentokrát ne.'}</p><p>Celkem máte ${result[0].total_points} bodů.</p><button class="primary">${index + 1 === questions.length ? 'Dokončit stanoviště' : 'Další otázka'}</button>`; game.querySelector('button').addEventListener('click', () => index + 1 === questions.length ? (location.href = location.pathname) : showQuestion(questions, index + 1)); } catch (error) { game.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; } }));
}
boot();
