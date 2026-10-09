/* V & M Būve — main.js (no dependencies) */
(function () {
  'use strict';

  var DATA_URL = 'darbi.json';
  var IMG_DIR = 'assets/img/darbi/';
  var EMAIL = 'vmbuve@inbox.lv';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- mobile menu ---------- */

  var toggle = $('.menu-toggle');
  var nav = $('#nav');

  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('menu-open', open);
  }

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      setMenu(open);
      if (open) {
        var first = nav.querySelector('a');
        if (first) first.focus({ preventScroll: true });
      }
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !e.target.closest('.site-header')) setMenu(false);
    });
    var desktop = window.matchMedia('(min-width: 1024px)');
    var onChange = function (e) { if (e.matches) setMenu(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange);
  }

  /* ---------- gallery (data from darbi.json) ---------- */

  var gallery = $('#gallery');
  var filters = $('#filters');
  var items = [];

  // "image" is a file name stem: <stem>-960.webp and <stem>-1600.webp are used.
  // A name with an extension (e.g. "foto.jpg") is used as is.
  function imageSrc(image, size) {
    if (/\.[a-z0-9]{3,4}$/i.test(image)) return IMG_DIR + image;
    return IMG_DIR + image + '-' + size + '.webp';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function svgIcon(id) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  function renderGallery() {
    var frag = document.createDocumentFragment();
    items.forEach(function (item, index) {
      var li = el('li', 'tile');
      li.dataset.category = item.category || '';

      var btn = el('button', 'tile-btn');
      btn.type = 'button';
      btn.dataset.index = String(index);
      btn.setAttribute('aria-haspopup', 'dialog');

      var img = document.createElement('img');
      img.src = imageSrc(item.image, 960);
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', function () {
        li.hidden = true;
        if (window.console) console.warn('Neizdevās ielādēt attēlu: ' + img.src);
      });

      var meta = el('span', 'tile-meta');
      if (item.category) meta.appendChild(el('span', 'tile-cat', item.category));
      meta.appendChild(el('span', 'tile-title', item.title));

      var zoom = el('span', 'tile-zoom');
      zoom.appendChild(svgIcon('i-expand'));

      btn.appendChild(img);
      btn.appendChild(zoom);
      btn.appendChild(meta);
      li.appendChild(btn);
      frag.appendChild(li);
    });
    gallery.textContent = '';
    gallery.appendChild(frag);
  }

  function renderFilters() {
    var cats = [];
    items.forEach(function (item) {
      if (item.category && cats.indexOf(item.category) === -1) cats.push(item.category);
    });
    if (cats.length < 2) { filters.hidden = true; return; }

    function chip(label, value, count) {
      var b = el('button', 'chip');
      b.type = 'button';
      b.dataset.filter = value;
      b.setAttribute('aria-pressed', value === '*' ? 'true' : 'false');
      b.appendChild(document.createTextNode(label));
      b.appendChild(el('span', 'chip-count', String(count)));
      return b;
    }

    filters.textContent = '';
    filters.appendChild(chip('Visi', '*', items.length));
    cats.forEach(function (cat) {
      var n = items.filter(function (i) { return i.category === cat; }).length;
      filters.appendChild(chip(cat, cat, n));
    });
    filters.hidden = false;

    filters.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      var value = b.dataset.filter;
      $$('.chip', filters).forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === b));
      });
      $$('.tile', gallery).forEach(function (li) {
        li.hidden = !(value === '*' || li.dataset.category === value);
      });
    });
  }

  function visibleIndexes() {
    return $$('.tile', gallery)
      .filter(function (li) { return !li.hidden; })
      .map(function (li) { return Number($('.tile-btn', li).dataset.index); });
  }

  function wireServicePhotos() {
    $$('[data-images]').forEach(function (btn) {
      var list = btn.dataset.images.split(/\s+/).map(function (stem) {
        for (var i = 0; i < items.length; i++) if (items[i].image === stem) return i;
        return -1;
      }).filter(function (i) { return i > -1; });
      if (!list.length) return;
      btn.hidden = false;
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.addEventListener('click', function () { openLightbox(list, 0, btn); });
    });
  }

  var needsDarbiData = !!gallery || $$('[data-images]').length > 0;

  if (gallery) {
    gallery.addEventListener('click', function (e) {
      var btn = e.target.closest('.tile-btn');
      if (!btn) return;
      var list = visibleIndexes();
      openLightbox(list, list.indexOf(Number(btn.dataset.index)), btn);
    });
  }

  if (needsDarbiData) {
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        items = (Array.isArray(data) ? data : []).filter(function (d) {
          return d && typeof d.title === 'string' && typeof d.image === 'string' && d.image;
        });
        if (gallery) { renderGallery(); renderFilters(); }
        wireServicePhotos();
      })
      .catch(function () {
        if (gallery) {
          gallery.textContent = '';
          gallery.appendChild(el('li', 'gallery-note', 'Fotogrāfijas pašlaik neizdevās ielādēt. Lūdzu, atjaunojiet lapu.'));
        }
      });
  }

  /* ---------- lightbox ---------- */

  var lb = $('#lightbox');
  var lbImg = null;
  var lbTitle = $('#lb-title');
  var lbCat = $('#lb-cat');
  var lbCount = $('#lb-count');
  var lbStage = $('#lb-stage');
  var lbPrev = lb ? $('.lb-prev', lb) : null;
  var lbNext = lb ? $('.lb-next', lb) : null;
  var lbList = [];
  var lbPos = 0;
  var lbReturn = null;

  var lbToken = 0;

  // The next photo is decoded off-screen first, so the lightbox never flashes empty.
  function showSlide(fresh) {
    var item = items[lbList[lbPos]];
    if (!item) return;
    if (!lbImg) {
      lbImg = el('img', 'lb-img');
      lbImg.id = 'lb-img';
      lbImg.alt = '';
      lbStage.appendChild(lbImg);
      fresh = true;
    }
    var token = ++lbToken;
    var src = imageSrc(item.image, 1600);
    var many = lbList.length > 1;
    lbCount.textContent = many ? (lbPos + 1) + ' / ' + lbList.length : '';
    lbPrev.hidden = !many;
    lbNext.hidden = !many;

    var caption = function () {
      lbTitle.textContent = item.title;
      lbCat.textContent = item.category || '';
    };
    var swap = function () {
      if (token !== lbToken) return;
      lbImg.src = src;
      lbImg.alt = item.title;
      lbImg.style.visibility = '';
      lbImg.classList.remove('is-loading');
      caption();
    };
    if (fresh) {
      lbImg.style.visibility = 'hidden';
      caption();
    }
    lbImg.classList.add('is-loading');

    var pre = new Image();
    pre.src = src;
    if (typeof pre.decode === 'function') pre.decode().then(swap, swap);
    else { pre.onload = swap; pre.onerror = swap; }

    if (many) {
      [lbPos - 1, lbPos + 1].forEach(function (p) {
        var near = items[lbList[(p + lbList.length) % lbList.length]];
        if (near) (new Image()).src = imageSrc(near.image, 1600);
      });
    }
  }

  function step(delta) {
    if (lbList.length < 2) return;
    lbPos = (lbPos + delta + lbList.length) % lbList.length;
    showSlide(false);
  }

  function openLightbox(list, pos, opener) {
    if (!lb || !list.length) return;
    lbList = list;
    lbPos = Math.max(0, pos);
    lbReturn = opener || document.activeElement;
    showSlide(true);
    if (typeof lb.showModal === 'function') {
      if (!lb.open) lb.showModal();
    } else {
      lb.setAttribute('open', '');
    }
    document.documentElement.classList.add('lb-open');
  }

  function closeLightbox() {
    if (!lb) return;
    if (typeof lb.close === 'function' && lb.open) lb.close();
    else { lb.removeAttribute('open'); onClosed(); }
  }

  function onClosed() {
    document.documentElement.classList.remove('lb-open');
    if (lbReturn && typeof lbReturn.focus === 'function') lbReturn.focus();
  }

  if (lb) {
    lb.addEventListener('close', onClosed);
    $('.lb-close', lb).addEventListener('click', closeLightbox);
    lbPrev.addEventListener('click', function () { step(-1); });
    lbNext.addEventListener('click', function () { step(1); });
    lbStage.addEventListener('click', function (e) {
      if (e.target === lbStage) closeLightbox();
    });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    });

    var touchX = null;
    var touchY = null;
    lbStage.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { touchX = null; return; }
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }, { passive: true });
    lbStage.addEventListener('touchend', function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      var dy = e.changedTouches[0].clientY - touchY;
      touchX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    });
  }

  /* ---------- mobile call bar ---------- */

  var callbar = $('#callbar');
  var footer = $('.site-footer');
  if (callbar && footer && 'IntersectionObserver' in window) {
    var footerVisible = false;
    var updateBar = function () {
      callbar.classList.toggle('is-visible', window.scrollY > 200 && !footerVisible);
    };
    new IntersectionObserver(function (entries) {
      footerVisible = entries[0].isIntersecting;
      updateBar();
    }, { rootMargin: '0px 0px -10% 0px' }).observe(footer);

    window.addEventListener('scroll', updateBar, { passive: true });
    updateBar();
  }

  /* ---------- enquiry form → e-mail ---------- */

  var form = $('#pieteikums');
  if (form) {
    form.noValidate = true;
    var status = $('#form-status');

    var rules = {
      vards: function (v) { return v ? '' : 'Lūdzu, ierakstiet savu vārdu.'; },
      kontakts: function (v) {
        if (!v) return 'Lūdzu, norādiet tālruni vai e-pastu, lai mēs varētu ar jums sazināties.';
        var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        var digits = v.replace(/\D/g, '').length;
        return isEmail || (digits >= 8 && !/[@]/.test(v)) ? '' : 'Pārbaudiet tālruņa numuru vai e-pasta adresi.';
      },
      apraksts: function (v) { return v ? '' : 'Lūdzu, īsi aprakstiet, kas jādara.'; }
    };

    function check(name) {
      var field = form.elements[name];
      var message = rules[name](field.value.trim());
      var out = document.getElementById(field.id + '-err');
      field.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (out) out.textContent = message;
      return !message;
    }

    Object.keys(rules).forEach(function (name) {
      var field = form.elements[name];
      field.addEventListener('blur', function () {
        if (field.value.trim() || field.getAttribute('aria-invalid') === 'true') check(name);
      });
      field.addEventListener('input', function () {
        if (field.getAttribute('aria-invalid') === 'true') check(name);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      Object.keys(rules).forEach(function (name) {
        if (!check(name) && !firstBad) firstBad = form.elements[name];
      });
      if (firstBad) { firstBad.focus(); return; }

      var get = function (name) {
        var f = form.elements[name];
        return f ? String(f.value || '').trim() : '';
      };
      var type = get('objekts');
      var lines = [
        'Vārds: ' + get('vards'),
        'Tālrunis / e-pasts: ' + get('kontakts')
      ];
      if (type) lines.push('Objekta veids: ' + type);
      if (get('vieta')) lines.push('Objekta atrašanās vieta: ' + get('vieta'));
      lines.push('', get('apraksts'));

      var subject = 'Pieteikums no mājaslapas' + (type ? ': ' + type : '');
      var href = 'mailto:' + EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(lines.join('\r\n'));

      window.location.href = href;

      if (status) {
        status.textContent = 'Paldies! Jūsu e-pasta programmā ir sagatavota vēstule, atliek to nosūtīt. ' +
          'Ja programma neatvērās, rakstiet uz ' + EMAIL + ' vai zvaniet +371 29 480 874.';
        status.hidden = false;
      }
    });
  }
})();
