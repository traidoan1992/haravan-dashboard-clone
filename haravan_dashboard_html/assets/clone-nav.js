// Menu sidebar của Haravan dùng JS (mục cha là <div>, không có href).
// Bản clone tĩnh không có SPA -> thêm script nhỏ này để mục menu vẫn bấm được.
(function () {
  var MAP = {
    // menu cấp 1
    'Tổng quan': 'index.html',
    'Đơn hàng': 'orders.html',
    'Vận chuyển': 'shipments_dashboard.html',
    'Sản phẩm': 'products.html',
    'Khách hàng': 'customers.html',
    'Quản lý tồn kho': 'inventory_transactions.html',
    'Sổ quỹ': 'accounting_transactions.html',
    'Khuyến mãi': 'discounts.html',
    'Báo cáo': 'reports_dashboard.html',
    'Marketing': 'settings_marketing_channels.html',
    'TikTok Ads': 'marketings_tiktok_ads_products.html',
    'Google Ads': 'googleshop_products.html',
    'Kênh bán hàng': 'settings_sale_channels.html',
    'Website': 'sale_channels_online_store_themes.html',
    'Shopee': 'sale_channels_shopee_dashboard.html',
    'Tiki': 'sale_channels_tiki_dashboard.html',
    'Ứng dụng': 'apps.html',
    'Cấu hình': 'settings.html',
    // menu cấp 2
    'Tất cả đơn hàng': 'orders.html',
    'Đơn hàng nháp': 'draft_orders.html',
    'Chưa hoàn tất': 'orders_new.html',
    'Giao hàng hàng loạt': 'orders_mass_fulfill.html',
    'Tất cả sản phẩm': 'products.html',
    'Nhóm sản phẩm': 'products_collections.html',
    'Bảng giá': 'products_pricing_list.html',
    'Tất cả khách hàng': 'customers.html',
    'Nhóm khách hàng': 'customers_segments.html',
    'Chiến dịch Broadcast': 'customers_broadcast_campaigns.html',
    'Kịch bản tự động': 'customers_flows.html',
    'Quản lý đánh giá': 'customers_rating.html',
    'Cấu hình thành viên': 'customers_settings.html',
    'Bảng phân tích': 'reports_dashboard.html',
    'Danh sách báo cáo': 'reports_listing.html',
    'Tất cả tồn kho': 'inventory_transactions.html',
    'Nhập hàng': 'inventory_inventory_receives.html',
    'Trả hàng nhập': 'inventory_purchase_returns.html',
    'Phiếu đặt hàng': 'inventory_purchasing_orders.html',
    'Kiểm kho': 'inventory_stock_takes.html',
    'Điều chuyển': 'inventory_transfers.html',
    'Nhà cung cấp': 'inventory_suppliers.html',
    'Lịch sử tồn kho': 'inventory_activities.html',
    'Giao dịch': 'accounting_transactions.html',
    'Công nợ': 'accounting_debts.html'
  };

  function labelOf(el) {
    var title = el.querySelector('[class*="_menu_item_title_"], [class*="_main_menu_title_"], [class*="_menu_item_child_text_"]');
    var raw = (title || el).textContent.replace(/\s+/g, ' ').trim();
    return raw.replace(/\s*\d+$/, '').trim(); // bỏ badge số (vd "Đơn hàng 289")
  }

  function targetOf(el) {
    // ưu tiên href sẵn có của <a> (do bước relink đã chuyển về file local)
    if (el.tagName === 'A') {
      var href = el.getAttribute('href');
      if (href && /\.html$/.test(href)) return href;
    }
    return MAP[labelOf(el)];
  }

  function wire() {
    var els = document.querySelectorAll(
      '[class*="_menu_item_wrapper_"], [class*="_main_menu_parent_"], [class*="_menu_item_child_item_"]'
    );
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.__cloneNav) continue;
      var target = targetOf(el);
      if (!target) continue;
      el.__cloneNav = true;
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (ev) {
        var t = targetOf(this);
        if (!t) return;
        ev.preventDefault();
        ev.stopPropagation();
        window.location.href = t;
      }, false);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
