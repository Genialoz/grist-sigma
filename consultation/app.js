/* SIGMA V1.0.16.3 TEST — consultation en lecture seule, refusee par defaut.
   IMPORTANT : aucune autorisation n'est fournie par ce JavaScript.
   Une ACL Grist et un document isole sont indispensables. */
'use strict';
(() => {
  const TABLE = 'CONSULTATIONS_INVITEES';
  const $ = (id) => document.getElementById(id);
  const required = ['id', 'Email', 'Statut', 'Titre', 'Version_Numero', 'Contenu', 'Expiration'];
  function status(message, type = '') {
    $('notice').textContent = message;
    $('notice').className = 'message' + (type ? ' ' + type : '');
  }
  function renderNone(message) {
    $('viewer').classList.add('hidden');
    $('title').textContent = '';
    $('content').textContent = '';
    status(message, 'error');
  }
  function fromColumnar(data) {
    if (Array.isArray(data)) return data;
    if (!data || !Array.isArray(data.id)) throw Error('Format Grist non reconnu.');
    return data.id.map((id, i) => {
      const row = { id };
      Object.keys(data).forEach(k => { if (Array.isArray(data[k]) && k !== 'id') row[k] = data[k][i]; });
      return row;
    });
  }
  function expiryInSeconds(raw) {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    return NaN;
  }
  function render(rows) {
    // Cette vérification JS sert à l'ergonomie, pas à l'autorisation.
    // La protection réelle doit filtrer la ligne AVANT son envoi par Grist.
    const validRows = rows.filter(r => r.Statut === 'Actif' && expiryInSeconds(r.Expiration) > Date.now() / 1000);
    if (validRows.length !== 1) {
      renderNone(validRows.length > 1 ? 'Plusieurs consultations sont accessibles. Par sécurité, aucun contenu n’est affiché : contactez le gestionnaire.' : 'Aucune consultation active et non expirée n’est disponible pour votre compte.');
      return;
    }
    const r = validRows[0];
    $('title').textContent = String(r.Titre || 'Compte rendu');
    $('version').textContent = 'Version ' + String(r.Version_Numero || '—');
    $('expiration').textContent = 'Échéance indicative : ' + new Date(expiryInSeconds(r.Expiration) * 1000).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
    $('content').textContent = String(r.Contenu || 'Aucun contenu.');
    $('viewer').classList.remove('hidden');
    status('Vous consultez une copie en lecture seule. Aucun commentaire ni modification n’est possible dans cette version.', 'ok');
  }
  async function reload() {
    $('viewer').classList.add('hidden');
    status('Chargement de votre consultation…');
    try {
      // fetchSelectedTable limite l'acces au tableau explicitement associe au widget.
      // Les ACL sont appliquees par Grist sur les enregistrements renvoyes.
      const raw = await grist.docApi.fetchSelectedTable();
      const rows = fromColumnar(raw);
      if (rows.length) {
        const missing = required.filter(field => !(field in rows[0]));
        if (missing.length) throw Error('Colonnes manquantes : ' + missing.join(', '));
      }
      render(rows);
    } catch (e) {
      renderNone('Consultation indisponible. Vérifiez le paramétrage Grist et les autorisations.');
      console.error('SIGMA consultation :', e);
    }
  }
  $('reload').addEventListener('click', reload);
  if (typeof grist === 'undefined') {
    renderNone('API Grist non chargée. Vérifiez que cette URL est intégrée dans un widget personnalisé Grist et que le script grist-plugin-api.js n’est pas bloqué.');
    console.error('SIGMA consultation : grist-plugin-api.js non chargé ou non exécuté.');
    return;
  }
  grist.ready({ requiredAccess: 'read table' });
  grist.onRecords((rows) => {
    try { render(fromColumnar(rows)); } catch (e) { renderNone('Données Grist invalides.'); console.error(e); }
  });
  reload();
})();
