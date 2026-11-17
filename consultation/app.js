/* SIGMA V1.0.16.6 TEST — lecture seule, aucune autorisation créée par le widget.
   Les ACL Grist sont indispensables ; l'expiration JS ne sécurise pas l'API. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const required = ['id', 'Email', 'Statut', 'Titre', 'Version_Numero', 'Contenu', 'Expiration'];
  let revision = 0;
  function status(message, type = '') {
    $('notice').textContent = message;
    $('notice').className = 'message' + (type ? ' ' + type : '');
  }
  function hide(message) {
    $('viewer').classList.add('hidden');
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
  function showRows(rows) {
    const missing = rows.length ? required.filter(field => !(field in rows[0])) : [];
    if (missing.length) { hide('Configuration incomplète : colonnes manquantes (' + missing.join(', ') + ').'); return; }
    const now = Date.now() / 1000;
    const active = rows.filter(r => String(r.Statut || '').trim() === 'Actif');
    const valid = active.filter(r => dateSeconds(r.Expiration) > now);
    if (valid.length !== 1) {
      if (valid.length > 1) { hide('Plusieurs consultations actives sont accessibles : affichage bloqué.'); return; }
      if (!rows.length) { hide('Aucune ligne accessible dans la table CONSULTATIONS_INVITEES. Vérifiez la vue et les ACL.'); return; }
      if (!active.length) { hide('Aucune ligne avec le statut exactement « Actif ». Vérifiez la valeur du champ Statut.'); return; }
      if (active.some(r => !Number.isFinite(dateSeconds(r.Expiration)))) { hide('Date d’expiration non reconnue. Vérifiez le type Date et la valeur de la colonne Expiration.'); return; }
      hide('La consultation est expirée. Vérifiez la date Expiration dans Grist.');
      return;
    }
    const r = valid[0];
    $('title').textContent = String(r.Titre || 'Compte rendu');
    $('version').textContent = 'Version ' + String(r.Version_Numero || '—');
    $('expiration').textContent = 'Échéance indicative : ' + new Date(dateSeconds(r.Expiration) * 1000).toLocaleDateString('fr-FR', {timeZone: 'UTC'});
    $('content').textContent = String(r.Contenu || 'Aucun contenu.');
    $('viewer').classList.remove('hidden');
    status('Copie fictive en lecture seule. Aucun droit externe n’est activé par ce widget.', 'ok');
  }
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
