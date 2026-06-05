// ============================================================
// ROMMELMARKT 2025 — Reservatiesysteem
// ============================================================
// Configuratie — pas deze waarden aan naar jullie situatie
// ============================================================

const CONFIG = {
  PRICE_PER_SPOT: 8,          // Prijs per standplaats in euro
  MAX_SPOTS: 2,               // Maximum aantal plaatsen per persoon
  RESIDENT_POSTCODES: ['1080', '1081'], // Postcodes van jullie gemeente
  RESIDENT_PHASE: true,       // true = enkel inwoners, false = open voor iedereen
  SPOTS_PER_SIDE: {
    dorps: 28,  // Standplaatsen per zijde in Dorpsstraat
    markt: 30   // Standplaatsen per zijde in Marktplein
  },
  ADMIN_PASSWORD: 'admin123', // ⚠️ Wijzig dit in productie via Netlify env vars!
  MOLLIE_RETURN_URL: window.location.href, // Terugkeerurl na betaling
};

// ============================================================
// STATE
// ============================================================

let state = {
  selected: [],       // Geselecteerde (maar nog niet gereserveerde) spots
  mySpots: [],        // Gereserveerde spots van huidige sessie
  reservations: [],   // Alle reservaties (demo data)
  adminLoggedIn: false,
  phaseOpen: !CONFIG.RESIDENT_PHASE,
};

// Genereer spots — prefix = unieke code, count = aantal per zijde, preBooked = demo bezette nummers
function makeSpots(prefix, count, preBooked) {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    num: i + 1,
    bezet: preBooked.includes(i + 1),
    mine: false,
  }));
}

const STREETS = {
  dorpsA: makeSpots('DA', CONFIG.SPOTS_PER_SIDE.dorps, [3,7,12,18,22,26]),
  dorpsB: makeSpots('DB', CONFIG.SPOTS_PER_SIDE.dorps, [2,5,9,14,20,25]),
  marktA: makeSpots('MA', CONFIG.SPOTS_PER_SIDE.markt, [4,8,13,19,24,28]),
  marktB: makeSpots('MB', CONFIG.SPOTS_PER_SIDE.markt, [1,6,11,16,21,26,29]),
};

// Demo reservatie-data voor het beheerderspaneel
state.reservations = [
  { naam:'Marie Janssen', email:'marie@gmail.com', tel:'0499 12 34 56', spots:['DA3','DA7'], inwoner:true, betaald:true, bedrag:16 },
  { naam:'Luc Peeters', email:'luc@hotmail.be', tel:'0471 98 76 54', spots:['DB5'], inwoner:true, betaald:true, bedrag:8 },
  { naam:'Sophie De Backer', email:'sophie@outlook.com', tel:'0485 55 44 33', spots:['MA4','MA8'], inwoner:false, betaald:false, bedrag:16 },
  { naam:'Kevin Vermeersch', email:'kv@icloud.com', tel:'0478 22 11 00', spots:['MB6'], inwoner:true, betaald:true, bedrag:8 },
  { naam:'Nathalie Claes', email:'nat@gmail.com', tel:'0468 77 88 99', spots:['DB9'], inwoner:false, betaald:true, bedrag:8 },
];

function allSpots() {
  return [...STREETS.dorpsA, ...STREETS.dorpsB, ...STREETS.marktA, ...STREETS.marktB];
}

// ============================================================
// RENDER KAART
// ============================================================

function getSpotClass(spot) {
  if (spot.mine) return 'mine';
  if (state.selected.find(s => s.id === spot.id)) return 'geselecteerd';
  if (spot.bezet) return 'bezet';
  return 'vrij';
}

function renderStreetGrid(containerId, spots) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  spots.forEach(spot => {
    const cls = getSpotClass(spot);
    const btn = document.createElement('button');
    btn.className = `spot ${cls}`;
    btn.textContent = spot.num;
    btn.title = `Standplaats ${spot.id} — 5 meter`;
    btn.setAttribute('aria-label', `Standplaats ${spot.id}`);
    btn.setAttribute('aria-pressed', cls === 'geselecteerd' ? 'true' : 'false');
    if (cls !== 'bezet' && cls !== 'mine') {
      btn.addEventListener('click', () => toggleSpot(spot));
    } else {
      btn.disabled = true;
    }
    el.appendChild(btn);
  });
}

function renderMap() {
  renderStreetGrid('street-dorps-a', STREETS.dorpsA);
  renderStreetGrid('street-dorps-b', STREETS.dorpsB);
  renderStreetGrid('street-markt-a', STREETS.marktA);
  renderStreetGrid('street-markt-b', STREETS.marktB);

  const all = allSpots();
  const totalBezet = all.filter(s => s.bezet || s.mine).length;
  const totalVrij  = all.length - totalBezet;

  document.getElementById('stat-vrij').textContent  = totalVrij;
  document.getElementById('stat-bezet').textContent = totalBezet;
  document.getElementById('stat-sel').textContent   = state.selected.length;
  document.getElementById('stat-price').textContent = `€${state.selected.length * CONFIG.PRICE_PER_SPOT}`;

  const btnKaart = document.getElementById('btn-naar-inschrijving');
  if (btnKaart) btnKaart.disabled = state.selected.length === 0;
}

// ============================================================
// SPOT INTERACTIE
// ============================================================

function toggleSpot(spot) {
  const isSelected = state.selected.find(s => s.id === spot.id);
  if (isSelected) {
    state.selected = state.selected.filter(s => s.id !== spot.id);
  } else {
    if (state.selected.length >= CONFIG.MAX_SPOTS) {
      showToast(`⚠️ Maximum ${CONFIG.MAX_SPOTS} standplaatsen per persoon`);
      return;
    }
    state.selected.push(spot);
  }
  renderMap();
  renderInschrijving();
}

function deselectSpot(id) {
  state.selected = state.selected.filter(s => s.id !== id);
  renderMap();
  renderInschrijving();
}

// ============================================================
// TABS
// ============================================================

function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (name === 'inschrijving') renderInschrijving();
  if (name === 'admin' && state.adminLoggedIn) renderAdmin();
}

// ============================================================
// INSCHRIJVING
// ============================================================

function renderInschrijving() {
  const el = document.getElementById('inschrijving-body');
  if (!el) return;

  if (state.mySpots.length > 0) {
    el.innerHTML = successHTML();
    return;
  }

  const tags = state.selected.map(s =>
    `<div class="spot-tag">${s.id} (5m) <button onclick="deselectSpot('${s.id}')" title="Verwijder">×</button></div>`
  ).join('');

  const total = state.selected.length * CONFIG.PRICE_PER_SPOT;

  el.innerHTML = `
    <div class="form-card">
      <h2>Jouw geselecteerde standplaatsen</h2>
      <div class="spots-tags" id="spots-tags-container">
        ${tags || '<span class="empty-sel">Nog geen plaatsen geselecteerd — ga naar de kaart en klik op een groene standplaats.</span>'}
      </div>
      <div class="price-row">
        <span class="price-label">${state.selected.length} × €${CONFIG.PRICE_PER_SPOT} per standplaats</span>
        <span class="price-val">€${total}</span>
      </div>
    </div>

    <div class="form-card">
      <h2>Jouw gegevens</h2>
      <p class="form-desc">Vul je contactgegevens in om de reservatie te voltooien.</p>
      <div class="row2">
        <div class="field"><label>Voornaam *</label><input id="f-voornaam" type="text" placeholder="Jan" autocomplete="given-name"></div>
        <div class="field"><label>Achternaam *</label><input id="f-achternaam" type="text" placeholder="Peeters" autocomplete="family-name"></div>
      </div>
      <div class="field"><label>E-mailadres *</label><input id="f-email" type="email" placeholder="jan@voorbeeld.be" autocomplete="email"></div>
      <div class="field"><label>Telefoonnummer</label><input id="f-tel" type="tel" placeholder="+32 4xx xx xx xx" autocomplete="tel"></div>
      <div class="field">
        <label>Postcode *</label>
        <input id="f-postcode" type="text" placeholder="bv. 1080" maxlength="6" oninput="checkPostcode(this.value)">
      </div>
      <div id="postcode-feedback" class="info-banner banner-info" style="margin-top:8px">
        ℹ️ Vul je postcode in om te controleren of je in de voorrangsperiode kan reserveren.
      </div>
    </div>

    <button class="btn-primary" id="btn-betaal" onclick="doBetaal()" ${state.selected.length === 0 ? 'disabled' : ''}>
      🔒 Betalen via Mollie — €${total}
    </button>
  `;
}

function checkPostcode(val) {
  const fb = document.getElementById('postcode-feedback');
  const btn = document.getElementById('btn-betaal');
  if (!fb) return;
  const pc = val.trim();
  const isResident = CONFIG.RESIDENT_POSTCODES.includes(pc);

  if (!state.phaseOpen && !isResident && pc.length >= 4) {
    fb.className = 'info-banner banner-error';
    fb.innerHTML = '⛔ Jouw postcode valt niet in de voorrangsperiode. Kom later terug wanneer de open inschrijving start.';
    if (btn) btn.disabled = true;
  } else if (isResident) {
    fb.className = 'info-banner banner-success';
    fb.innerHTML = '✅ Je bent inwoner van de gemeente — je kan nu reserveren!';
    if (btn) btn.disabled = state.selected.length === 0;
  } else if (state.phaseOpen) {
    fb.className = 'info-banner banner-success';
    fb.innerHTML = '✅ Open inschrijvingsperiode — iedereen kan nu reserveren!';
    if (btn) btn.disabled = state.selected.length === 0;
  } else {
    fb.className = 'info-banner banner-info';
    fb.innerHTML = 'ℹ️ Vul je postcode in om te controleren of je in de voorrangsperiode kan reserveren.';
    if (btn) btn.disabled = state.selected.length === 0;
  }
}

function doBetaal() {
  const voornaam = (document.getElementById('f-voornaam') || {}).value || '';
  const achternaam = (document.getElementById('f-achternaam') || {}).value || '';
  const email = (document.getElementById('f-email') || {}).value || '';
  const postcode = (document.getElementById('f-postcode') || {}).value || '';

  if (!voornaam || !achternaam || !email) {
    showToast('⚠️ Vul minstens naam en e-mailadres in');
    return;
  }
  if (!email.includes('@')) {
    showToast('⚠️ Ongeldig e-mailadres');
    return;
  }
  if (state.selected.length === 0) {
    showToast('⚠️ Selecteer minstens één standplaats op de kaart');
    return;
  }

  const isResident = CONFIG.RESIDENT_POSTCODES.includes(postcode.trim());
  if (!state.phaseOpen && !isResident) {
    showToast('⛔ Enkel inwoners kunnen nu reserveren');
    return;
  }

  const total = state.selected.length * CONFIG.PRICE_PER_SPOT;
  const spotNames = state.selected.map(s => s.id).join(', ');

  showModal(
    '💳',
    `Bevestig jouw reservatie`,
    `Standplaatsen: ${spotNames}\nNaam: ${voornaam} ${achternaam}\nTe betalen: €${total}\n\nJe wordt doorgestuurd naar Mollie voor de betaling. Na betaling ontvang je een bevestigingsmail.`,
    'Betalen via Mollie',
    () => {
      // In productie: vervang dit door een echte Mollie API-call via je Netlify Function
      // Zie: netlify/functions/create-payment.js
      finalizeReservation(voornaam, achternaam, email, postcode);
    }
  );
}

function finalizeReservation(voornaam, achternaam, email, postcode) {
  const isResident = CONFIG.RESIDENT_POSTCODES.includes(postcode.trim());
  const reserved = [...state.selected];
  
  // Markeer spots als bezet
  reserved.forEach(s => {
    const spot = allSpots().find(x => x.id === s.id);
    if (spot) { spot.bezet = true; spot.mine = true; }
  });

  // Voeg toe aan reservaties
  state.reservations.push({
    naam: `${voornaam} ${achternaam}`,
    email,
    tel: (document.getElementById('f-tel') || {}).value || '',
    spots: reserved.map(s => s.id),
    inwoner: isResident,
    betaald: true,
    bedrag: reserved.length * CONFIG.PRICE_PER_SPOT,
  });

  state.mySpots = [...reserved];
  state.selected = [];
  
  closeModal();
  renderMap();
  renderInschrijving();
}

function successHTML() {
  const total = state.mySpots.length * CONFIG.PRICE_PER_SPOT;
  const rows = state.mySpots.map(s =>
    `<div class="receipt-row"><span>Standplaats ${s.id} (5m)</span><span>€${CONFIG.PRICE_PER_SPOT}</span></div>`
  ).join('');

  return `
    <div class="success-screen">
      <div class="success-icon">✅</div>
      <h2>Reservatie bevestigd!</h2>
      <p>Jouw standplaatsen <strong>${state.mySpots.map(s => s.id).join(' & ')}</strong> zijn succesvol gereserveerd en betaald. Een bevestigingsmail is verstuurd.</p>
      <div class="receipt">
        ${rows}
        <div class="receipt-total"><span>Totaal betaald</span><span>€${total}</span></div>
      </div>
      <div class="info-banner banner-success">✅ Tot op de rommelmarkt! Bewaar dit scherm als bewijs.</div>
    </div>
  `;
}

// ============================================================
// ADMIN
// ============================================================

function adminLogin() {
  const pw = document.getElementById('admin-pw').value;
  // In productie: stuur wachtwoord naar Netlify Function voor server-side verificatie
  if (pw === CONFIG.ADMIN_PASSWORD) {
    state.adminLoggedIn = true;
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    renderAdmin();
  } else {
    showToast('❌ Ongeldig wachtwoord');
  }
}

function renderAdmin() {
  const el = document.getElementById('admin-content');
  if (!el) return;

  const totalInkomsten = state.reservations.filter(r => r.betaald).reduce((a, r) => a + r.bedrag, 0);
  const totalSpots = state.reservations.reduce((a, r) => a + r.spots.length, 0);
  const openstaand = state.reservations.filter(r => !r.betaald).length;

  const rows = state.reservations.map((r, i) => `
    <tr>
      <td>${r.naam}</td>
      <td style="color:var(--gray-400)">${r.email}</td>
      <td><strong>${r.spots.join(', ')}</strong></td>
      <td>${r.inwoner ? '<span class="badge badge-blue">Inwoner</span>' : '<span class="badge badge-gray">Extern</span>'}</td>
      <td>${r.betaald ? '<span class="badge badge-ok">Betaald</span>' : '<span class="badge badge-warn">Openstaand</span>'}</td>
      <td>€${r.bedrag}</td>
      <td>
        ${!r.betaald ? `<button class="btn-sm" onclick="markPaid(${i})">Betaald ✓</button>` : ''}
      </td>
    </tr>
  `).join('');

  const phaseOn = state.phaseOpen;

  el.innerHTML = `
    <div class="admin-header">
      <h2>Beheerderspaneel</h2>
      <div class="admin-actions">
        <button class="btn-sm" onclick="exportCSV()">📥 CSV exporteren</button>
        <button class="btn-sm" onclick="showToast('📧 E-mails verstuurd (demo)')">📧 Herinnering versturen</button>
      </div>
    </div>

    <div class="phase-toggle">
      <div class="toggle-track ${phaseOn ? 'on' : ''}" onclick="togglePhase()">
        <div class="toggle-thumb"></div>
      </div>
      <div class="toggle-label">
        <strong>${phaseOn ? 'Open inschrijving actief' : 'Voorrangsperiode actief'}</strong>
        <span>${phaseOn ? 'Iedereen kan nu reserveren' : 'Enkel inwoners van de gemeente kunnen reserveren'}</span>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:1rem">
      <div class="stat-card"><div class="stat-label">Inschrijvingen</div><div class="stat-val">${state.reservations.length}</div></div>
      <div class="stat-card"><div class="stat-label">Standplaatsen</div><div class="stat-val">${totalSpots}</div></div>
      <div class="stat-card"><div class="stat-label">Openstaand</div><div class="stat-val">${openstaand}</div></div>
      <div class="stat-card"><div class="stat-label">Ontvangen</div><div class="stat-val">€${totalInkomsten}</div></div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Naam</th><th>E-mail</th><th>Plaatsen</th><th>Type</th><th>Status</th><th>Bedrag</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function togglePhase() {
  state.phaseOpen = !state.phaseOpen;
  CONFIG.RESIDENT_PHASE = !state.phaseOpen;
  const badge = document.getElementById('phase-badge');
  if (badge) {
    badge.textContent = state.phaseOpen ? 'Open inschrijving' : 'Voorrangsperiode inwoners';
    badge.className = `phase-badge ${state.phaseOpen ? 'phase-open' : 'phase-resident'}`;
  }
  renderAdmin();
  showToast(state.phaseOpen ? '✅ Open inschrijving geactiveerd' : '🔒 Voorrangsperiode geactiveerd');
}

function markPaid(i) {
  state.reservations[i].betaald = true;
  renderAdmin();
  showToast('✅ Betaling geregistreerd');
}

function exportCSV() {
  const header = 'Naam,E-mail,Telefoonnummer,Standplaatsen,Inwoner,Betaald,Bedrag';
  const rows = state.reservations.map(r =>
    `"${r.naam}","${r.email}","${r.tel}","${r.spots.join(' & ')}",${r.inwoner ? 'Ja' : 'Nee'},${r.betaald ? 'Ja' : 'Nee'},€${r.bedrag}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rommelmarkt-reservaties.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 CSV gedownload');
}

// ============================================================
// MODAL
// ============================================================

function showModal(icon, title, body, okLabel, onOk) {
  document.getElementById('modal-icon').textContent = icon;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  document.getElementById('modal-ok').textContent = okLabel || 'Bevestigen';
  document.getElementById('modal-ok').onclick = onOk;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// Sluit modal bij klik buiten
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ============================================================
// TOAST
// ============================================================

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ============================================================
// INIT
// ============================================================

renderMap();
renderInschrijving();
