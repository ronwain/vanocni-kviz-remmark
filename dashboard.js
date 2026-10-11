const { supabaseUrl, supabaseKey, adminEmail } = window.QUIZ_CONFIG;
const db = window.supabase.createClient(supabaseUrl, supabaseKey);
const root = document.querySelector('#dashboard');

function escapeHtml(value) {
  const el = document.createElement('div');
  el.textContent = value ?? '';
  return el.innerHTML;
}

async function loadDashboard() {
  const { data: { session } } = await db.auth.getSession();
  if (!session || session.user.email?.toLowerCase() !== adminEmail) {
    location.href = 'admin.html';
    return;
  }

  const { data: players, error } = await db.rpc('admin_list_participants');
  if (error) {
    root.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    return;
  }

  const leaderboard = [...players].sort((a, b) =>
    b.points - a.points || b.answered - a.answered || a.nickname.localeCompare(b.nickname, 'cs')
  );
  const totalPoints = players.reduce((sum, player) => sum + Number(player.points || 0), 0);
  const totalAnswers = players.reduce((sum, player) => sum + Number(player.answered || 0), 0);

  root.innerHTML = `<div class="stats"><article><strong>${players.length}</strong><span>hráčů</span></article><article><strong>${totalPoints}</strong><span>bodů celkem</span></article><article><strong>${totalAnswers}</strong><span>odpovědí</span></article></div><h2>Aktuální pořadí</h2>${leaderboard.length ? `<ol class="leaderboard">${leaderboard.map((player, index) => `<li><span class="rank">${index + 1}.</span><strong>${escapeHtml(player.nickname)}</strong><span>${player.points} b. · ${player.answered} odp.</span></li>`).join('')}</ol>` : '<p class="muted">Zatím žádní hráči.</p>'}`;
}

db.auth.onAuthStateChange(() => loadDashboard());
loadDashboard();
