/* SIGMA V0.4 PILOTE : widget référent en lecture seule.
   Les droits dépendent exclusivement des ACL Grist configurées côté serveur.
   Ne pas utiliser avec des données réelles. */
'use strict';
const TABLES = ['SIGNALEMENTS','SIGNALEMENT_MOTIFS','ACADEMIES','MOTIFS','STATUTS'];
const data={};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rowsFrom(x){if(Array.isArray(x))return x;if(!x||!Array.isArray(x.id))throw new Error('Format de réponse Grist inattendu');return x.id.map((id,i)=>Object.fromEntries([['id',id],...Object.entries(x).filter(([k,v])=>k!=='id'&&Array.isArray(v)).map(([k,v])=>[k,v[i]])]));}
const t=n=>data[n]||[];
const row=(n,id)=>t(n).find(r=>Number(r.id)===Number(id));
const links=id=>t('SIGNALEMENT_MOTIFS').filter(l=>Number(l.Signalement)===Number(id));
const motifs=id=>links(id).map(l=>row('MOTIFS',l.Motif)?.Libelle).filter(Boolean);
const date=v=>typeof v==='number'&&v>0?new Date(v*1000).toLocaleDateString('fr-FR',{timeZone:'UTC'}):'—';
function message(s,error=false){$('message').textContent=s;$('message').classList.toggle('error',error);}
function renderOptions(){ $('statut').innerHTML='<option value="">Tous les statuts</option>'+t('STATUTS').slice().sort((a,b)=>(a.Ordre||0)-(b.Ordre||0)).map(r=>`<option value="${r.id}">${esc(r.Libelle)}</option>`).join('');$('motif').innerHTML='<option value="">Tous les motifs</option>'+t('MOTIFS').slice().sort((a,b)=>(a.Ordre||0)-(b.Ordre||0)).map(r=>`<option value="${r.id}">${esc(r.Libelle)}</option>`).join('');}
function render(){const q=$('search').value.trim().toLowerCase(),s=$('statut').value,m=$('motif').value;const list=t('SIGNALEMENTS').filter(r=>(!s||String(r.Statut)===s)&&(!m||links(r.id).some(l=>String(l.Motif)===m))&&(!q||[r.Numero,r.Objet,row('ACADEMIES',r.Academie)?.Nom,...motifs(r.id)].join(' ').toLowerCase().includes(q))).sort((a,b)=>b.id-a.id);$('count').textContent=`${list.length} dossier(s)`;$('rows').innerHTML=list.map(r=>`<tr><td><strong>${esc(r.Numero)}</strong></td><td>${esc(r.Objet)}</td><td>${esc(row('ACADEMIES',r.Academie)?.Nom||'—')}</td><td>${esc(motifs(r.id).join(', ')||'—')}</td><td>${esc(row('STATUTS',r.Statut)?.Libelle||'—')}</td><td>${date(r.Date_Reception)}</td><td><button type="button" data-open="${r.id}">Consulter</button></td></tr>`).join('')||'<tr><td colspan="7" class="muted">Aucun dossier accessible ou correspondant aux filtres.</td></tr>';}
function openDetail(id){const r=row('SIGNALEMENTS',id);if(!r){message('Dossier non disponible dans les données autorisées.',true);return;}const fields=[['Numéro',r.Numero],['Objet',r.Objet],['Académie',row('ACADEMIES',r.Academie)?.Nom],['Statut',row('STATUTS',r.Statut)?.Libelle],['Date de réception',date(r.Date_Reception)],['Motifs',motifs(r.id).join(', ')],['Résumé',r.Resume]];$('detail-body').innerHTML=fields.map(([k,v])=>`<div class="field"><dt>${esc(k)}</dt><dd>${esc(v||'—')}</dd></div>`).join('');$('details').classList.remove('hidden');$('details').scrollIntoView({block:'nearest',behavior:'smooth'});}
async function refresh(){message('Chargement des données autorisées par Grist…');$('details').classList.add('hidden');$('rows').innerHTML='';try{for(const name of TABLES)data[name]=rowsFrom(await grist.docApi.fetchTable(name));renderOptions();render();message('Affichage en lecture seule. Les ACL Grist doivent être testées séparément.');}catch(e){for(const key of Object.keys(data))delete data[key];$('rows').innerHTML='';$('count').textContent='0 dossier';message('Accès refusé ou chargement impossible : '+(e?.message||String(e))+'. Vérifiez les ACL de la copie PILOTE.',true);}}
$('refresh').addEventListener('click',refresh);$('close').addEventListener('click',()=>$('details').classList.add('hidden'));for(const id of ['search','statut','motif'])$(id).addEventListener(id==='search'?'input':'change',render);document.addEventListener('click',ev=>{const b=ev.target.closest('[data-open]');if(b)openDetail(Number(b.dataset.open));});
if(typeof grist==='undefined')message('Ouvrez ce widget depuis une page Grist.',true);else{grist.ready({requiredAccess:'full'});refresh();}
