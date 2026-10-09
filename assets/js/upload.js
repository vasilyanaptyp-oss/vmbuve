/* V & M Būve — pievienot.html (photo self-upload) */
(function () {
  'use strict';

  var DEFAULT_ENDPOINT = 'https://REPLACE-WITH-WORKER-URL.workers.dev/upload';
  var MAX_EDGE = 1600;
  var MAX_BYTES = 400 * 1024;

  function endpoint() {
    try {
      var override = window.localStorage && window.localStorage.getItem('vmbuve_upload_endpoint');
      if (override) return override;
    } catch (e) { /* localStorage unavailable (private mode) — use the default */ }
    return DEFAULT_ENDPOINT;
  }

  function slugify(name) {
    var text = String(name || '').trim().toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '');
    var out = '', dash = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (/[a-z0-9]/.test(c)) { out += c; dash = false; }
      else if (!dash) { out += '-'; dash = true; }
    }
    return out.replace(/^-+|-+$/g, '') || 'foto';
  }

  var form = document.getElementById('upload-form');
  if (!form) return;

  var fileInput = document.getElementById('u-file');
  var preview = document.getElementById('u-preview');
  var titleInput = document.getElementById('u-title');
  var categoryInput = document.getElementById('u-category');
  var categoryList = document.getElementById('u-categories');
  var submitBtn = document.getElementById('u-submit');
  var status = document.getElementById('u-status');

  var preparedBlob = null;
  var preparedExt = null;

  function setStatus(message, kind) {
    status.hidden = !message;
    status.textContent = message || '';
    status.classList.remove('is-error', 'is-ok');
    if (kind) status.classList.add(kind);
  }

  // Fill the category suggestions from the existing gallery, so the client reuses
  // a category name exactly (new text still works — it just adds a new filter).
  fetch('darbi.json', { cache: 'no-cache' })
    .then(function (res) { return res.ok ? res.json() : []; })
    .then(function (data) {
      var seen = {};
      (Array.isArray(data) ? data : []).forEach(function (item) {
        if (item && item.category && !seen[item.category]) {
          seen[item.category] = true;
          var opt = document.createElement('option');
          opt.value = item.category;
          categoryList.appendChild(opt);
        }
      });
    })
    .catch(function () { /* keep the two default suggestions already in the HTML */ });

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('attēlu nevar nolasīt')); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
    });
  }

  function supportsWebp(canvas) {
    return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
  }

  // Resize to MAX_EDGE on the long side (never upscale) and compress under MAX_BYTES,
  // trying a few decreasing quality steps.
  function prepare(file) {
    return loadImage(file).then(function (loaded) {
      var img = loaded.img;
      var scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      var w = Math.round(img.naturalWidth * scale);
      var h = Math.round(img.naturalHeight * scale);
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(loaded.url);

      var type = supportsWebp(canvas) ? 'image/webp' : 'image/jpeg';
      var ext = type === 'image/webp' ? 'webp' : 'jpg';
      var qualities = [0.82, 0.72, 0.6, 0.48, 0.36];

      function tryQuality(i) {
        if (i >= qualities.length) return canvasToBlob(canvas, type, qualities[qualities.length - 1]);
        return canvasToBlob(canvas, type, qualities[i]).then(function (blob) {
          if (blob && (blob.size <= MAX_BYTES || i === qualities.length - 1)) return blob;
          return tryQuality(i + 1);
        });
      }

      return tryQuality(0).then(function (blob) { return { blob: blob, ext: ext, w: w, h: h }; });
    });
  }

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    preparedBlob = null;
    preparedExt = null;
    preview.classList.remove('is-visible');
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setStatus('Lūdzu, izvēlies fotoattēlu (JPEG, PNG vai WebP).', 'is-error');
      fileInput.value = '';
      return;
    }
    setStatus('Sagatavoju fotoattēlu...', null);
    prepare(file).then(function (result) {
      preparedBlob = result.blob;
      preparedExt = result.ext;
      preview.src = URL.createObjectURL(result.blob);
      preview.classList.add('is-visible');
      setStatus('Sagatavots: ' + result.w + '×' + result.h + ' px, ' + Math.round(result.blob.size / 1024) + ' KB.', null);
    }).catch(function () {
      setStatus('Neizdevās apstrādāt fotoattēlu. Pamēģini citu failu.', 'is-error');
    });
  });

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1] || ''); };
      reader.onerror = function () { reject(new Error('neizdevās nolasīt failu')); };
      reader.readAsDataURL(blob);
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var password = form.elements.password.value;
    var title = titleInput.value.trim();
    var category = categoryInput.value.trim();

    if (!password) { setStatus('Ievadi paroli.', 'is-error'); form.elements.password.focus(); return; }
    if (!title) { setStatus('Ievadi nosaukumu.', 'is-error'); titleInput.focus(); return; }
    if (!category) { setStatus('Ievadi kategoriju.', 'is-error'); categoryInput.focus(); return; }
    if (!preparedBlob) { setStatus('Vispirms izvēlies fotoattēlu.', 'is-error'); fileInput.focus(); return; }

    submitBtn.disabled = true;
    setStatus('Nosūtu...', null);

    blobToBase64(preparedBlob).then(function (base64) {
      return fetch(endpoint(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          password: password,
          title: title,
          category: category,
          slug: slugify(title),
          ext: preparedExt,
          contentType: preparedBlob.type,
          image: base64
        })
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, data: data };
      });
    }).then(function (result) {
      if (result.ok && result.data && result.data.ok) {
        setStatus('Pievienots! Galerijā redzams pēc apmēram minūtes.', 'is-ok');
        form.reset();
        preparedBlob = null;
        preview.classList.remove('is-visible');
      } else {
        var msg = (result.data && result.data.error) || 'Neizdevās nosūtīt. Pārbaudi paroli un pamēģini vēlreiz.';
        setStatus(msg, 'is-error');
      }
    }).catch(function () {
      setStatus('Neizdevās sazināties ar serveri. Pārbaudi internetu un pamēģini vēlreiz.', 'is-error');
    }).finally(function () {
      submitBtn.disabled = false;
    });
  });
})();
