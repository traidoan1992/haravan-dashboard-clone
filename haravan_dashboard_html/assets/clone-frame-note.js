// Trang Customers / Reports / Shipments là app NHÚNG IFRAME (origin khác).
// Nếu iframe không nạp được (chặn cross-origin, hmac hết hạn, chưa đăng nhập...),
// hiển thị một bảng giải thích thay vì vùng trắng.
(function () {
  var REAL = {
    customers: 'https://noritake.myharavan.com/admin/customers',
    reports: 'https://noritake.myharavan.com/admin/reports/dashboard',
    shipments: 'https://noritake.myharavan.com/admin/shipments/dashboard'
  };

  function realUrl(src) {
    if (/customers\.haravan\.app/.test(src)) return REAL.customers;
    if (/\/shipments\//.test(src)) return REAL.shipments;
    return REAL.reports;
  }

  function panel(host, src) {
    var box = document.createElement('div');
    box.setAttribute('data-clone-frame-note', '1');
    box.style.cssText = [
      'position:absolute', 'inset:0', 'display:flex', 'align-items:center', 'justify-content:center',
      'background:#f9fafb', 'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif', 'padding:24px'
    ].join(';');
    box.innerHTML =
      '<div style="max-width:520px;text-align:center;color:#374151">' +
      '<div style="font-size:15px;font-weight:600;margin-bottom:8px">Trang này là ứng dụng nhúng (iframe)</div>' +
      '<div style="font-size:13px;line-height:1.55;color:#6b7280">Nội dung nằm ở một ứng dụng khác origin ' +
      '(customers.haravan.app / reports.haravan.app) nên bản clone tĩnh không chứa được.<br>' +
      'Nếu ô này trống, hãy mở bằng <b>Chrome/Edge</b> và đang đăng nhập Haravan — ' +
      'khung xem trước trong VS Code chặn iframe khác origin.</div>' +
      '<a href="' + realUrl(src) + '" target="_blank" rel="noopener" ' +
      'style="display:inline-block;margin-top:14px;padding:8px 14px;border-radius:6px;background:#2f6fed;color:#fff;' +
      'font-size:13px;text-decoration:none">Mở trên hệ thống thật ↗</a></div>';
    host.appendChild(box);
  }

  function run() {
    var f = document.querySelector('iframe#app-embed-iframe, iframe[src*="haravan.app"]');
    if (!f) return;
    var loaded = false;
    f.addEventListener('load', function () { loaded = true; });
    setTimeout(function () {
      if (loaded) return;
      var host = f.parentElement;
      if (!host || host.querySelector('[data-clone-frame-note]')) return;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      panel(host, f.getAttribute('src') || '');
    }, 4000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
