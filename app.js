/* SIGMA V0.9 TEST — données fictives uniquement ; ACL Grist obligatoires. */
'use strict';
const TABLES = ['SIGNALEMENTS','ACADEMIES','STATUTS','MOTIFS','SIGNALEMENT_MOTIFS','UTILISATEURS','HABILITATIONS','PERSONNES','SIGNALEMENT_PERSONNES','ACTIONS','HISTORIQUE_STATUTS','RENDEZ_VOUS','PARTICIPANTS_RDV','DOCUMENTS','VERSIONS_DOCUMENTS','COMMENTAIRES_DOCUMENTS','PARTAGES_DOCUMENTS','HISTORIQUE_PARTAGES'];
const state = {data:{},view:'dashboard',busy:false,dossierSuivi:null,agendaDate:new Date(),agendaMode:'semaine',rdvDossier:null};
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rowsFrom = raw => {
  if(Array.isArray(raw)) return raw;
  if(!raw || !Array.isArray(raw.id)) return [];
  return raw.id.map((id,i)=>Object.fromEntries([['id',id],...Object.entries(raw).filter(([k,v])=>k!=='id'&&Array.isArray(v)).map(([k,v])=>[k,v[i]])]));
};
const tab = name => state.data[name] || [];
const byId = (name,id) => tab(name).find(r=>Number(r.id)===Number(id));
const idsFor = dossierId => tab('SIGNALEMENT_MOTIFS').filter(r=>Number(r.Signalement)===Number(dossierId)).map(r=>Number(r.Motif));
const namesFor = dossierId => idsFor(dossierId).map(id=>byId('MOTIFS',id)?.Libelle).filter(Boolean);
function notify(message,ok=false){$('notice').textContent=message;$('notice').className=ok?'ok':'';}
function show(view){state.view=view;for(const el of document.querySelectorAll('.view'))el.classList.toggle('hidden',el.id!==view);for(const el of document.querySelectorAll('.nav'))el.classList.toggle('active',el.dataset.view===view);$('page-title').textContent={dashboard:'Tableau de bord',dossiers:'Signalements',users:'Référents',audit:'Contrôle des accès',suivi:'Suivi du signalement',agenda:'Agenda et rendez-vous',documents:'Comptes rendus et documents',settings:'Informations'}[view];render();}
const dateText=v=>{if(!v)return '—';if(typeof v==='number')return new Date(v*1000).toLocaleDateString('fr-FR',{timeZone:'UTC'});return esc(String(v).slice(0,10));};
function statusName(id){return byId('STATUTS',id)?.Libelle || 'Non renseigné';}
function statusBadge(name){return `<span class="pill ${name==='Clôturé'?'done':name==='En attente'?'wait':''}">${esc(name)}</span>`;}
function dossierRow(r){return `<tr><td><strong>${esc(r.Numero||'—')}</strong></td><td>${esc(r.Objet)}</td><td>${esc(byId('ACADEMIES',r.Academie)?.Nom||'—')}</td><td>${esc(namesFor(r.id).join(', ')||'—')}</td><td>${esc(assignedTo(r.id).map(a=>labelUser(a.Utilisateur)).join(', ')||'—')}</td><td>${statusBadge(statusName(r.Statut))}</td><td>${dateText(r.Date_Reception)}</td><td><button class="row-button" data-edit="${r.id}">Modifier</button> <button class="row-button" data-suivi="${r.id}">Suivi</button></td></tr>`;}
function render(){const dossiers=tab('SIGNALEMENTS');if(state.view==='dashboard'){$('metrics').innerHTML=[['Total des dossiers',dossiers.length],['En cours',dossiers.filter(r=>statusName(r.Statut)==='En cours de traitement').length],['À qualifier',dossiers.filter(r=>statusName(r.Statut)==='À qualifier').length],['Clôturés',dossiers.filter(r=>statusName(r.Statut)==='Clôturé').length]].map(([label,n])=>`<div class="metric"><span>${esc(label)}</span><b>${n}</b></div>`).join('');$('recent').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Numéro</th><th>Objet</th><th>Académie</th><th>Motifs</th><th>Statut</th><th>Ouverture</th><th></th></tr></thead><tbody>${dossiers.slice().sort((a,b)=>b.id-a.id).slice(0,8).map(dossierRow).join('')||'<tr><td colspan="8">Aucun dossier.</td></tr>'}</tbody></table></div>`;}
if(state.view==='users'){renderUsers();}
if(state.view==='suivi'){renderSuivi();}
if(state.view==='agenda'){renderAgenda();}
if(state.view==='documents'){renderDocuments();}
if(state.view==='audit'){renderAudit();}
if(state.view==='dossiers'){const search=$('search').value.trim().toLowerCase(),statut=$('filter-status').value,motif=$('filter-motif').value;const filtered=dossiers.filter(r=>(!statut||String(r.Statut)===statut)&&(!motif||idsFor(r.id).includes(Number(motif)))&&(!search||[r.Numero,r.Objet,r.Referent,byId('ACADEMIES',r.Academie)?.Nom,...namesFor(r.id)].join(' ').toLowerCase().includes(search)));$('count').textContent=`${filtered.length} dossier(s)`;$('rows').innerHTML=filtered.slice().sort((a,b)=>b.id-a.id).map(dossierRow).join('')||'<tr><td colspan="8">Aucun résultat.</td></tr>';}}
function optionList(name,textField){return tab(name).slice().sort((a,b)=>(a.Ordre||0)-(b.Ordre||0)).map(x=>`<option value="${x.id}">${esc(x[textField])}</option>`).join('');}
function loadSelects(){for(const [el,name,col] of [['academie','ACADEMIES','Nom'],['statut','STATUTS','Libelle']])$(el).innerHTML='<option value="">Sélectionner…</option>'+optionList(name,col);$('filter-status').innerHTML='<option value="">Tous les statuts</option>'+optionList('STATUTS','Libelle');$('filter-motif').innerHTML='<option value="">Tous les motifs</option>'+optionList('MOTIFS','Libelle');$('user-academie').innerHTML='<option value="">Sélectionner…</option>'+optionList('ACADEMIES','Nom');$('motifs').innerHTML=tab('MOTIFS').sort((a,b)=>(a.Ordre||0)-(b.Ordre||0)).map(x=>`<label><input type="checkbox" name="motif" value="${x.id}"> ${esc(x.Libelle)}</label>`).join('');}
async function refresh(){try{notify('');for(const name of TABLES)state.data[name]=rowsFrom(await grist.docApi.fetchTable(name));loadSelects();fillRdvSelects();fillDocumentSelects();render();}catch(e){notify('Chargement impossible : '+e.message+'. Vérifiez les dix-huit tables et les autorisations du widget.');}}
function openForm(id){$('record-form').reset();$('record-id').value=id||'';const rec=id?byId('SIGNALEMENTS',id):null;$('modal-title').textContent=rec?'Modifier le signalement':'Nouveau signalement';$('numero').value=rec?.Numero||'(généré à la création)';$('date').value=rec?.Date_Reception?new Date(Number(rec.Date_Reception)*1000).toISOString().slice(0,10):new Date().toISOString().slice(0,10);$('objet').value=rec?.Objet||'';$('academie').value=rec?.Academie||'';$('statut').value=rec?.Statut||'';$('referent').value=rec?.Referent||'';$('resume').value=rec?.Resume||'';const motifs=new Set(rec?idsFor(rec.id):[]);for(const cb of document.querySelectorAll('input[name="motif"]'))cb.checked=motifs.has(Number(cb.value));loadAssignments(rec?.id);$('modal').classList.remove('hidden');$('objet').focus();}
function closeForm(){$('modal').classList.add('hidden');}
// V0.5.1 : vérification explicite des écritures dans HISTORIQUE_STATUTS.
// Le journal concerne les opérations du formulaire SIGMA, pas les modifications faites dans les tables Grist.
async function verifyHistoryEntry(dossierId, statutApres, ancienStatut, isCreation) {
  const records = rowsFrom(await grist.docApi.fetchTable('HISTORIQUE_STATUTS'));
  const matches = records.filter(h =>
    Number(h.Signalement) === Number(dossierId) &&
    Number(h.Statut_Apres) === Number(statutApres) &&
    (isCreation ? !h.Statut_Avant : Number(h.Statut_Avant) === Number(ancienStatut))
  );
  if (!matches.length) {
    throw new Error('Le dossier a été enregistré mais aucune ligne correspondante n’a été retrouvée dans HISTORIQUE_STATUTS. Vérifiez les références Signalement/Statut_Apres et les permissions d’écriture.');
  }
}
async function save(ev) {
  ev.preventDefault();
  if (state.busy) return;
  const id = Number($('record-id').value) || null;
  const chosen = [...document.querySelectorAll('input[name="motif"]:checked')].map(c => Number(c.value));
  if (!chosen.length) { notify('Choisissez au moins un motif.'); return; }
  const ts = Date.parse($('date').value + 'T00:00:00Z') / 1000;
  const fields = {
    Objet: $('objet').value.trim(), Academie: Number($('academie').value),
    Statut: Number($('statut').value), Date_Reception: ts,
    Referent: $('referent').value.trim(), Resume: $('resume').value.trim()
  };
  if (!fields.Objet || !fields.Academie || !fields.Statut || !Number.isFinite(ts)) {
    notify('Complétez les champs obligatoires.'); return;
  }
  state.busy = true;
  $('save').disabled = true;
  try {
    const previous = id ? byId('SIGNALEMENTS', id) : null;
    if (id && !previous) throw new Error('Signalement introuvable dans les données chargées. Actualisez SIGMA.');
    const changed = !!id && Number(previous.Statut) !== Number(fields.Statut);
    let target = id;
    if (id) {
      const changes = [['UpdateRecord', 'SIGNALEMENTS', id, fields]];
      if (changed) {
        changes.push(['AddRecord', 'HISTORIQUE_STATUTS', null, {
          Signalement: id, Statut_Avant: Number(previous.Statut) || null,
          Statut_Apres: fields.Statut, Date_Changement: Math.floor(Date.now() / 1000),
          Auteur: 'Widget SIGMA (identité non certifiée)',
          Commentaire: 'Changement de statut via le formulaire'
        }]);
      }
      await grist.docApi.applyUserActions(changes);
    } else {
      const year = $('date').value.slice(0, 4);
      const unique = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.floor(Math.random()*1e9)}`;
      fields.Numero = `VDH-${year}-${unique.slice(0, 8).toUpperCase()}`;
      fields.Annee_Ouverture = Number(year);
      fields.Date_Creation = Math.floor(Date.now()/1000);
      await grist.docApi.applyUserActions([['AddRecord','SIGNALEMENTS',null,fields]]);
      const all = rowsFrom(await grist.docApi.fetchTable('SIGNALEMENTS'));
      target = all.find(r => r.Numero === fields.Numero)?.id;
      if (!target) throw new Error('Dossier créé, mais identifiant introuvable : actualisez et vérifiez les motifs.');
    }
    const links = rowsFrom(await grist.docApi.fetchTable('SIGNALEMENT_MOTIFS'))
      .filter(r => Number(r.Signalement) === Number(target));
    const existing = new Set(links.map(r => Number(r.Motif)));
    const wanted = new Set(chosen);
    const actions = [
      ...links.filter(r => !wanted.has(Number(r.Motif)))
        .map(r => ['RemoveRecord','SIGNALEMENT_MOTIFS',r.id]),
      ...chosen.filter(x => !existing.has(x))
        .map(motif => ['AddRecord','SIGNALEMENT_MOTIFS',null,{Signalement:Number(target),Motif:motif}])
    ];
    if (!id) {
      actions.push(['AddRecord','HISTORIQUE_STATUTS',null,{
        Signalement:Number(target), Statut_Apres:fields.Statut,
        Date_Changement:Math.floor(Date.now()/1000),
        Auteur:'Widget SIGMA (identité non certifiée)',
        Commentaire:'Création du signalement'
      }]);
    }
    if (actions.length) await grist.docApi.applyUserActions(actions);
    // Lire à nouveau la table : ne jamais annoncer un historique enregistré sans contrôle.
    if (!id || changed) {
      await verifyHistoryEntry(target, fields.Statut, previous?.Statut, !id);
    }
    await saveAssignments(target);
    closeForm();
    await refresh();
    notify(!id ? 'Dossier créé et historique vérifié dans Grist.' :
      changed ? 'Statut modifié et historique vérifié dans Grist.' :
      'Dossier enregistré (statut inchangé : aucune nouvelle ligne d’historique).', true);
    show('dossiers');
  } catch (e) {
    notify('Échec ou enregistrement partiel : ' + e.message + ' Vérifiez les tables Grist avant de réessayer.');
  } finally {
    state.busy = false;
    $('save').disabled = false;
  }
}
// Référents : écriture dans les tables métier. Les ACL se configurent séparément dans Grist.
function activeUsers(){return tab('UTILISATEURS').filter(u=>Number(u.Actif)!==0);}
function labelUser(id){const u=byId('UTILISATEURS',id);return u ? (u.Libelle||u.Email) : 'Utilisateur inconnu';}
function assignedTo(id){return tab('HABILITATIONS').filter(h=>Number(h.Signalement)===Number(id)&&Number(h.Actif)!==0&&h.Perimetre==='dossier');}
function loadAssignments(dossierId){const current=new Map((dossierId?assignedTo(dossierId):[]).map(a=>[Number(a.Utilisateur),a.Droit]));$('assignments').innerHTML=activeUsers().sort((a,b)=>String(a.Libelle).localeCompare(String(b.Libelle),'fr')).map(u=>`<label class="assign-item"><input class="assign-check" type="checkbox" data-user="${u.id}" ${current.has(Number(u.id))?'checked':''}> <span>${esc(u.Libelle||u.Email)} <small>(${esc(u.Email)})</small></span> <select class="assign-right" data-user="${u.id}"><option value="lecture" ${current.get(Number(u.id))==='lecture'?'selected':''}>Lecture</option><option value="edition" ${current.get(Number(u.id))==='edition'?'selected':''}>Modification</option></select></label>`).join('')||'<em>Aucun référent actif. Ajoutez-en dans Référents.</em>';}
async function saveAssignments(dossierId){const desired=new Map();for(const check of document.querySelectorAll('.assign-check:checked')){const uid=Number(check.dataset.user);const right=document.querySelector(`.assign-right[data-user="${uid}"]`).value;desired.set(uid,right);}
const old=tab('HABILITATIONS').filter(h=>Number(h.Signalement)===Number(dossierId)&&h.Perimetre==='dossier');const actions=[];
for(const row of old){const uid=Number(row.Utilisateur);if(!desired.has(uid)){if(Number(row.Actif)!==0)actions.push(['UpdateRecord','HABILITATIONS',row.id,{Actif:0}]);}else{const right=desired.get(uid);if(row.Droit!==right||Number(row.Actif)!==1)actions.push(['UpdateRecord','HABILITATIONS',row.id,{Droit:right,Actif:1}]);desired.delete(uid);}}
for(const [uid,right] of desired)actions.push(['AddRecord','HABILITATIONS',null,{Utilisateur:uid,Signalement:Number(dossierId),Perimetre:'dossier',Droit:right,Actif:1}]);
if(actions.length)await grist.docApi.applyUserActions(actions);
}

// SIGMA V0.3 — Audit de qualité des habilitations. Aucun contrôle de sécurité n'est implémenté ici.
function auditEntries(){
  const problems=[];
  const push=(level,kind,target,fix)=>problems.push({level,kind,target,fix});
  const users=tab('UTILISATEURS'), links=tab('HABILITATIONS'), dossiers=tab('SIGNALEMENTS');
  const emails=new Map(), activeLinks=new Map();
  const validRoles=new Set(['referent','coordinateur','central']);
  const validRights=new Set(['lecture','edition']);
  for(const u of users){
    const email=String(u.Email||'').trim().toLowerCase();
    if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) push('Erreur','Adresse email absente ou invalide',`Utilisateur #${u.id}`,'Corriger Email dans UTILISATEURS.');
    else if(emails.has(email)) push('Erreur','Email dupliqué',`Utilisateurs #${emails.get(email)} et #${u.id}`,'Conserver un seul utilisateur par adresse.');
    else emails.set(email,u.id);
    if(!validRoles.has(String(u.Role||''))) push('Attention','Profil inconnu',`Utilisateur #${u.id}`,'Utiliser referent, coordinateur ou central.');
    if(!byId('ACADEMIES',u.Academie)) push('Erreur','Académie introuvable',`Utilisateur #${u.id}`,'Associer une académie existante.');
  }
  for(const h of links){
    if(h.Perimetre!=='dossier') {push('Attention','Périmètre non reconnu',`Habilitation #${h.id}`,'Cette version ne gère que Perimetre = dossier.');continue;}
    const u=byId('UTILISATEURS',h.Utilisateur),d=byId('SIGNALEMENTS',h.Signalement);
    if(!u || !d) push('Erreur','Référence manquante',`Habilitation #${h.id}`,'Réparer Utilisateur et/ou Signalement.');
    if(!validRights.has(String(h.Droit||''))) push('Erreur','Droit non reconnu',`Habilitation #${h.id}`,'Choisir lecture ou edition.');
    if(Number(h.Actif)!==1) continue;
    if(u && Number(u.Actif)===0) push('Erreur','Référent inactif affecté',`Habilitation #${h.id}`,'Désactiver l’affectation ou réactiver le référent.');
    if(u && d && Number(u.Academie)!==Number(d.Academie)) push('Attention','Affectation inter-académique',`Habilitation #${h.id}`,'Vérifier et justifier l’exception avant validation.');
    const key=`${h.Utilisateur}/${h.Signalement}`;
    if(activeLinks.has(key)) push('Erreur','Affectation active en double',`Habilitations #${activeLinks.get(key)} et #${h.id}`,'Désactiver un des doublons.');
    else activeLinks.set(key,h.id);
  }
  for(const d of dossiers){if(!links.some(h=>h.Perimetre==='dossier'&&Number(h.Signalement)===Number(d.id)&&Number(h.Actif)===1))push('Attention','Dossier sans référent actif',`Dossier #${d.id}`,'Affecter au moins un référent, si nécessaire.');}
  return problems;
}
function renderAudit(){
  const problems=auditEntries(), errors=problems.filter(p=>p.level==='Erreur').length;
  $('audit-metrics').innerHTML=`<div class="audit-stat"><b>${tab('UTILISATEURS').length}</b><span>Profils</span></div><div class="audit-stat"><b>${tab('HABILITATIONS').length}</b><span>Habilitations</span></div><div class="audit-stat"><b>${errors}</b><span>Erreurs</span></div><div class="audit-stat"><b>${problems.length-errors}</b><span>Points à examiner</span></div>`;
  $('audit-rows').innerHTML=problems.map(p=>`<tr><td><span class="pill ${p.level==='Erreur'?'audit-error':'wait'}">${esc(p.level)}</span></td><td>${esc(p.kind)}</td><td>${esc(p.target)}</td><td>${esc(p.fix)}</td></tr>`).join('')||'<tr><td colspan="4">Aucune anomalie détectée dans les affectations. Cela ne signifie PAS que les accès Grist sont sécurisés.</td></tr>';
}

function renderUsers(){$('user-rows').innerHTML=tab('UTILISATEURS').map(u=>{const active=tab('HABILITATIONS').filter(h=>Number(h.Utilisateur)===Number(u.id)&&Number(h.Actif)!==0&&h.Perimetre==='dossier');return `<tr><td>${esc(u.Libelle)}</td><td>${esc(u.Email)}</td><td>${esc(byId('ACADEMIES',u.Academie)?.Nom||'—')}</td><td>${esc(u.Role)}</td><td>${Number(u.Actif)===0?'Non':'Oui'}</td><td>${active.length}</td><td><button class="row-button" data-user-edit="${u.id}">Modifier le profil</button> <button class="row-button" data-access-user="${u.id}">Gérer les accès</button></td></tr>`;}).join('')||'<tr><td colspan="7">Aucun référent créé.</td></tr>';}
function openAccess(uid){const u=byId('UTILISATEURS',uid);if(!u)return notify('Référent introuvable.');$('access-user-id').value=uid;$('access-title').textContent=`Accès aux dossiers — ${u.Libelle||u.Email}`;const rows=tab('SIGNALEMENTS').slice().sort((a,b)=>b.id-a.id);const current=new Map(tab('HABILITATIONS').filter(h=>Number(h.Utilisateur)===Number(uid)&&h.Perimetre==='dossier'&&Number(h.Actif)!==0).map(h=>[Number(h.Signalement),h.Droit]));$('access-dossiers').innerHTML=rows.map(d=>`<label class="access-item"><input type="checkbox" class="access-check" data-dossier="${d.id}" ${current.has(Number(d.id))?'checked':''}><span><strong>${esc(d.Numero)}</strong><small>${esc(d.Objet)}</small></span><select class="access-right" data-dossier="${d.id}" aria-label="Droit pour ${esc(d.Numero)}"><option value="lecture" ${current.get(Number(d.id))==='lecture'?'selected':''}>Lecture seule</option><option value="edition" ${current.get(Number(d.id))==='edition'?'selected':''}>Modification</option></select></label>`).join('')||'<p>Aucun signalement disponible. Créez d’abord un dossier fictif.</p>';$('access-modal').classList.remove('hidden');}
function closeAccess(){$('access-modal').classList.add('hidden');}
async function saveAccess(ev){ev.preventDefault();if(state.busy)return;const uid=Number($('access-user-id').value);const desired=new Map();for(const c of document.querySelectorAll('.access-check:checked')){const id=Number(c.dataset.dossier);desired.set(id,document.querySelector(`.access-right[data-dossier="${id}"]`).value);}const existing=tab('HABILITATIONS').filter(h=>Number(h.Utilisateur)===uid&&h.Perimetre==='dossier');const actions=[];for(const h of existing){const id=Number(h.Signalement);if(!desired.has(id)){if(Number(h.Actif)!==0)actions.push(['UpdateRecord','HABILITATIONS',h.id,{Actif:0}]);}else{const right=desired.get(id);if(h.Droit!==right||Number(h.Actif)!==1)actions.push(['UpdateRecord','HABILITATIONS',h.id,{Droit:right,Actif:1}]);desired.delete(id);}}for(const [id,right] of desired)actions.push(['AddRecord','HABILITATIONS',null,{Utilisateur:uid,Signalement:id,Perimetre:'dossier',Droit:right,Actif:1}]);state.busy=true;$('access-save').disabled=true;try{if(actions.length)await grist.docApi.applyUserActions(actions);const fresh=rowsFrom(await grist.docApi.fetchTable('HABILITATIONS'));state.data.HABILITATIONS=fresh;for(const [id,right] of [...document.querySelectorAll('.access-check:checked')].map(c=>[Number(c.dataset.dossier),document.querySelector(`.access-right[data-dossier="${c.dataset.dossier}"]`).value])){if(!fresh.some(h=>Number(h.Utilisateur)===uid&&Number(h.Signalement)===id&&h.Perimetre==='dossier'&&h.Droit===right&&Number(h.Actif)===1))throw new Error(`Affectation du dossier ${id} introuvable après écriture`);}closeAccess();render();notify(`Affectations enregistrées dans HABILITATIONS (${actions.length} modification(s)). Ce ne sont pas encore des ACL.`,true);}catch(e){notify('Erreur pendant l’enregistrement des affectations : '+e.message+'. Vérifiez la table HABILITATIONS.');}finally{state.busy=false;$('access-save').disabled=false;}}
function editUser(id){$('user-form').reset();const u=id?byId('UTILISATEURS',id):null;$('user-id').value=u?.id||'';$('user-title').textContent=u?'Modifier un référent':'Ajouter un référent';$('user-name').value=u?.Libelle||'';$('user-email').value=u?.Email||'';$('user-academie').value=u?.Academie||'';$('user-role').value=u?.Role||'referent';$('user-actif').checked=!u||Number(u.Actif)!==0;$('user-modal').classList.remove('hidden');}
function closeUser(){$('user-modal').classList.add('hidden');}
async function saveUser(e){e.preventDefault();if(state.busy)return;const id=Number($('user-id').value)||null;const fields={Libelle:$('user-name').value.trim(),Email:$('user-email').value.trim().toLowerCase(),Academie:Number($('user-academie').value),Role:$('user-role').value,Actif:$('user-actif').checked?1:0};if(!fields.Libelle||!fields.Email||!fields.Academie)return notify('Complétez les champs du référent.');if(tab('UTILISATEURS').some(u=>Number(u.id)!==id&&String(u.Email).toLowerCase()===fields.Email))return notify('Cette adresse est déjà enregistrée.');state.busy=true;$('user-save').disabled=true;try{await grist.docApi.applyUserActions([[id?'UpdateRecord':'AddRecord','UTILISATEURS',id,fields]]);closeUser();await refresh();notify('Référent enregistré. Ses droits ne sont effectifs qu’après configuration des ACL Grist.',true);}catch(err){notify('Enregistrement du référent impossible : '+err.message);}finally{state.busy=false;$('user-save').disabled=false;}}

// SIGMA V0.5 : personnes et actions de suivi (interface métier propriétaire).
const dossierLinks=()=>tab('SIGNALEMENT_PERSONNES').filter(x=>Number(x.Signalement)===Number(state.dossierSuivi));
const dossierActions=()=>tab('ACTIONS').filter(x=>Number(x.Signalement)===Number(state.dossierSuivi)).sort((a,b)=>(Number(b.Date_Action)||0)-(Number(a.Date_Action)||0));
const dossierHistory=()=>tab('HISTORIQUE_STATUTS').filter(x=>Number(x.Signalement)===Number(state.dossierSuivi)).sort((a,b)=>(Number(b.Date_Changement)||0)-(Number(a.Date_Changement)||0));
const roleOptions=['Personne à l’origine du signalement','Victime présumée','Personne mise en cause','Témoin','Autre personne concernée'];
const typeActions=['Entretien','Contact','Mesure de protection','Analyse','Transmission','Relance','Autre'];
function openSuivi(id){if(!byId('SIGNALEMENTS',id))return notify('Dossier non disponible.');state.dossierSuivi=id;show('suivi');}
function renderSuivi(){const d=byId('SIGNALEMENTS',state.dossierSuivi);if(!d){$('suivi-title').textContent='Sélectionne un dossier dans Signalements.';$('suivi-content').classList.add('hidden');return;}$('suivi-content').classList.remove('hidden');$('suivi-title').textContent=`${d.Numero} — ${d.Objet}`;
 $('suivi-personnes').innerHTML=dossierLinks().map(l=>{const person=byId('PERSONNES',l.Personne);return `<tr><td>${esc(person?.Libelle||'—')}</td><td>${esc(l.Role)}</td><td>${esc(person?.Categorie||'—')}</td><td><button type="button" class="row-button" data-detach="${l.id}">Retirer du dossier</button></td></tr>`;}).join('')||'<tr><td colspan="4">Aucune personne associée.</td></tr>';
 $('suivi-actions').innerHTML=dossierActions().map(a=>`<tr><td>${dateText(a.Date_Action)}</td><td>${esc(a.Type_Action)}</td><td>${esc(a.Description)}</td><td>${esc(a.Etat)}</td></tr>`).join('')||'<tr><td colspan="4">Aucune action enregistrée.</td></tr>';
 $('suivi-historique').innerHTML=dossierHistory().map(a=>`<tr><td>${dateText(a.Date_Changement)}</td><td>${esc(statusName(a.Statut_Avant))}</td><td>${esc(statusName(a.Statut_Apres))}</td><td>${esc(a.Commentaire||'—')}</td></tr>`).join('')||'<tr><td colspan="4">Aucun changement tracé depuis l’installation de la V0.5.</td></tr>';
 renderDossierRdv();
 renderDossierDocuments();
 $('suivi-existing-person').innerHTML='<option value="">Choisir une personne existante…</option>'+tab('PERSONNES').map(x=>`<option value="${x.id}">${esc(x.Libelle)}</option>`).join('');
}
function openPersonForm(){$('person-form').reset();$('person-role').innerHTML=roleOptions.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('person-modal').classList.remove('hidden');}
function closePersonForm(){$('person-modal').classList.add('hidden');}
async function savePerson(e){e.preventDefault();if(state.busy)return;const dossier=Number(state.dossierSuivi);if(!byId('SIGNALEMENTS',dossier))return notify('Dossier introuvable.');const libelle=$('person-label').value.trim(),categorie=$('person-category').value.trim(),role=$('person-role').value;if(!libelle||!role)return notify('Complétez le libellé et le rôle.');state.busy=true;$('person-save').disabled=true;try{
 const code=`PER-${Date.now()}-${Math.floor(Math.random()*100000)}`;await grist.docApi.applyUserActions([['AddRecord','PERSONNES',null,{Code:code,Libelle:libelle,Categorie:categorie,Commentaire:''}]]);
 const people=rowsFrom(await grist.docApi.fetchTable('PERSONNES'));const person=people.find(x=>x.Code===code);if(!person)throw Error('Personne enregistrée mais introuvable : vérifier PERSONNES.');
 await grist.docApi.applyUserActions([['AddRecord','SIGNALEMENT_PERSONNES',null,{Signalement:dossier,Personne:person.id,Role:role}]]);closePersonForm();await refresh();notify('Personne fictive et rôle associés au dossier.',true);
 }catch(err){notify('Erreur ou enregistrement partiel : '+err.message);}finally{state.busy=false;$('person-save').disabled=false;}}
async function linkPerson(e){e.preventDefault();if(state.busy)return;const person=Number($('suivi-existing-person').value),dossier=Number(state.dossierSuivi),role=$('suivi-existing-role').value;if(!person||!role)return notify('Choisis une personne et un rôle.');if(dossierLinks().some(l=>Number(l.Personne)===person&&l.Role===role))return notify('Cette association existe déjà.');state.busy=true;try{await grist.docApi.applyUserActions([['AddRecord','SIGNALEMENT_PERSONNES',null,{Signalement:dossier,Personne:person,Role:role}]]);await refresh();notify('Personne associée au dossier.',true);}catch(err){notify('Association impossible : '+err.message);}finally{state.busy=false;}}
async function detachPerson(id){if(!confirm('Retirer cette association du dossier ? La fiche PERSONNES sera conservée.'))return;try{await grist.docApi.applyUserActions([['RemoveRecord','SIGNALEMENT_PERSONNES',id]]);await refresh();notify('Association retirée.',true);}catch(err){notify('Retrait impossible : '+err.message);}}
async function saveAction(e){e.preventDefault();if(state.busy)return;const dossier=Number(state.dossierSuivi);const desc=$('action-description').value.trim();const date=$('action-date').value;const ts=Date.parse(date+'T00:00:00Z')/1000;if(!desc||!Number.isFinite(ts))return notify('Renseigne une date et une description.');const fields={Signalement:dossier,Date_Action:ts,Type_Action:$('action-type').value,Description:desc,Etat:$('action-etat').value};state.busy=true;$('action-save').disabled=true;try{await grist.docApi.applyUserActions([['AddRecord','ACTIONS',null,fields]]);$('action-form').reset();$('action-date').value=new Date().toISOString().slice(0,10);await refresh();notify('Action ajoutée au suivi.',true);}catch(err){notify('Enregistrement de l’action impossible : '+err.message);}finally{state.busy=false;$('action-save').disabled=false;}}
$('suivi-back').onclick=()=>show('dossiers');$('suivi-add-person').onclick=openPersonForm;$('person-close').onclick=closePersonForm;$('person-cancel').onclick=closePersonForm;$('person-form').addEventListener('submit',savePerson);$('existing-person-form').addEventListener('submit',linkPerson);$('action-form').addEventListener('submit',saveAction);$('action-type').innerHTML=typeActions.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('action-date').value=new Date().toISOString().slice(0,10);$('suivi-existing-role').innerHTML=roleOptions.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');document.addEventListener('click',e=>{const open=e.target.closest('[data-suivi]');if(open)openSuivi(Number(open.dataset.suivi));const detach=e.target.closest('[data-detach]');if(detach)detachPerson(Number(detach.dataset.detach));});$('person-modal').addEventListener('click',e=>{if(e.target===$('person-modal'))closePersonForm();});


// V0.6 — agenda administrateur, données fictives uniquement. Stockage des horodatages en secondes Unix.
const RDV_TYPES = ['Entretien','Réunion','Échange téléphonique','Visioconférence','Échéance','Relance','Autre'];
const RDV_STATUTS = ['Prévu','Confirmé','Reporté','Réalisé','Annulé'];
const two = n => String(n).padStart(2,'0');
function localDateTime(ts){if(!ts)return '';const d=new Date(Number(ts)*1000);return `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}T${two(d.getHours())}:${two(d.getMinutes())}`;}
function prettyDateTime(ts){if(!ts)return '—';return new Date(Number(ts)*1000).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});}
function safeDay(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function agendaBounds(){const anchor=safeDay(state.agendaDate);let begin,end;
 if(state.agendaMode==='jour'){begin=anchor;end=new Date(anchor);end.setDate(end.getDate()+1);}
 else if(state.agendaMode==='mois'){begin=new Date(anchor.getFullYear(),anchor.getMonth(),1);end=new Date(anchor.getFullYear(),anchor.getMonth()+1,1);}
 else {begin=new Date(anchor);begin.setDate(begin.getDate()-(begin.getDay()+6)%7);end=new Date(begin);end.setDate(end.getDate()+7);}
 return [begin,end];}
function rdvList(){return tab('RENDEZ_VOUS').slice().sort((x,y)=>Number(x.Debut)-Number(y.Debut));}
function rdvLine(r,forDossier=false){const d=byId('SIGNALEMENTS',r.Signalement),resp=byId('UTILISATEURS',r.Responsable);const num=d?.Numero||'Dossier introuvable';
 return `<tr><td>${esc(prettyDateTime(r.Debut))}</td><td>${esc(prettyDateTime(r.Fin))}</td>${forDossier?'':`<td>${esc(num)}</td>`}<td>${esc(r.Type_Evenement)}</td><td>${esc(r.Objet||'—')}</td><td>${esc(resp?.Libelle||'—')}</td><td>${esc(r.Statut||'—')}</td><td><button type="button" class="row-button" data-rdv-edit="${r.id}">Modifier</button></td></tr>`;}
function renderAgenda(){const [begin,end]=agendaBounds();$('agenda-range').textContent=begin.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})+' — '+new Date(end.getTime()-1000).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
 $('agenda-mode').value=state.agendaMode;
 const dFilter=Number($('agenda-dossier').value)||0;const sFilter=$('agenda-status').value;
 const rows=rdvList().filter(r=>Number(r.Debut)>=begin.getTime()/1000&&Number(r.Debut)<end.getTime()/1000&&(!dFilter||Number(r.Signalement)===dFilter)&&(!sFilter||r.Statut===sFilter));
 $('agenda-count').textContent=`${rows.length} événement(s)`;
 $('agenda-rows').innerHTML=rows.map(r=>rdvLine(r)).join('')||'<tr><td colspan="8">Aucun rendez-vous sur cette période.</td></tr>';
}
function renderDossierRdv(){if(!$('suivi-rdv'))return;const rows=rdvList().filter(r=>Number(r.Signalement)===Number(state.dossierSuivi));$('suivi-rdv').innerHTML=rows.map(r=>rdvLine(r,true)).join('')||'<tr><td colspan="7">Aucun rendez-vous pour ce dossier.</td></tr>';}
function fillRdvSelects(){const dossiers=tab('SIGNALEMENTS').slice().sort((a,b)=>String(a.Numero).localeCompare(String(b.Numero)));
 const opts=dossiers.map(d=>`<option value="${d.id}">${esc(d.Numero)} — ${esc(d.Objet||'')}</option>`).join('');
 const old=$('agenda-dossier').value;$('agenda-dossier').innerHTML='<option value="">Tous les dossiers</option>'+opts;$('agenda-dossier').value=old;
 $('rdv-dossier').innerHTML='<option value="">Choisir un dossier…</option>'+opts;
 $('rdv-responsable').innerHTML='<option value="">Aucun responsable défini</option>'+tab('UTILISATEURS').filter(u=>Number(u.Actif)!==0).map(u=>`<option value="${u.id}">${esc(u.Libelle||u.Email||'Référent')}</option>`).join('');
 $('rdv-type').innerHTML=RDV_TYPES.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
 $('rdv-statut').innerHTML=RDV_STATUTS.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');}
function fillRdvParticipants(rdvId,dossier){
 const allowed=new Set(tab('SIGNALEMENT_PERSONNES').filter(l=>Number(l.Signalement)===Number(dossier)).map(l=>Number(l.Personne)));
 const selected=new Set(tab('PARTICIPANTS_RDV').filter(l=>Number(l.Rendez_Vous)===Number(rdvId)).map(l=>Number(l.Personne)));
 const persons=tab('PERSONNES').filter(p=>allowed.has(Number(p.id)));
 $('rdv-personnes').innerHTML=persons.map(p=>`<label><input type="checkbox" name="rdv-personne" value="${p.id}" ${selected.has(Number(p.id))?'checked':''}> ${esc(p.Libelle)}</label>`).join('')||'<span class="muted">Aucune personne associée au dossier. Vous pouvez en ajouter dans le module Suivi.</span>';
}
function openRdv(id=null,dossier=null){$('rdv-form').reset();$('rdv-id').value=id||'';fillRdvSelects();const rec=id?byId('RENDEZ_VOUS',id):null;
 $('rdv-title').textContent=rec?'Modifier un rendez-vous':'Nouveau rendez-vous';
 const now=new Date();now.setMinutes(Math.ceil(now.getMinutes()/15)*15,0,0);const later=new Date(now.getTime()+60*60000);
 $('rdv-dossier').value=rec?.Signalement||dossier||'';
 $('rdv-objet').value=rec?.Objet||'';$('rdv-type').value=rec?.Type_Evenement||'Entretien';
 $('rdv-debut').value=rec?localDateTime(rec.Debut):localDateTime(now.getTime()/1000);$('rdv-fin').value=rec?localDateTime(rec.Fin):localDateTime(later.getTime()/1000);
 $('rdv-responsable').value=rec?.Responsable||'';$('rdv-statut').value=rec?.Statut||'Prévu';
 $('rdv-modalite').value=rec?.Modalite||'Présentiel';$('rdv-lieu').value=rec?.Lieu||'';$('rdv-commentaire').value=rec?.Commentaire||'';
 fillRdvParticipants(id,rec?.Signalement||dossier);$('rdv-delete').classList.toggle('hidden',!rec||rec.Statut==='Annulé');$('rdv-modal').classList.remove('hidden');}
function closeRdv(){$('rdv-modal').classList.add('hidden');}
function overlap(start,end,a,b){return start<b&&end>a;}
async function saveRdv(ev){ev.preventDefault();if(state.busy)return;
 const id=Number($('rdv-id').value)||null;const debut=Date.parse($('rdv-debut').value)/1000,fin=Date.parse($('rdv-fin').value)/1000;
 const dossier=Number($('rdv-dossier').value),responsable=Number($('rdv-responsable').value)||0;
 if(!byId('SIGNALEMENTS',dossier)||!Number.isFinite(debut)||!Number.isFinite(fin)||fin<=debut)return notify('Choisis un dossier, un début et une fin postérieure au début.');
 if(fin-debut>7*86400)return notify('Un rendez-vous ne peut pas durer plus de 7 jours dans ce prototype.');
 const statut=$('rdv-statut').value;
 const participants=[...document.querySelectorAll('input[name="rdv-personne"]:checked')].map(el=>Number(el.value));
 const conflicts=responsable&&statut!=='Annulé'?rdvList().filter(r=>Number(r.id)!==id&&Number(r.Responsable)===responsable&&r.Statut!=='Annulé'&&overlap(debut,fin,Number(r.Debut),Number(r.Fin))):[];
 if(conflicts.length&&!confirm(`Conflit horaire : ce référent a ${conflicts.length} autre(s) événement(s) sur ce créneau. Enregistrer malgré tout ?`))return;
 const fields={Signalement:dossier,Objet:$('rdv-objet').value.trim(),Type_Evenement:$('rdv-type').value,Debut:debut,Fin:fin,Responsable:responsable||null,Statut:statut,Modalite:$('rdv-modalite').value,Lieu:$('rdv-lieu').value.trim(),Commentaire:$('rdv-commentaire').value.trim()};
 if(!fields.Objet)return notify('Renseigne un objet synthétique.');
 if(!id){fields.Date_Creation=Math.floor(Date.now()/1000);fields.Code='RDV-'+Date.now()+'-'+Math.floor(Math.random()*1e8);}
 state.busy=true;$('rdv-save').disabled=true;
 try {await grist.docApi.applyUserActions([[id?'UpdateRecord':'AddRecord','RENDEZ_VOUS',id,fields]]);
 const records=rowsFrom(await grist.docApi.fetchTable('RENDEZ_VOUS'));
 const rid=id||(records.find(r=>r.Code===fields.Code)?.id);
 if(!rid)throw new Error('Événement créé, mais identifiant introuvable pour associer les participants.');
 const old=rowsFrom(await grist.docApi.fetchTable('PARTICIPANTS_RDV')).filter(r=>Number(r.Rendez_Vous)===Number(rid));
 const oldIds=new Set(old.map(r=>Number(r.Personne))),wanted=new Set(participants);
 const ops=[...old.filter(r=>!wanted.has(Number(r.Personne))).map(r=>['RemoveRecord','PARTICIPANTS_RDV',r.id]),...participants.filter(pid=>!oldIds.has(pid)).map(pid=>['AddRecord','PARTICIPANTS_RDV',null,{Rendez_Vous:Number(rid),Personne:pid}])];
 if(ops.length)await grist.docApi.applyUserActions(ops);
 closeRdv();await refresh();notify('Rendez-vous et participants enregistrés dans Grist.',true);}
 catch(err){notify('Enregistrement du rendez-vous impossible : '+err.message);}
 finally{state.busy=false;$('rdv-save').disabled=false;}}
async function cancelRdv(){const id=Number($('rdv-id').value);if(!id||!confirm('Annuler cet événement ? Il restera conservé dans l’agenda.'))return;
 if(state.busy)return;state.busy=true;
 try{await grist.docApi.applyUserActions([['UpdateRecord','RENDEZ_VOUS',id,{Statut:'Annulé'}]]);closeRdv();await refresh();notify('Rendez-vous annulé, historique de la ligne conservé.',true);}
 catch(err){notify('Annulation impossible : '+err.message);}finally{state.busy=false;}}
function moveAgenda(direction){const d=new Date(state.agendaDate);if(state.agendaMode==='jour')d.setDate(d.getDate()+direction);else if(state.agendaMode==='mois')d.setMonth(d.getMonth()+direction);else d.setDate(d.getDate()+7*direction);state.agendaDate=d;renderAgenda();}
$('agenda-mode').onchange=e=>{state.agendaMode=e.target.value;renderAgenda();};
$('agenda-prev').onclick=()=>moveAgenda(-1);$('agenda-next').onclick=()=>moveAgenda(1);$('agenda-today').onclick=()=>{state.agendaDate=new Date();renderAgenda();};
$('agenda-dossier').onchange=renderAgenda;$('agenda-status').onchange=renderAgenda;
$('agenda-add').onclick=()=>openRdv();$('suivi-add-rdv').onclick=()=>openRdv(null,state.dossierSuivi);
$('rdv-close').onclick=closeRdv;$('rdv-cancel').onclick=closeRdv;$('rdv-form').addEventListener('submit',saveRdv);
$('rdv-delete').onclick=cancelRdv;
$('rdv-dossier').addEventListener('change',e=>fillRdvParticipants(Number($('rdv-id').value),Number(e.target.value))); 
$('rdv-modal').addEventListener('click',e=>{if(e.target===$('rdv-modal'))closeRdv();});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-rdv-edit]');if(btn)openRdv(Number(btn.dataset.rdvEdit));});


// SIGMA V0.7 — métadonnées et versions de comptes rendus, sans pièce jointe ni partage externe.
const docVersions = docId => tab('VERSIONS_DOCUMENTS').filter(v=>Number(v.Document)===Number(docId)).sort((a,b)=>Number(b.Numero_Version)-Number(a.Numero_Version));
const docsByDossier = id => tab('DOCUMENTS').filter(d=>Number(d.Signalement)===Number(id)).sort((a,b)=>Number(b.id)-Number(a.id));
function docRow(d, inSuivi=false){
  const vers=docVersions(d.id),latest=vers[0];
  const dossier=byId('SIGNALEMENTS',d.Signalement);
  return `<tr>${inSuivi?'':`<td>${esc(dossier?.Numero||'—')}</td>`}<td>${esc(d.Titre)}</td><td>${esc(d.Type_Document)}</td><td>${esc(d.Statut)}</td><td>${latest?'v'+esc(latest.Numero_Version):'—'}</td><td><button type="button" class="row-button" data-doc-open="${d.id}">Ouvrir</button></td></tr>`;
}
function fillDocumentSelects(){
  const opts=tab('SIGNALEMENTS').slice().sort((a,b)=>String(a.Numero).localeCompare(String(b.Numero))).map(d=>`<option value="${d.id}">${esc(d.Numero)} — ${esc(d.Objet)}</option>`).join('');
  $('document-dossier').innerHTML='<option value="">Choisir un dossier…</option>'+opts;
  $('documents-dossier').innerHTML='<option value="">Tous les dossiers</option>'+opts;
}
function renderDocuments(){
  const dossier=$('documents-dossier').value,statut=$('documents-statut').value;
  const docs=tab('DOCUMENTS').filter(d=>(!dossier||Number(d.Signalement)===Number(dossier))&&(!statut||d.Statut===statut));
  $('documents-rows').innerHTML=docs.map(d=>docRow(d)).join('')||'<tr><td colspan="6">Aucun document.</td></tr>';
}
function renderDossierDocuments(){
  if(!$('suivi-documents'))return;
  $('suivi-documents').innerHTML=docsByDossier(state.dossierSuivi).map(d=>docRow(d,true)).join('')||'<tr><td colspan="5">Aucun compte rendu pour ce dossier.</td></tr>';
}
function currentDoc(){return byId('DOCUMENTS',Number($('document-id').value));}
function renderVersions(doc){
  const versions=docVersions(doc.id);
  $('document-versions').classList.remove('hidden');
  $('document-versions-list').innerHTML=versions.map(v=>`<div class="version-entry"><div><strong>Version ${esc(v.Numero_Version)} — ${esc(v.Statut)}</strong><small>${prettyDateTime(v.Date_Version)} · ${esc(v.Auteur||'Auteur non renseigné')}</small></div><button type="button" class="row-button" data-doc-version="${v.id}">Consulter</button></div>`).join('')||'<p>Aucune version.</p>';
}
function docEditMode(doc){
  const readonly=!!doc&&doc.Statut==='Validé';
  for(const id of ['document-dossier','document-type','document-name','document-content','document-author'])$(id).disabled=readonly;
  $('document-save').classList.toggle('hidden',readonly);
  $('document-validate').classList.toggle('hidden',readonly);
  $('document-revision').classList.toggle('hidden',!readonly);
}
function openDocument(id=null,dossier=null){
  $('document-form').reset();$('document-id').value=id||'';
  fillDocumentSelects();
  const doc=id?byId('DOCUMENTS',id):null;
  if(id&&!doc)return notify('Document introuvable.');
  $('document-title').textContent=doc?`Document — ${doc.Titre}`:'Nouveau compte rendu';
  $('document-dossier').value=doc?.Signalement||dossier||'';
  $('document-type').value=doc?.Type_Document||"Compte rendu d'entretien";
  $('document-name').value=doc?.Titre||'';
  $('document-author').value='Widget SIGMA (non certifié)';
  const versions=doc?docVersions(doc.id):[];
  $('document-content').value=versions[0]?.Contenu||'';
  if(doc)renderVersions(doc);else{$('document-versions').classList.add('hidden');$('document-versions-list').innerHTML='';}
  docEditMode(doc);renderDocumentCollaboration(doc);$('document-modal').classList.remove('hidden');
}
function closeDocument(){$('document-modal').classList.add('hidden');}
async function saveDocument(validate=false){
  if(state.busy)return;
  const doc=currentDoc(),dossier=Number($('document-dossier').value);
  const titre=$('document-name').value.trim(),content=$('document-content').value.trim(),type=$('document-type').value,author=$('document-author').value.trim()||'Widget SIGMA (non certifié)';
  if(!byId('SIGNALEMENTS',dossier)||!titre||!content)return notify('Renseigne un dossier, un titre et le contenu.');
  if(doc&&doc.Statut==='Validé')return notify('Le document est validé. Utilise « Nouvelle révision » pour créer un brouillon.');
  if(content.length>30000)return notify('Le texte dépasse 30 000 caractères.');
  const now=Math.floor(Date.now()/1000),status=validate?'Validé':'Brouillon';
  state.busy=true;$('document-save').disabled=true;$('document-validate').disabled=true;
  try{
    let docId=doc?.id;
    if(!docId){
      await grist.docApi.applyUserActions([['AddRecord','DOCUMENTS',null,{Signalement:dossier,Titre:titre,Type_Document:type,Statut:'Brouillon',Date_Creation:now,Date_Validation:null,Version_Courante:0}]]);
      const fresh=rowsFrom(await grist.docApi.fetchTable('DOCUMENTS'));
      docId=fresh.filter(d=>Number(d.Signalement)===dossier&&d.Titre===titre&&Number(d.Date_Creation)===now).sort((a,b)=>b.id-a.id)[0]?.id;
      if(!docId)throw new Error('Métadonnées enregistrées, mais identifiant introuvable. Vérifier DOCUMENTS avant de recommencer.');
    }
    // Ne jamais écraser une version : chaque enregistrement crée une nouvelle ligne.
    const freshVers=rowsFrom(await grist.docApi.fetchTable('VERSIONS_DOCUMENTS'));
    const next=Math.max(0,...freshVers.filter(v=>Number(v.Document)===Number(docId)).map(v=>Number(v.Numero_Version)||0))+1;
    await grist.docApi.applyUserActions([
      ['AddRecord','VERSIONS_DOCUMENTS',null,{Document:Number(docId),Numero_Version:next,Contenu:content,Statut:status,Date_Version:now,Auteur:author}],
      ['UpdateRecord','DOCUMENTS',Number(docId),{Signalement:dossier,Titre:titre,Type_Document:type,Statut:status,Version_Courante:next,Date_Validation:validate?now:null}]
    ]);
    const verify=rowsFrom(await grist.docApi.fetchTable('VERSIONS_DOCUMENTS'));
    if(!verify.some(v=>Number(v.Document)===Number(docId)&&Number(v.Numero_Version)===next&&v.Contenu===content&&v.Statut===status))throw new Error('Version non retrouvée après écriture ; contrôle manuel nécessaire.');
    closeDocument();await refresh();notify(`Document ${status.toLowerCase()} — version ${next} enregistrée et vérifiée.`,true);
  }catch(e){notify('Erreur ou écriture partielle du compte rendu : '+e.message+' Vérifie DOCUMENTS et VERSIONS_DOCUMENTS avant toute nouvelle tentative.');}
  finally{state.busy=false;$('document-save').disabled=false;$('document-validate').disabled=false;}
}
async function startRevision(){
  const doc=currentDoc();if(!doc||doc.Statut!=='Validé'||state.busy)return;
  if(!confirm('Créer une nouvelle révision en brouillon ? La version validée sera conservée dans VERSIONS_DOCUMENTS.'))return;
  state.busy=true;$('document-revision').disabled=true;
  try{
    await grist.docApi.applyUserActions([['UpdateRecord','DOCUMENTS',doc.id,{Statut:'Brouillon',Date_Validation:null}]]);
    await refresh();openDocument(doc.id);notify('Révision ouverte en brouillon. Le contenu validé précédent reste conservé dans les versions.',true);
  }catch(e){notify('Impossible de préparer la révision : '+e.message);}
  finally{state.busy=false;$('document-revision').disabled=false;}
}
function viewDocumentVersion(id){
  const doc=currentDoc(),v=byId('VERSIONS_DOCUMENTS',id);
  if(!doc||!v||Number(v.Document)!==Number(doc.id))return notify('Version indisponible.');
  $('version-title').textContent=`${doc.Titre} — version ${v.Numero_Version}`;
  $('version-metadata').textContent=`${byId('SIGNALEMENTS',doc.Signalement)?.Numero||''} · ${v.Statut} · ${prettyDateTime(v.Date_Version)} · ${v.Auteur||'Auteur non renseigné'}`;
  $('version-content').textContent=v.Contenu||'';
  $('version-modal').classList.remove('hidden');
}
$('version-close').onclick=()=>$('version-modal').classList.add('hidden');
$('version-modal').addEventListener('click',e=>{if(e.target===$('version-modal'))$('version-modal').classList.add('hidden');});
$('documents-add').onclick=()=>openDocument();
$('suivi-add-document').onclick=()=>openDocument(null,state.dossierSuivi);
$('documents-dossier').onchange=renderDocuments;$('documents-statut').onchange=renderDocuments;
$('document-close').onclick=closeDocument;$('document-cancel').onclick=closeDocument;
$('document-form').addEventListener('submit',e=>{e.preventDefault();saveDocument(false);});
$('document-validate').onclick=()=>saveDocument(true);
$('document-revision').onclick=startRevision;
$('document-modal').addEventListener('click',e=>{if(e.target===$('document-modal'))closeDocument();});
document.addEventListener('click',e=>{
  const d=e.target.closest('[data-doc-open]');if(d)openDocument(Number(d.dataset.docOpen));
  const v=e.target.closest('[data-doc-version]');if(v)viewDocumentVersion(Number(v.dataset.docVersion));
});


// SIGMA V0.8 — commentaires INTERNES et projets de partage, sans ouverture d'accès externe.
// Aucune URL ni autorisation Grist n'est créée par ce registre préparatoire.
const documentComments = docId => tab('COMMENTAIRES_DOCUMENTS').filter(c=>Number(c.Document)===Number(docId)).sort((a,b)=>Number(a.Date_Commentaire)-Number(b.Date_Commentaire)||a.id-b.id);
const documentShares = docId => tab('PARTAGES_DOCUMENTS').filter(p=>Number(p.Document)===Number(docId)).sort((a,b)=>b.id-a.id);
function renderDocumentCollaboration(doc){
  const available=!!doc;
  $('document-collaboration').classList.toggle('hidden',!available);
  if(!available)return;
  $('comment-doc-id').value=doc.id;
  $('share-doc-id').value=doc.id;
  const versions=docVersions(doc.id);
  $('comment-version').innerHTML=versions.map(v=>`<option value="${v.id}" ${Number(v.Numero_Version)===Number(doc.Version_Courante)?'selected':''}>Version ${esc(v.Numero_Version)} — ${esc(v.Statut)}</option>`).join('');
  const comments=documentComments(doc.id);
  $('document-comments-list').innerHTML=comments.map(c=>{
    const version=byId('VERSIONS_DOCUMENTS',c.Version);
    const resolved=c.Etat==='Résolu';
    return `<div class="collab-item"><div><strong>${esc(c.Auteur||'Auteur non renseigné')}</strong> <span class="pill ${resolved?'done':'wait'}">${esc(c.Etat||'Actif')}</span><small>${prettyDateTime(c.Date_Commentaire)} · Version ${esc(version?.Numero_Version||'?')}</small><p class="comment-text">${esc(c.Contenu)}</p></div>${resolved?'':`<button type="button" class="row-button" data-comment-resolve="${c.id}">Résoudre</button>`}</div>`;
  }).join('')||'<p class="muted">Aucun commentaire interne pour ce document.</p>';
  const shareVersions=versions.filter(v=>v.Statut==='Validé');
  $('share-version').innerHTML=shareVersions.map(v=>`<option value="${v.id}">Version ${esc(v.Numero_Version)} — validée ${prettyDateTime(v.Date_Version)}</option>`).join('') || '<option value="">Aucune version validée</option>';
  $('share-save').disabled=doc.Statut!=='Validé'||!shareVersions.length;
  const shares=documentShares(doc.id);
  const now=Date.now()/1000;
  $('document-shares-list').innerHTML=shares.map(p=>{
    const ver=byId('VERSIONS_DOCUMENTS',p.Version);
    const expired=Number(p.Expiration)>0 && Number(p.Expiration)+86400<=now;
    const status=expired&&p.Statut==='Projet'?'Échéance dépassée (projet)':p.Statut;
    const history=tab('HISTORIQUE_PARTAGES').filter(e=>Number(e.Partage)===Number(p.id)).sort((a,b)=>Number(b.Date_Evenement)-Number(a.Date_Evenement)||b.id-a.id);
    const actions=p.Statut==='Projet' ? `<button type="button" class="row-button" data-share-review="${p.id}" ${expired||!ver?'disabled':''}>Vérifier</button> <button type="button" class="row-button" data-share-reject="${p.id}">Refuser</button> <button type="button" class="row-button" data-share-cancel="${p.id}">Annuler</button>` : (p.Statut==='Vérifié' ? `<button type="button" class="row-button" data-share-cancel="${p.id}">Révoquer la demande</button>` : '');
    return `<div class="collab-item"><div><strong>${esc(p.Destinataire)}</strong> <span class="pill ${['Annulé','Refusé'].includes(p.Statut)?'done':'wait'}">${esc(status)}</span><small>${esc(p.Email)} · ${esc(p.Droit)} · ${ver?'Version '+esc(ver.Numero_Version):'Version non spécifiée (ancien projet)'} · échéance ${dateText(p.Expiration)} · ${prettyDateTime(p.Date_Creation)}</small><p class="comment-text">${esc(p.Message||'Aucun message')}</p><p class="muted"><strong>Aucun accès ni lien créé, quel que soit le statut.</strong></p><details class="share-log"><summary>Historique des décisions (${history.length})</summary>${history.map(e=>`<p><small>${prettyDateTime(e.Date_Evenement)} · ${esc(e.Action)} · ${esc(e.Auteur)} — ${esc(e.Motif||'Sans motif')}</small></p>`).join('')||'<p>Aucune décision enregistrée.</p>'}</details></div><div class="share-actions">${actions}</div></div>`;
  }).join('')||'<p class="muted">Aucune demande de partage enregistrée.</p>';
}
async function reloadDocumentCollaboration(docId){
  for(const name of ['COMMENTAIRES_DOCUMENTS','PARTAGES_DOCUMENTS','HISTORIQUE_PARTAGES'])state.data[name]=rowsFrom(await grist.docApi.fetchTable(name));
  renderDocumentCollaboration(byId('DOCUMENTS',docId));
}
async function addDocumentComment(ev){
  ev.preventDefault();if(state.busy)return;
  const docId=Number($('comment-doc-id').value),doc=byId('DOCUMENTS',docId);
  const versionId=Number($('comment-version').value),version=byId('VERSIONS_DOCUMENTS',versionId);
  const author=$('comment-author').value.trim(),content=$('comment-content').value.trim();
  if(!doc||!version||Number(version.Document)!==docId||!author||!content)return notify('Commentaire non enregistré : document, version, auteur ou contenu manquant.');
  if(content.length>3000||author.length>120)return notify('Commentaire trop long.');
  const btn=$('comment-save');state.busy=true;btn.disabled=true;
  try{
    const now=Math.floor(Date.now()/1000);
    await grist.docApi.applyUserActions([['AddRecord','COMMENTAIRES_DOCUMENTS',null,{Document:docId,Version:versionId,Auteur:author,Contenu:content,Date_Commentaire:now,Etat:'Actif',Interne:1}]]);
    await reloadDocumentCollaboration(docId);
    const saved=documentComments(docId).some(c=>Number(c.Version)===versionId&&c.Contenu===content&&c.Auteur===author&&c.Etat==='Actif'&&Number(c.Date_Commentaire)===now);
    if(!saved)throw new Error('Commentaire non retrouvé après écriture.');
    $('comment-content').value='';notify('Commentaire interne enregistré et vérifié.',true);
  }catch(e){notify('Écriture du commentaire incertaine : '+e.message+' Vérifiez la table avant de recommencer.');}
  finally{state.busy=false;btn.disabled=false;}
}
async function prepareDocumentShare(ev){
  ev.preventDefault();if(state.busy)return;
  const docId=Number($('share-doc-id').value),doc=byId('DOCUMENTS',docId);
  const name=$('share-name').value.trim(),email=$('share-email').value.trim().toLowerCase();
  const right=$('share-right').value,expiry=$('share-expiry').value,message=$('share-message').value.trim();
  const versionId=Number($('share-version').value),version=byId('VERSIONS_DOCUMENTS',versionId);
  if(!doc||doc.Statut!=='Validé')return notify('Un projet de partage nécessite un document actuellement validé.');
  if(!version||Number(version.Document)!==docId||version.Statut!=='Validé')return notify('Choisissez une version validée appartenant à ce compte rendu.');
  if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['lecture','commentaire'].includes(right)||!expiry)return notify('Renseignez le destinataire, une adresse valide, un droit et une échéance.');
  const expiryTs=Date.parse(expiry+'T00:00:00Z')/1000;
  if(!Number.isFinite(expiryTs)||expiryTs + 86400<=Date.now()/1000)return notify('La date d’expiration ne peut pas être passée.');
  if(name.length>120||email.length>200||message.length>500)return notify('Un champ dépasse sa longueur maximale.');
  const btn=$('share-save');state.busy=true;btn.disabled=true;
  try{
    const now=Math.floor(Date.now()/1000);
    await grist.docApi.applyUserActions([['AddRecord','PARTAGES_DOCUMENTS',null,{Document:docId,Version:versionId,Destinataire:name,Email:email,Droit:right,Expiration:expiryTs,Message:message,Statut:'Projet',Date_Creation:now,Auteur:'Widget SIGMA (non certifié)'}]]);
    await reloadDocumentCollaboration(docId);
    if(!documentShares(docId).some(p=>p.Email===email&&p.Statut==='Projet'&&Number(p.Date_Creation)===now))throw new Error('Projet non retrouvé après écriture.');
    $('share-form').reset();$('share-doc-id').value=docId;
    notify('Projet de partage enregistré. Aucun accès, courriel ou lien n’a été créé.',true);
  }catch(e){notify('Enregistrement du projet de partage incertain : '+e.message+' Vérifiez la table avant de recommencer.');}
  finally{state.busy=false;btn.disabled=false;}
}
// V0.9 : décision interne journalisée. Il n'existe toujours PAS de droit externe.
async function decideShare(id,nextStatus,reason){
  if(state.busy)return;
  const share=byId('PARTAGES_DOCUMENTS',id),doc=currentDoc();
  if(!share||!doc||Number(share.Document)!==Number(doc.id))return notify('Demande de partage introuvable.');
  if(!['Projet','Vérifié'].includes(share.Statut))return notify('Demande déjà clôturée.');
  if(nextStatus==='Vérifié'){
    const version=byId('VERSIONS_DOCUMENTS',share.Version);
    if(share.Statut!=='Projet'||!version||Number(version.Document)!==Number(doc.id)||version.Statut!=='Validé'||doc.Statut!=='Validé')return notify('Vérification impossible : document/version non validé ou ancienne demande sans version.');
    if(Number(share.Expiration)+86400<=Date.now()/1000)return notify('Échéance dépassée : annulez et recréez une demande.');
  }
  if(nextStatus==='Refusé'&&share.Statut!=='Projet')return notify('Seuls les projets peuvent être refusés.');
  if(nextStatus==='Annulé'&&!['Projet','Vérifié'].includes(share.Statut))return notify('Annulation impossible.');
  if(!reason||!reason.trim())return notify('Une justification est nécessaire.');
  const now=Math.floor(Date.now()/1000),author='Widget SIGMA (identité non certifiée)';
  state.busy=true;
  try{
    await grist.docApi.applyUserActions([
      ['UpdateRecord','PARTAGES_DOCUMENTS',id,{Statut:nextStatus}],
      ['AddRecord','HISTORIQUE_PARTAGES',null,{Partage:id,Action:nextStatus,Statut_Avant:share.Statut,Date_Evenement:now,Auteur:author,Motif:reason.trim().slice(0,500)}]
    ]);
    await reloadDocumentCollaboration(doc.id);
    const updated=byId('PARTAGES_DOCUMENTS',id);
    const logged=tab('HISTORIQUE_PARTAGES').some(e=>Number(e.Partage)===id&&e.Action===nextStatus&&Number(e.Date_Evenement)===now);
    if(updated?.Statut!==nextStatus||!logged)throw new Error('Mise à jour ou historique non retrouvé après écriture.');
    notify('Décision enregistrée et journalisée. Aucun droit ni accès externe créé.',true);
  }catch(e){notify('Décision non confirmée : '+e.message+' Vérifiez les deux tables avant de réessayer.');}
  finally{state.busy=false;}
}
async function changeCollabStatus(table,id,fields,docId,label){
  if(state.busy)return;state.busy=true;
  try{
    await grist.docApi.applyUserActions([['UpdateRecord',table,id,fields]]);
    await reloadDocumentCollaboration(docId);
    const item=byId(table,id);
    if(!item||Object.entries(fields).some(([k,v])=>item[k]!==v))throw new Error('Statut non retrouvé après écriture.');
    notify(label,true);
  }catch(e){notify('Modification incertaine : '+e.message);}
  finally{state.busy=false;}
}
$('comment-form').addEventListener('submit',addDocumentComment);
$('share-form').addEventListener('submit',prepareDocumentShare);
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-comment-resolve]');
  if(c){const id=Number(c.dataset.commentResolve),item=byId('COMMENTAIRES_DOCUMENTS',id),doc=currentDoc();
    if(item&&doc&&Number(item.Document)===Number(doc.id)&&confirm('Marquer ce commentaire comme résolu ?'))changeCollabStatus('COMMENTAIRES_DOCUMENTS',id,{Etat:'Résolu'},doc.id,'Commentaire résolu.');}
  for(const [selector,status] of [['[data-share-review]','Vérifié'],['[data-share-reject]','Refusé'],['[data-share-cancel]','Annulé']]){
    const b=e.target.closest(selector);if(!b)continue;
    const id=Number(b.dataset.shareReview||b.dataset.shareReject||b.dataset.shareCancel);
    const reason=prompt(status==='Vérifié'?'Justification de la vérification interne (aucun accès accordé) :':status==='Refusé'?'Motif du refus :':'Motif de l’annulation ou de la révocation de la demande :');
    if(reason!==null)decideShare(id,status,reason);break;
  }
});

for(const el of document.querySelectorAll('.nav'))el.addEventListener('click',()=>show(el.dataset.view));$('add').onclick=()=>openForm();$('close').onclick=closeForm;$('cancel').onclick=closeForm;$('refresh').onclick=refresh;$('all').onclick=()=>show('dossiers');$('record-form').addEventListener('submit',save);for(const id of ['search','filter-status','filter-motif'])$(id).addEventListener(id==='search'?'input':'change',render);$('clear').onclick=()=>{$('search').value='';$('filter-status').value='';$('filter-motif').value='';render();};document.addEventListener('click',ev=>{const button=ev.target.closest('[data-edit]');if(button)openForm(Number(button.dataset.edit));});$('run-audit').onclick=refresh;$('add-user').onclick=()=>editUser();$('user-close').onclick=closeUser;$('user-cancel').onclick=closeUser;$('user-form').addEventListener('submit',saveUser);$('access-form').addEventListener('submit',saveAccess);$('access-close').onclick=closeAccess;$('access-cancel').onclick=closeAccess;document.addEventListener('click',e=>{const b=e.target.closest('[data-access-user]');if(b)openAccess(Number(b.dataset.accessUser));});$('access-modal').addEventListener('click',e=>{if(e.target===$('access-modal'))closeAccess();});document.addEventListener('click',e=>{const b=e.target.closest('[data-user-edit]');if(b)editUser(Number(b.dataset.userEdit));});$('user-modal').addEventListener('click',e=>{if(e.target===$('user-modal'))closeUser();});$('modal').addEventListener('click',ev=>{if(ev.target===$('modal'))closeForm();});document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){closeForm();closeUser();closeAccess();closePersonForm();closeRdv();closeDocument();$('version-modal').classList.add('hidden');}});
if(typeof grist==='undefined'){notify('Ce widget doit être ouvert depuis une page Grist (API indisponible).');}else{grist.ready({requiredAccess:'full'});refresh();}
