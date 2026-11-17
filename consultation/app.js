/* SIGMA V1.0.16.7 TEST — lecture seule, aucune autorisation créée par le widget.
   Les ACL Grist sont indispensables ; l'expiration JS ne sécurise pas l'API. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const required = ['id', 'Email', 'Statut', 'Titre', 'Version_Numero', 'Contenu', 'Expiration'];
  let revision = 0;
  let selectedId = null;
  let visibleRows = [];
  function status(message, type = '') {
    $('notice').textContent = message;
    $('notice').className = 'message' + (type ? ' ' + type : '');
  }
  function hide(message) {
    $('viewer').classList.add('hidden');
    $('consultation-picker').classList.add('hidden');
    $('title').textContent = '';
    $('content').textContent = '';
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
  grist.ready({requiredAccess: 'read table'});
  // onRecords sert uniquement de signal d'actualisation, sans traiter son format
  // potentiellement différent de fetchSelectedTable.
  grist.onRecords(() => { void reload(); });
  void reload();
})();
