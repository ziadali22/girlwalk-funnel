/* ============================================================
   Girl Walk — Analytics & attribution layer
   Unified GW.track() → Mixpanel + TikTok + Meta + Adjust.
   Each SDK loads ONLY if its ID is set in config.js.
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.GW_CONFIG || {};
  var ready = { mp: false, ttq: false, fbq: false, adjust: false };

  // ---- Attribution click IDs (captured from the landing URL) ----
  function captureClickIds() {
    var p = new URLSearchParams(location.search);
    var keys = ['ttclid', 'fbclid', 'gclid', 'utm_source', 'utm_medium',
                'utm_campaign', 'utm_content', 'utm_term'];
    var out = {};
    keys.forEach(function (k) {
      var v = p.get(k);
      if (v) { out[k] = v; try { sessionStorage.setItem('gw_' + k, v); } catch (e) {} }
      else { try { var s = sessionStorage.getItem('gw_' + k); if (s) out[k] = s; } catch (e) {} }
    });
    return out;
  }
  var clickIds = captureClickIds();

  // ---- SDK loaders (official stub snippets queue calls until loaded) ----
  function loadMixpanel(token) {
    (function (f, b) { if (!b.__SV) { var e, g, i, h; window.mixpanel = b; b._i = []; b.init = function (e, f, c) { function g(a, d) { var b = d.split("."); 2 == b.length && (a = a[b[0]], d = b[1]); a[d] = function () { a.push([d].concat(Array.prototype.slice.call(arguments, 0))) } } var a = b; "undefined" !== typeof c ? a = b[c] = [] : c = "mixpanel"; a.people = a.people || []; a.toString = function (a) { var d = "mixpanel"; "mixpanel" !== c && (d += "." + c); a || (d += " (stub)"); return d }; a.people.toString = function () { return a.toString(1) + ".people (stub)" }; i = "disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" "); for (h = 0; h < i.length; h++) g(a, i[h]); var j = "set set_once union unset remove delete".split(" "); a.get_group = function () { function b(c) { d[c] = function () { call2_args = arguments; call2 = [c].concat(Array.prototype.slice.call(call2_args, 0)); a.push([e, call2]) } } for (var d = {}, e = ["get_group"].concat(Array.prototype.slice.call(arguments, 0)), c = 0; c < j.length; c++) b(j[c]); return d }; b._i.push([e, f, c]) }; b.__SV = 1.2; e = f.createElement("script"); e.type = "text/javascript"; e.async = !0; e.src = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"; e.onload = function () { ready.mp = true; }; g = f.getElementsByTagName("script")[0]; g.parentNode.insertBefore(e, g) } })(document, window.mixpanel || []);
    window.mixpanel.init(token, { track_pageview: true, persistence: 'localStorage' });
    ready.mp = true;
  }

  function loadTikTok(id) {
    !function (w, d, t) { w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = "page track identify instances debug on off once ready alias group enableCookie disableCookie holdConsent revokeConsent grantConsent".split(" "); ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }; for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]); ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e }; ttq.load = function (e, n) { var r = "https://analytics.tiktok.com/i18n/pixel/events.js", o = n && n.partner; ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r; ttq._t = ttq._t || {}; ttq._t[e] = +new Date; ttq._o = ttq._o || {}; ttq._o[e] = n || {}; n = document.createElement("script"); n.type = "text/javascript"; n.async = !0; n.src = r + "?sdkid=" + e + "&lib=" + t; e = document.getElementsByTagName("script")[0]; e.parentNode.insertBefore(n, e) }; ttq.load(id); ttq.page(); }(window, document, 'ttq');
    ready.ttq = true;
  }

  function loadMeta(id) {
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', id);
    window.fbq('track', 'PageView');
    ready.fbq = true;
  }

  function loadAdjust(cfg) {
    var s = document.createElement('script');
    s.src = 'https://cdn.adjust.com/adjust-latest.min.js';
    s.async = true;
    s.onload = function () {
      try {
        window.Adjust.initSdk({ appToken: cfg.appToken, environment: cfg.environment || 'production' });
        ready.adjust = true;
      } catch (e) {}
    };
    document.head.appendChild(s);
  }

  // ---- Event name → platform standard-event mapping ----
  // Generic events still go to Mixpanel as-is.
  var MAP = {
    FunnelStart:      { ttq: 'ViewContent',     fb: 'ViewContent',      adj: 'funnelStart' },
    InitiateCheckout: { ttq: 'InitiateCheckout', fb: 'InitiateCheckout', adj: 'initiateCheckout' },
    Purchase:         { ttq: 'CompletePayment',  fb: 'Purchase',         adj: 'purchase' }
  };

  function track(event, props) {
    props = props || {};
    if (ready.mp && window.mixpanel) { try { window.mixpanel.track(event, props); } catch (e) {} }
    var m = MAP[event];
    if (m) {
      if (window.ttq) { try { window.ttq.track(m.ttq, props); } catch (e) {} }
      if (window.fbq) { try { window.fbq('track', m.fb, props); } catch (e) {} }
      if (window.Adjust && m.adj) {
        var tok = (CFG.adjust && CFG.adjust.eventTokens && CFG.adjust.eventTokens[m.adj]) || '';
        if (tok) { try { window.Adjust.trackEvent({ eventToken: tok }); } catch (e) {} }
      }
    }
  }

  function identify(id) {
    if (ready.mp && window.mixpanel && id) { try { window.mixpanel.identify(id); } catch (e) {} }
  }

  // ---- Superwall Web Checkout redirect ----
  function checkout(plan, quizState) {
    track('InitiateCheckout', { plan: plan });
    var base = CFG.superwall && CFG.superwall.checkoutUrl;
    if (!base) return false; // not configured → caller shows stub
    var url = new URL(base);
    if (plan) url.searchParams.set('plan', plan);
    // Pass attribution click ids through for server-side matching
    Object.keys(clickIds).forEach(function (k) { url.searchParams.set(k, clickIds[k]); });
    // Pass a few quiz signals for context (optional)
    if (quizState) {
      ['goal', 'age', 'commitment'].forEach(function (k) {
        if (quizState[k] != null) url.searchParams.set('q_' + k, quizState[k]);
      });
    }
    window.location.href = url.toString();
    return true;
  }

  // ---- Init ----
  function init() {
    if (CFG.mixpanelToken) loadMixpanel(CFG.mixpanelToken);
    if (CFG.tiktokPixelId) loadTikTok(CFG.tiktokPixelId);
    if (CFG.metaPixelId)   loadMeta(CFG.metaPixelId);
    if (CFG.adjust && CFG.adjust.appToken) loadAdjust(CFG.adjust);

    // If the funnel was returned to after a successful Superwall (redirect mode) purchase
    var rp = (CFG.superwall && CFG.superwall.purchaseReturnParam) || 'gw_purchase';
    if (new URLSearchParams(location.search).get(rp)) {
      track('Purchase', {});
    }
  }

  window.GW = { track: track, identify: identify, checkout: checkout, clickIds: clickIds, config: CFG };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
