const { supabaseUrl, supabaseKey, adminEmail } = window.QUIZ_CONFIG;
const db = window.supabase.createClient(supabaseUrl, supabaseKey);
const root = document.querySelector('#dashboard');
const status = document.querySelector('#dashboard-status');
const refreshInterval = 10_000;
const requestTimeout = 8_000;
const clock = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
let loading = false;
let lastMarkup;
let lastUpdatedAt;
function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value ?? ''; return el.innerHTML; }
function stationScore(points) { return points == null ? '<span title="Stanoviště zatím není dokončené" aria-label="Stanoviště zatím není dokončené">—</span>' : `${Number(points)} b.`; }
async function loadDashboard() {
  if (loading) return;
  loading = true;
  let timeout;
  try {
    const { data: { session }, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session || session.user.email?.toLowerCase() !== adminEmail) {
      location.href = 'admin.html';
      return;
    }

    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), requestTimeout);
    const { data: players, error } = await db.rpc('admin_list_participants').abortSignal(controller.signal);
    if (error) throw error;
    const leaderboard = [...players].sort((a, b) => b.points - a.points || b.answered - a.answered || a.nickname.localeCompare(b.nickname, 'cs'));
    const boardMarkup = `<div class="stats"><article><strong>${players.length}</strong><span>hráčů</span></article></div><h2>Aktuální pořadí</h2><p class="muted">— = stanoviště zatím není dokončené · 0 b. = dokončené bez bodů</p>${leaderboard.length ? `<div class="leaderboard-wrap"><table class="leaderboard-table"><thead><tr><th>#</th><th>Soutěžící</th><th>Stan. 1</th><th>Stan. 2</th><th>Stan. 3</th><th>Stan. 4</th><th>Celkem</th></tr></thead><tbody>${leaderboard.map((player, index) => `<tr><td class="rank">${index + 1}.</td><th scope="row">${escapeHtml(player.nickname)}</th><td>${stationScore(player.station_1_points)}</td><td>${stationScore(player.station_2_points)}</td><td>${stationScore(player.station_3_points)}</td><td>${player.station_4_guess == null ? stationScore(player.station_4_points) : `${Number(player.station_4_guess)} min`}</td><td><strong>${player.points} b.</strong></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Zatím žádní hráči.</p>' }`;
    if (boardMarkup !== lastMarkup) {
      root.innerHTML = boardMarkup;
      lastMarkup = boardMarkup;
    }

    lastUpdatedAt = clock.format(new Date());
    status.textContent = `Naposledy aktualizováno v ${lastUpdatedAt}.`;
  } catch {
    if (!lastUpdatedAt) root.textContent = 'Výsledky se zatím nepodařilo načíst.';
    status.textContent = lastUpdatedAt
      ? `Naposledy aktualizováno v ${lastUpdatedAt}. Spojení se nezdařilo, tabule to zkusí znovu.`
      : 'Tabule se za chvíli pokusí načíst výsledky znovu.';
  } finally {
    clearTimeout(timeout);
    loading = false;
  }
}
db.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') location.href = 'admin.html';
  else if (event !== 'INITIAL_SESSION') setTimeout(loadDashboard, 0);
});
setInterval(loadDashboard, refreshInterval);
loadDashboard();
