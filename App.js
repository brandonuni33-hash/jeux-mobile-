const POSITIONS = ['BU', 'AG', 'AD', 'MOC', 'MC', 'MDC', 'DC', 'DD', 'DG', 'GK'];

const ACADEMY_POOL = [
  { id: 'bacalan', club: 'FC Bacalan U15', division: 'Régional 1', salary: 120, coach: { name: 'Marc Vasseur', style: 'Gegenpressing', trust: 50 } },
  { id: 'pessac', club: 'US Pessac U15', division: 'Régional 2', salary: 95, coach: { name: 'Antoine Morel', style: 'Tiki-Taka', trust: 60 } },
  { id: 'girondins_b', club: 'Girondins B (U15)', division: 'National U15', salary: 220, coach: { name: 'Laurent Blanc', style: 'Contre-Attaque', trust: 40 } }
];

const RIVALS_POOL = [
  { name: 'Enzo Ferrari', club: 'SA Mérignac U15', pos: 'BU', goals: 0 },
  { name: 'Lucas Silva', club: 'Girondins B (U15)', pos: 'MOC', goals: 0 }
];

const ACTION_SITUATIONS = [
  {
    text: "Tu te retrouves à l'entrée de la surface avec le ballon sur ton bon pied.",
    choices: [
      {
        text: "🎯 Tirer en finesse dans le petit filet",
        statUsed: "tir",
        baseRate: 0.45,
        statGainsOnWin: { tir: 0.8, moral: 2 },
        statLossOnLoss: { moral: -2 },
        onWin: { goal: 1, ratingDelta: 1.2, log: "Superbe frappe enroulée ! BUT !" },
        onLoss: { ratingDelta: -0.4, log: "La frappe passe à côté du cadre." }
      },
      {
        text: "👟 Donner une passe décisive au second poteau",
        statUsed: "passe",
        baseRate: 0.50,
        statGainsOnWin: { passe: 0.8, moral: 2 },
        statLossOnLoss: { moral: -1 },
        onWin: { assist: 1, ratingDelta: 0.9, log: "Offrande parfaite pour ton coéquipier ! PASSE DÉCISIVE !" },
        onLoss: { ratingDelta: -0.3, log: "La passe est interceptée par la défense." }
      },
      {
        text: "⚡ Dribbler le dernier défenseur",
        statUsed: "dribble",
        baseRate: 0.35,
        statGainsOnWin: { dribble: 1.0, moral: 3 },
        statLossOnLoss: { moral: -3 },
        onWin: { goal: 1, ratingDelta: 1.5, log: "Dribble éliminatoire magique puis frappe ! BUT MAGNIFIQUE !" },
        onLoss: { ratingDelta: -0.6, log: "Tu perds le ballon de manière évitable." }
      }
    ]
  },
  {
    text: "Contre-attaque rapide ! Tu as un appel de balle sur l'aile.",
    choices: [
      {
        text: "🚀 Partir en vitesse et repiquer dans l'axe",
        statUsed: "physique",
        baseRate: 0.50,
        statGainsOnWin: { physique: 0.7, tir: 0.4, moral: 2 },
        statLossOnLoss: { moral: -2 },
        onWin: { goal: 1, ratingDelta: 1.1, log: "Tu débordes la défense et ajustes le gardien ! BUT !" },
        onLoss: { ratingDelta: -0.3, log: "Le défenseur te rattrape à la course." }
      },
      {
        text: "📐 Centrer en première intention",
        statUsed: "passe",
        baseRate: 0.55,
        statGainsOnWin: { passe: 0.7, moral: 2 },
        statLossOnLoss: { moral: -1 },
        onWin: { assist: 1, ratingDelta: 0.8, log: "Centre millimétré coupé au premier poteau ! PASSE DÉCISIVE !" },
        onLoss: { ratingDelta: -0.2, log: "Le centre est trop appuyé." }
      }
    ]
  }
];

let savedPlayer = null;
try {
  savedPlayer = JSON.parse(localStorage.getItem('career_rpg_save'));
} catch(e) {
  console.error("Erreur de sauvegarde", e);
}

let state = {
  step: 1,
  player: savedPlayer,
  form: { firstName: 'Brandon', lastName: 'Le Moan', position: 'BU' },
  availableOffers: [],
  selectedOffer: null,
  weekLogs: [],
  pressNews: [],
  rival: RIVALS_POOL[0],
  trainingDoneThisWeek: false,
  matchState: null
};

function calculateSuccessRate(choice) {
  if (!state.player || !state.player.stats) return 0.5;
  const stats = state.player.stats;
  const statVal = stats[choice.statUsed] || 50;
  const moralVal = stats.moral || 50;
  const totalRate = choice.baseRate + ((statVal - 50) * 0.005) + ((moralVal - 50) * 0.002);
  return Math.max(0.15, Math.min(0.92, totalRate));
}

function trainStat(statKey) {
  if (state.trainingDoneThisWeek || !state.player) return;
  const p = state.player;
  p.stats[statKey] = Math.min(99, Math.round((p.stats[statKey] + 1.2) * 10) / 10);
  state.trainingDoneThisWeek = true;
  state.weekLogs.unshift(`🏋️ Entraînement : +1.2 en ${statKey.toUpperCase()}`);
  localStorage.setItem('career_rpg_save', JSON.stringify(p));
  render();
}

function startMatch() {
  const shuffled = [...ACTION_SITUATIONS].sort(() => 0.5 - Math.random());
  state.matchState = {
    currentTurn: 0,
    totalTurns: 2,
    situations: shuffled.slice(0, 2),
    goals: 0,
    assists: 0,
    rating: 6.0,
    logs: []
  };
  render();
}

function makeMatchChoice(choiceIndex) {
  const ms = state.matchState;
  const sit = ms.situations[ms.currentTurn];
  const choice = sit.choices[choiceIndex];

  const successRate = calculateSuccessRate(choice);
  const success = Math.random() < successRate;
  const outcome = success ? choice.onWin : choice.onLoss;

  const pStats = state.player.stats;
  const gainsLosses = success ? choice.statGainsOnWin : choice.statLossOnLoss;

  if (gainsLosses) {
    Object.keys(gainsLosses).forEach(st => {
      const delta = gainsLosses[st];
      pStats[st] = Math.max(20, Math.min(99, Math.round((pStats[st] + delta) * 10) / 10));
    });
  }

  if (outcome.goal) ms.goals += outcome.goal;
  if (outcome.assist) ms.assists += outcome.assist;
  ms.rating = Math.max(3.0, Math.min(10.0, ms.rating + outcome.ratingDelta));
  ms.logs.push(outcome.log);

  ms.currentTurn += 1;

  if (ms.currentTurn >= ms.totalTurns) {
    finishMatch();
  } else {
    render();
  }
}

function finishMatch() {
  const p = state.player;
  const ms = state.matchState;

  p.history.matchs += 1;
  p.history.goals += ms.goals;
  p.history.assists += ms.assists;

  const matchRating = ms.rating.toFixed(1);
  p.status.averageRating = ((parseFloat(p.status.averageRating) * (p.history.matchs - 1) + parseFloat(matchRating)) / p.history.matchs).toFixed(1);

  p.finances.balance += p.contract.salary;

  if (parseFloat(matchRating) >= 7.0) {
    p.coachTrust = Math.min(100, p.coachTrust + 4);
  } else if (parseFloat(matchRating) < 6.0) {
    p.coachTrust = Math.max(0, p.coachTrust - 5);
  }

  p.status.week += 1;
  if (p.status.week > 52) { p.status.week = 1; p.status.season += 1; p.identity.age += 1; }

  state.weekLogs.unshift(`Match terminé : Note ${matchRating}/10 | ${ms.goals} But(s), ${ms.assists} Passe(s).`);

  state.trainingDoneThisWeek = false;
  localStorage.setItem('career_rpg_save', JSON.stringify(p));
  state.matchState = null;
  render();
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;

  if (!state.player) {
    if (state.step === 1) {
      app.innerHTML = `
        <div class="max-w-xl mx-auto my-8 p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <h1 class="text-2xl font-black text-center text-brand-500 uppercase">Création du Joueur</h1>
          <div class="grid grid-cols-2 gap-3">
            <input id="inp-fn" type="text" value="${state.form.firstName}" class="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm"/>
            <input id="inp-ln" type="text" value="${state.form.lastName}" class="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm"/>
          </div>
          <div class="grid grid-cols-5 gap-2">
            ${POSITIONS.map(p => `<button onclick="setPos('${p}')" class="p-2.5 rounded border text-xs font-bold ${state.form.position === p ? 'bg-brand-500/20 border-brand-500 text-brand-500' : 'bg-slate-950 border-slate-800'}">${p}</button>`).join('')}
          </div>
          <button onclick="goToStep2()" class="w-full py-3 bg-brand-500 font-black rounded-xl text-slate-950 uppercase">Suivant ▶</button>
        </div>
      `;
    } else {
      app.innerHTML = `
        <div class="max-w-xl mx-auto my-8 p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <h2 class="text-lg font-bold">Choisir un contrat d'Académie</h2>
          <div class="space-y-2">
            ${state.availableOffers.map(o => `
              <div onclick="selectOffer('${o.id}')" class="p-4 rounded-xl border cursor-pointer ${state.selectedOffer && state.selectedOffer.id === o.id ? 'bg-brand-500/10 border-brand-500' : 'bg-slate-950 border-slate-800'}">
                <div class="font-bold">${o.club}</div>
                <div class="text-xs text-slate-400">${o.division} • ${o.salary}€ / sem • Coach: ${o.coach.name}</div>
              </div>
            `).join('')}
          </div>
          <button onclick="startCareer()" class="w-full py-3 bg-brand-500 font-black rounded-xl text-slate-950 uppercase">Signer le contrat ✍️</button>
        </div>
      `;
    }
  } else {
    const p = state.player;

    if (state.matchState) {
      const ms = state.matchState;
      const currentSit = ms.situations[ms.currentTurn];

      app.innerHTML = `
        <div class="max-w-2xl mx-auto bg-slate-900 border border-brand-500/40 rounded-2xl p-6 space-y-5">
          <div class="flex justify-between items-center border-b border-slate-800 pb-3">
            <span class="text-xs font-black text-brand-500 uppercase">⚡ MATCH - Action ${ms.currentTurn + 1} / ${ms.totalTurns}</span>
            <span class="text-xs bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 font-bold">Note : <strong class="text-amber-400">${ms.rating.toFixed(1)}</strong></span>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm font-medium">
            ${currentSit.text}
          </div>

          <div class="space-y-2.5">
            ${currentSit.choices.map((c, idx) => {
              const ratePercent = Math.round(calculateSuccessRate(c) * 100);
              const statVal = Math.round(p.stats[c.statUsed] || 50);
              return `
                <button onclick="makeMatchChoice(${idx})" class="w-full p-3.5 bg-slate-950 hover:bg-brand-500/10 border border-slate-800 hover:border-brand-500 text-left rounded-xl text-xs font-bold flex justify-between items-center">
                  <div>
                    <div>${c.text}</div>
                    <div class="text-[10px] text-slate-500 font-normal">Stat : <span class="text-brand-400 uppercase">${c.statUsed} (${statVal})</span></div>
                  </div>
                  <span class="px-2.5 py-1 bg-slate-900 rounded border border-slate-800 text-emerald-400 font-bold text-xs">${ratePercent}%</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="space-y-5">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex justify-between items-center">
          <div>
            <h2 class="text-2xl font-black">${p.identity.firstName} ${p.identity.lastName} (${p.identity.position})</h2>
            <div class="text-xs text-slate-400">${p.contract.club} • S${p.status.season} W${p.status.week}</div>
          </div>
          <div class="text-right text-xs space-y-1">
            <div class="text-emerald-400 font-bold">Solde: ${p.finances.balance} €</div>
            <div class="text-amber-400 font-bold">Moyenne: ${p.status.averageRating} / 10</div>
            <div class="text-blue-400 font-bold">Confiance Coach: ${p.coachTrust}%</div>
          </div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div class="text-xs font-bold text-slate-400 uppercase flex justify-between">
            <span>🏋️ Entraînement Hebdomadaire</span>
            <span class="${state.trainingDoneThisWeek ? 'text-amber-400' : 'text-emerald-400'} font-bold">
              ${state.trainingDoneThisWeek ? 'Séance effectuée' : '1 séance dispo'}
            </span>
          </div>
          <div class="grid grid-cols-3 md:grid-cols-5 gap-2">
            ${['tir', 'passe', 'dribble', 'physique', 'mental'].map(st => `
              <button onclick="trainStat('${st}')" ${state.trainingDoneThisWeek ? 'disabled' : ''} class="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold capitalize disabled:opacity-40">
                +1.2 ${st}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div class="text-xs font-bold text-slate-400 uppercase">📊 Attributs Détaillés</div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div class="text-[10px] text-slate-500 font-bold uppercase">🎯 Tir</div>
              <div class="text-lg font-black text-emerald-400">${Math.round(p.stats.tir)}</div>
            </div>
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div class="text-[10px] text-slate-500 font-bold uppercase">👟 Passe</div>
              <div class="text-lg font-black text-emerald-400">${Math.round(p.stats.passe)}</div>
            </div>
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div class="text-[10px] text-slate-500 font-bold uppercase">⚡ Dribble</div>
              <div class="text-lg font-black text-emerald-400">${Math.round(p.stats.dribble)}</div>
            </div>
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div class="text-[10px] text-slate-500 font-bold uppercase">💪 Physique</div>
              <div class="text-lg font-black text-emerald-400">${Math.round(p.stats.physique)}</div>
            </div>
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div class="text-[10px] text-slate-500 font-bold uppercase">🧠 Mental</div>
              <div class="text-lg font-black text-emerald-400">${Math.round(p.stats.mental)}</div>
            </div>
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div class="text-[10px] text-slate-500 font-bold uppercase">🔥 Moral</div>
              <div class="text-lg font-black text-amber-400">${Math.round(p.stats.moral)}</div>
            </div>
          </div>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <button onclick="startMatch()" class="w-full py-4 bg-brand-500 hover:bg-brand-600 text-slate-950 font-black rounded-xl uppercase text-sm">
            ⚽ JOUER LE MATCH DE LA SEMAINE ▶
          </button>

          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 h-28 overflow-y-auto text-xs space-y-1">
            ${state.weekLogs.map(l => `<div class="border-b border-slate-900 pb-1 text-slate-300">${l}</div>`).join('')}
          </div>
        </div>

        <button onclick="resetCareer()" class="text-xs text-red-500 underline block mx-auto">Réinitialiser la carrière</button>
      </div>
    `;
  }
}

function setPos(p) { state.form.position = p; render(); }
function goToStep2() {
  state.form.firstName = document.getElementById('inp-fn').value || 'Brandon';
  state.form.lastName = document.getElementById('inp-ln').value || 'Le Moan';
  state.availableOffers = [...ACADEMY_POOL];
  state.selectedOffer = state.availableOffers[0];
  state.step = 2;
  render();
}
function selectOffer(id) { state.selectedOffer = state.availableOffers.find(o => o.id === id); render(); }

function startCareer() {
  const offer = state.selectedOffer;
  state.player = {
    identity: { firstName: state.form.firstName, lastName: state.form.lastName, age: 14, position: state.form.position },
    status: { week: 1, season: 1, averageRating: 6.5 },
    contract: { club: offer.club, division: offer.division, salary: offer.salary },
    coachTrust: offer.coach.trust,
    finances: { balance: 350 },
    stats: { tir: 52, passe: 50, dribble: 54, physique: 48, mental: 50, moral: 75 },
    history: { matchs: 0, goals: 0, assists: 0 }
  };
  localStorage.setItem('career_rpg_save', JSON.stringify(state.player));
  state.weekLogs = [`Signature au ${offer.club}.`];
  render();
}

function resetCareer() { localStorage.removeItem('career_rpg_save'); state.player = null; state.step = 1; render(); }

render();
