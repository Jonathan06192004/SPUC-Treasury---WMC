// ─── SIDE CLOCK ───────────────────────────────────────────────────────────────
function updateSideClock() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  let hours = now.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hh = String(hours).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('sideClock').innerHTML =
    `<div class="side-clock-time">${hh}:${mm}:${ss} <span class="side-clock-ampm">${ampm}</span></div>
     <div class="side-clock-date">${date}</div>`;
}
