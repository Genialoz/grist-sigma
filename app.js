/* SIGMA V1.0.23 TEST — activation explicite des consultations ; ACL Grist obligatoires. */
'use strict';
const TABLES = ['SIGNALEMENTS','ACADEMIES','STATUTS','MOTIFS','SIGNALEMENT_MOTIFS','UTILISATEURS','HABILITATIONS','PERSONNES','SIGNALEMENT_PERSONNES','ACTIONS','HISTORIQUE_STATUTS','HISTORIQUE_ARCHIVAGE','RENDEZ_VOUS','PARTICIPANTS_RDV','DOCUMENTS','VERSIONS_DOCUMENTS','COMMENTAIRES_DOCUMENTS','PARTAGES_DOCUMENTS','HISTORIQUE_PARTAGES','CONSULTATIONS_INVITEES','MODELES_COURRIELS'];
const state = {data:{},view:'dashboard',busy:false,dossierSuivi:null,agendaDate:new Date(),agendaMode:'semaine',rdvDossier:null,archiveYear:null,returnFromDossier:'dossiers'};
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
function show(view){if(view==='archives'&&state.view!=='suivi'&&state.view!=='archives')state.archiveYear=null;state.view=view;for(const el of document.querySelectorAll('.view'))el.classList.toggle('hidden',el.id!==view);for(const el of document.querySelectorAll('.nav'))el.classList.toggle('active',el.dataset.view===view);$('page-title').textContent={dashboard:'Tableau de bord',dossiers:'Signalements',archives:'Archives',users:'Référents',audit:'Contrôle des accès',suivi:'Suivi du signalement',agenda:'Agenda et rendez-vous',documents:'Comptes rendus',settings:'Informations'}[view];render();}
const dateText=v=>{if(!v)return '—';if(typeof v==='number')return new Date(v*1000).toLocaleDateString('fr-FR',{timeZone:'UTC'});return esc(String(v).slice(0,10));};
function statusName(id){return byId('STATUTS',id)?.Libelle || 'Non renseigné';}
function statusBadge(name){return `<span class="pill ${name==='Clôturé'?'done':name==='En attente'?'wait':''}">${esc(name)}</span>`;}
// Archivage annuel V1.0.11 : classement réversible, distinct du statut métier.
// Les ACL Grist demeurent l'autorité réelle sur les permissions.
function sigmaArchiveYear(record){
 const n=Number(record?.Annee_Archivage);
 return Number.isInteger(n)&&n>=2000&&n<=2100?n:0;
}
function sigmaArchived(record){return sigmaArchiveYear(record)>0;}
function sigmaClosed(record){return statusName(record?.Statut).trim().toLocaleLowerCase('fr-FR')==='clôturé';}
function sigmaVisibleActive(record){return !sigmaArchived(record);}
function sigmaArchiveTag(record){return sigmaArchived(record)?` <span class="pill done">Archive ${sigmaArchiveYear(record)}</span>`:'';}
// Les années affichées dans le menu Archives proviennent des dossiers réellement classés.
function sigmaArchiveStats(records=tab('SIGNALEMENTS')){
 const counts=new Map();
 for(const r of records){const y=sigmaArchiveYear(r);if(y)counts.set(y,(counts.get(y)||0)+1);}
 return [...counts].sort((x,y)=>y[0]-x[0]);
}
function sigmaRenderArchiveLibrary(){
 const stats=sigmaArchiveStats();
 const years=$('archives-years'),list=$('archives-list');
 $('archives-total').textContent=stats.reduce((n,[,count])=>n+count,0)+' dossier(s) archivé(s)';
 if(state.archiveYear!==null&&!stats.some(([year])=>year===state.archiveYear))state.archiveYear=null;
 if(state.archiveYear===null){
   years.classList.remove('hidden');list.classList.add('hidden');
   years.innerHTML=stats.length?stats.map(([year,count])=>`<button type="button" class="sigma-archive-year" data-archive-year="${year}" aria-label="Voir ${count} dossier(s) archivé(s) en ${year}"><span class="sigma-archive-year-title">${year}</span><span class="sigma-archive-year-count">${count} dossier${count>1?'s':''}</span><span aria-hidden="true">→</span></button>`).join(''):'<p class="muted">Aucun dossier archivé pour le moment. Les années apparaîtront dès le premier archivage.</p>';
   return;
 }
 years.classList.add('hidden');list.classList.remove('hidden');
 $('archives-selected-title').textContent='Archives '+state.archiveYear;
 const search=$('archives-search').value.trim().toLocaleLowerCase('fr-FR');
 const items=tab('SIGNALEMENTS').filter(r=>sigmaArchiveYear(r)===state.archiveYear&&(!search||[r.Numero,r.Objet,byId('ACADEMIES',r.Academie)?.Nom,...namesFor(r.id)].join(' ').toLocaleLowerCase('fr-FR').includes(search))).sort((a,b)=>b.id-a.id);
 $('archives-year-count').textContent=items.length+' dossier(s)';
 $('archives-rows').innerHTML=items.map(dossierRow).join('')||'<tr><td colspan="8">Aucun dossier correspondant.</td></tr>';
}
function sigmaArchiveYears(){
 const thisYear=new Date().getFullYear();
 return Array.from({length:Math.min(21,thisYear-1999)},(_,i)=>thisYear-i);
}
// Historique conservé dans Grist : Auteur_Email et Date_Operation sont des formules de déclenchement,
// jamais des valeurs déclarées par le navigateur. Sans ces formules, le journal n'est pas certifié.
function sigmaArchiveHistory(dossierId){
 return tab('HISTORIQUE_ARCHIVAGE').filter(r=>Number(r.Signalement)===Number(dossierId))
  .sort((a,b)=>(Number(b.Date_Operation)||0)-(Number(a.Date_Operation)||0)||Number(b.id)-Number(a.id));
}
function sigmaRenderArchiveHistory(){
 const list=$('sigma-archive-history-list');if(!list)return;
 const rows=sigmaArchiveHistory(state.dossierSuivi);
 $('sigma-archive-history-count').textContent=`${rows.length} opération(s)`;
 list.innerHTML=rows.length?rows.map(r=>`<li class="sigma-archive-history-item"><strong>${esc(r.Operation==='RESTAURATION'?'Restauration':'Archivage')}</strong><span>${dateText(r.Date_Operation)} · ${esc(r.Auteur_Email||'Auteur non renseigné')}</span><span>${r.Annee_Avant?`Année précédente : ${esc(r.Annee_Avant)}`:'Non archivé'} → ${r.Annee_Apres?`Année : ${esc(r.Annee_Apres)}`:'Dossiers actifs'}</span>${r.Motif?`<span>Motif : ${esc(r.Motif)}</span>`:''}</li>`).join(''):'<li class="muted">Aucune opération d’archivage enregistrée dans le journal.</li>';
}
async function sigmaArchiveDossier(){
 const id=Number(state.dossierSuivi),original=byId('SIGNALEMENTS',id);
 if(!original||state.busy)return;
 const archived=sigmaArchived(original);
 if(!archived&&!sigmaClosed(original))return notify('Seuls les dossiers clôturés peuvent être archivés.');
 const year=Number($('sigma-archive-year').value);
 if(!archived&&(!Number.isInteger(year)||year<2000||year>new Date().getFullYear()))return notify('Sélectionne une année de classement valide.');
 const motif=$('sigma-archive-reason').value.trim();
 if(motif.length>500)return notify('Le motif est limité à 500 caractères.');
 if(archived&&!motif)return notify('Indique un motif pour restaurer ce dossier.');
 const question=archived?'Restaurer ce dossier dans les signalements actifs ? Le statut restera Clôturé.':`Archiver le dossier ${original.Numero||id} dans l’année ${year} ? Il restera consultable.`;
 if(!confirm(question))return;
 state.busy=true;$('sigma-archive-button').disabled=true;
 try{
   // Relecture des données. Le contrôle simultané multi-utilisateurs doit aussi être garanti côté Grist.
   const current=rowsFrom(await grist.docApi.fetchTable('SIGNALEMENTS')).find(r=>Number(r.id)===id);
   if(!current)throw new Error('Dossier introuvable après relecture.');
   if(sigmaArchiveYear(current)!==sigmaArchiveYear(original))throw new Error('Le classement a été modifié par un autre utilisateur. Actualise SIGMA.');
   if(!archived&&!sigmaClosed(current))throw new Error('Le dossier n’est plus clôturé.');
   const before=sigmaArchiveYear(current),after=archived?0:year;
   // Les deux actions doivent réussir dans le même appel, faute de quoi aucun changement n'est confirmé.
   await grist.docApi.applyUserActions([
     ['UpdateRecord','SIGNALEMENTS',id,{Annee_Archivage:archived?null:year}],
     ['AddRecord','HISTORIQUE_ARCHIVAGE',null,{Signalement:id,Operation:archived?'RESTAURATION':'ARCHIVAGE',Annee_Avant:before||null,Annee_Apres:after||null,Motif:motif}]
   ]);
   const verify=rowsFrom(await grist.docApi.fetchTable('SIGNALEMENTS')).find(r=>Number(r.id)===id);
   if(sigmaArchiveYear(verify)!==after)throw new Error('Classement non confirmé. Vérifie la table SIGNALEMENTS.');
   const history=rowsFrom(await grist.docApi.fetchTable('HISTORIQUE_ARCHIVAGE')).filter(r=>Number(r.Signalement)===id);
   if(!history.some(r=>r.Operation===(archived?'RESTAURATION':'ARCHIVAGE')&&Number(r.Annee_Avant||0)===before&&Number(r.Annee_Apres||0)===after))throw new Error('La ligne d’historique n’a pas été retrouvée : vérifie les autorisations et le journal.');
   $('sigma-archive-reason').value='';
   await refresh();
   notify(archived?'Dossier restauré ; opération inscrite au journal.':`Dossier archivé en ${year} ; opération inscrite au journal.`,true);
 }catch(e){notify('Opération non confirmée : '+e.message);}finally{state.busy=false;$('sigma-archive-button').disabled=false;}
}
function sigmaRenderArchiveControl(record){
 const box=$('sigma-archive-control');if(!box)return;
 if(!record){box.classList.add('hidden');return;}
 box.classList.remove('hidden');
 const archived=sigmaArchived(record),closed=sigmaClosed(record);
 $('sigma-archive-state').textContent=archived?`Classé dans les archives ${sigmaArchiveYear(record)}. Le dossier reste consultable.`:closed?'Dossier clôturé : tu peux le classer par année.':'Archivage disponible uniquement après clôture du dossier.';
 $('sigma-archive-year-wrap').classList.toggle('hidden',archived||!closed);
 const select=$('sigma-archive-year');
 const old=select.value;select.innerHTML=sigmaArchiveYears().map(y=>`<option value="${y}">${y}</option>`).join('');
 select.value=sigmaArchiveYears().includes(Number(old))?old:String(new Date().getFullYear());
 $('sigma-archive-button').textContent=archived?'Restaurer dans les dossiers actifs':'Archiver ce dossier';
 $('sigma-archive-button').classList.toggle('hidden',!archived&&!closed);
 $('sigma-archive-button').disabled=state.busy;
 $('sigma-archive-reason-label').textContent=archived?'Motif de restauration (obligatoire)':'Motif d’archivage (facultatif)';
 sigmaRenderArchiveHistory();
}
function dossierRow(r){return `<tr><td><strong>${esc(r.Numero||'—')}</strong></td><td>${esc(r.Objet)}</td><td>${esc(byId('ACADEMIES',r.Academie)?.Nom||'—')}</td><td>${esc(namesFor(r.id).join(', ')||'—')}</td><td>${esc(assignedTo(r.id).map(a=>labelUser(a.Utilisateur)).join(', ')||'—')}</td><td>${statusBadge(statusName(r.Statut))}${sigmaArchiveTag(r)}</td><td>${dateText(r.Date_Reception)}</td><td><button class="row-button" data-edit="${r.id}">Modifier</button> <button class="row-button" data-suivi="${r.id}">Ouvrir le dossier</button></td></tr>`;}
// Accueil : informations d'agenda limitées et sans donnée nominative.
// Les trois prochains jours sont J+1, J+2 et J+3 (jours calendaires locaux).
function sigmaHomeAgendaGroups(appointments, now=new Date()) {
  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
  const limit = new Date(today); limit.setDate(limit.getDate()+4);
  const current = now.getTime(), result={today:[],next:[]};
  for(const rdv of appointments){
    if(String(rdv.Statut||'').trim().toLowerCase()==='annulé' || String(rdv.Statut||'').trim().toLowerCase()==='annule')continue;
    const start=Number(rdv.Debut)*1000, end=Number(rdv.Fin)*1000;
    if(!Number.isFinite(start)||start<=0||!Number.isFinite(end)||end<=0||end<current)continue;
    if(start>=today.getTime()&&start<tomorrow.getTime())result.today.push(rdv);
    else if(start>=tomorrow.getTime()&&start<limit.getTime())result.next.push(rdv);
  }
  for(const key of ['today','next'])result[key].sort((a,b)=>Number(a.Debut)-Number(b.Debut)||Number(a.id)-Number(b.id));
  return result;
}
function sigmaRenderHomeAgenda(){
  const groups=sigmaHomeAgendaGroups(tab('RENDEZ_VOUS'));
  const renderGroup=(key,elementId,countId,empty)=>{
    const items=groups[key].filter(r=>{const d=byId('SIGNALEMENTS',r.Signalement);return d&&!sigmaArchived(d);});
    $(countId).textContent=String(items.length);
    $(elementId).innerHTML=items.length?items.slice(0,4).map(r=>{
      const d=byId('SIGNALEMENTS',r.Signalement);
      const when=new Date(Number(r.Debut)*1000).toLocaleString('fr-FR',{weekday:key==='today'?undefined:'short',day:key==='today'?undefined:'numeric',month:key==='today'?undefined:'short',hour:'2-digit',minute:'2-digit'});
      const kind=String(r.Type_Evenement||'Rendez-vous');
      return `<div class="home-rdv"><div class="home-rdv-main"><strong>${esc(when)}</strong><span>${esc(kind)} · Dossier ${esc(d.Numero||'—')}</span></div><button type="button" class="row-button" data-suivi="${Number(d.id)}" aria-label="Ouvrir le dossier ${esc(d.Numero||'')}">Dossier</button></div>`;
    }).join('')+(items.length>4?`<p class="home-more">${items.length-4} autre(s) événement(s) dans l’agenda.</p>`:''):`<p class="home-empty">${empty}</p>`;
  };
  renderGroup('today','home-today','home-today-count','Aucun rendez-vous restant aujourd’hui.');
  renderGroup('next','home-next','home-next-count','Aucun rendez-vous dans les trois prochains jours.');
}
// V1.0.9 : classification par jour civil local, sans exposer les descriptions.
const sigmaTaskComplete = a => ['réalisée','realisee','annulée','annulee'].includes(String(a.Etat||'').trim().toLowerCase());
function sigmaTaskDay(raw){
 const n=Number(raw);
 if(!Number.isFinite(n)||n<=0)return null;
 const d=new Date(n*1000);
 return new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
}
function sigmaTaskGroups(actions,now=new Date()){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const limit=new Date(today);limit.setDate(limit.getDate()+4);
 const result={late:[],next:[]};
 for(const action of actions){
  if(sigmaTaskComplete(action))continue;
  const day=sigmaTaskDay(action.Date_Echeance);
  if(!day)continue;
  if(day<today)result.late.push(action);
  else if(day<limit)result.next.push(action);
 }
 for(const k of ['late','next'])result[k].sort((x,y)=>Number(x.Date_Echeance)-Number(y.Date_Echeance)||Number(x.id)-Number(y.id));
 return result;
}
function sigmaRenderHomeTasks(){
 const groups=sigmaTaskGroups(tab('ACTIONS'));
 const draw=(key,element,count,empty)=>{
  const items=groups[key].filter(a=>{const d=byId('SIGNALEMENTS',a.Signalement);return d&&!sigmaArchived(d);});
  $(count).textContent=String(items.length);
  $(element).innerHTML=items.length?items.slice(0,4).map(action=>{
   const d=byId('SIGNALEMENTS',action.Signalement);
   return `<div class="home-rdv"><div class="home-rdv-main"><strong>${esc(dateText(action.Date_Echeance))}</strong><span>${esc(action.Type_Action||'Action')} · Dossier ${esc(d.Numero||'—')}</span></div><button type="button" class="row-button" data-suivi-task="${Number(d.id)}" aria-label="Voir les actions du dossier ${esc(d.Numero||'')}">Dossier</button></div>`;
  }).join('')+(items.length>4?`<p class="home-more">${items.length-4} autre(s) action(s) à suivre.</p>`:''):`<p class="home-empty">${empty}</p>`;
 };
 draw('late','sigma-tasks-late','sigma-tasks-late-count','Aucune échéance dépassée.');
 draw('next','sigma-tasks-next','sigma-tasks-next-count','Aucune échéance dans les trois prochains jours.');
}
function render(){const dossiers=tab('SIGNALEMENTS');const actifs=dossiers.filter(sigmaVisibleActive);if(state.view==='dashboard'){sigmaRenderHomeAgenda();sigmaRenderHomeTasks();$('metrics').innerHTML=[['Dossiers actifs',actifs.length],['En cours',actifs.filter(r=>statusName(r.Statut)==='En cours de traitement').length],['À qualifier',actifs.filter(r=>statusName(r.Statut)==='À qualifier').length],['Clôturés',actifs.filter(r=>statusName(r.Statut)==='Clôturé').length]].map(([label,n])=>`<div class="metric"><span>${esc(label)}</span><b>${n}</b></div>`).join('');$('recent').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Numéro</th><th>Objet</th><th>Académie</th><th>Motifs</th><th>Statut</th><th>Ouverture</th><th></th></tr></thead><tbody>${actifs.slice().sort((a,b)=>b.id-a.id).slice(0,8).map(dossierRow).join('')||'<tr><td colspan="8">Aucun dossier.</td></tr>'}</tbody></table></div>`;}
if(state.view==='users'){renderUsers();}
if(state.view==='suivi'){renderSuivi();}
if(state.view==='agenda'){renderAgenda();}
if(state.view==='documents'){renderDocuments();}
if(state.view==='audit'){renderAudit();}
if(state.view==='archives'){sigmaRenderArchiveLibrary();}
if(state.view==='dossiers'){const search=$('search').value.trim().toLowerCase(),statut=$('filter-status').value,motif=$('filter-motif').value,scope=$('filter-archive').value,year=$('filter-archive-year').value;const filtered=dossiers.filter(r=>(scope==='all'||(scope==='archives'?sigmaArchived(r):sigmaVisibleActive(r)))&&(!year||sigmaArchiveYear(r)===Number(year))&&(!statut||String(r.Statut)===statut)&&(!motif||idsFor(r.id).includes(Number(motif)))&&(!search||[r.Numero,r.Objet,r.Referent,byId('ACADEMIES',r.Academie)?.Nom,...namesFor(r.id)].join(' ').toLowerCase().includes(search)));$('count').textContent=`${filtered.length} dossier(s)`;$('rows').innerHTML=filtered.slice().sort((a,b)=>b.id-a.id).map(dossierRow).join('')||'<tr><td colspan="8">Aucun résultat.</td></tr>';}}
function optionList(name,textField){return tab(name).slice().sort((a,b)=>(a.Ordre||0)-(b.Ordre||0)).map(x=>`<option value="${x.id}">${esc(x[textField])}</option>`).join('');}
function loadSelects(){for(const [el,name,col] of [['academie','ACADEMIES','Nom'],['statut','STATUTS','Libelle']])$(el).innerHTML='<option value="">Sélectionner…</option>'+optionList(name,col);$('filter-status').innerHTML='<option value="">Tous les statuts</option>'+optionList('STATUTS','Libelle');$('filter-motif').innerHTML='<option value="">Tous les motifs</option>'+optionList('MOTIFS','Libelle');$('user-academie').innerHTML='<option value="">Sélectionner…</option>'+optionList('ACADEMIES','Nom');$('motifs').innerHTML=tab('MOTIFS').sort((a,b)=>(a.Ordre||0)-(b.Ordre||0)).map(x=>`<label><input type="checkbox" name="motif" value="${x.id}"> ${esc(x.Libelle)}</label>`).join('');}
function sigmaLoadArchiveFilters(){
 const years=[...new Set(tab('SIGNALEMENTS').map(sigmaArchiveYear).filter(Boolean))].sort((a,b)=>b-a);
 const select=$('filter-archive-year');const old=select.value;
 select.innerHTML='<option value="">Toutes les années</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join('');
 select.value=years.includes(Number(old))?old:'';
 select.disabled=$('filter-archive').value!=='archives';
 if(select.disabled)select.value='';
}
async function refresh(){try{notify('');for(const name of TABLES)state.data[name]=rowsFrom(await grist.docApi.fetchTable(name));loadSelects();sigmaLoadArchiveFilters();fillRdvSelects();fillDocumentSelects();render();}catch(e){notify('Chargement impossible : '+e.message+'. Vérifiez les tables et les autorisations du widget.');}}
function sigmaFillPrincipal(rec){
 const select=$('responsable-principal');
 const current=Number(rec?.Responsable_Principal)||0;
 const eligible=activeUsers().filter(u=>assignedTo(rec?.id).some(h=>Number(h.Utilisateur)===Number(u.id)&&h.Droit==='edition'));
 const selected=byId('UTILISATEURS',current);
 if(selected&&!eligible.some(u=>u.id===selected.id))eligible.unshift(selected);
 select.innerHTML='<option value="">À désigner</option>'+eligible.map(u=>`<option value="${Number(u.id)}">${esc(u.Libelle||u.Email)}</option>`).join('');
 select.value=current?String(current):'';
}
function sigmaRefreshPrincipalChoices(){
 const select=$('responsable-principal');const previous=select.value;
 const allowed=new Set([...document.querySelectorAll('.assign-check:checked')].filter(c=>document.querySelector(`.assign-right[data-user="${c.dataset.user}"]`)?.value==='edition').map(c=>Number(c.dataset.user)));
 select.innerHTML='<option value="">À désigner</option>'+activeUsers().filter(u=>allowed.has(Number(u.id))).map(u=>`<option value="${Number(u.id)}">${esc(u.Libelle||u.Email)}</option>`).join('');
 select.value=allowed.has(Number(previous))?previous:'';
}
document.getElementById('assignments').addEventListener('change',sigmaRefreshPrincipalChoices);
function openForm(id){$('record-form').reset();$('record-id').value=id||'';const rec=id?byId('SIGNALEMENTS',id):null;$('modal-title').textContent=rec?'Modifier le signalement':'Nouveau signalement';$('numero').value=rec?.Numero||'(généré à la création)';$('date').value=rec?.Date_Reception?new Date(Number(rec.Date_Reception)*1000).toISOString().slice(0,10):new Date().toISOString().slice(0,10);$('objet').value=rec?.Objet||'';$('academie').value=rec?.Academie||'';$('statut').value=rec?.Statut||'';$('referent').value=rec?.Referent||'';$('resume').value=rec?.Resume||'';const motifs=new Set(rec?idsFor(rec.id):[]);for(const cb of document.querySelectorAll('input[name="motif"]'))cb.checked=motifs.has(Number(cb.value));loadAssignments(rec?.id);sigmaFillPrincipal(rec);$('modal').classList.remove('hidden');$('objet').focus();}
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
  const principal=Number($('responsable-principal').value)||0;
  const selectedCheck=principal&&document.querySelector(`.assign-check[data-user="${principal}"]`);
  const selectedRight=principal&&document.querySelector(`.assign-right[data-user="${principal}"]`);
  if(principal&&(!selectedCheck?.checked||selectedRight?.value!=='edition'||!activeUsers().some(u=>Number(u.id)===principal))){notify('Le responsable principal doit être un utilisateur actif, habilité en modification sur ce dossier.');return;}
  // La colonne doit être créée au préalable dans Grist ; aucun changement implicite de schéma.
  if(principal)fields.Responsable_Principal=principal;
  else if(id)fields.Responsable_Principal=null;
  state.busy = true;
  $('save').disabled = true;
  try {
    const previous = id ? byId('SIGNALEMENTS', id) : null;
    if (id && !previous) throw new Error('Signalement introuvable dans les données chargées. Actualisez SIGMA.');
    if(previous&&sigmaArchived(previous)&&!sigmaClosed({Statut:fields.Statut}))throw new Error('Un dossier archivé doit rester clôturé. Restaure-le avant de changer son statut.');
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
function loadAssignments(dossierId){const current=new Map((dossierId?assignedTo(dossierId):[]).map(a=>[Number(a.Utilisateur),a.Droit]));$('assignments').innerHTML=activeUsers().sort((a,b)=>String(a.Libelle).localeCompare(String(b.Libelle),'fr')).map(u=>`<div class="assign-item"><label class="sigma-check-label"><input class="assign-check" type="checkbox" data-user="${u.id}" ${current.has(Number(u.id))?'checked':''}> <span>${esc(u.Libelle||u.Email)} <small>(${esc(u.Email)})</small></span></label> <select class="assign-right" data-user="${u.id}" aria-label="Droit de ${esc(u.Libelle||u.Email)}"><option value="lecture" ${current.get(Number(u.id))==='lecture'?'selected':''}>Lecture</option><option value="edition" ${current.get(Number(u.id))==='edition'?'selected':''}>Modification</option></select></div>`).join('')||'<em>Aucun référent actif. Ajoutez-en dans Référents.</em>';}
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
function openAccess(uid){const u=byId('UTILISATEURS',uid);if(!u)return notify('Référent introuvable.');$('access-user-id').value=uid;$('access-title').textContent=`Accès aux dossiers — ${u.Libelle||u.Email}`;const rows=tab('SIGNALEMENTS').slice().sort((a,b)=>b.id-a.id);const current=new Map(tab('HABILITATIONS').filter(h=>Number(h.Utilisateur)===Number(uid)&&h.Perimetre==='dossier'&&Number(h.Actif)!==0).map(h=>[Number(h.Signalement),h.Droit]));$('access-dossiers').innerHTML=rows.map(d=>`<div class="access-item"><label class="sigma-check-label"><input type="checkbox" class="access-check" data-dossier="${d.id}" ${current.has(Number(d.id))?'checked':''}><span><strong>${esc(d.Numero)}</strong><small>${esc(d.Objet)}</small></span></label><select class="access-right" data-dossier="${d.id}" aria-label="Droit pour ${esc(d.Numero)}"><option value="lecture" ${current.get(Number(d.id))==='lecture'?'selected':''}>Lecture seule</option><option value="edition" ${current.get(Number(d.id))==='edition'?'selected':''}>Modification</option></select></div>`).join('')||'<p>Aucun signalement disponible. Créez d’abord un dossier fictif.</p>';$('access-modal').classList.remove('hidden');}
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
function openSuivi(id){if(!byId('SIGNALEMENTS',id))return notify('Dossier non disponible.');state.returnFromDossier=state.view==='archives'?'archives':'dossiers';state.dossierSuivi=id;$('sigma-archive-reason').value='';$('sigma-archive-history').open=false;show('suivi');sigmaActivateTab('suivi-tab-overview');}
function renderSuivi(){const d=byId('SIGNALEMENTS',state.dossierSuivi);if(!d){$('suivi-title').textContent='Sélectionne un dossier dans Signalements.';$('suivi-content').classList.add('hidden');return;}$('suivi-content').classList.remove('hidden');$('suivi-title').textContent=`${d.Numero} — ${d.Objet}`;
 const members=assignedTo(d.id).map(a=>labelUser(a.Utilisateur)).filter(Boolean);
 const linkedPeople=dossierLinks().length;
 const actions=dossierActions().length;
 const rdvs=tab('RENDEZ_VOUS').filter(r=>Number(r.Signalement)===Number(d.id)&&r.Statut!=='Annulé');
 const documents=docsByDossier(d.id).length;
 const history=dossierHistory();
 $('suivi-summary-caption').textContent=(d.Numero||'Dossier sans numéro')+' · '+statusName(d.Statut)+(sigmaArchived(d)?' · Archive '+sigmaArchiveYear(d):'');sigmaRenderArchiveControl(d);
 const summary=[
  ['Statut',statusBadge(statusName(d.Statut))],
  ['Académie',esc(byId('ACADEMIES',d.Academie)?.Nom||'Non renseignée')],
  ['Date de réception',esc(dateText(d.Date_Reception))],
  ['Motifs',esc(namesFor(d.id).join(' · ')||'Non renseignés')],
  ['Responsable principal',esc(d.Responsable_Principal?labelUser(d.Responsable_Principal):'À désigner')],
  ['Référents affectés',esc(members.join(' · ')||'Aucun référent affecté')],
  ['Résumé',esc(d.Resume||'Aucun résumé renseigné')],
 ];
 $('suivi-overview').innerHTML=summary.map(([label,value])=>`<div class="sigma-overview-card"><span>${label}</span><div>${value}</div></div>`).join('')+
 `<div class="sigma-overview-card sigma-overview-wide"><span>Activité du dossier</span><div class="sigma-overview-counts"><span>${linkedPeople} personne(s)</span><span>${actions} action(s)</span><span>${rdvs.length} rendez-vous</span><span>${documents} document(s)</span></div><p class="sigma-overview-last">${history.length?'Dernier changement de statut : '+esc(dateText(history[0].Date_Changement)):'Aucun changement de statut historisé.'}</p></div>`;
 $('suivi-personnes').innerHTML=dossierLinks().map(l=>{const person=byId('PERSONNES',l.Personne);return `<tr><td>${esc(person?.Libelle||'—')}</td><td>${esc(l.Role)}</td><td>${esc(person?.Categorie||'—')}</td><td><button type="button" class="row-button" data-detach="${l.id}">Retirer du dossier</button></td></tr>`;}).join('')||'<tr><td colspan="4">Aucune personne associée.</td></tr>';
 $('suivi-actions').innerHTML=dossierActions().map(a=>`<tr><td>${dateText(a.Date_Action)}</td><td>${esc(a.Type_Action)}</td><td>${esc(a.Description)}</td><td>${dateText(a.Date_Echeance)}</td><td>${esc(a.Etat)}</td><td>${sigmaTaskComplete(a)?'—':`<button type="button" class="row-button" data-task-done="${Number(a.id)}">Marquer réalisée</button>`}</td></tr>`).join('')||'<tr><td colspan="6">Aucune action enregistrée.</td></tr>';
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
async function saveAction(e){e.preventDefault();if(state.busy)return;const dossier=Number(state.dossierSuivi);const desc=$('action-description').value.trim();const date=$('action-date').value;const ts=Date.parse(date+'T00:00:00Z')/1000;if(!desc||!Number.isFinite(ts))return notify('Renseigne une date et une description.');const deadline=$('action-deadline').value;const due=deadline?Date.parse(deadline+'T00:00:00Z')/1000:null;if(deadline&&!Number.isFinite(due))return notify('Échéance invalide.');const fields={Signalement:dossier,Date_Action:ts,Type_Action:$('action-type').value,Description:desc,Etat:$('action-etat').value};if(deadline)fields.Date_Echeance=due;state.busy=true;$('action-save').disabled=true;try{await grist.docApi.applyUserActions([['AddRecord','ACTIONS',null,fields]]);$('action-form').reset();$('action-date').value=new Date().toISOString().slice(0,10);await refresh();notify('Action ajoutée au suivi.',true);}catch(err){notify('Enregistrement de l’action impossible : '+err.message);}finally{state.busy=false;$('action-save').disabled=false;}}
async function sigmaMarkTaskDone(id){
 const action=byId('ACTIONS',id);
 if(!action||!byId('SIGNALEMENTS',action.Signalement))return notify('Action inaccessible.');
 if(sigmaTaskComplete(action))return notify('Action déjà terminée.');
 if(state.busy)return;
 if(!window.confirm('Marquer cette action comme réalisée ?'))return;
 state.busy=true;
 try{await grist.docApi.applyUserActions([['UpdateRecord','ACTIONS',Number(id),{Etat:'réalisée'}]]);await refresh();notify('Action marquée comme réalisée.',true);}
 catch(err){notify('Mise à jour impossible : '+err.message);}
 finally{state.busy=false;}
}
$('suivi-back').onclick=()=>show(state.returnFromDossier==='archives'?'archives':'dossiers');
$('suivi-edit').onclick=()=>{if(state.dossierSuivi)openForm(state.dossierSuivi);};
document.addEventListener('click',e=>{const button=e.target.closest('[data-task-done]');if(button)sigmaMarkTaskDone(Number(button.dataset.taskDone));const jump=e.target.closest('[data-suivi-task]');if(jump){openSuivi(Number(jump.dataset.suiviTask));sigmaActivateTab('suivi-tab-1');}});document.addEventListener('click',e=>{const b=e.target.closest('[data-dossier-tab]');if(b&&state.view==='suivi')sigmaActivateTab(b.dataset.dossierTab);});$('suivi-add-person').onclick=openPersonForm;$('person-close').onclick=closePersonForm;$('person-cancel').onclick=closePersonForm;$('person-form').addEventListener('submit',savePerson);$('existing-person-form').addEventListener('submit',linkPerson);$('action-form').addEventListener('submit',saveAction);$('action-type').innerHTML=typeActions.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('action-date').value=new Date().toISOString().slice(0,10);$('suivi-existing-role').innerHTML=roleOptions.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');document.addEventListener('click',e=>{const open=e.target.closest('[data-suivi]');if(open)openSuivi(Number(open.dataset.suivi));const detach=e.target.closest('[data-detach]');if(detach)detachPerson(Number(detach.dataset.detach));});


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
  docEditMode(doc);renderDocumentCollaboration(doc);sigmaDocumentTabAvailability(!!doc);sigmaActivateTab('document-tab-edit');$('document-modal').classList.remove('hidden');
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

$('documents-add').onclick=()=>openDocument();
$('suivi-add-document').onclick=()=>openDocument(null,state.dossierSuivi);
$('documents-dossier').onchange=renderDocuments;$('documents-statut').onchange=renderDocuments;
$('document-close').onclick=closeDocument;$('document-cancel').onclick=closeDocument;
$('document-form').addEventListener('submit',e=>{e.preventDefault();saveDocument(false);});
$('document-validate').onclick=()=>saveDocument(true);
$('document-revision').onclick=startRevision;

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
  $('document-tracking').classList.toggle('hidden',!available);
  if(!available)return;
  $('comment-doc-id').value=doc.id;
  $('share-doc-id').value=doc.id;
  const versions=docVersions(doc.id);
  const previousVersion = $('comment-version').dataset.documentId === String(doc.id) ? $('comment-version').value : '';
  $('comment-version').innerHTML=versions.map(v=>`<option value="${v.id}">Version ${esc(v.Numero_Version)} — ${esc(v.Statut)}</option>`).join('');
  $('comment-version').dataset.documentId=String(doc.id);
  const candidate=versions.find(v=>String(v.id)===previousVersion);
  $('comment-version').value=String(candidate?.id||versions.find(v=>Number(v.Numero_Version)===Number(doc.Version_Courante))?.id||versions[0]?.id||'');
  renderReadVersion(doc);
  const shareVersions=versions.filter(v=>v.Statut==='Validé');
  $('share-version').innerHTML=shareVersions.map(v=>`<option value="${v.id}">Version ${esc(v.Numero_Version)} — validée ${prettyDateTime(v.Date_Version)}</option>`).join('') || '<option value="">Aucune version validée</option>';
  $('share-save').disabled=doc.Statut!=='Validé'||!shareVersions.length;
  const shares=documentShares(doc.id);
  const now=Date.now()/1000;
  const renderShareCard=p=>{
    const ver=byId('VERSIONS_DOCUMENTS',p.Version);
    const expired=Number(p.Expiration)>0 && Number(p.Expiration)+86400<=now;
    const status=expired&&p.Statut==='Projet'?'Échéance dépassée (projet)':p.Statut;
    const history=tab('HISTORIQUE_PARTAGES').filter(e=>Number(e.Partage)===Number(p.id)).sort((a,b)=>Number(b.Date_Evenement)-Number(a.Date_Evenement)||b.id-a.id);
    const consult=tab('CONSULTATIONS_INVITEES').find(x=>Number(x.Partage_ID)===Number(p.id));
    const consultInfo=consult?`<p class="muted">Document préparé : <strong>${esc(consult.Statut||'Préparé')}</strong> (ligne ${consult.id}) · <strong>${esc(consult.Email||'')}</strong>. ${consult.Statut==='Actif'?'Révoquer immédiatement dans Grist si nécessaire.':'En attente d’autorisation technique : aucun accès invité.'}</p>`:'';
    const prepareBtn=p.Statut==='Vérifié' && !expired && ver && !consult ? `<button type="button" class="row-button" data-share-snapshot="${p.id}">Préparer la copie manquante</button>` : '';
    const actions=p.Statut==='Projet' ? `<button type="button" class="row-button" data-share-review="${p.id}" ${expired||!ver?'disabled':''}>Préparer le compte rendu</button> <button type="button" class="row-button" data-share-reject="${p.id}">Refuser</button> <button type="button" class="row-button" data-share-cancel="${p.id}">Annuler</button>` : (p.Statut==='Vérifié' ? `<button type="button" class="row-button" data-share-cancel="${p.id}">Annuler le partage prévu</button>` : '');
    return `<div class="collab-item" data-sigma-share-card="${Number(p.id)}"><div><strong>${esc(p.Destinataire)}</strong> <span class="pill ${['Annulé','Refusé'].includes(p.Statut)?'done':'wait'}">${esc(status)}</span><small>${esc(p.Email)} · ${esc(p.Droit)} · ${ver?'Version '+esc(ver.Numero_Version):'Version non spécifiée (ancien projet)'} · échéance ${dateText(p.Expiration)} · ${prettyDateTime(p.Date_Creation)}</small><p class="comment-text">${esc(p.Message||'Aucun message')}</p><p class="muted"><strong>La demande seule ne donne aucun accès.</strong></p>${consultInfo}<details class="share-log"><summary>Historique des décisions (${history.length})</summary>${history.map(e=>`<p><small>${prettyDateTime(e.Date_Evenement)} · ${esc(e.Action)} · ${esc(e.Auteur)} — ${esc(e.Motif||'Sans motif')}</small></p>`).join('')||'<p>Aucune décision enregistrée.</p>'}</details></div><div class="share-actions">${prepareBtn} ${actions}</div></div>`;
  };
  // Les demandes clôturées restent consultables, mais ne repoussent plus
  // les destinataires en cours : historique fermé par défaut.
  const closedShares=shares.filter(p=>['Annulé','Refusé'].includes(p.Statut));
  const currentShares=shares.filter(p=>!['Annulé','Refusé'].includes(p.Statut));
  const activeHtml=currentShares.length
    ?currentShares.map(renderShareCard).join('')
    :'<p class="muted">Aucune demande en cours. Utilise le formulaire « Préparer une nouvelle diffusion » situé plus haut.</p>';
  const closedHtml=closedShares.length
    ?`<details class="sigma-fold sigma-share-closed"><summary>Historique des partages annulés ou refusés (${closedShares.length})</summary><div class="sigma-fold-body">${closedShares.map(renderShareCard).join('')}</div></details>`
    :'';
  $('document-shares-list').innerHTML=`<p class="muted">${currentShares.length} demande(s) en cours</p>${activeHtml}${closedHtml}`;
  void sigmaLoadExternalWorkflow(doc.id);
  renderMailChoices(doc);
}
// V1.0.16.9 TEST — suivi des échanges sans accès interdocuments.
// Ce panneau n'affiche AUCUN commentaire invité : ils restent dans SIGMA - Consultations.
function renderInvitedExchangeOverview(doc, shares){
  const target=$('sigma-invited-exchanges');
  if(!target)return;
  const query=($('sigma-exchange-filter')?.value||'').trim().toLocaleLowerCase('fr');
  const list=shares.filter(p=>[p.Destinataire,p.Email,p.Statut,String(p.id)].some(v=>String(v||'').toLocaleLowerCase('fr').includes(query)));
  const now=Date.now()/1000;
  const active=shares.filter(p=>!['Annulé','Refusé'].includes(p.Statut)).length;
  $('sigma-exchange-summary').textContent=`${shares.length} demande(s) · ${active} non clôturée(s) · ${list.length} affichée(s)`;
  target.innerHTML=list.map(p=>{
    const copies=tab('CONSULTATIONS_INVITEES').filter(c=>Number(c.Partage_ID)===Number(p.id));
    const copy=copies[0];
    const version=byId('VERSIONS_DOCUMENTS',p.Version);
    const expired=Number(p.Expiration)>0&&Number(p.Expiration)+86400<=now;
    const closed=['Annulé','Refusé'].includes(p.Statut);
    const status=closed?'Demande clôturée':expired?'Échéance dépassée':copy?.Statut==='Actif'?'Copie marquée active':copy?'Copie '+String(copy.Statut||'préparée'):'Aucune copie locale';
    const issues=[];
    if(copies.length>1)issues.push('Plusieurs copies locales pour un même partage : vérifier les doublons.');
    if(!version || Number(version.Document)!==Number(doc.id))issues.push('Version source introuvable ou associée à un autre compte rendu.');
    if(copy && String(copy.Email||'').trim().toLowerCase()!==String(p.Email||'').trim().toLowerCase())issues.push('Adresse différente entre la demande et la copie locale.');
    if(copy && version && Number(copy.Version_Numero)!==Number(version.Numero_Version))issues.push('Numéro de version différent entre la demande et la copie locale.');
    if(closed && copy?.Statut==='Actif')issues.push('Demande clôturée mais copie encore marquée active : révocation à vérifier dans le document Consultations.');
    if(expired && copy?.Statut==='Actif')issues.push('Échéance dépassée mais copie encore marquée active : expiration serveur non confirmée.');
    const history=tab('HISTORIQUE_PARTAGES').filter(e=>Number(e.Partage)===Number(p.id)).sort((a,b)=>Number(a.Date_Evenement)-Number(b.Date_Evenement)||a.id-b.id);
    const historyHtml=history.map(e=>`<li>${prettyDateTime(e.Date_Evenement)} — ${esc(e.Action||'Décision')} · ${esc(e.Auteur||'Auteur non renseigné')}${e.Motif?' — '+esc(e.Motif):''}</li>`).join('')||'<li>Aucun événement enregistré.</li>';
    return `<article class="sigma-exchange-card" data-sigma-exchange-id="${Number(p.id)}"><div class="sigma-exchange-details"><strong>${esc(p.Destinataire||'Destinataire non renseigné')}</strong><small>${esc(p.Email||'')} · ${esc(p.Droit||'')} · ${version?'Version '+esc(version.Numero_Version):'Version inconnue'}</small><small>Partage #${Number(p.id)} · ${esc(status)} · échéance ${dateText(p.Expiration)}</small><details class="sigma-exchange-audit"><summary>Suivi du partage et points de vigilance${issues.length?' ('+issues.length+')':''}</summary><p>Demande : <strong>${esc(p.Statut||'Non renseigné')}</strong> · Copie locale : <strong>${esc(copy?.Statut||'Absente')}</strong> · ${copies.length} copie(s) trouvée(s).</p>${issues.length?`<ul class="sigma-exchange-alerts">${issues.map(issue=>`<li>${esc(issue)}</li>`).join('')}</ul>`:'<p>Aucune incohérence détectée dans les données locales. Les ACL et l’accès réel restent à contrôler dans SIGMA - Consultations.</p>'}<p><strong>Historique des décisions</strong></p><ol>${historyHtml}</ol></details></div><div class="sigma-exchange-actions"><span class="pill ${closed||expired?'done':'wait'}">${esc(status)}</span><button type="button" class="row-button" data-sigma-share-focus="${Number(p.id)}">Voir le partage</button></div></article>`;
  }).join('')||'<p class="muted">Aucun destinataire ne correspond à la recherche.</p>';
}
// SIGMA V1.0.18 — suivi des demandes et échanges externes, par copie individuelle.
// Les données sont lues dans le même document, sous les ACL du compte courant.
let sigmaExternalLoadRevision = 0;
async function sigmaLoadExternalWorkflow(docId){
 const target=$('sigma-external-workflow'); if(!target)return;
 const ticket=++sigmaExternalLoadRevision;
 target.textContent='Chargement des validations et commentaires invités…';
 try {
  const [vr,er,cr]=await Promise.all([
   grist.docApi.fetchTable('VALIDATIONS_EXTERNES',{keepEncoded:true}),
   grist.docApi.fetchTable('EVENEMENTS_VALIDATION',{keepEncoded:true}),
   grist.docApi.fetchTable('COMMENTAIRES_INVITES',{keepEncoded:true})
  ]);
  if(ticket!==sigmaExternalLoadRevision || Number(currentDoc()?.id)!==Number(docId))return;
  const validations=rowsFrom(vr),events=rowsFrom(er),comments=rowsFrom(cr);
  const copies=tab('CONSULTATIONS_INVITEES').filter(c=>{
   const share=byId('PARTAGES_DOCUMENTS',Number(c.Partage_ID));
   return share&&Number(share.Document)===Number(docId);
  });
  const search=String($('sigma-exchange-filter')?.value||'').trim().toLocaleLowerCase('fr');
  const shareRecords=tab('PARTAGES_DOCUMENTS').filter(p=>Number(p.Document)===Number(docId));
  const items=copies.map(c=>({copy:c,share:shareRecords.find(p=>Number(p.id)===Number(c.Partage_ID))}));
  const filtered=items.filter(({copy:c,share:p})=>[c.Email,c.Statut,c.Version_Numero,p?.Destinataire,p?.Statut].some(v=>String(v??'').toLocaleLowerCase('fr').includes(search)));
  $('sigma-exchange-summary').textContent=`${filtered.length} destinataire(s) affiché(s) sur ${items.length}`;
  target.innerHTML=filtered.map(({copy:c,share:p})=>{
   const related=validations.filter(v=>Number(v.Consultation)===Number(c.id)&&Number(v.Version_Numero)===Number(c.Version_Numero));
   const request=related.sort((x,y)=>y.id-x.id)[0];
   const ev=request?events.filter(e=>Number(e.Validation)===Number(request.id)).sort((x,y)=>Number(x.Date_Evenement)-Number(y.Date_Evenement)||x.id-y.id):[];
   const decisions=ev.filter(e=>['Validé','Correction demandée'].includes(String(e.Type_Evenement)));
   const status=!request?'Sans demande':decisions.length>1?'Décisions multiples':decisions.length?decisions[0].Type_Evenement:(request.Statut||'En attente');
   const messages=comments.filter(m=>Number(m.Consultation)===Number(c.id)).sort((x,y)=>Number(x.Date_Creation)-Number(y.Date_Creation)||x.id-y.id);
   const active=c.Statut==='Actif' && (!Number(c.Expiration)||Number(c.Expiration)+86400>Date.now()/1000);
   const closed=['Annulé','Refusé'].includes(String(p?.Statut||''));
   return `<details class="sigma-recipient" data-consultation-id="${Number(c.id)}"><summary class="sigma-recipient-summary"><span class="sigma-recipient-person"><strong>${esc(p?.Destinataire||c.Email||'Destinataire')}</strong><small>${esc(c.Email)} · Version ${esc(c.Version_Numero)} · ${messages.length} commentaire(s)</small></span><span class="sigma-recipient-status">${esc(status)}${closed?' · Partage clôturé':''}</span><span class="sigma-recipient-toggle">Détails</span></summary>
    <div class="sigma-recipient-body"><p class="muted">Copie #${Number(c.id)} · ${esc(c.Statut||'Statut inconnu')} · Partage #${Number(p?.id||c.Partage_ID)}</p>
    <section class="sigma-external-thread"><h4>Commentaires confidentiels (${messages.length})</h4>${messages.map(m=>`<p><strong>${esc(m.Auteur_Email||'Auteur')}</strong> · ${prettyDateTime(m.Date_Creation)}<br>${esc(m.Contenu)}</p>`).join('')||'<p class="muted">Aucun commentaire.</p>'}</section>
    <section><h4>Historique des décisions (${ev.length})</h4>${ev.map(e=>`<p>${esc(e.Type_Evenement)} · ${prettyDateTime(e.Date_Evenement)} — ${esc(e.Message||'')}</p>`).join('')||'<p class="muted">Aucune décision.</p>'}</section>
    <div class="sigma-recipient-actions">${c.Statut==='Préparé'&&!closed&&p?.Statut==='Vérifié'&&(!Number(c.Expiration)||Number(c.Expiration)+86400>Date.now()/1000)?`<button type="button" class="row-button" data-sigma-consultation-activate="${Number(c.id)}">Activer la consultation</button>`:''}${active&&!closed&&!request?`<button type="button" class="row-button" data-sigma-validation-create="${Number(c.id)}">Demander validation</button>`:''}${p?`<button type="button" class="row-button" data-sigma-share-focus="${Number(p.id)}">Voir le partage</button>`:''}</div>
    ${active?`<form class="sigma-external-reply" data-consultation="${Number(c.id)}"><label>Répondre à cet invité<textarea name="message" maxlength="3000" required rows="2" placeholder="Réponse visible uniquement par cet invité"></textarea></label><button type="submit" class="row-button">Répondre</button></form>`:''}
    </div></details>`;
  }).join('')||'<p class="muted">Aucun destinataire ne correspond à la recherche pour ce compte rendu.</p>';
 }catch(err){if(ticket===sigmaExternalLoadRevision){target.textContent='Accès aux validations ou commentaires refusé par Grist. Vérifiez les ACL du gestionnaire.';console.error('SIGMA suivi externe',err);}}
}
// Activation explicite : aucune permission n'est accordée par le widget.
// L'ACL Grist doit limiter UpdateRecord aux gestionnaires habilités.
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-sigma-consultation-activate]');if(!button)return;
 const id=Number(button.dataset.sigmaConsultationActivate),copy=byId('CONSULTATIONS_INVITEES',id),doc=currentDoc();
 if(!doc||!copy||copy.Statut!=='Préparé')return notify('Consultation introuvable ou déjà activée.');
 const share=byId('PARTAGES_DOCUMENTS',Number(copy.Partage_ID));
 const version=share&&byId('VERSIONS_DOCUMENTS',Number(share.Version));
 const expires=Number(copy.Expiration);
 if(!share||Number(share.Document)!==Number(doc.id)||share.Statut!=='Vérifié'||!version||Number(version.Document)!==Number(doc.id)||version.Statut!=='Validé'||Number(copy.Version_Numero)!==Number(version.Numero_Version)||String(copy.Email||'').trim().toLowerCase()!==String(share.Email||'').trim().toLowerCase()||!['lecture','commentaire'].includes(copy.Droit)||copy.Droit!==share.Droit||!expires||expires+86400<=Date.now()/1000)return notify('Activation refusée : partage, version, destinataire, droit ou échéance incohérent.');
 if(!confirm(`Activer la consultation pour ${copy.Email} (version ${copy.Version_Numero}) ? L’invité pourra accéder à sa copie selon les ACL Grist. Aucun courriel ne sera envoyé.`))return;
 button.disabled=true;
 try{
  await grist.docApi.applyUserActions([['UpdateRecord','CONSULTATIONS_INVITEES',id,{Statut:'Actif'}]]);
  await reloadDocumentCollaboration(doc.id);
  const updated=byId('CONSULTATIONS_INVITEES',id);
  if(updated?.Statut!=='Actif')throw Error('Activation non confirmée : vérifier la table avant de réessayer.');
  notify('Consultation activée. Aucun courriel envoyé.',true);
 }catch(err){notify('Activation non enregistrée : '+err.message);}finally{button.disabled=false;}
});
document.addEventListener('click',async e=>{
 const button=e.target.closest('[data-sigma-validation-create]');if(!button)return;
 const id=Number(button.dataset.sigmaValidationCreate),copy=byId('CONSULTATIONS_INVITEES',id),doc=currentDoc();
 if(!doc||!copy||copy.Statut!=='Actif'||(Number(copy.Expiration)>0&&Number(copy.Expiration)+86400<=Date.now()/1000))return notify('Copie inactive ou expirée.');
 const share=byId('PARTAGES_DOCUMENTS',Number(copy.Partage_ID));
 if(!share||Number(share.Document)!==Number(doc.id))return notify('Partage non associé à ce compte rendu.');
 if(!confirm(`Demander à ${copy.Email} de valider la version ${copy.Version_Numero} ?`))return;
 button.disabled=true;
 try{
  const requests=rowsFrom(await grist.docApi.fetchTable('VALIDATIONS_EXTERNES',{keepEncoded:true}));
  if(requests.some(v=>Number(v.Consultation)===id&&Number(v.Version_Numero)===Number(copy.Version_Numero)))throw Error('Une demande existe déjà pour cette version.');
  await grist.docApi.applyUserActions([['AddRecord','VALIDATIONS_EXTERNES',null,{Consultation:id,Version_Numero:Number(copy.Version_Numero),Statut:'En attente',Date_Demande:Math.floor(Date.now()/1000)}]]);
  notify('Demande de validation créée.',true);await sigmaLoadExternalWorkflow(doc.id);
 }catch(err){notify('Demande non enregistrée : '+err.message);}finally{button.disabled=false;}
});
document.addEventListener('submit',async e=>{
 const form=e.target.closest('form.sigma-external-reply');if(!form)return;e.preventDefault();
 const id=Number(form.dataset.consultation),copy=byId('CONSULTATIONS_INVITEES',id),doc=currentDoc();
 const message=String(new FormData(form).get('message')||'').trim();
 if(!doc||!copy||copy.Statut!=='Actif'||!message||message.length>3000)return;
 const share=byId('PARTAGES_DOCUMENTS',Number(copy.Partage_ID));
 if(!share||Number(share.Document)!==Number(doc.id))return;
 const button=form.querySelector('button');button.disabled=true;
 try{
  await grist.docApi.applyUserActions([['AddRecord','COMMENTAIRES_INVITES',null,{Consultation:id,Contenu:message}]]);
  notify('Réponse enregistrée.',true);await sigmaLoadExternalWorkflow(doc.id);
 }catch(err){notify('Réponse non enregistrée : '+err.message);}finally{button.disabled=false;}
});
$('sigma-exchange-filter').addEventListener('input',()=>{
  const doc=currentDoc();if(doc)void sigmaLoadExternalWorkflow(doc.id);
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-sigma-share-focus]');if(!b)return;
  const id=Number(b.dataset.sigmaShareFocus);
  const list=$('document-shares-list');
  sigmaActivateTab('document-tab-tracking');
  $('sigma-tracking-list').open=true;
  // Pas de requête vers un autre document ni de divulgation de commentaires.
  const target=list.querySelector(`[data-sigma-share-card="${id}"]`);
  if(target){target.scrollIntoView({behavior:'smooth',block:'center'});target.classList.add('sigma-share-focused');setTimeout(()=>target.classList.remove('sigma-share-focused'),1800);}
  else {list.scrollIntoView({behavior:'smooth',block:'start'});notify('Destinataire introuvable dans la liste des partages.');}
});
// V1.0.5 : aperçu et commentaires strictement liés à la version choisie.
function renderReadVersion(doc){
  const version=byId('VERSIONS_DOCUMENTS',Number($('comment-version').value));
  const valid=!!version && Number(version.Document)===Number(doc?.id);
  $('read-version-meta').textContent=valid?`Version ${version.Numero_Version} · ${version.Statut} · ${prettyDateTime(version.Date_Version)}`:'Aucune version enregistrée';
  $('read-version-content').textContent=valid?(version.Contenu||'Aucun contenu'):'Aucune version disponible.';
  const comments=valid?documentComments(doc.id).filter(c=>Number(c.Version)===Number(version.id)):[];
  $('document-comments-list').innerHTML=comments.map(c=>{
    const resolved=c.Etat==='Résolu';
    return `<div class="collab-item"><div><strong>${esc(c.Auteur||'Auteur non renseigné')}</strong> <span class="pill ${resolved?'done':'wait'}">${esc(c.Etat||'Actif')}</span><small>${prettyDateTime(c.Date_Commentaire)} · Version ${esc(version.Numero_Version)}</small><p class="comment-text">${esc(c.Contenu)}</p></div>${resolved?'':`<button type="button" class="row-button" data-comment-resolve="${c.id}">Résoudre</button>`}</div>`;
  }).join('')||'<p class="muted">Aucun commentaire pour cette version.</p>';
  $('comment-save').disabled=!valid;
}
$('comment-version').addEventListener('change',()=>renderReadVersion(currentDoc()));
async function reloadDocumentCollaboration(docId){
  for(const name of ['COMMENTAIRES_DOCUMENTS','PARTAGES_DOCUMENTS','HISTORIQUE_PARTAGES','CONSULTATIONS_INVITEES'])state.data[name]=rowsFrom(await grist.docApi.fetchTable(name));
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
    $('sigma-new-share').open=false;
    notify('Demande enregistrée. Clique sur « Préparer le compte rendu » pour créer sa copie sans autoriser l’accès externe.',true);
  }catch(e){notify('Enregistrement du projet de partage incertain : '+e.message+' Vérifiez la table avant de recommencer.');}
  finally{state.busy=false;btn.disabled=false;}
}
// V1.0.14 TEST — copie de lecture isolée : aucun droit activé automatiquement.
// Ne jamais utiliser PARTAGES_DOCUMENTS comme justification suffisante pour exposer les tables sources.
async function sigmaPrepareConsultation(partageId){
 if(state.busy)return;
 const p=byId('PARTAGES_DOCUMENTS',partageId),doc=currentDoc();
 if(!p||!doc||Number(p.Document)!==Number(doc.id)||p.Statut!=='Vérifié'||doc.Statut!=='Validé')return notify('La demande et le document doivent être vérifiés et validés.');
 const version=byId('VERSIONS_DOCUMENTS',p.Version);
 if(!version||Number(version.Document)!==Number(doc.id)||version.Statut!=='Validé')return notify('Version validée introuvable.');
 if(Number(p.Expiration)+86400<=Date.now()/1000)return notify('Demande expirée : crée une nouvelle demande.');
 if(!['lecture','commentaire'].includes(p.Droit)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.Email))return notify('Adresse ou droit invalide.');
 if(tab('CONSULTATIONS_INVITEES').some(x=>Number(x.Partage_ID)===partageId))return notify('Une copie existe déjà pour cette demande.');
 if(!confirm('Finaliser cette ancienne demande ? Le document restera inaccessible au destinataire.'))return;
 state.busy=true;
 try{
  const fields={Partage_ID:partageId,Email:String(p.Email).trim().toLowerCase(),Droit:p.Droit,Expiration:Number(p.Expiration),Statut:'Préparé',Titre:String(doc.Titre||''),Version_Numero:Number(version.Numero_Version)||1,Contenu:String(version.Contenu||''),Observation_Invite:''};
  await grist.docApi.applyUserActions([['AddRecord','CONSULTATIONS_INVITEES',null,fields]]);
  await reloadDocumentCollaboration(doc.id);
  if(!tab('CONSULTATIONS_INVITEES').some(x=>Number(x.Partage_ID)===partageId&&x.Statut==='Préparé'&&x.Contenu===fields.Contenu))throw new Error('Copie non retrouvée : contrôle manuel nécessaire.');
  notify('Copie de consultation préparée (désactivée). Configure et teste toutes les ACL avant tout accès invité.',true);
 }catch(e){notify('Préparation de la copie non confirmée : '+e.message);}
 finally{state.busy=false;}
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
    if(!['lecture','commentaire'].includes(share.Droit)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(share.Email||'')))return notify('Adresse ou droit invalide.');
  }
  if(nextStatus==='Refusé'&&share.Statut!=='Projet')return notify('Seuls les projets peuvent être refusés.');
  if(nextStatus==='Annulé'&&!['Projet','Vérifié'].includes(share.Statut))return notify('Annulation impossible.');
  if(!reason||!reason.trim())return notify('Une justification est nécessaire.');
  const now=Math.floor(Date.now()/1000),author='Widget SIGMA (identité non certifiée)';
  state.busy=true;
  try{
    const linked=tab('CONSULTATIONS_INVITEES').filter(x=>Number(x.Partage_ID)===id);
    const actions=[
      ['UpdateRecord','PARTAGES_DOCUMENTS',id,{Statut:nextStatus}],
      ['AddRecord','HISTORIQUE_PARTAGES',null,{Partage:id,Action:nextStatus,Statut_Avant:share.Statut,Date_Evenement:now,Auteur:author,Motif:reason.trim().slice(0,500)}]
    ];
    // V1.0.15 : la validation prépare la copie en une seule transaction Grist.
    // Le statut Préparé n'ouvre aucun accès invité. Aucune invitation n'est envoyée.
    if(nextStatus==='Vérifié'&&!linked.length){
      const version=byId('VERSIONS_DOCUMENTS',share.Version);
      const snapshot={Partage_ID:id,Email:String(share.Email).trim().toLowerCase(),Droit:share.Droit,
        Expiration:Number(share.Expiration),Statut:'Préparé',Titre:String(doc.Titre||''),
        Version_Numero:Number(version.Numero_Version)||1,Contenu:String(version.Contenu||''),Observation_Invite:''};
      actions.push(['AddRecord','CONSULTATIONS_INVITEES',null,snapshot]);
    }
    if(nextStatus==='Annulé'||nextStatus==='Refusé')for(const x of linked)actions.push(['UpdateRecord','CONSULTATIONS_INVITEES',x.id,{Statut:'Révoqué'}]);
    await grist.docApi.applyUserActions(actions);
    state.data.CONSULTATIONS_INVITEES=rowsFrom(await grist.docApi.fetchTable('CONSULTATIONS_INVITEES'));
    await reloadDocumentCollaboration(doc.id);
    const updated=byId('PARTAGES_DOCUMENTS',id);
    const logged=tab('HISTORIQUE_PARTAGES').some(e=>Number(e.Partage)===id&&e.Action===nextStatus&&Number(e.Date_Evenement)===now);
    const prepared=nextStatus!=='Vérifié'||tab('CONSULTATIONS_INVITEES').some(x=>Number(x.Partage_ID)===id&&x.Statut==='Préparé');
    if(updated?.Statut!==nextStatus||!logged||!prepared)throw new Error('Mise à jour, copie ou historique non retrouvé après écriture.');
    notify(nextStatus==='Vérifié'?'Demande validée : document préparé automatiquement, accès invité désactivé.':'Décision enregistrée et journalisée. Aucun accès externe créé.',true);
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
// SIGMA V1.0 — Modèles de courriels ; aucune pièce jointe, lien ni transmission automatique.
const mailModels = () => tab('MODELES_COURRIELS').slice().sort((a,b)=>(Number(a.Ordre)||0)-(Number(b.Ordre)||0)||a.id-b.id);
const mailSafe = value => String(value ?? '').replace(/[\r\n]/g,' ').trim();
const mailAllowed = new Set(['destinataire','droit','expiration','version']);
// État local du brouillon ; jamais enregistré dans Grist et jamais envoyé automatiquement.
const mailDraft={docId:null,shareId:'',templateId:'',baselineSubject:'',baselineBody:'',ready:false};
function mailHasChanges(){
  return mailDraft.ready && ($('mail-subject').value!==mailDraft.baselineSubject || $('mail-body').value!==mailDraft.baselineBody);
}
function mailButtons(){
  const available=mailDraft.ready && !!$('mail-share').value && !!$('mail-template').value &&
    mailDraft.shareId===$('mail-share').value && mailDraft.templateId===$('mail-template').value;
  $('mail-copy').disabled=!available;
  $('mail-open').disabled=!available;
}
function mailInfo(text){$('mail-info').textContent=text;}
function clearMailDraft(message){
  $('mail-subject').value='';$('mail-body').value='';
  Object.assign(mailDraft,{shareId:'',templateId:'',baselineSubject:'',baselineBody:'',ready:false});
  mailButtons();mailInfo(message||'Sélectionne une demande vérifiée et un modèle : le courriel sera préparé automatiquement.');
}
function renderMailChoices(doc){
  const previousShare=$('mail-share').value,previousTemplate=$('mail-template').value;
  const eligible=documentShares(doc.id).filter(p=>{
    const version=byId('VERSIONS_DOCUMENTS',p.Version);
    return p.Statut==='Vérifié' && version?.Statut==='Validé' && Number(version.Document)===Number(doc.id) && Number(p.Expiration)>0 && Number(p.Expiration)+86400>Date.now()/1000;
  });
  $('mail-share').innerHTML='<option value="">Sélectionner une demande vérifiée…</option>'+eligible.map(p=>`<option value="${p.id}">${esc(p.Destinataire)} — ${esc(p.Email)} (version ${esc(byId('VERSIONS_DOCUMENTS',p.Version)?.Numero_Version)})</option>`).join('');
  $('mail-template').innerHTML='<option value="">Sélectionner un modèle…</option>'+mailModels().filter(m=>Number(m.Actif)===1).map(m=>`<option value="${m.id}">${esc(m.Libelle)}</option>`).join('');
  if(eligible.some(p=>String(p.id)===previousShare))$('mail-share').value=previousShare;
  if(mailModels().some(m=>String(m.id)===previousTemplate&&Number(m.Actif)===1))$('mail-template').value=previousTemplate;
  if(mailDraft.docId!==Number(doc.id)){
    clearMailDraft();mailDraft.docId=Number(doc.id);
  }else if($('mail-share').value && $('mail-template').value){
    // Un rafraîchissement Grist ne doit pas écraser un message retouché.
    if(!mailHasChanges())prepareMail({silent:true});
    else {mailButtons();mailInfo('Message personnalisé conservé. Actualiser demandera confirmation avant remplacement.');}
  }else if(!mailHasChanges())clearMailDraft();
  if(!eligible.length){
    const shares=documentShares(doc.id);
    const verified=shares.filter(p=>p.Statut==='Vérifié');
    let reason='Aucune demande vérifiée pour ce compte rendu.';
    if(verified.length){
      const expired=verified.filter(p=>!(Number(p.Expiration)>0 && Number(p.Expiration)+86400>Date.now()/1000)).length;
      const invalidVersion=verified.filter(p=>{const v=byId('VERSIONS_DOCUMENTS',p.Version);return !v||v.Statut!=='Validé'||Number(v.Document)!==Number(doc.id);}).length;
      reason=`${verified.length} demande(s) vérifiée(s), aucune éligible : ${expired} expirée(s), ${invalidVersion} avec version non validée ou introuvable. Vérifie les échéances et versions.`;
    }
    if(!mailHasChanges())mailInfo(reason);
  }else if(doc.Statut!=='Validé' && !mailHasChanges()){
    mailInfo(`La version courante du compte rendu est « ${doc.Statut} ». Les demandes vérifiées restent utilisables pour leur version validée d'origine.`);
  }
}
function mailContext(){
  const doc=currentDoc(),share=byId('PARTAGES_DOCUMENTS',Number($('mail-share').value));
  const model=byId('MODELES_COURRIELS',Number($('mail-template').value));
  if(!doc||!share||Number(share.Document)!==Number(doc.id)||share.Statut!=='Vérifié')throw new Error('Sélectionne une demande vérifiée correspondant au document.');
  const version=byId('VERSIONS_DOCUMENTS',share.Version);
  if(!version||Number(version.Document)!==Number(doc.id)||version.Statut!=='Validé')throw new Error('La version associée n’est plus valide.');
  if(!Number(share.Expiration)||Number(share.Expiration)+86400<=Date.now()/1000)throw new Error('Cette demande a expiré.');
  if(!model||Number(model.Actif)!==1)throw new Error('Sélectionne un modèle actif.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(share.Email||''))||/[\r\n]/.test(share.Email))throw new Error('Adresse électronique du destinataire invalide.');
  return {doc,share,version,model};
}
function mailExpand(template,ctx){
  const values={destinataire:mailSafe(ctx.share.Destinataire),droit:ctx.share.Droit==='commentaire'?'lecture et commentaires':'lecture seule',expiration:dateText(ctx.share.Expiration),version:String(ctx.version.Numero_Version)};
  return String(template||'').replace(/\{([^{}]+)\}/g,(_,key)=>mailAllowed.has(key)?values[key]:'{'+key+'}');
}
function prepareMail({force=false,silent=false}={}){
  const shareId=$('mail-share').value,templateId=$('mail-template').value;
  const changedSelection=mailDraft.ready && (mailDraft.shareId!==shareId||mailDraft.templateId!==templateId);
  if(mailHasChanges() && (force||changedSelection)){
    if(!confirm('Le courriel contient des modifications manuelles. Les remplacer par le modèle sélectionné ?')){
      if(changedSelection){$('mail-share').value=mailDraft.shareId;$('mail-template').value=mailDraft.templateId;}
      mailButtons();mailInfo('Modifications manuelles conservées.');
      return false;
    }
  }
  if(!shareId||!templateId){
    clearMailDraft();
    return false;
  }
  try{
    const ctx=mailContext();
    const subject=mailExpand(ctx.model.Objet,ctx).replace(/[\r\n]/g,' ').trim();
    const body=mailExpand(ctx.model.Corps,ctx);
    $('mail-subject').value=subject;$('mail-body').value=body;
    Object.assign(mailDraft,{docId:Number(ctx.doc.id),shareId,templateId,baselineSubject:subject,baselineBody:body,ready:true});
    mailButtons();
    mailInfo('Message préparé pour '+ctx.share.Email+'. Tu peux modifier le texte avant ouverture. Aucun accès au document n’est créé.');
    if(!silent)notify('Message actualisé. Vérifie le contenu avant envoi.',true);
    return true;
  }catch(e){
    clearMailDraft('Préparation impossible : '+e.message);
    if(!silent)notify(e.message);
    return false;
  }
}
function onMailSelectionChange(){
  prepareMail({silent:true});
}
function composedMail(){
  const ctx=mailContext(),subject=$('mail-subject').value.trim(),body=$('mail-body').value.trim();
  if(!mailDraft.ready || mailDraft.shareId!==$('mail-share').value || mailDraft.templateId!==$('mail-template').value)throw new Error('Sélectionne une demande et un modèle pour préparer le courriel.');
  if(!subject||!body)throw new Error('Vérifie l’objet et le corps du message.');
  if(/[\r\n]/.test(subject))throw new Error('L’objet ne doit pas contenir de retour à la ligne.');
  if(/https?:\/\//i.test(body)||/https?:\/\//i.test(subject))throw new Error('Aucun lien HTTP(S) n’est accepté dans ce pilote sans accès externe.');
  return {email:ctx.share.Email,subject,body};
}
$('mail-preview').addEventListener('click',()=>prepareMail({force:true}));
$('mail-share').addEventListener('change',onMailSelectionChange);
for(const id of ['mail-subject','mail-body'])$(id).addEventListener('input',()=>{
  mailButtons();
  if(mailHasChanges())mailInfo('Message personnalisé : tes modifications sont conservées.');
  else if(mailDraft.ready)mailInfo('Message conforme au modèle, prêt à être vérifié.');
});
$('mail-template').addEventListener('change',()=>{
  onMailSelectionChange();
  const m=byId('MODELES_COURRIELS',Number($('mail-template').value));
  $('mail-template-id').value=m?.id||'';$('mail-model-code').value=m?.Code||'';
  $('mail-model-label').value=m?.Libelle||'';$('mail-model-subject').value=m?.Objet||'';$('mail-model-body').value=m?.Corps||'';
  $('mail-model-active').checked=Number(m?.Actif)===1;
});
$('mail-model-new').addEventListener('click',()=>{$('mail-template-form').reset();$('mail-template-id').value='';$('mail-model-active').checked=true;});
$('mail-template-form').addEventListener('submit',async e=>{
  e.preventDefault();if(state.busy)return;
  const id=Number($('mail-template-id').value)||null,code=$('mail-model-code').value.trim();
  const fields={Code:code,Libelle:$('mail-model-label').value.trim(),Objet:$('mail-model-subject').value.trim(),Corps:$('mail-model-body').value.trim(),Actif:$('mail-model-active').checked?1:0,Ordre:id?Number(byId('MODELES_COURRIELS',id)?.Ordre)||0:mailModels().length+1};
  if(!/^[A-Za-z0-9_-]{2,60}$/.test(code)||!fields.Libelle||!fields.Objet||!fields.Corps)return notify('Renseigne un code alphanumérique unique, un libellé, un objet et un corps.');
  if(mailModels().some(m=>m.Code===code&&Number(m.id)!==id))return notify('Ce code de modèle existe déjà.');
  state.busy=true;
  try{
    await grist.docApi.applyUserActions([[id?'UpdateRecord':'AddRecord','MODELES_COURRIELS',id,fields]]);
    state.data.MODELES_COURRIELS=rowsFrom(await grist.docApi.fetchTable('MODELES_COURRIELS'));
    const saved=mailModels().find(m=>m.Code===code&&m.Corps===fields.Corps);
    if(!saved)throw new Error('Le modèle n’a pas été retrouvé après écriture.');
    renderMailChoices(currentDoc());$('mail-template').value=String(saved.id);
    $('mail-template-id').value=saved.id;
    onMailSelectionChange();
    notify('Modèle de courriel enregistré dans Grist.',true);
  }catch(err){notify('Modèle non confirmé : '+err.message);}
  finally{state.busy=false;}
});
$('mail-copy').addEventListener('click',async()=>{
  try{const m=composedMail();const txt='À : '+m.email+'\nObjet : '+m.subject+'\n\n'+m.body;
    if(!navigator.clipboard?.writeText)throw new Error('Presse-papiers non disponible dans ce widget.');
    await navigator.clipboard.writeText(txt);notify('Courriel copié. Aucun message n’a été envoyé.',true);
  }catch(e){notify('Copie impossible : '+e.message);}
});
$('mail-open').addEventListener('click',()=>{
  try{const m=composedMail();
    if(!confirm('Ouvrir la messagerie pour '+m.email+' ? Aucun accès au document n’est créé ; vérifie le contenu avant envoi.'))return;
    const url='mailto:'+m.email+'?subject='+encodeURIComponent(m.subject)+'&body='+encodeURIComponent(m.body);
    if(url.length>1800)throw new Error('Message trop long pour une URL mailto : utilise Copier le courriel.');
    window.location.href=url;
    notify('Ouverture de la messagerie demandée (envoi non confirmé).',true);
  }catch(e){notify('Impossible d’ouvrir le courriel : '+e.message);}
});

document.addEventListener('click',e=>{const b=e.target.closest('[data-share-snapshot]');if(b)sigmaPrepareConsultation(Number(b.dataset.shareSnapshot));});
$('comment-form').addEventListener('submit',addDocumentComment);
$('share-form').addEventListener('submit',prepareDocumentShare);
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-comment-resolve]');
  if(c){const id=Number(c.dataset.commentResolve),item=byId('COMMENTAIRES_DOCUMENTS',id),doc=currentDoc();
    if(item&&doc&&Number(item.Document)===Number(doc.id)&&confirm('Marquer ce commentaire comme résolu ?'))changeCollabStatus('COMMENTAIRES_DOCUMENTS',id,{Etat:'Résolu'},doc.id,'Commentaire résolu.');}
  for(const [selector,status] of [['[data-share-review]','Vérifié'],['[data-share-reject]','Refusé'],['[data-share-cancel]','Annulé']]){
    const b=e.target.closest(selector);if(!b)continue;
    const id=Number(b.dataset.shareReview||b.dataset.shareReject||b.dataset.shareCancel);
    const reason=prompt(status==='Vérifié'?'Motif de validation (le document sera préparé, sans accès invité) :':status==='Refusé'?'Motif du refus :':'Motif de l’annulation ou de la révocation de la demande :');
    if(reason!==null)decideShare(id,status,reason);break;
  }
});

for(const el of document.querySelectorAll('.nav'))el.addEventListener('click',()=>{if(el.dataset.view==='archives'){$('archives-search').value='';state.archiveYear=null;}show(el.dataset.view);});$('add').onclick=()=>openForm();$('close').onclick=closeForm;$('cancel').onclick=closeForm;$('refresh').onclick=refresh;$('all').onclick=()=>show('dossiers');
$('archives-back').onclick=()=>{state.archiveYear=null;$('archives-search').value='';render();};
$('archives-search').addEventListener('input',()=>{if(state.view==='archives')render();});
$('archives-years').addEventListener('click',e=>{const b=e.target.closest('[data-archive-year]');if(!b)return;const year=Number(b.dataset.archiveYear);if(!sigmaArchiveStats().some(([y])=>y===year))return;state.archiveYear=year;$('archives-search').value='';render();});$('home-open-agenda').onclick=()=>{state.agendaDate=new Date();show('agenda');};$('record-form').addEventListener('submit',save);for(const id of ['search','filter-status','filter-motif','filter-archive','filter-archive-year'])$(id).addEventListener(id==='search'?'input':'change',render);$('clear').onclick=()=>{$('search').value='';$('filter-status').value='';$('filter-motif').value='';$('filter-archive').value='active';$('filter-archive-year').value='';sigmaLoadArchiveFilters();render();};$('filter-archive').addEventListener('change',()=>{sigmaLoadArchiveFilters();render();});$('sigma-archive-button').addEventListener('click',sigmaArchiveDossier);document.addEventListener('click',ev=>{const button=ev.target.closest('[data-edit]');if(button)openForm(Number(button.dataset.edit));});$('run-audit').onclick=refresh;$('add-user').onclick=()=>editUser();$('user-close').onclick=closeUser;$('user-cancel').onclick=closeUser;$('user-form').addEventListener('submit',saveUser);$('access-form').addEventListener('submit',saveAccess);$('access-close').onclick=closeAccess;$('access-cancel').onclick=closeAccess;document.addEventListener('click',e=>{const b=e.target.closest('[data-access-user]');if(b)openAccess(Number(b.dataset.accessUser));});document.addEventListener('click',e=>{const b=e.target.closest('[data-user-edit]');if(b)editUser(Number(b.dataset.userEdit));});document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){closeForm();closeUser();closeAccess();closePersonForm();closeRdv();closeDocument();$('version-modal').classList.add('hidden');}});
if(typeof grist==='undefined'){notify('Ce widget doit être ouvert depuis une page Grist (API indisponible).');}else{grist.ready({requiredAccess:'full'});refresh();}


// SIGMA V1.0.4 - commandes de confort pour rubriques du suivi.
// Utilise les éléments natifs <details> : aucune incidence sur les ACL ou les écritures.
document.querySelectorAll('[data-fold-action][data-fold-target]').forEach(button => {
  button.addEventListener('click', () => {
    const parent = document.getElementById(button.dataset.foldTarget);
    if (!parent) return;
    parent.querySelectorAll('details.sigma-fold').forEach(d => {
      d.open = button.dataset.foldAction === 'expand';
    });
  });
});

// SIGMA V1.0.4 — Navigation contextuelle, sans écriture Grist ni changement ACL.
function sigmaActivateTab(target){
  const btn=document.querySelector(`[data-tab-target="${target}"]`);
  if(!btn||btn.disabled)return;
  const tabs=btn.closest('[data-sigma-tabs]');
  if(!tabs)return;
  for(const other of tabs.querySelectorAll('[role="tab"]')){
    const active=other===btn;
    other.classList.toggle('active',active);
    other.setAttribute('aria-selected',String(active));
    other.tabIndex=active?0:-1;
    const panel=document.getElementById(other.dataset.tabTarget);
    if(panel){
      panel.classList.toggle('hidden',!active);
      if(active){
        // Dans la fiche de dossier, chaque onglet contient une rubrique <details>
        // dont le titre est masqué par le CSS. Elle DOIT être ouverte, sinon
        // le contenu existe dans le DOM mais reste totalement invisible.
        // Les rubriques secondaires des documents restent repliables.
        const isDossierPanel=tabs.dataset.sigmaTabs==='suivi';
        for(const fold of panel.querySelectorAll('details.sigma-fold')){
          if(isDossierPanel){
            fold.open=true;
          }else{
            fold.open=target==='document-tab-history' || (target==='document-tab-share' && fold.id==='sigma-new-share');
          }
        }
      }
    }
  }
}
function sigmaDocumentTabAvailability(exists){
  for(const id of ['btn-document-tab-history','btn-document-tab-read','btn-document-tab-share','btn-document-tab-tracking']){
    const btn=document.getElementById(id);if(btn)btn.disabled=!exists;
  }
}
document.querySelectorAll('[data-sigma-tabs]').forEach(tablist=>{
  tablist.addEventListener('click',e=>{
    const button=e.target.closest('button[data-tab-target]');
    if(button)sigmaActivateTab(button.dataset.tabTarget);
  });
  tablist.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const buttons=[...tablist.querySelectorAll('[role="tab"]')].filter(b=>!b.disabled);
    const i=buttons.indexOf(document.activeElement);if(i===-1)return;
    e.preventDefault();
    const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    sigmaActivateTab(buttons[next].dataset.tabTarget);buttons[next].focus();
  });
});

// V1.0.16.11 : fermeture par boutons explicites uniquement ; pas par clic sur le fond.
