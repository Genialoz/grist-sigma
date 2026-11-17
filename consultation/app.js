/* SIGMA V1.0.16.8 TEST — lecture seule, aucune autorisation créée par le widget.
   Les ACL Grist sont indispensables ; l'expiration JS ne sécurise pas l'API. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const required = ['id', 'Email', 'Statut', 'Titre', 'Version_Numero', 'Contenu', 'Expiration'];
  let revision = 0;
  let selectedId = null;
  let visibleRows = [];
  let commentsRevision = 0;
  const COMMENTS_TABLE = 'COMMENTAIRES_INVITES';
  const commentsList = $('comments-list');
  const commentsNotice = $('comments-notice');
  const commentsForm = $('comment-form');
  const commentContent = $('comment-content');
  const commentSave = $('comment-save');
  const commentPanel = $('comments-panel');
  let commentsReady = false;
  let commentBusy = false;
  function commentNotice(message, isError = false) {
    commentsNotice.textContent = message;
    commentsNotice.classList.toggle('error', isError);
  }
  function safeDate(value) {
    const ts = dateSeconds(value);
    if (!Number.isFinite(ts)) return 'Date non disponible';
    return new Date(ts * 1000).toLocaleString('fr-FR', {dateStyle: 'medium', timeStyle: 'short'});
  }
  function clearComments() {
    commentsRevision++;
    commentsList.replaceChildren();
    commentPanel.classList.add('hidden');
    commentContent.value = '';
  }
  function insertComment(item) {
    const node = document.createElement('article');
    node.className = 'comment-item';
    const header = document.createElement('div');
    header.className = 'comment-item-head';
    const author = document.createElement('strong');
    author.textContent = String(item.Auteur_Email || 'Auteur non renseigné');
    const time = document.createElement('time');
    time.textContent = safeDate(item.Date_Creation);
    header.append(author, time);
    const body = document.createElement('p');
    body.textContent = String(item.Contenu || '');
    node.append(header, body);
    commentsList.appendChild(node);
  }
  async function loadComments(consultationId) {
    const ticket = ++commentsRevision;
    commentsList.replaceChildren();
    commentPanel.classList.remove('hidden');
    commentSave.disabled = true;
    commentNotice('Chargement des commentaires…');
    try {
      // Seules les lignes autorisées par les ACL Grist sont retournées.
      const raw = await grist.docApi.fetchTable(COMMENTS_TABLE, {keepEncoded: true});
      if (ticket !== commentsRevision || String(selectedId) !== String(consultationId)) return;
      const comments = rowsFrom(raw)
        .filter(c => Number(c.Consultation) === Number(consultationId))
        .sort((a,b) => dateSeconds(a.Date_Creation)-dateSeconds(b.Date_Creation) || Number(a.id)-Number(b.id));
      comments.forEach(insertComment);
      if (!comments.length) {
        const empty = document.createElement('p');
        empty.className = 'comments-empty';
        empty.textContent = 'Aucun commentaire pour cette consultation.';
        commentsList.appendChild(empty);
      }
      commentsReady = true;
      const row = visibleRows.find(r => String(r.id) === String(consultationId));
      const allowed = row?.Droit === 'commentaire';
      commentNotice(allowed ? `${comments.length} commentaire(s). Vous pouvez en ajouter un si les ACL vous y autorisent.` : `${comments.length} commentaire(s). Consultation en lecture seule.`);
      commentsForm.classList.toggle('hidden', !allowed);
      commentSave.disabled = !allowed || commentBusy;
    } catch (e) {
      if (ticket !== commentsRevision) return;
      commentsReady = false;
      commentsForm.classList.add('hidden');
      commentNotice('Commentaires indisponibles : table, niveau d’accès du widget ou ACL à vérifier.', true);
      console.error('SIGMA commentaires — lecture :', e);
    }
  }
  async function submitComment(event) {
    event.preventDefault();
    if (commentBusy || !commentsReady) return;
    const row = visibleRows.find(r => String(r.id) === String(selectedId));
    if (!row || row.Droit !== 'commentaire' || row.Statut !== 'Actif' || !(dateSeconds(row.Expiration) > Date.now()/1000)) {
      commentNotice('Cette consultation n’autorise pas de commentaire.', true); return;
    }
    const content = commentContent.value.trim();
    if (!content || content.length > 3000) { commentNotice('Saisissez un commentaire de 1 à 3 000 caractères.', true); return; }
    commentBusy = true; commentSave.disabled = true;
    try {
      // Réévaluation de l’état de la copie avant écriture. Les ACL Grist restent l’autorité.
      const refreshed = rowsFrom(await grist.docApi.fetchSelectedTable({keepEncoded: true}));
      if (!refreshed.some(r => Number(r.id) === Number(row.id) && r.Statut === 'Actif' && r.Droit === 'commentaire' && dateSeconds(r.Expiration) > Date.now()/1000)) {
        throw Error('La consultation a changé ou n’est plus active.');
      }
      await grist.docApi.applyUserActions([['AddRecord', COMMENTS_TABLE, null, {Consultation:Number(row.id), Contenu:content}]]);
      commentContent.value = '';
      await loadComments(row.id);
      commentNotice('Commentaire enregistré.');
    } catch (e) {
      commentNotice('Commentaire non enregistré : droits Grist insuffisants ou contrôle de sécurité refusé. Vérifiez les ACL.', true);
      console.error('SIGMA commentaires — écriture :', e);
    } finally { commentBusy = false; commentSave.disabled = false; }
  }
  commentsForm.addEventListener('submit', submitComment);
  function status(message, type = '') {
    $('notice').textContent = message;
    $('notice').className = 'message' + (type ? ' ' + type : '');
  }
  function hide(message) {
    $('viewer').classList.add('hidden');
    $('consultation-picker').classList.add('hidden');
    $('title').textContent = '';
    $('content').textContent = '';
    clearComments();
    status(message, 'error');
  }
  function rowsFrom(data) {
    if (Array.isArray(data)) return data;
    if (!data || !Array.isArray(data.id)) throw Error('La table Grist n’a pas renvoyé de lignes reconnues.');
    return data.id.map((id, i) => {
      const row = {id};
      for (const [name, values] of Object.entries(data)) {
        if (name !== 'id' && Array.isArray(values)) row[name] = values[i];
      }
      return row;
    });
  }
  function dateSeconds(value) {
    // L'API Grist peut fournir une Date sous forme numérique ou décodée.
    // Avec keepEncoded:true, une date peut être un tableau ["D", secondes Unix].
    // Le mode typé de Grist peut également utiliser le code "d".
    if (Array.isArray(value)) {
      if (value.length === 2 && (value[0] === 'D' || value[0] === 'd') &&
          typeof value[1] === 'number' && Number.isFinite(value[1])) return value[1];
      return NaN;  // Refuser les valeurs complexes inattendues.
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() / 1000 : NaN;
    if (typeof value === 'string' && value.trim()) {
      const text = value.trim();
      if (/^\d{4}-\d\d-\d\d(?:T.*)?$/.test(text)) {
        const parsed = Date.parse(text.length === 10 ? text + 'T00:00:00Z' : text);
        return Number.isFinite(parsed) ? parsed / 1000 : NaN;
      }
    }
    return NaN;
  }
  function labelOf(row) {
    const title = String(row.Titre || 'Compte rendu').trim();
    return title.slice(0, 130) + ' · version ' + String(row.Version_Numero || '—');
  }
  function drawSelected() {
    const r = visibleRows.find(row => String(row.id) === String(selectedId));
    if (!r) { hide('Aucune consultation sélectionnée.'); return; }
    $('title').textContent = String(r.Titre || 'Compte rendu');
    $('version').textContent = 'Version ' + String(r.Version_Numero || '—');
    $('expiration').textContent = 'Échéance indicative : ' + new Date(dateSeconds(r.Expiration) * 1000).toLocaleDateString('fr-FR', {timeZone: 'UTC'});
    $('content').textContent = String(r.Contenu || 'Aucun contenu.');
    $('viewer').classList.remove('hidden');
    commentsForm.classList.add('hidden');
    void loadComments(r.id);
    status(visibleRows.length > 1 ? `${visibleRows.length} comptes rendus disponibles pour ce compte. Choisissez celui à consulter.` : 'Copie fictive en lecture seule. Aucun droit externe n’est activé par ce widget.', 'ok');
  }
  function showRows(rows) {
    const missing = rows.length ? required.filter(field => !(field in rows[0])) : [];
    if (missing.length) { hide('Configuration incomplète : colonnes manquantes (' + missing.join(', ') + ').'); return; }
    const now = Date.now() / 1000;
    const active = rows.filter(r => String(r.Statut || '').trim() === 'Actif');
    // Filtrage d'affichage exclusivement : les ACL Grist doivent isoler les lignes AVANT leur transmission.
    visibleRows = active.filter(r => dateSeconds(r.Expiration) > now).sort((a,b) => Number(b.id)-Number(a.id));
    if (!visibleRows.length) {
      selectedId = null;
      if (!rows.length) { hide('Aucune ligne accessible dans la table CONSULTATIONS_INVITEES. Vérifiez la vue et les ACL.'); return; }
      if (!active.length) { hide('Aucune ligne avec le statut exactement « Actif ». Vérifiez la valeur du champ Statut.'); return; }
      if (active.some(r => !Number.isFinite(dateSeconds(r.Expiration)))) { hide('Date d’expiration non reconnue. Vérifiez le type Date et la valeur de la colonne Expiration.'); return; }
      hide('La consultation est expirée. Vérifiez la date Expiration dans Grist.');
      return;
    }
    if (!visibleRows.some(r => String(r.id) === String(selectedId))) selectedId = visibleRows[0].id;
    const picker = $('consultation-picker');
    picker.classList.toggle('hidden', visibleRows.length < 2);
    const select = $('consultation-select');
    select.replaceChildren();
    for (const row of visibleRows) {
      const option = document.createElement('option');
      option.value = String(row.id);
      option.textContent = labelOf(row);
      select.appendChild(option);
    }
    select.value = String(selectedId);
    $('consultation-count').textContent = `${visibleRows.length} comptes rendus autorisés`;
    drawSelected();
  }
  $('consultation-select').addEventListener('change', event => {
    selectedId = event.target.value;
    drawSelected();
  });
  async function reload() {
    const current = ++revision;
    $('viewer').classList.add('hidden');
    clearComments();
    status('Chargement de votre consultation…');
    try {
      // Toujours utiliser le même chemin pour les chargements et notifications.
      // keepEncoded conserve les Date au format numérique Grist (secondes Unix).
      const data = await grist.docApi.fetchSelectedTable({keepEncoded: true});
      if (current !== revision) return;
      showRows(rowsFrom(data));
    } catch (e) {
      if (current !== revision) return;
      hide('Impossible de lire la table sélectionnée. Vérifiez le niveau « Lecture de la table » et les ACL.');
      console.error('SIGMA consultation — chargement :', e);
    }
  }
  $('reload').addEventListener('click', reload);
  if (typeof grist === 'undefined') {
    hide('API Grist non chargée. Ouvrez cette page dans un widget personnalisé Grist.');
    return;
  }
  // L’écriture d’un commentaire et la lecture de la table liée exigent l’accès widget « full ».
  // Les ACL Grist doivent refuser tout accès métier non autorisé.
  grist.ready({requiredAccess: 'full'});
  // onRecords sert uniquement de signal d'actualisation, sans traiter son format
  // potentiellement différent de fetchSelectedTable.
  grist.onRecords(() => { void reload(); });
  void reload();
})();
