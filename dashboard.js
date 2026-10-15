const { supabaseUrl, supabaseKey, adminEmail } = window.QUIZ_CONFIG;
const db = window.supabase.createClient(supabaseUrl, supabaseKey);
const root = document.querySelector('#dashboard');
function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value ?? ''; return el.innerHTML; }
function stationScore(points) { return points == null ? '<span title="Stanoviště zatím není dokončené" aria-label="Stanoviště zatím není dokončené">—</span>' : `${Number(points)} b.`; }
async function loadDashboard() {
  const { data: { session } } = await db.auth.getSession();
  if (!session || session.user.email?.toLowerCase() !== adminEmail) { location.href = 'admin.html'; return; }
  const { data: players, error } = await db.rpc('admin_list_participants');
  if (error) { root.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`; return; }
  const leaderboard = [...players].sort((a, b) => b.points - a.points || b.answered - a.answered || a.nickname.localeCompare(b.nickname, 'cs'));
  const totalAnswers = players.reduce((sum, player) => sum + Number(player.answered || 0), 0);
  root.innerHTML = `<div class="stats"><article><strong>${players.length}</strong><span>hráčů</span></article><article><strong>${totalAnswers}</strong><span>odpovědí a tipů</span></article></div><h2>Aktuální pořadí</h2><p class="muted">— = stanoviště zatím není dokončené · 0 b. = dokončené bez bodů</p>${leaderboard.length ? `<div class="leaderboard-wrap"><table class="leaderboard-table"><thead><tr><th>#</th><th>Soutěžící</th><th>Stan. 1</th><th>Stan. 2</th><th>Stan. 3</th><th>Finále</th><th>Celkem</th><th>Tip</th></tr></thead><tbody>${leaderboard.map((player, index) => `<tr><td class="rank">${index + 1}.</td><th scope="row">${escapeHtml(player.nickname)}</th><td>${stationScore(player.station_1_points)}</td><td>${stationScore(player.station_2_points)}</td><td>${stationScore(player.station_3_points)}</td><td>${stationScore(player.station_4_points)}</td><td><strong>${player.points} b.</strong></td><td>${player.station_4_guess == null ? '—' : `${player.station_4_guess} min`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Zatím žádní hráči.</p>' }`;
}
db.auth.onAuthStateChange(() => loadDashboard());
loadDashboard();
